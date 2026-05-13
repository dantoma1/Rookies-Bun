// score-match: scores a (student, job) pair on four fit dimensions using Claude.
// Cached for CACHE_TTL_DAYS in public.llm_match_scores. Bypasses RLS via service role.

import Anthropic from "npm:@anthropic-ai/sdk@^0.40.0";
import { createClient } from "npm:@supabase/supabase-js@^2.45.0";

const CACHE_TTL_DAYS = 14;
const MODEL = "claude-sonnet-4-6";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are an expert career advisor evaluating fit between an early-career candidate and a job posting.

Score four dimensions on a 0-100 integer scale, each with a single concise rationale sentence (max 25 words):

- education_fit: how well the candidate's degree, major, and academic level fit the role's requirements
- experience_fit: how well prior internships, jobs, and work experience map to the role's responsibilities
- project_relevance: how well personal/academic projects, courses, and applied skills demonstrate readiness for this specific role
- trajectory_fit: whether this role logically fits the candidate's stated interests, goals, and career direction

Score conservatively. 70+ means strong, demonstrable fit. 40-69 is partial. Below 40 is weak.
If a candidate field is empty or null, factor that absence in honestly rather than guessing.

Return ONLY a JSON object with exactly these eight keys, no prose, no markdown fences:
{
  "education_fit": <int 0-100>,
  "education_rationale": "<sentence>",
  "experience_fit": <int 0-100>,
  "experience_rationale": "<sentence>",
  "project_relevance": <int 0-100>,
  "project_rationale": "<sentence>",
  "trajectory_fit": <int 0-100>,
  "trajectory_rationale": "<sentence>"
}`;

function buildUserMessage(student: Record<string, unknown>, job: Record<string, unknown>): string {
  const studentCtx = {
    field_of_study: student.field_of_study,
    degree: student.degree,
    university: student.university,
    current_status: student.current_status,
    current_status_year: student.current_status_year,
    gpa: student.gpa,
    education: student.education,
    experience: student.experience,
    projects: student.skills_projects,
    courses: student.skills_courses,
    organisations: student.organisations,
    skills_technical: student.skills_technical,
    skills_professional: student.skills_professional,
    skills_languages: student.skills_languages,
    role_interests: student.role_interests,
    seeking_status: student.seeking_status,
    bio: student.bio,
  };
  const jobCtx = {
    title: job.title,
    company: job.company_name,
    job_type: job.job_type,
    employment_type: job.employment_type,
    field: job.field,
    location: job.location,
    duration: job.duration,
    school_year: job.school_year,
    majors: job.majors,
    role_group: job.role_group,
    description: job.description,
    qualifications: job.qualifications,
    searched_skills: job.searched_skills,
  };
  return `CANDIDATE PROFILE:\n${JSON.stringify(studentCtx, null, 2)}\n\nJOB POSTING:\n${JSON.stringify(jobCtx, null, 2)}\n\nReturn the JSON object only.`;
}

type ScoreShape = {
  education_fit: number; education_rationale: string;
  experience_fit: number; experience_rationale: string;
  project_relevance: number; project_rationale: string;
  trajectory_fit: number; trajectory_rationale: string;
};

function isScoreShape(o: unknown): o is ScoreShape {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  const intKeys = ["education_fit", "experience_fit", "project_relevance", "trajectory_fit"] as const;
  for (const k of intKeys) {
    const v = r[k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100) return false;
  }
  const strKeys = ["education_rationale", "experience_rationale", "project_rationale", "trajectory_rationale"] as const;
  for (const k of strKeys) {
    const v = r[k];
    if (typeof v !== "string" || !v.trim()) return false;
  }
  return true;
}

function extractJSON(text: string): unknown {
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) { /* fall through */ } }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  let body: { student_id?: string; job_id?: string };
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const student_id = body.student_id;
  const job_id = body.job_id;
  if (!student_id || !job_id) {
    return jsonResponse({ error: "student_id_and_job_id_required" }, 400);
  }

  const supabaseUrl  = Deno.env.get("SUPABASE_URL");
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!supabaseUrl || !serviceKey || !anthropicKey) {
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: cached } = await db
    .from("llm_match_scores")
    .select("*")
    .eq("student_id", student_id)
    .eq("job_id", job_id)
    .gte("created_at", cutoff)
    .maybeSingle();

  if (cached) {
    return jsonResponse({
      education_fit: cached.education_fit,
      education_rationale: cached.education_rationale,
      experience_fit: cached.experience_fit,
      experience_rationale: cached.experience_rationale,
      project_relevance: cached.project_relevance,
      project_rationale: cached.project_rationale,
      trajectory_fit: cached.trajectory_fit,
      trajectory_rationale: cached.trajectory_rationale,
      cached: true,
      model: cached.model,
    });
  }

  const [studentRes, jobRes] = await Promise.all([
    db.from("students").select("*").eq("id", student_id).maybeSingle(),
    db.from("jobs").select("*").eq("id", job_id).maybeSingle(),
  ]);
  if (studentRes.error || jobRes.error) {
    console.error("fetch context", studentRes.error, jobRes.error);
    return jsonResponse({ error: "db_error" }, 500);
  }
  if (!studentRes.data) return jsonResponse({ error: "student_not_found" }, 404);
  if (!jobRes.data)     return jsonResponse({ error: "job_not_found" }, 404);

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  let raw = "";
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 600,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(studentRes.data, jobRes.data) }],
    });
    const first = msg.content?.[0];
    raw = first && first.type === "text" ? first.text : "";
  } catch (e) {
    console.error("anthropic error", e);
    return jsonResponse({ error: "llm_failed" }, 502);
  }

  const parsed = extractJSON(raw);
  if (!isScoreShape(parsed)) {
    console.error("invalid llm response", raw.slice(0, 500));
    return jsonResponse({ error: "llm_invalid_response" }, 502);
  }

  const row = {
    student_id,
    job_id,
    education_fit:      parsed.education_fit,
    experience_fit:     parsed.experience_fit,
    project_relevance:  parsed.project_relevance,
    trajectory_fit:     parsed.trajectory_fit,
    education_rationale:  parsed.education_rationale,
    experience_rationale: parsed.experience_rationale,
    project_rationale:    parsed.project_rationale,
    trajectory_rationale: parsed.trajectory_rationale,
    model: MODEL,
    created_at: new Date().toISOString(),
  };
  const { error: upErr } = await db
    .from("llm_match_scores")
    .upsert(row, { onConflict: "student_id,job_id" });
  if (upErr) {
    console.error("upsert (non-fatal)", upErr);
  }

  return jsonResponse({
    education_fit: parsed.education_fit,
    education_rationale: parsed.education_rationale,
    experience_fit: parsed.experience_fit,
    experience_rationale: parsed.experience_rationale,
    project_relevance: parsed.project_relevance,
    project_rationale: parsed.project_rationale,
    trajectory_fit: parsed.trajectory_fit,
    trajectory_rationale: parsed.trajectory_rationale,
    cached: false,
    model: MODEL,
  });
});
