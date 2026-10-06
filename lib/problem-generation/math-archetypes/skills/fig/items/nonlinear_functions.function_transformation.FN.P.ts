// nonlinear_functions.function_transformation.FN.P — 순수 포물선 그래프(축 제목 x·y)에서 평행이동·반사·확대된 g 의 꼭짓점·값·이동량을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { QX_JS, makeQuadVertex, quadMarkedIntro, quadXRead } from "../pure-fn-kit";

const gName = (fn: string) => (fn === "w" ? "u" : "w"); // f·g·h 이름은 그림의 함수 라벨 규칙(ref_missing)과 충돌하므로 쓰지 않는다
const hs = (h: number) => (h > 0 ? `${h} units to the right` : `${-h} units to the left`);
const ks = (k: number) => (k > 0 ? `${k} units up` : `${-k} units down`);
const arg = (h: number) => (h > 0 ? `x - ${h}` : `x + ${-h}`);
const plus = (k: number) => (k > 0 ? `+ ${k}` : `- ${-k}`);
/** g 를 f 의 평행이동으로 정의하는 문장(표현 3가지). */
const gDef = (rng: Rng, fn: string, g: string, h: number, k: number) => rng.pick([
  `The function $${g}$ is defined by $${g}(x) = ${fn}(${arg(h)}) ${plus(k)}$.`,
  `The graph of $y = ${g}(x)$ is the graph of $y = ${fn}(x)$ shifted ${hs(h)} and ${ks(k)}.`,
  `For the function $${g}$, $${g}(x) = ${fn}(${arg(h)}) ${plus(k)}$ for all $x$.`,
]);
const sh = () => { /* 이동량 표집은 호출부에서 */ };
void sh;
const pickHK = (rng: Rng) => ({ h: rng.nz(-3, 3), k: rng.nz(-4, 4) });

