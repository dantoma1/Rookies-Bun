---
title: "Rookies — Background, Story, and Key Facts"
subtitle: "Internal reference document for CV / interview / pitch use"
author: "Dan Toma Poenaru"
date: "May 2026"
---

# Rookies — Background & Story

A reference document for use as context when writing CVs, LinkedIn copy, cover letters, or interview talking points. Written candidly for AI assistance, not for external publication.

---

## 1. What Rookies is, in one paragraph

Rookies is an early-career job platform built for the Dutch market — initially Tilburg University, with Brabant and the wider Netherlands as the expansion path. It connects students directly with employers (especially the SMEs and boutique firms that other platforms price out), gives recruiters transparent, ranked candidate matches, and provides career services with a tool designed around their daily 1-on-1 work. The mantra: **"Find work like a human."** The thesis: matching, accessibility, and strategic data should be the core of an early-career platform — not premium add-ons.

---

## 2. How it began — the personal story

I'm a TiSEM graduate (BSc International Business Administration; MSc Business Analytics & Operations Research, both at Tilburg University). During my master's, I noticed something specific about how TiU students experienced the job hunt: they kept seeing the same twenty corporate names — EY, Deloitte, ASML, the usual list — and almost no exposure to the boutique firms, regional tech, sustainability orgs, and mid-size industrials that would gladly hire them. The structural cause turned out to be pricing: the dominant career platform monetizes companies by selling visibility, which prices out almost every SME in Brabant.

In April 2024, I summited Everest Base Camp at 5,400 meters with the Tilburg University flag — a personal milestone that, in hindsight, became the symbolic origin of Rookies. The image of carrying the TiU flag to the world's tallest mountain became the emotional anchor of how I think about what the platform should do for the people who carry that flag next: every TiU student stepping into the working world deserves the same lift.

I decided that rather than complain about JobTeaser (the incumbent), I'd build the platform that does what they don't. By late 2025 I was deep into product and engineering. By May 2026 I was pitching the partnership proposal to TiSEM senior leadership.

---

## 3. The problem Rookies solves

Three structural failures of the existing market:

1. **The "twenty companies" problem.** Big-name corporates pay premium tiers and dominate visibility; SMEs are priced out and never appear in front of students. Students experience a fake job market that doesn't reflect actual hiring activity.

2. **The matching gap.** On existing platforms, matching is a paid add-on if it exists at all. Students browse a feed and filter by tags — there's no relevance signal telling them which roles actually fit. Recruiters do the same on their side.

3. **The data gap.** Universities have no real-time view of what employers are searching for, what skills are in demand, or how their students are placing. The data they need for accreditation, rankings, and curriculum strategy doesn't surface from the existing platforms.

---

## 4. How Rookies works — three audiences, one platform

**For students.** A discovery surface where every job is presented by relevance, not by who paid for visibility. SMEs that other platforms hide are surfaced by default. Mobile-native, profile-driven, no opt-in walls. The platform stays with them past first placement.

**For employers.** Recruiters reach the right TiU students directly — ranked, transparent, one-click invite-to-apply. Small employers post freely without artificial caps. The platform Brabant boutique firms can actually use.

**For career services (the differentiator).** A *Career Officer Console* designed for the daily 1-on-1 work — with a Match Analyzer that turns advising sessions into structured coached conversations, a Market Pulse view of trending demand, a Career Path Explorer for evidence-based career direction conversations, and an Engagement view that flags at-risk students for proactive outreach. The platform supports the human work — never replaces it.

For the university leadership: skills-gap intelligence dashboards designed to support accreditation reviews, rankings submissions, and strategic positioning.

---

## 5. The five structural advantages (positioning vs. JobTeaser)

1. **Matching at the core, not as a premium feature.** Bidirectional, transparent, available to every user — built in across the platform from day one.
2. **Skills-gap intelligence for university management.** Real-time data on what employers search for vs. what TiU students have — the strategic data the AD's office is increasingly asked for.
3. **SME accessibility — solving the supply problem.** Open posting fixes the structural reason most SMEs never reach TiU students. Per CBS, Noord-Brabant has 77,000+ MKB businesses (2–249 employees) — most don't fit the existing platform's pricing.
4. **Direct outreach + Career Officer Console.** A two-sided platform with a third surface designed specifically for career services teams.
5. **Longitudinal outcome tracking.** Placement signal continues past the application — feeds TiU's curriculum and strategy data over years.

---

## 6. What I've built (technical scope)

**The platform itself** — a single-file HTML web app (~9,000+ lines of vanilla JavaScript, no framework dependency) that delivers:

- **Three role-specific surfaces:** student profile + browse + applications, company dashboard + listings + applicants + recruiters management, admin views.
- **Custom match-scoring algorithm (v2.0):** a 20-point weighted formula across 10 dimensions (skills, role interest, sector fit, location, employment type, language, etc.), with a dynamic denominator that excludes categories the job didn't populate. Bidirectional — students see roles by relevance; employers see candidates ranked by the same logic.
- **Recruiters management:** company-level recruiters, listing assignment, badges, notification preferences, auto-archive logic.
- **Settings / profile / messaging / applications flows** for both sides.
- **Responsive design** with media-query baselines, scrollable filters, sort dropdowns, and mobile-friendly layouts.
- **Career Officer Console** — a separate companion HTML app (~1,665 lines) with four tools: Match Analyzer (with templated coaching prompts), Market Pulse (trending skills + sector donut + week-over-week deltas), Career Path Explorer, and Engagement view (at-risk student triage).

