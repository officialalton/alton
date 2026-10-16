// nonlinear_equations_systems.irrational_root_radical_form.FN.P — 순수 포물선 그래프에서 해가 p ± √m 꼴일 때 p·m 등을 구한다(근호가 남는 해의 표현).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { QX_JS, quadFig, quadMarkedIntro, quadXRead, type QuadX, quadVertexIntro } from "../pure-fn-kit";

const MS = [2, 3, 5, 6, 7, 8, 10];
/** y = A(x - H)² - A m : 근 H ± √m (m 은 완전제곱이 아닌 양의 정수). */
function radScene(rng: Rng, fn: string, o: { nPts?: number; vertex?: boolean; aPool?: number[] } = {}): QuadX & { m: number } {
  for (let t = 0; t < 1500; t++) {
    const R = rng.pick([6, 8, 10]); const A = rng.pick(o.aPool ?? [-2, -1, 1, 2]); const H = rng.int(-3, 3); const m = rng.pick(MS);
    const r = quadFig(rng, fn, A, -2 * A * H, A * H * H - A * m, R, o); if (!r) continue; return { ...r, m };
  }
  throw new GenFail("근호 포물선 장면 표집 실패");
}
const vertexIntro = (rng: Rng, fn: string) => quadVertexIntro(rng, fn);
const FORM = (rng: Rng, fn: string, greater = true) => rng.pick([`The equation $${fn}(x) = 0$ has two real solutions. The ${greater ? "greater" : "lesser"} solution can be written as $p ${greater ? "+" : "-"} \\sqrt{m}$, where $p$ and $m$ are integers and $m > 0$.`, `The ${greater ? "greater" : "lesser"} solution of $${fn}(x) = 0$ can be written in the form $p ${greater ? "+" : "-"} \\sqrt{m}$, where $p$ and $m$ are integers and $m > 0$.`, `Over the real numbers, $${fn}(x) = 0$ has two solutions. The ${greater ? "greater" : "lesser"} one equals $p ${greater ? "+" : "-"} \\sqrt{m}$ for integers $p$ and $m$ with $m > 0$.`]);

