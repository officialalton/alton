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
  prefix: "av", itemId: "area_volume.cylinder_volume_diameter.SX.P",
  hard: [
    {
      op: "chain2", structure: "지름과 단면의 대각선에서 높이(x)를 구한 뒤 반지름을 구해 원기둥의 부피를 구함", extra: "지름을 반으로 나눠 반지름을 쓰고 높이를 대각선에서 구해야 함(지름을 반지름으로 쓰는 함정) — medium 은 높이가 주어진 경우",
      sprNo: PI_OK, concepts: ["원기둥의 부피", "지름과 반지름", "피타고라스 정리"],
      gen(rng) {
        const s = makeCyl(rng); const k = s.r * s.r * s.h; const f = cylFig({ diameter: String(2 * s.r), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: Qv(rng), correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(4 * k, "formula_misuse", "지름을 반지름으로 썼다."), piW(s.r * s.r * s.d, "formula_misuse", "대각선을 높이로 썼다."), piW(2 * s.r * s.h, "geometry_misapplied", "옆넓이를 답했다."), piW(k / 3, "formula_misuse", "원뿔의 부피를 답했다."), piW(2 * k, "formula_misuse", "지름 × 반지름으로 계산했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const r=D('diameter')/2; const h=Math.sqrt(D('diag')**2-D('diameter')**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return r*r*h;`),
          trace: [rdl("지름·대각선"), [`반지름 = ${2 * s.r} ÷ 2 = ${s.r} 이다.`, "Radius from the diameter."], [`x² = ${s.d}² - ${2 * s.r}² = ${s.h * s.h} 이므로 높이 x = ${s.h} 이다.`, "Pythagorean theorem."], [`부피 = π × ${s.r}² × ${s.h} = ${k}π 이다.`, "Cylinder volume."], [`따라서 ${k}π 이다.`, "State the volume."]], variant: "volume_from_diameter_diagonal",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "지름과 대각선에서 높이를 구해 두 밑면을 포함한 겉넓이를 구함", extra: "옆넓이와 두 밑넓이를 모두 더해야 함(옆넓이만 답하거나 밑면을 한 개만 더하는 함정) — medium 은 부피",
      sprNo: PI_OK, concepts: ["원기둥의 겉넓이", "지름과 반지름", "피타고라스 정리"],
      gen(rng) {
        const s = makeCyl(rng); const k = 2 * s.r * (s.r + s.h); const f = cylFig({ diameter: String(2 * s.r), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the total surface area of the cylinder, including both circular bases, in square units?`, correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(2 * s.r * s.h, "step_missing", "옆넓이만 답했다."), piW(2 * s.r * s.h + s.r * s.r, "step_missing", "밑면을 한 개만 더했다."), piW(2 * s.r * s.d + 2 * s.r * s.r, "formula_misuse", "대각선을 높이로 썼다."), piW(s.r * s.r * s.h, "geometry_misapplied", "부피를 답했다."), piW(2 * (2 * s.r) * (2 * s.r + s.h), "formula_misuse", "지름을 반지름으로 썼다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const r=D('diameter')/2; const h=Math.sqrt(D('diag')**2-D('diameter')**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return 2*r*h+2*r*r;`),
          trace: [rdl("지름·대각선"), [`r = ${s.r}, x = √(${s.d}² - ${2 * s.r}²) = ${s.h} 이다.`, "Radius and height."], [`옆넓이 = 2π × ${s.r} × ${s.h} = ${2 * s.r * s.h}π 이다.`, "Lateral area."], [`두 밑넓이 = 2π × ${s.r}² = ${2 * s.r * s.r}π 이다.`, "Both bases."], [`겉넓이 = ${2 * s.r * s.h}π + ${2 * s.r * s.r}π = ${k}π 이다.`, "Add."]], variant: "total_surface_area_diameter",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "옆넓이와 두 밑넓이의 합을 각각 구한 뒤 그 차를 계산해 답을 구함", extra: "높이와 반지름을 구해 두 넓이를 따로 구해 빼야 함(옆넓이만 답하는 함정) — medium 은 한 넓이",
      sprNo: PI_OK, concepts: ["원기둥의 겉넓이", "두 넓이 비교", "피타고라스 정리"],
      gen(rng) {
        const s = makeCyl(rng); if (s.h <= s.r) throw new GenFail("h>r"); const k = 2 * s.r * (s.h - s.r); const f = cylFig({ diameter: String(2 * s.r), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: `By how many square units does the lateral surface area exceed the combined area of the two circular bases?`, correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(2 * s.r * s.h, "step_missing", "옆넓이만 답했다."), piW(2 * s.r * s.r, "step_missing", "두 밑넓이만 답했다."), piW(2 * s.r * s.h + 2 * s.r * s.r, "sign_error", "합을 구했다."), piW(2 * s.r * (s.h - s.r) * 2, "formula_misuse", "지름으로 계산했다."), piW(s.r * (s.h - s.r), "step_missing", "2 를 빠뜨렸다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const r=D('diameter')/2; const h=Math.sqrt(D('diag')**2-D('diameter')**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return 2*r*h-2*r*r;`),
          trace: [rdl("지름·대각선"), [`r = ${s.r}, 높이 x = ${s.h} 이다.`, "Radius and height."], [`옆넓이 = ${2 * s.r * s.h}π, 두 밑넓이 = ${2 * s.r * s.r}π 이다.`, "The two areas."], [`차 = ${2 * s.r * s.h}π - ${2 * s.r * s.r}π = ${k}π 이다.`, "Subtract."], [`따라서 ${k}π 이다.`, "State the difference."]], variant: "lateral_minus_bases",
        }, f);
      },
    },
    {
      op: "inverse", structure: "부피와 지름이 주어질 때 높이를 거꾸로 구해 단면의 대각선(x)을 구함", extra: "부피에서 높이를 구하고 지름과 함께 피타고라스에 넣어야 함(지름을 반지름으로 쓰는 함정) — medium 은 높이",
      concepts: ["원기둥의 부피", "역산", "지름과 반지름"],
      gen(rng) {
        const s = makeCyl(rng); const k = s.r * s.r * s.h; if (k >= 1000) throw new GenFail("V 큼"); const f = cylFig({ diameter: String(2 * s.r), diag: "x" });
        return gInst(rng, {
          stimulus: intro(rng, rng.pick([` The volume of the cylinder is $${k}\\pi$ cubic units.`, ` The cylinder has a volume of $${k}\\pi$ cubic units.`, ` It is known that the cylinder occupies $${k}\\pi$ cubic units of space.`, ` The space inside the cylinder measures $${k}\\pi$ cubic units.`, ` Its volume, in cubic units, is $${k}\\pi$.`, ` The cylinder can hold exactly $${k}\\pi$ cubic units.`])), question: rng.pick(["What is the length of the dashed diagonal, shown as $x$?", "What is the value of $x$, the length of the dashed diagonal of the cross section?", "How long is the dashed diagonal, in units?"]), correct: s.d,
          wrongs: posW([W(s.h, "step_missing", "높이를 답했다."), W(sq(4 * s.r * s.r + (k / (4 * s.r * s.r)) ** 2), "formula_misuse", "지름을 반지름으로 보고 높이를 구했다."), W(2 * s.r + s.h, "formula_misuse", "합을 구했다."), W(s.d + 1, "other", "계산이 어긋났다."), W(2 * s.r, "step_missing", "지름을 답했다.")]),
          verificationJs: figJs({ k }, f, `${DIM_JS}const r=D('diameter')/2; const h=P.k/(r*r); const x=Math.sqrt(D('diameter')**2+h*h); if (Math.abs(h-Math.round(h))>1e-9||Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("지름"), [`반지름 = ${s.r} 이고 ${k}π = π × ${s.r}² × h 에서 h = ${s.h} 이다.`, "Radius and height."], [`단면의 가로는 지름 ${2 * s.r} 이다.`, "Diameter."], [`x² = ${2 * s.r}² + ${s.h}² = ${s.d * s.d} 이므로 x = ${s.d} 이다.`, "Pythagorean theorem."], [`따라서 ${s.d} 이다.`, "State the length."]], variant: "diagonal_from_volume_diameter",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "volume", structure: "지름과 높이가 주어진 원기둥의 부피를 구함", extra: "easy: 반지름 = 지름 ÷ 2", sprNo: PI_OK, concepts: ["원기둥의 부피", "지름과 반지름"],
      gen(rng) {
        const s = makeCyl(rng); const k = s.r * s.r * s.h; const f = cylFig({ diameter: String(2 * s.r), height: String(s.h), diag: String(s.d) });
        return gInst(rng, {
          stimulus: intro(rng), question: Qv(rng), correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(4 * k, "formula_misuse", "지름을 반지름으로 썼다."), piW(2 * k, "formula_misuse", "지름 × 반지름으로 계산했다."), piW(s.r * s.h, "step_missing", "반지름을 제곱하지 않았다."), piW(k / 3, "formula_misuse", "원뿔의 부피를 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}return (D('diameter')/2)**2*D('height');`),
          trace: [rdl("지름·높이"), [`반지름 = ${s.r} 이다.`, "Radius."], [`부피 = π × ${s.r}² × ${s.h} = ${k}π 이다.`, "Cylinder volume."]], variant: "easy_volume_diameter",
        }, f);
      },
    },
    {
      lv: "medium", name: "height_from_diagonal", structure: "지름과 대각선에서 높이(x)를 구함", extra: "medium: 지름이 단면의 가로", concepts: ["원기둥", "피타고라스 정리"],
      gen(rng) {
        const s = makeCyl(rng); const f = cylFig({ diameter: String(2 * s.r), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the height of the cylinder, shown as $x$?`, correct: s.h,
          wrongs: posW([W(s.d - 2 * s.r, "formula_misuse", "그냥 뺐다."), W(sq(s.d * s.d - s.r * s.r), "formula_misuse", "반지름을 가로로 썼다."), W(s.d, "step_missing", "대각선을 답했다."), W(s.h + 1, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const h=Math.sqrt(D('diag')**2-D('diameter')**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return h;`),
          trace: [rdl("지름·대각선"), [`x² = ${s.d}² - ${2 * s.r}² = ${s.h * s.h} 이다.`, "Pythagorean theorem."], [`x = ${s.h} 이다.`, "Square root."]], variant: "medium_height_diameter",
        }, f);
      },
    },
  ],
});
void ctxPrism; void ctxComp; void makePrism; void prismFig; void compFig;
