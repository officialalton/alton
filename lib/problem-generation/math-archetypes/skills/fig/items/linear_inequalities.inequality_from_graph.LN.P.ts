// linear_inequalities.inequality_from_graph.LN.P — 순수 그래프(축 제목 x·y)의 음영 영역에서 일차부등식의 경계선·부등호 방향·경계 포함 여부를 읽어 값을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { makePureIneq, PI_JS, piIntro, piRead } from "../pure-fn-kit";

const isInt = Number.isInteger;
/** x = x0 일 때 (x0, y) 가 해인 가장 작은(위 음영)·가장 큰(아래 음영) 정수 y. */
const edgeY = (m: number, b: number, x0: number, above: boolean, strict: boolean) => { const v = m * x0 + b; return above ? v + (strict ? 1 : 0) : v - (strict ? 1 : 0); };
const edgeQ = (rng: Rng, above: boolean, x0: number) => above
  ? rng.pick([`What is the least integer value of $y$ for which the point $(${x0}, y)$ is in the solution set?`, `Among the points $(${x0}, y)$ with $y$ an integer, what is the smallest $y$ that is a solution of the inequality?`, `If $(${x0}, y)$ is a solution to the inequality and $y$ is an integer, what is the minimum possible value of $y$?`])
  : rng.pick([`What is the greatest integer value of $y$ for which the point $(${x0}, y)$ is in the solution set?`, `Among the points $(${x0}, y)$ with $y$ an integer, what is the largest $y$ that is a solution of the inequality?`, `If $(${x0}, y)$ is a solution to the inequality and $y$ is an integer, what is the maximum possible value of $y$?`]);

