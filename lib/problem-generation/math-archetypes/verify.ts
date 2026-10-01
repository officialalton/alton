// 원형 문항 결정론 검증 — 정답 재계산(verification_js, vm)·선지 값 겹침·표기 규칙·hard 주장 기계 검사.
import vm from "node:vm";
import { checkContent } from "@/lib/problem-content-check";
import { checkFigure } from "@/lib/problem-figures/check";
import { composeProblemText } from "@/lib/problem-question";
import { findBannedWords } from "@/lib/problem-generation/common-quality-gate";
import type { Archetype, Instance } from "./types";
import { checkChoiceInstance, checkFigureBinding } from "./figure-verify";
import { checkSprAnswers } from "./spr";

/** LaTeX 일부($, \frac, \sqrt, ^, 암묵 곱셈)를 JS 식으로 바꿔 평가한다. 변수는 vars 에 없으면 오류. \pi 는 계수만 본다(PI=1). */
export function evalMath(src: string, vars: Record<string, number> = {}): number {
  let s = src.replace(/\$/g, "").replace(/\\left|\\right/g, "").replace(/\\cdot|\\times/g, "*").replace(/\\pi/g, "PI").replace(/\\,/g, "").replace(/−/g, "-").replace(/,/g, "");
  s = s.replace(/%/g, "");
  for (let i = 0; i < 12; i++) { const t = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "(($1)/($2))"); if (t === s) break; s = t; }
  for (let i = 0; i < 12; i++) { const t = s.replace(/\\sqrt\{([^{}]*)\}/g, "\u0001($1)"); if (t === s) break; s = t; }
  s = s.replace(/\^\{([^{}]*)\}/g, "**($1)").replace(/\^/g, "**");
  // PI 는 하나의 토큰으로 본다
  s = s.replace(/PI/g, "\u0002");
  s = s.replace(/([a-zA-Z\u0002])(?=[a-zA-Z\u0002])/g, "$1*");
  s = s.replace(/([0-9])(?=[a-zA-Z\u0002\u0001])/g, "$1*");
  s = s.replace(/([)\u0002a-zA-Z0-9])\s*(?=\()/g, "$1*").replace(/\)\s*(?=[a-zA-Z0-9\u0002\u0001])/g, ")*");
  s = s.replace(/([a-zA-Z0-9\u0002])(?=\u0001)/g, "$1*");
  if (!/^[0-9a-zA-Z+\-*/().\s\u0001\u0002]*$/.test(s)) throw new Error(`해석 불가 문자: ${src}`);
  s = s.replace(/\u0001/g, "Math.sqrt").replace(/\u0002/g, "PI");
  const names = [...Object.keys(vars), "PI"]; const vals = [...Object.values(vars), 1];
  const out = new Function(...names, `"use strict"; return (${s});`)(...vals);
  if (typeof out !== "number") throw new Error(`숫자가 아님: ${src}`);
  return out;
}

export function runVerification(js: string): number {
  const out = vm.runInNewContext(`(function(){${js}})()`, {}, { timeout: 5000 }) as unknown;
  if (typeof out !== "number" || !Number.isFinite(out)) throw new Error(`verification_js 결과가 유한한 숫자가 아님: ${String(out)}`);
  return out;
}

const HANGUL = /[ㄱ-ㆎ가-힣]/;
export function checkNotation(fields: Record<string, string>): string[] {
  const issues: string[] = [];
  for (const [name, raw] of Object.entries(fields)) {
    const t = raw.replace(/\\\$/g, "");
    const count = (t.match(/\$/g) ?? []).length;
    if (count % 2 !== 0) issues.push(`${name}: $ 짝이 맞지 않음`);
    if (count % 2 === 0) { const segs = t.split("$"); for (let i = 1; i < segs.length; i += 2) if (HANGUL.test(segs[i])) issues.push(`${name}: 수식 안에 한글 — ${segs[i].slice(0, 30)}`); }
    if (/NaN|Infinity|\[object/.test(raw) || (name.startsWith("option") && /undefined/.test(raw))) issues.push(`${name}: 비정상 값 문자열`);
  }
  for (const n of ["stimulus", "question"]) if (fields[n] && HANGUL.test(fields[n])) issues.push(`${n}: 지문·질문은 영어만 허용(한글 포함)`);
  return issues;
}

/** verification_js 가 푸는 상수 P 의 값이 실제 지문·질문·선지에 적힌 수인지 확인한다(숨은 값으로 푼 재계산이 아니라 '인쇄된 문제'를 푸는지 보증). */
const FLAG_KEYS = new Set(["pick", "ask", "diff", "prod", "count", "oneEach", "per100", "par", "x", "id", "ev", "al", "be", "step", "m_unused"]);
export function checkParamsPrinted(inst: Instance): string[] {
  const m = inst.verificationJs.match(/^const P = (\{.*\});/);
  if (!m) return ["verification_js 에 const P = {...} 없음"];
  let P: Record<string, unknown>;
  try { P = JSON.parse(m[1]); } catch { return ["verification_js 상수 P 를 해석할 수 없음"]; }
  const text = `${inst.stimulus} ${inst.question} ${inst.options.join(" ")}`;
  const printed = new Set((text.match(/\d+/g) ?? []).map(Number));
  const WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twice: 2, double: 2, triple: 3 };
  for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) if (WORDS[w]) printed.add(WORDS[w]);
  const issues: string[] = [];
  for (const [k, v] of Object.entries(P)) {
    if (FLAG_KEYS.has(k) || typeof v !== "number" || !Number.isInteger(v) || Math.abs(v) <= 1) continue;
    if (!printed.has(Math.abs(v))) issues.push(`검증 상수 ${k}=${v} 가 지문·선지에 인쇄되지 않음`);
  }
  return issues;
}

