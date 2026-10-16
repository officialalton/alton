// area_volume.rectangle_area.LS.P — L자형 합성 도형의 변 라벨에서 빠진 변을 구해 넓이를 구하고, 둘레·두 직사각형의 차·역산으로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { L_JS, lFig, lIntro, makeL, type LScene } from "../ls-kit";

const posW = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
const rdl = (what: string): [string, string] => [`그림에서 ${what} 라벨을 읽는다.`, "Read the labels in the figure."];
const Qa = (rng: Rng) => rng.pick(["What is the area of the shaded region, in square units?".replace("shaded region", "L-shaped region"), "What is the area, in square units, of the region shown?", "Find the area of the figure in square units."]);

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.rectangle_area.LS.P",
  hard: [
    {
      op: "chain2", structure: "전체 가로·세로와 안쪽 가로변·오른쪽 세로변이 주어진 L자형에서 안쪽 세로변을 구한 뒤 (큰 직사각형 − 잘린 직사각형)으로 넓이를 구함", extra: "빠진 변(안쪽 세로)을 뺄셈으로 먼저 구해야 함(전체 직사각형 넓이를 답하거나 잘린 직사각형의 한 변을 빼먹는 함정) — medium 은 잘린 직사각형 두 변이 주어진 경우",
      concepts: ["합성 도형의 넓이", "빠진 변 구하기"],
      gen(rng) {
        const s = makeL(rng); const A = s.W * s.H - s.a * s.b; const f = lFig(s, { 0: String(s.W), 5: String(s.H), 2: String(s.a), 1: String(s.h1) });
        return gInst(rng, {
          stimulus: lIntro(rng), question: Qa(rng), correct: A,
          wrongs: posW([W(s.W * s.H, "step_missing", "큰 직사각형의 넓이를 답했다."), W(s.W * s.H - s.a * s.h1, "formula_misuse", "잘린 직사각형의 세로를 h1 로 썼다."), W(s.W * s.h1 + s.a * s.b, "formula_misuse", "아래 직사각형에 잘린 부분을 더했다."), W(A + s.a, "other", "계산이 어긋났다."), W(s.W * s.h1, "step_missing", "아래 직사각형만 답했다.")]),
          verificationJs: figJs({}, f, `${L_JS}const W=E(0),H=E(5),a=E(2),h1=E(1); const b=H-h1; if(!(b>0&&a>0&&a<W)) throw new Error('치수 오류'); return W*H-a*b;`),
          trace: [rdl("전체 가로·세로, 안쪽 가로변, 오른쪽 세로변"), [`잘린 직사각형의 세로 = ${s.H} - ${s.h1} = ${s.b} 이다.`, "Find the missing vertical side."], [`전체 직사각형 = ${s.W} × ${s.H} = ${s.W * s.H} 이다.`, "The bounding rectangle."], [`잘린 직사각형 = ${s.a} × ${s.b} = ${s.a * s.b} 이다.`, "The removed rectangle."], [`넓이 = ${s.W * s.H} - ${s.a * s.b} = ${A} 이다.`, "Subtract."]], variant: "area_missing_side",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "L자형의 둘레를 구함(일부 변만 라벨)", extra: "L자형의 둘레는 바깥 직사각형의 둘레와 같음을 써야 함(라벨된 변만 더하는 함정) — medium 은 넓이",
      concepts: ["합성 도형의 둘레", "빠진 변 구하기"],
      gen(rng) {
        const s = makeL(rng); const P = 2 * (s.W + s.H); const f = lFig(s, { 0: String(s.W), 5: String(s.H), 4: String(s.w1), 1: String(s.h1) });
        return gInst(rng, {
          stimulus: lIntro(rng), question: rng.pick(["What is the perimeter of the figure, in units?", "What is the distance around the region, in units?"]), correct: P,
          wrongs: posW([W(s.W + s.H + s.w1 + s.h1, "step_missing", "라벨된 변만 더했다."), W(2 * (s.W + s.H) - s.a - s.b, "formula_misuse", "잘린 부분의 변을 뺐다."), W(2 * (s.W + s.H) + s.a + s.b, "formula_misuse", "잘린 부분의 변을 더 더했다."), W(s.W * s.H, "geometry_misapplied", "넓이를 답했다."), W(2 * (s.W + s.H) + 2, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${L_JS}return 2*(E(0)+E(5));`),
          trace: [rdl("아래·왼쪽·위·오른쪽 변"), [`안쪽 가로변 = ${s.W} - ${s.w1} = ${s.a}, 안쪽 세로변 = ${s.H} - ${s.h1} = ${s.b} 이다.`, "Find the two inner sides."], [`둘레 = ${s.W} + ${s.h1} + ${s.a} + ${s.b} + ${s.w1} + ${s.H} 이다.`, "Add all six sides."], [`= ${P} 이고 바깥 직사각형의 둘레 2(${s.W} + ${s.H}) 와 같다.`, "Equals the bounding rectangle's perimeter."], [`따라서 ${P} 이다.`, "State the perimeter."]], variant: "perimeter_l_shape",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "가로 선으로 나눈 아래 직사각형과 위 직사각형의 넓이 차를 구함", extra: "두 직사각형의 변을 각각 구해(위 직사각형의 세로는 뺄셈) 넓이를 빼야 함(변끼리 빼는 함정) — medium 은 한 직사각형의 넓이",
      concepts: ["합성 도형의 넓이", "두 넓이 비교"],
      gen(rng) {
        const s = makeL(rng); const lo = s.W * s.h1, up = s.w1 * s.b; if (lo === up) throw new GenFail("같음"); const f = lFig(s, { 0: String(s.W), 5: String(s.H), 4: String(s.w1), 1: String(s.h1) });
        return gInst(rng, {
          stimulus: lIntro(rng, " A horizontal segment extended from the inner corner splits the region into a lower rectangle and an upper rectangle."), question: `What is the positive difference between the area of the lower rectangle and the area of the upper rectangle?`, correct: Math.abs(lo - up),
          wrongs: posW([W(lo, "step_missing", "아래 직사각형만 답했다."), W(up, "step_missing", "위 직사각형만 답했다."), W(lo + up, "sign_error", "합을 구했다."), W(Math.abs(s.W * s.h1 - s.w1 * s.H), "formula_misuse", "위 직사각형의 세로를 H 로 썼다."), W(Math.abs(lo - up) + s.w1, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${L_JS}const W=E(0),H=E(5),w1=E(4),h1=E(1); return Math.abs(W*h1-w1*(H-h1));`),
          trace: [rdl("아래·왼쪽·위·오른쪽 변"), [`아래 직사각형 = ${s.W} × ${s.h1} = ${lo} 이다.`, "Lower rectangle."], [`위 직사각형의 세로 = ${s.H} - ${s.h1} = ${s.b} 이므로 넓이 = ${s.w1} × ${s.b} = ${up} 이다.`, "Upper rectangle."], [`차 = |${lo} - ${up}| = ${Math.abs(lo - up)} 이다.`, "Subtract."], [`따라서 ${Math.abs(lo - up)} 이다.`, "State the difference."]], variant: "rectangle_difference",
        }, f);
      },
    },
    {
      op: "inverse", structure: "넓이가 주어지고 위쪽 가로변이 x 로 가려질 때 방정식을 세워 x 를 구함", extra: "넓이 = 아래 직사각형 + 위 직사각형 으로 방정식을 세워야 함(x 를 전체 가로에 곱하는 함정) — medium 은 넓이",
      concepts: ["합성 도형의 넓이", "방정식", "역산"],
      gen(rng) {
        const s = makeL(rng); const A = s.W * s.h1 + s.w1 * s.b; if (A >= 1000) throw new GenFail("큼"); const f = lFig(s, { 0: String(s.W), 5: String(s.H), 1: String(s.h1), 4: "x" });
        return gInst(rng, {
          stimulus: lIntro(rng, ` The area of the region is ${A} square units.`), question: rng.pick(["What is the value of $x$?", "What is $x$?"]), correct: s.w1,
          wrongs: posW([W(Math.round(((A / s.H) * 100)) / 100, "formula_misuse", "전체 세로로 나눴다."), W(Math.round(((A - s.W * s.h1) / s.H) * 100) / 100, "formula_misuse", "위 직사각형의 세로를 H 로 썼다."), W(s.a, "step_missing", "잘린 가로를 답했다."), W(s.W - s.w1 + 1, "other", "계산이 어긋났다."), W(s.W, "step_missing", "전체 가로를 답했다.")]),
          verificationJs: figJs({ A }, f, `${L_JS}const W=E(0),H=E(5),h1=E(1); const x=(P.A-W*h1)/(H-h1); if (Math.abs(x-Math.round(x))>1e-9||!(x>0&&x<W)) throw new Error('x 해석 불가'); return x;`),
          trace: [rdl("아래·왼쪽·오른쪽 변"), [`아래 직사각형 = ${s.W} × ${s.h1} = ${s.W * s.h1} 이다.`, "Lower rectangle."], [`위 직사각형 = x × (${s.H} - ${s.h1}) = ${s.b}x 이다.`, "Upper rectangle."], [`${s.W * s.h1} + ${s.b}x = ${A} 에서 x = ${s.w1} 이다.`, "Solve."], [`따라서 ${s.w1} 이다.`, "State x."]], variant: "solve_x_from_area",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "area_notch", structure: "큰 직사각형에서 잘린 직사각형을 뺀 L자형의 넓이를 구함", extra: "easy: 전체 − 잘린 부분", concepts: ["합성 도형의 넓이", "문제 조건 해석"],
      gen(rng) {
        const s = makeL(rng); const A = s.W * s.H - s.a * s.b; const f = lFig(s, { 0: String(s.W), 5: String(s.H), 2: String(s.a), 3: String(s.b) });
        return gInst(rng, {
          stimulus: lIntro(rng), question: Qa(rng), correct: A,
          wrongs: posW([W(s.W * s.H, "step_missing", "큰 직사각형의 넓이를 답했다."), W(s.W * s.H + s.a * s.b, "sign_error", "더했다."), W(s.a * s.b, "step_missing", "잘린 부분만 답했다."), W(A + s.b, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${L_JS}return E(0)*E(5)-E(2)*E(3);`),
          trace: [rdl("전체 가로·세로, 잘린 가로·세로"), [`넓이 = ${s.W} × ${s.H} - ${s.a} × ${s.b} = ${A} 이다.`, "Bounding rectangle minus the notch."]], variant: "easy_area_notch",
        }, f);
      },
    },
    {
      lv: "medium", name: "area_split", structure: "두 직사각형으로 나눠 L자형의 넓이를 구함", extra: "medium: 위 직사각형의 세로를 뺄셈으로 구함", concepts: ["합성 도형의 넓이", "빠진 변 구하기"],
      gen(rng) {
        const s = makeL(rng); const A = s.W * s.h1 + s.w1 * s.b; const f = lFig(s, { 0: String(s.W), 5: String(s.H), 4: String(s.w1), 1: String(s.h1) });
        return gInst(rng, {
          stimulus: lIntro(rng), question: Qa(rng), correct: A,
          wrongs: posW([W(s.W * s.H, "step_missing", "큰 직사각형의 넓이를 답했다."), W(s.W * s.h1 + s.w1 * s.H, "formula_misuse", "위 직사각형의 세로를 H 로 썼다."), W(s.W * s.h1, "step_missing", "아래 직사각형만 답했다."), W(A + s.w1, "other", "계산이 어긋났다.")]),
          verificationJs: figJs({}, f, `${L_JS}return E(0)*E(1)+E(4)*(E(5)-E(1));`),
          trace: [rdl("아래·왼쪽·위·오른쪽 변"), [`아래 직사각형 = ${s.W} × ${s.h1} = ${s.W * s.h1} 이다.`, "Lower rectangle."], [`위 직사각형 = ${s.w1} × (${s.H} - ${s.h1}) = ${s.w1 * s.b} 이다.`, "Upper rectangle."]], variant: "medium_area_split",
        }, f);
      },
    },
  ],
});
void ({} as LScene);
