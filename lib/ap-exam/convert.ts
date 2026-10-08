// AP 후보 → 문제은행 변환 계획(순수 함수, DB 없음). 실행은 scripts/ap-generation/publish-to-bank.ts.
// 규칙: 렌더 게이트(lib/ap-figures/gate)를 통과한 후보만. 그림은 표준 그림 스펙으로 problem_versions.figure 에, 검증 기록은 render_check 에.
// 학생 화면은 영어다. 해설은 explanation_en 필수(explanation 에도 같은 영어를 둔다 — 한국어 해설은 후속).

import { checkFigure } from "../problem-figures/check";
import { gateCandidate, optionText, type ApCandidateLike, type GateResult } from "../ap-figures/gate";

type Json = Record<string, unknown>;
export type ApPurpose = "mock_exam" | "lesson";

export type ConvertedItem = {
  index: number;
  format: "mc" | "essay";
  passage: string | null;
  question: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  explanationEn: string;
  figure: unknown;
  renderCheck: unknown;
  statements: unknown;
  difficulty: "easy" | "medium" | "hard";
  skillCode: string | null;
  topic: string;
};
export type ConversionPlan = { ok: true; items: ConvertedItem[]; gate: GateResult } | { ok: false; reason: string; gate?: GateResult };

const DIFF: Record<string, "easy" | "medium" | "hard"> = { basic_learning: "easy", exam_prep: "medium", advanced_supplement: "hard" };
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export const FRQ_DISCLAIMER = "Reference answer and scoring notes (not official College Board scoring). Compare your response with this guide; no AP score is estimated.";

function frqReference(payload: Json): string {
  const parts = Array.isArray(payload.parts) ? (payload.parts as Json[]) : [];
  const lines: string[] = [FRQ_DISCLAIMER, ""];
  for (const p of parts) {
    lines.push(`(${String(p.label)}) [${String(p.points)} pt] ${String(p.model_answer ?? "")}`.trim());
    const rows = Array.isArray(p.rubric_rows) ? (p.rubric_rows as Json[]) : [];
    for (const r of rows) lines.push(`   - ${String(r.points)} pt: ${String(r.criterion ?? "")}`);
  }
  return lines.join("\n");
}

function passageFor(c: ApCandidateLike, gate: GateResult): string | null {
  const st = c.payload.stimulus;
  const s = typeof st === "string" ? null : isObj(st) ? st : null;
  const desc = s && typeof s.description === "string" ? s.description : "";
  if (gate.stimKind === "text" && !gate.spec && desc && !/^no (stimulus|figure)/i.test(desc)) return desc;
  return null;
}

export function planConversion(c: ApCandidateLike): ConversionPlan {
  const gate = gateCandidate(c);
  if (gate.status === "fail") return { ok: false, reason: `render gate failed: ${gate.issues.filter((i) => i.level === "error").map((i) => i.code).join(", ")}`, gate };
  const p = c.payload;
  const difficulty = DIFF[String((c as unknown as { difficultyProvisional?: string }).difficultyProvisional ?? "")] ?? "medium";
  const topic = String((c as unknown as { keywordCode?: string }).keywordCode ?? "");
  const figure = gate.spec;
  const passage = passageFor(c, gate);
  const mk = (index: number, stem: string, options: string[], key: number, expl: string): ConvertedItem => {
    const text = [passage ?? "", stem, ...options].join("\n");
    const rc = checkFigure(figure, text, options, key);
    return { index, format: "mc", passage, question: stem, options, correctIndex: key, explanation: expl, explanationEn: expl, figure, renderCheck: rc, statements: null, difficulty, skillCode: null, topic };
  };
  if (c.kind === "mc") {
    const items = Array.isArray(p.items) ? (p.items as Json[]) : null;
    if (items) {
      const out: ConvertedItem[] = [];
      for (const [i, it] of items.entries()) {
        if (typeof it.stem !== "string" || !Array.isArray(it.options) || typeof it.key_index !== "number") return { ok: false, reason: `set item ${i} is incomplete`, gate };
        out.push(mk(i, it.stem, (it.options as unknown[]).map(optionText), it.key_index as number, String(it.explanation_en ?? p.explanation_en ?? "")));
      }
      return finish(out, gate);
    }
    if (typeof p.stem !== "string" || !Array.isArray(p.options) || typeof p.key_index !== "number") return { ok: false, reason: "mc payload incomplete", gate };
    return finish([mk(0, p.stem, (p.options as unknown[]).map(optionText), p.key_index as number, String(p.explanation_en ?? ""))], gate);
  }
  // FRQ 번들: 한 문제 = 한 번들, 파트는 statements 에.
  const parts = Array.isArray(p.parts) ? (p.parts as Json[]) : [];
  if (!parts.length) return { ok: false, reason: "frq has no parts", gate };
  const statements = parts.map((x) => ({ label: String(x.label), points: Number(x.points), prompt: String(x.prompt), mode: String(x.response_mode ?? "explain") }));
  const question = `${String(p.title ?? "Free-response question")} — answer every part.`;
  const ref = frqReference(p);
  const text = [passage ?? "", question, ...statements.map((s) => s.prompt)].join("\n");
  const rc = checkFigure(figure, text, null, null);
  return finish([{ index: 0, format: "essay", passage, question, options: null, correctIndex: null, explanation: ref, explanationEn: ref, figure, renderCheck: rc, statements, difficulty, skillCode: null, topic }], gate);
}

/** 문제은행 공개 게이트(confirm_and_publish_problem_version)가 거부할 내용을 변환 전에 미리 걸러 낸다. */
export function bankGateIssues(it: ConvertedItem): string[] {
  const out: string[] = [];
  if (!it.explanationEn.trim()) out.push("no English explanation");
  if (it.format === "mc") {
    const o = it.options ?? [];
    if (o.length < 2) out.push("fewer than 2 options");
    if (new Set(o.map((x) => x.trim())).size !== o.length) out.push("duplicate option text");
    if (it.correctIndex === null || it.correctIndex < 0 || it.correctIndex >= o.length) out.push("answer key out of range");
  }
  if (/[ㄱ-ㆎ가-힣]/.test([it.passage, it.question, ...(it.options ?? [])].join(" "))) out.push("Hangul in student-facing text");
  if (it.figure && !(it.renderCheck as { ok?: boolean } | null)?.ok) out.push("render check not ok");
  return out;
}

function finish(items: ConvertedItem[], gate: GateResult): ConversionPlan {
  for (const it of items) { const bad = bankGateIssues(it); if (bad.length) return { ok: false, reason: `item ${it.index}: ${bad.join("; ")}`, gate }; }
  return { ok: true, items, gate };
}
