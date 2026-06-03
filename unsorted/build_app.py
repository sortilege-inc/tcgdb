"""
Reads l5r_cards.csv and writes inventory.html — a single self-contained
inventory tracker for the L5R LCG. All card data is inlined; state lives in
the browser's localStorage and can be exported/imported as JSON.

Design notes
------------
- Each "set" can have multiple physical box instances (e.g. Core Set ships
  pre-duplicated as "Core Set 1" / "Core Set 2" / "Core Set 3"; other sets
  start as a single instance and can be duplicated at runtime).
- Per-instance counts are keyed by "<instanceName>::<cardId>" so each box
  tracks actual/promo independently. Expected can be overridden per card
  per instance.
- Card "expected" is the per-box quantity — i.e. how many copies you'd
  expect to find in *one* box. The per-instance default uses this value.
"""
import csv
import json
import os
import re

HERE = os.path.dirname(__file__)
CSV_PATH = os.path.join(HERE, "l5r_cards.csv")
OUT_PATH = os.path.join(HERE, "inventory.html")
# Load overrides from every inventory export in the folder; the most recent
# value wins so we always honour the latest hand-tuned baseline.
OVERRIDES_JSONS = sorted(
    [
        os.path.join(HERE, fn)
        for fn in os.listdir(HERE)
        if fn.startswith("l5r-inventory-") and fn.endswith(".json")
    ]
)

# Cards present on the wiki that are physically the FLIP SIDE of another card
# (so the inventory shouldn't list them separately). Keyed by (set, card id).
EXCLUDED_CARDS = {
    # Core Set elemental Role pairs — each Seeker is the back side of the
    # corresponding Keeper. Track Keepers only.
    ("Core Set", "214B"),  # Seeker of Air     (back of 214A Keeper of Air)
    ("Core Set", "215B"),  # Seeker of Earth   (back of 215A Keeper of Earth)
    ("Core Set", "216B"),  # Seeker of Fire    (back of 216A Keeper of Fire)
    ("Core Set", "217B"),  # Seeker of Water   (back of 217A Keeper of Water)
    ("Core Set", "218B"),  # Seeker of Void    (back of 218A Keeper of Void)
    # Under Fu Leng's Shadow co-op-mode Warlord variants share a physical card
    # with their standard side. Track the standard "B" sides only.
    ("Under Fu Leng's Shadow", "1A"),  # Akuma no Oni (coop)
    ("Under Fu Leng's Shadow", "2A"),  # The Obsidian Flower (coop)
    ("Under Fu Leng's Shadow", "3A"),  # Atsuko the Calamitous (coop)
}


# ---------- Expected-copies rule -----------------------------------------

SINGLETON_CATEGORIES_FOR_STRONGHOLD_PROVINCE = {
    "Clan Pack",
    "Inheritance Cycle",
    "Dominion Cycle",
    "Temptations Cycle",
    "Premium Expansion",
}
ALWAYS_SINGLETON_TYPES = {"Role", "Warlord", "treaty"}


def core_box_expected(card_type: str, clan: str) -> int:
    """Per-box quantity for a card inside ONE Core Set box."""
    if card_type in ("Province", "Stronghold", "Role"):
        return 1
    if clan == "Neutral":
        return 3
    # Clan-specific Character/Event/Attachment/Holding ship as 1 per box.
    return 1


def expected_for(category: str, set_name: str, card_type: str, clan: str) -> int:
    if category == "Core Set":
        return core_box_expected(card_type, clan)
    if card_type in ALWAYS_SINGLETON_TYPES:
        return 1
    # Clan War provinces ship as 2 copies each (confirmed by box inspection).
    if set_name == "Clan War" and card_type == "Province":
        return 2
    if card_type in ("Stronghold", "Province") and category in SINGLETON_CATEGORIES_FOR_STRONGHOLD_PROVINCE:
        return 1
    return 3


