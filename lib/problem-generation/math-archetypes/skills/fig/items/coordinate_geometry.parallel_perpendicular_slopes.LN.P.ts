// coordinate_geometry.parallel_perpendicular_slopes.LN.P — 순수 함수 그래프(축 제목 x·y)로 주어진 직선에 평행·수직인 직선의 기울기·절편·계수를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { GL_JS, makePureLine, pureIntro, purRead } from "../pure-kit";
import { crossSafe, labelClear } from "../pure-fn-kit";

/** 직선이 원점 라벨·눈금 숫자와 겹치지 않는 장면만 쓴다(겹치면 이 시드는 건너뛴다). */
const pl = (rng: Rng, o: { ms?: number[] }) => { for (let t = 0; t < 80; t++) { const s = makePureLine(rng, o); if (crossSafe(s.b, s.R) && crossSafe(s.b / s.m, s.R) && labelClear((x) => s.m * x + s.b, s.R)) return s; } throw new GenFail("라벨 겹침 없는 직선 표집 실패"); };

const isInt = Number.isInteger;
const LEAD = ["", "", "A student is studying a line in the coordinate plane. ", "A teacher draws a line on a grid. ", "A graphing program draws a line. ", "A designer sketches a straight edge on graph paper. ", "An engineer plots a straight path on a grid. ", "During a geometry lesson, a class graphs a line. ", "A surveyor marks a straight boundary on a map grid. "];
const intro = (rng: Rng) => rng.pick(LEAD) + pureIntro(rng);
const MS_ALL = [-4, -3, -2, -1, 1, 2, 3, 4];
const MS_UNIT = [-4, -2, -1, 1, 2, 4];

