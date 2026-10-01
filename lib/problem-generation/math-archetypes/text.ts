// 원형 공용 조립 도구 — 선지 구성(오답 후보 중복 제거·셔플)·수식 문자열·분수·해설 조립.
import type { DistractorKind } from "../review";
import type { Rng } from "./rng";
import { gcd } from "./rng";
import { GenFail, type Instance } from "./types";
import { evalMath } from "./verify";

export const fmtNum = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
/** 기약분수 문자열("3/10", 정수면 "3"). */
export function frac(n: number, d: number): string {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d); n /= g; d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}
export const fracVal = (n: number, d: number) => n / d;
/** 계수 붙은 항: term(3,"x") -> "3x", term(-1,"x") -> "-x". */
export function term(c: number, v: string): string { return c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`; }
/** a v + b 형태("2x + 3", "x - 4", "-x"). 0 계수는 생략. */
export function lin(a: number, b: number, v = "x"): string {
  if (a === 0) return String(b);
  const head = term(a, v);
  if (b === 0) return head;
  return `${head} ${b > 0 ? "+" : "-"} ${Math.abs(b)}`;
}
/** 다항식 계수(고차→저차)를 "ax^2 + bx + c" 로. 지수는 ^ 표기(수식 환경 안에서 쓴다). */
export function poly(coefs: number[], v = "x"): string {
  const deg = coefs.length - 1; let out = "";
  coefs.forEach((c, i) => {
    if (c === 0) return;
    const p = deg - i; const abs = Math.abs(c);
    const body = p === 0 ? String(abs) : `${abs === 1 ? "" : abs}${v}${p === 1 ? "" : `^${p}`}`;
    out += out === "" ? (c < 0 ? `-${body}` : body) : ` ${c < 0 ? "-" : "+"} ${body}`;
  });
  return out === "" ? "0" : out;
}
export const M = (s: string) => `$${s}$`;
/** (x + k) / (x - k) / x */
export function shifted(v: string, k: number): string { return k === 0 ? v : `${v} ${k > 0 ? "+" : "-"} ${Math.abs(k)}`; }

export type Wrong = { v: number; kind: DistractorKind; reason: string };
export type TextWrong = { text: string; kind: DistractorKind; reason: string };
export type Draft = {
  stimulus: string; question: string;
  /** 숫자형 정답 — fmt 로 문자열화. */
  correct?: number; wrongs?: Wrong[]; fmt?: (v: number) => string;
  /** 식형 정답(수식 문자열) — evalAt 필요. */
  correctText?: string; wrongTexts?: TextWrong[]; evalAt?: Record<string, number>;
  /** 식형 선지 값의 허용 구간(열린 구간) — 확률은 (0,1). */
  range?: [number, number];
  verificationJs: string;
  /** 풀이 단계 [한국어, English] */
  trace: [string, string][];
  variant: string;
};

/** 오답 후보에서 3개를 골라 선지 4개(정답 포함)를 만들고 셔플한다. 후보가 3개 미만이면 GenFail(시드 건너뜀). */
export function finish(rng: Rng, d: Draft): Instance {
  const numeric = d.correct !== undefined;
  const intAnswer = numeric && Number.isInteger(d.correct!);
  const fmt = d.fmt ?? fmtNum;
  const correctText = numeric ? fmt(d.correct!) : d.correctText!;
  const seen = new Set<string>([correctText.trim()]);
  const picked: { text: string; kind: DistractorKind; reason: string }[] = [];
  const cands: { text: string; kind: DistractorKind; reason: string }[] = numeric
    ? (d.wrongs ?? []).filter((w) => Number.isFinite(w.v) && Math.abs(w.v) < 10000 && (!intAnswer || Number.isInteger(w.v))).map((w) => ({ text: fmt(w.v), kind: w.kind, reason: w.reason }))
    : (d.wrongTexts ?? []);
  // 식형 선지는 검사 지점에서 값이 정답·다른 오답과 같아지는 후보를 미리 거른다(같은 값이면 채점상 겹침).
  const valOf = (t: string) => { try { return evalMath(t, d.evalAt ?? {}); } catch { return NaN; } };
  const taken: number[] = numeric ? [] : [valOf(correctText)];
  for (const c of cands) {
    if (picked.length >= 3) break;
    if (seen.has(c.text.trim())) continue;
    if (!numeric) { const v = valOf(c.text); if (!Number.isFinite(v) || taken.some((t) => Math.abs(t - v) <= 1e-6)) continue; if (d.range && !(v > d.range[0] && v < d.range[1])) continue; taken.push(v); }
    seen.add(c.text.trim()); picked.push(c);
  }
  if (picked.length < 3) throw new GenFail("오답 후보 부족");
  const all = [{ text: correctText, right: true, kind: "other" as DistractorKind, reason: "" }, ...picked.map((p) => ({ text: p.text, right: false, kind: p.kind, reason: p.reason }))];
  const order = rng.shuffle(all);
  const explanation = `${d.trace.map(([ko], i) => `(${i + 1}) ${ko}`).join(" ")} 따라서 정답은 ${correctText}이다.`;
  const explanationEn = `${d.trace.map(([, en], i) => `(${i + 1}) ${en}`).join(" ")} So the answer is ${correctText}.`;
  return {
    stimulus: sentenceCase(d.stimulus), question: sentenceCase(d.question), options: order.map((o) => o.text), correctIndex: order.findIndex((o) => o.right),
    evalAt: d.evalAt, explanation, explanationEn, verificationJs: d.verificationJs, trace: d.trace.map(([ko]) => ko), variant: d.variant,
    distractors: order.map((o, i) => ({ o, i })).filter(({ o }) => !o.right).map(({ o, i }) => ({ index: i, kind: o.kind, reason: o.reason })),
  };
}
/** 외부 입력 없는 verificationJs 본문에 리터럴 상수를 박는다: `const P = {...};` */
export const withParams = (params: Record<string, number | string | number[]>, body: string) => `const P = ${JSON.stringify(params)};\n${body}`;

/** `[[a|b|c]]` 선택지 중 하나를 고른다(안쪽 [[ ]] 중첩 허용). 같은 원형의 본문을 표현만 달리해 유사도 0.6 미만 변형을 늘리는 용도. */
export function spin(rng: Rng, template: string): string {
  let s = template;
  for (let i = 0; i < 20; i++) {
    const t = s.replace(/\[\[([^[\]]*)\]\]/g, (_, body: string) => rng.pick(body.split("|")));
    if (t === s) break;
    s = t;
  }
  return s;
}
/** 문장 첫 글자를 대문자로. */
export const cap = (s: string) => s.replace(/^(\s*)([a-z])/, (_, sp: string, c: string) => sp + c.toUpperCase());

/** 수식($...$) 밖에서 문장 첫 글자·". " 뒤 글자를 대문자로, 구두점 앞 공백·이중 공백을 정리한다. */
export function sentenceCase(text: string): string {
  const parts = text.split("$");
  let atStart = true;
  return parts.map((seg, i) => {
    if (i % 2 === 1) { atStart = false; return seg; }
    let t = seg.replace(/ +([,.;?!])/g, "$1").replace(/ {2,}/g, " ");
    t = t.replace(/(^|[.?!]\s+|\n\s*)([a-z])/g, (m, pre: string, c: string) => (pre === "" && !atStart ? m : pre + c.toUpperCase()));
    atStart = /[.?!]\s*$/.test(t) || t.endsWith("\n");
    return t;
  }).join("$");
}
/** 음수는 괄호로 감싼 수 문자열(해설용). */
export const pn = (n: number) => (n < 0 ? `(${n})` : String(n));

/** 사실 문장 묶음: 각 묶음은 같은 사실의 표현 대안들. 묶음마다 하나씩 고르고, shuffleIdx 가 있으면 그 묶음들만 순서를 섞는다. */
export function facts(rng: Rng, groups: string[][], shuffleIdx: number[] = []): string {
  const picked = groups.map((g) => rng.pick(g));
  if (shuffleIdx.length > 1) { const vals = rng.shuffle(shuffleIdx.map((i) => picked[i])); shuffleIdx.forEach((i, k) => { picked[i] = vals[k]; }); }
  return picked.join(" ");
}

/** 부정관사: an("island") -> "an island", an("map") -> "a map". */
export const an = (noun: string) => (/^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`);
/** 1 이면 단수형 단위("1 inch"), 아니면 복수형 그대로("2 inches"). unit 은 복수형으로 넘긴다. */
export const pl = (n: number, unit: string) => `${n} ${n === 1 ? unit.replace(/ies$/, "y").replace(/ches$/, "ch").replace(/s$/, "") : unit}`;
