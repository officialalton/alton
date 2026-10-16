// 읽기 전용 QA 공통 — 공개(published) 문항 버전을 페이지로 읽는다. DB에 쓰지 않는다.
// 접속: 환경변수 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (키 값은 출력·저장하지 않는다).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

export type PublishedVersion = { problem_id: string; id: string; passage: string | null; question: string | null; options: string[] | null; exam_system: string | null };

export async function fetchPublishedVersions(): Promise<PublishedVersion[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const out: PublishedVersion[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("problem_versions")
      .select("id, problem_id, passage, question, options, problems!problem_versions_problem_id_fkey!inner(exam_system, archived_at)")
      .eq("status", "published")
      .is("problems.archived_at", null)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as unknown as (PublishedVersion & { problems: { exam_system: string | null } })[]) {
      out.push({ id: r.id, problem_id: r.problem_id, passage: r.passage, question: r.question, options: r.options, exam_system: r.problems?.exam_system ?? null });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function writeReport(name: string, body: unknown): string {
  const date = new Date().toISOString().slice(0, 10);
  const file = path.resolve(process.cwd(), "data/qa", `${name}-${date}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(body, null, 2));
  return file;
}
