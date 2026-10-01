// 2026-10-02 UAT C2 — 지문(passage)과 질문(question)이 같거나 한쪽이 다른 쪽을 포함하는 공개 문항을 센다.
// 읽기 전용(DB에 쓰지 않음). 결과는 data/qa/duplicate-stem-<날짜>.json 에 ID 목록으로 저장.
// 실행: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/qa/find-duplicate-stem.ts
import { dedupeStem, normalizeStem } from "../../lib/problem-text-guards";
import { fetchPublishedVersions, writeReport } from "./published-versions";

async function main() {
  const rows = await fetchPublishedVersions();
  const equal: string[] = [];
  const passageContainsQuestion: string[] = [];
  const questionContainsPassage: string[] = [];
  let hiddenByRenderer = 0;
  for (const r of rows) {
    const p = normalizeStem(r.passage);
    const q = normalizeStem(r.question);
    if (!p || !q) continue;
    if (p === q) equal.push(r.problem_id);
    else if (p.includes(q)) passageContainsQuestion.push(r.problem_id);
    else if (q.includes(p)) questionContainsPassage.push(r.problem_id);
    else continue;
    if (dedupeStem(r.passage, r.question) !== (r.passage ?? "")) hiddenByRenderer += 1;
  }
  const report = { scanned: rows.length, counts: { equal: equal.length, passageContainsQuestion: passageContainsQuestion.length, questionContainsPassage: questionContainsPassage.length, fixedByRendererDedupe: hiddenByRenderer }, equal, passageContainsQuestion, questionContainsPassage };
  const file = writeReport("duplicate-stem", report);
  console.log(JSON.stringify(report.counts), "→", file);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
