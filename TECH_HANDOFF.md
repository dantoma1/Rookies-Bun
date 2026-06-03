# Rookies — Technical Handoff

A walkthrough of what's been shipped on the frontend recently and what still needs
to be wired up on the backend to make it all actually work end-to-end.

> Last updated: 2026-06-03

---

## Repo orientation

```
app/
  rookies.html               main marketing + platform landing (job board, profile, messaging)
  rookies.css, rookies.js
  career-console.html        career-officer dashboard
  privacy.html               public privacy policy
  cycles/
    cycles.html              Cycles product landing
    css/cycles.css
    js/cycles.js
supabase/
  functions/                 Edge Functions (Deno/TS)
  migrations/                DB migrations
decks/, strategy/            non-code material
```

Stack: vanilla JS (no framework, no build step), Supabase (Postgres + Auth + Storage
+ Edge Functions), Anthropic Claude for LLM scoring. Project ref:
`ymkysqejyfsgyoauhjvp` (EU-West-1).

---

## What got shipped to the frontend recently

### Cycles page (`app/cycles/`)

- **Role toggle (Rookie / Company)** with two complete content variants. Toggle
  state lives in the DOM only; the JS function is `setCycleRole(role)` in
  `cycles.js`.
- **Animated hero diagram** (chaos → 5 clean matches). Pure CSS + SVG, no library.
- **Three-phase "how a cycle works"** — Register → Pool locks · Algorithm →
  Matches. Both views.
- **"How often?" calendar** — demand-led messaging, no dates.
- **"University partnerships" screen** — minimalist "we've quietly built
  something" page with a `mailto:hello@rookies.nl` CTA. Triggered by the
  University partnerships button in both closing CTA rows.
- **Waitlist gate on the Live cycle screen only.** Blurred backdrop, single
  "Join the waitlist →" button. Behaviour:
  - Not signed in → opens the existing auth modal (login).
  - Signed in → `upsert` into `public.waitlist` with `(user_id, role, name, cycle)`,
    onConflict `user_id,cycle`. Shows success inline.
  - Not dismissible.
- **Closing CTAs unified** across both views: I'm a student / I'm an employer /
  University partnerships.
- **Removed:** old "Demo" nav button + the entire `screen-preferences` demo page
  (was duplicative with the reveal).
- **Removed:** old "Three sides, one floor" section in both views (was
  duplicative with the role toggle copy).

### Main page (`app/rookies.html`)

- Hero scroll animation kept untouched.
- Middle role toggle (Student/Company "how it works") **removed**, replaced with:
  - **Community intro** — "More than a platform. A Rookies community." with
    the anti-buzzword paragraph.
  - **Featured Cycles card** — big navy hero card with two buttons linking to
    `cycles/cycles.html`.
  - **"What's next"** section with three dashed-border stub cards: **Rookieton**
    (career hackathon — host wins candidate), **Some cool thing** (placeholder),
    and **Tell us what you'd want** (CTA pointing at the contact form below).
- "Platform every student deserved" closing CTA kept.
- Contact form section kept and unchanged.

### Company console (in `rookies.html`)

- **"Browse Rookies" tab hidden** via `style="display:none"`. The panel and its
  load logic still exist in the file/JS — just not navigable from the UI.
- **"Applicants" → "Cycle matches"** as a label-only rename:
  - Tab button text
  - Panel header `h2` + sub
  - Welcome subhead
  - "Recent applicants" → "Recent cycle matches"
  - **Internal id `ctab-applicants` and panel id `applicants` still exist
    unchanged** — JS routes haven't moved. If we want a real "cycle matches"
    panel it needs new data (see below).

### Privacy policy (`app/privacy.html`)

- All date / entity / domain placeholders filled.
- New coverage for: file uploads (CV, avatar, message attachments), waitlist,
  contact-form submissions, retention schedule for all of the above.
