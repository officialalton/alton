// AP 후보 → 문제은행 변환 계획(순수 함수, DB 없음). 실행은 scripts/ap-generation/publish-to-bank.ts.
// 규칙: 렌더 게이트(lib/ap-figures/gate)를 통과한 후보만. 그림은 표준 그림 스펙으로 problem_versions.figure 에, 검증 기록은 render_check 에.
// 학생 화면은 영어다. 해설은 explanation_en 필수(explanation 에도 같은 영어를 둔다 — 한국어 해설은 후속).

import { checkFigure } from "../problem-figures/check";
import { gateCandidate, optionText, type ApCandidateLike, type GateResult } from "../ap-figures/gate";
import { autoMathExplanation } from "./explanation-math";

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
  if (isObj(payload.el_frq) && typeof payload.reference_text === "string" && payload.reference_text.trim()) return payload.reference_text; // AP English: 루브릭 요약 + 3단계 주석 샘플(englang-frq.ts frqReferenceText)
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
  // 공유 자료 세트(통계 3문항 세트): 세트 소개 문장은 세 문제에 같은 지문으로 붙는다(자료 그림은 문제마다 같은 figure 로 붙는다).
  const intro = c.payload.set_intro;
  const st = c.payload.stimulus;
  const s = typeof st === "string" ? null : isObj(st) ? st : null;
  const desc = s && typeof s.description === "string" ? s.description : "";
  if (typeof intro === "string" && intro.trim()) {
    // 코드 자료 세트(AP CS A): 세트가 함께 쓰는 클래스·메서드 코드는 소개 문장 뒤에 같은 지문으로 붙는다(없으면 학생은 코드를 못 본다).
    const codeSet = gate.stimKind === "text" && isObj(s?.data) && (s?.data as Json).variant === "java_code" && /^```/.test(desc.trim());
    return codeSet ? `${intro.trim()}\n\n${desc.trim()}` : intro.trim();
  }
  if (gate.stimKind === "text" && !gate.spec && desc && !/^no (stimulus|figure)/i.test(desc)) return desc;
  return graphStatedFacts(s, gate) ?? frqLostSetup(c, gate, desc);
}

const NO_STIM = /^no (stimulus|figure)/i;
const SETUP_NARRATIVE = /^(?:A|An|The)\s[^.]*\b(?:measures?|releases?|released|hangs?|hanging|slides?|swings?|swinging|attached|rests?|floats?|gives?)\b/;
const specStrings = (v: unknown): string[] => (typeof v === "string" ? [v] : typeof v === "number" ? [String(v)] : Array.isArray(v) ? v.flatMap(specStrings) : isObj(v) ? Object.values(v).flatMap(specStrings) : []);
const numTokens =(t: string) => t.match(/\d+(?:\.\d+)?/g) ?? [];
/**
 * FRQ 표·도식 자료의 stimulus.description 은 그림 스펙(ap_table)에 실리지 않아 학생 화면에 나오지 않는다(2026-10-13 감사 3라운드: 용수철 실험 표 "학생이 …를 측정한다").
 * 학생이 실험 맥락·조건을 못 보는 경우에만 본문 지문으로 싣는다: (a) 표 자료의 실험 설정 서술문이거나 (b) 설명의 수치(310 K, $55, n=18 …)가 화면 어디에도 없을 때.
 * 단순 그림 캡션("Selected values of R(t), in gallons per minute")·이미 notes/문항에 있는 설명은 건드리지 않는다. 다른 과목의 기존 표시는 이 두 경우 밖에서 그대로다.
 */
export function frqLostSetup(c: ApCandidateLike, gate: GateResult, desc: string): string | null {
  const d = desc.trim();
  if (c.kind !== "frq_bundle" || !gate.spec || gate.stimKind === "text" || !d || NO_STIM.test(d)) return null;
  const parts = Array.isArray(c.payload.parts) ? (c.payload.parts as Json[]) : [];
  const shown = [String(c.payload.title ?? ""), ...parts.map((x) => String(x.prompt ?? "")), ...specStrings(gate.spec)].join("\n");
  const norm = (t: string) => t.replace(/[$\\]/g, "").replace(/\s+/g, " ").trim(); // 그림 notes 는 정규화 때 수식 구분자 $ 가 빠진다
  if (norm(shown).includes(norm(d))) return null;
  const missingNumber = numTokens(d).some((n) => !new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?!\\d)`).test(shown));
  const narrative = gate.stimKind === "table" && SETUP_NARRATIVE.test(d);
  if (!narrative && !missingNumber) return null;
  return /[.!?]$/.test(d) ? d : `${d}.`;
}

