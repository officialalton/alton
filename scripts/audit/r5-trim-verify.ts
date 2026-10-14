// 라운드 5 단계 4: 이미 accepted(삭제만·구조·인용·독립 풀이 통과)인 정리안을 "원본과 새 지문을 둘 다 아는" 점검 모델로 한 번 더 본다.
// 질문·정답 이유·오답 선택지(함정)가 삭제된 내용에 기대는지, 시험하는 기술이 그대로인지 확인하고 하나라도 걸리면 rejected 로 돌린다.
//   ANTHROPIC_API_KEY=... npx tsx scripts/audit/r5-trim-verify.ts [--cap 3]
import { readFileSync, writeFileSync } from "node:fs";
import type Anthropic from "@anthropic-ai/sdk";
import { createToolMessage, reviewModel } from "../../lib/problem-generation/models";
import type { ProblemReadout } from "../../lib/audit-fix/plan";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const CAP = Number(arg("--cap") ?? 3); const OUT = "data/audit/2026-10-14-r5-trim-results.json";
const ro = JSON.parse(readFileSync("data/audit/2026-10-14-r5-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const file = JSON.parse(readFileSync(OUT, "utf-8")) as { results: any[]; [k: string]: unknown };
const TOOL: Anthropic.Tool = { name: "audit_trim", description: "Audit a shortened passage.", input_schema: { type: "object", properties: {
  question_depends_on_deleted: { type: "boolean", description: "True if the question stem, the correct answer's justification, or the question's wording refers to or presupposes anything that was deleted from the passage (e.g. a claim, term, name, or the student's argument)." },
  distractor_depends_on_deleted: { type: "boolean", description: "True if a wrong option was written to be tempting because of a detail that was deleted, so it is now easy to dismiss or no longer grounded in the text." },
  tested_skill_changed: { type: "boolean", description: "True if the item now tests something different or is materially easier/harder in kind (not just shorter)." },
  explanation_refers_to_deleted: { type: "boolean", description: "True if the explanation cites or relies on text that is gone." },
  verdict: { type: "string", enum: ["ok", "reject"] }, details: { type: "string" } }, required: ["question_depends_on_deleted", "distractor_depends_on_deleted", "tested_skill_changed", "explanation_refers_to_deleted", "verdict", "details"] } };
const SYS = "You audit edits to Digital SAT Reading & Writing items. A passage was shortened by deletion only. Compare the ORIGINAL and SHORTENED passage against the question, options, correct answer and explanation. Be strict: reject if anything the item relies on was deleted. Minor loss of atmosphere or redundant detail is fine.";
let spent = 0;
(async () => {
  const key = process.env.ANTHROPIC_API_KEY?.trim(); if (!key) throw new Error("ANTHROPIC_API_KEY 가 환경에 없습니다.");
  const { default: A } = await import("@anthropic-ai/sdk"); const client = new A({ apiKey: key });
  const m = new Map(ro.problems.map((p) => [p.problem_id, p])); const todo = file.results.filter((r) => r.accepted && !r.checker); let i = 0;
  const worker = async () => { while (i < todo.length && spent < CAP) { const r = todo[i++]; const p = m.get(r.problemId)!.pub!;
    const u = `SKILL: ${r.skill}\n\nORIGINAL PASSAGE:\n${p.passage}\n\nSHORTENED PASSAGE:\n${r.newPassage}\n\nQUESTION: ${p.question}\n${(p.options ?? []).map((o, k) => `${"ABCD"[k]}) ${o}`).join("\n")}\nCORRECT: ${"ABCD"[p.correct_index ?? 0]}\n\nEXPLANATION:\n${p.explanation_en}`;
    try { const msg = await createToolMessage(client, { model: reviewModel(), max_tokens: 1200, system: SYS, messages: [{ role: "user", content: u }], tools: [TOOL], tool_choice: { type: "tool", name: TOOL.name } });
      const t = msg.content.find((c) => c.type === "tool_use"); const inp = (t && t.type === "tool_use" ? t.input : {}) as Record<string, unknown>;
      const c = (msg.usage.input_tokens * 3 + msg.usage.output_tokens * 15) / 1e6; spent += c; r.usd += c; r.checker = inp;
      const bad = inp.verdict !== "ok" || inp.question_depends_on_deleted || inp.distractor_depends_on_deleted || inp.tested_skill_changed || inp.explanation_refers_to_deleted;
      if (bad) { r.accepted = false; r.rejectedBy = "checker"; }
      console.log(`${r.problemId.slice(0, 8)} ${r.skill} ${bad ? "REJECT" : "ok"} ${String(inp.details).slice(0, 160)}`);
    } catch (e) { console.log(`${r.problemId.slice(0, 8)} error ${(e as Error).message.slice(0, 100)}`); } } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  file.spentUsd = Number((file.results.reduce((n, r) => n + r.usd, 0)).toFixed(4)); writeFileSync(OUT, JSON.stringify(file, null, 1) + "\n");
  console.log(`accepted now ${file.results.filter((r) => r.accepted).length}; 이번 실행 $${spent.toFixed(3)}; 누적 trim $${file.spentUsd}`);
})();
