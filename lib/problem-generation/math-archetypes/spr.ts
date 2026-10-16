// 수학 원형의 SPR(주관식 단답) 변형 — 같은 원형·같은 지문·같은 자료에서 선택지만 떼고 정답 목록(answers)으로 낸다.
//
// 정답 목록은 "정확한 표기만" 담는다(기약분수, 끝나는 소수, 끝나지 않는 소수는 그리드에 들어가는 최대 자릿수에서 절사·반올림).
// 주의: 기존 `math-compilers/spr-answer.ts` 의 sprFromAnswerText 는 소수 0~2자리로 반올림·절사한 값(예: 7/2 에 "4"·"3", 1/3 에 "0")까지
// 정답 목록에 넣어, 틀린 학생 답이 맞음으로 채점된다(2026-10-01 확인, docs/qa/2026-10-01-math-figure-pilot.md). 이 모듈은 그 경로를 쓰지 않는다.
// 같은 값의 다른 분수 표기(14/4 등)는 DB 함수 spr_answer_matches 가 숫자로 정규화해 받아 주므로 목록에 넣지 않는다.
import type { Archetype, Instance } from "./types";

export type Rational = { p: number; q: number };
const gcd = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

/** 부동소수 v 를 분모 ≤ maxDen 의 기약분수로(오차 1e-9). 안 되면 null. */
export function toRational(v: number, maxDen = 1000): Rational | null {
  if (!Number.isFinite(v)) return null;
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(v * q);
    if (Math.abs(p / q - v) < 1e-9) { const g = gcd(p, q); return { p: p / g, q: q / g }; }
  }
  return null;
}

/** 그리드 입력 길이 제한(checkContent 와 같은 정책): 양수 5자·음수 6자('-' 포함, '.'·'/' 포함). */
export const fitsGrid = (s: string) => /^-?\d+(?:\.\d+)?(?:\/\d+)?$/.test(s) && (s.startsWith("-") ? s.length <= 6 : s.length <= 5);

/** v 의 SPR 정답 목록. 그리드에 어떤 표기로도 못 넣으면 null. */
export function sprAnswerSet(v: number): string[] | null {
  const r = toRational(v); if (!r) return null;
  const neg = r.p < 0, ap = Math.abs(r.p), q = r.q, sign = neg ? "-" : "";
  const out: string[] = [];
  if (q === 1) { const s = `${sign}${ap}`; return fitsGrid(s) && s !== "-0" ? [s] : null; }
  const frac = `${sign}${ap}/${q}`; if (fitsGrid(frac)) out.push(frac);
  let t = q; while (t % 2 === 0) t /= 2; while (t % 5 === 0) t /= 5;
  const intPart = Math.floor(ap / q);
  const dec = (k: number, mode: "trunc" | "round") => {
    const scaled = ap * 10 ** k;
    const n = mode === "trunc" ? Math.floor(scaled / q + 1e-9) : Math.floor((2 * scaled + q) / (2 * q) + 1e-9);
    const ip = Math.floor(n / 10 ** k), fp = String(n - ip * 10 ** k).padStart(k, "0");
    return `${sign}${ip}.${fp}`;
  };
  if (t === 1) { // 끝나는 소수
    for (let k = 1; k <= 6; k++) if ((ap * 10 ** k) % q === 0) { const s = dec(k, "trunc"); if (fitsGrid(s)) out.push(s); break; }
  } else {
    const kmax = (neg ? 6 : 5) - sign.length - String(intPart).length - 1;
    if (kmax >= 1) for (const m of ["trunc", "round"] as const) { const s = dec(kmax, m); if (fitsGrid(s) && !out.includes(s)) out.push(s); }
  }
  return out.length ? out : null;
}

/** 정답 선지 텍스트가 '순수한 수'인가(π·문자·식이면 SPR 로 못 낸다). 수치를 돌려준다. */
export function plainNumberOf(text: string): number | null {
  let s = text.trim().replace(/\$/g, "").replace(/−/g, "-").replace(/,/g, "").replace(/%$/, "");
  for (let i = 0; i < 4; i++) s = s.replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, "$1/$2");
  if (!/^-?\d+(?:\.\d+)?(?:\/\d+)?$/.test(s)) return null;
  const [a, b] = s.split("/"); return b === undefined ? Number(a) : Number(a) / Number(b);
}

