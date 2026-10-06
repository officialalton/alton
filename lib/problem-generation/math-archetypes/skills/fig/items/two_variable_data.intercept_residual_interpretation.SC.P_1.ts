// two_variable_data.intercept_residual_interpretation.SC.P#1 — 추세선 산점도에서 잔차(관측값 - 예측값)를 읽고 계산한다: 한 점의 잔차·두 점의 잔차 차·양의 잔차 개수·잔차로 관측값 복원.
// 추세선은 그림에서(두 격자점 (0, b) 와 (X, e)) 읽는다 — 지문에는 식이 없다.
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { fmtNum, lin } from "../../../text";
import { W } from "../../d-kit";
import { figJs, makeScatter, oneDec, r1d, SC_JS, type LineSrc } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const pv = (s: LineSrc, x: number) => s.m * x + s.b;
const pts = (s: LineSrc) => s.points!;
const resid = (s: LineSrc, i: number) => pts(s)[i][1] - pv(s, pts(s)[i][0]);
const readTrace = (s: LineSrc): [string, string][] => [
  [`그림에서 직선 위의 두 격자점 (${s.p1[0]}, ${s.p1[1]}) 과 (${s.p2[0]}, ${s.p2[1]}) 를 읽는다.`, "Read two lattice points on the line."],
  [`기울기 m = (${s.p2[1]} - ${s.p1[1]}) ÷ (${s.p2[0]} - ${s.p1[0]}) = ${fmtNum(s.m)}, 식은 y = ${lin(s.m, s.b)} 이다.`, "Slope and equation of the line."],
];
/** FIGURE(산점도)에서 점 배열 pts 와 추세선 m·b 를 읽고, 임의 x 의 점(x 가 유일)의 관측값 yAt(x) 를 정의한다. */
const SC_PTS = `${SC_JS}const pts = FIGURE.points; const yAt = (x) => { const q = pts.filter((p) => p[0] === x); if (q.length !== 1) throw new Error('그 x 의 점이 하나가 아님'); return q[0][1]; }; const res = (p) => p[1] - (m * p[0] + b);\n`;
const ok = (n: number) => oneDec(n) && Math.abs(n) < 1000;
const scene = (rng: Rng, o: { n?: number } = {}) => { const s = makeScatter(rng, o); if (new Set(pts(s).map((p) => p[0])).size !== pts(s).length) throw new GenFail("x 중복"); return s; };
const Wk = (s: LineSrc, a: number) => `the point with ${lc(s.topic.xa)} equal to ${a}`;