export const ITEM = defineItem({
  prefix: "ifgg", itemId: "linear_inequalities.inequality_from_graph.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "음영 그래프에서 경계선·부등호 방향·점선(엄격) 여부를 읽고, x = x0 에서 해가 되는 가장 작은(큰) 정수 y 를 구함", extra: "경계선의 값 m x0 + b 에 점선이면 ±1, 음영 방향에 따라 최소·최대를 골라야 함(경계값을 그대로 답하는 것이 함정) — medium 은 경계선의 식",
      concepts: ["부등식의 그래프", "경계선과 음영", "점선·실선의 의미"],
      gen(rng) {
        const s = makePureIneq(rng); const x0 = rng.nz(-8, 8); const v = s.m * x0 + s.b; const ans = edgeY(s.m, s.b, x0, s.above, s.strict); if (Math.abs(v) > 60) throw new GenFail("v");
        return figInst(rng, {
          stimulus: piIntro(rng), question: edgeQ(rng, s.above, x0), correct: ans,
          wrongs: [W(v, "condition_ignored", "경계선 위의 값을 그대로 답했다(점선이면 해가 아니다)."), W(s.above ? v - 1 : v + 1, "condition_ignored", "음영 방향을 반대로 보았다."), W(edgeY(s.m, s.b, x0, s.above, !s.strict), "condition_ignored", "점선·실선을 반대로 읽었다."), W(-v, "sign_error", "부호를 바꿨다."), W(ans + (s.above ? 2 : -2), "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== ans),
          verificationJs: figJs({ x0 }, s.fig, `${PI_JS}const v=m*P.x0+b; return above ? v+(strict?1:0) : v-(strict?1:0);`),
          trace: [...piRead(s), [`x = ${x0} 일 때 경계선의 y 는 ${s.m} × ${x0} + (${s.b}) = ${v} 이다.`, "Evaluate the boundary at x0."], [`${s.above ? "가장 작은" : "가장 큰"} 정수 y 는 ${ans} 이다.`, "Pick the boundary integer allowed by the inequality."]], variant: "edge_integer_y",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "음영 그래프의 경계선에서 기울기·절편을 구한 뒤, 부등식 y ≥ mx + b 꼴로 쓸 때의 m + b 를 구함", extra: "경계선의 두 격자점에서 m, b 를 구해 더하는 2단 연쇄(점선·음영은 값에 영향 없음 — m 만 또는 b 만 답하는 것이 함정) — medium 은 기울기",
      concepts: ["부등식의 그래프", "경계선의 식", "기울기·절편"],
      gen(rng) {
        const s = makePureIneq(rng); const ans = s.m + s.b; if (ans === s.m || ans === s.b) throw new GenFail("tie");
        return figInst(rng, {
          stimulus: `${piIntro(rng)} ${rng.pick([`The inequality can be written in the form $y ${s.op === "<=" ? "\\le" : s.op === ">=" ? "\\ge" : s.op} mx + b$, where $m$ and $b$ are constants.`, `The solution set is described by $y ${s.op === "<=" ? "\\le" : s.op === ">=" ? "\\ge" : s.op} mx + b$ for constants $m$ and $b$.`])}`,
          question: rng.pick([`What is the value of $m + b$?`, `What is the sum of $m$ and $b$?`, `Find $m + b$.`]), correct: ans,
          wrongs: [W(s.m, "step_missing", "m 만 답했다."), W(s.b, "step_missing", "b 만 답했다."), W(s.m - s.b, "sign_error", "b 의 부호를 반대로 더했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(ans + 1, "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== ans),
          verificationJs: figJs({}, s.fig, `${PI_JS}return m + b;`),
          trace: [...piRead(s), [`부등호 ${s.op === "<=" ? "≤" : s.op === ">=" ? "≥" : s.op} 이고 m = ${s.m}, b = ${s.b} 이다.`, "Match the inequality form."], [`m + b = ${s.m} + (${s.b}) = ${ans} 이다.`, "Add m and b."]], variant: "m_plus_b",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "음영 그래프에서 x = x0 일 때 해가 되는 정수 y 가 [lo, hi] 안에 몇 개인지 셈(경계 포함 여부·방향 반영)", extra: "경계값에서 점선·음영 방향에 따라 포함되는 정수를 세는 2단 연쇄(경계를 항상 포함하는 것이 함정) — medium 은 경계선의 식",
      concepts: ["부등식의 그래프", "경계선과 음영", "정수 개수 세기"],
      gen(rng) {
        const s = makePureIneq(rng); const x0 = rng.nz(-6, 6); const v = s.m * x0 + s.b; const lo = v - rng.int(2, 6), hi = v + rng.int(2, 6); let n = 0; for (let y = lo; y <= hi; y++) if (s.above ? (s.strict ? y > v : y >= v) : (s.strict ? y < v : y <= v)) n++; if (n === 0 || Math.abs(v) > 40) throw new GenFail("n");
        let nAll = 0; for (let y = lo; y <= hi; y++) if (s.above ? y >= v : y <= v) nAll++;
        return figInst(rng, {
          stimulus: piIntro(rng), question: rng.pick([`For how many integer values of $y$ with $${lo} \\le y \\le ${hi}$ is the point $(${x0}, y)$ in the solution set?`, `How many integers $y$ with $${lo} \\le y \\le ${hi}$ make $(${x0}, y)$ a solution of the inequality?`, `The point $(${x0}, y)$ is a solution when $y$ is an integer from ${lo} to ${hi}, inclusive, only for certain values. How many such values of $y$ are there?`]), correct: n,
          wrongs: [W(nAll === n ? n + 1 : nAll, "condition_ignored", "경계선 위의 점을 항상 포함했다."), W(hi - lo + 1 - n, "sign_error", "반대쪽 영역을 셌다."), W(n - 1, "condition_ignored", "끝 값을 하나 빠뜨렸다."), W(n + 1, "condition_ignored", "끝 값을 하나 더 포함했다."), W(hi - lo + 1, "condition_ignored", "범위의 모든 정수를 셌다.")].filter((w) => isInt(w.v) && w.v !== n && w.v >= 0),
          verificationJs: figJs({ x0, lo, hi }, s.fig, `${PI_JS}const v=m*P.x0+b; let n=0; for (let y=P.lo;y<=P.hi;y++) { if (above ? (strict ? y>v : y>=v) : (strict ? y<v : y<=v)) n++; } return n;`),
          trace: [...piRead(s), [`x = ${x0} 일 때 경계선의 y 는 ${v} 이다.`, "Evaluate the boundary at x0."], [`${lo} ≤ y ≤ ${hi} 중 해가 되는 정수는 ${n}개이다.`, "Count the allowed integers."]], variant: "count_integer_y",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "음영 그래프에서 부등식을 읽고, 점 (p, k) 가 해(경계 포함 여부 반영)가 되는 정수 k 의 가장 작은(큰) 값에서 k 를 구하는 역문제", extra: "해가 되는 경계 정수로부터 거꾸로 점의 좌표를 정해야 함(점선이면 경계 정수 자체는 제외) — medium 은 경계선의 식",
      concepts: ["부등식의 그래프", "경계선과 음영", "역산"],
      gen(rng) {
        const s = makePureIneq(rng); const x0 = rng.nz(-6, 6); const v = s.m * x0 + s.b; if (Math.abs(v) > 40) throw new GenFail("v"); const k = edgeY(s.m, s.b, x0, s.above, s.strict);
        return figInst(rng, {
          stimulus: `${piIntro(rng)} ${rng.pick([`The point $(${x0}, k)$ is in the solution set, where $k$ is an integer.`, `For an integer $k$, the point $(${x0}, k)$ is a solution of the inequality.`, `The ordered pair $(${x0}, k)$, where $k$ is an integer, satisfies the inequality.`])}`, question: s.above ? rng.pick([`What is the least possible value of $k$?`, `What is the smallest integer $k$ for which this is true?`, `What is the minimum value $k$ can have?`]) : rng.pick([`What is the greatest possible value of $k$?`, `What is the largest integer $k$ for which this is true?`, `What is the maximum value $k$ can have?`]), correct: k,
          wrongs: [W(v, "condition_ignored", "경계값을 그대로 답했다."), W(s.above ? v - 1 : v + 1, "condition_ignored", "음영 방향을 반대로 보았다."), W(edgeY(s.m, s.b, x0, s.above, !s.strict), "condition_ignored", "점선·실선을 반대로 읽었다."), W(-v, "sign_error", "부호를 바꿨다."), W(k + (s.above ? 2 : -2), "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== k),
          verificationJs: figJs({ x0 }, s.fig, `${PI_JS}const v=m*P.x0+b; return above ? v+(strict?1:0) : v-(strict?1:0);`),
          trace: [...piRead(s), [`x = ${x0} 일 때 경계선의 y 는 ${v} 이다.`, "Evaluate the boundary at x0."], [`${s.above ? "가능한 가장 작은" : "가능한 가장 큰"} 정수 k 는 ${k} 이다.`, "Pick the boundary integer allowed by the inequality."]], variant: "k_extreme_integer",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "boundary_slope", structure: "음영 그래프의 경계선이 지나는 두 격자점으로 기울기를 읽음", extra: "easy: 경계선의 기울기", concepts: ["부등식의 그래프", "기울기"],
      gen(rng) {
        const s = makePureIneq(rng);
        return figInst(rng, { stimulus: `${piIntro(rng)} ${rng.pick([`The boundary of the shaded area in the graph shown is a line.`, `The shaded area in the graph shown is bounded by a straight line.`, `One side of a line in the graph shown is shaded.`])}`, question: rng.pick([`What is the slope of the boundary line?`, `What is the slope of the line that bounds the shaded area?`, `Find the slope of the line that separates the shaded and unshaded areas.`, `The boundary of the shaded area has what slope?`]), correct: s.m, wrongs: [W(-s.m, "sign_error", "부호를 바꿨다."), W(s.b, "formula_misuse", "절편을 답했다."), W(1 / s.m, "formula_misuse", "역수를 답했다."), W(s.m + 1, "other", "어긋났다.")].filter((w) => w.v !== s.m), verificationJs: figJs({}, s.fig, `${PI_JS}return m;`), trace: [piRead(s)[0], [`따라서 기울기는 ${s.m} 이다.`, "State the slope."]], variant: "boundary_slope",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "boundary_intercept", structure: "음영 그래프의 경계선에서 y 절편을 구함", extra: "medium: 두 격자점으로 절편 계산", concepts: ["부등식의 그래프", "y 절편"],
      gen(rng) {
        const s = makePureIneq(rng);
        return figInst(rng, { stimulus: `${piIntro(rng)} ${rng.pick([`The boundary of the shaded area in the graph shown is a line.`, `The shaded area in the graph shown is bounded by a straight line.`, `One side of a line in the graph shown is shaded.`])}`, question: rng.pick([`What is the $y$-intercept of the boundary line?`, `At what $y$-value does the boundary line cross the $y$-axis?`, `Where does the line that bounds the shaded area cross the $y$-axis? Give the $y$-coordinate.`, `What is the $y$-coordinate of the point where the boundary meets the $y$-axis?`]), correct: s.b, wrongs: [W(-s.b, "sign_error", "부호를 바꿨다."), W(s.m, "formula_misuse", "기울기를 답했다."), W(s.ys[0], "axis_misread", "표시 격자점의 y 를 답했다."), W(s.b + 1, "other", "어긋났다.")].filter((w) => w.v !== s.b), verificationJs: figJs({}, s.fig, `${PI_JS}return b;`), trace: [...piRead(s).slice(0, 1), [`기울기 ${s.m} 와 한 점 (${s.xs[0]}, ${s.ys[0]}) 로 y 절편을 구한다.`, "Use slope and a point."], [`b = ${s.ys[0]} - (${s.m})(${s.xs[0]}) = ${s.b} 이다.`, "Compute the intercept."]], variant: "boundary_intercept",
        }, s.fig);
      },
    },
  ],
});
