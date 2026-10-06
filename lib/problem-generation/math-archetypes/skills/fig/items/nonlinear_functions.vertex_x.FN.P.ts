// nonlinear_functions.vertex_x.FN.P — 순수 함수 그래프(포물선, 축 제목 x·y)에서 꼭짓점의 x 좌표(대칭축)를 구한다(표 버전 .TB.P 의 그래프판).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadG, pairXs, quadGIntro, quadGRead, QUADG_JS } from "../pure-kit";

const vq = (fn: string, rng: Rng) => rng.pick([`What is the $x$-coordinate of the vertex of the graph of $y = ${fn}(x)$?`, `What is the $x$-coordinate of the vertex of the parabola shown?`, `The graph of $y = ${fn}(x)$ is a parabola. What is the $x$-coordinate of its vertex?`, `At what value of $x$ does the graph of $${fn}$ reach its ${"vertex"}?`, `What is the $x$-coordinate of the turning point of the graph of $${fn}$?`]);

export const ITEM = defineItem({
  prefix: "nfg", itemId: "nonlinear_functions.vertex_x.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점도 같은 높이의 쌍도 표시되지 않은 포물선 그래프에서 표시점으로 식(a, b)을 세워 꼭짓점 x = -b/(2a) 를 구함", extra: "대칭 쌍이 없어 세 점으로 식을 세운 뒤 -b/(2a) 로 바꿔야 함(가장 낮은/높은 표시점의 x 를 꼭짓점으로 읽는 것이 함정) — medium 은 같은 높이의 쌍으로 축을 읽음",
      concepts: ["포물선 그래프", "이차식 세우기", "꼭짓점(대칭축) 공식"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn); const H = q.H; const ext = q.A > 0 ? Math.min(...q.ys) : Math.max(...q.ys); const near = q.xs[q.ys.indexOf(ext)];
        return figInst(rng, {
          stimulus: quadGIntro(rng, fn), question: vq(fn, rng), correct: H,
          wrongs: [W(near, "axis_misread", "표시점 중 가장 낮은(높은) 점의 x 를 꼭짓점으로 읽었다."), W(-H, "sign_error", "-b/(2a) 의 부호를 놓쳤다."), W(2 * H, "formula_misuse", "-b/a 로 계산했다."), W(q.K, "axis_misread", "꼭짓점의 y 좌표를 답했다."), W(H + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== H),
          verificationJs: figJs({}, q.fig, `${QUADG_JS}return H;`),
          trace: [...quadGRead(q), [`꼭짓점 x = -(${fmtNum(q.B)}) ÷ (2 × ${fmtNum(q.A)}) = ${fmtNum(H)} 이다.`, "Use x = -b / (2a)."]], variant: "vertex_from_points",
        }, q.fig);
      },
    },
    {
      op: "inverse", structure: "그래프의 대칭으로 축을 찾고, 방정식 f(x) = f(t) 의 다른 해를 역으로 구함", extra: "축 x = h 를 찾은 뒤 대칭점 2h - t 로 다른 해를 거꾸로 구해야 함 — medium 은 축만",
      concepts: ["포물선의 대칭", "꼭짓점의 x 좌표", "f(x) = f(t) 의 해"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { pair: true }); const t = q.H + rng.nz(-6, 6); if (q.xs.includes(t) || Math.abs(t - q.H) < 2) throw new GenFail("t"); const ans = 2 * q.H - t;
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} The equation $${fn}(x) = ${fn}(${t})$ has two solutions. One solution is $x = ${t}$.`, question: rng.pick([`What is the other solution?`, `What is the other value of $x$ that satisfies the equation?`]), correct: ans,
          wrongs: [W(-t, "sign_error", "t 의 부호만 바꿨다."), W(q.H, "step_missing", "대칭축을 답했다."), W(q.H - t, "formula_misuse", "h - t 로 계산했다."), W(2 * q.H + t, "sign_error", "2h + t 로 계산했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ t }, q.fig, `${QUADG_JS}return 2 * H - P.t;`),
          trace: [...quadGRead(q), [`같은 높이의 두 표시점 x = ${pairXs(q)[0]}, ${pairXs(q)[1]} 의 가운데로 축은 x = ${fmtNum(q.H)} 이다.`, "The axis lies midway between equal-height points."], [`다른 해 = 2 × ${fmtNum(q.H)} - ${t} = ${fmtNum(ans)} 이다.`, "Reflect t across the axis."]], variant: "reflect_across_axis",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 f 의 식을 세우고, g(x) = f(x) + mx 의 꼭짓점 x 좌표를 구함", extra: "f 의 a, b 를 구한 뒤 일차항이 바뀐 새 함수의 축 -(b + m)/(2a) 로 이어가야 함(f 의 축을 그대로 쓰는 것이 함정) — medium 은 f 의 축",
      concepts: ["이차식 세우기", "일차항 변화와 대칭축", "꼭짓점 공식"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { pair: rng.chance(0.5) }); const m = rng.nz(-5, 5) * q.A; if (Math.abs(m) < 2) throw new GenFail("m");
        const ans = -(q.B + m) / (2 * q.A); if (ans === q.H || !Number.isInteger(ans * 2)) throw new GenFail("ans");
        const me = m < 0 ? `- ${Math.abs(m)}x` : `+ ${m}x`;
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} ${rng.pick([`The graph of $y = ${fn}(x) ${me}$ is also a parabola.`, `Adding a linear term gives a new parabola, the graph of $y = ${fn}(x) ${me}$.`, `A new function is formed by the rule $y = ${fn}(x) ${me}$, and its graph is a parabola.`])}`, question: rng.pick([`What is the $x$-coordinate of the vertex of the graph of $y = ${fn}(x) ${me}$?`, `What is the $x$-coordinate of the vertex of this new parabola?`]), correct: ans,
          wrongs: [W(q.H, "condition_ignored", `${fn} 의 꼭짓점을 그대로 답했다.`), W(-(q.B - m) / (2 * q.A), "sign_error", "m 의 부호를 반대로 더했다."), W(q.H + m, "formula_misuse", "축을 m 만큼 옮겼다."), W(-(q.B + m) / q.A, "formula_misuse", "-b/a 로 계산했다."), W(-ans, "sign_error", "부호를 놓쳤다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m }, q.fig, `${QUADG_JS}return -(B + P.m) / (2 * A);`),
          trace: [...quadGRead(q), [`새 함수: y = ${fmtNum(q.A)}x² + (${fmtNum(q.B)} + ${m})x + ${fmtNum(q.C)} 이다.`, "Combine the linear terms."], [`꼭짓점 x = -(${fmtNum(q.B + m)}) ÷ (2 × ${fmtNum(q.A)}) = ${fmtNum(ans)} 이다.`, "Use x = -b / (2a)."]], variant: "vertex_after_linear_term",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프의 대칭으로 f 의 축을 찾고, g(x) = f(x - s)(평행이동) 의 꼭짓점 x 좌표를 구함", extra: "축을 찾은 뒤 함수 합성(입력 이동)의 방향을 해석해야 함(s 를 빼는 방향 함정) — medium 은 f 의 축",
      concepts: ["포물선의 대칭", "함수의 평행이동", "꼭짓점의 x 좌표"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { pair: true }); const s = rng.nz(-7, 7); if (Math.abs(s) === 1) throw new GenFail("s");
        const ans = q.H + s; const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: `${quadGIntro(rng, fn)} ${rng.pick([`The graph of $y = ${fn}(${se})$ is also a parabola.`, `Shifting the input gives a new parabola, the graph of $y = ${fn}(${se})$.`, `A new function is formed by the rule $y = ${fn}(${se})$, and its graph is a parabola.`])}`, question: rng.pick([`What is the $x$-coordinate of the vertex of the graph of $y = ${fn}(${se})$?`, `What is the $x$-coordinate of the vertex of this new parabola?`]), correct: ans,
          wrongs: [W(q.H - s, "sign_error", "이동 방향을 반대로 했다."), W(q.H, "condition_ignored", `${fn} 의 꼭짓점을 답했다.`), W(s, "step_missing", "이동량만 답했다."), W(q.K, "axis_misread", "꼭짓점의 y 좌표를 답했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QUADG_JS}return H + P.s;`),
          trace: [...quadGRead(q), [`y = ${fn}(${se}) 의 그래프는 ${fn} 의 그래프를 x 방향으로 ${s} 만큼 옮긴 것이다.`, "Replacing x with x - s shifts the graph s units horizontally."], [`꼭짓점 x = ${fmtNum(q.H)} + (${s}) = ${fmtNum(ans)} 이다.`, "Shift the vertex."]], variant: "vertex_after_shift",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertex_marked", structure: "꼭짓점이 점으로 표시된 포물선 그래프에서 꼭짓점 x 를 읽음", extra: "easy: 표시된 꼭짓점 읽기", concepts: ["포물선 그래프", "꼭짓점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { vertex: true });
        return figInst(rng, { stimulus: quadGIntro(rng, fn), question: vq(fn, rng), correct: q.H, wrongs: [W(q.K, "axis_misread", "꼭짓점의 y 좌표를 답했다."), W(-q.H, "sign_error", "부호를 바꿨다."), W(q.H + 1, "other", "한 칸 어긋났다."), W(q.H - 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== q.H), verificationJs: figJs({}, q.fig, `${QUADG_JS}return H;`), trace: [[`꼭짓점은 포물선이 가장 낮은(높은) 점 (${q.H}, ${q.K}) 이다.`, "The marked vertex."], [`꼭짓점의 x 좌표는 ${q.H} 이다.`, "Read the x-coordinate."]], variant: "read_marked_vertex",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "axis_from_pair", structure: "같은 높이의 두 표시점으로 포물선의 축(꼭짓점 x)을 구함", extra: "medium: 쌍의 가운데", concepts: ["포물선의 대칭", "꼭짓점"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadG(rng, fn, { pair: true });
        return figInst(rng, { stimulus: quadGIntro(rng, fn), question: vq(fn, rng), correct: q.H, wrongs: [W(pairXs(q)[0], "axis_misread", "표시점 하나의 x 를 답했다."), W(pairXs(q)[1], "axis_misread", "표시점 하나의 x 를 답했다."), W(-q.H, "sign_error", "부호를 바꿨다."), W(pairXs(q)[0] + pairXs(q)[1], "formula_misuse", "두 x 의 합을 답했다.")].filter((w) => w.v !== q.H), verificationJs: figJs({}, q.fig, `${QUADG_JS}return H;`), trace: [...quadGRead(q), [`같은 높이의 두 표시점 x = ${pairXs(q)[0]}, ${pairXs(q)[1]} 의 가운데가 축이다.`, "Midpoint of equal-height points."]], variant: "axis_from_pair",
        }, q.fig);
      },
    },
  ],
});
