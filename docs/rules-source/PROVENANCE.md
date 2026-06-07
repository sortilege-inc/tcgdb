# Rules Source Provenance

This folder vendors the asciidoc source of the **Emerald Legacy collected rules
documents** for use as a clean (non-PDF) reference when writing rules logic and
populating the L5R rules skill.

## What's here

- `Rules Reference Guide.adoc` — RRG version 5.0, dated **2025-05-10**. This is
  the Emerald Legacy fan-continuation RRG. Diverges from FFG official v17 in
  several rulings (their docs flag changes with green highlights).
- `Emerald Edict.adoc` — Banned / restricted list, version 13, dated 2025-08-23.
- `images/` — Diagrams referenced by the RRG (clan mons, card explanation
  diagrams, RRG background art).

## Source

Vendored from `https://github.com/emerald-legacy/rules-documents` on 2026-06-07,
out of the sibling `rules-documents-main/` folder. Maintained by the Emerald
Legacy community (Hida Amoro / programming-wolf, per their README).

The upstream repo does not carry an explicit LICENSE file; it is published as
community rules documents intended for free redistribution and contribution.
This vendoring is for **internal reference use only** within tcgdb — no
republication.

## How this relates to other rules sources

| Source | Era | Format | When to cite |
|--------|-----|--------|--------------|
| `docs/l5r-rules-reference-v17.pdf` | FFG official v17 (last FFG release) | PDF | Primary source for FFG-era L5R LCG (Stronghold/Skirmish formats) |
| `docs/rules-source/Rules Reference Guide.adoc` | Emerald Legacy v5.0 | asciidoc | Primary source for Emerald Legacy ruleset / forward-compat rulings |
| `.claude/skills/l5r-rules/SKILL.md` | Distilled by us from FFG v17 | markdown | Quick reference for working on rules-touching code |

When FFG and Emerald Legacy disagree on a ruling, **FFG v17 wins for our default
Stronghold format**. Document any divergence per-ruling.

## Why vendor instead of point at the PDF?

The asciidoc format is semantically structured (entries demarcated, examples
marked `_Example:_`, cross-refs explicit, glossary-style entries with consistent
patterns). Parsing it into a structured rules database is far more reliable than
OCR'ing the PDF. The PDF stays as a fallback / for layout reference.