export const ITEM = defineItem({
  prefix: "cpg", itemId: "coordinate_geometry.parallel_perpendicular_slopes.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "그래프의 점들로 기울기를 구하고, 이 직선에 수직이며 점 (p, q) 를 지나는 직선의 y 절편을 구함", extra: "기울기 → 수직(음의 역수) → 점 대입으로 절편, 3단 연쇄(평행·부호 함정) — medium 은 수직 기울기",
      concepts: ["좌표평면 그래프", "수직선의 기울기", "점-기울기로 절편"],
      gen(rng) {
        const s = pl(rng, { ms: MS_UNIT }); const k = rng.nz(-4, 4); const p = s.m * k; const q = rng.int(-20, 20); const c = q + k; if (Math.abs(p) > 20 || c === 0) throw new GenFail("p");
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`A second line is perpendicular to the line shown and passes through the point with $x$-coordinate ${p} and $y$-coordinate ${q}.`, `Another line is perpendicular to the line shown. When $x = ${p}$, the $y$-value on this line is ${q}.`, `A second line is drawn perpendicular to the line shown. It contains the point where $x = ${p}$ and $y = ${q}$.`])}`,
          question: rng.pick([`What is the $y$-coordinate of the $y$-intercept of the second line?`, `At what $y$-value does the second line cross the $y$-axis?`, `What is the $y$-intercept of the second line?`]), correct: c,
          wrongs: [W(q - s.m * p, "condition_ignored", "평행한 직선(같은 기울기)으로 계산했다."), W(q - k, "sign_error", "부호를 반대로 했다."), W(q, "step_missing", "점의 y 좌표를 답했다."), W(s.b, "condition_ignored", "원래 직선의 절편을 답했다."), W(c + 1, "other", "한 칸 어긋났다.")].filter((w) => isInt(w.v) && w.v !== c),
          verificationJs: figJs({ p, q }, s.fig, `${GL_JS}return P.q + P.p / m;`),
          trace: [...purRead(s), [`수직인 직선의 기울기는 ${s.m} 의 음의 역수 ${fmtNum(-1 / s.m)} 이다.`, "Perpendicular slopes multiply to -1."], [`y = ${fmtNum(-1 / s.m)}x + c 에 점 (${p}, ${q}) 를 대입한다.`, "Substitute the point."], [`c = ${q} - (${fmtNum(-1 / s.m)})(${p}) = ${c} 이다.`, "Solve for c."]], variant: "perpendicular_intercept",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "그래프의 점들로 기울기를 구하고, 이 직선과 평행하며 점 (p, q) 를 지나는 직선의 x 절편을 구함", extra: "기울기 → 평행(같은 기울기) → x 절편 p - q/m 으로 2단 연쇄(y 절편을 답하는 것이 함정) — medium 은 기울기",
      concepts: ["좌표평면 그래프", "평행선의 기울기", "x 절편"],
      gen(rng) {
        const s = pl(rng, {}); const k = rng.nz(-4, 4); const q = s.m * k; const p = rng.int(-12, 12); const ans = p - k; if (Math.abs(q) > 20 || ans === 0 || ans === p) throw new GenFail("q");
        return figInst(rng, {
          stimulus: `${intro(rng)} ${rng.pick([`A second line is parallel to the line shown and passes through the point with $x$-coordinate ${p} and $y$-coordinate ${q}.`, `Another line is parallel to the line shown. When $x = ${p}$, the $y$-value on this line is ${q}.`, `A second line is drawn parallel to the line shown. It contains the point where $x = ${p}$ and $y = ${q}$.`])}`,
          question: rng.pick([`At what $x$-value does the second line cross the $x$-axis?`, `What is the $x$-intercept of the second line?`, `What is the $x$-coordinate of the point where the second line crosses the $x$-axis?`]), correct: ans,
          wrongs: [W(q - s.m * p, "step_missing", "y 절편을 답했다."), W(p + k, "sign_error", "부호를 반대로 했다."), W(p, "step_missing", "점의 x 좌표를 답했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(ans + 1, "other", "한 칸 어긋났다.")].filter((w) => isInt(w.v) && w.v !== ans),
          verificationJs: figJs({ p, q }, s.fig, `${GL_JS}return P.p - P.q / m;`),
          trace: [...purRead(s), [`평행한 직선의 기울기도 ${s.m} 이다.`, "Parallel lines share the slope."], [`y = ${s.m}x + c 에 점 (${p}, ${q}) 를 대입해 c = ${q} - (${s.m})(${p}) = ${q - s.m * p} 를 얻는다.`, "Find the intercept."], [`y = 0 일 때 x = ${ans} 이다.`, "Solve for the x-intercept."]], variant: "parallel_x_intercept",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "그래프의 점들로 기울기를 구하고, 이 직선이 kx + dy = c 와 평행(또는 수직)일 때의 k 를 구함", extra: "표준형의 기울기 -k/d 를 평행(같음)·수직(곱 -1) 조건에 맞춰 k 를 풀어야 함(부호·역수 함정) — medium 은 기울기",
      concepts: ["좌표평면 그래프", "표준형의 기울기", "평행·수직 조건"],
      gen(rng) {
        const perp = rng.chance(0.5); const d = rng.pick([2, 3, 4, 5, 6]); const s = pl(rng, { ms: perp ? MS_UNIT : MS_ALL }); const k = perp ? d / s.m : -s.m * d; if (!isInt(k) || k === 0) throw new GenFail("k"); const c = rng.int(2, 20);
        return figInst(rng, {
          stimulus: `${intro(rng)} ${perp ? rng.pick([`The line shown is perpendicular to the line with equation $kx + ${d}y = ${c}$, where $k$ is a constant.`, `In the $xy$-plane, the line shown and the line $kx + ${d}y = ${c}$, where $k$ is a constant, are perpendicular.`, `The graph of $kx + ${d}y = ${c}$, where $k$ is a constant, is perpendicular to the line shown.`]) : rng.pick([`The line shown is parallel to the line with equation $kx + ${d}y = ${c}$, where $k$ is a constant.`, `In the $xy$-plane, the line shown and the line $kx + ${d}y = ${c}$, where $k$ is a constant, are parallel.`, `The graph of $kx + ${d}y = ${c}$, where $k$ is a constant, is parallel to the line shown.`])}`,
          question: rng.pick([`What is the value of $k$?`, `What is $k$?`, `What is the value of the constant $k$?`]), correct: k,
          wrongs: [W(-k, "sign_error", "부호를 반대로 했다."), W(s.m * d, "sign_error", "기울기 -k/d 의 부호를 놓쳤다."), W(perp ? -s.m * d : d / s.m, "condition_ignored", perp ? "평행 조건으로 계산했다." : "수직 조건으로 계산했다."), W(d, "step_missing", "d 만 답했다."), W(k + 1, "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== k),
          verificationJs: figJs({ d, perp: perp ? 1 : 0 }, s.fig, `${GL_JS}return P.perp ? P.d / m : -m * P.d;`),
          trace: [...purRead(s), [`kx + ${d}y = ${c} 의 기울기는 -k ÷ ${d} 이다.`, "Solve the standard form for y."], [perp ? `수직이므로 (-k/${d}) × (${s.m}) = -1 이다.` : `평행이므로 -k/${d} = ${s.m} 이다.`, perp ? "The slopes multiply to -1." : "The slopes are equal."], [`k = ${k} 이다.`, "Solve for k."]], variant: perp ? "coefficient_perpendicular" : "coefficient_parallel",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "그래프의 점들로 기울기를 구하고, 원점과 (a, t) 를 지나는 직선이 이 직선과 평행(또는 수직)일 때 t 를 역산", extra: "두 점의 기울기 t/a 를 평행(같음)·수직(음의 역수)에 맞춰 t 를 거꾸로 구해야 함(기울기 자체를 답하는 것이 함정) — medium 은 기울기",
      concepts: ["좌표평면 그래프", "두 점의 기울기", "평행·수직 조건"],
      gen(rng) {
        const perp = rng.chance(0.5); const s = pl(rng, { ms: perp ? MS_UNIT : MS_ALL }); const a = perp ? s.m * rng.nz(-4, 4) : rng.nz(-9, 9); const t = perp ? -a / s.m : s.m * a; if (!isInt(t) || t === 0 || Math.abs(a) > 20 || Math.abs(t) > 20) throw new GenFail("t");
        return figInst(rng, {
          stimulus: `${intro(rng)} ${perp ? rng.pick([`A second line passes through the origin and the point $(${a}, t)$. This line is perpendicular to the line shown.`, `The line through the origin and the point $(${a}, t)$ is perpendicular to the line shown.`, `A line is perpendicular to the line shown and contains both the origin and the point $(${a}, t)$.`]) : rng.pick([`A second line passes through the origin and the point $(${a}, t)$. This line is parallel to the line shown.`, `The line through the origin and the point $(${a}, t)$ is parallel to the line shown.`, `A line is parallel to the line shown and contains both the origin and the point $(${a}, t)$.`])}`,
          question: rng.pick([`What is the value of $t$?`, `What is $t$?`, `Find the value of $t$.`]), correct: t,
          wrongs: [W(-t, "sign_error", "부호를 반대로 했다."), W(perp ? s.m * a : -a / s.m, "condition_ignored", perp ? "평행 조건으로 계산했다." : "수직 조건으로 계산했다."), W(s.m, "step_missing", "기울기를 답했다."), W(a, "axis_misread", "a 를 답했다."), W(t + 1, "other", "어긋났다.")].filter((w) => isInt(w.v) && w.v !== t),
          verificationJs: figJs({ a, perp: perp ? 1 : 0 }, s.fig, `${GL_JS}return P.perp ? -P.a / m : m * P.a;`),
          trace: [...purRead(s), [perp ? `수직인 직선의 기울기는 ${fmtNum(-1 / s.m)} 이다.` : `평행한 직선의 기울기는 ${s.m} 이다.`, perp ? "Use the negative reciprocal." : "Use the same slope."], [`원점과 (${a}, t) 를 지나는 직선의 기울기는 t ÷ ${a} 이다.`, "Slope through two points."], [`t = ${perp ? fmtNum(-1 / s.m) : s.m} × ${a} = ${t} 이다.`, "Solve for t."]], variant: perp ? "t_perpendicular_origin" : "t_parallel_origin",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "parallel_slope", structure: "그래프의 두 점으로 기울기를 구해 평행한 직선의 기울기를 답함", extra: "easy: 평행 = 같은 기울기", concepts: ["좌표평면 그래프", "평행선의 기울기"],
      gen(rng) {
        const s = pl(rng, { ms: MS_ALL }); if (s.d === 1) throw new GenFail("d");
        return figInst(rng, { stimulus: `${intro(rng)} ${rng.pick([`A second line is parallel to the line shown.`, `Another line is parallel to the line shown.`, `A second line is drawn parallel to the line shown.`])}`, question: rng.pick([`What is the slope of the second line?`, `What is the slope of the parallel line?`, `Find the slope of the second line.`]), correct: s.m, wrongs: [W(-s.m, "sign_error", "부호를 바꿨다."), W(-1 / s.m, "formula_misuse", "수직 조건으로 계산했다."), W(s.b, "formula_misuse", "절편을 답했다."), W(s.m * s.d, "unit_error", "y 의 변화만 답했다.")].filter((w) => w.v !== s.m), verificationJs: figJs({}, s.fig, `${GL_JS}return m;`), trace: [...purRead(s), [`평행한 직선의 기울기는 ${s.m} 이다.`, "Parallel lines share the slope."]], variant: "parallel_slope",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "perpendicular_slope", structure: "그래프의 점들로 기울기를 구하고 수직인 직선의 기울기(음의 역수)를 구함", extra: "medium: 음의 역수", concepts: ["좌표평면 그래프", "수직선의 기울기"],
      gen(rng) {
        const s = pl(rng, { ms: MS_UNIT }); const correct = -1 / s.m;
        return figInst(rng, { stimulus: `${intro(rng)} ${rng.pick([`A second line is perpendicular to the line shown.`, `Another line is perpendicular to the line shown.`])}`, question: rng.pick([`What is the slope of the second line?`, `What is the slope of the perpendicular line?`]), correct, fmt: fmtNum, wrongs: [W(s.m, "condition_ignored", "같은 기울기를 답했다."), W(-s.m, "formula_misuse", "부호만 바꿨다."), W(1 / s.m, "sign_error", "역수만 취했다."), W(-s.m * 2, "other", "계산 중 어긋났다.")].filter((w) => Math.abs(w.v - correct) > 1e-9), verificationJs: figJs({}, s.fig, `${GL_JS}return -1 / m;`), trace: [...purRead(s), [`수직인 두 직선의 기울기의 곱은 -1 이다.`, "Perpendicular slopes multiply to -1."], [`기울기 = -1 ÷ ${s.m} = ${fmtNum(correct)} 이다.`, "Take the negative reciprocal."]], variant: "perpendicular_slope_unit",
        }, s.fig);
      },
    },
  ],
});