/**
 * 그래프 자료의 `data.context`(함수가 무엇인지)·`data.given`(초기값 f(0)=40, 연속·미분가능 조건)은 그림 스펙에 들어가지 않아
 * 학생 화면에 한 번도 나오지 않았다(외부 감사 2026-10-08: "초기 함수값 없이 절대 최솟값을 묻는다"). 그림과 함께 본문 지문으로 싣는다.
 * 표 자료는 notes 가 ap_table 에 이미 실려 대상이 아니다. 문자열·{ "f(0)": 40 } 객체 둘 다 읽는다.
 */
function graphStatedFacts(stim: Json | null, gate: GateResult): string | null {
  if (!stim || gate.stimKind !== "graph" || !isObj(stim.data)) return null;
  const d = stim.data;
  const sentence = (t: string) => { const x = t.trim(); return !x ? "" : /[.!?]$/.test(x) ? x : `${x}.`; };
  const lines: string[] = [];
  if (typeof d.context === "string") lines.push(sentence(d.context));
  const g = d.given;
  if (typeof g === "string") lines.push(sentence(g));
  else if (isObj(g)) { const e = Object.entries(g).map(([k, v]) => `$${k} = ${String(v)}$`); if (e.length) lines.push(sentence(`Given: ${e.join(", ")}`)); }
  const out = lines.filter(Boolean).join(" ");
  return out || null;
}

/** wrapMath(기본 true): 해설·참고 답안에 생성기가 `$...$` 없이 쓴 수식을 변환 시점에 구분자로 감싼다(화면 변환과 같은 규칙, 멱등). false 는 "변환 전 원문"(교정 계획의 before 해시 계산)용. */
export function planConversion(c: ApCandidateLike, opts: { wrapMath?: boolean } = {}): ConversionPlan {
  const wm = (t: string) => (opts.wrapMath === false ? t : autoMathExplanation(t));
  const gate = gateCandidate(c);
  if (gate.status === "fail") return { ok: false, reason: `render gate failed: ${gate.issues.filter((i) => i.level === "error").map((i) => i.code).join(", ")}`, gate };
  const p = c.payload;
  const difficulty = DIFF[String((c as unknown as { difficultyProvisional?: string }).difficultyProvisional ?? "")] ?? "medium";
  const topic = String((c as unknown as { keywordCode?: string }).keywordCode ?? "");
  const figure = gate.spec;
  const passage = passageFor(c, gate);
  const mk = (index: number, stem: string, options: string[], key: number, expl: string, itemTopic?: string): ConvertedItem => {
    const text = [passage ?? "", stem, ...options].join("\n");
    const rc = checkFigure(figure, text, options, key);
    return { index, format: "mc", passage, question: stem, options, correctIndex: key, explanation: wm(expl), explanationEn: wm(expl), figure, renderCheck: rc, statements: null, difficulty, skillCode: null, topic: itemTopic || topic };
  };
  if (c.kind === "mc") {
    const items = Array.isArray(p.items) ? (p.items as Json[]) : null;
    if (items) {
      const out: ConvertedItem[] = [];
      for (const [i, it] of items.entries()) {
        if (typeof it.stem !== "string" || !Array.isArray(it.options) || typeof it.key_index !== "number") return { ok: false, reason: `set item ${i} is incomplete`, gate };
        out.push(mk(i, it.stem, (it.options as unknown[]).map(optionText), it.key_index as number, String(it.explanation_en ?? p.explanation_en ?? ""), typeof it.topic === "string" ? it.topic : undefined));
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
  const ref = wm(frqReference(p));
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