def load_overrides() -> dict:
    """Read every exported inventory JSON in the folder and return per-card
    expected overrides as {baseSetName: {cardId: expected}}.

    Later files (sorted lexicographically — our timestamped filenames sort
    chronologically) override earlier ones. v1 (flat) and v2 ({instances,
    counts}) shapes are both supported. Instance suffixes like "Core Set 1"
    are stripped so per-card baseline corrections apply across every box of
    the underlying set.
    """
    base_names = _csv_base_set_names()
    out: dict = {}
    for path in OVERRIDES_JSONS:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        state = data.get("state", data)
        # v2 has {instances, counts}; v1 is a flat map.
        entries = state.get("counts", state) if isinstance(state, dict) else {}
        for key, v in entries.items():
            if not isinstance(v, dict) or "expected" not in v or "::" not in key:
                continue
            inst_name, card_id = key.split("::", 1)
            base = _strip_instance_suffix(inst_name, base_names)
            try:
                out.setdefault(base, {})[card_id] = int(v["expected"])
            except (TypeError, ValueError):
                continue
    return out


def _csv_base_set_names() -> set:
    """Distinct Set Name values in the CSV."""
    with open(CSV_PATH, "r", encoding="utf-8", newline="") as f:
        return {row["Set Name"] for row in csv.DictReader(f)}


def _strip_instance_suffix(name: str, base_names: set) -> str:
    """If `name` looks like "<base> <N>" where <base> is a real set name,
    return <base>; otherwise return `name` unchanged."""
    m = re.match(r"^(.+) (\d+)$", name)
    if m and m.group(1) in base_names:
        return m.group(1)
    return name