/** "X and Y are constants"·"X is a constant"처럼 본문에서 상수로 선언한 문자가 실제 수식($...$)에 쓰이는지 확인한다(변수명 불일치 방지). */
export function checkVariableMentions(inst: Instance): string[] {
  const full = `${inst.stimulus}\n${inst.question}`;
  const segs = full.split("$"); const math = segs.filter((_, i) => i % 2 === 1).join(" ").replace(/\\[a-zA-Z]+/g, " ");
  const prose = segs.filter((_, i) => i % 2 === 0).join(" ");
  const issues: string[] = [];
  const re = /\b([A-Za-z])(?:,? and ([A-Za-z]))?,? (?:are|is) (?:a )?constants?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prose))) for (const ch of [m[1], m[2]]) if (ch && !math.includes(ch)) issues.push(`본문이 상수 ${ch} 를 선언하지만 수식에는 없음`);
  return issues;
}

/** 문장과 변수의 의미 일치(명사-수식 대응표 기반): 각 대응 (명사구, 값)에 대해, 명사구가 나온 문장 안에서 명사구에 가장 가까운 숫자가 그 값이어야 한다. 명사구 중복도 금지. */
export function checkBindings(inst: Instance): string[] {
  const b = inst.phraseBindings; if (!b?.length) return [];
  const issues: string[] = []; const text = `${inst.stimulus}\n${inst.question}`;
  const sentences = text.split(/(?<=[.?!])\s+|\n+/).map((s) => s.replace(/\$/g, " "));
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new Set(b.map((x) => x.phrase.toLowerCase())).size !== b.length) issues.push("대응표에 같은 명사구가 둘 이상");
  for (const { phrase, value } of b) {
    let ok = false; let seen = false;
    for (const sent of sentences) {
      const m = new RegExp(esc(phrase), "i").exec(sent); if (!m) continue; seen = true;
      const s0 = m.index, e0 = m.index + m[0].length;
      const nums = [...sent.matchAll(/\d+(?:\.\d+)?/g)].map((x) => ({ v: Number(x[0]), gap: x.index! + x[0].length <= s0 ? s0 - (x.index! + x[0].length) : x.index! >= e0 ? x.index! - e0 : 0 }));
      if (!nums.length) continue;
      const best = Math.min(...nums.map((n) => n.gap));
      if (nums.filter((n) => n.gap === best).every((n) => n.v === Math.abs(value))) ok = true;
    }
    if (!seen) issues.push(`의미 대응: 명사구 "${phrase}" 가 본문에 없음`);
    else if (!ok) issues.push(`의미 대응: "${phrase}" 에 가장 가까운 수가 ${value} 가 아님`);
  }
  return issues;
}

export type VerifyResult = { ok: boolean; failures: string[]; optionValues: number[]; verified: number | null };
const TOL = 1e-6;

