import csv
import json
import subprocess
import time
import sys
import re
from bs4 import BeautifulSoup

SETS = [
    ("Core Set",           ["Core_Set"]),
    ("Clan Pack",          [
        "Disciples_of_the_Void",
        "Underhand_of_the_Emperor",
        "Warriors_of_the_Wind_(set)",
        "Masters_of_the_Court",
        "The_Emperor%27s_Legion",
        "Defenders_of_Rokugan",
        "Seekers_of_Wisdom",
    ]),
    ("Imperial Cycle",     [
        "Tears_of_Amaterasu_(set)",
        "For_Honor_and_Glory",
        "Into_the_Forbidden_City",
        "The_Chrysanthemum_Throne",
        "Fate_Has_No_Secrets",
        "Meditations_on_the_Ephemeral",
    ]),
    ("Elemental Cycle",    [
        "Breath_of_the_Kami",
        "Tainted_Lands",
        "The_Fires_Within",
        "The_Ebb_and_Flow",
        "All_and_Nothing_(set)",
        "Elements_Unbound",
    ]),
    ("Inheritance Cycle",  [
        "For_the_Empire",
        "Bonds_of_Blood",
        "Justice_for_Satsume",
        "The_Children_of_Heaven",
        "A_Champion%27s_Foresight",
        "Shoju%27s_Duty",
    ]),
    ("Dominion Cycle",     [
        "Rokugan_at_War",
        "Spreading_Shadows",
        "In_Pursuit_of_Truth",
        "Campaigns_of_Conquest",
        "As_Honor_Demands",
        "Atonement",
    ]),
    ("Temptations Cycle",  [
        "Twisted_Loyalties",
        "Honor_in_Flames",
        "A_Crimson_Offering",
        "The_Temptation_of_the_Scorpion",
        "Coils_of_Power",
        "Peace_at_Any_Cost",
    ]),
    ("Premium Expansion",  [
        "Children_of_the_Empire",
        "Clan_War",
        "Under_Fu_Leng%27s_Shadow",
    ]),
]

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
API = "https://l5r-game.fandom.com/api.php"

def fetch(slug):
    # Use the MediaWiki parse API — it avoids the Cloudflare interstitial that
    # intermittently hits /wiki/ page loads.
    url = f"{API}?action=parse&page={slug}&prop=text&format=json&formatversion=2"
    last_err = None
    for attempt in range(5):
        res = subprocess.run(
            ["curl", "-sSL", "-A", UA, url],
            capture_output=True,
        )
        if res.returncode != 0:
            last_err = f"curl rc={res.returncode}: {res.stderr.decode(errors='replace')}"
            time.sleep(1 + attempt)
            continue
        body = res.stdout.decode("utf-8", errors="replace")
        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            last_err = f"json decode failed (len={len(body)}): {e}"
            time.sleep(1 + attempt)
            continue
        if "error" in data:
            raise RuntimeError(f"API error for {slug}: {data['error']}")
        return data["parse"]["text"]
    raise RuntimeError(f"failed to fetch {slug}: {last_err}")

def slug_to_display(slug):
    # Drop "_(set)" disambiguation, decode %27, replace underscores
    name = re.sub(r"_\(set\)$", "", slug)
    name = name.replace("%27", "'")
    name = name.replace("_", " ")
    return name

def parse_cards(html):
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.select("table.wikitable")
    cards = []
    for tbl in tables:
        rows = tbl.find_all("tr")
        if not rows:
            continue
        header_cells = rows[0].find_all(["th", "td"])
        headers = [c.get_text(strip=True).lower() for c in header_cells]
        # Locate column indexes
        def find_col(*names):
            for n in names:
                if n in headers:
                    return headers.index(n)
            return None
        i_id   = find_col("id", "card id", "#")
        i_name = find_col("name", "card name", "title")
        i_clan = find_col("clan")
        i_deck = find_col("deck")
        i_type = find_col("type", "card type")
        # Only treat as a card table if it has at least an ID and Name
        if i_id is None or i_name is None:
            continue
        for tr in rows[1:]:
            cells = tr.find_all(["td", "th"])
            if not cells:
                continue
            def val(i):
                if i is None or i >= len(cells):
                    return ""
                cell = cells[i]
                text = cell.get_text(" ", strip=True)
                if text:
                    return text
                # Fall back to image alt (clan icons) or link title.
                img = cell.find("img")
                if img and img.get("alt"):
                    alt = img["alt"].strip()
                    if alt:
                        return alt
                a = cell.find("a", title=True)
                if a:
                    return a["title"].strip()
                return ""
            cid   = val(i_id)
            cname = val(i_name)
            if not cid and not cname:
                continue
            clan = val(i_clan)
            # Normalize clan: "crane" -> "Crane", "Crane Clan" -> "Crane"
            if clan:
                clan = re.sub(r"\s+Clan$", "", clan, flags=re.IGNORECASE).strip()
                clan = clan[:1].upper() + clan[1:] if clan else clan
            cards.append({
                "id":   cid,
                "name": cname,
                "clan": clan,
                "deck": val(i_deck),
                "type": val(i_type),
            })
    return cards

def main():
    out_path = r"C:\Users\jorda\Downloads\Sell L5R\l5r_cards.csv"
    total = 0
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Set Category", "Set Name", "Card ID", "Card Name", "Clan", "Deck", "Card Type"])
        for category, slugs in SETS:
            for slug in slugs:
                display = slug_to_display(slug)
                print(f"Fetching {category} :: {display}", flush=True)
                html = fetch(slug)
                cards = parse_cards(html)
                print(f"  -> {len(cards)} cards", flush=True)
                for c in cards:
                    w.writerow([category, display, c["id"], c["name"], c["clan"], c["deck"], c["type"]])
                total += len(cards)
                time.sleep(0.5)
    print(f"\nTotal cards written: {total}")
    print(f"Output: {out_path}")

if __name__ == "__main__":
    main()
