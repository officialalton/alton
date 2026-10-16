// nonlinear_functions.context_graph_features.FN.P — 상황(발사체 높이)을 나타내는 포물선 그래프(축 제목 x·y)에서 최고점 시각·최고 높이·처음 높이·같은 높이의 나중 시각을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { QX_JS, posAxes, quadXRead, type QuadX } from "../pure-fn-kit";

type Scene = { what: string; unit: string; tu: string; t: string };
const SCENES: Scene[] = [
  { what: "a ball", unit: "meters", tu: "seconds", t: "after it is thrown" }, { what: "a rocket", unit: "meters", tu: "seconds", t: "after launch" },
  { what: "a water jet from a fountain", unit: "feet", tu: "seconds", t: "after it leaves the nozzle" }, { what: "a drone", unit: "meters", tu: "seconds", t: "after takeoff" },
  { what: "a diver", unit: "feet", tu: "seconds", t: "after leaving the board" }, { what: "a toy rocket", unit: "feet", tu: "seconds", t: "after it is fired" },
  { what: "a soccer ball", unit: "meters", tu: "seconds", t: "after it is kicked" }, { what: "a model plane", unit: "feet", tu: "seconds", t: "after it is released" }, { what: "a firework shell", unit: "meters", tu: "seconds", t: "after it is launched" },
  { what: "a basketball", unit: "feet", tu: "seconds", t: "after it leaves a player's hand" }, { what: "a stone", unit: "meters", tu: "seconds", t: "after it is tossed" },
];
const intro = (rng: Rng, s: Scene) => rng.pick([
  `The graph shown models the height $y$, in ${s.unit}, of ${s.what} $x$ ${s.tu} ${s.t}.`, `In the $xy$-plane shown, the parabola gives the height $y$, in ${s.unit}, of ${s.what} $x$ ${s.tu} ${s.t}.`,
  `The height $y$, in ${s.unit}, of ${s.what} is graphed against the time $x$, in ${s.tu}, ${s.t}. The graph is shown.`, `A model for the height of ${s.what} is graphed in the $xy$-plane shown, where $x$ is the number of ${s.tu} ${s.t} and $y$ is the height in ${s.unit}.`,
  `A quadratic model is graphed in the $xy$-plane shown. Here $x$ is the time, in ${s.tu}, ${s.t}, and $y$ is the height, in ${s.unit}, of ${s.what}.`, `The figure shows how the height $y$, in ${s.unit}, of ${s.what} changes with the time $x$, in ${s.tu}, ${s.t}.`,
]) + rng.pick([" Three points on the graph are marked.", " Three points on the curve are marked.", " The graph passes through the three marked points."]);
const YN = [10, 15, 20, 25, 30, 40, 50];
/** 상황 포물선: 1사분면 축(posAxes), 아래로 열리고 꼭짓점 (H, K), 처음 높이 C ≥ 1. 표시점은 x = 1…X-1 의 정수점(y 서로 다름, 꼭짓점 제외 — vertex 면 꼭짓점 포함). */
function quadScene(rng: Rng, o: { vertex?: boolean } = {}): QuadX {
  for (let t = 0; t < 1500; t++) {
    const H = rng.int(2, 4); const X = 2 * H + rng.int(1, 2); const A = rng.pick([-1, -2]); const K = -A * H * H + rng.int(1, 6); const C = A * H * H + K; if (C < 1) continue;
    const Y = YN.find((v) => v >= K * 1.15); if (!Y || K < Y * 0.55) continue; const f = (x: number) => A * (x - H) * (x - H) + K;
    const cand: number[] = []; for (let x = 1; x <= X - 1; x++) if (x !== H && f(x) >= 1 && f(x) <= Y * 0.95) cand.push(x);
    const pick: number[] = o.vertex ? [H] : []; for (const x of rng.shuffle(cand)) { if (pick.every((u) => f(u) !== f(x))) pick.push(x); if (pick.length === 3) break; }
    if (pick.length < 3) continue; pick.sort((u, v) => u - v);
    const B = -2 * A * H; const ys = pick.map(f);
    const fig = { type: "plane", axes: posAxes(X, Y), objects: [{ id: "F1", kind: "function", fn: "quadratic", params: [A, B, C] }, { id: "S1", kind: "scatter", points: pick.map((x, i) => [x, ys[i]] as [number, number]) }] } as unknown as QuadX["fig"];
    return { fn: "m", A, B, C, H, K, D: B * B - 4 * A * C, xs: pick, ys, R: X, fig };
  }
  throw new GenFail("상황 포물선 표집 실패");
}
function scene(rng: Rng): QuadX & { s: Scene } { return { ...quadScene(rng), s: rng.pick(SCENES) }; }
const SUF = " 이다.";
const LEAD = (rng: Rng) => rng.pick(["", "", "", "A class models a motion problem with a graph. ", "A coach reviews a graph of a motion. ", "A student reads a graph in a physics unit. "]);

