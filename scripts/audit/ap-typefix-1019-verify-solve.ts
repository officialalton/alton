// 유형 단위 수정본의 독립 풀이 검증(유료, Opus 5.5 배치 — 합계 수 센트). 학생에게 보이는 내용(변환 결과)만 주고 정답 키·해설은 주지 않는다.
//   .venv-ap/bin/python scripts/audit/ap-typefix-1019-samples.py   (표본 생성, 무료)
//   set -a; . ~/Developer/ALTON/.env.local; set +a; npx tsx scripts/audit/ap-typefix-1019-verify-solve.ts
// 대상: (1) 공개 문항 교체 후보 supp-fix1019-items.json 11건, (2) 고친 원형이 지금 내는 표본 27건(저장 재고와 무관).
// 결과: data/audit/ap-fix1019-independent-solve.json (문항별 모델 선택·유일성·결측 정보 판정). 비용은 data/ap/sample-2027/ledger.json 에 기록된다.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal, STOP_LINE } from "../ap-generation/ledger-total";
import { planConversion } from "../../lib/ap-exam/convert";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type J = any;
const published = JSON.parse(readFileSync("data/ap/stock/supp-fix1019-items.json", "utf-8")) as J[];
const samples = JSON.parse(readFileSync("data/audit/ap-typefix-1019-archetype-samples.json", "utf-8")) as J[];
/** 원형 팩에는 해설이 없다(재고 적재 때 보기별 why 로 만든다): 같은 규칙으로 만든다(정답은 변환 키 일치 확인용이며 풀이 모델에는 주지 않는다). */
const explOf = (q: J) => `The correct answer is ${q.options[q.key_index].text}. ${q.options[q.key_index].why}\n` + q.options.filter((_: J, i: number) => i !== q.key_index).map((x: J) => `${x.text} is incorrect: ${x.why}`).join("\n");
for (const s of samples) if (s.kind === "mc") { const p = s.payload; if (Array.isArray(p.items)) for (const it of p.items) it.explanation_en = explOf(it); else p.explanation_en = explOf(p); }
const sampleRecs: J[] = samples.map((s) => ({ stockKey: `sample:${s.archetype}-s${s.seed}`, candidateKey: `${s.archetype}-s${s.seed}`, apSubjectCode: s.subject, kind: s.kind, payload: s.payload, validation: "auto_passed", difficultyProvisional: "exam_prep" }));
const items = [...published, ...sampleRecs];
const MODEL = "claude-opus-5-5";
const DIR = path.resolve("data/ap/sample-2027/fix1019-verify");
const HARD = STOP_LINE; const BUDGET_USD = 3; // 저장소 누적 중단선(ledger-total) 안에서, 이번 작업 자체 한도는 $3(과제 한도 $5)

const MC_TOOL = { name: "submit_solution", description: "Report your independent solution of every question.", input_schema: { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { q: { type: "integer" }, chosen_index: { type: "integer", description: "0-based index of the single best option" }, correct_options: { type: "array", items: { type: "integer" }, description: "0-based indices of ALL options that are defensibly correct" }, unique: { type: "boolean", description: "true only if exactly one option is correct and every other option is clearly wrong" }, missing_information: { type: "string", description: "Anything needed to answer that is not visible in the text/table shown ('none' if nothing)" }, work: { type: "string" } }, required: ["q", "chosen_index", "correct_options", "unique", "missing_information", "work"] } } }, required: ["questions"] } };
const FRQ_TOOL = { name: "submit_review", description: "Report whether the free-response question is answerable and the reference answer follows.", input_schema: { type: "object", properties: { answerable_from_shown_text: { type: "boolean" }, missing_information: { type: "string", description: "Anything needed to answer that the student cannot see in the heading, table/figure data or parts ('none' if nothing)" }, parts: { type: "array", items: { type: "object", properties: { label: { type: "string" }, your_answer: { type: "string" }, agrees_with_reference: { type: "boolean" }, issue: { type: "string" } }, required: ["label", "your_answer", "agrees_with_reference", "issue"] } } }, required: ["answerable_from_shown_text", "missing_information", "parts"] } };

const SYS_MC = "You are an expert AP teacher independently solving multiple-choice questions exactly as a student sees them. Solve from the shown text and table only; do not assume information that is not shown. Report which options are defensibly correct. Be strict: if two options are equivalent or both defensible, say so; if the stem lacks information needed for a unique answer, say so.";
const SYS_FRQ = "You are an expert AP teacher. A student sees ONLY the question heading and parts shown below (and the data table or figure, if any). Decide whether each part can be answered uniquely from what is shown, then write your own answer to each part and say whether the quoted reference answer is correct and consistent with what the student can see.";

