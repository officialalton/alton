// 담당 A(nonlinear_equations_systems·nonlinear_functions·equivalent_expressions easy/medium) 공용 도구.
// - 분수·근호 표기, 이차식 도구, 명사-수식 매핑 표(둘레/넓이 혼동 방지)와 기계 검사.
import type { Instance } from "../types";
import { gcd } from "../rng";
import { evalMath } from "../verify";

/** 실수 → 기약분수 문자열(분모 ≤ 16), 아니면 소수 둘째 자리. 선지 문자열(수식 환경 밖)용. */
export function fracOf(v: number): string {
  if (Number.isInteger(v)) return String(v);
  for (let d = 2; d <= 16; d++) { const n = Math.round(v * d); if (Math.abs(n / d - v) < 1e-9) { const g = gcd(n, d); return `${n / g}/${d / g}`; } }
  return v.toFixed(2).replace(/\.?0+$/, "");
}
/** 제곱인수를 빼낸다: n = q² · f (f 는 제곱인수 없음). */
export function sqFree(n: number): { q: number; f: number } {
  let q = 1, f = n;
  for (let k = 2; k * k <= f; k++) while (f % (k * k) === 0) { f /= k * k; q *= k; }
  return { q, f };
}
export const isSquare = (n: number) => n >= 0 && Number.isInteger(Math.sqrt(n));
/** p + q√n (q 부호 포함) 를 수식 문자열로("3 + 2\sqrt{5}", "-1 - \sqrt{7}", "\sqrt{3}", "4"). */
export function radStr(p: number, q: number, n: number): string {
  if (q === 0) return String(p);
  const rad = `${Math.abs(q) === 1 ? "" : Math.abs(q)}\\sqrt{${n}}`;
  if (p === 0) return q < 0 ? `-${rad}` : rad;
  return `${p} ${q < 0 ? "-" : "+"} ${rad}`;
}
export const radVal = (p: number, q: number, n: number) => p + q * Math.sqrt(n);
/** a x^2 + b x + c = 0 을 수식 문자열로(0 계수 생략). */
export function quadStr(a: number, b: number, c: number, v = "x"): string {
  let out = "";
  const add = (co: number, body: string) => { if (co === 0) return; const sign = co < 0 ? "-" : "+"; const abs = Math.abs(co); const t = body === "" ? String(abs) : `${abs === 1 ? "" : abs}${body}`; out += out === "" ? (co < 0 ? `-${t}` : t) : ` ${sign} ${t}`; };
  add(a, `${v}^2`); add(b, v); add(c, "");
  return out === "" ? "0" : out;
}
export const M$ = (s: string) => `$${s}$`;
export const W = (n: number) => (n < 0 ? `(${n})` : String(n));

// ── 명사-수식 매핑 표 ──────────────────────────────────────────────
/** 문장이 말하는 양(명사)마다 값 규칙이 하나다. 생성기는 이 표의 규칙으로만 식을 세우고, 검사는 그 식을 같은 규칙으로 다시 계산해 대조한다. */
export const NOUN_FN: Record<string, (p: number[]) => number> = {
  area: (p) => p[0] * p[1], // 직사각형 가로 × 세로
  perimeter: (p) => 2 * (p[0] + p[1]), // 직사각형 2(가로+세로)
  revenue: (p) => p[0] * p[1], // 가격 × 판매량
};
const NOUN_RE: Record<string, RegExp> = { area: /\barea\b/i, perimeter: /\bperimeter\b/i, revenue: /\brevenue\b/i };
/** 지문·질문에 '넓이/둘레/매출' 말이 있으면 그 명사에 맞는 식이 선언돼 있고 값 규칙과 맞는지, 선언된 명사가 문장에 실제 있는지 검사한다. */
export function checkSemantics(inst: Pick<Instance, "stimulus" | "question" | "semantics">): string[] {
  const text = `${inst.stimulus} ${inst.question}`; const issues: string[] = []; const decl = inst.semantics ?? [];
  for (const [noun, re] of Object.entries(NOUN_RE)) {
    const said = re.test(text); const has = decl.filter((d) => d.noun === noun);
    if (said && has.length === 0) issues.push(`문장은 '${noun}' 을 말하지만 대응 식 선언이 없음`);
    if (!said && has.length > 0) issues.push(`'${noun}' 식이 선언됐지만 문장에 해당 명사가 없음`);
  }
  for (const d of decl) {
    const fn = NOUN_FN[d.noun]; if (!fn) { issues.push(`매핑 표에 없는 명사 ${d.noun}`); continue; }
    try { const got = evalMath(d.expr, d.vars); const want = fn(d.parts.map((p) => evalMath(p, d.vars))); if (Math.abs(got - want) > 1e-6) issues.push(`'${d.noun}' 식 ${d.expr} 의 값 ${got} 이 규칙 값 ${want} 과 다름`); } catch (e) { issues.push(`'${d.noun}' 식 평가 실패: ${(e as Error).message}`); }
  }
  return issues;
}
/** 직사각형 둘레·넓이 선언을 만든다. L, Wd 는 변 길이 식(수식 문자열). */
export function rectSem(noun: "area" | "perimeter", L: string, Wd: string, vars: Record<string, number>): NonNullable<Instance["semantics"]>[number] {
  const expr = noun === "area" ? `(${L})(${Wd})` : `2((${L}) + (${Wd}))`;
  return { noun, expr, parts: [L, Wd], vars };
}

import type { Rng } from "../rng";
import { spin } from "../text";
/** 문항 앞에 붙이는 한 문장 상황 설정(수식·정답과 무관한 서술). 슬롯 5개 × 7~9개 대안이라 같은 원형에서도 본문이 서로 다르게 읽힌다(유사도 0.6 미만 변형 공급용). */
export function lead(rng: Rng): string {
  return spin(rng, "[[Today,|During tutoring,|As part of a unit review,|In a practice session,|Last week,|For extra practice,|At the start of class,]] [[a math teacher|a tutor|a student|a club advisor|a study group|a quiz writer|a textbook author|an instructor|a teaching assistant]] [[is reviewing|is preparing|is checking|is working through|is writing up|is grading|is revising|is presenting]] [[a practice problem|a homework item|a quiz question|a review exercise|a worksheet problem|an old test item|a warm-up question]] [[for the class|with a partner|before an exam|for a math contest|during a study session|at the whiteboard|for a unit review]] [[and wants to see a clean solution.|and hopes to explain it clearly.|and wonders which method is fastest.|and plans to post the answer later.|and is unsure where to begin.|and tries a different approach.|and wants to double-check the result.]]");
}
import { finish as finishBase } from "../text";
import type { Draft } from "../text";
export type DraftA = Draft & { semantics?: Instance["semantics"] };
/** 상황 설정 문장을 앞에 붙여 조립하고, 명사-수식 선언(semantics)이 있으면 결과에 싣는다. */
export function finishA(rng: Rng, d: DraftA): Instance {
  const { semantics, ...rest } = d; const inst = finishBase(rng, withLead(rng, rest));
  return semantics ? { ...inst, semantics } : inst;
}
export const withLead = <D extends { stimulus: string }>(rng: Rng, d: D): D => ({ ...d, stimulus: `${lead(rng)} ${d.stimulus}` });
