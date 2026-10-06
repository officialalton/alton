// lines_angles_triangles.parallel_lines_transversal_angles.P3.P — 평행선 세 개와 횡단선 하나가 만드는 각(대응·엇각·보각)을 식 라벨로 주고 x 와 다른 각을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { ANG_PARSE_JS, exprLabel } from "../tri-kit";
import { TAILS } from "../sx-kit";

type Reg = "NE" | "NW" | "SE" | "SW";
const REGS: Reg[] = ["NE", "NW", "SE", "SW"];
const cls = (r: Reg) => (r === "NE" || r === "SW" ? 0 : 1);
const val = (r: Reg, a: number) => (cls(r) === 0 ? a : 180 - a);
const posW = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && w.v < 1000 && Number.isFinite(w.v));
const NAMES: [string, string, string, string][] = [["j", "k", "l", "t"], ["p", "q", "r", "s"], ["a", "b", "c", "w"], ["m", "n", "o", "u"], ["f", "g", "h", "t"], ["x1", "x2", "x3", "z"]].filter((q) => q[0] !== "x1") as [string, string, string, string][];
const INTROS = [
  "In the figure shown, lines {A}, {B}, and {C} are parallel, and line {T} crosses all three of them.",
  "Three parallel lines, {A}, {B}, and {C}, are cut by the line {T}, as shown in the figure.",
  "The figure shows parallel lines {A}, {B}, and {C} and a transversal {T} that intersects each of them.",
  "Line {T} intersects the three parallel lines {A}, {B}, and {C} shown in the figure. Some angle measures are labeled in degrees.",
  "Lines {A}, {B}, and {C} in the figure are parallel to one another, and line {T} passes through all three.",
  "A straight line {T} crosses the parallel lines {A}, {B}, and {C} in the figure shown.",
];
const SEQ = ["", "A surveyor sketches roads on a map. ", "A student draws a diagram for a geometry quiz. ", "An engineer models three parallel pipes crossed by a cable. ", "A teacher posts the figure below. ", "A designer plans three parallel stripes cut by a ribbon. "];

