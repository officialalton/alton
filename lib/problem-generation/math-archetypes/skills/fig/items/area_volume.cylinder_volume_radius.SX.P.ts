import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { DIM_JS, compFig, cylFig, ctxComp, ctxCyl, ctxPrism, makeCyl, makePrism, piT, prismFig } from "../sx-kit";
const posW = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
const rdl = (what: string): [string, string] => [`그림에서 ${what} 라벨을 읽는다.`, "Read the labels in the figure."];
const sq = (n: number) => Math.round(Math.sqrt(n) * 1000) / 1000;
const PI_OK = "정답이 π 가 든 식($k\\pi$)이라 단답(수)으로 낼 수 없다";
const piW = (k: number, kind: import("../../../../review").DistractorKind, reason: string) => ({ text: piT(Math.round(k * 100) / 100), kind, reason });
const piList = (ws: { text: string; kind: import("../../../../review").DistractorKind; reason: string }[]) => ws.filter((w) => !/NaN|Infinity|-/.test(w.text) && !/^\$0\\pi\$$/.test(w.text));


const intro = (rng: Rng, extra = "") => `${ctxCyl(rng)}${extra}`;
const Qv = (rng: Rng) => rng.pick(["What is the volume of the cylinder, in cubic units?", "What is the volume, in cubic units, of the cylinder shown?", "Find the volume of the cylinder in cubic units."]);
export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.cylinder_volume_radius.SX.P",
  hard: [
    {
      op: "chain2", structure: "반지름과 단면의 대각선에서 높이(x)를 구한 뒤 원기둥의 부피를 구함", extra: "단면 직사각형의 지름(2r)과 대각선에서 높이를 먼저 구해야 함(대각선을 높이로 쓰거나 지름 대신 반지름으로 구하는 함정) — medium 은 높이가 주어진 경우",
      sprNo: PI_OK, concepts: ["원기둥의 부피", "피타고라스 정리", "축 단면"],
      gen(rng) {
        const s = makeCyl(rng); const k = s.r * s.r * s.h; const f = cylFig({ radius: String(s.r), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: Qv(rng), correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(s.r * s.r * s.d, "formula_misuse", "대각선을 높이로 썼다."), piW(4 * s.r * s.r * s.h, "formula_misuse", "지름을 반지름으로 썼다."), piW(s.r * s.h, "step_missing", "반지름을 제곱하지 않았다."), piW(k / 3, "formula_misuse", "원뿔의 부피를 답했다."), piW(s.r * s.r * (s.d - 2 * s.r), "formula_misuse", "대각선에서 지름을 그냥 빼서 높이를 구했다."), piW(2 * s.r * s.h, "geometry_misapplied", "옆넓이를 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const h=Math.sqrt(D('diag')**2-(2*D('radius'))**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return D('radius')**2*h;`),
          trace: [rdl("반지름·대각선"), [`단면 직사각형의 가로는 지름 2 × ${s.r} = ${2 * s.r} 이다.`, "The section's width is the diameter."], [`x² = ${s.d}² - ${2 * s.r}² = ${s.h * s.h} 이므로 높이 x = ${s.h} 이다.`, "Pythagorean theorem on the section."], [`부피 = π r² h = π × ${s.r}² × ${s.h} = ${k}π 이다.`, "Cylinder volume."], [`따라서 ${k}π 이다.`, "State the volume."]], variant: "volume_height_from_diagonal",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "반지름과 단면의 대각선에서 높이를 구한 뒤 옆넓이(2πrh)를 구함", extra: "높이를 구하고 옆넓이 공식에 대입해야 함(부피나 밑넓이를 더하는 함정) — medium 은 부피",
      sprNo: PI_OK, concepts: ["원기둥의 옆넓이", "피타고라스 정리", "축 단면"],
      gen(rng) {
        const s = makeCyl(rng); const k = 2 * s.r * s.h; const f = cylFig({ radius: String(s.r), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: rng.pick(["What is the lateral surface area of the cylinder, in square units?", "What is the area of the curved side of the cylinder, in square units?"]), correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(s.r * s.r * s.h, "geometry_misapplied", "부피를 답했다."), piW(2 * s.r * s.h + 2 * s.r * s.r, "step_missing", "밑넓이를 더했다."), piW(2 * s.r * s.d, "formula_misuse", "대각선을 높이로 썼다."), piW(s.r * s.h, "step_missing", "2 를 빠뜨렸다."), piW(4 * s.r * s.h, "formula_misuse", "지름으로 계산했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const h=Math.sqrt(D('diag')**2-(2*D('radius'))**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return 2*D('radius')*h;`),
          trace: [rdl("반지름·대각선"), [`지름 = ${2 * s.r} 이고 x² = ${s.d}² - ${2 * s.r}² 에서 높이 x = ${s.h} 이다.`, "Find the height."], [`옆면을 펴면 가로 2πr, 세로 h 인 직사각형이다.`, "Unroll the side."], [`옆넓이 = 2π × ${s.r} × ${s.h} = ${k}π 이다.`, "Lateral area."], [`따라서 ${k}π 이다.`, "State the area."]], variant: "lateral_area_radius",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "원기둥과 밑면·높이가 같은 원뿔의 부피 차를 구함", extra: "높이를 구해 두 부피를 비교해야 함(원뿔의 부피를 답하거나 1/3 을 놓치는 함정) — medium 은 원기둥의 부피",
      sprNo: PI_OK, concepts: ["원기둥의 부피", "원뿔의 부피", "두 부피 비교"],
      gen(rng) {
        const s = makeCyl(rng); const k = s.r * s.r * s.h; if (k % 3 !== 0) throw new GenFail("3의 배수"); const f = cylFig({ radius: String(s.r), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: `How many cubic units greater is the volume of the cylinder than the volume of a cone with the same base and the same height?`, correctText: piT((2 * k) / 3), range: [0, 1e7],
          wrongTexts: piList([piW(k / 3, "step_missing", "원뿔의 부피를 답했다."), piW(k, "step_missing", "원기둥의 부피를 답했다."), piW((2 * k) / 3 + s.r, "other", "계산이 어긋났다."), piW((2 * 4 * k) / 3, "formula_misuse", "지름을 반지름으로 썼다."), piW(k / 2, "formula_misuse", "1/2 로 계산했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const h=Math.sqrt(D('diag')**2-(2*D('radius'))**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return D('radius')**2*h*2/3;`),
          trace: [rdl("반지름·대각선"), [`높이 x = √(${s.d}² - ${2 * s.r}²) = ${s.h} 이다.`, "Height from the section."], [`원기둥 = π × ${s.r}² × ${s.h} = ${k}π, 원뿔 = ⅓ × ${k}π = ${k / 3}π 이다.`, "Both volumes."], [`차 = ${k}π - ${k / 3}π = ${(2 * k) / 3}π 이다.`, "Subtract."], [`따라서 ${(2 * k) / 3}π 이다.`, "State the difference."]], variant: "cylinder_minus_cone",
        }, f);
      },
    },
    {
      op: "inverse", structure: "부피와 반지름이 주어질 때 높이를 거꾸로 구해 단면의 대각선(x)을 구함", extra: "부피에서 높이를 거꾸로 구하고 지름과 함께 피타고라스에 넣어야 함(반지름을 쓰거나 높이를 답하는 함정) — medium 은 높이",
      concepts: ["원기둥의 부피", "역산", "피타고라스 정리"],
      gen(rng) {
        const s = makeCyl(rng); const k = s.r * s.r * s.h; if (k >= 1000) throw new GenFail("V 큼"); const f = cylFig({ radius: String(s.r), diag: "x" });
        return gInst(rng, {
          stimulus: intro(rng, rng.pick([` The volume of the cylinder is $${k}\\pi$ cubic units.`, ` The cylinder has a volume of $${k}\\pi$ cubic units.`, ` It is known that the cylinder occupies $${k}\\pi$ cubic units of space.`, ` The space inside the cylinder measures $${k}\\pi$ cubic units.`, ` Its volume, in cubic units, is $${k}\\pi$.`, ` The cylinder can hold exactly $${k}\\pi$ cubic units.`])), question: rng.pick(["What is the length of the dashed diagonal, shown as $x$?", "What is the value of $x$, the length of the dashed diagonal of the cross section?", "How long is the dashed diagonal, in units?"]), correct: s.d,
          wrongs: posW([W(s.h, "step_missing", "높이를 답했다."), W(sq(s.r * s.r + s.h * s.h), "formula_misuse", "반지름을 지름으로 썼다."), W(2 * s.r + s.h, "formula_misuse", "합을 구했다."), W(s.d + 1, "other", "계산이 어긋났다."), W(sq(s.h * s.h - 4 * s.r * s.r) || s.h + 2, "sign_error", "차로 구했다.")]),
          verificationJs: figJs({ k }, f, `${DIM_JS}const h=P.k/(D('radius')**2); const x=Math.sqrt((2*D('radius'))**2+h*h); if (Math.abs(h-Math.round(h))>1e-9||Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("반지름"), [`부피 ${k}π = π × ${s.r}² × h 에서 h = ${s.h} 이다.`, "Solve for the height."], [`단면의 가로는 지름 ${2 * s.r} 이다.`, "Diameter."], [`x² = ${2 * s.r}² + ${s.h}² = ${s.d * s.d} 이므로 x = ${s.d} 이다.`, "Pythagorean theorem."], [`따라서 ${s.d} 이다.`, "State the length."]], variant: "diagonal_from_volume_radius",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "volume", structure: "반지름과 높이가 주어진 원기둥의 부피를 구함", extra: "easy: π r² h", sprNo: PI_OK, concepts: ["원기둥의 부피"],
      gen(rng) {
        const s = makeCyl(rng); const k = s.r * s.r * s.h; const f = cylFig({ radius: String(s.r), height: String(s.h), diag: String(s.d) });
        return gInst(rng, {
          stimulus: intro(rng), question: Qv(rng), correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(s.r * s.h, "step_missing", "반지름을 제곱하지 않았다."), piW(4 * k, "formula_misuse", "지름을 반지름으로 썼다."), piW(k / 3, "formula_misuse", "원뿔의 부피를 답했다."), piW(s.r * s.r * s.d, "formula_misuse", "대각선을 높이로 썼다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}return D('radius')**2*D('height');`),
          trace: [rdl("반지름·높이"), [`부피 = π × ${s.r}² × ${s.h} = ${k}π 이다.`, "Cylinder volume."]], variant: "easy_volume_radius",
        }, f);
      },
    },
    {
      lv: "medium", name: "height_from_diagonal", structure: "반지름과 대각선에서 높이(x)를 구함", extra: "medium: 지름과 대각선으로 높이", concepts: ["원기둥", "피타고라스 정리"],
      gen(rng) {
        const s = makeCyl(rng); const f = cylFig({ radius: String(s.r), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the height of the cylinder, shown as $x$?`, correct: s.h,
          wrongs: posW([W(s.d - 2 * s.r, "formula_misuse", "그냥 뺐다."), W(sq(s.d * s.d - s.r * s.r), "formula_misuse", "지름 대신 반지름을 썼다."), W(s.d, "step_missing", "대각선을 답했다."), W(s.h + 1, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const h=Math.sqrt(D('diag')**2-(2*D('radius'))**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return h;`),
          trace: [rdl("반지름·대각선"), [`x² = ${s.d}² - ${2 * s.r}² = ${s.h * s.h} 이다.`, "Pythagorean theorem."], [`x = ${s.h} 이다.`, "Square root."]], variant: "medium_height_from_diagonal",
        }, f);
      },
    },
  ],
});
void ctxPrism; void ctxComp; void makePrism; void prismFig; void compFig;