export function verifyInstance(a: Archetype, inst: Instance): VerifyResult {
  const failures: string[] = []; let optionValues: number[] = []; let verified: number | null = null;
  const fmt = inst.format ?? "mc"; const isIndex = inst.answerKind === "index"; const isSpr = fmt === "spr";
  if (isSpr) {
    // SPR: 선택지 없음 — 정답 목록(answers)이 재계산값에서 규칙대로 만든 목록과 같아야 한다.
    if (inst.options.length !== 0) failures.push("spr 인데 선택지가 남아 있음");
    try { verified = runVerification(inst.verificationJs); failures.push(...checkSprAnswers(inst.answers, verified)); }
    catch (e) { failures.push(`verification_js 실패: ${(e as Error).message}`); }
  } else if (isIndex) {
    // 선택지형(figure_choice)·서술 선지: verification_js 가 정답 선지 번호(0 기준)를 계산한다.
    if (inst.options.length !== 4) failures.push(`선택지 ${inst.options.length}개`);
    if (new Set(inst.options.map((o) => o.trim())).size !== inst.options.length) failures.push("선택지 문자열 중복");
    if (!(inst.correctIndex >= 0 && inst.correctIndex < inst.options.length)) failures.push("정답 인덱스 범위 밖");
    try {
      verified = runVerification(inst.verificationJs);
      if (verified !== inst.correctIndex) failures.push(`정답 재계산 ${verified}번 ≠ 표기 정답 ${inst.correctIndex}번(0 기준)`);
    } catch (e) { failures.push(`verification_js 실패: ${(e as Error).message}`); }
    const pm = inst.verificationJs.match(/^const P = (\{.*\});/);
    if (pm) { try { const P = JSON.parse(pm[1]) as { options?: string[] }; if (P.options && JSON.stringify(P.options) !== JSON.stringify(inst.options)) failures.push("verification_js 가 인쇄된 선지를 그대로 읽지 않음"); } catch { failures.push("verification_js 상수 P 를 해석할 수 없음"); } }
    if (inst.figure && (inst.figure as { type?: string }).type === "figure_choice") failures.push(...checkChoiceInstance(inst, verified));
  } else {
    if (inst.options.length !== 4) failures.push(`선택지 ${inst.options.length}개`);
    if (new Set(inst.options.map((o) => o.trim())).size !== inst.options.length) failures.push("선택지 문자열 중복");
    if (!(inst.correctIndex >= 0 && inst.correctIndex < inst.options.length)) failures.push("정답 인덱스 범위 밖");
    try { optionValues = inst.options.map((o) => evalMath(o, inst.evalAt ?? {})); } catch (e) { failures.push(`선택지 해석 실패: ${(e as Error).message}`); }
    if (optionValues.length === inst.options.length) {
      for (let i = 0; i < optionValues.length; i++) for (let j = i + 1; j < optionValues.length; j++) if (Math.abs(optionValues[i] - optionValues[j]) <= TOL) failures.push(`선택지 값 겹침 ${i + 1}/${j + 1}`);
      try {
        verified = runVerification(inst.verificationJs);
        const hit = optionValues.map((v, i) => (Math.abs(v - verified!) <= TOL * Math.max(1, Math.abs(verified!)) ? i : -1)).filter((i) => i >= 0);
        if (hit.length !== 1) failures.push(`정답 재계산 ${verified} 와 일치하는 선지 ${hit.length}개`);
        else if (hit[0] !== inst.correctIndex) failures.push(`정답 키 불일치: 재계산 ${verified} 는 ${hit[0] + 1}번, 표기 정답은 ${inst.correctIndex + 1}번`);
      } catch (e) { failures.push(`verification_js 실패: ${(e as Error).message}`); }
    }
  }
  failures.push(...checkNotation({ stimulus: inst.stimulus, question: inst.question, ...Object.fromEntries(inst.options.map((o, i) => [`option${i + 1}`, o])), explanation: inst.explanation, explanationEn: inst.explanationEn }));
  const text = composeProblemText(inst.stimulus, inst.question); // import.ts 와 같은 합성
  // import.ts 는 checkContent 이슈가 하나라도 있거나 checkFigure 가 실패하면 공개하지 않는다 — 여기서도 전부 0 이어야 통과.
  for (const f of checkContent({ format: fmt, passage: text, options: isSpr ? null : inst.options, correctIndex: isSpr ? null : inst.correctIndex, explanation: inst.explanation, answers: isSpr ? inst.answers ?? null : null, statements: null, skillCode: a.skill, figure: inst.figure ?? null })) failures.push(`내용 검사 ${f.code}: ${f.message}`);
  const fig = checkFigure(inst.figure ?? null, text, isSpr ? null : inst.options, isSpr ? null : inst.correctIndex);
  if (!fig.ok) for (const f of fig.issues) failures.push(`렌더 검사 ${f.code}: ${f.message}`);
  failures.push(...checkFigureBinding(inst));
  for (const b of findBannedWords({ 지문: inst.stimulus, 질문: inst.question, 해설: inst.explanation })) failures.push(`금칙어: ${b.message}`);
  failures.push(...checkParamsPrinted(inst));
  failures.push(...checkVariableMentions(inst));
  // hard 주장 기계 검사 — 단계·개념은 늘고 숫자는 단순해야 한다.
  const isHard = (a.difficulty ?? "hard") === "hard";
  const minSteps = Math.max(5, a.mediumSteps + 1);
  if (isHard) {
    if (inst.trace.length < minSteps) failures.push(`풀이 단계 ${inst.trace.length} < ${minSteps} (같은 세부 패턴 medium ${a.mediumSteps} 대비 +1 이상이고 5 이상이어야 함)`);
    if (a.concepts.length < 2) failures.push("결합 개념 2개 미만");
  } else if (inst.trace.length < 2) failures.push("풀이 단계 2 미만");
  failures.push(...checkBindings(inst));
  const nums = (text.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  if (nums.some((n) => Math.abs(n) > 999 && Math.abs(n) !== 1000)) failures.push("지문에 4자리 이상 숫자(복잡한 숫자로 hard 를 만들지 않는다)");
  if (/\d+\.\d{2,}/.test(text)) failures.push("지문에 소수 둘째 자리 이상");
  return { ok: failures.length === 0, failures, optionValues, verified };
}
