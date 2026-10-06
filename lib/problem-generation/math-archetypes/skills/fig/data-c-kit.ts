// 자료 그래프 선택지형(C) 공용 키트 — 점도표·상자그림·히스토그램 4개 중 조건에 맞는 그림 하나 고르기.
// 오답 후보를 큰 무작위 풀에서 만들고, 같은 predicate·diagnose JS 를 TS 에서도 돌려 '진단되는 규칙'으로 라벨한다(검증기 figure-verify.checkChoiceInstance 와 같은 판정).
// 두 조건(A·B) 문항: A 만 틀림 / B 만 틀림 / 둘 다 틀림 — 세 규칙이 서로 달라 선택지가 서로 다른 함정을 가진다.
import { GenFail, type Instance } from "../../types";
import type { Rng } from "../../rng";
import { placeChoices } from "../../figure-kit";
import { choiceInst } from "../tvd-fig-choice";
import { jsFn } from "./items/_t8-kit";

export const SPR_NO_DATA_CHOICE = "선택지가 그림(자료 그래프) 4개이고 조건에 맞는 그림을 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
type Params = Record<string, number | string>;

/** stats: `(c) => { ...; return {...}; }` 의 본문. A·B: s(통계)·P 에 대한 JS 식. 규칙 이름은 [A만 틀림, B만 틀림, 둘 다 틀림]. */
export function twoCond(stats: string, A: string, B: string, rules: [string, string, string]) {
  const pre = `const s = ((c) => { ${stats} })(c);`;
  return {
    predicateJs: `${pre} return (${A}) && (${B});`,
    diagnoseJs: `${pre} const a = (${A}), b = (${B}); if (a && b) return null; if (b) return "${rules[0]}"; if (a) return "${rules[1]}"; return "${rules[2]}";`,
  };
}
/** 조건 하나: 통계 X(식)가 목표 T(식)와 같아야 한다. 틀린 그림은 방향·크기(가까움/멀리)로 구별: low_near·high_near·low_far·high_far. near 는 |X-T| ≤ near(식). */
export function oneCond(stats: string, X: string, T: string, near: string) {
  const pre = `const s = ((c) => { ${stats} })(c);`;
  return {
    predicateJs: `${pre} return Math.abs((${X}) - (${T})) < 1e-9;`,
    diagnoseJs: `${pre} const d = (${X}) - (${T}); if (Math.abs(d) < 1e-9) return null; const n = Math.abs(d) <= (${near}); return d < 0 ? (n ? "low_near" : "low_far") : (n ? "high_near" : "high_far");`,
  };
}

/** 풀(figure 후보)에서 정답이 아니고 조건을 만족하지 않으며 진단 규칙이 서로 다른 3개를 골라 4개 선택지로 배치한다. */
export function poolChoices(rng: Rng, o: { ok: unknown; pool: unknown[]; P: Params; predicateJs: string; diagnoseJs: string; sameAxis?: (f: unknown) => boolean }) {
  const pred = jsFn(["c", "i", "P"], o.predicateJs), diag = jsFn(["c", "ok", "P"], o.diagnoseJs);
  if (!pred(o.ok, 0, o.P)) throw new GenFail("정답 그림이 조건을 만족하지 않음");
  const seen = new Set<string>([JSON.stringify(o.ok)]); const byRule = new Map<string, unknown[]>();
  for (const f of o.pool) {
    const k = JSON.stringify(f); if (seen.has(k)) continue; seen.add(k); if (o.sameAxis && !o.sameAxis(f)) continue;
    if (pred(f, 0, o.P)) continue; const rule = diag(f, o.ok, o.P) as string | null; if (!rule) continue;
    byRule.set(rule, [...(byRule.get(rule) ?? []), f]);
  }
  const rules = rng.shuffle([...byRule.keys()]); if (rules.length < 3) throw new GenFail(`오답 규칙 부족(${rules.length})`);
  const picked = rules.slice(0, 3).map((r) => ({ fig: rng.pick(byRule.get(r)!), rule: r }));
  return placeChoices(rng, o.ok, picked);
}

export type CBuild = { stimulus: string; question: string; P: Params; predicateJs: string; diagnoseJs: string; trace: [string, string][]; variant: string };
/** 선택지형 인스턴스 — choices/correctIndex/rules 는 poolChoices 결과. */
export function cInst(rng: Rng, ch: { choices: unknown[]; correctIndex: number; rules: string[] }, d: CBuild, tail: [string, string]): Instance {
  return choiceInst(rng, { stimulus: d.stimulus, question: d.question, choices: ch.choices, correctIndex: ch.correctIndex, rules: ch.rules, P: d.P, predicateJs: d.predicateJs, diagnoseJs: d.diagnoseJs, trace: [...d.trace, tail], variant: d.variant, explainKo: "", explainEn: "" });
}
