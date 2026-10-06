import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { frac } from "../../../text";
import { PAR_JS, ALT_JS, aOvl, altFig, lead, makeAltitude, makeParallel, nm, ovl, parallelFig, type AScene, type PScene } from "../tn-kit";
const posW = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));

const intro = (rng: Rng, s: AScene, extra = "") => lead(rng) + rng.pick([
  `In the figure shown, triangle $${s.V.join("")}$ has a right angle at $${s.V[2]}$, and $\\overline{${s.V[2]}${s.D}}$ is the altitude drawn from $${s.V[2]}$ to the hypotenuse $\\overline{${s.V[0]}${s.V[1]}}$.${extra}`,
  `The figure shows right triangle $${s.V.join("")}$ with the right angle at $${s.V[2]}$. Point $${s.D}$ is on the hypotenuse, and $\\overline{${s.V[2]}${s.D}}$ is perpendicular to $\\overline{${s.V[0]}${s.V[1]}}$.${extra}`,
  `Right triangle $${s.V.join("")}$ is shown with its right angle at $${s.V[2]}$. The altitude from $${s.V[2]}$ meets the hypotenuse at $${s.D}$, forming two smaller right triangles.${extra}`,
  `In the diagram, $\\angle ${s.V[2]}$ of triangle $${s.V.join("")}$ is a right angle, and the segment from $${s.V[2]}$ perpendicular to $\\overline{${s.V[0]}${s.V[1]}}$ ends at point $${s.D}$.${extra}`,
]);
const rdl = (what: string): [string, string] => [`그림에서 ${what} 길이 라벨을 읽는다.`, "Read the labeled lengths."];
const sim = (s: AScene): [string, string] => [`수선 ${aName(s, "CD")} 가 직각삼각형을 닮은 두 직각삼각형으로 나누므로 기하평균 관계가 성립한다.`, "The altitude creates similar right triangles."];
import { aName } from "../tn-kit";

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.similar_right_triangle_altitude.TN.P",
  hard: [
    {
      op: "chain2", structure: "빗변을 나누는 두 선분 AD·DB 에서 AB 를 구한 뒤 직각변 AC = √(AD·AB) 를 구함", extra: "전체 빗변 AB 를 먼저 구해야 직각변의 기하평균 관계(AC² = AD·AB)를 쓸 수 있음(AD·DB 의 곱을 쓰는 함정) — medium 은 AC",
      concepts: ["직각삼각형의 수선", "닮음", "기하평균"],
      gen(rng) {
        const s = makeAltitude(rng); const f = altFig(s, { AD: String(s.AD), DB: String(s.DB), AC: "x" });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the length of ${aOvl(s, "AC")}?`, correct: s.AC,
          wrongs: posW([W(s.CD, "formula_misuse", "수선의 길이를 답했다."), W(Math.sqrt(s.AD * s.DB) + s.AD, "other", "수선에 AD 를 더했다."), W(s.AB, "step_missing", "빗변을 답했다."), W(s.BC, "axis_misread", "다른 직각변을 답했다."), W(Math.round(Math.sqrt(s.AD * s.AD + s.AB * s.AB)), "formula_misuse", "피타고라스로 잘못 구했다.")]),
          verificationJs: figJs({}, f, `${ALT_JS}const ab=L('AD')+L('DB'); const x=Math.sqrt(L('AD')*ab); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("AD, DB"), [`AB = AD + DB = ${s.AD} + ${s.DB} = ${s.AB} 이다.`, "The hypotenuse."], sim(s), [`AC² = AD × AB = ${s.AD} × ${s.AB} = ${s.AD * s.AB} 이다.`, "Leg is the geometric mean."], [`AC = ${s.AC} 이다.`, "Take the square root."]], variant: "leg_from_segments",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "AD·DB 로 수선 CD = √(AD·DB) 를 구해 삼각형 ABC 의 넓이를 구함", extra: "수선(높이)을 기하평균으로 구한 뒤 ½ × 빗변 × 높이 를 계산해야 함(AD·DB 를 넓이로 보는 함정) — medium 은 수선의 길이",
      concepts: ["직각삼각형의 수선", "기하평균", "넓이"],
      gen(rng) {
        const s = makeAltitude(rng); const area = (s.AB * s.CD) / 2; const f = altFig(s, { AD: String(s.AD), DB: String(s.DB) });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the area of triangle $${s.V.join("")}$?`, correct: area,
          wrongs: posW([W(s.AD * s.DB, "formula_misuse", "AD × DB 를 넓이로 답했다."), W(s.AB * s.CD, "formula_misuse", "½ 를 빠뜨렸다."), W((s.AC * s.BC), "formula_misuse", "½ 를 빠뜨리고 직각변을 곱했다."), W(s.CD, "step_missing", "수선의 길이를 답했다."), W((s.AD * s.CD) / 2, "step_missing", "작은 삼각형의 넓이를 답했다.")]),
          verificationJs: figJs({}, f, `${ALT_JS}const cd=Math.sqrt(L('AD')*L('DB')); if (Math.abs(cd-Math.round(cd))>1e-9) throw new Error('정수 아님'); return (L('AD')+L('DB'))*cd/2;`),
          trace: [rdl("AD, DB"), sim(s), [`CD² = AD × DB = ${s.AD} × ${s.DB} 에서 CD = ${s.CD} 이다.`, "The altitude is the geometric mean."], [`AB = ${s.AB} 이고 넓이 = ½ × ${s.AB} × ${s.CD} = ${area} 이다.`, "Area from the hypotenuse and its altitude."], [`따라서 ${area} 이다.`, "State the area."]], variant: "area_from_segments",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "AD·DB 로 두 직각변 AC·BC 를 각각 구해 길이 차를 구함", extra: "두 직각변을 각각 기하평균으로 구해 빼야 함(AD 와 DB 의 차를 답하는 함정) — medium 은 한 직각변",
      concepts: ["직각삼각형의 수선", "기하평균", "두 길이 비교"],
      gen(rng) {
        const s = makeAltitude(rng); const f = altFig(s, { AD: String(s.AD), DB: String(s.DB) }); const d = Math.abs(s.AC - s.BC);
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the positive difference between the lengths of ${aOvl(s, "AC")} and ${aOvl(s, "BC")}?`, correct: d,
          wrongs: posW([W(Math.abs(s.AD - s.DB), "step_missing", "AD 와 DB 의 차를 답했다."), W(s.AC + s.BC, "sign_error", "합을 구했다."), W(Math.max(s.AC, s.BC), "step_missing", "한 직각변만 답했다."), W(Math.abs(s.CD - s.AD), "other", "다른 두 길이의 차를 답했다."), W(d + s.m, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${ALT_JS}const ab=L('AD')+L('DB'); const ac=Math.sqrt(L('AD')*ab), bc=Math.sqrt(L('DB')*ab); if (Math.abs(ac-Math.round(ac))>1e-9||Math.abs(bc-Math.round(bc))>1e-9) throw new Error('정수 아님'); return Math.abs(ac-bc);`),
          trace: [rdl("AD, DB"), [`AB = ${s.AB} 이다.`, "The hypotenuse."], [`AC² = AD × AB 에서 AC = ${s.AC}, BC² = DB × AB 에서 BC = ${s.BC} 이다.`, "Both legs by geometric means."], [`차 = |${s.AC} - ${s.BC}| = ${d} 이다.`, "Subtract."], [`따라서 ${d} 이다.`, "State the difference."]], variant: "leg_difference",
        }, f);
      },
    },
    {
      op: "inverse", structure: "수선 CD 와 AD 가 주어질 때 CD² = AD·DB 로 DB 를 거꾸로 구함", extra: "기하평균 관계를 거꾸로 풀어야 함(CD 를 DB 로 답하거나 AD·CD 를 쓰는 함정) — medium 은 AC",
      concepts: ["직각삼각형의 수선", "기하평균", "역산"],
      gen(rng) {
        const s = makeAltitude(rng); const f = altFig(s, { AD: String(s.AD), CD: String(s.CD), DB: "x" });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the value of $x$?`, correct: s.DB,
          wrongs: posW([W(s.CD - s.AD > 0 ? s.CD - s.AD : s.AD, "formula_misuse", "수선과 AD 의 차를 답했다."), W(s.AB, "step_missing", "빗변을 답했다."), W(Math.round((s.CD * s.CD) / s.AB), "formula_misuse", "AB 로 나눴다."), W(s.CD, "step_missing", "수선을 답했다."), W(s.AD, "step_missing", "AD 를 답했다.")]),
          verificationJs: figJs({}, f, `${ALT_JS}const x=L('CD')*L('CD')/L('AD'); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('x 해석 불가'); return x;`),
          trace: [rdl("AD, CD"), sim(s), [`CD² = AD × DB 에서 ${s.CD}² = ${s.AD} × x 이다.`, "Set up the geometric mean."], [`x = ${s.CD * s.CD} ÷ ${s.AD} = ${s.DB} 이다.`, "Solve."], [`따라서 ${s.DB} 이다.`, "State x."]], variant: "segment_from_altitude",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "altitude", structure: "빗변을 나누는 두 선분에서 수선의 길이를 구함", extra: "easy: CD = √(AD·DB)", concepts: ["직각삼각형의 수선", "기하평균"],
      gen(rng) {
        const s = makeAltitude(rng); const f = altFig(s, { AD: String(s.AD), DB: String(s.DB), CD: "x" });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the length of ${aOvl(s, "CD")}?`, correct: s.CD,
          wrongs: posW([W(s.AD + s.DB, "step_missing", "빗변을 답했다."), W((s.AD + s.DB) / 2, "formula_misuse", "산술평균을 답했다."), W(s.AD * s.DB, "formula_misuse", "제곱근을 취하지 않았다."), W(s.AC, "axis_misread", "직각변을 답했다.")]),
          verificationJs: figJs({}, f, `${ALT_JS}const x=Math.sqrt(L('AD')*L('DB')); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("AD, DB"), sim(s), [`CD² = AD × DB = ${s.AD} × ${s.DB} 이므로 CD = ${s.CD} 이다.`, "Geometric mean."]], variant: "easy_altitude",
        }, f);
      },
    },
    {
      lv: "medium", name: "leg", structure: "AD 와 AB 가 주어질 때 직각변 AC 를 구함", extra: "medium: AC² = AD·AB", concepts: ["직각삼각형의 수선", "기하평균"],
      gen(rng) {
        const s = makeAltitude(rng); const f = altFig(s, { AD: String(s.AD), AB: String(s.AB), AC: "x" });
        return gInst(rng, {
          stimulus: intro(rng, s), question: `What is the length of ${aOvl(s, "AC")}?`, correct: s.AC,
          wrongs: posW([W(s.CD, "formula_misuse", "수선의 길이를 답했다."), W(s.AD * s.AB, "formula_misuse", "제곱근을 취하지 않았다."), W((s.AD + s.AB) / 2, "formula_misuse", "산술평균을 답했다."), W(s.BC, "axis_misread", "다른 직각변을 답했다.")]),
          verificationJs: figJs({}, f, `${ALT_JS}const x=Math.sqrt(L('AD')*L('AB')); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("AD, AB"), sim(s), [`AC² = AD × AB = ${s.AD} × ${s.AB} 이므로 AC = ${s.AC} 이다.`, "Leg is the geometric mean."]], variant: "medium_leg",
        }, f);
      },
    },
  ],
});
void ({} as PScene); void PAR_JS; void makeParallel; void GenFail; void nm; void ovl; void parallelFig;