export const ITEM = defineItem({
  prefix: "irrg", itemId: "nonlinear_equations_systems.irrational_root_radical_form.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점이 표시되지 않은 포물선 그래프에서 식을 세워 f(x) = 0 의 해를 p ± √m 꼴로 쓸 때의 m 을 구함", extra: "표시점으로 식을 세우고 근의 공식(또는 꼭짓점형)으로 근호를 단순화해야 함(판별식 D 를 그대로 m 으로 쓰는 것이 함정) — medium 은 꼭짓점이 표시됨",
      concepts: ["포물선 그래프", "이차식 세우기", "근의 공식과 근호"],
      gen(rng) {
        const fn = pickFn(rng); const q = radScene(rng, fn); const D = q.B * q.B - 4 * q.A * q.C;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${FORM(rng, fn)}`, question: rng.pick(["What is the value of $m$?", "What is $m$?"]), correct: q.m,
          wrongs: [W(D, "formula_misuse", "판별식 D 를 그대로 m 으로 썼다."), W(q.H, "axis_misread", "p 를 답했다."), W(-q.K, "step_missing", "a 로 나누지 않았다."), W(q.m + 1, "other", "어긋났다."), W(-q.m, "sign_error", "부호를 바꿨다.")].filter((w) => w.v !== q.m),
          verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return -K / A;`),
          trace: [...quadXRead(q), [`꼭짓점형으로 고치면 ${fmtNum(q.A)}(x - (${q.H}))² + (${fmtNum(q.K)}) 이다.`, "Complete the square."], [`(x - (${q.H}))² = ${fmtNum(-q.K / q.A)} 이므로 x = ${q.H} ± √${q.m} 이다.`, "Solve for x."], [`따라서 m = ${q.m} 이다.`, "Match p + √m."]], variant: "radicand_from_marked_points",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 f(x) = 0 의 해를 p ± √m 꼴로 쓰고 p + m 을 구함", extra: "p 와 m 을 모두 구해 더하는 2단 연쇄(p 나 m 만 답하는 것이 함정) — medium 은 m",
      concepts: ["포물선 그래프", "근의 공식과 근호", "해의 표현"],
      gen(rng) {
        const fn = pickFn(rng); const q = radScene(rng, fn); const ans = q.H + q.m; if (ans === q.H || ans === q.m) throw new GenFail("tie");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${FORM(rng, fn)}`, question: rng.pick(["What is the value of $p + m$?", "What is the sum of $p$ and $m$?"]), correct: ans,
          wrongs: [W(q.H, "step_missing", "p 만 답했다."), W(q.m, "step_missing", "m 만 답했다."), W(q.H - q.m, "sign_error", "m 의 부호를 바꿨다."), W(q.m - q.H, "sign_error", "p 의 부호를 바꿨다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return H - K / A;`),
          trace: [...quadXRead(q), [`꼭짓점형 ${fmtNum(q.A)}(x - (${q.H}))² + (${fmtNum(q.K)}) 에서 해는 x = ${q.H} ± √${q.m} 이다.`, "Complete the square and solve."], [`p = ${q.H}, m = ${q.m} 이므로 p + m = ${ans} 이다.`, "Add p and m."]], variant: "p_plus_m",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 의 해를 구하고, 평행이동한 f(x - s) = 0 의 큰 해 p + √m 의 p 를 구함", extra: "수평 이동이 p 만 s 만큼 옮기고 m 은 그대로임을 알아야 함(이동 방향 함정) — medium 은 f 의 p",
      concepts: ["포물선 그래프", "근호가 남는 해", "함수의 평행이동"],
      gen(rng) {
        const fn = pickFn(rng); const q = radScene(rng, fn); const s = rng.nz(-5, 5); if (Math.abs(s) === 1) throw new GenFail("s"); const ans = q.H + s; const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The greater solution of $${fn}(${se}) = 0$ can be written as $p + \\sqrt{m}$, where $p$ and $m$ are integers and $m > 0$.`, question: rng.pick(["What is the value of $p$?", "What is $p$?"]), correct: ans,
          wrongs: [W(q.H, "condition_ignored", `${fn} 의 해에서 p 를 답했다.`), W(q.H - s, "sign_error", "이동 방향을 반대로 했다."), W(s, "step_missing", "이동량만 답했다."), W(q.m + s, "formula_misuse", "m 에 이동량을 더했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return H + P.s;`),
          trace: [...quadXRead(q), [`${fn}(x) = 0 의 해는 x = ${q.H} ± √${q.m} 이다.`, "Solve f(x) = 0."], [`${fn}(${se}) = 0 의 해는 각각 ${s} 만큼 이동하므로 큰 해는 ${ans} + √${q.m} 이고 p = ${ans} 이다.`, "Shift p by s."]], variant: "p_after_shift",
        }, q.fig);
      },
    },
    {
      op: "inverse", structure: "그래프에서 해가 p ± √m 꼴일 때 p² - m (두 해의 곱 c/a) 을 구함", extra: "근호를 풀지 않고도 p² - m 이 두 해의 곱임을 알아야 함(p² 만 답하는 것이 함정) — medium 은 m",
      concepts: ["포물선 그래프", "근과 계수의 관계", "근호가 남는 해"],
      gen(rng) {
        const fn = pickFn(rng); const q = radScene(rng, fn); const ans = q.H * q.H - q.m;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} ${rng.pick([`The two solutions of $${fn}(x) = 0$ can be written as $p + \\sqrt{m}$ and $p - \\sqrt{m}$, where $p$ and $m$ are integers and $m > 0$.`, `The equation $${fn}(x) = 0$ has solutions $p + \\sqrt{m}$ and $p - \\sqrt{m}$ for integers $p$ and $m$ with $m > 0$.`, `Both real solutions of $${fn}(x) = 0$ are of the form $p \\pm \\sqrt{m}$, where $p$ and $m$ are integers and $m > 0$.`])}`, question: rng.pick(["What is the value of $p^2 - m$?", "What is the value of $p^2 - m$ for these solutions?", "Find the value of $p^2 - m$."]), correct: ans,
          wrongs: [W(q.H * q.H, "step_missing", "m 을 빼지 않았다."), W(q.H * q.H + q.m, "sign_error", "m 을 더했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(q.H - q.m, "formula_misuse", "p - m 을 답했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return C / A;`),
          trace: [...quadXRead(q), [`꼭짓점형에서 해는 x = ${q.H} ± √${q.m} 이므로 p = ${q.H}, m = ${q.m} 이다.`, "Complete the square."], [`p² - m = ${q.H}² - ${q.m} = ${ans} 이다 (두 해의 곱 c/a 와 같다).`, "(p + √m)(p - √m) = p² - m."]], variant: "p_squared_minus_m",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertex_p", structure: "꼭짓점이 표시된 포물선에서 해 p ± √m 의 p(꼭짓점의 x)를 읽음", extra: "easy: 꼭짓점 x", concepts: ["포물선 그래프", "대칭축"],
      gen(rng) {
        const fn = pickFn(rng); const q = radScene(rng, fn, { vertex: true });
        return figInst(rng, { stimulus: `${vertexIntro(rng, fn)} ${FORM(rng, fn)}`, question: rng.pick(["What is the value of $p$?", "What is $p$?"]), correct: q.H, wrongs: [W(q.K, "axis_misread", "꼭짓점 y 를 답했다."), W(-q.H, "sign_error", "부호를 바꿨다."), W(q.m, "axis_misread", "m 을 답했다."), W(q.H + 1, "other", "어긋났다.")].filter((w) => w.v !== q.H), verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return H;`), trace: [[`표시된 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "Read the vertex."], [`두 해는 축 x = ${q.H} 에 대칭이므로 p = ${q.H} 이다.`, "The solutions are symmetric about the axis."]], variant: "p_from_vertex",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "vertex_m", structure: "꼭짓점이 표시된 포물선에서 꼭짓점형으로 f(x) = 0 을 풀어 m = -k/a 를 구함", extra: "medium: 꼭짓점형으로 근호 만들기", concepts: ["포물선 그래프", "꼭짓점형", "근호가 남는 해"],
      gen(rng) {
        const fn = pickFn(rng); const q = radScene(rng, fn, { vertex: true });
        return figInst(rng, { stimulus: `${vertexIntro(rng, fn)} ${FORM(rng, fn)}`, question: rng.pick(["What is the value of $m$?", "What is $m$?"]), correct: q.m, wrongs: [W(-q.K, "step_missing", "a 로 나누지 않았다."), W(q.K, "sign_error", "부호를 놓쳤다."), W(q.H, "axis_misread", "꼭짓점 x 를 답했다."), W(q.m + 1, "other", "어긋났다.")].filter((w) => w.v !== q.m), verificationJs: figJs({}, q.fig, `${QX_JS}if (D<=0) throw new Error('실근 아님'); return -K / A;`), trace: [[`표시된 꼭짓점은 (${q.H}, ${q.K}) 이고 다른 점으로 a = ${fmtNum(q.A)} 를 구한다.`, "Read the vertex and find a."], [`${fmtNum(q.A)}(x - (${q.H}))² + (${fmtNum(q.K)}) = 0 에서 (x - (${q.H}))² = ${q.m} 이다.`, "Solve the vertex form for zero."], [`x = ${q.H} ± √${q.m} 이므로 m = ${q.m} 이다.`, "Match p ± √m."]], variant: "m_from_vertex_form",
        }, q.fig);
      },
    },
  ],
});