export const ITEM = defineItem({
  prefix: "ftfp", itemId: "nonlinear_functions.function_transformation.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점이 표시되지 않은 포물선 그래프로 식을 세운 뒤, 평행이동한 g 의 꼭짓점 x 좌표를 구함", extra: "표시점으로 f 의 꼭짓점을 구한 뒤 오른쪽·왼쪽 이동 부호를 맞춰야 함(h 를 반대로 더하는 것이 함정) — medium 은 위아래 이동",
      concepts: ["포물선 그래프", "함수의 평행이동", "꼭짓점"],
      gen(rng) { const fn = pickFn(rng, ["h", "k"]); const g = gName(fn); const q = makeQuadVertex(rng, fn, { disc: "any" }); const { h, k } = pickHK(rng); const ans = q.H + h; if (Math.abs(ans) > 99)  throw new GenFail("v");
        return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} ${gDef(rng, fn, g, h, k)}`, question: rng.pick([`What is the $x$-coordinate of the vertex of the graph of $y = ${g}(x)$?`, `The graph of $${g}$ has its vertex at $x = ?$ What is that value of $x$?`, `At what value of $x$ does the graph of $${g}$ reach its vertex?`]), correct: ans,
          wrongs: [W(q.H - h, "sign_error", "오른쪽 이동의 부호를 반대로 했다."), W(q.H, "step_missing", "이동하지 않은 f 의 꼭짓점을 답했다."), W(h, "axis_misread", "이동량만 답했다."), W(q.K + k, "axis_misread", "꼭짓점의 y 좌표를 답했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ h }, q.fig, `${QX_JS}return H + P.h;`),
          trace: [...quadXRead(q), [`f 의 꼭짓점 x = -b/(2a) = ${fmtNum(q.H)} 이다.`, "Find the vertex of f."], [`g 는 f 를 ${h > 0 ? "오른쪽" : "왼쪽"}으로 ${Math.abs(h)} 옮기므로 x 좌표가 ${fmtNum(q.H)} ${h > 0 ? "+" : "-"} ${Math.abs(h)} 가 된다.`, "A horizontal shift moves the vertex by h."], [`따라서 ${fmtNum(ans)} 이다.`, "State the answer."]], variant: "vertex_x_after_shift" }, q.fig); },
    },
    {
      op: "chain2", structure: "표시된 점을 g(x) = f(x - h) + k 의 입력에 맞춰 읽고 k 를 더해 g 의 값을 구함", extra: "g(x₀) 에 쓰이는 f 의 입력이 x₀ - h 임을 알아야 함(f(x₀) 를 읽는 것이 함정) — medium 은 위아래 이동만",
      concepts: ["포물선 그래프", "함수의 평행이동", "함숫값"],
      gen(rng) { const fn = pickFn(rng, ["h", "k"]); const g = gName(fn); const q = makeQuadVertex(rng, fn, { disc: "any" }); const { h, k } = pickHK(rng); const i = rng.int(0, 2); const x0 = q.xs[i] + h; if (Math.abs(x0) > 12) throw new GenFail("x0"); const ans = q.ys[i] + k; const f = (x: number) => q.A * x * x + q.B * x + q.C;
        return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} ${gDef(rng, fn, g, h, k)}`, question: rng.pick([`What is the value of $${g}(${x0})$?`, `What is $${g}(${x0})$?`, `Find $${g}(${x0})$.`]), correct: ans,
          wrongs: [W(f(x0) + k, "condition_ignored", "f 의 입력을 이동하지 않고 x₀ 를 그대로 넣었다."), W(q.ys[i] - k, "sign_error", "위아래 이동의 부호를 반대로 했다."), W(q.ys[i], "step_missing", "수직 이동을 더하지 않았다."), W(f(x0 + h) + k, "sign_error", "입력 이동의 부호를 반대로 했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans && Number.isInteger(w.v) && Math.abs(w.v) < 1000),
          verificationJs: figJs({ x0, h, k }, q.fig, `${QX_JS}return f(P.x0 - P.h) + P.k;`),
          trace: [...quadXRead(q), [`${g}(${x0}) = ${fn}(${x0} ${h > 0 ? "-" : "+"} ${Math.abs(h)}) ${plus(k)} = ${fn}(${q.xs[i]}) ${plus(k)} 이다.`, "Evaluate the input of f first."], [`${fn}(${q.xs[i]}) = ${q.ys[i]} 이다.`, "Read the value from the graph."], [`${g}(${x0}) = ${q.ys[i]} ${plus(k)} = ${ans} 이다.`, "Add the vertical shift."]], variant: "value_after_shift" }, q.fig); },
    },
    {
      op: "compose_kind", structure: "반사·확대·이동을 합성한 g(x) = c·f(x) + k 를 표시점에서 읽은 f 의 값으로 계산", extra: "곱한 뒤 더하는 순서와 c 의 부호를 지켜야 함(k 를 먼저 더하는 것이 함정) — medium 은 반사만",
      concepts: ["포물선 그래프", "반사·확대", "함숫값"],
      gen(rng) { const fn = pickFn(rng, ["h", "k"]); const g = gName(fn); const q = makeQuadVertex(rng, fn, { disc: "any" }); const c = rng.pick([-1, 2, -2, 3]); const k = rng.nz(-5, 5); const i = rng.int(0, 2); const x0 = q.xs[i]; const ans = c * q.ys[i] + k; if (Math.abs(ans) > 99) throw new GenFail("v");
        const def = rng.pick([`The function $${g}$ is defined by $${g}(x) = ${c === -1 ? "-" : c}${fn}(x) ${plus(k)}$.`, `For all $x$, $${g}(x) = ${c === -1 ? "-" : c}${fn}(x) ${plus(k)}$.`, `The function $${g}$ is given by $${g}(x) = ${c === -1 ? "-" : c}${fn}(x) ${plus(k)}$.`]);
        return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} ${def}`, question: rng.pick([`What is the value of $${g}(${x0})$?`, `What is $${g}(${x0})$?`, `Find $${g}(${x0})$.`]), correct: ans,
          wrongs: [W(c * (q.ys[i] + k), "step_missing", "k 를 먼저 더한 뒤 곱했다."), W(q.ys[i] + k, "condition_ignored", "c 를 곱하지 않았다."), W(-c * q.ys[i] + k, "sign_error", "c 의 부호를 반대로 했다."), W(c * q.ys[i] - k, "sign_error", "k 의 부호를 반대로 했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ x0, c, k }, q.fig, `${QX_JS}return P.c * f(P.x0) + P.k;`),
          trace: [...quadXRead(q), [`${fn}(${x0}) = ${q.ys[i]} 이다.`, "Read f at the marked point."], [`${g}(${x0}) = ${c} × ${q.ys[i]} ${plus(k)} 이다.`, "Multiply, then add."], [`따라서 ${ans} 이다.`, "State the answer."]], variant: "scale_reflect_value" }, q.fig); },
    },
    {
      op: "inverse", structure: "g 의 꼭짓점 위치가 주어질 때 그래프에서 읽은 f 의 꼭짓점과 비교해 이동량 h 또는 k 를 거꾸로 구함", extra: "표시점으로 f 의 꼭짓점을 구한 뒤 g 와의 차로 이동량을 구해야 함(g 의 좌표를 그대로 답하는 것이 함정) — medium 은 꼭짓점이 표시됨",
      concepts: ["포물선 그래프", "함수의 평행이동", "꼭짓점"],
      gen(rng) { const fn = pickFn(rng, ["h", "k"]); const g = gName(fn); const q = makeQuadVertex(rng, fn, { disc: "any" }); const which = rng.pick(["h", "k"] as const); const h = rng.nz(-3, 3), k = rng.nz(-4, 4);
        if (which === "h") { const X = q.H + h; return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${fn}(x - h)$, where $h$ is a constant. The vertex of the graph of $${g}$ has $x$-coordinate ${fmtNum(X)}.`, question: rng.pick(["What is the value of $h$?", "What is $h$?", "Find the value of the constant $h$."]), correct: h,
          wrongs: [W(-h, "sign_error", "이동 방향의 부호를 반대로 했다."), W(X, "step_missing", "g 의 꼭짓점 x 좌표를 답했다."), W(q.H, "axis_misread", "f 의 꼭짓점 x 좌표를 답했다."), W(h + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== h),
          verificationJs: figJs({ X }, q.fig, `${QX_JS}return P.X - H;`),
          trace: [...quadXRead(q), [`f 의 꼭짓점 x = ${fmtNum(q.H)} 이다.`, "Find the vertex of f."], [`g 의 꼭짓점은 ${fmtNum(X)} 이므로 h = ${fmtNum(X)} - (${fmtNum(q.H)}) 이다.`, "The vertex of g is the vertex of f shifted by h."], [`따라서 h = ${h} 이다.`, "State the answer."]], variant: "solve_h" }, q.fig); }
        const Y = q.K + k; return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${fn}(x) + k$, where $k$ is a constant. The vertex of the graph of $${g}$ has $y$-coordinate ${fmtNum(Y)}.`, question: rng.pick(["What is the value of $k$?", "What is $k$?", "Find the value of the constant $k$."]), correct: k,
          wrongs: [W(-k, "sign_error", "부호를 반대로 했다."), W(Y, "step_missing", "g 의 꼭짓점 y 좌표를 답했다."), W(q.K, "axis_misread", "f 의 꼭짓점 y 좌표를 답했다."), W(k + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== k),
          verificationJs: figJs({ Y }, q.fig, `${QX_JS}return P.Y - K;`),
          trace: [...quadXRead(q), [`f 의 꼭짓점 y = ${fmtNum(q.K)} 이다.`, "Find the vertex height of f."], [`g 의 꼭짓점 y 는 ${fmtNum(Y)} 이므로 k = ${fmtNum(Y)} - (${fmtNum(q.K)}) 이다.`, "The vertex height shifts by k."], [`따라서 k = ${k} 이다.`, "State the answer."]], variant: "solve_k" }, q.fig); },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertical_value", structure: "표시점의 값에 위·아래 이동량을 더해 g(x₀) 를 구함", extra: "easy: 수직 이동 한 번", concepts: ["포물선 그래프", "함수의 평행이동"],
      gen(rng) { const fn = pickFn(rng, ["h", "k"]); const g = gName(fn); const q = makeQuadVertex(rng, fn, { disc: "any" }); const k = rng.nz(-4, 4); const i = rng.int(0, 2); const x0 = q.xs[i]; const ans = q.ys[i] + k;
        return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} The graph of $y = ${g}(x)$ is the graph of $y = ${fn}(x)$ shifted ${ks(k)}.`, question: `What is the value of $${g}(${x0})$?`, correct: ans, wrongs: [W(q.ys[i], "step_missing", "이동을 더하지 않았다."), W(q.ys[i] - k, "sign_error", "이동 방향을 반대로 했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({ x0, k }, q.fig, `${QX_JS}return f(P.x0) + P.k;`),
          trace: [[`${fn}(${x0}) = ${q.ys[i]} 을 그래프에서 읽는다.`, "Read the marked value."], [`${g}(${x0}) = ${q.ys[i]} ${plus(k)} = ${ans} 이다.`, "Add the vertical shift."]], variant: "vertical_value" }, q.fig); },
    },
    {
      lv: "medium", name: "vertex_y_shift", structure: "꼭짓점이 표시된 포물선에서 이동한 g 의 꼭짓점 y 좌표를 구함", extra: "medium: 꼭짓점 읽기 + 이동", concepts: ["포물선 그래프", "함수의 평행이동", "꼭짓점"],
      gen(rng) { const fn = pickFn(rng, ["h", "k"]); const g = gName(fn); const q = makeQuadVertex(rng, fn, { disc: "any", vertex: true }); const { h, k } = pickHK(rng); const ans = q.K + k;
        return figInst(rng, { stimulus: `${quadMarkedIntro(rng, fn)} ${gDef(rng, fn, g, h, k)}`, question: rng.pick([`What is the $y$-coordinate of the vertex of the graph of $y = ${g}(x)$?`, `At what value of $y$ does the graph of $${g}$ reach its vertex?`]), correct: ans, wrongs: [W(q.K, "step_missing", "이동하지 않은 꼭짓점의 y 를 답했다."), W(q.K - k, "sign_error", "이동 방향을 반대로 했다."), W(q.H + h, "axis_misread", "꼭짓점의 x 좌표를 답했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({ k }, q.fig, `${QX_JS}return K + P.k;`),
          trace: [[`f 의 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "Read the vertex of f."], [`위아래로 ${k > 0 ? "+" : "-"}${Math.abs(k)} 옮기면 y 좌표는 ${q.K} ${plus(k)} 이다.`, "A vertical shift moves the vertex height."], [`따라서 ${ans} 이다.`, "State the answer."]], variant: "vertex_y_shift" }, q.fig); },
    },
  ],
});
