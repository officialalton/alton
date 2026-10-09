// 임포트된(또는 임포트 예정) 모의고사 R&W 문항을 "실제 스킬" 키워드에 연결(2026-10-01). 기본 dry-run, --execute 때만 쓴다.
//   npx tsx scripts/keywords/link-imported.ts --file data/rw-generation/adopted/lit40-wave1-adopted-checkpoint-4.json --offline   # 파일만으로 스킬별 건수
//   npx tsx scripts/keywords/link-imported.ts --file <adopted.json>             # DB 에서 gid 로 찾아 연결 계획(읽기만)
//   npx tsx scripts/keywords/link-imported.ts --file <adopted.json> --execute   # problem_keywords 삽입(on conflict do nothing)
// gid 는 problem_versions.quality->mockExamGeneration->>gid 로 찾는다. 문제 상태(draft/confirmed)와 무관하게 연결한다
// (corrective 20261230010000 이후 트리거는 과목 일치만 검사; 선생님 노출은 problem_keywords_selectable 뷰가 confirmed 로 거른다).
// 키워드 설정(scripts/keywords/sat-keyword-setup.ts --execute)이 먼저 끝나 있어야 한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { connect, selectAll } from "./db";
import { resolveIntendedSkill } from "./intended-skill";
import { chunk } from "../../lib/sat-keywords/plan";
import { SAT_KEYWORD_BY_SKILL, SAT_SUBJECT_NAME } from "../../lib/sat-keywords/taxonomy";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const execute = process.argv.includes("--execute");
const offline = process.argv.includes("--offline");

type Rec = { gid: string; skill: string; planSkill?: string; examSystem: string; quality: Record<string, unknown> };
const tally = (xs: string[]) => xs.reduce<Record<string, number>>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});

async function main() {
  const file = arg("--file");
  if (!file) throw new Error("--file 필요");
  const recs = JSON.parse(readFileSync(path.resolve(file), "utf-8")) as Rec[];
  const intended = new Map(recs.map((r) => [r.gid, resolveIntendedSkill({ quality: r.quality, skillCode: r.skill, planSkillFromFile: r.planSkill })]));
  console.log(`파일 ${recs.length}건 — 실제 스킬별:`, tally([...intended.values()].map((v) => v.skill ?? "(복원 실패)")));
  console.log("저장 skill_code 별:", tally(recs.map((r) => r.skill)));
  if (offline) return;

  const conn = await connect();
  if (!conn) throw new Error("SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다(파일만 보려면 --offline).");
  const { db, target } = conn;
  console.log(`대상: ${target} / ${execute ? "EXECUTE" : "dry-run"}`);

  const { data: subs, error: sErr } = await db.from("subjects").select("id, name").in("name", Object.values(SAT_SUBJECT_NAME)).is("archived_at", null);
  if (sErr) throw new Error(sErr.message);
  const { data: kws, error: kErr } = await db.from("subject_keywords").select("id, subject_id, skill_code").in("subject_id", (subs ?? []).map((s) => s.id)).not("skill_code", "is", null);
  if (kErr) throw new Error(kErr.message);
  const kwId = new Map((kws ?? []).map((k) => [`${k.subject_id}/${k.skill_code}`, k.id as string]));
  if (!kwId.size) throw new Error("스킬 키워드가 없습니다 — sat-keyword-setup.ts --execute 를 먼저 실행하세요.");

  type V = { problem_id: string; quality: Record<string, unknown> | null; problems: { subject_id: string; skill_code: string | null; status: string; archived_at: string | null } };
  const found: V[] = [];
  for (const gids of chunk(recs.map((r) => r.gid), 100)) {
    found.push(...await selectAll<V>((a, b) => db.from("problem_versions").select("problem_id, quality, problems!problem_versions_problem_id_fkey!inner(subject_id, skill_code, status, archived_at)").in("quality->mockExamGeneration->>gid", gids).range(a, b) as unknown as PromiseLike<{ data: V[] | null; error: { message: string } | null }>));
  }
  // 한 문제에 버전이 여러 개일 수 있다 — problem_id 로 묶는다.
  const byProblem = new Map<string, V>();
  for (const v of found) if (!v.problems.archived_at) byProblem.set(v.problem_id, v);

  const existing = new Set<string>();
  for (const ids of chunk([...byProblem.keys()], 100)) {
    const rows = await selectAll<{ problem_id: string; keyword_id: string }>((a, b) => db.from("problem_keywords").select("problem_id, keyword_id").in("problem_id", ids).range(a, b));
    rows.forEach((r) => existing.add(`${r.problem_id}:${r.keyword_id}`));
  }

  const inserts: { problem_id: string; keyword_id: string }[] = [];
  const bySkill: string[] = [];
  const byStatus: string[] = [];
  const failed: string[] = [];
  let already = 0;
  const matchedGids = new Set<string>();
  for (const v of byProblem.values()) {
    const gid = ((v.quality?.mockExamGeneration ?? {}) as Record<string, unknown>).gid as string;
    matchedGids.add(gid);
    const res = intended.get(gid) ?? resolveIntendedSkill({ quality: v.quality, skillCode: v.problems.skill_code });
    const def = res.skill ? SAT_KEYWORD_BY_SKILL.get(res.skill) : undefined;
    const k = def ? kwId.get(`${v.problems.subject_id}/${def.skillCode}`) : undefined;
    if (!k) { failed.push(`${gid}(${v.problem_id}): 스킬 ${res.skill ?? "?"} 키워드 없음/과목 불일치`); continue; }
    bySkill.push(def!.skillCode); byStatus.push(v.problems.status);
    if (existing.has(`${v.problem_id}:${k}`)) { already += 1; continue; }
    inserts.push({ problem_id: v.problem_id, keyword_id: k });
  }
  console.log(`DB 매칭 ${byProblem.size}건(미임포트 ${recs.filter((r) => !matchedGids.has(r.gid)).length}) · 연결 추가 ${inserts.length} · 이미 연결 ${already} · 실패 ${failed.length}`);
  console.log("연결 스킬별:", tally(bySkill), "문제 상태별:", tally(byStatus));
  if (failed.length) console.log(failed.slice(0, 30).join("\n"));
  if (!execute) return;
  for (const rows of chunk(inserts, 200)) {
    const { error } = await db.from("problem_keywords").upsert(rows, { onConflict: "problem_id,keyword_id", ignoreDuplicates: true });
    if (error) throw new Error(`연결 삽입 실패: ${error.message}`);
  }
  console.log(`삽입 완료 ${inserts.length}건`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
