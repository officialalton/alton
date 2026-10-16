import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { PAR_JS, ALT_JS, aOvl, altFig, lead, makeAltitude, makeParallel, nm, ovl, parallelFig, type AScene, type PScene } from "../tn-kit";

const posW = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
const intro = (rng: Rng, s: PScene, extra = "") => lead(rng) + rng.pick([
  `In the figure shown, triangle $${s.V.join("")}$ has point $${s.D}$ on side $\\overline{${s.V[0]}${s.V[1]}}$ and point $${s.E}$ on side $\\overline{${s.V[0]}${s.V[2]}}$, and $\\overline{${s.D}${s.E}} \\parallel \\overline{${s.V[1]}${s.V[2]}}$.${extra}`,
  `The figure shows triangle $${s.V.join("")}$. Segment $\\overline{${s.D}${s.E}}$ is parallel to side $\\overline{${s.V[1]}${s.V[2]}}$, with $${s.D}$ on $\\overline{${s.V[0]}${s.V[1]}}$ and $${s.E}$ on $\\overline{${s.V[0]}${s.V[2]}}$. Lengths are labeled.${extra}`,
  `Triangle $${s.V.join("")}$ is shown with a segment $\\overline{${s.D}${s.E}}$ drawn parallel to $\\overline{${s.V[1]}${s.V[2]}}$; its endpoints lie on the other two sides.${extra}`,
  `In the figure, $${s.D}$ and $${s.E}$ are points on sides $\\overline{${s.V[0]}${s.V[1]}}$ and $\\overline{${s.V[0]}${s.V[2]}}$ of triangle $${s.V.join("")}$ such that $\\overline{${s.D}${s.E}} \\parallel \\overline{${s.V[1]}${s.V[2]}}$. Some lengths are given.${extra}`,
]);
const rdl = (what: string): [string, string] => [`그림에서 ${what} 길이 라벨을 읽는다.`, "Read the labeled lengths."];
const simStep = (s: PScene): [string, string] => [`DE ∥ BC 이므로 삼각형 ${s.V[0]}${s.D}${s.E} 와 삼각형 ${s.V.join("")} 는 닮음이다.`, "A line parallel to a side creates similar triangles."];

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.similar_triangles.TN.P",
  hard: [
    {
      op: "chain2", structure: "AD·DB·DE 가 주어진 내부 평행선 그림에서 AB = AD + DB 를 구한 뒤 닮음비로 BC 를 구함", extra: "전체 변 AB 를 먼저 구해야 닮음비를 쓸 수 있음(AD 만으로 비를 세우는 함정) — medium 은 EC",
      concepts: ["닮은 삼각형", "평행선", "닮음비"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const f = parallelFig(s, { AD: String(L.AD), DB: String(L.DB), DE: String(L.DE), BC: "x" });
        return gInst(rng, {
          stimulus: intro(rng, s), question: rng.pick([`What is the length of ${ovl(s, "BC")}?`, `What is the value of $x$?`]), correct: L.BC,
          wrongs: posW([W((L.DE * L.DB) / L.AD, "formula_misuse", "DB 로 비를 세웠다."), W(L.DE + L.DB, "formula_misuse", "비 대신 합을 구했다."), W((L.DE * L.AB) / L.DB, "formula_misuse", "비를 거꾸로 세웠다."), W(L.DE * 2, "other", "닮음비를 2 로 보았다."), W(L.AB, "step_missing", "AB 를 답했다.")]),
          verificationJs: figJs({}, f, `${PAR_JS}return L('DE')*(L('AD')+L('DB'))/L('AD');`),
          trace: [rdl("AD, DB, DE"), [`AB = AD + DB = ${L.AD} + ${L.DB} = ${L.AB} 이다.`, "The whole side."], simStep(s), [`AD/AB = DE/BC 이므로 ${L.AD}/${L.AB} = ${L.DE}/x 이다.`, "Set up the proportion."], [`x = ${L.DE} × ${L.AB} ÷ ${L.AD} = ${L.BC} 이다.`, "Solve."]], variant: "parallel_bc_from_ad_db_de",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "삼각형 ADE 의 세 변이 주어질 때 닮음비 AB/AD 로 삼각형 ABC 의 둘레를 구함", extra: "한 변의 비로 닮음비를 구해 둘레 전체에 곱해야 함(변 하나만 곱하거나 합으로 구하는 함정) — medium 은 한 변",
      concepts: ["닮은 삼각형", "둘레", "닮음비"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const per = ((L.AD + L.AE + L.DE) * L.AB) / L.AD; const f = parallelFig(s, { AD: String(L.AD), DB: String(L.DB), AE: String(L.AE), DE: String(L.DE) });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the perimeter of triangle $${s.V.join("")}$?`, correct: per,
          wrongs: posW([W(L.AD + L.AE + L.DE, "step_missing", "작은 삼각형의 둘레를 답했다."), W(L.AB + L.AE + L.DE, "formula_misuse", "일부 변만 큰 길이로 바꿨다."), W(per - (L.AD + L.AE + L.DE), "other", "둘레의 차를 답했다."), W(((L.AD + L.AE + L.DE) * L.DB) / L.AD, "formula_misuse", "DB 로 비를 세웠다."), W(L.AB + L.AE + L.DE + L.DB, "other", "변을 잘못 더했다.")]),
          verificationJs: figJs({}, f, `${PAR_JS}return (L('AD')+L('AE')+L('DE'))*(L('AD')+L('DB'))/L('AD');`),
          trace: [rdl("AD, DB, AE, DE"), [`AB = ${L.AD} + ${L.DB} = ${L.AB} 이므로 닮음비 AB/AD = ${L.AB}/${L.AD} 이다.`, "Similarity ratio."], [`삼각형 ADE 의 둘레 = ${L.AD} + ${L.AE} + ${L.DE} = ${L.AD + L.AE + L.DE} 이다.`, "Perimeter of the small triangle."], [`닮은 도형의 둘레도 같은 비이므로 ${L.AD + L.AE + L.DE} × ${L.AB}/${L.AD} = ${per} 이다.`, "Perimeters scale by the same ratio."], [`따라서 ${per} 이다.`, "State the perimeter."]], variant: "parallel_perimeter",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "AD·DB·AE 로 EC 를 구해 EC 와 AE 의 길이 차를 구함", extra: "두 변을 따로 구해 빼야 함(DB 와 AD 의 차로 단순화하는 함정) — medium 은 EC",
      concepts: ["닮은 삼각형", "비례식", "두 길이 비교"],
      gen(rng) {
        const s = makeParallel(rng, { aLtB: true }); const L = s.len; const f = parallelFig(s, { AD: String(L.AD), DB: String(L.DB), AE: String(L.AE) });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `How much longer is $\\overline{${nm(s, "EC")}}$ than $\\overline{${nm(s, "AE")}}$?`, correct: L.EC - L.AE,
          wrongs: posW([W(L.DB - L.AD, "step_missing", "AD 와 DB 의 차를 답했다."), W(L.EC, "step_missing", "EC 만 답했다."), W(L.AE, "step_missing", "AE 를 답했다."), W(L.EC + L.AE, "sign_error", "합을 구했다."), W(((L.AE * L.AD) / L.DB), "formula_misuse", "비를 거꾸로 세웠다.")]),
          verificationJs: figJs({}, f, `${PAR_JS}const ec=L('AE')*L('DB')/L('AD'); return ec-L('AE');`),
          trace: [rdl("AD, DB, AE"), simStep(s), [`AD/DB = AE/EC 이므로 EC = ${L.AE} × ${L.DB} ÷ ${L.AD} = ${L.EC} 이다.`, "Proportional segments."], [`EC - AE = ${L.EC} - ${L.AE} = ${L.EC - L.AE} 이다.`, "Subtract."], [`따라서 ${L.EC - L.AE} 이다.`, "State the difference."]], variant: "parallel_ec_minus_ae",
        }, f);
      },
    },
    {
      op: "inverse", structure: "AD 가 x 로 가려지고 DB·DE·BC 가 주어질 때 닮음비 방정식을 풀어 AD 를 구함", extra: "x/(x + DB) = DE/BC 를 세워 풀어야 함(x/DB 로 비를 세우는 함정) — medium 은 DB",
      concepts: ["닮은 삼각형", "비례식", "방정식"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const f = parallelFig(s, { AD: "x", DB: String(L.DB), DE: String(L.DE), BC: String(L.BC) });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the value of $x$?`, correct: L.AD,
          wrongs: posW([W((L.DE * L.DB) / L.BC, "formula_misuse", "x/DB 로 비를 세웠다."), W(L.DB, "step_missing", "DB 를 답했다."), W(L.AB, "step_missing", "AB 를 답했다."), W((L.DB * L.BC) / L.DE - L.DB + 1, "other", "계산이 어긋났다."), W(L.BC - L.DE, "formula_misuse", "BC 와 DE 의 차를 답했다.")]),
          verificationJs: figJs({}, f, `${PAR_JS}const db=L('DB'), de=L('DE'), bc=L('BC'); const x=de*db/(bc-de); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('x 해석 불가'); return x;`),
          trace: [rdl("DB, DE, BC"), simStep(s), [`AD/AB = DE/BC 에서 x/(x + ${L.DB}) = ${L.DE}/${L.BC} 이다.`, "Set up the proportion."], [`${L.BC}x = ${L.DE}(x + ${L.DB}) 에서 ${L.BC - L.DE}x = ${L.DE * L.DB} 이다.`, "Cross-multiply."], [`x = ${L.AD} 이다.`, "Solve for x."]], variant: "parallel_solve_for_ad",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "bc_with_ab", structure: "AD·AB·DE 가 주어진 내부 평행선에서 BC 를 구함", extra: "easy: 닮음비 AB/AD", concepts: ["닮은 삼각형", "닮음비"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const f = parallelFig(s, { AD: String(L.AD), AB: String(L.AB), DE: String(L.DE), BC: "x" });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the length of ${ovl(s, "BC")}?`, correct: L.BC,
          wrongs: posW([W((L.DE * L.AD) / L.AB, "formula_misuse", "비를 거꾸로 세웠다."), W(L.AB, "step_missing", "AB 를 답했다."), W(L.DE + L.AB - L.AD, "formula_misuse", "합으로 구했다."), W(L.DE * 2, "other", "닮음비를 2 로 보았다.")]),
          verificationJs: figJs({}, f, `${PAR_JS}return L('DE')*L('AB')/L('AD');`),
          trace: [rdl("AD, AB, DE"), [`AD/AB = DE/BC 이므로 BC = ${L.DE} × ${L.AB} ÷ ${L.AD} = ${L.BC} 이다.`, "Proportion."]], variant: "easy_bc_with_ab",
        }, f);
      },
    },
    {
      lv: "medium", name: "ec", structure: "AD·DB·AE 가 주어진 내부 평행선에서 EC 를 구함", extra: "medium: 부분 변의 비 AD/DB = AE/EC", concepts: ["닮은 삼각형", "비례식"],
      gen(rng) {
        const s = makeParallel(rng); const L = s.len; const f = parallelFig(s, { AD: String(L.AD), DB: String(L.DB), AE: String(L.AE), EC: "x" });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the length of ${ovl(s, "EC")}?`, correct: L.EC,
          wrongs: posW([W((L.AE * L.AD) / L.DB, "formula_misuse", "비를 거꾸로 세웠다."), W(L.AE + L.DB - L.AD, "formula_misuse", "합으로 구했다."), W(L.AE, "step_missing", "AE 를 답했다."), W(L.DB, "step_missing", "DB 를 답했다.")]),
          verificationJs: figJs({}, f, `${PAR_JS}return L('AE')*L('DB')/L('AD');`),
          trace: [rdl("AD, DB, AE"), simStep(s), [`AD/DB = AE/EC 이므로 EC = ${L.AE} × ${L.DB} ÷ ${L.AD} = ${L.EC} 이다.`, "Proportion."]], variant: "medium_ec",
        }, f);
      },
    },
  ],
});
void ({} as AScene); void ALT_JS; void aOvl; void altFig; void makeAltitude; void GenFail;
