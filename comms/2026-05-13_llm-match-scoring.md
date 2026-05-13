# LLM match scoring — what shipped 13 May

## TL;DR

We now have a **Claude-powered fit breakdown** that shows up inside the job-detail modal when a student clicks a job. Four dimensions, each 0–100 with a one-sentence rationale:

- **Education** — does their degree/major/level fit
- **Experience** — does their internship/work history fit
- **Projects** — do their projects/courses show readiness for *this* role
- **Trajectory** — does this role match the direction they say they want

The existing rule-based **▲ NN%** pill on each job card is **unchanged**. The new thing only appears once you open a specific job.

## Why this matters

The rule-based scorer is good at logistics (location, job type, school year, skills overlap). It's blind to the softer stuff that actually matters when a student is deciding whether to apply — *"is this role a real step on my path, or am I just ticking boxes?"*. That's what the four LLM dimensions answer, in their own words.

It also gives us **explainable matches**. Instead of "you're 67% — trust us," a student sees something like *"Thesis on greenwashing touches sustainability tangentially, but no ESG frameworks or impact reporting work."* That's the kind of thing that helps them either apply with confidence or steer toward better-fit roles.

## How it works (in plain terms)

- **Not pre-generated.** First time a student clicks a job, we make one Claude call (~5s). Result gets cached.
- **Cached for 14 days** in a new `llm_match_scores` table. After that, next view re-scores.
- **In-memory cache too** so reopening the same job in the same browser session is instant.
- The rule-based pill on the browse list is still pure JS — instant, no Claude call.

Cost shape at our scale: at the upper bound, 34 students × 11 jobs = 374 unique pairs. In practice maybe 50–100 calls in the first weeks. Each call is fractions of a cent on Sonnet 4.6. Effectively free.

## What's live

- New table `public.llm_match_scores` (RLS locked down — only the Edge Function reads/writes)
- New Edge Function `score-match` (deployed, JWT-protected)
- `ANTHROPIC_API_KEY` set in Supabase secrets
- Frontend wired up in `rookies.html` + `rookies.js` + `rookies.css`
- End-to-end tested with a real student/job pair — works as designed

## What's in the codebase

- `supabase/migrations/20260513120000_create_llm_match_scores.sql` — the table
- `supabase/functions/score-match/index.ts` — the Edge Function (Claude call + cache logic)
- `app/js/rookies.js` — `fetchLLMScore`, render helpers, and the lazy-load hook in `openJobDetailFromDB`
- `app/rookies.html` — the "✨ AI match insights" section in the job-detail modal
- `app/css/rookies.css` — `.ai-dim-row` styles

CLAUDE.md was also updated to point at `supabase/` at repo root (was previously `app/supabase/`, which never had files in it).

## Known gaps / things to watch

- **Profile or job edits don't invalidate the cache** until the 14-day TTL expires. If a student edits their CV today and views the same job tomorrow, they'll see yesterday's rationale. Acceptable for v1 — pilot users won't edit constantly. We can upgrade to "compare against updated_at" later if needed.
- **Employers don't see these scores.** Intentional for v1. If we ever want them to, we should add a "this is the candidate's view" disclaimer first so the contract with students stays clear.
- **No bulk pre-scoring.** Only the jobs a student actually clicks get scored. We could pre-score the top 5 matches at login if first-click latency becomes a complaint, but I'd wait for actual user feedback before doing that.
- **Claude returns prose ~rarely instead of JSON.** Defensive parser handles it; falls back to "AI insights unavailable" rather than crashing.

## How to test it yourself

1. Run the app locally (or wherever you usually do).
2. Log in as any student.
3. Click any job from the browse list.
4. The "✨ AI match insights" section appears below the searched-skills block, briefly shows "Generating AI insights…", then four rows of scores + rationales.
5. Close and reopen the same job → instant (cache hit).
6. Open as employer or logged-out → section is hidden.

If anything looks off, check the Supabase Edge Functions logs for `score-match`.
