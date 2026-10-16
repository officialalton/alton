// 키워드가 하나도 없는 SAT 문항(모의고사·일반 모두)을 "실제 스킬" 키워드에 연결(2026-10-09, 오너 승인). 기본 dry-run, --execute 때만 쓴다.
//   npx tsx scripts/keywords/link-unlinked.ts [--execute] [--limit N]
// 이미 키워드가 하나라도 붙은 문제는 건드리지 않는다. 스킬은 resolveIntendedSkill(저장된 intendedSkill → questionType → problems.skill_code).
// problem_keywords 삽입은 on conflict do nothing. 삭제·변경 없음.
import { connect, selectAll } from "./db";
import { resolveIntendedSkill } from "./intended-skill";
import { chunk } from "../../lib/sat-keywords/plan";
import { SAT_KEYWORD_BY_SKILL, SAT_SUBJECT_NAME } from "../../lib/sat-keywords/taxonomy";

const execute = process.argv.includes("--execute");
const li = process.argv.indexOf("--limit");
const limit = li > 0 ? Number(process.argv[li + 1]) : Infinity;
const tally = (xs: string[]) => xs.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});

async function main() {
  const conn = await connect();
  if (!conn) throw new Error("SUPABASE_URL·키 환경변수가 필요합니다.");
  const { db, target } = conn;
  console.log(`대상: ${target} / ${execute ? "EXECUTE" : "dry-run"}`);
  const { data: subs } = await db.from("subjects").select("id, name").in("name", Object.values(SAT_SUBJECT_NAME)).is("archived_at", null);
  const subjectIds = (subs ?? []).map((s) => s.id as string);
  const { data: kws } = await db.from("subject_keywords").select("id, subject_id, skill_code").in("subject_id", subjectIds).not("skill_code", "is", null);
  const kwId = new Map((kws ?? []).map((k) => [`${k.subject_id}/${k.skill_code}`, k.id as string]));
  if (!kwId.size) throw new Error("스킬 키워드가 없습니다.");

  type P = { id: string; subject_id: string; skill_code: string | null; status: string };
  const problems = await selectAll<P>((a, b) => db.from("problems").select("id, subject_id, skill_code, status").in("subject_id", subjectIds).is("archived_at", null).order("id").range(a, b));
  const linked = new Set<string>();
  for (const ids of chunk(problems.map((p) => p.id), 100)) {
    const rows = await selectAll<{ problem_id: string }>((a, b) => db.from("problem_keywords").select("problem_id").in("problem_id", ids).range(a, b));
    rows.forEach((r) => linked.add(r.problem_id));
  }
  const todo = problems.filter((p) => !linked.has(p.id)).slice(0, limit);
  console.log(`SAT 문제 ${problems.length}건 · 키워드 있음 ${linked.size} · 없음 ${problems.length - linked.size} · 이번 대상 ${todo.length}`);

  const quality = new Map<string, Record<string, unknown> | null>();
  for (const ids of chunk(todo.map((p) => p.id), 100)) {
    const rows = await selectAll<{ problem_id: string; quality: Record<string, unknown> | null; version_no: number }>((a, b) => db.from("problem_versions").select("problem_id, quality, version_no").in("problem_id", ids).order("version_no", { ascending: false }).range(a, b));
    for (const r of rows) if (!quality.has(r.problem_id)) quality.set(r.problem_id, r.quality);
  }
  const inserts: { problem_id: string; keyword_id: string }[] = [];
  const bySkill: string[] = []; const failed: string[] = [];
  for (const p of todo) {
    const res = resolveIntendedSkill({ quality: quality.get(p.id) ?? null, skillCode: p.skill_code });
    const def = res.skill ? SAT_KEYWORD_BY_SKILL.get(res.skill) : undefined;
    const k = def ? kwId.get(`${p.subject_id}/${def.skillCode}`) : undefined;
    if (!k) { failed.push(`${p.id}: 스킬 ${res.skill ?? "?"} 키워드 없음/과목 불일치`); continue; }
    bySkill.push(def!.skillCode); inserts.push({ problem_id: p.id, keyword_id: k });
  }
  console.log(`연결 추가 ${inserts.length} · 실패 ${failed.length}`, tally(bySkill));
  if (failed.length) console.log(failed.slice(0, 20).join("\n"));
  if (!execute) return;
  for (const rows of chunk(inserts, 200)) {
    const { error } = await db.from("problem_keywords").upsert(rows, { onConflict: "problem_id,keyword_id", ignoreDuplicates: true });
    if (error) throw new Error(`연결 삽입 실패: ${error.message}`);
  }
  console.log(`삽입 완료 ${inserts.length}건`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