/** 질문이 선택지를 가리키는 말을 쓰는가 — 그러면 SPR 로 낼 수 없다. */
export const refersToOptions = (q: string) => /\bwhich of the following\b|\bwhich (?:one|option|choice|graph|table|scatterplot|statement)\b|\bchoices?\b|\bof the (?:four|following)\b/i.test(q);

export type SprConversion = { ok: true; inst: Instance } | { ok: false; why: string };
/** 수치형 mc 인스턴스 → SPR 인스턴스. 정답 값은 mc 선지가 아니라 verification_js 재계산값(verified)에서 만든다(선지 표기와 값이 어긋나면 변환 거부). */
export function toSprInstance(inst: Instance, verified: number): SprConversion {
  if (inst.answerKind === "index" || inst.choice) return { ok: false, why: "정답이 선택지 번호(선택지형·서술 선지)라 SPR 불가" };
  if (inst.evalAt) return { ok: false, why: "정답이 식(선지가 식)이라 SPR 불가" };
  if (refersToOptions(inst.question) || refersToOptions(inst.stimulus)) return { ok: false, why: "질문이 선택지를 가리킴" };
  const shown = plainNumberOf(inst.options[inst.correctIndex] ?? "");
  if (shown === null) return { ok: false, why: "정답 표기가 순수한 수가 아님(π·문자·식)" };
  if (Math.abs(shown - verified) > 1e-6 * Math.max(1, Math.abs(verified))) return { ok: false, why: "정답 표기와 재계산값이 다름" };
  const answers = sprAnswerSet(verified);
  if (!answers) return { ok: false, why: "정답이 그리드 형식(양수 5자·음수 6자)·분모 1000 이하 분수로 표현되지 않음" };
  const correctText = answers[0];
  const explanation = inst.explanation.replace(/ 따라서 정답은 .*이다\.$/, ` 따라서 정답은 ${correctText}이다.`);
  const explanationEn = inst.explanationEn.replace(/ So the answer is .*\.$/, ` So the answer is ${correctText}.`);
  return { ok: true, inst: { ...inst, format: "spr", options: [], correctIndex: -1, answers, distractors: [], explanation, explanationEn, variant: inst.variant } };
}

/** SPR 정답 목록 기계 검사: 재계산값에서 규칙대로 만든 목록과 정확히 같아야 한다(누락·손실 표기·불필요 표기 모두 실패). */
export function checkSprAnswers(answers: string[] | undefined, verified: number): string[] {
  const issues: string[] = [];
  if (!answers?.length) return ["SPR 정답 목록이 비어 있음"];
  for (const a of answers) if (!fitsGrid(a)) issues.push(`SPR 정답 '${a}' 이 그리드 형식(정수·소수·분수, 양수 5자·음수 6자)에 맞지 않음`);
  if (new Set(answers).size !== answers.length) issues.push("SPR 정답 목록에 중복 표기");
  const want = sprAnswerSet(verified);
  if (!want) issues.push(`재계산값 ${verified} 는 그리드로 표현 불가`);
  else if ([...want].sort().join("|") !== [...answers].sort().join("|")) issues.push(`SPR 정답 목록 [${answers.join(", ")}] ≠ 재계산값 ${verified} 에서 만든 목록 [${want.join(", ")}]`);
  return issues;
}

/** 25% 쿼터의 결정론적 배정: 한 (skill×난이도) 묶음에서 i 번째(1부터) 문항이 SPR 인가. 누적 SPR 수 = floor(i·q + 0.5)(반올림 half-up) — 4건→1, 10건→3, 100건→25, 1000건→250. */
export const sprSlot = (i: number, q = 0.25) => Math.floor(i * q + 0.5 + 1e-9) > Math.floor((i - 1) * q + 0.5 + 1e-9);
export const sprTarget = (n: number, q = 0.25) => Math.floor(n * q + 0.5 + 1e-9);

export type SprDecl = { capable: boolean; reason: string; declared: boolean };
export const sprDeclOf = (a: Archetype): SprDecl | null => (a.spr ? { ...a.spr, declared: true } : null);