const reqs: BatchReq[] = []; const meta: Record<string, { key: string; kind: string; keyIndex: number[]; group: string }> = {};
for (const rec of items) {
  const plan = planConversion(rec); if (!plan.ok) throw new Error(`${rec.stockKey}: ${plan.reason}`);
  const id = `v__${rec.stockKey.replace(/[^a-zA-Z0-9]/g, "_")}`.slice(0, 60);
  const group = String(rec.stockKey).startsWith("sample:") ? "archetype_sample" : "published_replacement";
  const stim = JSON.stringify(rec.payload.stimulus?.data ?? {});
  if (rec.kind === "mc") {
    const body = plan.items.map((it, i) => `QUESTION ${i + 1}\n${it.passage ? `Text shown to the student:\n${it.passage}\n` : ""}${rec.payload.stimulus?.kind && rec.payload.stimulus.kind !== "none" ? `Figure/table data shown to the student (JSON): ${stim}\n` : ""}${it.question}\n${(it.options ?? []).map((o, j) => `[${j}] ${o}`).join("\n")}`).join("\n\n");
    reqs.push({ custom_id: id, params: { model: MODEL, thinking: { type: "adaptive" }, output_config: { effort: "high" }, max_tokens: 16000, system: [{ type: "text", text: SYS_MC }], tools: [MC_TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: `${body}\n\nCall submit_solution once with every question.` }] } as never });
    meta[id] = { key: rec.stockKey, kind: "mc", keyIndex: plan.items.map((it) => it.correctIndex ?? -1), group };
  } else {
    const it = plan.items[0]; const parts = (it.statements as { label: string; points: number; prompt: string }[]);
    const ref = (rec.payload.parts as J[]).map((p) => `(${p.label}) ${p.model_answer}`).join("\n");
    const body = `${it.passage ? `Text shown to the student:\n${it.passage}\n\n` : ""}Question heading shown: ${it.question}\nData table/figure shown (JSON): ${stim}\n\nParts shown:\n${parts.map((p) => `(${p.label}) [${p.points} pt] ${p.prompt}`).join("\n")}\n\nREFERENCE ANSWER (not shown to the student before submission):\n${ref}\n\nCall submit_review.`;
    reqs.push({ custom_id: id, params: { model: MODEL, thinking: { type: "adaptive" }, output_config: { effort: "high" }, max_tokens: 16000, system: [{ type: "text", text: SYS_FRQ }], tools: [FRQ_TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: body }] } as never });
    meta[id] = { key: rec.stockKey, kind: "frq", keyIndex: [], group };
  }
}
(async () => {
  const est = estimate(MODEL, reqs.length, 6000, 3000); const t = ledgerTotal();
  if (t.cumulativeUsd + est >= HARD) throw new Error("HARD STOP"); console.log(`cumulative ${t.cumulativeUsd}; est ${est.toFixed(2)}; ${reqs.length} requests`);
  if (est > BUDGET_USD) throw new Error(`estimate ${est} exceeds ${BUDGET_USD}`);
  const got = await runBatch({ dir: DIR, name: "solve2", requests: reqs, budgetUsd: ledger(DIR).spent() + BUDGET_USD, estimateUsd: est, pollMs: 15000 });
  const out: J[] = []; let bad = 0;
  for (const rq of reqs) {
    const g = got.get(rq.custom_id); const ti = g ? (toolInput(g) as J) : null; const m = meta[rq.custom_id];
    if (!ti) { out.push({ ...m, result: null }); bad++; continue; }
    if (m.kind === "mc") {
      const qs = ti.questions as J[]; const ok = qs.length === m.keyIndex.length && qs.every((q) => q.unique && q.chosen_index === m.keyIndex[q.q - 1] && q.correct_options.length === 1 && q.correct_options[0] === m.keyIndex[q.q - 1] && /^(none|n\/a|no)\b/i.test(String(q.missing_information).trim()));
      if (!ok) bad++; out.push({ ...m, keyMatchesAndUnique: ok, questions: qs.map((q) => ({ q: q.q, chosen: q.chosen_index, correct_options: q.correct_options, unique: q.unique, missing: q.missing_information })) });
    } else { const ok = ti.answerable_from_shown_text && ti.parts.every((p: J) => p.agrees_with_reference); if (!ok) bad++; out.push({ ...m, answerableAndConsistent: ok, missing: ti.missing_information, parts: ti.parts }); }
  }
  writeFileSync("data/audit/ap-fix1019-independent-solve.json", JSON.stringify(out, null, 1));
  console.log(`done: ${reqs.length - bad}/${reqs.length} clean; details in data/audit/ap-fix1019-independent-solve.json; spent in this run ${ledger(DIR).spent()}`);
})();