type Sc = { names: [string, string, string, string]; alpha: number; x: number; i: number; j: number; k: number; R1: Reg; R2: Reg; R3: Reg; a1: number; b1: number; a2: number; b2: number; v1: number; v2: number; v3: number; same12: boolean };
function scene(rng: Rng, o: { same?: boolean } = {}): Sc {
  for (let t = 0; t < 400; t++) {
    const lines = rng.shuffle([0, 1, 2]); const [i, j, k] = lines; const R1 = rng.pick(REGS), R2 = rng.pick(REGS), R3 = rng.pick(REGS); if (R3 === R1 && k === i) continue; if (R2 === R1 && j === i) continue;
    const alpha = rng.pick([48, 52, 56, 62, 68, 72, 108, 112, 118, 124, 128, 132]); const same12 = cls(R1) === cls(R2); if (o.same !== undefined && same12 !== o.same) continue;
    const x = rng.int(5, 25); const a1 = rng.int(1, 5), a2 = rng.int(1, 5); if (a1 === a2) continue;
    const v1 = val(R1, alpha), v2 = val(R2, alpha); const b1 = v1 - a1 * x, b2 = v2 - a2 * x; if (Math.abs(b1) > 60 || Math.abs(b2) > 60 || a1 * x + b1 !== v1) continue;
    const eq = same12 ? a1 !== a2 : true; if (!eq) continue; const sol = same12 ? (b2 - b1) / (a1 - a2) : (180 - b1 - b2) / (a1 + a2); if (Math.abs(sol - x) > 1e-9) continue;
    if (v1 < 25 || v1 > 155 || v2 < 25 || v2 > 155) continue; return { names: rng.pick(NAMES), alpha, x, i, j, k, R1, R2, R3, a1, b1, a2, b2, v1, v2, v3: val(R3, alpha), same12 };
  }
  throw new GenFail("평행선 3 장면 표집 실패");
}
const fig = (s: Sc, l1: string, l2: string, l3: string) => ({ type: "parallel_three" as const, lines: [s.names[0], s.names[1], s.names[2]] as [string, string, string], transversal: s.names[3], angle: s.alpha, notToScale: true, labels: [{ line: s.i as 0 | 1 | 2, region: s.R1, label: l1 }, { line: s.j as 0 | 1 | 2, region: s.R2, label: l2 }, { line: s.k as 0 | 1 | 2, region: s.R3, label: l3 }] });
const intro = (rng: Rng, s: Sc, extra = "") => `${rng.pick(SEQ)}${rng.pick(INTROS).replace("{A}", `$${s.names[0]}$`).replace("{B}", `$${s.names[1]}$`).replace("{C}", `$${s.names[2]}$`).replace("{T}", `$${s.names[3]}$`)} ${rng.pick(TAILS)}${extra}`;
const SOLVE_JS = `${ANG_PARSE_JS}if (!FIGURE||FIGURE.type!=='parallel_three') throw new Error('평행선 자료 필요'); const LB=FIGURE.labels; if (LB.length!==3) throw new Error('라벨 셋 필요'); const cl=(r)=>(r==='NE'||r==='SW')?0:1; const E=LB.map(q=>{ try { return parseAng(q.label); } catch(e) { return null; } });
const solveX=(p,q)=>{ if (!p||!q) throw new Error('식 라벨 필요'); const same=cl(LB[0].region)===cl(LB[1].region); const num=same?(q.b-p.b):(180-p.b-q.b), den=same?(p.a-q.a):(p.a+q.a); if (den===0) throw new Error('해 없음'); return num/den; };
`;
const eqT = (s: Sc) => (s.same12 ? `${exprLabel(s.a1, s.b1)} = ${exprLabel(s.a2, s.b2)}` : `${exprLabel(s.a1, s.b1)} + ${exprLabel(s.a2, s.b2)} = 180°`);
const rdl = (s: Sc): [string, string] => [`그림에서 두 식 각 ${exprLabel(s.a1, s.b1)}, ${exprLabel(s.a2, s.b2)} 와 y° 라벨을 읽는다.`, "Read the labeled angles."];
const relStep = (s: Sc): [string, string] => [`평행선이므로 두 각은 ${s.same12 ? "대응각·엇각으로 크기가 같다" : "보각(합이 180°)이다"}: ${eqT(s)} 에서 x = ${s.x} 이다.`, s.same12 ? "Corresponding or alternate angles are equal." : "These angles are supplementary."];
const yStep = (s: Sc): [string, string] => [`y° 는 ${cls(s.R3) === cls(s.R1) ? "첫 각과 같은 크기" : "첫 각의 보각"}이므로 y = ${s.v3} 이다.`, "Relate y to the first angle."];
const base = { A1: 1 };
void base;

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.parallel_lines_transversal_angles.P3.P",
  hard: [
    {
      op: "chain2", structure: "평행선 세 개와 횡단선에서 두 식 각의 관계(같음 또는 보각)로 x 를 구한 뒤 다른 평행선의 각 y 를 구함", extra: "대응·엇각·동측내각 관계를 구분해 x 를 구하고 y 가 어느 각과 같은지/보각인지 다시 따져야 함(x 를 답하거나 y 를 첫 각과 같다고 보는 함정) — medium 은 숫자 각",
      concepts: ["평행선과 각", "횡단선", "일차방정식"],
      gen(rng) {
        const s = scene(rng); const f = fig(s, exprLabel(s.a1, s.b1), exprLabel(s.a2, s.b2), "y°");
        return gInst(rng, {
          stimulus: intro(rng, s), question: rng.pick(["What is the value of $y$?", "What is $y$?"]), correct: s.v3,
          wrongs: posW([W(s.x, "step_missing", "x 를 답했다."), W(180 - s.v3, "formula_misuse", "같음과 보각을 바꿨다."), W(s.v1, "step_missing", "첫 식의 각 크기를 답했다."), W(s.v2, "step_missing", "둘째 식의 각 크기를 답했다."), W(s.v3 + 10, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${SOLVE_JS}const x=solveX(E[0],E[1]); if (!Number.isInteger(x)||x<=0) throw new Error('x 해석 불가'); const v1=E[0].a*x+E[0].b, v2=E[1].a*x+E[1].b; if (!(v1>0&&v1<180&&v2>0&&v2<180)) throw new Error('각 범위'); return cl(LB[2].region)===cl(LB[0].region)?v1:180-v1;`),
          trace: [rdl(s), relStep(s), [`첫 식의 각 = ${exprLabel(s.a1, 0).replace("°", "")}×${s.x}${s.b1 < 0 ? "-" : "+"}${Math.abs(s.b1)} = ${s.v1}° 이다.`, "Evaluate the first angle."], yStep(s), [`따라서 ${s.v3} 이다.`, "State y."]], variant: s.same12 ? "y_from_equal_angles" : "y_from_supplementary_angles",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "두 식 각의 관계로 x 를 구한 뒤 x + y 를 구함", extra: "x 와 y 를 각각 구해 더해야 함(한 값만 답하는 함정) — medium 은 y",
      concepts: ["평행선과 각", "횡단선", "일차방정식"],
      gen(rng) {
        const s = scene(rng); const f = fig(s, exprLabel(s.a1, s.b1), exprLabel(s.a2, s.b2), "y°");
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the value of $x + y$?`, correct: s.x + s.v3,
          wrongs: posW([W(s.x, "step_missing", "x 만 답했다."), W(s.v3, "step_missing", "y 만 답했다."), W(s.x + 180 - s.v3, "formula_misuse", "y 의 관계를 잘못 잡았다."), W(s.v1 + s.v3, "other", "각 크기를 더했다."), W(s.x + s.v3 + 10, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${SOLVE_JS}const x=solveX(E[0],E[1]); if (!Number.isInteger(x)||x<=0) throw new Error('x 해석 불가'); const v1=E[0].a*x+E[0].b; const y=cl(LB[2].region)===cl(LB[0].region)?v1:180-v1; return x+y;`),
          trace: [rdl(s), relStep(s), yStep(s), [`x + y = ${s.x} + ${s.v3} = ${s.x + s.v3} 이다.`, "Add."], [`따라서 ${s.x + s.v3} 이다.`, "State the sum."]], variant: "x_plus_y",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "두 식 각에서 x 를 구해 y 와 첫 식 각의 차를 구함", extra: "각을 각각 구해 큰 쪽에서 작은 쪽을 빼야 함(같은 각이라 0 이라 생각하는 함정) — medium 은 한 각",
      concepts: ["평행선과 각", "보각", "두 각 비교"],
      gen(rng) {
        const s = scene(rng); if (s.v3 === s.v1) throw new GenFail("차 0"); const d = Math.abs(s.v3 - s.v1); const f = fig(s, exprLabel(s.a1, s.b1), exprLabel(s.a2, s.b2), "y°");
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the positive difference between the measure of the angle marked $y^\\circ$ and the measure of the angle marked ${exprLabel(s.a1, s.b1).replace(/°/g, "^\\circ")}?`.replace(/\(([^)]*)\)\^\\circ/, "$($1)^\\circ$").replace("angle marked $y^\\circ$", "angle marked $y^\\circ$"), correct: d,
          wrongs: posW([W(s.v3, "step_missing", "y 만 답했다."), W(s.v1, "step_missing", "첫 각만 답했다."), W(s.v1 + s.v3, "sign_error", "합을 구했다."), W(s.x, "step_missing", "x 를 답했다."), W(d + 10, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${SOLVE_JS}const x=solveX(E[0],E[1]); if (!Number.isInteger(x)||x<=0) throw new Error('x 해석 불가'); const v1=E[0].a*x+E[0].b; const y=cl(LB[2].region)===cl(LB[0].region)?v1:180-v1; return Math.abs(y-v1);`),
          trace: [rdl(s), relStep(s), [`첫 식의 각 = ${s.v1}° 이고 y = ${s.v3} 이다.`, "Both measures."], [`차 = |${s.v3} - ${s.v1}| = ${d} 이다.`, "Subtract."], [`따라서 ${d} 이다.`, "State the difference."]], variant: "angle_difference",
        }, f);
      },
    },
    {
      op: "inverse", structure: "한 각이 숫자로 주어지고 다른 평행선의 식 각에서 x 를 거꾸로 구함", extra: "숫자 각과 식 각의 관계(같음/보각)를 정해 방정식을 풀어야 함(관계를 잘못 잡는 함정) — medium 은 식 각 하나의 크기",
      concepts: ["평행선과 각", "방정식", "역산"],
      gen(rng) {
        const s = scene(rng); const f = fig(s, `${s.v1}°`, exprLabel(s.a2, s.b2), "y°");
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the value of $x$?`, correct: s.x,
          wrongs: posW([W((s.same12 ? s.v2 : 180 - s.v1) , "step_missing", "각의 크기를 답했다."), W(Math.round(((s.same12 ? 180 - s.v1 : s.v1) - s.b2) / s.a2 * 100) / 100, "formula_misuse", "같음과 보각을 바꿨다."), W(s.x + 1, "other", "계산이 어긋났다."), W(Math.round((s.v1 - s.b2) / s.a2 * 100) / 100 || s.x + 2, "formula_misuse", "항상 같다고 보았다."), W(s.v1, "step_missing", "숫자 각을 답했다.")]),
          verificationJs: figJs({}, f, `${ANG_PARSE_JS}if (!FIGURE||FIGURE.type!=='parallel_three') throw new Error('평행선 자료 필요'); const LB=FIGURE.labels; const cl=(r)=>(r==='NE'||r==='SW')?0:1; const p=parseAng(LB[0].label), q=parseAng(LB[1].label); if (p.a!==0||q.a===0) throw new Error('숫자 각·식 각 필요'); const same=cl(LB[0].region)===cl(LB[1].region); const target=same?p.b:180-p.b; const x=(target-q.b)/q.a; if (!Number.isInteger(x)||x<=0) throw new Error('x 해석 불가'); return x;`),
          trace: [[`그림에서 숫자 각 ${s.v1}° 와 식 각 ${exprLabel(s.a2, s.b2)} 를 읽는다.`, "Read the numeric and expression angles."], [`두 각은 ${s.same12 ? "크기가 같다" : "보각이다"}.`, "Decide the relationship."], [`${exprLabel(s.a2, s.b2)} = ${s.same12 ? s.v1 : 180 - s.v1}° 에서 x = ${s.x} 이다.`, "Solve for x."], [`검산: ${exprLabel(s.a2, s.b2).replace("x", `(${s.x})`)} = ${s.v2}° 이다.`, "Check the value."], [`따라서 ${s.x} 이다.`, "State x."]], variant: s.same12 ? "x_from_numeric_equal" : "x_from_numeric_supplementary",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "solve_x", structure: "두 식 각의 관계로 x 를 구함", extra: "easy: 일차방정식 한 번", concepts: ["평행선과 각", "일차방정식"],
      gen(rng) {
        const s = scene(rng); const f = fig(s, exprLabel(s.a1, s.b1), exprLabel(s.a2, s.b2), "y°");
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the value of $x$?`, correct: s.x,
          wrongs: posW([W(s.v1, "step_missing", "각의 크기를 답했다."), W(s.v3, "step_missing", "y 를 답했다."), W(s.x + 1, "other", "계산이 어긋났다."), W(Math.round(((s.same12 ? 180 - b1(s) : 0) + 0) / 1) || s.x + 3, "formula_misuse", "관계를 잘못 잡았다.")]),
          verificationJs: figJs({}, f, `${SOLVE_JS}const x=solveX(E[0],E[1]); if (!Number.isInteger(x)||x<=0) throw new Error('x 해석 불가'); return x;`),
          trace: [rdl(s), relStep(s)], variant: "easy_solve_x",
        }, f);
      },
    },
    {
      lv: "medium", name: "y_from_numeric", structure: "숫자로 주어진 한 각에서 다른 평행선의 각 y 를 구함", extra: "medium: 같음/보각 판정", concepts: ["평행선과 각"],
      gen(rng) {
        const s = scene(rng); const f = fig(s, `${s.v1}°`, exprLabel(s.a2, s.b2), "y°");
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the value of $y$?`, correct: s.v3,
          wrongs: posW([W(180 - s.v3, "formula_misuse", "같음과 보각을 바꿨다."), W(s.v1, "step_missing", "숫자 각을 답했다."), W(s.x, "axis_misread", "x 를 답했다."), W(s.v3 + 10, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${ANG_PARSE_JS}if (!FIGURE||FIGURE.type!=='parallel_three') throw new Error('평행선 자료 필요'); const LB=FIGURE.labels; const cl=(r)=>(r==='NE'||r==='SW')?0:1; const p=parseAng(LB[0].label); if (p.a!==0) throw new Error('숫자 각 필요'); return cl(LB[2].region)===cl(LB[0].region)?p.b:180-p.b;`),
          trace: [[`그림에서 숫자 각 ${s.v1}° 를 읽는다.`, "Read the numeric angle."], [`평행선이므로 같은 위치의 각은 같고, 같은 쪽의 이웃한 각은 보각이다.`, "Corresponding angles are equal; adjacent angles are supplementary."], yStep(s)], variant: "medium_y_from_numeric",
        }, f);
      },
    },
  ],
});
const b1 = (s: Sc) => s.b1;
