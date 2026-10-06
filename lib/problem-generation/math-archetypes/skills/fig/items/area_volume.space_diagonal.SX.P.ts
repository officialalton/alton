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
  prefix: "av", itemId: "area_volume.space_diagonal.SX.P",
  hard: [
    {
      op: "chain2", structure: "공간 대각선과 두 모서리에서 나머지 모서리를 구한 뒤 부피를 구함", extra: "대각선² 에서 세 번째 모서리를 먼저 구해야 부피를 계산할 수 있음(대각선을 모서리로 쓰는 함정) — medium 은 나머지 모서리",
      concepts: ["공간 대각선", "피타고라스 정리", "직육면체의 부피"],
      gen(rng) {
        const s = makeBox(rng); const V = s.l * s.w * s.h; const f = boxFig("space", { length: String(s.l), width: String(s.w), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: `What is the volume of the box, in cubic units?`, correct: V,
          wrongs: posW([W(s.l * s.w * s.d, "formula_misuse", "대각선을 높이로 썼다."), W(s.l * s.w, "step_missing", "밑면의 넓이를 답했다."), W(s.h, "step_missing", "높이만 답했다."), W(s.l * s.w * (s.d - s.l - s.w), "formula_misuse", "높이를 뺄셈으로 구했다."), W(2 * (s.l * s.w + s.l * s.h + s.w * s.h), "geometry_misapplied", "겉넓이를 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const h=Math.sqrt(D('diag')**2-D('length')**2-D('width')**2); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return D('length')*D('width')*h;`),
          trace: [rdl("길이·너비·대각선"), [`${s.d}² = ${s.l}² + ${s.w}² + x² 에서 x² = ${s.h * s.h} 이므로 x = ${s.h} 이다.`, "Find the missing edge."], [`부피 = 길이 × 너비 × 높이 = ${s.l} × ${s.w} × ${s.h} 이다.`, "Volume of a box."], [`= ${V} 이다.`, "Multiply."], [`따라서 ${V} 이다.`, "State the volume."]], variant: "volume_from_diagonal",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "공간 대각선과 두 모서리에서 나머지 모서리를 구해 겉넓이를 구함", extra: "세 모서리를 모두 알아낸 뒤 세 쌍의 넓이를 2 배로 더해야 함(부피를 답하는 함정) — medium 은 나머지 모서리",
      concepts: ["공간 대각선", "피타고라스 정리", "겉넓이"],
      gen(rng) {
        const s = makeBox(rng); const SA = 2 * (s.l * s.w + s.l * s.h + s.w * s.h); const f = boxFig("space", { length: String(s.l), height: String(s.h), diag: String(s.d), width: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: `What is the total surface area of the box, in square units?`, correct: SA,
          wrongs: posW([W(s.l * s.w * s.h, "geometry_misapplied", "부피를 답했다."), W(s.l * s.w + s.l * s.h + s.w * s.h, "step_missing", "2 배를 빠뜨렸다."), W(2 * (s.l * s.h), "step_missing", "한 쌍의 넓이만 답했다."), W(2 * (s.l * s.w + s.l * s.d + s.w * s.d), "formula_misuse", "대각선을 모서리로 썼다."), W(SA - 2 * s.w * s.h, "step_missing", "한 쌍의 면을 빠뜨렸다."), W(SA + 2, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const w=Math.sqrt(D('diag')**2-D('length')**2-D('height')**2); if (Math.abs(w-Math.round(w))>1e-9) throw new Error('정수 아님'); const l=D('length'), h=D('height'); return 2*(l*w+l*h+w*h);`),
          trace: [rdl("길이·높이·대각선"), [`${s.d}² = ${s.l}² + x² + ${s.h}² 에서 x = ${s.w} 이다.`, "Find the missing edge."], [`세 쌍의 넓이: ${s.l}×${s.w}, ${s.l}×${s.h}, ${s.w}×${s.h} 이다.`, "Three pairs of faces."], [`겉넓이 = 2 × (${s.l * s.w} + ${s.l * s.h} + ${s.w * s.h}) = ${SA} 이다.`, "Double the sum."], [`따라서 ${SA} 이다.`, "State the surface area."]], variant: "surface_area_from_diagonal",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "세 모서리를 구한 뒤 공간 대각선과 가장 긴 모서리의 길이 차를 구함", extra: "가장 긴 모서리를 고르고 대각선에서 빼야 함(가장 짧은 모서리를 쓰는 함정) — medium 은 나머지 모서리",
      concepts: ["공간 대각선", "두 길이 비교"],
      gen(rng) {
        const s = makeBox(rng); const mx = Math.max(s.l, s.w, s.h); const f = boxFig("space", { length: String(s.l), width: String(s.w), height: String(s.h), diag: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: `By how much does the space diagonal exceed the longest edge of the box?`, correct: s.d - mx,
          wrongs: posW([W(s.d - Math.min(s.l, s.w, s.h), "other", "가장 짧은 모서리를 뺐다."), W(s.d, "step_missing", "대각선만 답했다."), W(mx, "step_missing", "가장 긴 모서리를 답했다."), W(s.d - (s.l + s.w + s.h) / 3, "formula_misuse", "평균을 뺐다."), W(s.d + mx, "sign_error", "합을 구했다."), W(s.d - mx + 1, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const x=Math.sqrt(D('length')**2+D('width')**2+D('height')**2); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x-Math.max(D('length'),D('width'),D('height'));`),
          trace: [rdl("길이·너비·높이"), [`x² = ${s.l}² + ${s.w}² + ${s.h}² = ${s.d * s.d} 이므로 x = ${s.d} 이다.`, "Space diagonal."], [`가장 긴 모서리는 ${mx} 이다.`, "The longest edge."], [`차 = ${s.d} - ${mx} = ${s.d - mx} 이다.`, "Subtract."], [`따라서 ${s.d - mx} 이다.`, "State the difference."]], variant: "diagonal_minus_longest_edge",
        }, f);
      },
    },
    {
      op: "inverse", structure: "길이 = 2x·너비 = x 로 주어지고 높이와 공간 대각선이 주어질 때 방정식으로 x 를 구함", extra: "5x² + h² = d² 로 세워 풀어야 함(길이와 너비를 같게 보는 함정) — medium 은 공간 대각선",
      concepts: ["공간 대각선", "방정식", "역산"],
      gen(rng) {
        const [x, h, d] = rng.pick([[1, 2, 3], [2, 4, 6], [3, 6, 9], [3, 2, 7], [4, 8, 12], [4, 1, 9], [5, 10, 15], [6, 12, 18], [6, 4, 14], [7, 14, 21], [8, 16, 24], [8, 11, 21], [8, 2, 18]] as [number, number, number][]); const f = boxFig("space", { length: "2x", width: "x", height: String(h), diag: String(d) });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: rng.pick(["What is the value of $x$?", "What is $x$?", "Find the value of $x$."]), correct: x,
          wrongs: posW([W(Math.round(sq((d * d - h * h) / 2) * 100) / 100, "formula_misuse", "길이와 너비를 같게 보았다."), W(Math.round(sq(d * d - h * h) * 100) / 100, "formula_misuse", "x² 만 있다고 보았다."), W(2 * x, "step_missing", "길이를 답했다."), W(x + 1, "other", "계산이 어긋났다."), W(h, "step_missing", "높이를 답했다."), W(x + 2, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `if (!FIGURE||FIGURE.type!=='solid_x') throw new Error('자료 필요'); const g=(id)=>{ const q=FIGURE.dims.find(z=>z.id===id); return q?q.label:null; }; if (g('length')!=='2x'||g('width')!=='x') throw new Error('식 라벨 필요'); const h=Number(g('height')), d=Number(g('diag')); const x=Math.sqrt((d*d-h*h)/5); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("길이 2x·너비 x·높이·대각선"), [`${d}² = (2x)² + x² + ${h}² 이다.`, "Space diagonal formula with the variable edges."], [`5x² = ${d * d} - ${h * h} = ${d * d - h * h} 이므로 x² = ${x * x} 이다.`, "Solve for x²."], [`x = ${x} 이다.`, "Take the positive root."], [`따라서 ${x} 이다.`, "State x."]], variant: "solve_x_from_diagonal",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "space_diagonal", structure: "세 모서리가 주어진 직육면체의 공간 대각선을 구함", extra: "easy: 세 제곱의 합의 제곱근", concepts: ["공간 대각선"],
      gen(rng) {
        const s = makeBox(rng); const f = boxFig("space", { length: String(s.l), width: String(s.w), height: String(s.h), diag: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: `What is the length of the space diagonal, shown as $x$?`, correct: s.d,
          wrongs: posW([W(s.l + s.w + s.h, "formula_misuse", "세 모서리를 더했다."), W(sq(s.l * s.l + s.w * s.w), "step_missing", "밑면 대각선을 답했다."), W(s.d * s.d, "formula_misuse", "제곱근을 취하지 않았다."), W(sq(s.l * s.l + s.h * s.h), "step_missing", "앞면 대각선을 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const x=Math.sqrt(D('length')**2+D('width')**2+D('height')**2); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("길이·너비·높이"), [`x² = ${s.l}² + ${s.w}² + ${s.h}² = ${s.d * s.d} 이다.`, "Three squares."], [`x = ${s.d} 이다.`, "Square root."]], variant: "easy_space_diagonal",
        }, f);
      },
    },
    {
      lv: "medium", name: "missing_edge", structure: "공간 대각선과 두 모서리에서 나머지 모서리를 구함", extra: "medium: 대각선² − 두 제곱", concepts: ["공간 대각선", "역산"],
      gen(rng) {
        const s = makeBox(rng); const f = boxFig("space", { length: String(s.l), width: String(s.w), diag: String(s.d), height: "x" });
        return gInst(rng, {
          stimulus: boxIntro(rng), question: `What is the height of the box, shown as $x$?`, correct: s.h,
          wrongs: posW([W(s.d - s.l - s.w, "formula_misuse", "그냥 뺐다."), W(sq(s.d * s.d - s.l * s.l), "step_missing", "한 모서리만 뺐다."), W(s.d, "step_missing", "대각선을 답했다."), W(s.h * s.h, "formula_misuse", "제곱 값을 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const x=Math.sqrt(D('diag')**2-D('length')**2-D('width')**2); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return x;`),
          trace: [rdl("길이·너비·대각선"), [`${s.d}² = ${s.l}² + ${s.w}² + x² 에서 x² = ${s.h * s.h} 이다.`, "Solve for x²."], [`x = ${s.h} 이다.`, "Square root."]], variant: "medium_missing_edge",
        }, f);
      },
    },
  ],
});
void ({} as BoxScene); void GenFail; void compFig; void cylFig; void ctxComp; void ctxCyl; void ctxPrism; void makeCyl; void makePrism; void piT; void prismFig;
