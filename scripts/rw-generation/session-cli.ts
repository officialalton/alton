// 세션 모드 CLI(2026-10-01): API 호출 없음 — 작업 파일을 만들고, 에이전트 결과를 검증·집계한다.
//   npx tsx scripts/rw-generation/session-cli.ts <명령> --run <runId> [옵션]
//   prepare         --batch <batchId> [--plan data/rw-generation/plan-literary-40.json] [--chunk 20] [--excerpts file.jsonl] [--model opus]
//   ingest          [--task <taskId>]            결과 파일이 있는 생성·재작성 작업을 전부(또는 하나) 검증
//   review-prepare  [--chunk 20]                 통과분을 판정 작업 파일(3역할)로 내보냄
//   review-ingest                                 판정 결과 집계 + 채택 보고(reports/adoption-report.json, adopted-items.json)
//   rewrite-prepare [--chunk 15]                 '쉬움' 한정 1회 재작성 + 단어 수 재요청 작업 파일
//   status          [--dispatch]                 대기 작업·ingest 가능 작업 표시(--dispatch 면 에이전트용 프롬프트도 출력)
//   record          --step s --model m --items n [--usd x]   API 사용 비용 기록(세션 사용은 ingest 가 자동 기록)
//   cost                                          세션 사용/API 사용 요약
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildLiteraryPlan, type LiteraryPlan } from "./batch-plan";
import { prepare, ingest, reviewPrepare, reviewIngest, rewritePrepare, writeAdoptionReport, status, dispatchPrompt, recordCost, summarizeCost, dirs, type ModelHint } from "./session-mode";

const argv = process.argv.slice(2);
const cmd = argv[0];
const arg = (n: string) => { const i = argv.indexOf(n); return i > 0 ? argv[i + 1] : undefined; };
const runId = arg("--run");
if (!cmd || !runId) { console.error("사용법: session-cli.ts <prepare|ingest|review-prepare|review-ingest|rewrite-prepare|status|record|cost> --run <runId> ..."); process.exit(2); }
const root = path.resolve("data/rw-generation/runs", runId);

if (cmd === "prepare") {
  const planFile = arg("--plan");
  const plan: LiteraryPlan = planFile ? JSON.parse(readFileSync(planFile, "utf-8")) : buildLiteraryPlan();
  const batch = plan.batches.find((b) => b.batchId === arg("--batch"));
  if (!batch) { console.error("배치를 찾을 수 없습니다. 가능한 배치:", plan.batches.map((b) => b.batchId).join(", ")); process.exit(2); }
  const ex = arg("--excerpts");
  const excerpts = ex ? readFileSync(ex, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : undefined;
  const tasks = prepare({ root, runId, batch, chunkSize: Number(arg("--chunk") ?? 20), excerpts, suggestedModel: arg("--model") as ModelHint | undefined });
  console.log(`${batch.batchId}: 작업 파일 ${tasks.length}개 (후보 ${batch.candidates}건) -> ${dirs(root).tasks}`);
} else if (cmd === "ingest") {
  const st = status(root);
  const todo = st.ingestable.filter((t) => !arg("--task") || t.taskId === arg("--task"));
  for (const t of todo) {
    const r = ingest(root, t.taskId);
    const reasons = r.rejected.reduce<Record<string, number>>((m, x) => ((m[x.stage] = (m[x.stage] ?? 0) + 1), m), {});
    console.log(`${t.taskId}: 통과 ${r.passed.length} / 탈락 ${r.rejected.length} ${JSON.stringify(reasons)} / 단어 재요청 ${r.retryWords.length}${r.fileProblem ? ` / ${r.fileProblem}` : ""}`);
  }
  if (!todo.length) console.log("ingest 할 결과 파일이 없습니다.");
} else if (cmd === "review-prepare") {
  const tasks = reviewPrepare({ root, runId, chunkSize: Number(arg("--chunk") ?? 20) });
  console.log(`판정 작업 파일 ${tasks.length}개(청크 ${tasks.length / 3} x 3역할)`);
} else if (cmd === "review-ingest") {
  const { summary } = reviewIngest(root);
  const { report } = writeAdoptionReport(root, runId);
  console.log(JSON.stringify(summary), "\n채택", report.adopted, JSON.stringify(report.adoptedByDifficulty), "\n탈락 사유", JSON.stringify(report.rejectedByReason));
} else if (cmd === "rewrite-prepare") {
  const tasks = rewritePrepare({ root, runId, chunkSize: Number(arg("--chunk") ?? 15) });
  console.log(`재작성 작업 파일 ${tasks.length}개`);
} else if (cmd === "status") {
  const s = status(root);
  console.log(`전체 ${s.total} · 에이전트 대기 ${s.dispatch.length} · ingest 가능 ${s.ingestable.length} · 판정 결과 도착 ${s.reviewResultsReady}/${s.reviewTasks}`);
  for (const t of s.dispatch) { console.log(`- [${t.suggestedModel}] ${t.taskId} (${t.items}건)`); if (argv.includes("--dispatch")) console.log(`  ${dispatchPrompt(t)}`); }
} else if (cmd === "record") {
  recordCost(root, { step: arg("--step") ?? "unknown", model: arg("--model") ?? "unknown", mode: "api", items: Number(arg("--items") ?? 0), tasks: 1, usd: Number(arg("--usd") ?? 0) });
  console.log(JSON.stringify(summarizeCost(root)));
} else if (cmd === "cost") {
  console.log(JSON.stringify(summarizeCost(root), null, 1));
} else { console.error(`알 수 없는 명령: ${cmd}`); process.exit(2); }