**Backend:**
- Supabase (Postgres + Auth + Storage), EU-hosted (eu-west-1).
- Schema design for students, employers, jobs, applications, company_recruiters, messages.
- Row-level security policies, with calibrated tightening/loosening based on demo vs. production needs.
- Match-relevant indexes and JSONB fields for skills.
- Seeded with 20+ realistic student profiles for demo and testing.

**Strategic deliverables:**
- 17-slide partnership proposal deck (PPTX, brand-consistent, programmatically generated via pptxgenjs for iterability).
- 12-slide in-meeting competitive-advantages deck.
- 21-page Q&A playbook covering every objection.
- Strategic briefing analyzing the macro context, JobTeaser landscape, and TiU's strategic environment.
- Minute-by-minute meeting strategy with sales psychology framing.
- 2-page morning-of brief (cue-card density).

---

## 7. Team

**Dan Toma Poenaru — Founder.** Operational lead, product, engineering, partnerships, strategy. Builds the platform, runs the pitch, signs the deals.

**Tudor Poenaru — Founding Engineer.** BSc Computer Science and Engineering, Eindhoven University of Technology (TU/e). Back-end and product engineering.

**Dr. Cristian Dobre — Academic Guidance.** Associate Professor, Department of Econometrics and Operations Research; Master Academic Director, Business Analytics and Operations Research, TiSEM. Champions the project internally; opened the door to TiSEM senior leadership.

The team is deliberately lean. Past pilot, if it's working for both sides, the partnership funds growth — bringing on senior engineering and operational hires when the platform earns the right to have them.

---

## 8. Where we are now (May 2026)

- Platform built end-to-end and demoable (student + employer + admin flows, plus Career Officer Console).
- Partnership proposal pitched to Mick Timmermans (External Collaborations Manager, TiSEM) — followed up with leave-behind deck for forwarding to Herbert Hamers (Academic Director).
- Targeting a four-to-six-month parallel pilot at TiSEM (May–October), free for TiU, no exclusivity, bounded downside.
- Seed-stage, pre-revenue, founder-funded.
- Path: TiU pilot → broader Dutch universities → European expansion.

---

## 9. Skills and capabilities demonstrated (for CV / interview use)

**Product & Engineering:**
- Full-stack web app design and implementation (HTML, CSS, vanilla JavaScript, Supabase).
- Database schema design (Postgres, JSONB, RLS, indexes).
- Algorithm design (weighted scoring, dynamic denominator, bidirectional matching).
- Single-file architecture decisions; performance-aware DOM patterns.
- Programmatic document generation (pptxgenjs, pandoc-driven workflows).

**Strategy & Positioning:**
- Competitive analysis (JobTeaser landscape, structural diagnosis, market gaps).
- Strategic narrative architecture (three audiences, five structural advantages, complement-not-replacement).
- Sales psychology — enrollment over selling, low-commitment yes, mirroring vocabulary.

**Communication & Writing:**
- Long-form strategic writing (briefings, Q&A playbooks, morning briefs).
- Pitch deck design (17-slide leave-behind + 12-slide in-meeting).
- Email composition for senior stakeholders.

**Operations & Partnerships:**
- Stakeholder mapping (External Affairs, Academic Director, faculty advisor, central management).
- Relationship building inside an academic institution.
- Pilot proposal design (timing, structure, success metrics, exchange terms).

**Domain knowledge:**
- Dutch labor market for early-career talent.
- Higher-education accreditation, rankings, and graduate-outcome reporting (NVAO, VSNU context).
- Tilburg-specific institutional context (TiSEM, BAOR program, External Affairs Office).

---

## 10. Personal narrative arc (for CV positioning)

The most useful framing for a CV/LinkedIn audience is probably:

> *Founder of Rookies (rookies.work), a Dutch early-career job platform. Designed and built end-to-end — product, matching algorithm, backend, partnerships strategy — with the goal of fixing the structural mismatch between students and the SMEs that would hire them. Currently in partnership conversations with Tilburg University.*

For more depth: *MSc Business Analytics & Operations Research at Tilburg University, with academic guidance from Dr. Cristian Dobre (Master Academic Director, BAOR). Built the platform during the master's, transitioned to founder full-time post-graduation. Symbolic origin moment: raising the TiU flag at Everest Base Camp (5,400m, April 2024).*

---

## 11. Tagline and one-liners

- **Tagline:** *Find work like a human.*
- **Mission:** *To make the right student and the right role find each other — regardless of who already knows whom.*
- **Founder one-liner:** *I'm building the early-career job platform that I wish had existed when I was looking for my first role.*
- **For an investor pitch:** *Rookies fixes three structural failures of the existing early-career market — matching, SME accessibility, and strategic data — by designing them in as core, not as paid add-ons.*

---

*End of document.*
