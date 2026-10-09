// 신규 채택분을 기존 덤프에 '확정·게시 문항'으로 합성 주입한 투영 덤프 생성(2026-10-08). DB 접근 없음 — 원격 임포트·새 덤프 전의 사전 계획용.
// 실행: npx tsx scripts/mock-exam-generation/rw-rebalance-project.ts --dump tmp/bank-dump/dump.json --topics .../topics.json --in a.json,b.json --classified-new .../classified-new.json --out DIR
//   -> DIR/dump.json, DIR/topics.json (rebalance-sets.ts --dump/--topics 에 그대로 사용). 합성 id 는 `proj:<gid>`.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { passageHash } from "./rw-topics-lib";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
type Rec = { gid: string; skill: string; domain: string; difficulty: string; problem: { stimulus?: string | null; passage?: string | null; explanationEn?: string | null } };
const dump = JSON.parse(readFileSync(arg("--dump")!, "utf-8")); const topics = JSON.parse(readFileSync(arg("--topics")!, "utf-8"));
const cls = JSON.parse(readFileSync(arg("--classified-new")!, "utf-8")) as Record<string, { subject: string; cluster: string; family: string }>;
const recs = (arg("--in") ?? "").split(",").filter(Boolean).flatMap((f) => JSON.parse(readFileSync(f, "utf-8")) as Rec[]);
let n = 0;
for (const r of recs) {
  const h = passageHash(r.problem.stimulus ?? r.problem.passage ?? ""); const c = cls[h]; if (!c) continue;
  const id = `proj:${r.gid}`; n++;
  dump.problems.push({ id, sat_domain: r.domain, skill_code: r.skill, subpattern: null, format: "mc", status: "confirmed", usage_scope: "mock_exam", similarity_group: `proj:${r.gid}`, archived_at: null, difficulty: r.difficulty, created_at: "2026-10-08T12:00:00+00:00" });
  dump.versions.push({ id: `projv:${r.gid}`, problem_id: id, status: "published", difficulty: r.difficulty, figure_checked: false, explanation_en: r.problem.explanationEn ?? null, answers: null });
  topics[id] = { ...c, passageHash: h };
}
const out = arg("--out")!; mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "dump.json"), JSON.stringify(dump)); writeFileSync(path.join(out, "topics.json"), JSON.stringify(topics));
console.log(JSON.stringify({ injected: n, of: recs.length }));
