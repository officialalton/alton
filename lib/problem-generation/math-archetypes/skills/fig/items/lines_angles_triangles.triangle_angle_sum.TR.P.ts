// lines_angles_triangles.triangle_angle_sum.TR.P — 삼각형 그림의 세 각 라벨(x 의 일차식)에서 내각의 합 180°로 x 와 각을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { ANG_JS, angRead, exprLabel, makeExprTri, sumStep, triIntro } from "../tri-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && w.v < 180);

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.triangle_angle_sum.TR.P",
  hard: [
    {
      op: "compose_kind", structure: "세 각의 일차식 라벨에서 내각의 합 180° 로 x 를 구한 뒤 가장 큰 각의 크기를 구함", extra: "방정식으로 x 를 구하고 각각에 되돌려 가장 큰 각을 골라야 함(x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "일차방정식", "각의 크기 비교"],
      gen(rng) {
        const t = makeExprTri(rng); const mx = Math.max(...t.deg); const i = t.deg.indexOf(mx);
        return gInst(rng, {
          stimulus: triIntro(rng, t.v),
          question: rng.pick([`What is the measure, in degrees, of the largest angle of the triangle?`, `What is the degree measure of the largest angle in triangle $${t.v.join("")}$?`, `Which degree measure belongs to the greatest of the three angles?`, `How many degrees does the largest interior angle measure?`, `The greatest angle of triangle $${t.v.join("")}$ measures how many degrees?`]), correct: mx,
          wrongs: pos([W(t.x, "step_missing", "x 를 답했다."), W(Math.min(...t.deg), "opposite", "가장 작은 각을 답했다."), W(t.a[i] * t.x, "step_missing", "상수항을 더하지 않았다."), W(180 - mx, "formula_misuse", "나머지 두 각의 합을 답했다."), W(mx + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== mx),
          verificationJs: figJs({}, t.fig, `${ANG_JS}return Math.max(...deg);`),
          trace: [angRead(t), sumStep(t), [`각: ${t.v.map((n, k) => `∠${n} = ${t.deg[k]}°`).join(", ")} 이다.`, "Substitute x into each angle."], [`가장 큰 각은 ∠${t.v[i]} = ${mx}° 이다.`, "Pick the largest."], [`따라서 ${mx} 이다.`, "State the measure."]], variant: "largest_angle_from_expressions",
        }, t.fig);
      },
    },
    {
      op: "chain2", structure: "세 각 라벨에서 x 를 구한 뒤 한 꼭짓점의 외각(= 180° − 내각)을 구함", extra: "x → 내각 → 외각(보각)의 연쇄 — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "일차방정식", "외각"],
      gen(rng) {
        const t = makeExprTri(rng); const i = rng.int(0, 2); const correct = 180 - t.deg[i];
        return gInst(rng, {
          stimulus: triIntro(rng, t.v),
          question: rng.pick([`The side of the triangle is extended past vertex $${t.v[i]}$. What is the measure, in degrees, of the exterior angle at $${t.v[i]}$?`, `What is the measure, in degrees, of an exterior angle of the triangle at vertex $${t.v[i]}$?`, `If a side is extended beyond vertex $${t.v[i]}$, how many degrees is the exterior angle formed there?`, `At vertex $${t.v[i]}$, one side is extended. What is the degree measure of the resulting exterior angle?`, `An exterior angle is formed at $${t.v[i]}$ by extending a side. How many degrees does it measure?`]), correct,
          wrongs: pos([W(t.deg[i], "step_missing", "내각을 답했다."), W(t.x, "step_missing", "x 를 답했다."), W(180 - t.a[i] * t.x, "step_missing", "상수항을 빼지 않았다."), W(t.deg[(i + 1) % 3], "other", "다른 꼭짓점의 각을 답했다."), W(correct + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ at: t.v[i] }, t.fig, `${ANG_JS}const i=V.indexOf(P.at); if (i<0) throw new Error('꼭짓점 없음'); return 180-deg[i];`),
          trace: [angRead(t), sumStep(t), [`∠${t.v[i]} = ${exprLabel(t.a[i], t.b[i])} = ${t.deg[i]}° 이다.`, "The interior angle."], [`외각 = 180° - ${t.deg[i]}° = ${correct}° 이다.`, "Exterior = 180° minus the interior angle."], [`따라서 ${correct} 이다.`, "State the measure."]], variant: "exterior_angle_from_expressions",
        }, t.fig);
      },
    },
    {
      op: "repr_shift", structure: "세 각이 x°, 2x°, 3x° 처럼 비로 라벨된 삼각형에서 비를 식으로 번역해 합 180° 로 지정한 각의 크기를 구함", extra: "비 라벨을 식으로 옮기고 합 = 180° 를 풀어 가장 작은(또는 큰) 각을 골라야 함 — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "비", "일차방정식"],
      gen(rng) {
        const t = makeExprTri(rng, { ratio: true }); const small = Math.min(...t.deg); const big = Math.max(...t.deg); const askSmall = rng.chance(0.5); const correct = askSmall ? small : big;
        if (small === big) throw new GenFail("same");
        return gInst(rng, {
          stimulus: triIntro(rng, t.v, " The angles are in the ratio shown."),
          question: askSmall ? rng.pick([`What is the measure, in degrees, of the smallest angle?`, `What is the degree measure of the smallest angle of the triangle?`, `The smallest interior angle measures how many degrees?`, `Which degree measure is the least of the three angles?`, `How many degrees is the smallest angle of triangle $${t.v.join("")}$?`]) : rng.pick([`What is the measure, in degrees, of the largest angle?`, `What is the degree measure of the largest angle of the triangle?`, `The largest interior angle measures how many degrees?`, `Which degree measure is the greatest of the three angles?`, `How many degrees is the largest angle of triangle $${t.v.join("")}$?`]), correct,
          wrongs: pos([W(t.x, "step_missing", "x 를 답했다."), W(askSmall ? big : small, "opposite", "반대 각을 답했다."), W(Math.round(180 / 3), "formula_misuse", "세 각이 같다고 보았다."), W(correct * 2, "other", "계산 중 어긋났다."), W(180 - correct, "formula_misuse", "나머지 두 각의 합을 답했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ small: askSmall ? 1 : 0 }, t.fig, `${ANG_JS}return P.small ? Math.min(...deg) : Math.max(...deg);`),
          trace: [angRead(t), [`${t.a.join("x + ")}x = ${t.a[0] + t.a[1] + t.a[2]}x = 180 이므로 x = ${t.x} 이다.`, "The ratio parts add to 180°."], [`각: ${t.deg.join("°, ")}° 이다.`, "The three angles."], [`${askSmall ? "가장 작은" : "가장 큰"} 각은 ${correct}° 이다.`, "Pick the requested angle."], [`따라서 ${correct} 이다.`, "State the measure."]], variant: askSmall ? "smallest_angle_from_ratio" : "largest_angle_from_ratio",
        }, t.fig);
      },
    },
    {
      op: "inverse", structure: "한 각이 숫자, 나머지 두 각이 x 의 일차식일 때 합 180° 에서 숫자 각을 뺀 뒤 x 를 역산해 지정한 각의 크기를 구함", extra: "180° − 숫자 각 = 나머지 두 식의 합 으로 x 를 거꾸로 구해 식에 되돌려야 함(숫자 각을 답하는 함정) — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "일차방정식", "식의 대입"],
      gen(rng) {
        const t = makeExprTri(rng); const k = rng.int(0, 2); const j = (k + rng.int(1, 2)) % 3; const K = t.deg[k];
        const fig = { ...t.fig, angles: t.v.map((n, i) => ({ at: n, label: i === k ? `${K}°` : exprLabel(t.a[i], t.b[i]), value: t.deg[i] })) }; const correct = t.deg[j];
        return gInst(rng, {
          stimulus: triIntro(rng, t.v),
          question: rng.pick([`What is the measure, in degrees, of angle $${t.v[j]}$?`, `What is the degree measure of $\\angle ${t.v[j]}$?`]), correct,
          wrongs: pos([W(t.x, "step_missing", "x 를 답했다."), W(t.a[j] * t.x, "step_missing", "상수항을 더하지 않았다."), W(180 - K, "formula_misuse", "나머지 두 각의 합을 답했다."), W(t.deg[3 - k - j], "other", "셋째 각을 답했다."), W(correct + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ aj: t.v[j] }, fig, `${ANG_JS}const j=V.indexOf(P.aj); if (j<0) throw new Error('꼭짓점 오류'); if (!Number.isFinite(x)) throw new Error('x 없음'); return deg[j];`),
          trace: [[`그림에서 ∠${t.v[k]} = ${K}° 이고 나머지 두 각은 ${[0, 1, 2].filter((i) => i !== k).map((i) => `∠${t.v[i]} = ${exprLabel(t.a[i], t.b[i])}`).join(", ")} 이다.`, "Read the labels."], [`나머지 두 각의 합 = 180° - ${K}° = ${180 - K}° 이다.`, "The other two angles add to 180° minus the given angle."], [`합의 식을 ${180 - K} 와 같게 놓아 x = ${t.x} 를 얻는다.`, "Solve for x."], [`∠${t.v[j]} = ${exprLabel(t.a[j], t.b[j])} = ${correct}° 이다.`, "Substitute."], [`따라서 ${correct} 이다.`, "State the measure."]], variant: "angle_from_one_numeric_angle",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "third_angle", structure: "두 각이 숫자로 주어진 삼각형에서 셋째 각(x°)을 180°에서 빼서 구함", extra: "easy: 내각의 합 180° 한 번 적용", concepts: ["삼각형 내각의 합", "뺄셈"],
      gen(rng) {
        const t = makeExprTri(rng); const a: [number, number, number] = [0, 0, 0]; const b: [number, number, number] = [t.deg[0], t.deg[1], t.deg[2]]; const k = rng.int(0, 2);
        const fig = { ...t.fig, angles: t.v.map((n, i) => ({ at: n, label: i === k ? "x°" : `${t.deg[i]}°`, value: t.deg[i] })) }; void a; void b;
        return gInst(rng, { stimulus: triIntro(rng, t.v), question: rng.pick([`What is the value of $x$?`, `What is the value of $x$ in the triangle shown?`]), correct: t.deg[k], wrongs: pos([W(t.deg[(k + 1) % 3] + t.deg[(k + 2) % 3], "formula_misuse", "두 각의 합을 답했다."), W(90 - t.deg[(k + 1) % 3], "formula_misuse", "90°에서 뺐다."), W(t.deg[(k + 1) % 3], "other", "다른 각을 답했다."), W(t.deg[k] + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== t.deg[k]), verificationJs: figJs({}, fig, `${ANG_JS}return deg.find((d,i)=>E[i].a===1&&E[i].b===0);`), trace: [[`두 각은 ${t.deg[(k + 1) % 3]}°, ${t.deg[(k + 2) % 3]}° 이다.`, "Read the two known angles."], [`x = 180 - ${t.deg[(k + 1) % 3]} - ${t.deg[(k + 2) % 3]} = ${t.deg[k]} 이다.`, "Subtract from 180°."]], variant: "third_angle_numbers",
        }, fig);
      },
    },
    {
      lv: "medium", name: "solve_x", structure: "세 각이 x 의 일차식인 삼각형에서 합 180° 로 x 를 구함", extra: "medium: 일차방정식 한 번", concepts: ["삼각형 내각의 합", "일차방정식"],
      gen(rng) {
        const t = makeExprTri(rng);
        return gInst(rng, { stimulus: triIntro(rng, t.v), question: rng.pick([`What is the value of $x$?`, `What is the value of $x$ in the triangle shown?`]), correct: t.x, wrongs: pos([W(t.deg[0], "formula_misuse", "첫 각을 답했다."), W(Math.round((180 - (t.b[0] + t.b[1] + t.b[2])) / 3), "formula_misuse", "계수 합을 3 으로 보았다."), W(Math.round(180 / (t.a[0] + t.a[1] + t.a[2])), "step_missing", "상수항을 무시했다."), W(t.x + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== t.x), verificationJs: figJs({}, t.fig, `${ANG_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`), trace: [angRead(t), sumStep(t), [`x = ${t.x} 이다.`, "Solve."]], variant: "solve_x_from_expressions",
        }, t.fig);
      },
    },
  ],
});