- **Section 5 deliberately scrubbed** of model name, algorithm details, and
  the "Rookie Algorithm" name. Anthropic still listed as a processor, generically.
- Back-link and Home footer link fixed to relative `rookies.html` (was `/`,
  which broke when opened via `file://`).

---

## What's already wired to Supabase

| Feature                       | Table / storage                        | Notes |
|-------------------------------|----------------------------------------|-------|
| Auth (student & company)      | `auth.users` → `students` / `employers`| Working. Cycles signup uses the same flow via the `auth-modal`. |
| Job listings                  | `jobs`                                  | Working. |
| Applications                  | `applications`                          | Working. Status enum: New / In review / Shortlisted / Accepted / Rejected. |
| Messages + attachments        | `messages` + `storage.message-attachments` | Working. |
| Contact form                  | `contact_messages`                      | Working. Rate-limited by `check_contact_rate_limit()`. |
| Avatars                       | `storage.avatars`                       | Working. |
| LLM scoring cache             | `llm_match_scores`                      | Written by the `score-match` edge function under service role. Client RLS denies all access. |
| **Cycles waitlist (NEW)**     | `waitlist`                              | UI wired (`joinWaitlist()` in `cycles.js`). **No notification path yet.** |

### `waitlist` table (created 2026-06-03 via MCP migration)

```sql
public.waitlist (
  id          uuid pk default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('student', 'company')),
  name        text,
  cycle       text not null default 'cycle-01',
  created_at  timestamptz not null default now(),
  unique (user_id, cycle)
);
-- RLS enabled. Authenticated users can insert/select/update their own row only.
```

---

## What still needs to be built

### 1. Cycle 01 backend — the big one

The Cycles page currently describes a recurring matching market. The actual
matching does not exist yet. To run Cycle 01 we need at minimum:

**Schema additions:**

- `cycles` — `id`, `name` (e.g. "Cycle 01 · Spring 2026"), `status` enum
  (`scheduled` / `open` / `locked` / `clearing` / `revealed` / `closed`),
  `opens_at`, `locks_at`, `reveal_at`, `created_at`.
- `cycle_participants` — `cycle_id`, `user_id`, `role`, `joined_at`. Distinct
  from `waitlist`: waitlist = "notify me when it opens", participants = "I'm
  in the pool".
- `cycle_roles` — for companies: which `jobs.id` entries are entered into this
  cycle. Avoids dragging the always-on job board into matching.
- `cycle_matches` — output of the algorithm: `cycle_id`, `student_id`, `job_id`,
  `rank` (1–5), `fit_score`, `rationale`, `is_mutual_top`.

**The Rookie Algorithm (matching):**

- Implement as an edge function (`run-cycle`?) that takes a `cycle_id`, reads
  the pool, ranks pair-wise fit (can reuse `llm_match_scores` plus structured
  signals), and writes `cycle_matches`.
- Approach to discuss: deferred acceptance (Gale–Shapley) for stable matches,
  optionally enriched with cached fit scores from `llm_match_scores`.
- Triggered when an admin flips `cycles.status` from `locked` → `clearing`.

**Reveal day automation:**

- Scheduled job (Supabase cron or external scheduler) that flips status at
  `reveal_at` and triggers notifications.

### 2. Waitlist → notification flow

Right now joining the waitlist writes a row and shows a success message. There
is **no email triggered**. Needed:

- Edge function `notify-waitlist(cycle_id)` that joins `waitlist` to
  `students`/`employers` for emails and sends "Cycle 01 is open" with a CTA
  link. Either delete waitlist rows after notifying or mark them
  `notified_at`.

### 3. Email delivery

The privacy policy currently states transactional email goes through Supabase's
built-in mailer. Fine for auth confirmations and password resets, not great for
notification volume (waitlist, reveal day, weekly digests). Recommend:

- Add **Resend** or **Postmark** as a transactional provider.
- Add a `DKIM`/`SPF`/`DMARC` setup on `rookies.nl` before sending.
- Update **privacy policy Section 4** processor list before activating it.

