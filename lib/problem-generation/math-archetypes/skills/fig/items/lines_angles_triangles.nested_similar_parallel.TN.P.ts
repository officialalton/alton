import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { frac } from "../../../text";
import { PAR_JS, ALT_JS, aOvl, altFig, lead, makeAltitude, makeParallel, nm, ovl, parallelFig, type AScene, type PScene } from "../tn-kit";
const posW = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));

const intro = (rng: Rng, s: PScene, extra = "") => lead(rng) + rng.pick([
  `In the figure shown, $\\overline{${s.D}${s.E}} \\parallel \\overline{${s.V[1]}${s.V[2]}}$ in triangle $${s.V.join("")}$, with $${s.D}$ on $\\overline{${s.V[0]}${s.V[1]}}$ and $${s.E}$ on $\\overline{${s.V[0]}${s.V[2]}}$. The figure is not drawn to scale.${extra}`,
  `Segment $\\overline{${s.D}${s.E}}$ cuts triangle $${s.V.join("")}$ into a smaller triangle $${s.V[0]}${s.D}${s.E}$ and a trapezoid $${s.D}${s.V[1]}${s.V[2]}${s.E}$, and it is parallel to $\\overline{${s.V[1]}${s.V[2]}}$, as shown.${extra}`,
  `The figure shows triangle $${s.V.join("")}$ with $\\overline{${s.D}${s.E}}$ parallel to the base $\\overline{${s.V[1]}${s.V[2]}}$. Triangle $${s.V[0]}${s.D}${s.E}$ is nested inside triangle $${s.V.join("")}$.${extra}`,
  `In the diagram, a line segment $\\overline{${s.D}${s.E}}$ parallel to $\\overline{${s.V[1]}${s.V[2]}}$ joins the sides $\\overline{${s.V[0]}${s.V[1]}}$ and $\\overline{${s.V[0]}${s.V[2]}}$ of triangle $${s.V.join("")}$.${extra}`,
]);
const trap = (s: PScene) => `trapezoid $${s.D}${s.V[1]}${s.V[2]}${s.E}$`;
const small = (s: PScene) => `triangle $${s.V[0]}${s.D}${s.E}$`;
const rdl = (what: string): [string, string] => [`그림에서 ${what} 길이 라벨을 읽는다.`, "Read the labeled lengths."];
const k2 = (s: PScene): [string, string] => [`닮음비 AB/AD = ${s.len.AB}/${s.len.AD} 이고 넓이의 비는 그 제곱이다.`, "Areas scale by the square of the ratio."];

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.nested_similar_parallel.TN.P",
  hard: [
    {
      op: "chain2", structure: "작은 삼각형의 넓이와 AD·DB 가 주어질 때 넓이의 비(닮음비의 제곱)로 큰 삼각형 넓이를 구하고 사다리꼴의 넓이를 구함", extra: "닮음비를 제곱해 큰 삼각형 넓이를 구한 뒤 작은 삼각형을 빼야 함(닮음비를 그대로 곱하거나 큰 삼각형 넓이를 답하는 함정) — medium 은 둘레",
      concepts: ["닮은 삼각형", "넓이의 비", "사다리꼴"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const t = rng.int(1, 3); const A1 = L.AD * L.AD * t; const A2 = L.AB * L.AB * t; const f = parallelFig(s, { AD: String(L.AD), DB: String(L.DB) });
        return gInst(rng, {
          stimulus: intro(rng, s, ` The area of ${small(s)} is ${A1} square units.`), question: `What is the area, in square units, of ${trap(s)}?`, correct: A2 - A1,
          wrongs: posW([W(A2, "step_missing", "큰 삼각형의 넓이를 답했다."), W((A1 * L.AB) / L.AD - A1, "formula_misuse", "닮음비를 제곱하지 않고 곱했다."), W(A1 * L.DB / L.AD, "formula_misuse", "DB/AD 로 넓이를 구했다."), W(A2 - A1 + L.AD, "other", "계산이 어긋났다."), W((A1 * L.DB * L.DB) / (L.AD * L.AD), "formula_misuse", "DB 의 비로 넓이를 구했다.")]),
          verificationJs: figJs({ A1 }, f, `${PAR_JS}const r=(L('AD')+L('DB'))/L('AD'); return P.A1*r*r-P.A1;`),
          trace: [rdl("AD, DB"), k2(s), [`삼각형 ABC 의 넓이 = ${A1} × (${L.AB}/${L.AD})² = ${A2} 이다.`, "Area of the whole triangle."], [`사다리꼴 = ${A2} - ${A1} = ${A2 - A1} 이다.`, "Subtract the small triangle."], [`따라서 ${A2 - A1} 이다.`, "State the area."]], variant: "trapezoid_area",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "AD·DB·DE·AE 로 BC·EC 를 닮음비로 구해 사다리꼴 DBCE 의 둘레를 구함", extra: "BC 와 EC 를 각각 구해 네 변을 모두 더해야 함(DE 나 한 변을 빠뜨리는 함정) — medium 은 둘레의 비",
      concepts: ["닮은 삼각형", "사다리꼴의 둘레", "닮음비"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const per = L.DB + L.BC + L.EC + L.DE; const f = parallelFig(s, { AD: String(L.AD), DB: String(L.DB), AE: String(L.AE), DE: String(L.DE) });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the perimeter of ${trap(s)}?`, correct: per,
          wrongs: posW([W(per - L.DE, "step_missing", "DE 를 빠뜨렸다."), W(L.DB + L.BC + L.EC, "step_missing", "DE 를 더하지 않았다."), W(L.AB + L.AC + L.BC, "geometry_misapplied", "큰 삼각형의 둘레를 답했다."), W(L.DB + L.AE + L.DE + L.BC, "other", "EC 대신 AE 를 더했다."), W(L.DB + L.DE + L.EC + L.DE, "other", "BC 대신 DE 를 더했다.")]),
          verificationJs: figJs({}, f, `${PAR_JS}const k=(L('AD')+L('DB'))/L('AD'); const bc=L('DE')*k, ec=L('AE')*L('DB')/L('AD'); return L('DB')+bc+ec+L('DE');`),
          trace: [rdl("AD, DB, AE, DE"), [`닮음비 AB/AD = ${L.AB}/${L.AD} 이므로 BC = ${L.DE} × ${L.AB}/${L.AD} = ${L.BC} 이다.`, "Scale DE to get BC."], [`EC = ${L.AE} × ${L.DB}/${L.AD} = ${L.EC} 이다.`, "Proportional segments."], [`둘레 = DB + BC + EC + DE = ${L.DB} + ${L.BC} + ${L.EC} + ${L.DE} = ${per} 이다.`, "Add the four sides."], [`따라서 ${per} 이다.`, "State the perimeter."]], variant: "trapezoid_perimeter",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "큰 삼각형 넓이가 작은 삼각형 넓이의 몇 배인지(닮음비의 제곱)를 구함", extra: "AB = AD + DB 로 닮음비를 구해 제곱해야 함(닮음비를 그대로 답하거나 DB/AD 를 쓰는 함정) — medium 은 닮음비",
      concepts: ["닮은 삼각형", "넓이의 비", "닮음비"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const f = parallelFig(s, { AD: String(L.AD), DB: String(L.DB) }); const num = L.AB * L.AB, den = L.AD * L.AD;
        return gInst(rng, {
          stimulus: intro(rng, s), question: `The area of triangle $${s.V.join("")}$ is how many times the area of ${small(s)}?`, correctText: frac(num, den), range: [0, 1000],
          wrongTexts: [{ text: frac(L.AB, L.AD), kind: "formula_misuse", reason: "닮음비를 제곱하지 않았다." }, { text: frac(L.DB * L.DB, den), kind: "formula_misuse", reason: "DB 로 비를 세웠다." }, { text: frac(L.DB, L.AD), kind: "formula_misuse", reason: "DB/AD 를 답했다." }, { text: frac(L.AD * L.AD, num), kind: "formula_misuse", reason: "비를 거꾸로 답했다." }],
          verificationJs: figJs({}, f, `${PAR_JS}const r=(L('AD')+L('DB'))/L('AD'); return r*r;`),
          trace: [rdl("AD, DB"), [`AB = ${L.AD} + ${L.DB} = ${L.AB} 이므로 닮음비 AB/AD = ${L.AB}/${L.AD} 이다.`, "Similarity ratio."], [`넓이의 비 = (${L.AB}/${L.AD})² 이다.`, "Square the ratio."], [`= ${frac(num, den)} 이다.`, "Simplify."], [`따라서 ${frac(num, den)} 배이다.`, "State the ratio."]], variant: "area_ratio_times",
        }, f);
      },
    },
    {
      op: "inverse", structure: "두 삼각형의 넓이가 주어지고 DB 가 x 로 가려질 때 넓이의 비로 닮음비를 구해 x 를 구함", extra: "넓이의 비의 제곱근이 닮음비임을 써서 (AD + x)/AD 를 세워야 함(넓이의 비를 그대로 닮음비로 쓰는 함정) — medium 은 넓이의 비",
      concepts: ["닮은 삼각형", "넓이의 비", "역산"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const g = L.AD / gcdI(L.AD, L.AB); const m = g, n = (L.AB / L.AD) * g; const t = rng.int(1, 3); const A1 = t * m * m, A2 = t * n * n; const f = parallelFig(s, { AD: String(L.AD), DB: "x" });
        return gInst(rng, {
          stimulus: intro(rng, s, ` The area of ${small(s)} is ${A1} square units, and the area of triangle $${s.V.join("")}$ is ${A2} square units.`), question: `What is the value of $x$?`, correct: L.DB,
          wrongs: posW([W((L.AD * A2) / A1 - L.AD, "formula_misuse", "넓이의 비를 닮음비로 썼다."), W(L.AB, "step_missing", "AB 를 답했다."), W(L.AD, "step_missing", "AD 를 답했다."), W(L.DB + 1, "other", "계산이 어긋났다."), W(Math.round((L.AD * Math.sqrt(A2 / A1)) / 1), "step_missing", "AB 를 DB 로 답했다.")]),
          verificationJs: figJs({ A1, A2 }, f, `${PAR_JS}const r=Math.sqrt(P.A2/P.A1); const x=L('AD')*r-L('AD'); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('x 해석 불가'); return x;`),
          trace: [rdl("AD"), [`넓이의 비 = ${A2}/${A1} 이므로 닮음비 = √(${A2}/${A1}) = ${frac(n, m)} 이다.`, "Similarity ratio is the square root of the area ratio."], [`AB/AD = ${frac(n, m)} 에서 AB = ${L.AB} 이다.`, "The whole side."], [`x = AB - AD = ${L.AB} - ${L.AD} = ${L.DB} 이다.`, "Solve for x."], [`따라서 ${L.DB} 이다.`, "State x."]], variant: "solve_db_from_areas",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "area_big", structure: "작은 삼각형 넓이와 AD·AB 로 큰 삼각형 넓이를 구함", extra: "easy: 넓이 × (닮음비)²", concepts: ["닮은 삼각형", "넓이의 비"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const t = rng.int(1, 3); const A1 = L.AD * L.AD * t; const A2 = L.AB * L.AB * t; const f = parallelFig(s, { AD: String(L.AD), AB: String(L.AB) });
        return gInst(rng, {
          stimulus: intro(rng, s, ` The area of ${small(s)} is ${A1} square units.`), question: `What is the area, in square units, of triangle $${s.V.join("")}$?`, correct: A2,
          wrongs: posW([W((A1 * L.AB) / L.AD, "formula_misuse", "닮음비를 제곱하지 않고 곱했다."), W(A2 - A1, "step_missing", "사다리꼴의 넓이를 답했다."), W(A1 + L.DB, "other", "넓이에 길이를 더했다."), W(A1 * 2, "other", "2 배로 보았다.")]),
          verificationJs: figJs({ A1 }, f, `${PAR_JS}const r=L('AB')/L('AD'); return P.A1*r*r;`),
          trace: [rdl("AD, AB"), [`넓이 = ${A1} × (${L.AB}/${L.AD})² = ${A2} 이다.`, "Scale by the square of the ratio."]], variant: "easy_area_big",
        }, f);
      },
    },
    {
      lv: "medium", name: "perimeter", structure: "작은 삼각형 둘레와 AD·AB 로 큰 삼각형 둘레를 구함", extra: "medium: 둘레는 닮음비를 그대로 곱함", concepts: ["닮은 삼각형", "둘레"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const p1 = (L.AD + L.AE + L.DE); const f = parallelFig(s, { AD: String(L.AD), AB: String(L.AB) }); const p2 = (p1 * L.AB) / L.AD;
        return gInst(rng, {
          stimulus: intro(rng, s, ` The perimeter of ${small(s)} is ${p1} units.`), question: `What is the perimeter of triangle $${s.V.join("")}$?`, correct: p2,
          wrongs: posW([W((p1 * L.AB * L.AB) / (L.AD * L.AD), "formula_misuse", "닮음비를 제곱했다."), W(p2 - p1, "step_missing", "둘레의 차를 답했다."), W(p1 + L.DB, "other", "DB 를 더했다."), W((p1 * L.DB) / L.AD, "formula_misuse", "DB 로 비를 세웠다.")]),
          verificationJs: figJs({ p1 }, f, `${PAR_JS}return P.p1*L('AB')/L('AD');`),
          trace: [rdl("AD, AB"), [`둘레의 비 = 닮음비 = ${L.AB}/${L.AD} 이다.`, "Perimeters scale by the ratio."], [`둘레 = ${p1} × ${L.AB}/${L.AD} = ${p2} 이다.`, "Multiply."]], variant: "medium_perimeter",
        }, f);
      },
    },
  ],
});
function gcdI(a: number, b: number): number { return b ? gcdI(b, a % b) : a; }
void ({} as AScene); void ALT_JS; void aOvl; void altFig; void makeAltitude; void GenFail; void nm; void ovl;
