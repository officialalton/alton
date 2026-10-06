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

const intro = (rng: Rng, extra = "") => `${ctxPrism(rng)}${extra}`;
const SPRNO = "";
void SPRNO;
export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.prism_volume.SX.P",
  hard: [
    {
      op: "chain2", structure: "직각삼각형 밑면의 한 직각변과 빗변에서 나머지 직각변을 구한 뒤 삼각기둥의 부피를 구함", extra: "빗변에서 직각변을 먼저 구해야 밑면의 넓이를 알 수 있음(빗변을 직각변으로 쓰는 함정) — medium 은 두 직각변이 주어진 경우",
      concepts: ["삼각기둥의 부피", "피타고라스 정리", "연쇄 적용"],
      gen(rng) {
        const s = makePrism(rng); const V = (s.a * s.b * s.L) / 2; const f = prismFig({ legA: String(s.a), hyp: String(s.c), length: String(s.L), legB: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: rng.pick(["What is the volume of the prism, in cubic units?", "What is the volume, in cubic units, of the triangular prism shown?"]), correct: V,
          wrongs: posW([W((s.a * s.c * s.L) / 2, "formula_misuse", "빗변을 직각변으로 썼다."), W(s.a * s.b * s.L, "step_missing", "½ 를 빠뜨렸다."), W((s.a * s.b) / 2, "step_missing", "밑면의 넓이만 답했다."), W((s.a + s.b + s.c) * s.L, "geometry_misapplied", "겉넓이의 일부를 답했다."), W(V + s.L, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const b=Math.sqrt(D('hyp')**2-D('legA')**2); if (Math.abs(b-Math.round(b))>1e-9) throw new Error('정수 아님'); return D('legA')*b*D('length')/2;`),
          trace: [rdl("직각변·빗변·기둥 길이"), [`x² = ${s.c}² - ${s.a}² = ${s.b * s.b} 이므로 x = ${s.b} 이다.`, "Find the other leg."], [`밑면의 넓이 = ½ × ${s.a} × ${s.b} = ${(s.a * s.b) / 2} 이다.`, "Area of the triangular base."], [`부피 = 밑면의 넓이 × 길이 = ${(s.a * s.b) / 2} × ${s.L} = ${V} 이다.`, "Base area times length."], [`따라서 ${V} 이다.`, "State the volume."]], variant: "volume_missing_leg",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "삼각기둥의 세 변과 길이로 겉넓이(두 밑면 + 세 직사각형)를 구함", extra: "두 밑면과 세 옆면을 모두 더해야 함(옆면만이나 밑면 한 개만 더하는 함정) — medium 은 부피",
      concepts: ["삼각기둥의 겉넓이", "피타고라스 정리"],
      gen(rng) {
        const s = makePrism(rng); const SA = s.a * s.b + (s.a + s.b + s.c) * s.L; const f = prismFig({ legA: String(s.a), legB: String(s.b), hyp: "x", length: String(s.L) });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the total surface area of the prism, in square units?`, correct: SA,
          wrongs: posW([W((s.a + s.b + s.c) * s.L, "step_missing", "옆면만 더했다."), W((s.a * s.b) / 2 + (s.a + s.b + s.c) * s.L, "step_missing", "밑면을 한 개만 더했다."), W(s.a * s.b + (s.a + s.b) * s.L, "step_missing", "빗변 쪽 옆면을 빠뜨렸다."), W((s.a * s.b * s.L) / 2, "geometry_misapplied", "부피를 답했다."), W(SA + s.L, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const c=Math.sqrt(D('legA')**2+D('legB')**2); if (Math.abs(c-Math.round(c))>1e-9) throw new Error('정수 아님'); return D('legA')*D('legB')+(D('legA')+D('legB')+c)*D('length');`),
          trace: [rdl("두 직각변·기둥 길이"), [`x² = ${s.a}² + ${s.b}² 이므로 x = ${s.c} 이다.`, "Hypotenuse of the base."], [`두 밑면의 넓이 = 2 × ½ × ${s.a} × ${s.b} = ${s.a * s.b} 이다.`, "Two triangular bases."], [`옆면의 넓이 = (${s.a} + ${s.b} + ${s.c}) × ${s.L} = ${(s.a + s.b + s.c) * s.L} 이다.`, "Three rectangular faces."], [`겉넓이 = ${s.a * s.b} + ${(s.a + s.b + s.c) * s.L} = ${SA} 이다.`, "Add all faces."]], variant: "surface_area_prism",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "빗변을 포함한 옆면과 더 긴 직각변을 포함한 옆면의 넓이 차를 구함", extra: "빗변을 먼저 구해 두 직사각형 넓이를 따로 구해야 함(두 직각변 옆면을 비교하는 함정) — medium 은 한 옆면",
      concepts: ["삼각기둥", "피타고라스 정리", "두 넓이 비교"],
      gen(rng) {
        const s = makePrism(rng); const big = Math.max(s.a, s.b); const d = (s.c - big) * s.L; const f = prismFig({ legA: String(s.a), legB: String(s.b), hyp: "x", length: String(s.L) });
        return gInst(rng, {
          stimulus: intro(rng), question: `By how many square units does the area of the rectangular face containing the hypotenuse exceed the area of the larger of the other two rectangular faces?`, correct: d,
          wrongs: posW([W(s.c * s.L, "step_missing", "빗변 옆면만 답했다."), W(Math.abs(s.a - s.b) * s.L, "step_missing", "두 직각변 옆면의 차를 답했다."), W((s.c - Math.min(s.a, s.b)) * s.L, "other", "작은 쪽 옆면과 비교했다."), W(d + s.L, "other", "계산이 어긋났다."), W(big * s.L, "step_missing", "큰 옆면만 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const c=Math.sqrt(D('legA')**2+D('legB')**2); if (Math.abs(c-Math.round(c))>1e-9) throw new Error('정수 아님'); return (c-Math.max(D('legA'),D('legB')))*D('length');`),
          trace: [rdl("두 직각변·기둥 길이"), [`빗변 x = ${s.c} 이다.`, "Hypotenuse."], [`빗변 옆면 = ${s.c} × ${s.L} = ${s.c * s.L}, 큰 직각변 옆면 = ${big} × ${s.L} = ${big * s.L} 이다.`, "Two rectangular faces."], [`차 = ${s.c * s.L} - ${big * s.L} = ${d} 이다.`, "Subtract."], [`따라서 ${d} 이다.`, "State the difference."]], variant: "face_difference_prism",
        }, f);
      },
    },
    {
      op: "inverse", structure: "부피와 한 직각변·기둥 길이가 주어질 때 나머지 직각변을 거꾸로 구해 빗변을 구함", extra: "부피에서 직각변을 거꾸로 구한 뒤 피타고라스로 빗변을 구해야 함(부피를 그대로 쓰는 함정) — medium 은 나머지 직각변",
      concepts: ["삼각기둥의 부피", "역산", "피타고라스 정리"],
      gen(rng) {
        const s = makePrism(rng); const V = (s.a * s.b * s.L) / 2; if (V >= 1000) throw new GenFail("V 큼"); const f = prismFig({ legA: String(s.a), length: String(s.L), legB: "y", hyp: "x" });
        return gInst(rng, {
          stimulus: intro(rng, ` The volume of the prism is ${V} cubic units.`), question: `What is the value of $x$?`, correct: s.c,
          wrongs: posW([W(s.b, "step_missing", "나머지 직각변을 답했다."), W(s.a + s.b, "formula_misuse", "직각변의 합을 답했다."), W(sq(s.a * s.a + s.L * s.L), "formula_misuse", "기둥 길이를 직각변으로 썼다."), W(s.c + 1, "other", "계산이 어긋났다."), W(s.c * s.c, "formula_misuse", "제곱 값을 답했다.")]),
          verificationJs: figJs({ V }, f, `${DIM_JS}const b=2*P.V/(D('legA')*D('length')); const c=Math.sqrt(D('legA')**2+b*b); if (Math.abs(c-Math.round(c))>1e-9||Math.abs(b-Math.round(b))>1e-9) throw new Error('정수 아님'); return c;`),
          trace: [rdl("직각변·기둥 길이"), [`V = ½ × ${s.a} × y × ${s.L} = ${V} 에서 y = ${s.b} 이다.`, "Solve the volume equation for the other leg."], [`x² = ${s.a}² + ${s.b}² = ${s.c * s.c} 이다.`, "Pythagorean theorem."], [`x = ${s.c} 이다.`, "Square root."], [`따라서 ${s.c} 이다.`, "State x."]], variant: "hypotenuse_from_volume",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "volume", structure: "두 직각변과 길이가 주어진 삼각기둥의 부피를 구함", extra: "easy: ½ × 두 직각변 × 길이", concepts: ["삼각기둥의 부피"],
      gen(rng) {
        const s = makePrism(rng); const V = (s.a * s.b * s.L) / 2; const f = prismFig({ legA: String(s.a), legB: String(s.b), hyp: String(s.c), length: String(s.L) });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the volume of the prism, in cubic units?`, correct: V,
          wrongs: posW([W(s.a * s.b * s.L, "step_missing", "½ 를 빠뜨렸다."), W((s.a * s.c * s.L) / 2, "formula_misuse", "빗변을 직각변으로 썼다."), W((s.a * s.b) / 2, "step_missing", "밑면의 넓이만 답했다."), W(V + s.a, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}return D('legA')*D('legB')*D('length')/2;`),
          trace: [rdl("직각변·기둥 길이"), [`밑면의 넓이 = ½ × ${s.a} × ${s.b} = ${(s.a * s.b) / 2} 이다.`, "Base area."], [`부피 = ${(s.a * s.b) / 2} × ${s.L} = ${V} 이다.`, "Base area times length."]], variant: "easy_prism_volume",
        }, f);
      },
    },
    {
      lv: "medium", name: "volume_hyp", structure: "한 직각변·빗변·길이가 주어진 삼각기둥의 부피를 구함", extra: "medium: 나머지 직각변을 먼저 구함", concepts: ["삼각기둥의 부피", "피타고라스 정리"],
      gen(rng) {
        const s = makePrism(rng); const V = (s.a * s.b * s.L) / 2; const f = prismFig({ legB: String(s.b), hyp: String(s.c), length: String(s.L), legA: "x" });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the volume of the prism, in cubic units?`, correct: V,
          wrongs: posW([W((s.b * s.c * s.L) / 2, "formula_misuse", "빗변을 직각변으로 썼다."), W(s.a * s.b * s.L, "step_missing", "½ 를 빠뜨렸다."), W((s.a * s.b) / 2, "step_missing", "밑면의 넓이만 답했다."), W(V + s.b, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const a=Math.sqrt(D('hyp')**2-D('legB')**2); if (Math.abs(a-Math.round(a))>1e-9) throw new Error('정수 아님'); return a*D('legB')*D('length')/2;`),
          trace: [rdl("직각변·빗변·기둥 길이"), [`x² = ${s.c}² - ${s.b}² = ${s.a * s.a} 이므로 x = ${s.a} 이다.`, "Find the other leg."], [`부피 = ½ × ${s.a} × ${s.b} × ${s.L} = ${V} 이다.`, "Volume."]], variant: "medium_prism_volume_hyp",
        }, f);
      },
    },
  ],
});
void GenFail; void compFig; void cylFig; void ctxComp; void ctxCyl; void makeCyl; void piList; void piW; void PI_OK;