def load_cards():
    overrides = load_overrides()
    cards = []
    initial_instances: dict = {}
    seen_base = []
    with open(CSV_PATH, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            base_set = row["Set Name"]
            if (base_set, row["Card ID"]) in EXCLUDED_CARDS:
                continue  # Flip-side duplicates handled elsewhere.
            if base_set not in initial_instances:
                seen_base.append(base_set)
                if base_set == "Core Set":
                    initial_instances[base_set] = ["Core Set 1", "Core Set 2", "Core Set 3"]
                else:
                    initial_instances[base_set] = [base_set]
            exp = expected_for(
                row["Set Category"], base_set, row["Card Type"], row["Clan"]
            )
            # Apply user overrides (per-card per-set baseline corrections).
            o = overrides.get(base_set, {}).get(row["Card ID"])
            if isinstance(o, int):
                exp = o
            cards.append({
                "setCategory": row["Set Category"],
                "baseSetName": base_set,
                "id": row["Card ID"],
                "name": row["Card Name"],
                "clan": row["Clan"],
                "deck": row["Deck"],
                "type": row["Card Type"],
                "expected": exp,
            })
    return cards, initial_instances, seen_base


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>L5R LCG Inventory</title>
<style>
  :root {
    --bg: #1c1c1f;
    --panel: #26262b;
    --panel-2: #2f2f36;
    --text: #e9e9ec;
    --muted: #9a9aa3;
    --border: #3a3a42;
    --accent: #c8a04d;
    --ok: #27ae60;
    --ok-bg: #1f3d29;
    --short: #c0392b;
    --short-bg: #422020;
    --over: #2980b9;
    --over-bg: #1f3147;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
  }
  header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    padding: 0.75rem 1rem;
  }
  .title-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  h1 { margin: 0; font-size: 1.2rem; color: var(--accent); }
  .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.5rem; }
  .controls input, .controls select, .controls button {
    background: var(--panel-2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.35rem 0.6rem;
    font: inherit;
  }
  .controls input[type="search"] { flex: 1 1 200px; min-width: 0; }
  .controls button { cursor: pointer; }
  .controls button:hover { background: #3a3a42; }
  .stats {
    display: flex; flex-wrap: wrap; gap: 1rem;
    font-size: 0.85rem; color: var(--muted);
    margin-top: 0.5rem;
  }
  .stats b { color: var(--text); }
  .stats .pill {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.2rem 0.7rem;
  }
  .stats .pill.ok { background: var(--ok-bg); border-color: var(--ok); color: #b8f0c2; }
  .stats .pill.short { background: var(--short-bg); border-color: var(--short); color: #f5b0a8; }
  .stats .pill.over { background: var(--over-bg); border-color: var(--over); color: #b0d4f0; }

  main { padding: 1rem; max-width: 1400px; margin: 0 auto; }

  details.category { margin-bottom: 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); overflow: hidden; }
  details.category > summary { padding: 0.6rem 0.9rem; font-weight: 600; cursor: pointer; user-select: none; background: var(--panel); display: flex; align-items: center; gap: 0.6rem; }
  details.category[open] > summary { border-bottom: 1px solid var(--border); }
  details.set { border-top: 1px solid var(--border); }
  details.set:first-of-type { border-top: none; }
  details.set > summary { padding: 0.5rem 1.5rem; cursor: pointer; user-select: none; background: var(--panel); font-size: 0.95rem; color: var(--muted); display: flex; align-items: center; gap: 0.5rem; }
  details.set[open] > summary { color: var(--text); }
  summary::-webkit-details-marker { color: var(--accent); }
  .summary-label { flex: 1 1 auto; }
  .summary-actions { display: inline-flex; gap: 0.25rem; align-items: center; }
  .summary-actions button {
    background: var(--panel-2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 0 0.4rem;
    font: inherit;
    cursor: pointer;
    line-height: 1.4rem;
    height: 1.4rem;
    min-width: 1.4rem;
  }
  .summary-actions button:hover { background: #3a3a42; }
  .summary-actions button.danger { color: #f5b0a8; }
  .badge { font-weight: normal; font-size: 0.8rem; color: var(--muted); margin-left: 0.5rem; }
  .badge.ok { color: #88e09a; }
  .badge.short { color: #f5b0a8; }
  .badge.over { color: #b0d4f0; }

  table.cards { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  table.cards th { text-align: left; padding: 0.4rem 0.5rem; background: var(--panel-2); color: var(--muted); font-weight: normal; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border); }
  table.cards td { padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
  table.cards tr:last-child td { border-bottom: none; }

  td.id-cell { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--muted); width: 3.5rem; }
  td.name-cell { font-weight: 500; }
  td.clan-cell, td.deck-cell, td.type-cell { color: var(--muted); white-space: nowrap; }
  td.exp-cell { width: 5rem; }
  td.exp-cell input { width: 3rem; background: var(--panel-2); color: var(--text); border: 1px solid var(--border); border-radius: 3px; padding: 2px 4px; text-align: center; font: inherit; }
  td.counter-cell { width: 7rem; }
  td.indicator { width: 4px; padding: 0; }

  tr.row-ok { background: var(--ok-bg); }
  tr.row-short { background: var(--short-bg); }
  tr.row-over { background: var(--over-bg); }
  tr.row-ok td.indicator { background: var(--ok); }
  tr.row-short td.indicator { background: var(--short); }
  tr.row-over td.indicator { background: var(--over); }

  .counter { display: inline-flex; align-items: center; gap: 0.25rem; }
  .counter button {
    width: 24px; height: 24px;
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 3px;
    cursor: pointer; font: inherit; line-height: 1;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0;
  }
  .counter button:hover { background: #3a3a42; }
  .counter input {
    width: 2.5rem; text-align: center;
    background: var(--panel-2); color: var(--text);
    border: 1px solid var(--border); border-radius: 3px;
    padding: 2px 4px; font: inherit;
    -moz-appearance: textfield;
  }
  .counter input::-webkit-outer-spin-button,
  .counter input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

  .legend { display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 0.78rem; color: var(--muted); }
  .legend .swatch { display: inline-block; width: 0.85rem; height: 0.85rem; border-radius: 2px; vertical-align: middle; margin-right: 0.25rem; }

  @media (max-width: 700px) {
    td.clan-cell, td.deck-cell, th.deck-h { display: none; }
    .controls input[type="search"] { flex-basis: 100%; }
  }
</style>
</head>
<body>
<header>
  <div class="title-row">
    <h1>L5R LCG Inventory</h1>
    <div class="legend">
      <span><span class="swatch" style="background:var(--ok)"></span>at target</span>
      <span><span class="swatch" style="background:var(--short)"></span>short</span>
      <span><span class="swatch" style="background:var(--over)"></span>over</span>
    </div>
  </div>
  <div class="controls">
    <input type="search" id="search" placeholder="Search name or ID...">
    <select id="filter-clan"><option value="">All clans</option></select>
    <select id="filter-status">
      <option value="">All statuses</option>
      <option value="short">Short only</option>
      <option value="ok">At target only</option>
      <option value="over">Over only</option>
    </select>
    <button id="expand-all">Expand all</button>
    <button id="collapse-all">Collapse all</button>
    <button id="export">Export JSON</button>
    <button id="import">Import JSON</button>
    <input type="file" id="file-input" accept=".json" style="display:none">
    <button id="reset" title="Clear all counts">Reset</button>
  </div>
  <div class="stats" id="stats"></div>
</header>
<main id="content"></main>

<script id="cards-data" type="application/json">__CARDS_JSON__</script>
<script id="instances-data" type="application/json">__INSTANCES_JSON__</script>
<script id="order-data" type="application/json">__ORDER_JSON__</script>
<script>
(function () {
  const BASE_CARDS = JSON.parse(document.getElementById('cards-data').textContent);
  const INITIAL_INSTANCES = JSON.parse(document.getElementById('instances-data').textContent);
  const BASE_SET_ORDER = JSON.parse(document.getElementById('order-data').textContent);
  const STORAGE_KEY = 'l5r-inventory-v2';

  // ---- State ------------------------------------------------------------
  // state = { instances: {baseSetName: [instanceName, ...]}, counts: {<instance>::<id>: {actual, promo, expected?}} }
  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.instances) parsed.instances = {};
        if (!parsed.counts) parsed.counts = {};
        return parsed;
      }
    } catch (e) { console.warn('Failed to load state', e); }
    // Legacy v1 migration: try to pull old counts and re-key Core Set ones.
    try {
      const legacy = localStorage.getItem('l5r-inventory-v1');
      if (legacy) {
        const v1 = JSON.parse(legacy);
        const counts = {};
        for (const [k, v] of Object.entries(v1)) {
          counts[migrateKey(k)] = v;
        }
        return { instances: {}, counts };
      }
    } catch (e) { /* ignore */ }
    return { instances: {}, counts: {} };
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn('Failed to save state', e); }
  }

  function migrateKey(key) {
    // Migrate "<oldBaseName>::<cardId>" where the base is split into multiple
    // initial instances (currently only Core Set) → route to instance #1.
    const i = key.indexOf('::');
    if (i < 0) return key;
    const base = key.slice(0, i);
    const cardId = key.slice(i + 2);
    if (INITIAL_INSTANCES[base] && INITIAL_INSTANCES[base][0] !== base) {
      return `${INITIAL_INSTANCES[base][0]}::${cardId}`;
    }
    return key;
  }

  // ---- Data access helpers ---------------------------------------------
  const EMPTY = Object.freeze({ actual: 0, promo: 0 });

  function getCount(instanceName, cardId) {
    return state.counts[`${instanceName}::${cardId}`] || EMPTY;
  }
  function getOrCreateCount(instanceName, cardId) {
    const k = `${instanceName}::${cardId}`;
    if (!state.counts[k]) state.counts[k] = { actual: 0, promo: 0 };
    return state.counts[k];
  }
  function pruneIfEmpty(instanceName, cardId) {
    const k = `${instanceName}::${cardId}`;
    const e = state.counts[k];
    if (e && !e.actual && !e.promo && !Number.isInteger(e.expected)) delete state.counts[k];
  }

  function getInstances(baseSetName) {
    if (state.instances[baseSetName] !== undefined) return state.instances[baseSetName];
    return INITIAL_INSTANCES[baseSetName] || [baseSetName];
  }
  function setInstances(baseSetName, list) {
    // Persist explicitly even when it matches the default so removals stick.
    state.instances[baseSetName] = list;
    saveState();
  }

  function cardsForBase(baseSetName) {
    return BASE_CARDS.filter(c => c.baseSetName === baseSetName);
  }

  function expectedForInstance(card, instanceName) {
    const e = state.counts[`${instanceName}::${card.id}`];
    if (e && Number.isInteger(e.expected)) return e.expected;
    return card.expected;
  }

  function statusFor(card, instanceName) {
    const exp = expectedForInstance(card, instanceName);
    const actual = (state.counts[`${instanceName}::${card.id}`] || EMPTY).actual;
    if (actual === exp) return 'ok';
    if (actual > exp) return 'over';
    return 'short';
  }

  // ---- Filters ---------------------------------------------------------
  const $search = document.getElementById('search');
  const $clan = document.getElementById('filter-clan');
  const $status = document.getElementById('filter-status');

  const clans = [...new Set(BASE_CARDS.map(c => c.clan).filter(Boolean))].sort();
  for (const c of clans) {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    $clan.appendChild(opt);
  }

  function matchesFilters(card, instanceName) {
    const q = $search.value.trim().toLowerCase();
    if (q) {
      const hay = (card.name + ' ' + card.id).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if ($clan.value && card.clan !== $clan.value) return false;
    if ($status.value && statusFor(card, instanceName) !== $status.value) return false;
    return true;
  }

  // ---- Sort -----------------------------------------------------------
  function compareIds(a, b) {
    const an = parseInt(a, 10);
    const bn = parseInt(b, 10);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  // ---- Render ---------------------------------------------------------
  const $content = document.getElementById('content');
  const rowByKey = new Map();           // "instance::id" -> tr
  const setBadgeByInstance = new Map(); // instanceName -> span
  const catBadgeByName = new Map();     // categoryName -> span
  const instancesByCategory = new Map();// categoryName -> [instanceName]
  const baseSetByInstance = new Map();  // instanceName -> baseSetName
  const categoryByInstance = new Map(); // instanceName -> categoryName

  function render() {
    rowByKey.clear();
    setBadgeByInstance.clear();
    catBadgeByName.clear();
    instancesByCategory.clear();
    baseSetByInstance.clear();
    categoryByInstance.clear();
    $content.innerHTML = '';

    // Iterate base sets in CSV order, then expand into their current instances.
    const byCategory = new Map();
    for (const baseSet of BASE_SET_ORDER) {
      const cards = cardsForBase(baseSet);
      if (!cards.length) continue;
      const category = cards[0].setCategory;
      const instances = getInstances(baseSet);
      if (!byCategory.has(category)) byCategory.set(category, []);
      for (const inst of instances) {
        byCategory.get(category).push({ baseSet, instance: inst, cards });
        baseSetByInstance.set(inst, baseSet);
        categoryByInstance.set(inst, category);
      }
    }

    for (const [catName, entries] of byCategory) {
      instancesByCategory.set(catName, entries.map(e => e.instance));
      const catDetails = document.createElement('details');
      catDetails.className = 'category';
      catDetails.open = true;
      const catSummary = document.createElement('summary');
      const catLabel = document.createElement('span');
      catLabel.className = 'summary-label';
      catLabel.textContent = catName;
      catSummary.appendChild(catLabel);
      const catBadge = document.createElement('span');
      catBadge.className = 'badge';
      catSummary.appendChild(catBadge);
      catBadgeByName.set(catName, catBadge);
      catDetails.appendChild(catSummary);

      for (const { baseSet, instance, cards } of entries) {
        const setDetails = document.createElement('details');
        setDetails.className = 'set';
        setDetails.open = true;
        const setSummary = document.createElement('summary');

        const label = document.createElement('span');
        label.className = 'summary-label';
        label.textContent = instance;
        setSummary.appendChild(label);

        const setBadge = document.createElement('span');
        setBadge.className = 'badge';
        setSummary.appendChild(setBadge);
        setBadgeByInstance.set(instance, setBadge);

        const actions = document.createElement('span');
        actions.className = 'summary-actions';
        const dup = document.createElement('button');
        dup.type = 'button';
        dup.textContent = '+ Add box';
        dup.title = `Add another copy of ${baseSet}`;
        dup.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); duplicateSet(baseSet); });
        actions.appendChild(dup);
        // Only allow removing an instance when more than one exists.
        if (getInstances(baseSet).length > 1) {
          const rm = document.createElement('button');
          rm.type = 'button';
          rm.className = 'danger';
          rm.textContent = '× Remove';
          rm.title = `Remove this copy of ${baseSet}`;
          rm.addEventListener('click', (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            if (confirm(`Remove "${instance}"? Any counts entered for it will be deleted.`)) {
              removeInstance(baseSet, instance);
            }
          });
          actions.appendChild(rm);
        }
        setSummary.appendChild(actions);
        setDetails.appendChild(setSummary);

        const table = document.createElement('table');
        table.className = 'cards';
        table.innerHTML = `
          <thead><tr>
            <th>ID</th><th>Name</th><th>Clan</th><th class="deck-h">Deck</th>
            <th>Type</th><th>Expected</th><th>Actual</th><th>Promo</th><th></th>
          </tr></thead><tbody></tbody>`;
        const tbody = table.querySelector('tbody');

        const sorted = [...cards].sort((a, b) => compareIds(a.id, b.id));
        for (const card of sorted) {
          if (!matchesFilters(card, instance)) continue;
          const tr = renderRow(card, instance);
          tbody.appendChild(tr);
          rowByKey.set(`${instance}::${card.id}`, tr);
        }

        setDetails.appendChild(table);
        catDetails.appendChild(setDetails);
        recomputeSetBadge(instance);
      }
      $content.appendChild(catDetails);
      recomputeCategoryBadge(catName);
    }
    updateStats();
  }

  function renderRow(card, instance) {
    const tr = document.createElement('tr');
    const e = getCount(instance, card.id);
    tr.innerHTML = `
      <td class="id-cell">${esc(card.id)}</td>
      <td class="name-cell">${esc(card.name)}</td>
      <td class="clan-cell">${esc(card.clan)}</td>
      <td class="deck-cell">${esc(card.deck)}</td>
      <td class="type-cell">${esc(card.type)}</td>
      <td class="exp-cell"><input type="number" min="0" class="exp-input" value="${expectedForInstance(card, instance)}" title="Click to change expected count for this card in this box"></td>
      <td class="counter-cell">
        <div class="counter">
          <button data-act="dec" data-field="actual">−</button>
          <input type="number" min="0" class="actual-input" value="${e.actual}">
          <button data-act="inc" data-field="actual">+</button>
        </div>
      </td>
      <td class="counter-cell">
        <div class="counter">
          <button data-act="dec" data-field="promo">−</button>
          <input type="number" min="0" class="promo-input" value="${e.promo}">
          <button data-act="inc" data-field="promo">+</button>
        </div>
      </td>
      <td class="indicator"></td>
    `;
    applyRowStatus(tr, card, instance);

    tr.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-act]');
      if (!btn) return;
      const field = btn.dataset.field;
      const delta = btn.dataset.act === 'inc' ? 1 : -1;
      const cur = getCount(instance, card.id)[field];
      setField(card, instance, field, Math.max(0, cur + delta));
    });
    tr.querySelector('.actual-input').addEventListener('input', (ev) => {
      setField(card, instance, 'actual', clampInt(ev.target.value), true);
    });
    tr.querySelector('.promo-input').addEventListener('input', (ev) => {
      setField(card, instance, 'promo', clampInt(ev.target.value), true);
    });
    tr.querySelector('.exp-input').addEventListener('input', (ev) => {
      const v = clampInt(ev.target.value);
      const k = `${instance}::${card.id}`;
      if (v === card.expected) {
        if (state.counts[k]) {
          delete state.counts[k].expected;
          pruneIfEmpty(instance, card.id);
        }
      } else {
        getOrCreateCount(instance, card.id).expected = v;
      }
      saveState();
      applyRowStatus(tr, card, instance);
      recomputeSetBadge(instance);
      recomputeCategoryBadge(categoryByInstance.get(instance));
      updateStats();
    });
    return tr;
  }

  function setField(card, instance, field, value, skipInputUpdate) {
    const e = getOrCreateCount(instance, card.id);
    e[field] = value;
    pruneIfEmpty(instance, card.id);
    saveState();
    const tr = rowByKey.get(`${instance}::${card.id}`);
    if (tr) {
      if (!skipInputUpdate) tr.querySelector('.' + field + '-input').value = value;
      applyRowStatus(tr, card, instance);
    }
    recomputeSetBadge(instance);
    recomputeCategoryBadge(categoryByInstance.get(instance));
    updateStats();
  }

  function applyRowStatus(tr, card, instance) {
    tr.classList.remove('row-ok', 'row-short', 'row-over');
    tr.classList.add('row-' + statusFor(card, instance));
  }

  function aggregateInstance(instance) {
    let exp = 0, act = 0, ok = 0, short = 0, over = 0, total = 0;
    const baseSet = baseSetByInstance.get(instance);
    if (!baseSet) return { exp, act, ok, short, over, total };
    for (const c of cardsForBase(baseSet)) {
      const e = state.counts[`${instance}::${c.id}`] || EMPTY;
      const cexp = expectedForInstance(c, instance);
      exp += cexp;
      act += e.actual;
      total++;
      const st = statusFor(c, instance);
      if (st === 'ok') ok++;
      else if (st === 'short') short++;
      else if (st === 'over') over++;
    }
    return { exp, act, ok, short, over, total };
  }

  function recomputeSetBadge(instance) {
    const el = setBadgeByInstance.get(instance);
    if (!el) return;
    const a = aggregateInstance(instance);
    writeBadge(el, a);
  }

  function recomputeCategoryBadge(category) {
    const el = catBadgeByName.get(category);
    if (!el) return;
    let exp = 0, act = 0, ok = 0, short = 0, over = 0, total = 0;
    const insts = instancesByCategory.get(category) || [];
    for (const i of insts) {
      const a = aggregateInstance(i);
      exp += a.exp; act += a.act; ok += a.ok; short += a.short; over += a.over; total += a.total;
    }
    writeBadge(el, { exp, act, ok, short, over, total });
  }

  function writeBadge(el, a) {
    const parts = [`${a.act}/${a.exp}`, `${a.ok}/${a.total} at target`];
    if (a.short) parts.push(`${a.short} short`);
    if (a.over) parts.push(`${a.over} over`);
    el.textContent = parts.join(' · ');
    el.classList.remove('ok', 'short', 'over');
    if (a.short) el.classList.add('short');
    else if (a.over) el.classList.add('over');
    else if (a.ok === a.total && a.total > 0) el.classList.add('ok');
  }

  function updateStats() {
    let totalCards = 0, totalExpected = 0, totalActual = 0, totalPromo = 0;
    let nOk = 0, nShort = 0, nOver = 0;
    for (const baseSet of BASE_SET_ORDER) {
      const cards = cardsForBase(baseSet);
      for (const inst of getInstances(baseSet)) {
        for (const c of cards) {
          totalCards++;
          totalExpected += expectedForInstance(c, inst);
          const e = state.counts[`${inst}::${c.id}`];
          if (e) { totalActual += e.actual; totalPromo += e.promo; }
          const st = statusFor(c, inst);
          if (st === 'ok') nOk++;
          else if (st === 'short') nShort++;
          else if (st === 'over') nOver++;
        }
      }
    }
    const pct = totalExpected ? Math.round(100 * Math.min(totalActual, totalExpected) / totalExpected) : 0;
    document.getElementById('stats').innerHTML = `
      <span class="pill"><b>${totalCards}</b> card slots</span>
      <span class="pill"><b>${totalActual}</b> / ${totalExpected} owned (${pct}%)</span>
      <span class="pill"><b>${totalPromo}</b> promos</span>
      <span class="pill ok"><b>${nOk}</b> at target</span>
      <span class="pill short"><b>${nShort}</b> short</span>
      <span class="pill over"><b>${nOver}</b> over</span>
    `;
  }

  // ---- Duplicate / Remove ----------------------------------------------
  function nextInstanceNumber(baseSetName) {
    const used = new Set();
    for (const name of getInstances(baseSetName)) {
      if (name === baseSetName) { used.add(1); continue; }
      const m = name.match(/^(.+) (\\d+)$/);
      if (m && m[1] === baseSetName) used.add(parseInt(m[2], 10));
    }
    let n = 2;
    while (used.has(n)) n++;
    return n;
  }
  function duplicateSet(baseSetName) {
    const list = [...getInstances(baseSetName)];
    list.push(`${baseSetName} ${nextInstanceNumber(baseSetName)}`);
    setInstances(baseSetName, list);
    render();
  }
  function removeInstance(baseSetName, instanceName) {
    const list = getInstances(baseSetName).filter(n => n !== instanceName);
    setInstances(baseSetName, list);
    // Clean up any counts that referenced this instance.
    const prefix = instanceName + '::';
    for (const k of Object.keys(state.counts)) {
      if (k.startsWith(prefix)) delete state.counts[k];
    }
    saveState();
    render();
  }

  // ---- Misc utility ----------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function clampInt(v) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
  }

  // ---- Toolbar ---------------------------------------------------------
  $search.addEventListener('input', render);
  $clan.addEventListener('change', render);
  $status.addEventListener('change', render);

  document.getElementById('expand-all').addEventListener('click', () => {
    document.querySelectorAll('details').forEach(d => d.open = true);
  });
  document.getElementById('collapse-all').addEventListener('click', () => {
    document.querySelectorAll('details.set').forEach(d => d.open = false);
  });

  document.getElementById('export').addEventListener('click', () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url; a.download = `l5r-inventory-${ts}.json`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  });

  const $fileInput = document.getElementById('file-input');
  document.getElementById('import').addEventListener('click', () => $fileInput.click());
  $fileInput.addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object') throw new Error('Invalid file');
        if (!confirm('Replace current counts with the imported file?')) return;
        const s = data.state && typeof data.state === 'object' ? data.state : data;
        // v2 shape: {instances, counts}. Otherwise assume legacy flat map.
        if (s.instances && s.counts) {
          state = { instances: {}, counts: {} };
          for (const [k, v] of Object.entries(s.instances)) {
            if (Array.isArray(v)) state.instances[k] = v.slice();
          }
          for (const [k, v] of Object.entries(s.counts)) {
            if (v && typeof v === 'object') {
              state.counts[migrateKey(k)] = {
                actual: clampInt(v.actual),
                promo: clampInt(v.promo),
                ...(Number.isInteger(v.expected) ? { expected: v.expected } : {})
              };
            }
          }
        } else {
          // Legacy v1 flat map.
          state = { instances: {}, counts: {} };
          for (const [k, v] of Object.entries(s)) {
            if (v && typeof v === 'object') {
              state.counts[migrateKey(k)] = {
                actual: clampInt(v.actual),
                promo: clampInt(v.promo),
                ...(Number.isInteger(v.expected) ? { expected: v.expected } : {})
              };
            }
          }
        }
        saveState();
        render();
      } catch (e) {
        alert('Failed to import: ' + e.message);
      } finally {
        $fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('Clear ALL counts, expected overrides, and added box copies?')) return;
    state = { instances: {}, counts: {} };
    saveState();
    render();
  });

  render();
})();
</script>
</body>
</html>
"""


def main():
    cards, initial_instances, base_order = load_cards()
    out = HTML_TEMPLATE
    out = out.replace("__CARDS_JSON__", json.dumps(cards, ensure_ascii=False, separators=(",", ":")))
    out = out.replace("__INSTANCES_JSON__", json.dumps(initial_instances, ensure_ascii=False, separators=(",", ":")))
    out = out.replace("__ORDER_JSON__", json.dumps(base_order, ensure_ascii=False, separators=(",", ":")))
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)
    print(f"Wrote {OUT_PATH} ({len(out):,} bytes, {len(cards)} unique base cards)")
    # Quick distribution print
    from collections import Counter
    print("Expected default by category:")
    by_cat = {}
    for c in cards:
        by_cat.setdefault(c["setCategory"], []).append(c["expected"])
    for k, v in by_cat.items():
        instances = sum(len(initial_instances.get(b, [b])) for b in set(c["baseSetName"] for c in cards if c["setCategory"] == k))
        total_per_box = sum(v)
        print(f"  {k}: {len(v)} unique cards, {instances} initial instances, per-box expected total={total_per_box}, breakdown={dict(Counter(v))}")


if __name__ == "__main__":
    main()
