# Rookies — Project Context

## What this is
Single-page web app + Supabase backend for a Dutch early-career job platform. Pre-pilot, founder-led. Main app and Career Officer Console are separate HTML files.

## Folder structure
- `app/rookies.html` + `app/css/rookies.css` + `app/js/rookies.js` — main platform
- `app/career-console.html` + `app/css/career-console.css` + `app/js/career-console.js` — career officer dashboard
- `app/supabase/functions/` — Edge Functions (Deno/TypeScript)
- `app/supabase/migrations/` — DB migrations

## Tech stack
- Frontend: vanilla JS, no framework
- Backend: Supabase (Postgres, Auth, Storage, Edge Functions)
- Project ref: ymkysqejyfsgyoauhjvp (EU-west-1)
- LLM API: Anthropic Claude (Sonnet 4.6 for scoring tasks)

## Code conventions
- Vanilla JS, ES2017+, no build step
- Inline event handlers (onclick) reference global functions in rookies.js
- CSS uses custom properties (--navy, --orange, --cream, etc.)
- Brand fonts: Playfair Display (headings), DM Sans (body)
- Modal pattern: .modal-overlay + .modal + body.modal-open lock

## Database tables
- students, employers, jobs, applications, messages, company_recruiters, llm_match_scores

## Current focus
Building LLM-based match scoring (Supabase Edge Function calling Claude API).
Edge Function name: score-match
DB table: llm_match_scores (4 dimensions: education_fit, experience_fit, project_relevance, trajectory_fit)

## Workflow
- I commit via git to https://github.com/dantoma1/Rookies-Bun
- Working branch: main
- Don't auto-commit without my OK

## Don't
- Don't break existing matching algorithm — augment it
- Don't introduce build tools or frameworks
- Don't change file structure without asking
- Don't auto-deploy Edge Functions; let me run `supabase functions deploy` myself