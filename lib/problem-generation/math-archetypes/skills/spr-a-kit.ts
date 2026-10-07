// SPR 공급(G10) 확충용 수치 원형 공용 도구 — 원형 하나가 서로 구조가 다른 변형 여러 개(Var)를 가진다. 변형 = 유사문항 그룹이다.
// 변형은 풀이 경로·묻는 양·장면이 달라야 한다(값 범위만 바꾼 복제 금지). 정답은 verification_js 가 지문에 인쇄된 수로 다시 계산한다.
import { GenFail, type Archetype, type OperatorId } from "../types";
import { finish, spin, withParams, type Wrong } from "../text";
import type { Rng } from "../rng";

export type Q = {
  s: string; q: string; a: number;
  /** 사용자 지정 오답 후보(앞에서부터 쓴다). 부족하면 자동 후보가 채운다. */
  w?: number[];
  p: Record<string, number | string | number[]>; js: string;
  /** 풀이 단계: "한국어||English" (한글이 없는 순수 계산은 한 문자열). */
  t: string[];
  fmt?: (v: number) => string;
};
export type Var = { name: string; gen(rng: Rng): Q };
export const need = (c: boolean, m = "조건 불충족") => { if (!c) throw new GenFail(m); };
export const isInt = Number.isInteger;
export const sp = spin;

const KINDS = ["formula_misuse", "step_missing", "condition_ignored", "other"] as const;
function cands(a: number, w: number[]): Wrong[] {
  const out: Wrong[] = []; const seen = new Set<number>([a]);
  const push = (v: number, i: number) => { if (!Number.isFinite(v) || seen.has(v) || Math.abs(v) >= 10000) return; if (a > 0 && v <= 0) return; if (isInt(a) && !isInt(v)) return; seen.add(v); out.push({ v, kind: KINDS[Math.min(i, 3)], reason: i < 2 ? "관련 수량을 잘못 결합해 얻은 값이다." : "계산 중 어긋난 값이다." }); };
  w.forEach((v, i) => push(v, i));
  const st = isInt(a) ? 1 : 0.5;
  [a * 2, a / 2, a + st, a - st, a + 2 * st, a - 2 * st, a + 10 * st, a - 10 * st, a * 3, a + 5 * st].forEach((v, i) => push(Math.round(v * 100) / 100, 2 + (i % 2)));
  return out;
}
export function build(rng: Rng, variant: string, q: Q) {
  need(q.t.length >= 5, "풀이 단계 5 미만");
  const trace = q.t.map((x) => (x.includes("||") ? (x.split("||") as [string, string]) : ([x, x] as [string, string])));
  return finish(rng, { stimulus: q.s, question: q.q, correct: q.a, fmt: q.fmt, wrongs: cands(q.a, q.w ?? []), verificationJs: withParams(q.p, q.js), trace, variant });
}
export type ArchSpec = { id: string; skill: string; kind: string; op: OperatorId; structure: string; extra: string; concepts: string[]; mediumSteps: number; vars: Var[] };
export function mkArch(o: ArchSpec): Archetype {
  return {
    id: `${o.id}.${o.op}`, skill: o.skill, kind: o.kind, operator: o.op, structure: o.structure, extraThinking: o.extra, concepts: o.concepts, mediumSteps: o.mediumSteps,
    spr: { capable: true, reason: "정답이 하나의 수이고 질문이 선택지를 가리키지 않아 선택지 없이 낼 수 있다" },
    generate(rng) { const v = rng.pick(o.vars); return build(rng, v.name, v.gen(rng)); },
  };
}
/** 한 kind 의 hard 원형 4개(서로 다른 연산자)를 만든다. vars 는 연산자별 변형 목록. */
export function mkKind(base: { id: string; skill: string; kind: string; concepts: string[]; mediumSteps: number }, ops: { op: OperatorId; structure: string; extra: string; vars: Var[] }[]): Archetype[] {
  return ops.map((o) => mkArch({ ...base, ...o }));
}
/** v 의 약수 중 [lo, hi] 안의 하나를 고른다(없으면 GenFail) — 나눗셈이 정수로 떨어지게 거꾸로 만들 때 쓴다. */
export function pickDiv(rng: Rng, v: number, lo: number, hi: number): number {
  const ds: number[] = []; for (let d = lo; d <= hi; d++) if (v % d === 0) ds.push(d);
  if (!ds.length) throw new GenFail("약수 없음"); return rng.pick(ds);
}