export const ITEM = defineItem({
  prefix: "cgfp", itemId: "nonlinear_functions.context_graph_features.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점이 표시되지 않은 상황 그래프에서 표시점으로 식을 세워 최고 높이에 이르는 시각(꼭짓점 x)을 구함", extra: "표시점만으로는 최고점이 보이지 않아 -b/(2a) 로 구해야 함(가장 높이 표시된 점의 시각이 함정) — medium 은 대칭 쌍",
      concepts: ["상황 그래프", "이차식 세우기", "꼭짓점"],
      gen(rng) { const q = scene(rng); const top = q.xs[q.ys.indexOf(Math.max(...q.ys))]; const H = q.H; if (!Number.isInteger(H)) throw new GenFail("H");
        return figInst(rng, { stimulus: LEAD(rng) + intro(rng, q.s), question: rng.pick([`According to the model, at what time $x$ is the height the greatest?`, `At how many ${q.s.tu} ${q.s.t} does the model reach its greatest height?`, `The model reaches its maximum height at what value of $x$?`, `After how many ${q.s.tu} ${q.s.t} is the height at its peak?`, `At what time does the graph show the highest point?`]), correct: H,
          wrongs: [W(top, "axis_misread", "표시점 중 가장 높은 점의 시각을 답했다."), W(q.K, "axis_misread", "최고 높이를 시각으로 답했다."), W(-H, "sign_error", "부호를 바꿨다."), W(H + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== H),
          verificationJs: figJs({}, q.fig, `${QX_JS}return H;`), trace: [...quadXRead(q), [`꼭짓점 x = -b/(2a) = ${fmtNum(H)} 이다.`, "Use x = -b / (2a)."], [`최고 높이의 시각은 ${fmtNum(H)} 이다.`, "The vertex gives the time of maximum height."]], variant: "time_of_max" }, q.fig); },
    },
    {
      op: "chain2", structure: "표시점으로 식을 세운 뒤 꼭짓점의 y 좌표(최고 높이)를 구함", extra: "a, b, c 를 구한 뒤 꼭짓점 x 를 식에 대입해야 함(표시점의 최대 높이가 함정) — medium 은 꼭짓점이 표시됨",
      concepts: ["상황 그래프", "이차식 세우기", "최댓값"],
      gen(rng) { const q = scene(rng); const top = Math.max(...q.ys);
        return figInst(rng, { stimulus: LEAD(rng) + intro(rng, q.s), question: rng.pick([`According to the model, what is the maximum height, in ${q.s.unit}?`, `What is the greatest height, in ${q.s.unit}, that the model gives?`, `What is the maximum value of $y$ on the graph?`, `What is the peak height, in ${q.s.unit}, shown on the graph?`, `According to the graph, how high, in ${q.s.unit}, does it get at its highest?`]), correct: q.K,
          wrongs: [W(top, "axis_misread", "표시점 중 가장 높은 값을 답했다."), W(q.H, "axis_misread", "시각을 높이로 답했다."), W(q.C, "axis_misread", "처음 높이를 답했다."), W(q.K + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== q.K),
          verificationJs: figJs({}, q.fig, `${QX_JS}return K;`), trace: [...quadXRead(q), [`꼭짓점 x = ${fmtNum(q.H)} 이다.`, "Find the vertex time."], [`y = ${fmtNum(q.K)} (꼭짓점의 높이)${SUF}`, "Evaluate the function at the vertex."]], variant: "max_height" }, q.fig); },
    },
    {
      op: "compose_kind", structure: "표시점으로 식을 세워 x = 0(처음 시각)에서의 높이 c 를 구함", extra: "표시점이 x = 0 이 아니므로 식의 상수항을 구해야 함(가장 앞 표시점의 높이가 함정) — medium 은 한 칸 뒤",
      concepts: ["상황 그래프", "이차식 세우기", "처음 값"],
      gen(rng) { const q = scene(rng); if (q.C <= 0 || q.xs.includes(0)) throw new GenFail("c"); const first = q.ys[0];
        return figInst(rng, { stimulus: LEAD(rng) + intro(rng, q.s), question: rng.pick([`According to the model, what was the height, in ${q.s.unit}, at time $x = 0$?`, `What is the initial height, in ${q.s.unit}, given by the model?`, `What is the $y$-intercept of the graph?`, `At the moment $x = 0$, how high is it, in ${q.s.unit}, according to the model?`, `What height, in ${q.s.unit}, does the model give when the time is 0?`]), correct: q.C,
          wrongs: [W(first, "axis_misread", "가장 앞 표시점의 높이를 답했다."), W(q.K, "axis_misread", "최고 높이를 답했다."), W(q.H, "axis_misread", "시각을 답했다."), W(q.C + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== q.C),
          verificationJs: figJs({}, q.fig, `${QX_JS}return C;`), trace: [...quadXRead(q), [`x = 0 을 대입하면 y = c = ${fmtNum(q.C)} 이다.`, "Substitute x = 0."], [`처음 높이는 ${fmtNum(q.C)} 이다.`, "State the initial height."]], variant: "initial_height" }, q.fig); },
    },
    {
      op: "inverse", structure: "같은 높이에서 오르는 때의 시각이 주어질 때 대칭축을 구해 내려오는 때의 시각을 거꾸로 구함", extra: "축 x = h 를 구한 뒤 2h - t 로 반사해야 함(t 를 그대로 답하거나 h 를 답하는 것이 함정) — medium 은 축만",
      concepts: ["상황 그래프", "포물선의 대칭", "같은 높이"],
      gen(rng) { const q = scene(rng); const H = q.H; const cand = q.xs.filter((x) => x < H); if (!cand.length) throw new GenFail("t"); const t = cand[0]; const ans = 2 * H - t; if (ans > q.R || Math.abs(ans - t) < 2) throw new GenFail("ans"); const y = q.ys[q.xs.indexOf(t)];
        return figInst(rng, { stimulus: `${LEAD(rng)}${intro(rng, q.s)} The model has the same height at two different times $x$ ${q.s.tu} ${q.s.t}.`, question: rng.pick([`The height is ${y} ${q.s.unit} at $x = ${t}$ on the way up. At what other time is the height ${y} ${q.s.unit}?`, `At $x = ${t}$ the height is ${y} ${q.s.unit}. For what other value of $x$ is the height also ${y} ${q.s.unit}?`, `The model gives a height of ${y} ${q.s.unit} at $x = ${t}$ and again at a later time. What is that later value of $x$?`, `A height of ${y} ${q.s.unit} occurs at $x = ${t}$ and once more later. At what value of $x$ does it occur again?`]), correct: ans,
          wrongs: [W(H, "step_missing", "대칭축의 x 를 답했다."), W(H - t, "formula_misuse", "h - t 로 계산했다."), W(2 * H + t, "sign_error", "2h + t 로 계산했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans && w.v >= 0),
          verificationJs: figJs({ t }, q.fig, `${QX_JS}return 2 * H - P.t;`), trace: [...quadXRead(q), [`대칭축 x = ${fmtNum(H)} 이다.`, "Find the axis of symmetry."], [`다른 시각 = 2 × ${fmtNum(H)} - ${t} = ${ans} 이다.`, "Reflect the time across the axis."]], variant: "same_height_later" }, q.fig); },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_vertex_time", structure: "꼭짓점이 표시된 상황 그래프에서 최고 높이의 시각을 읽음", extra: "easy: 꼭짓점 읽기", concepts: ["상황 그래프", "꼭짓점"],
      gen(rng) { for (let t = 0; t < 300; t++) { const q0 = scene(rng);  const q = quadScene(rng, { vertex: true });
        return figInst(rng, { stimulus: LEAD(rng) + intro(rng, q0.s), question: `At what time $x$ is the height the greatest?`, correct: q.H, wrongs: [W(q.K, "axis_misread", "높이를 시각으로 답했다."), W(q.H + 1, "other", "한 칸 어긋났다."), W(q.C, "axis_misread", "처음 높이를 답했다.")].filter((w) => w.v !== q.H), verificationJs: figJs({}, q.fig, `${QX_JS}return H;`), trace: [[`꼭짓점이 표시되어 있다: (${q.H}, ${q.K}).`, "The vertex is marked."], [`최고 높이의 시각은 ${q.H} 이다.`, "Read its x-coordinate."]], variant: "read_vertex_time" }, q.fig); } throw new GenFail("easy"); },
    },
    {
      lv: "medium", name: "max_height_marked", structure: "꼭짓점이 표시된 상황 그래프에서 최고 높이를 읽음", extra: "medium: 꼭짓점 높이", concepts: ["상황 그래프", "최댓값"],
      gen(rng) { for (let t = 0; t < 300; t++) { const q0 = scene(rng);  const q = quadScene(rng, { vertex: true });
        return figInst(rng, { stimulus: LEAD(rng) + intro(rng, q0.s), question: `What is the maximum height, in ${q0.s.unit}, according to the model?`, correct: q.K, wrongs: [W(q.H, "axis_misread", "시각을 높이로 답했다."), W(q.K + 1, "other", "한 칸 어긋났다."), W(q.C, "axis_misread", "처음 높이를 답했다.")].filter((w) => w.v !== q.K), verificationJs: figJs({}, q.fig, `${QX_JS}return K;`), trace: [[`꼭짓점이 표시되어 있다: (${q.H}, ${q.K}).`, "The vertex is marked."], [`최고 높이는 y 좌표 ${q.K} 이다.`, "Read its y-coordinate."], [`단위는 문제의 단위를 따른다.`, "Use the stated unit."]], variant: "max_height_marked" }, q.fig); } throw new GenFail("medium"); },
    },
  ],
});
