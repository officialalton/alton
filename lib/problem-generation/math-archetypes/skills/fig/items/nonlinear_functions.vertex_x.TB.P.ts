// nonlinear_functions.vertex_x.TB.P — 이차함수 값표에서 그래프 꼭짓점의 x 좌표(대칭축)를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn, QUAD_JS, quadAround, quadIntro, quadOneSided, quadRead, symStep, type Quad } from "./_t5-kit";

const vq = (fn: string, rng: Rng) => rng.pick([`What is the $x$-coordinate of the vertex of the graph of $y = ${fn}(x)$ in the $xy$-plane?`, `The graph of $y = ${fn}(x)$ is a parabola in the $xy$-plane. What is the $x$-coordinate of its vertex?`, `What is the $x$-coordinate of the vertex of the parabola $y = ${fn}(x)$?`]);
const ext = (q: Quad) => (q.A > 0 ? "minimum" : "maximum");

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.vertex_x.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점이 표 밖에 있고 같은 값의 쌍도 없는 이차 값표에서 식(a, b)을 세워 꼭짓점 x = -b/(2a) 를 구함", extra: "대칭 쌍이 없어 2계 차분으로 a, 두 점으로 b 를 구한 뒤 -b/(2a) 로 바꿔야 함(표의 극값 칸을 꼭짓점으로 읽는 것이 함정) — medium 은 같은 값의 쌍으로 축을 읽음",
      concepts: ["이차 값표의 2계 차분", "이차식 세우기", "꼭짓점(대칭축) 공식"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadOneSided(rng, fn, rng.chance(0.3)); const H = q.H;
        const near = q.xs[q.ys.indexOf(q.A > 0 ? Math.min(...q.ys) : Math.max(...q.ys))];
        return figInst(rng, {
          stimulus: quadIntro(rng, fn), question: vq(fn, rng), correct: H,
          wrongs: [W(near, "axis_misread", "표에서 가장 작은(큰) 값의 x 를 꼭짓점으로 읽었다."), W(-H, "sign_error", "-b/(2a) 의 부호를 놓쳤다."), W(2 * H, "formula_misuse", "-b/a 로 계산했다."), W(q.K, "axis_misread", "꼭짓점의 y 좌표를 답했다."), W(H + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== H),
          verificationJs: figJs({}, q.fig, `${QUAD_JS}return H;`),
          trace: [...quadRead(q), [`꼭짓점 x = -(${fmtNum(q.B)}) ÷ (2 × ${fmtNum(q.A)}) = ${fmtNum(H)} 이다.`, "Use x = -b / (2a)."]], variant: "vertex_from_fit",
        }, q.fig);
      },
    },
    {
      op: "inverse", structure: "값표의 대칭으로 축을 찾고, 방정식 f(x) = f(t)(t 는 표 밖)의 다른 해를 역으로 구함", extra: "축 x = h 를 찾은 뒤 대칭점 2h - t 로 다른 해를 거꾸로 구해야 함 — medium 은 축만",
      concepts: ["이차함수의 대칭", "꼭짓점의 x 좌표", "f(x) = f(t) 의 해"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadAround(rng, fn, rng.chance(0.5)); const t = q.xs[q.xs.length - 1] + rng.int(2, 6); const ans = 2 * q.H - t; if (ans === t) throw new GenFail("same");
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The equation $${fn}(x) = ${fn}(${t})$ has two solutions. One solution is $x = ${t}$.`, question: rng.pick([`What is the other solution?`, `What is the other value of $x$ that satisfies the equation?`]), correct: ans,
          wrongs: [W(-t, "sign_error", "t 의 부호만 바꿨다."), W(q.H, "step_missing", "대칭축을 답했다."), W(q.H - t, "formula_misuse", "h - t 로 계산했다."), W(2 * q.H + t, "sign_error", "2h + t 로 계산했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ t }, q.fig, `${QUAD_JS}return 2 * H - P.t;`),
          trace: [quadRead(q)[0], quadRead(q)[1], symStep(q), [`이차함수는 x = ${fmtNum(q.H)} 에 대해 대칭이므로 같은 값의 두 x 는 축에서 같은 거리에 있다.`, "Equal outputs are equidistant from the axis."], [`다른 해 = 2 × ${fmtNum(q.H)} - ${t} = ${fmtNum(ans)} 이다.`, "Reflect t across the axis."]], variant: "reflect_across_axis",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "값표에서 f 의 식을 세우고, g(x) = f(x) + mx 의 꼭짓점 x 좌표를 구함", extra: "f 의 a, b 를 구한 뒤 일차항이 바뀐 새 함수의 축 -(b + m)/(2a) 로 이어가야 함(f 의 축을 그대로 쓰는 것이 함정) — medium 은 f 의 축",
      concepts: ["이차식 세우기", "일차항 변화와 대칭축", "꼭짓점 공식"],
      gen(rng) {
        const fn = pickFn(rng); const g = pickFn(rng, [fn]); const q = quadAround(rng, fn, rng.chance(0.5)); const m = rng.nz(-5, 5) * q.A; if (Math.abs(m) < 2) throw new GenFail("m");
        const ans = -(q.B + m) / (2 * q.A); if (ans === q.H || !Number.isInteger(ans * 2)) throw new GenFail("ans");
        const me = m < 0 ? `- ${Math.abs(m)}x` : `+ ${m}x`;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${fn}(x) ${me}$.`, question: `What is the $x$-coordinate of the vertex of the graph of $y = ${g}(x)$ in the $xy$-plane?`, correct: ans,
          wrongs: [W(q.H, "condition_ignored", `${fn} 의 꼭짓점을 그대로 답했다.`), W(-(q.B - m) / (2 * q.A), "sign_error", "m 의 부호를 반대로 더했다."), W(q.H + m, "formula_misuse", "축을 m 만큼 옮겼다."), W(-(q.B + m) / q.A, "formula_misuse", "-b/a 로 계산했다."), W(-ans, "sign_error", "부호를 놓쳤다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ m }, q.fig, `${QUAD_JS}return -(B + P.m) / (2 * A);`),
          trace: [...quadRead(q), [`${g}(x) = ${fmtNum(q.A)}x² + (${fmtNum(q.B)} + ${m})x + ${fmtNum(q.C)} 이다.`, "Combine the linear terms."], [`꼭짓점 x = -(${fmtNum(q.B + m)}) ÷ (2 × ${fmtNum(q.A)}) = ${fmtNum(ans)} 이다.`, "Use x = -b / (2a)."]], variant: "vertex_after_linear_term",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "값표의 대칭으로 f 의 축을 찾고, g(x) = f(x - s)(평행이동) 의 꼭짓점 x 좌표를 구함", extra: "축을 찾은 뒤 함수 합성(입력 이동)의 방향을 해석해야 함(s 를 빼는 방향 함정) — medium 은 f 의 축",
      concepts: ["이차함수의 대칭", "함수의 평행이동", "꼭짓점의 x 좌표"],
      gen(rng) {
        const fn = pickFn(rng); const g = pickFn(rng, [fn]); const q = quadAround(rng, fn, rng.chance(0.5)); const s = rng.nz(-7, 7); if (Math.abs(s) === 1) throw new GenFail("s");
        const ans = q.H + s; const se = s > 0 ? `x - ${s}` : `x + ${-s}`;
        return figInst(rng, {
          stimulus: `${quadIntro(rng, fn)} The function $${g}$ is defined by $${g}(x) = ${fn}(${se})$.`, question: `What is the $x$-coordinate of the vertex of the graph of $y = ${g}(x)$ in the $xy$-plane?`, correct: ans,
          wrongs: [W(q.H - s, "sign_error", "이동 방향을 반대로 했다."), W(q.H, "condition_ignored", `${fn} 의 꼭짓점을 답했다.`), W(s, "step_missing", "이동량만 답했다."), W(q.K, "axis_misread", "꼭짓점의 y 좌표를 답했다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ s }, q.fig, `${QUAD_JS}return H + P.s;`),
          trace: [quadRead(q)[0], quadRead(q)[1], symStep(q), [`${g}(x) = ${fn}(${se}) 의 그래프는 ${fn} 의 그래프를 x 방향으로 ${s} 만큼 옮긴 것이다.`, "Replacing x with x - s shifts the graph s units horizontally."], [`꼭짓점 x = ${fmtNum(q.H)} + (${s}) = ${fmtNum(ans)} 이다.`, "Shift the vertex."]], variant: "vertex_after_shift",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertex_in_table", structure: "꼭짓점 행이 표에 있는 값표에서 대칭으로 꼭짓점 x 를 읽음", extra: "easy: 같은 값의 쌍 사이 가운데", concepts: ["이차함수의 대칭", "꼭짓점"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadAround(rng, fn, true);
        return figInst(rng, { stimulus: quadIntro(rng, fn), question: vq(fn, rng), correct: q.H, wrongs: [W(q.K, "axis_misread", "꼭짓점의 y 좌표를 답했다."), W(-q.H, "sign_error", "부호를 바꿨다."), W(q.H + 1, "other", "한 칸 어긋났다."), W(q.H - 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== q.H), verificationJs: figJs({}, q.fig, `${QUAD_JS}return H;`), trace: [symStep(q), [`${fn}(${fmtNum(q.H)}) = ${fmtNum(q.K)} 가 ${ext(q)} 이므로 꼭짓점의 x 좌표는 ${fmtNum(q.H)} 이다.`, "The vertex is on the axis of symmetry."]], variant: "vertex_read",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "axis_between_rows", structure: "꼭짓점이 두 x 사이(표에 없음)인 값표에서 같은 값의 쌍으로 꼭짓점 x 를 구함", extra: "medium: 쌍의 가운데(반정수)", concepts: ["이차함수의 대칭", "꼭짓점"],
      gen(rng) {
        const fn = pickFn(rng); const q = quadAround(rng, fn, false);
        return figInst(rng, { stimulus: quadIntro(rng, fn), question: vq(fn, rng), correct: q.H, wrongs: [W(q.H - 0.5, "axis_misread", "표의 극값 칸 x 를 읽었다."), W(q.H + 0.5, "axis_misread", "표의 극값 칸 x 를 읽었다."), W(-q.H, "sign_error", "부호를 바꿨다."), W(2 * q.H, "formula_misuse", "두 x 의 합을 답했다.")].filter((w) => w.v !== q.H), verificationJs: figJs({}, q.fig, `${QUAD_JS}return H;`), trace: [quadRead(q)[0], symStep(q), [`따라서 꼭짓점의 x 좌표는 ${fmtNum(q.H)} 이다.`, "The vertex lies on the axis."]], variant: "vertex_half",
        }, q.fig);
      },
    },
  ],
});
