// AP European History 자체 샘플 기반 채점 기능 검증 러너 (docs/ap/europeanhistory-essay-selfcheck-2026-10-21.md).
// 공식 채점 일치율 측정이 아니다. ALTON 자작 문항·응답만 사용한다. DB 접근 없음. 기준 점수·설계 의도는 모델 호출에 넣지 않는다.
// 사용: SELFCHECK_SET=dev|holdout|repeat ANTHROPIC_API_KEY=... AI_ESSAY_GRADING_ENABLED=true SELFCHECK_CAP=5 npx tsx scripts/euro-selfcheck.ts
// FAKE=1 이면 가짜 클라이언트로 하네스만 점검(비용 0).
import { readFileSync, appendFileSync, existsSync, writeFileSync } from "node:fs";
import { createAnthropicGraderClient, type GraderClient } from "@/lib/essay-grading/client";
import { buildPrompt, checkEssayLength } from "@/lib/essay-grading/prompt";
import { resolveRubric, EURO_RUBRIC_ID } from "@/lib/essay-grading/rubric";
import { validateGraderOutput, combineRuns, totalOf, type GraderOutput } from "@/lib/essay-grading/schema";
import { costUsd, limits } from "@/lib/essay-grading/costs";

const DIR = "data/ap/euro-selfcheck";
const SET = process.env.SELFCHECK_SET ?? "dev";
const CAP = Number(process.env.SELFCHECK_CAP ?? 5);
const LABEL = process.env.SELFCHECK_LABEL ?? SET;
const LOG = `${DIR}/calls-${LABEL}.jsonl`;
const OUT = `${DIR}/results-${LABEL}.json`;
const designs = (JSON.parse(readFileSync(`${DIR}/designs.json`, "utf-8")) as { designs: { id: string; set: string; type: "dbq" | "leq" | "saq"; q: string; cat: string }[] }).designs;
const qs = JSON.parse(readFileSync(`${DIR}/questions.json`, "utf-8")) as { questions: Record<string, { prompt: string; scoringNotes: string; sources: { id: string; title?: string; body: string }[] }>; injections: Record<string, string> };
const essaysRaw = Object.fromEntries(readFileSync(`${DIR}/responses.txt`, "utf-8").split(/^### /m).filter(Boolean).map((b) => { const i = b.indexOf("\n"); return [b.slice(0, i).trim(), b.slice(i + 1).trim()]; }));
const essayFor = (id: string): string => {
  const m = id.match(/^(.*)-(INJ\d)$/); if (!m) return essaysRaw[id];
  const baseOf: Record<string, string> = { "DBQA-INJ1": "DBQA-3", "DBQA-INJ2": "DBQA-4", "DBQB-INJ1": "DBQB-3", "LEQA-INJ1": "LEQA-3", "LEQB-INJ1": "LEQB-3", "LEQB-INJ2": "LEQB-4", "SAQA-INJ1": "SAQA-3" };
  return essaysRaw[baseOf[id]] + qs.injections[m[2]];
};
const REPEAT_IDS = (process.env.SELFCHECK_REPEAT ?? "").split(",").filter(Boolean);
const ids = SET === "repeat" ? REPEAT_IDS : designs.filter((d) => d.set === SET).map((d) => d.id);

const real = createAnthropicGraderClient();
const fake: GraderClient = { async grade(req) { const rows = req.rubricRows!; const o: Record<string, unknown> = { improve: ["x"] }; for (const r of rows) { o[r.key] = 0; o[`${r.key}_rationale`] = "fake rationale"; } return { output: o, inputTokens: 3000, outputTokens: 400, model: "fake" }; } };
const client = process.env.FAKE ? fake : real;

let spent = 0, calls = 0, invalid = 0; const perCall: number[] = [];
if (existsSync(LOG)) for (const l of readFileSync(LOG, "utf-8").split("\n").filter(Boolean)) { const j = JSON.parse(l); spent += j.costUsd; calls++; perCall.push(j.costUsd); }
const priorSpent = Number(process.env.SELFCHECK_PRIOR_SPENT ?? 0); // 이전 라벨들에서 이미 쓴 비용(총상한 계산용)
const l = limits(EURO_RUBRIC_ID);

(async () => {
  const results: unknown[] = [];
  const stop: string[] = [];
  outer: for (const id of ids) {
    const d = designs.find((x) => x.id === id)!; const q = qs.questions[d.q]; const def = resolveRubric(EURO_RUBRIC_ID, d.type)!;
    const essay = essayFor(id);
    const refusal = checkEssayLength(essay, def);
    if (refusal) { results.push({ id, status: "skipped_before_call", reason: refusal }); continue; }
    const prompt = buildPrompt({ taskPrompt: q.prompt, sources: q.sources, essay, anchors: [], rubricId: EURO_RUBRIC_ID, taskType: d.type, scoringNotes: q.scoringNotes });
    const runs: GraderOutput[] = []; const runLog: unknown[] = [];
    for (let i = 0; i < 2; i++) {
      let v: ReturnType<typeof validateGraderOutput> = { ok: false, reason: "not_run" };
      for (let a = 0; a < 2 && !v.ok; a++) {
        const est = perCall.length ? Math.max(...perCall) : 0.08;
        if (priorSpent + spent + est > CAP) { stop.push(`budget_stop before ${id} run ${i + 1}`); break outer; }
        const r = await client.grade({ system: prompt.system, user: prompt.user, maxOutputTokens: l.maxOutputTokensPerEssay, rubricRows: def.rows });
        const c = costUsd(r.inputTokens, r.outputTokens, l); spent += c; calls++; perCall.push(c);
        v = validateGraderOutput(r.output, def.rows); if (!v.ok) invalid++;
        const entry = { ts: new Date().toISOString(), id, run: i + 1, attempt: a + 1, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: c, valid: v.ok, invalidReason: v.ok ? null : v.reason };
        appendFileSync(LOG, JSON.stringify(entry) + "\n");
      }
      if (!v.ok) { runLog.push({ run: i + 1, error: "invalid_output" }); break; }
      runs.push(v.value); runLog.push({ run: i + 1, scores: v.value.scores, total: totalOf(v.value.scores, def.rows), rationale: v.value.rationale });
    }
    if (runs.length < 2) { results.push({ id, status: "failed", runs: runLog }); continue; }
    const { result, disagreement } = combineRuns(runs[0], runs[1], def.rows);
    results.push({ id, status: "done", rowKeys: def.rows.map((r) => r.key), runs: runLog, combined: result.scores, total: totalOf(result.scores, def.rows), disagreement, improve: result.improve });
  }
  writeFileSync(OUT, JSON.stringify({ set: SET, label: LABEL, spentUsd: +spent.toFixed(4), calls, invalidAttempts: invalid, stop, results }, null, 1));
  console.log(JSON.stringify({ label: LABEL, essays: results.length, spentUsd: +spent.toFixed(4), calls, invalidAttempts: invalid, stop }));
})();
