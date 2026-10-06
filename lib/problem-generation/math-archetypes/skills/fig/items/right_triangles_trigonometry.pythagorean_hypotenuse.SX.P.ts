import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { DIM_JS, boxFig, compFig, cylFig, ctxBox, ctxComp, ctxCyl, ctxPrism, makeBox, makeCyl, makePrism, piT, prismFig, type BoxScene } from "../sx-kit";
const posW = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
const rdl = (what: string): [string, string] => [`그림에서 ${what} 라벨을 읽는다.`, "Read the labels in the figure."];
const sq = (n: number) => Math.round(Math.sqrt(n) * 1000) / 1000;
const boxIntro = (rng: Rng, extra = "") => `${ctxBox(rng)}` + extra;

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.pythagorean_hypotenuse.SX.P",
  hard: [
    {
      op: "chain2", structure: "직육면체의 세 모서리 길이에서 밑면 대각선(첫 직각삼각형)을 거쳐 공간 대각선(둘째 직각삼각형)을 구함", extra: "피타고라스 정리를 두 번 연속 써야 함(세 모서리의 합이나 한 번만 적용하는 함정) — medium 은 한 번",
      concepts: ["피타고라스 정리", "입체의 대각선", "연쇄 적용"],
      gen(rng) {
        const s = makeBox(rng); const f = boxFig("space", { length: String(s.l), width: String(s.w), height: String(s.h), diag: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: rng.pick(["What is the length of the space diagonal, shown as $x$?", "What is the value of $x$?"]), correct: s.d,
          wrongs: posW([W(sq(s.l * s.l + s.w * s.w), "step_missing", "밑면 대각선만 구했다."), W(s.l + s.w + s.h, "formula_misuse", "세 모서리를 더했다."), W(sq(s.l * s.l + s.w * s.w) + s.h, "formula_misuse", "밑면 대각선에 높이를 더했다."), W(s.d * s.d, "formula_misuse", "제곱근을 취하지 않았다."), W(sq(s.l * s.l + s.h * s.h + s.w), "formula_misuse", "한 모서리를 제곱하지 않았다."), W(s.d + 1, "other", "계산이 어긋났다."), W(s.d - 1, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const x=Math.sqrt(D('length')**2+D('width')**2+D('height')**2); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("길이·너비·높이"), [`밑면 대각선² = ${s.l}² + ${s.w}² = ${s.l * s.l + s.w * s.w} 이다.`, "First right triangle on the bottom face."], [`공간 대각선² = 밑면 대각선² + ${s.h}² = ${s.l * s.l + s.w * s.w + s.h * s.h} 이다.`, "Second right triangle with the height."], [`x = √${s.d * s.d} = ${s.d} 이다.`, "Take the square root."], [`따라서 ${s.d} 이다.`, "State the length."]], variant: "space_diagonal_two_steps",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "밑면 대각선·높이·공간 대각선이 이루는 직각삼각형의 둘레를 구함", extra: "밑면 대각선과 공간 대각선을 모두 구해 높이와 더해야 함(한 대각선만 쓰는 함정) — medium 은 밑면 대각선",
      concepts: ["피타고라스 정리", "입체의 대각선", "둘레"],
      gen(rng) {
        const s = makeBox(rng, { faceOk: true }); const f = boxFig("both", { length: String(s.l), width: String(s.w), height: String(s.h), diag: "x", face: "y" }); const per = s.f + s.h + s.d;
        return gInst(rng, {
          stimulus: boxIntro(rng, rng.pick([" The bottom diagonal is marked $y$ and the space diagonal is marked $x$.", " In the figure, $y$ is the length of the diagonal of the bottom face and $x$ is the length of the diagonal through the box.", " The dashed segments are labeled $y$ (across the bottom) and $x$ (through the inside of the box)."])), question: rng.pick(["What is the perimeter of the right triangle formed by the bottom diagonal, the height, and the space diagonal?", "The bottom diagonal, the height, and the space diagonal form a right triangle. What is its perimeter?", "What is the sum of the lengths of the three sides of the right triangle made by the bottom diagonal, the height, and the space diagonal?"]), correct: per,
          wrongs: posW([W(s.f + s.d, "step_missing", "높이를 빠뜨렸다."), W(s.l + s.w + s.h, "formula_misuse", "세 모서리를 더했다."), W(s.d + s.h + s.l, "other", "밑면 대각선 대신 길이를 더했다."), W(s.f + s.h, "step_missing", "공간 대각선을 빠뜨렸다."), W(per + s.h, "other", "높이를 두 번 더했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const fd=Math.sqrt(D('length')**2+D('width')**2); const sd=Math.sqrt(fd*fd+D('height')**2); if (Math.abs(fd-Math.round(fd))>1e-9||Math.abs(sd-Math.round(sd))>1e-9) throw new Error('정수 아님'); return fd+D('height')+sd;`),
          trace: [rdl("길이·너비·높이"), [`y² = ${s.l}² + ${s.w}² 이므로 y = ${s.f} 이다.`, "Bottom diagonal."], [`x² = y² + ${s.h}² = ${s.f * s.f + s.h * s.h} 이므로 x = ${s.d} 이다.`, "Space diagonal."], [`둘레 = ${s.f} + ${s.h} + ${s.d} = ${per} 이다.`, "Add the three sides."], [`따라서 ${per} 이다.`, "State the perimeter."]], variant: "diagonal_triangle_perimeter",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "공간 대각선과 밑면 대각선을 각각 구해 길이의 차를 구함", extra: "두 대각선을 따로 구해 빼야 함(높이로 단순화하는 함정) — medium 은 한 대각선",
      concepts: ["피타고라스 정리", "입체의 대각선", "두 길이 비교"],
      gen(rng) {
        const s = makeBox(rng, { faceOk: true }); const f = boxFig("both", { length: String(s.l), width: String(s.w), height: String(s.h), diag: "x", face: "y" });
        return gInst(rng, {
          stimulus: boxIntro(rng, rng.pick([" The bottom diagonal is marked $y$ and the space diagonal is marked $x$.", " In the figure, $y$ is the length of the diagonal of the bottom face and $x$ is the length of the diagonal through the box.", " The dashed segments are labeled $y$ (across the bottom) and $x$ (through the inside of the box)."])), question: rng.pick(["How much longer is the space diagonal than the bottom diagonal?", "By how much does the length of the space diagonal exceed the length of the bottom diagonal?", "What is the difference between the lengths of the space diagonal and the bottom diagonal?"]), correct: s.d - s.f,
          wrongs: posW([W(s.h, "formula_misuse", "높이를 답했다."), W(s.d, "step_missing", "공간 대각선만 답했다."), W(s.f, "step_missing", "밑면 대각선만 답했다."), W(s.d + s.f, "sign_error", "합을 구했다."), W(s.d - s.l, "other", "길이를 빼서 구했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const fd=Math.sqrt(D('length')**2+D('width')**2); const sd=Math.sqrt(fd*fd+D('height')**2); if (Math.abs(fd-Math.round(fd))>1e-9||Math.abs(sd-Math.round(sd))>1e-9) throw new Error('정수 아님'); return sd-fd;`),
          trace: [rdl("길이·너비·높이"), [`밑면 대각선 y = √(${s.l}² + ${s.w}²) = ${s.f} 이다.`, "Bottom diagonal."], [`공간 대각선 x = √(${s.f}² + ${s.h}²) = ${s.d} 이다.`, "Space diagonal."], [`차 = ${s.d} - ${s.f} = ${s.d - s.f} 이다.`, "Subtract."], [`따라서 ${s.d - s.f} 이다.`, "State the difference."]], variant: "diagonal_difference",
        }, f);
      },
    },
    {
      op: "inverse", structure: "공간 대각선과 두 모서리가 주어질 때 피타고라스 정리를 거꾸로 써서 나머지 모서리를 구함", extra: "대각선² 에서 알려진 두 모서리의 제곱을 빼야 함(제곱을 빠뜨리거나 합으로 구하는 함정) — medium 은 공간 대각선",
      concepts: ["피타고라스 정리", "입체의 대각선", "역산"],
      gen(rng) {
        const s = makeBox(rng); const f = boxFig("space", { length: String(s.l), height: String(s.h), diag: String(s.d), width: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: `What is the value of $x$, the width of the box?`, correct: s.w,
          wrongs: posW([W(s.d - s.l - s.h, "formula_misuse", "대각선에서 두 모서리를 그냥 뺐다."), W(sq(s.d * s.d - s.l * s.l), "step_missing", "높이를 빼지 않았다."), W(sq(s.d * s.d + s.l * s.l + s.h * s.h), "sign_error", "더해서 구했다."), W(s.d, "step_missing", "대각선을 답했다."), W(s.w * s.w, "formula_misuse", "제곱 값을 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const x=Math.sqrt(D('diag')**2-D('length')**2-D('height')**2); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("길이·높이·대각선"), [`공간 대각선² = 길이² + 너비² + 높이² 이다.`, "The space diagonal formula."], [`${s.d}² = ${s.l}² + x² + ${s.h}² 이므로 x² = ${s.d * s.d} - ${s.l * s.l} - ${s.h * s.h} = ${s.w * s.w} 이다.`, "Solve for x²."], [`x = ${s.w} 이다.`, "Take the square root."], [`따라서 ${s.w} 이다.`, "State the width."]], variant: "missing_edge_from_diagonal",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "face_diagonal", structure: "직육면체 밑면 대각선의 길이를 구함", extra: "easy: 한 번의 피타고라스", concepts: ["피타고라스 정리", "밑면 대각선"],
      gen(rng) {
        const s = makeBox(rng, { faceOk: true }); const f = boxFig("face_bottom", { length: String(s.l), width: String(s.w), height: String(s.h), diag: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng, " The dashed segment on the bottom face is marked $x$."), question: `What is the value of $x$?`, correct: s.f,
          wrongs: posW([W(s.l + s.w, "formula_misuse", "두 변을 더했다."), W(s.f * s.f, "formula_misuse", "제곱근을 취하지 않았다."), W(sq(s.l * s.l + s.w * s.w + s.h * s.h), "geometry_misapplied", "공간 대각선을 답했다."), W(Math.abs(s.l - s.w), "formula_misuse", "두 변의 차를 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const x=Math.sqrt(D('length')**2+D('width')**2); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("길이·너비"), [`x² = ${s.l}² + ${s.w}² = ${s.l * s.l + s.w * s.w} 이다.`, "Pythagorean theorem."], [`x = ${s.f} 이다.`, "Square root."]], variant: "easy_face_diagonal",
        }, f);
      },
    },
    {
      lv: "medium", name: "space_diagonal", structure: "세 모서리가 주어진 직육면체의 공간 대각선을 구함", extra: "medium: 세 제곱의 합의 제곱근", concepts: ["피타고라스 정리", "공간 대각선"],
      gen(rng) {
        const s = makeBox(rng); const f = boxFig("space", { length: String(s.l), width: String(s.w), height: String(s.h), diag: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: `What is the value of $x$?`, correct: s.d,
          wrongs: posW([W(s.l + s.w + s.h, "formula_misuse", "세 모서리를 더했다."), W(sq(s.l * s.l + s.w * s.w), "step_missing", "밑면 대각선을 답했다."), W(s.d * s.d, "formula_misuse", "제곱근을 취하지 않았다."), W(sq(s.w * s.w + s.h * s.h), "step_missing", "옆면 대각선을 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const x=Math.sqrt(D('length')**2+D('width')**2+D('height')**2); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("길이·너비·높이"), [`x² = ${s.l}² + ${s.w}² + ${s.h}² = ${s.d * s.d} 이다.`, "Three squares."], [`x = ${s.d} 이다.`, "Square root."]], variant: "medium_space_diagonal",
        }, f);
      },
    },
  ],
});
void ({} as BoxScene); void GenFail; void compFig; void cylFig; void ctxComp; void ctxCyl; void ctxPrism; void makeCyl; void makePrism; void piT; void prismFig;
