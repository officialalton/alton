// linear_inequalities.point_in_solution.TB.P — 표에 주어진 점 (x, y) 들 중 부등식(계)을 만족하는 것을 판단·계수한다(점 좌표는 표에만).
import { GenFail } from "../../../types";
import { lin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { FLIP, ineqP, makePts, ptIntro, PT_JS, randIneq, sat, SAT_JS, STRICT_TOGGLE, texIneq, TEX, type Ineq, withRetry } from "./_t6-kit";

const count = (I: Ineq, xs: number[], ys: number[]) => xs.filter((x, i) => sat(I, x, ys[i])).length;
const nonneg = <T extends { v: number }>(ws: T[]) => ws.filter((w) => w.v >= 0);
const subst = (I: Ineq): [string, string] => [`각 점의 좌표를 $${texIneq(I)}$ 에 대입한다.`, "Substitute each point into the inequality."];
const solPhrase = ["is a solution to", "satisfies", "makes true"];

export const ITEM = defineItem(withRetry({
  prefix: "li", itemId: "linear_inequalities.point_in_solution.TB.P",
  hard: [
    {
      op: "constraint_select", structure: "표의 점들 중 두 부등식을 동시에 만족하는(연립부등식의 해인) 점의 개수를 셈", extra: "두 조건을 모두 확인해야 함(하나만 확인·경계 포함 함정) — medium 은 부등식 하나",
      concepts: ["점 좌표 표", "연립부등식의 해", "경계(등호) 판정"],
      gen(rng) {
        const I1 = randIneq(rng), I2 = randIneq(rng); if (I1.A * I2.B === I2.A * I1.B) throw new GenFail("평행");
        const both = (xs: number[], ys: number[]) => xs.filter((x, i) => sat(I1, x, ys[i]) && sat(I2, x, ys[i])).length;
        const s = makePts(rng, both, (v, xs, ys) => v >= 1 && v < xs.length && count(I1, xs, ys) !== v && count(I2, xs, ys) !== v);
        const c1 = count(I1, s.xs, s.ys), c2 = count(I2, s.xs, s.ys); const n = s.xs.length;
        const loose = s.xs.filter((x, i) => sat({ ...I1, op: STRICT_TOGGLE[I1.op] }, x, s.ys[i]) && sat({ ...I2, op: STRICT_TOGGLE[I2.op] }, x, s.ys[i])).length;
        return figInst(rng, {
          stimulus: `${ptIntro(rng)} Consider the system of inequalities $${texIneq(I1)}$ and $${texIneq(I2)}$.`,
          question: rng.pick(["How many of the points in the table are solutions to the system?", "How many of the points listed in the table satisfy both inequalities?", "For how many of the points in the table are both inequalities true?"]), correct: s.ans,
          wrongs: nonneg([W(c1, "condition_ignored", "첫 부등식만 확인했다."), W(c2, "condition_ignored", "둘째 부등식만 확인했다."), W(loose, "sign_error", "등호 포함 여부를 바꿔 판정했다."), W(n - s.ans, "opposite", "해가 아닌 점을 셌다."), W(s.ans + 1, "other", "경계의 점을 해로 셌다."), W(s.ans - 1, "other", "한 점을 빠뜨렸다.")]),
          verificationJs: figJs({ ...ineqP(I1, "1"), ...ineqP(I2, "2") }, s.fig, `${PT_JS}${SAT_JS}let c=0; for (let i=0;i<X.length;i++) if (sat('1',X[i],Y[i]) && sat('2',X[i],Y[i])) c++; return c;`),
          trace: [[`표에서 ${n}개 점의 좌표를 읽는다.`, "Read the points from the table."], subst(I1), [`첫 부등식을 만족하는 점은 ${c1}개이다.`, "Check the first inequality."], subst(I2), [`둘째 부등식까지 만족하는 점은 ${s.ans}개이다.`, "Keep only points satisfying both."], [`경계 위의 점은 등호 포함 여부에 따라 판정한다.`, "Check boundary points against strict or inclusive signs."]], variant: "count_system_solutions",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "y (≥ 또는 ≤) m x + k 에서 표의 모든 점이 해가 되는 k 의 최댓값(최솟값)을 구함", extra: "점마다 y − m x 를 계산해 모든 점이 만족하는 매개변수 범위의 끝값을 찾아야 함(최대·최소 혼동) — medium 은 고정 부등식의 개수",
      concepts: ["점 좌표 표", "매개변수 부등식", "모든 점이 만족할 조건(최솟값·최댓값)"],
      gen(rng) {
        const m = rng.nz(-4, 4); const up = rng.chance(0.5); const op = up ? "ge" : "le";
        const ext = (xs: number[], ys: number[]) => { const d = xs.map((x, i) => ys[i] - m * x); return up ? Math.min(...d) : Math.max(...d); };
        const s = makePts(rng, ext, () => true);
        const d = s.xs.map((x, i) => s.ys[i] - m * x); const other = up ? Math.max(...d) : Math.min(...d);
        const sorted = [...d].sort((a, b) => a - b); const second = up ? sorted[1] : sorted[sorted.length - 2];
        if (other === s.ans || second === s.ans) throw new GenFail("동점");
        return figInst(rng, {
          stimulus: `${ptIntro(rng)} ${rng.pick([`Every point in the table is a solution to the inequality $y ${TEX[op]} ${lin(m, 0)} + k$, where $k$ is a constant.`, `The inequality $y ${TEX[op]} ${lin(m, 0)} + k$, where $k$ is a constant, is true for all of the points listed.`, `All of the points in the table satisfy $y ${TEX[op]} ${lin(m, 0)} + k$, where $k$ is a constant.`, `For a constant $k$, each listed point makes the inequality $y ${TEX[op]} ${lin(m, 0)} + k$ true.`])}`,
          question: rng.pick([`What is the ${up ? "greatest" : "least"} possible value of $k$?`, `Which value is the ${up ? "largest" : "smallest"} that $k$ can have?`, `What is the ${up ? "maximum" : "minimum"} value of $k$ for which this is true?`]), correct: s.ans,
          wrongs: [W(other, "opposite", "최댓값·최솟값을 바꿨다."), W(second, "condition_ignored", "한 점을 빼고 판정했다."), W(up ? Math.min(...s.ys) : Math.max(...s.ys), "step_missing", "m x 를 빼지 않고 y 만 보았다."), W(up ? Math.min(...s.xs.map((x, i) => s.ys[i] + m * x)) : Math.max(...s.xs.map((x, i) => s.ys[i] + m * x)), "sign_error", "m x 를 더했다."), W(s.ans + (up ? 1 : -1), "other", "등호를 빼고 생각했다.")].filter((w) => w.v !== s.ans),
          verificationJs: figJs({ m, up: up ? 1 : 0 }, s.fig, `${PT_JS}const d=X.map((x,i)=>Y[i]-P.m*x); return P.up ? Math.min(...d) : Math.max(...d);`),
          trace: [[`표에서 각 점의 좌표를 읽는다.`, "Read the points from the table."], [`부등식은 k ${up ? "≤" : "≥"} y - (${m})x 로 바꿀 수 있다.`, "Isolate k."], [`점마다 y - (${m})x 를 계산하면 ${d.join(", ")} 이다.`, "Compute y − mx for every point."], [`모든 점이 만족하려면 k 는 이 값들의 ${up ? "최솟값 이하" : "최댓값 이상"} 이어야 한다.`, "All points must satisfy the inequality."], [`따라서 k 의 ${up ? "최댓값" : "최솟값"}은 ${s.ans} 이다.`, "State the extreme value of k."]], variant: "parameter_all_points",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "표의 한 점이 경계선 위에 있다는 조건으로 부등식의 상수 b 를 구한 뒤, 나머지 점 중 해의 개수를 셈", extra: "점 대입으로 상수를 먼저 정하고, 그 부등식으로 다시 점들을 판정하는 2단 연쇄 — medium 은 상수가 주어진 개수",
      concepts: ["점 좌표 표", "경계선의 상수 결정", "부등식의 해 판정"],
      gen(rng) {
        const m = rng.nz(-4, 4); const op = rng.pick(["lt", "le", "gt", "ge"] as const);
        const bOf = (xs: number[], ys: number[]) => ys[0] - m * xs[0];
        const cnt = (xs: number[], ys: number[]) => { const b = bOf(xs, ys); let c = 0; for (let i = 1; i < xs.length; i++) if (sat({ A: -m, B: 1, C: b, op, slope: true }, xs[i], ys[i])) c++; return c; };
        const s = makePts(rng, cnt, (v, xs) => v >= 1 && v < xs.length - 1);
        const b = bOf(s.xs, s.ys); const I: Ineq = { A: -m, B: 1, C: b, op, slope: true }; const k = s.xs.length - 1;
        const loose = s.xs.slice(1).filter((x, i) => sat({ ...I, op: STRICT_TOGGLE[op] }, x, s.ys[i + 1])).length;
        const noB = s.xs.slice(1).filter((x, i) => sat({ ...I, C: 0 }, x, s.ys[i + 1])).length;
        return figInst(rng, {
          stimulus: `${ptIntro(rng)} ${rng.pick([`For the inequality $y ${TEX[op]} ${lin(m, 0)} + b$, where $b$ is a constant, point ${s.labels[0]} lies on the boundary line.`, `The boundary line of the inequality $y ${TEX[op]} ${lin(m, 0)} + b$, where $b$ is a constant, passes through point ${s.labels[0]}.`, `Point ${s.labels[0]} is on the line that forms the boundary of $y ${TEX[op]} ${lin(m, 0)} + b$, where $b$ is a constant.`, `When the inequality $y ${TEX[op]} ${lin(m, 0)} + b$ is graphed, where $b$ is a constant, its boundary line goes through point ${s.labels[0]}.`])}`,
          question: rng.pick([`How many of the other points in the table are solutions to the inequality?`, `Not counting point ${s.labels[0]}, how many points in the table satisfy the inequality?`, `Of the remaining points in the table, how many make the inequality true?`]), correct: s.ans,
          wrongs: nonneg([W(s.ans + 1, "condition_ignored", "경계 위의 점까지 셌다."), W(k - s.ans, "opposite", "해가 아닌 점을 셌다."), W(noB, "step_missing", "b 를 구하지 않고 0 으로 두었다."), W(loose, "sign_error", "등호 포함 여부를 바꿨다."), W(s.ans - 1, "other", "한 점을 빠뜨렸다.")]),
          verificationJs: figJs({ m, op }, s.fig, `${PT_JS}const b=Y[0]-P.m*X[0]; const t=(v,c)=>P.op==='lt'?v<c:P.op==='le'?v<=c:P.op==='gt'?v>c:v>=c; let c=0; for (let i=1;i<X.length;i++) if (t(Y[i], P.m*X[i]+b)) c++; return c;`),
          trace: [[`표에서 점 ${s.labels[0]} = (${s.xs[0]}, ${s.ys[0]}) 를 읽는다.`, `Read point ${s.labels[0]}.`], [`경계선 y = ${lin(m, 0)} + b 에 대입: b = ${s.ys[0]} - (${m})(${s.xs[0]}) = ${b} 이다.`, "Find b from the boundary point."], [`부등식은 $${texIneq(I)}$ 이다.`, "Write the inequality."], [`나머지 ${k}개 점을 대입해 판정한다.`, "Test the other points."], [`해가 되는 점은 ${s.ans}개이다.`, "Count the solutions."]], variant: "boundary_then_count",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 부등식 I·II 각각을 만족하는 표의 점 개수를 세어 그 차를 구함", extra: "두 조건을 따로 판정하고 개수를 비교해야 함(공통해·합과 혼동) — medium 은 부등식 하나",
      concepts: ["점 좌표 표", "부등식의 해 판정", "두 조건 비교"],
      gen(rng) {
        const I1 = randIneq(rng), I2 = randIneq(rng);
        const diff = (xs: number[], ys: number[]) => count(I1, xs, ys) - count(I2, xs, ys);
        const s = makePts(rng, diff, (v) => v >= 1);
        const c1 = count(I1, s.xs, s.ys), c2 = count(I2, s.xs, s.ys); const bothN = s.xs.filter((x, i) => sat(I1, x, s.ys[i]) && sat(I2, x, s.ys[i])).length;
        const f = { ...I2, op: FLIP[I2.op] }; const c2f = count(f, s.xs, s.ys);
        return figInst(rng, {
          stimulus: `${ptIntro(rng)} Inequality I is $${texIneq(I1)}$, and inequality II is $${texIneq(I2)}$.`,
          question: rng.pick(["How many more points in the table satisfy inequality I than satisfy inequality II?", "The number of points in the table that satisfy inequality I is how much greater than the number that satisfy inequality II?"]), correct: s.ans,
          wrongs: nonneg([W(c1, "step_missing", "I 의 개수만 답했다."), W(c2, "step_missing", "II 의 개수만 답했다."), W(c1 + c2, "sign_error", "차가 아니라 합을 구했다."), W(c1 - bothN, "formula_misuse", "공통해를 뺐다."), W(c1 - c2f, "sign_error", "II 의 부등호 방향을 반대로 읽었다."), W(s.ans + 1, "other", "경계의 점을 잘못 셌다.")]).filter((w) => w.v !== s.ans),
          verificationJs: figJs({ ...ineqP(I1, "1"), ...ineqP(I2, "2") }, s.fig, `${PT_JS}${SAT_JS}let a=0,b=0; for (let i=0;i<X.length;i++) { if (sat('1',X[i],Y[i])) a++; if (sat('2',X[i],Y[i])) b++; } return a-b;`),
          trace: [[`표에서 각 점의 좌표를 읽는다.`, "Read the points from the table."], subst(I1), [`I 을 만족하는 점은 ${c1}개이다.`, "Count for inequality I."], subst(I2), [`II 를 만족하는 점은 ${c2}개이다.`, "Count for inequality II."], [`차 = ${c1} - ${c2} = ${s.ans} 이다.`, "Subtract."]], variant: "compare_two_inequalities",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "single_solution", structure: "표의 점 중 부등식을 만족하는 유일한 점의 x 좌표를 구함", extra: "easy: 각 점 대입", concepts: ["점 좌표 표", "부등식의 해"],
      gen(rng) {
        const I = randIneq(rng);
        const s = makePts(rng, (xs, ys) => (count(I, xs, ys) === 1 ? xs[xs.findIndex((x, i) => sat(I, x, ys[i]))] : 999), (v) => v !== 999);
        const others = s.xs.filter((x) => x !== s.ans);
        return figInst(rng, {
          stimulus: `${ptIntro(rng)} Exactly one of these points ${rng.pick(solPhrase)} the inequality $${texIneq(I)}$.`,
          question: rng.pick(["What is the $x$-coordinate of that point?", "What is the $x$-coordinate of the point that satisfies the inequality?"]), correct: s.ans,
          wrongs: [...others.map((x) => W(x, "condition_ignored", "해가 아닌 점을 골랐다.")), W(s.ys[s.xs.indexOf(s.ans)], "axis_misread", "y 좌표를 답했다.")],
          verificationJs: figJs(ineqP(I, "1"), s.fig, `${PT_JS}${SAT_JS}const ok=X.map((x,i)=>sat('1',x,Y[i])); if (ok.filter(Boolean).length!==1) throw new Error('해가 하나가 아님'); return X[ok.indexOf(true)];`),
          trace: [subst(I), [`만족하는 점은 x = ${s.ans} 인 점 하나이다.`, "Only one point works."]], variant: "unique_solution_point",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "count_solutions", structure: "표의 점 중 부등식 하나를 만족하는 점의 개수를 셈", extra: "medium: 경계 포함 여부까지 판정", concepts: ["점 좌표 표", "부등식의 해", "경계"],
      gen(rng) {
        const I = randIneq(rng);
        const s = makePts(rng, (xs, ys) => count(I, xs, ys), (v, xs) => v >= 1 && v < xs.length);
        const n = s.xs.length; const loose = count({ ...I, op: STRICT_TOGGLE[I.op] }, s.xs, s.ys);
        return figInst(rng, {
          stimulus: `${ptIntro(rng)}`,
          question: `How many of the points in the table ${rng.pick(["are solutions to", "satisfy"])} the inequality $${texIneq(I)}$?`, correct: s.ans,
          wrongs: nonneg([W(n - s.ans, "opposite", "해가 아닌 점을 셌다."), W(loose, "sign_error", "등호 포함 여부를 바꿨다."), W(count({ ...I, op: FLIP[I.op] }, s.xs, s.ys), "opposite", "부등호 방향을 반대로 읽었다."), W(s.ans + 1, "other", "한 점을 더 셌다."), W(s.ans - 1, "other", "한 점을 빠뜨렸다.")]),
          verificationJs: figJs(ineqP(I, "1"), s.fig, `${PT_JS}${SAT_JS}return X.filter((x,i)=>sat('1',x,Y[i])).length;`),
          trace: [[`표에서 ${n}개 점을 읽는다.`, "Read the points."], subst(I), [`만족하는 점은 ${s.ans}개이다.`, "Count the solutions."]], variant: "count_one_inequality",
        }, s.fig);
      },
    },
  ],
}));
