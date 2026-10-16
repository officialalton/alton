import { un } from "../cg-kit";
// circles.circle_equation_complete_square.CG.C — 전개형 x² + y² + Dx + Ey + F = 0 (또는 묶은 꼴·평행이동·반지름 조건)을 완전제곱식으로 바꿔 맞는 원 그래프를 4개 중에서 고른다.
// 오답 규칙: sign_both·sign_h·sign_k(중심의 부호 오독)·no_halving(계수를 절반 하지 않음)·swap_hk·radius(F 를 반지름으로 오독) 등.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { retry } from "../ext-kit";
import { CC_JS, SPR_NO_CG, cgcIntro, centerRulesDiag, circChoices, type CenterRule } from "../cgc-kit";

const Q = (rng: Rng) => rng.pick(["Which graph shows this circle?", "Which of the following graphs matches the equation?", "Which figure is the graph of the circle described?", "Which graph is consistent with this description?"]);
const term = (c: number, v: string, first = false) => (c === 0 ? "" : `${first ? (c < 0 ? "-" : "") : c < 0 ? " - " : " + "}${Math.abs(c) === 1 ? "" : Math.abs(c)}${v}`);
const eqTex = (D: number, E: number, F: number) => `$x^2 + y^2${term(D, "x")}${term(E, "y")}${F === 0 ? "" : F < 0 ? ` - ${-F}` : ` + ${F}`} = 0$`;
const grpTex = (D: number, E: number, c: number) => `$x^2${term(D, "x")} + y^2${term(E, "y")} = ${c}$`;
type Sc = { h: number; k: number; r: number; D: number; E: number; F: number };
const scene = (rng: Rng, o: { yZero?: boolean } = {}): Sc => { for (let i = 0; i < 80; i++) { const h = rng.int(-4, 4), k = o.yZero ? 0 : rng.int(-4, 4), r = rng.int(2, 5); if (h === 0 || (!o.yZero && (k === 0 || Math.abs(h) === Math.abs(k)))) continue; const F = h * h + k * k - r * r; if (F >= 0 && !o.yZero) continue; if (F === 0) continue; return { h, k, r, D: -2 * h, E: -2 * k, F }; } throw new GenFail("원 장면"); };
const RULES: CenterRule[] = [
  { name: "sign_both", ts: (p) => [p.D / 2, p.E / 2], js: "[P.D/2, P.E/2]" }, { name: "sign_h", ts: (p) => [p.D / 2, -p.E / 2], js: "[P.D/2, -P.E/2]" }, { name: "sign_k", ts: (p) => [-p.D / 2, p.E / 2], js: "[-P.D/2, P.E/2]" },
  { name: "no_halving", ts: (p) => [-p.D, -p.E], js: "[-P.D, -P.E]" }, { name: "swap_hk", ts: (p) => [-p.E / 2, -p.D / 2], js: "[-P.E/2, -P.D/2]" },
];
function build(rng: Rng, s: Sc, ok: [number, number], P: Record<string, number>, pred: string, stim: string, trace: [string, string][], variant: string, rules = RULES) {
  const cands = [...rules.map((q) => ({ c: q.ts(P), r: s.r })), { c: ok, r: Math.round(Math.sqrt(Math.abs(s.F)) * 100) / 100 }, { c: ok, r: s.r + 1 }].filter((q) => q.r > 0);
  const diag = centerRulesDiag(rules);
  const { choices, correctIndex, rules: rr } = circChoices(rng, { c: ok, r: s.r }, cands, P, pred, diag);
  return guard(choiceInst(rng, { stimulus: cgcIntro(rng, stim), question: Q(rng), choices, correctIndex, rules: rr, P, predicateJs: `${CC_JS}${pred}`, diagnoseJs: `${CC_JS}${diag}`, trace, variant, explainKo: "", explainEn: "" }));
}
const one = (f: (rng: Rng) => ReturnType<typeof build>) => (rng: Rng) => retry(rng, () => f(rng), 24);
const PRED = "const a=K(c); return a.h===-P.D/2&&a.k===-P.E/2&&Math.abs(a.r*a.r-(P.D*P.D/4+P.E*P.E/4-P.F))<1e-9;";
const FR = (rng: Rng, e: string) => rng.pick([`The equation of a circle is ${e}.`, `A circle is described by ${e}.`, `Consider the circle ${e}.`, `The graph of ${e} is a circle.`, `A circle in the $xy$-plane satisfies ${e}.`, `Let the circle be given by ${e}.`, `One circle is defined by ${e}.`]);
const TRC = (s: Sc): [string, string][] => [[`x 항과 y 항을 각각 완전제곱식으로 만든다: (x − ${s.h})² + (y − ${s.k})² = ${s.h * s.h} + ${s.k * s.k} − (${s.F}) 이다.`, "Complete the square in x and in y."], [`중심은 (${-s.D / 2}, ${-s.E / 2}) 이다.`, "The center is half the coefficients, with opposite signs."], [`r² = ${s.h * s.h + s.k * s.k - s.F} 이므로 r = ${s.r} 이다.`, "The radius."], [`이 중심과 반지름을 가진 원을 고른다.`, "Look for that center and radius."], [`부호를 반대로 읽은 그림, 계수를 절반 하지 않은 그림, 반지름이 다른 그림은 오답이다.`, "Sign errors, a missing halving, and other radii are wrong."]];