### 4. Edge function `score-match` — production readiness

`llm_match_scores` is populated by `score-match`. Things to confirm:

- `ANTHROPIC_API_KEY` is set as a Supabase secret in prod.
- Function deployed (`supabase functions deploy score-match` — Dan runs this
  manually per `CLAUDE.md`).
- **Anthropic prompt caching** is enabled on the system prompt — materially
  lowers cost. Worth checking `cache_creation_input_tokens` /
  `cache_read_input_tokens` in API responses.
- Rate limiting + cost guardrails (per-student / per-day cap).

### 5. University cohort analytics dashboard

The cycles page has a **University partnerships** screen promising live cohort
outcomes ("imagine knowing where your cohort actually lands"). For that to
exist, we need:

- A new role type (currently only `students` and `employers`); add `universities`
  table.
- A scoped read-only dashboard showing **aggregate** cohort outcomes for that
  university only. Individual student PII should require student consent.
- Update **privacy policy Section 2** with a "If you sign up as a university
  partner" subsection before this ships.

### 6. Cycle matches in company console

The "Applicants" tab was renamed to "Cycle matches" but the data is still
`applications` (open job board submissions). To make this honest we have
two options:

- Build a real Cycle-matches view that joins `cycle_matches` for the employer's
  roles in the active cycle, and either rename "Applicants" back to
  "Applications" (keeping the open board), or hide the old applicants panel.
- Or — until Cycle 01 actually runs — accept the inconsistency. Users won't
  see this until they're logged in as a verified employer, which is a small
  group right now.

### 7. Rookies B.V. registration

The privacy policy lists "registration pending". Once the KvK number lands:

- Update `app/privacy.html` Section 1 (legal entity name + registered address).
- Update `app/privacy.html` Section 13 (postal address).
- Sign DPAs with Supabase, Anthropic, Cloudflare under the legal entity.

### 8. Domain / email plumbing

- Confirm `rookies.nl` ownership.
- Set up the actual mailboxes referenced in the site:
  - `hello@rookies.nl` (used by the University partnerships mailto)
  - `privacy@rookies.nl` (used throughout the privacy policy)
- Add SPF/DKIM/DMARC before sending volume mail.

---

## Things to leave alone unless we deliberately change them

- **`.claude/` directories** (`app/cycles/.claude/`) — Claude Code local tool
  config. Kept un-committed on purpose. If you want shared agent configs,
  promote it explicitly.
- **`~$*.pptx`** and **`~$*.docx`** files — these are PowerPoint/Word lock
  files. They are temp files from open documents. Never commit them.
- **No build step.** No bundler, no framework. If you want to introduce one,
  let's discuss the trade-off first.

---

## Architecture decisions worth confirming

- **Anthropic model:** currently `claude-sonnet-4-6` per `CLAUDE.md`. Privacy
  policy was scrubbed of the model name and algorithm details at Dan's
  request — keep that scrubbed in any user-facing material.
- **Region:** Supabase project is in EU-West-1 (Dublin). Privacy policy
  reflects that. Don't move it without redoing DPAs.
- **No auto-deploy edge functions:** Dan runs `supabase functions deploy`
  manually.
- **No auto-commit:** Dan does git operations manually.
- **Don't break the existing matching algorithm.** Per `CLAUDE.md`, augment,
  don't replace.

---

## Open questions for us to align on

1. When does Cycle 01 actually run, vs. when does the waitlist start collecting?
2. Do we ship a Cycles backend with **manual triggers** first (admin clicks a
   button to flip status) or build the scheduler from day one?
3. Email provider — stay on Supabase or move to Resend/Postmark now?
4. Long-term: do we keep the always-on job board (browse, apply, message)
   once Cycles is live, or sunset it in favour of cycles only?
5. University role — is this a near-term Q3 thing or a "phase 2" thing? The
   privacy policy mentions it; the page promises it.
