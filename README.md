# Rookies — Workspace

Operational workspace for the Rookies platform and surrounding pitch work.

---

## Current status

- **App:** working end-to-end. Custom matching algo, Supabase backend, Career Officer Console integrated.
- **Pitch:** Partnership Proposal v2.0 sent to Mick Timmermans (TiSEM External Collaborations Manager) on 2026-05-07. He replied 2026-05-09 — soft yes, agreed to forward to Herbert Hamers (AD) and offered three warm intros (Career Services Officers, Jan-Peter van de Toren, Navid Mohamadi). Follow-up sent 2026-05-09.
- **Pipeline:** awaiting Mick's intros + Herbert-level conversation.

## What I'm doing this week

- Reorganizing the workspace (done — see folder structure below).
- Designing the LLM-based scoring layer (Phase planning).
- Following up on Mick's three suggested contacts.

## What I'm waiting on

- **Mick** → forward to Herbert (TiSEM AD)
- **Mick** → intros to: TiSEM Career Services Officers, Jan-Peter van de Toren (Brabant IMPACT Class), Navid Mohamadi (Shexon)
- **BOM** (warm intro to be requested via Cristian Dobre)

## Open decisions

- Whether to register the BV now or wait for first signed pilot agreement
- Apply to YC W27 with pilot data, or stick with Dutch ecosystem path (BOM, LUMO, Newion)
- Timing on LLM-scoring feature build (before or after pilot signed)

---

## Folder structure

```
Cowork/
├── app/                    Platform code (the actual product)
│   ├── rookies.html        Main app — HTML only
│   ├── career-console.html Career Officer Console — HTML only
│   ├── css/                Stylesheets, split per app
│   ├── js/                 JavaScript, split per app
│   └── supabase/           Edge Functions and migrations
│
├── decks/                  PowerPoint material
│   ├── current/            Current canonical version (v2.0)
│   ├── slides/             Standalone individual slides
│   └── archive/            Old/superseded decks
│
├── strategy/               Pre-meeting prep, briefings
│   └── may-07-meeting/     All prep for the first Mick meeting
│
├── comms/                  Email logs (sent + received)
├── personal/               CV / founder positioning material
├── assets/                 Images, photos, media
└── archive/                Old files kept for reference
```

## Key contacts

- **Mick Timmermans** — External Collaborations Manager, TiSEM (primary point of contact for TiSEM partnership)
- **Herbert Hamers** — Academic Director, TiSEM (downstream decision-maker)
- **Dr. Cristian Dobre** — Master Academic Director, Business Analytics and Operations Research, TiSEM (academic guidance)
- **Tudor Poenaru** — Founding Engineer, BSc Computer Science and Engineering, TU/e

## Tech stack

- **Frontend:** vanilla JS, no framework (single-page app)
- **Backend:** Supabase (Postgres + Auth + Storage), EU-hosted (eu-west-1)
- **Hosting:** Local file-based for now; production hosting TBD
- **Domain:** Squarespace-registered (not yet pointed)

## Branches and versioning

- Main repo: https://github.com/dantoma1/Rookies-Bun
- Working branch: `main`
- Deck versioning: increment minor for tweaks (v2.0 → v2.1), major for restructuring (v2.0 → v3.0)