const RAW = defineItem({
  prefix: "av", itemId: "circles.circle_equation_complete_square.CG.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_CG, structure: "전개형 x² + y² + Dx + Ey + F = 0 을 완전제곱식으로 바꿔 중심 (−D/2, −E/2) 과 r² 을 구해 그래프를 고름", extra: "계수를 절반 하고 부호를 바꿔 중심을 구하며 r² 에 보정항을 더해야 함(절반을 하지 않거나 F 를 반지름으로 읽으면 오답) — medium 은 y 항이 없는 식", concepts: ["원의 방정식", "완전제곱식", "그래프 읽기"],
      gen: one((rng) => { const s = scene(rng); return build(rng, s, [s.h, s.k], { D: s.D, E: s.E, F: s.F }, PRED, FR(rng, eqTex(s.D, s.E, s.F)), TRC(s), "circle_cs_choice_expanded"); }) },
    { op: "chain2", sprNo: SPR_NO_CG, structure: "전개형으로 주어진 원을 완전제곱식으로 바꿔 중심을 구한 뒤 오른쪽·위로 평행이동한 상의 그래프를 고름", extra: "중심을 구한 뒤 이동량을 더해야 함(이동 전 원을 고르거나 부호를 반대로 읽으면 오답) — medium 은 이동 없음", concepts: ["원의 방정식", "완전제곱식", "평행이동"],
      gen: one((rng) => { const s = scene(rng); const dx = rng.int(1, 3), dy = rng.int(1, 3); const ok: [number, number] = [s.h + dx, s.k + dy]; if (ok[0] === 0 || ok[1] === 0 || Math.abs(ok[0]) + s.r > 9 || Math.abs(ok[1]) + s.r > 9) throw new GenFail("범위");
        const rules: CenterRule[] = [{ name: "not_moved", ts: (p) => [-p.D / 2, -p.E / 2], js: "[-P.D/2, -P.E/2]" }, { name: "sign_both", ts: (p) => [p.D / 2 + p.dx, p.E / 2 + p.dy], js: "[P.D/2+P.dx, P.E/2+P.dy]" }, { name: "dx_reversed", ts: (p) => [-p.D / 2 - p.dx, -p.E / 2 + p.dy], js: "[-P.D/2-P.dx, -P.E/2+P.dy]" }, { name: "no_halving", ts: (p) => [-p.D + p.dx, -p.E + p.dy], js: "[-P.D+P.dx, -P.E+P.dy]" }, { name: "swap_hk", ts: (p) => [-p.E / 2 + p.dx, -p.D / 2 + p.dy], js: "[-P.E/2+P.dx, -P.D/2+P.dy]" }];
        return build(rng, s, ok, { D: s.D, E: s.E, F: s.F, dx, dy }, "const a=K(c); return a.h===-P.D/2+P.dx&&a.k===-P.E/2+P.dy&&Math.abs(a.r*a.r-(P.D*P.D/4+P.E*P.E/4-P.F))<1e-9;", `${FR(rng, eqTex(s.D, s.E, s.F))} The circle is then translated ${un(dx)} to the right and ${un(dy)} up.`, [[`완전제곱식으로 바꾸면 중심은 (${s.h}, ${s.k}), 반지름은 ${s.r} 이다.`, "Complete the square."], [`오른쪽으로 ${dx}, 위로 ${dy} 이동한다.`, "Apply the shift."], [`상의 중심 = (${ok[0]}, ${ok[1]}) 이다.`, "The image center."], [`반지름은 ${s.r} 로 그대로이다.`, "The radius is unchanged."], [`이 원을 고른다.`, "Pick the matching circle."]], "circle_cs_choice_translated", rules); }) },
    { op: "repr_shift", sprNo: SPR_NO_CG, structure: "x 항과 y 항을 묶어 상수를 오른쪽에 둔 식 x² + Dx + y² + Ey = c 를 완전제곱식으로 옮겨 그래프를 고름", extra: "양변에 (D/2)² + (E/2)² 을 더해 r² 을 구해야 함(c 를 r² 로 읽으면 오답) — medium 은 y 항이 없는 식", concepts: ["원의 방정식", "완전제곱식", "표현 바꾸기"],
      gen: one((rng) => { const s = scene(rng); const c = -s.F; return build(rng, s, [s.h, s.k], { D: s.D, E: s.E, F: s.F, c }, "const a=K(c); return a.h===-P.D/2&&a.k===-P.E/2&&Math.abs(a.r*a.r-(P.D*P.D/4+P.E*P.E/4+P.c))<1e-9;", FR(rng, grpTex(s.D, s.E, c)), [[`양변에 (${s.D}/2)² 과 (${s.E}/2)² 을 더해 x 와 y 를 완전제곱식으로 만든다.`, "Add the squared half-coefficients to both sides."], [`(x − ${s.h})² + (y − ${s.k})² = ${c} + ${s.h * s.h} + ${s.k * s.k} 이다.`, "The completed squares."], [`중심은 (${s.h}, ${s.k}) 이다.`, "The center."], [`r² = ${s.r * s.r} 이므로 r = ${s.r} 이다.`, "The radius."], [`이 원을 고른다.`, "Pick the matching circle."]], "circle_cs_choice_grouped"); }) },
    { op: "inverse", sprNo: SPR_NO_CG, structure: "상수항 F 를 모르고 반지름이 지문에 주어진 x² + y² + Dx + Ey + F = 0 에서 중심 (−D/2, −E/2) 만으로 그래프를 거꾸로 고름", extra: "계수에서 중심을 구하고 주어진 반지름을 써야 함(F 를 이용해 반지름을 다시 구하거나 부호를 바꾸면 오답) — medium 은 F 가 주어짐", concepts: ["원의 방정식", "완전제곱식", "역산"],
      gen: one((rng) => { const s = scene(rng); return build(rng, s, [s.h, s.k], { D: s.D, E: s.E, r: s.r }, "const a=K(c); return a.h===-P.D/2&&a.k===-P.E/2&&a.r===P.r;", rng.pick([`A circle with radius ${s.r} has the equation $x^2 + y^2${term(s.D, "x")}${term(s.E, "y")} + F = 0$, where $F$ is a constant.`, `For some constant $F$, the circle $x^2 + y^2${term(s.D, "x")}${term(s.E, "y")} + F = 0$ has a radius of ${s.r}.`, `The equation $x^2 + y^2${term(s.D, "x")}${term(s.E, "y")} + F = 0$ describes a circle whose radius is ${s.r}; $F$ is a constant.`, `A circle of radius ${s.r} satisfies $x^2 + y^2${term(s.D, "x")}${term(s.E, "y")} + F = 0$ for a constant $F$.`, `In the equation $x^2 + y^2${term(s.D, "x")}${term(s.E, "y")} + F = 0$, the constant $F$ is chosen so that the circle has radius ${s.r}.`, `A circle with a radius of ${s.r} can be written as $x^2 + y^2${term(s.D, "x")}${term(s.E, "y")} + F = 0$, where $F$ is unknown.`]), [[`x 와 y 의 계수에서 중심을 구한다: (${-s.D / 2}, ${-s.E / 2}) 이다.`, "The center from the coefficients."], [`반지름은 ${s.r} 로 주어진다.`, "The radius is given."], [`F 는 중심과 반지름으로 정해지므로 따로 구하지 않아도 된다.`, "F is determined by the center and radius."], [`중심이 이 위치이고 반지름이 ${s.r} 인 원을 고른다.`, "Look for that center and radius."], [`부호를 반대로 읽은 그림은 오답이다.`, "Sign errors are wrong."]], "circle_cs_choice_radius_given"); }) },
  ],
  em: [
    { lv: "easy", name: "x_only", sprNo: SPR_NO_CG, structure: "y 항이 없는 전개형을 완전제곱식으로 바꿔 그래프를 고름", extra: "easy: 중심이 x 축 위", concepts: ["원의 방정식", "완전제곱식"],
      gen: one((rng) => { const s = scene(rng, { yZero: true }); const rules = RULES.filter((q) => q.name !== "sign_k" && q.name !== "swap_hk").concat([{ name: "sign_y", ts: (p) => [-p.D / 2, p.D / 2], js: "[-P.D/2, P.D/2]" }]); return build(rng, s, [s.h, 0], { D: s.D, E: 0, F: s.F }, PRED, FR(rng, eqTex(s.D, 0, s.F)), [[`x 항만 완전제곱식으로 만든다.`, "Complete the square in x."], [`중심은 (${s.h}, 0), r² = ${s.r * s.r} 이다.`, "The center and r squared."], [`이 원을 고른다.`, "Pick the matching circle."]], "circle_cs_choice_easy", rules); }) },
    { lv: "medium", name: "expanded", sprNo: SPR_NO_CG, structure: "전개형의 원 그래프를 고름", extra: "medium: 완전제곱식", concepts: ["원의 방정식", "완전제곱식"],
      gen: one((rng) => { const s = scene(rng); return build(rng, s, [s.h, s.k], { D: s.D, E: s.E, F: s.F }, PRED, FR(rng, eqTex(s.D, s.E, s.F)), TRC(s).slice(0, 4), "circle_cs_choice_medium"); }) },
  ],
});
export const ITEM = RAW;