export const ITEM = defineItem({
  prefix: "tvd", itemId: "two_variable_data.intercept_residual_interpretation.SC.P#1",
  hard: [
    {
      op: "chain2", structure: "그림의 추세선에서 한 x 의 예측값을 구하고, 그 x 의 점의 관측값에서 빼 잔차를 구함", extra: "추세선을 그림에서 읽어 식을 세우고(예측값) 점의 관측값과 비교하는 2단 연쇄 — 관측값 - 예측값 의 부호가 함정 — medium 은 예측값만",
      concepts: ["산점도", "추세선(직선) 읽기", "잔차 = 관측값 - 예측값"],
      gen(rng) {
        const s = scene(rng); const i = rng.int(0, pts(s).length - 2); const [x, y] = pts(s)[i]; const p = pv(s, x); const c = r1d(y - p); if (!ok(c) || c === 0) throw new GenFail("c");
        return gInst(rng, {
          stimulus: s.intro, question: `What is the residual, in ${s.topic.yu}, for ${Wk(s, x)}? (Residual = actual value − predicted value.)`, correct: c,
          wrongs: [W(-c, "sign_error", "예측값 - 관측값 으로 계산했다."), W(r1d(p), "step_missing", "예측값만 답했다."), W(y, "step_missing", "관측값만 답했다."), W(r1d(c + s.S / 2), "other", "눈금 반 칸 어긋났다."), W(r1d(y + p), "sign_error", "더했다.")].filter((w) => w.v !== c && ok(w.v)),
          verificationJs: figJs({ x }, s.figure, `${SC_PTS}return Math.round((yAt(P.x) - (m * P.x + b)) * 1e6) / 1e6;`),
          trace: [...readTrace(s), [`x = ${x} 에서 예측값 = ${fmtNum(s.m)} × ${x} + ${fmtNum(s.b)} = ${fmtNum(r1d(p))} 이다.`, "Predicted value."], [`그 x 의 점의 관측값은 ${y} 이다.`, "Read the actual value."], [`잔차 = ${y} - ${fmtNum(r1d(p))} = ${fmtNum(c)} 이다.`, "Actual minus predicted."]], variant: "residual_of_one_point",
        }, s.figure);
      },
    },
    {
      op: "compare_scenarios", structure: "두 점의 잔차를 각각 구해 그 차(양수)를 구함", extra: "두 점 모두에서 예측값을 구해 잔차를 계산한 뒤 비교해야 함(관측값의 차만 보면 틀림) — medium 은 한 점의 잔차",
      concepts: ["산점도", "추세선(직선) 읽기", "잔차 비교"],
      gen(rng) {
        const s = scene(rng, { n: 9 }); const idx = rng.shuffle([...pts(s).keys()]); const [i, j] = idx; const a = pts(s)[i], b2 = pts(s)[j]; const ri = r1d(resid(s, i)), rj = r1d(resid(s, j)); const c = r1d(Math.abs(ri - rj)); if (!ok(c) || c === 0) throw new GenFail("c");
        return gInst(rng, {
          stimulus: s.intro, question: `What is the positive difference between the residual for ${Wk(s, a[0])} and the residual for ${Wk(s, b2[0])}, in ${s.topic.yu}?`, correct: c,
          wrongs: [W(r1d(Math.abs(a[1] - b2[1])), "step_missing", "관측값의 차를 구했다."), W(r1d(Math.abs(ri + rj)), "sign_error", "잔차를 더했다."), W(r1d(Math.abs(pv(s, a[0]) - pv(s, b2[0]))), "step_missing", "예측값의 차를 구했다."), W(r1d(Math.max(Math.abs(ri), Math.abs(rj))), "step_missing", "한 점의 잔차만 답했다."), W(r1d(c + s.S / 2), "other", "눈금 반 칸 어긋났다.")].filter((w) => w.v !== c && ok(w.v) && w.v >= 0),
          verificationJs: figJs({ xa: a[0], xb: b2[0] }, s.figure, `${SC_PTS}return Math.round(Math.abs((yAt(P.xa) - (m * P.xa + b)) - (yAt(P.xb) - (m * P.xb + b))) * 1e6) / 1e6;`),
          trace: [...readTrace(s), [`x = ${a[0]}: 관측 ${a[1]}, 예측 ${fmtNum(r1d(pv(s, a[0])))}, 잔차 ${fmtNum(ri)} 이다.`, "First residual."], [`x = ${b2[0]}: 관측 ${b2[1]}, 예측 ${fmtNum(r1d(pv(s, b2[0])))}, 잔차 ${fmtNum(rj)} 이다.`, "Second residual."], [`차 = |${fmtNum(ri)} - ${fmtNum(rj)}| = ${fmtNum(c)} 이다.`, "Positive difference."]], variant: "residual_difference_two_points",
        }, s.figure);
      },
    },
    {
      op: "constraint_select", structure: "추세선 위에 있는 점(양의 잔차)의 개수를 셈", extra: "그림에서 추세선을 기준으로 점의 위·아래를 구별해 세야 함(추세선 위에 있는 점만 양의 잔차) — medium 은 한 점",
      concepts: ["산점도", "추세선(직선) 읽기", "잔차의 부호"],
      gen(rng) {
        const s = scene(rng, { n: rng.int(8, 10) }); const n = pts(s).length; const pc = pts(s).filter((_, i) => resid(s, i) > 0).length; if (pc < 2 || n - pc < 2) throw new GenFail("balance");
        return gInst(rng, {
          stimulus: s.intro, question: rng.pick([`For how many of the ${n} data points is the residual positive?`, `How many of the ${n} points have a positive residual?`]), correct: pc,
          wrongs: [W(n - pc, "opposite", "음의 잔차를 센 개수를 답했다."), W(n, "condition_ignored", "전체 개수를 답했다."), W(pc + 1, "other", "하나를 더 셌다."), W(pc - 1, "other", "하나를 빠뜨렸다."), W(Math.round(n / 2), "other", "절반이라고 답했다.")].filter((w) => w.v !== pc && w.v > 0),
          verificationJs: figJs({ n }, s.figure, `${SC_PTS}if (pts.length !== P.n) throw new Error('점 개수'); return pts.filter((p) => res(p) > 1e-9).length;`),
          trace: [...readTrace(s), ["양의 잔차 = 관측값 > 예측값 = 점이 추세선 위에 있다.", "A positive residual means the point is above the line."], [`추세선 위에 있는 점을 센다: ${pc} 개이다.`, "Count the points above the line."], [`아래에 있는 점은 ${n - pc} 개이다.`, "The rest are below."]], variant: "count_positive_residuals",
        }, s.figure);
      },
    },
    {
      op: "inverse", structure: "추세선에서 x = a 의 예측값을 구한 뒤 주어진 잔차 d 를 더해 그 x 에서의 관측값을 역산", extra: "잔차 = 관측값 - 예측값 을 관측값에 대해 거꾸로 풀어야 함(예측값에서 빼면 틀림) — medium 은 예측값",
      concepts: ["산점도", "추세선(직선) 읽기", "잔차에서 관측값 역산"],
      gen(rng) {
        const s = scene(rng); const a = rng.int(1, s.X - 1); const d = rng.pick([-1, 1]) * rng.int(2, Math.max(3, Math.round(0.5 * s.S))); const p = pv(s, a); const y = p + d; if (!ok(p) || !ok(y) || y <= 0) throw new GenFail("y");
        return gInst(rng, {
          stimulus: `${s.intro} A new observation is added at ${lc(s.topic.xa)} equal to ${a}, and its residual is ${d}.`, question: `What is the actual ${lc(s.topic.ya)}, in ${s.topic.yu}, of the new observation?`, correct: r1d(y),
          wrongs: [W(r1d(p - d), "sign_error", "예측값에서 잔차를 뺐다."), W(r1d(p), "step_missing", "예측값만 답했다."), W(r1d(d), "step_missing", "잔차만 답했다."), W(r1d(y + s.S / 2), "other", "눈금 반 칸 어긋났다."), W(r1d(p * d), "formula_misuse", "곱했다.")].filter((w) => w.v !== r1d(y) && ok(w.v) && w.v > 0),
          verificationJs: figJs({ a, d }, s.figure, `${SC_PTS}return Math.round((m * P.a + b + P.d) * 1e6) / 1e6;`),
          trace: [...readTrace(s), [`x = ${a} 에서 예측값 = ${fmtNum(s.m)} × ${a} + ${fmtNum(s.b)} = ${fmtNum(r1d(p))} 이다.`, "Predicted value."], ["잔차 = 관측값 - 예측값 이므로 관측값 = 예측값 + 잔차 이다.", "Solve the residual formula for the actual value."], [`관측값 = ${fmtNum(r1d(p))} + (${d}) = ${fmtNum(r1d(y))} 이다.`, "Compute."], [`따라서 ${fmtNum(r1d(y))} ${s.topic.yu} 이다.`, "State the actual value."]], variant: "actual_from_residual",
        }, s.figure);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "predicted_value", structure: "추세선으로 한 x 의 예측값을 구함", extra: "easy: 식에 대입", concepts: ["산점도", "추세선(직선) 읽기"],
      gen(rng) {
        const s = scene(rng); const a = rng.int(1, s.X - 1); const p = pv(s, a); if (!ok(p) || p <= 0) throw new GenFail("p");
        return gInst(rng, { stimulus: s.intro, question: `According to the line of best fit, what is the predicted ${lc(s.topic.ya)}, in ${s.topic.yu}, when ${lc(s.topic.xa)} is ${a}?`, correct: r1d(p), wrongs: [W(r1d(p + s.S / 2), "other", "눈금 반 칸 어긋났다."), W(s.b, "step_missing", "y 절편만 답했다."), W(r1d(s.m * a), "step_missing", "절편을 더하지 않았다."), W(r1d(p - s.S / 2), "other", "눈금 반 칸 어긋났다.")].filter((w) => w.v !== r1d(p) && ok(w.v)), verificationJs: figJs({ a }, s.figure, `${SC_PTS}return Math.round((m * P.a + b) * 1e6) / 1e6;`), trace: [...readTrace(s), [`${fmtNum(s.m)} × ${a} + ${fmtNum(s.b)} = ${fmtNum(r1d(p))} 이다.`, "Substitute."]], variant: "predicted_value" }, s.figure);
      },
    },
    {
      lv: "medium", name: "residual_one_point", structure: "한 점의 잔차를 구함", extra: "medium: 예측값과 관측값의 차", concepts: ["산점도", "잔차"],
      gen(rng) {
        const s = scene(rng); const i = rng.int(0, pts(s).length - 2); const [x, y] = pts(s)[i]; const p = pv(s, x); const c = r1d(y - p); if (!ok(c) || c === 0) throw new GenFail("c");
        return gInst(rng, { stimulus: s.intro, question: `What is the residual for ${Wk(s, x)}, in ${s.topic.yu}?`, correct: c, wrongs: [W(-c, "sign_error", "부호를 반대로 했다."), W(r1d(p), "step_missing", "예측값만 답했다."), W(y, "step_missing", "관측값만 답했다."), W(r1d(c + s.S / 2), "other", "눈금 반 칸 어긋났다.")].filter((w) => w.v !== c && ok(w.v)), verificationJs: figJs({ x }, s.figure, `${SC_PTS}return Math.round((yAt(P.x) - (m * P.x + b)) * 1e6) / 1e6;`), trace: [...readTrace(s), [`예측 ${fmtNum(r1d(p))}, 관측 ${y} → 잔차 ${fmtNum(c)} 이다.`, "Actual minus predicted."]], variant: "residual_one_point_simple" }, s.figure);
      },
    },
  ],
});
