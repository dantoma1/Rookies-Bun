-- Cached Claude-generated 4-dimension fit scores for student/job pairs.
-- Direct client access denied by RLS (no policies attached).
-- Reads and writes happen only through the score-match Edge Function,
-- which uses the service role key and therefore bypasses RLS.

create table public.llm_match_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  job_id     uuid not null references public.jobs(id)     on delete cascade,

  education_fit      smallint not null check (education_fit      between 0 and 100),
  experience_fit     smallint not null check (experience_fit     between 0 and 100),
  project_relevance  smallint not null check (project_relevance  between 0 and 100),
  trajectory_fit     smallint not null check (trajectory_fit     between 0 and 100),

  education_rationale   text not null,
  experience_rationale  text not null,
  project_rationale     text not null,
  trajectory_rationale  text not null,

  model       text        not null,
  created_at  timestamptz not null default now(),

  unique (student_id, job_id)
);

alter table public.llm_match_scores enable row level security;

comment on table public.llm_match_scores is
  'Cached Claude 4-dimension fit scores per (student, job). Client access denied by RLS; only the score-match Edge Function (service role) reads/writes.';
