// two_variable_data.intercept_residual_interpretation.SC.P#2 — 추세선 산점도에서 y 절편의 의미(서술 선지)와 절편·기울기 계산(x 절편·x=0 과의 예측 차·평행이동한 직선의 예측값)을 다룬다.
// 추세선은 그림에서(두 격자점 (0, b) 와 (X, e)) 읽는다 — 지문에는 식이 없다. 파일 이름의 _2 는 조합 id 의 #2 (모듈 경로에 # 를 쓸 수 없다).
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { fmtNum, lin } from "../../../text";
import { W } from "../../d-kit";
import { figJs, makeScatter, oneDec, r1d, SC_JS, type LineSrc } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { gInst } from "../graph-kit";

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const sing = (u: string) => u.replace(/s$/, "");
const pv = (s: LineSrc, x: number) => s.m * x + s.b;
const readTrace = (s: LineSrc): [string, string][] => [
  [`그림에서 직선 위의 두 격자점 (${s.p1[0]}, ${s.p1[1]}) 과 (${s.p2[0]}, ${s.p2[1]}) 를 읽는다.`, "Read two lattice points on the line."],
  [`기울기 m = (${s.p2[1]} - ${s.p1[1]}) ÷ (${s.p2[0]} - ${s.p1[0]}) = ${fmtNum(s.m)}, y 절편 b = ${fmtNum(s.b)}, 식은 y = ${lin(s.m, s.b)} 이다.`, "Slope, intercept, and equation."],
];
const ok = (n: number) => oneDec(n) && Math.abs(n) < 1000;

export const ITEM = defineItem({
  prefix: "tvd", itemId: "two_variable_data.intercept_residual_interpretation.SC.P#2",
  hard: [
    {
      op: "repr_shift", sprNo: MC_ONLY_STATEMENT, structure: "그림의 추세선에서 y 절편을 읽어 그 맥락적 의미(x = 0 일 때의 예측값)를 서술 선지에서 고름", extra: "절편(예측값)과 기울기(변화율)·관측값을 구별해 서술해야 함(기울기를 절편으로 말하거나 '관측했다'고 하는 선지가 함정) — medium 은 절편 읽기",
      concepts: ["산점도", "추세선(직선) 읽기", "절편의 의미"],
      gen(rng) {
        const s = makeScatter(rng); const t = s.topic; if (!Number.isInteger(s.b) || Math.abs(s.m) === 0) throw new GenFail("b");
        const mAbs = Math.abs(s.m); const tmpl = { c: `The line of best fit predicts ${t.y} to be #B ${t.yu} when ${t.x} is 0.`, s1: `The line of best fit predicts ${t.y} to be #M ${t.yu} when ${t.x} is 0.`, s2: `For each 1-${sing(t.xu)} increase in ${t.x}, the line predicts ${t.y} to ${s.m > 0 ? "increase" : "decrease"} by #B ${t.yu}.`, s3: `The data show that ${t.y} was exactly #B ${t.yu} when ${t.x} was 0.` };
        const f = (x: string) => x.replace("#B", fmtNum(s.b)).replace("#M", fmtNum(mAbs));
        return statementInst(rng, {
          stimulus: s.intro, question: rng.pick([`Which of the following is the best interpretation of the y-intercept of the line of best fit?`, `Which statement correctly interprets the y-intercept of the line of best fit shown?`]),
          correct: f(tmpl.c), wrongs: [{ text: f(tmpl.s1), reason: "기울기 값을 절편으로 말했다." }, { text: f(tmpl.s2), reason: "절편을 변화율(기울기)로 해석했다." }, { text: f(tmpl.s3), reason: "예측값을 관측값으로 말했다." }], figure: s.figure, P: { tmpl: JSON.stringify(tmpl) },
          body: `${SC_JS}const T=JSON.parse(P.tmpl); const want=T.c.replace('#B', String(Math.round(b*1e6)/1e6)); const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [...readTrace(s), [`y 절편은 x = 0 일 때 직선의 y 값 ${fmtNum(s.b)} 이다.`, "The intercept is the line's value at x = 0."], ["절편은 예측값이지 관측값이 아니며, 변화율은 기울기의 의미이다.", "Intercept = predicted value at 0; slope = rate of change."], [`따라서 x 가 0 일 때 ${fmtNum(s.b)} 를 예측한다는 서술이 맞다.`, "Choose the matching statement."]], variant: "interpret_intercept_statement",
        });
      },
    },
    {
      op: "chain2", structure: "추세선에서 예측값이 0 이 되는 x(x 절편)를 식으로 구함", extra: "그림에서 식을 세운 뒤 y = 0 을 풀어야 함(절편 b 나 기울기를 그대로 답하면 틀림) — medium 은 절편 읽기",
      concepts: ["산점도", "추세선(직선) 읽기", "x 절편"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeScatter(rng); if (s.m >= 0) continue; const x0 = -s.b / s.m; if (!ok(x0) || x0 <= 0) continue; const t = s.topic;
          return gInst(rng, {
            stimulus: s.intro, question: `According to the line of best fit, for what value of ${lc(t.xa)} (in ${t.xu}) is the predicted ${lc(t.ya)} equal to 0?`, correct: r1d(x0),
            wrongs: [W(s.b, "step_missing", "y 절편을 답했다."), W(r1d(Math.abs(s.m)), "step_missing", "기울기의 크기를 답했다."), W(r1d(-x0), "sign_error", "부호를 반대로 했다."), W(r1d(s.b * Math.abs(s.m)), "formula_misuse", "나누지 않고 곱했다."), W(r1d(x0 + 1), "other", "계산 중 1 어긋났다.")].filter((w) => w.v !== r1d(x0) && ok(w.v) && w.v > 0),
            verificationJs: figJs({}, s.figure, `${SC_JS}return Math.round(-b / m * 1e6) / 1e6;`),
            trace: [...readTrace(s), [`y = 0 을 대입하면 0 = ${fmtNum(s.m)}x + ${fmtNum(s.b)} 이다.`, "Set the predicted value to 0."], [`x = ${fmtNum(-s.b)} ÷ ${fmtNum(s.m)} = ${fmtNum(r1d(x0))} 이다.`, "Solve for x."], ["기울기가 음수라 x 절편은 양수이다.", "A negative slope gives a positive x-intercept."]], variant: "x_intercept_from_scatter",
          }, s.figure);
        }
        throw new GenFail("x0");
      },
    },
    {
      op: "compare_scenarios", structure: "x = a 의 예측값이 x = 0 의 예측값(절편)보다 얼마나 큰지(부호 포함) 구함", extra: "두 예측값을 모두 구해 비교하거나 기울기 × a 로 바로 구하는 관계를 알아야 함(절편만 답하면 틀림) — medium 은 절편 읽기",
      concepts: ["산점도", "추세선(직선) 읽기", "기울기의 의미"],
      gen(rng) {
        const s = makeScatter(rng); const t = s.topic; const a = rng.int(2, s.X - 1); const c = r1d(s.m * a); if (!ok(c) || c === 0) throw new GenFail("c");
        return gInst(rng, {
          stimulus: s.intro, question: `According to the line of best fit, how much greater is the predicted ${lc(t.ya)} (in ${t.yu}) when ${lc(t.xa)} is ${a} ${t.xu} than the predicted ${lc(t.ya)} when ${lc(t.xa)} is 0? (A negative answer means it is less.)`, correct: c,
          wrongs: [W(r1d(pv(s, a)), "step_missing", "x = a 의 예측값만 답했다."), W(s.b, "step_missing", "절편을 답했다."), W(-c, "sign_error", "순서를 바꿔 뺐다."), W(r1d(s.m), "step_missing", "기울기를 그대로 답했다."), W(r1d(c + s.m), "other", "계산 중 어긋났다.")].filter((w) => w.v !== c && ok(w.v)),
          verificationJs: figJs({ a }, s.figure, `${SC_JS}return Math.round((m * P.a + b - b) * 1e6) / 1e6;`),
          trace: [...readTrace(s), [`x = ${a}: ${fmtNum(s.m)} × ${a} + ${fmtNum(s.b)} = ${fmtNum(r1d(pv(s, a)))}, x = 0: ${fmtNum(s.b)} 이다.`, "Predicted values at a and 0."], [`차 = ${fmtNum(r1d(pv(s, a)))} - ${fmtNum(s.b)} = ${fmtNum(c)} 이다.`, "Subtract (equals slope times a)."], [`이는 기울기 × ${a} = ${fmtNum(c)} 와 같다.`, "The gain equals slope times a."]], variant: "prediction_gain_over_intercept",
        }, s.figure);
      },
    },
    {
      op: "param_condition", structure: "기울기는 같고 y 절편만 d 늘어난 새 직선의 x = a 예측값을 구함", extra: "원래 직선을 그림에서 읽은 뒤 절편만 바꿔(기울기는 유지) 다시 예측해야 함(기울기도 함께 바꾸면 틀림) — medium 은 원래 직선의 예측",
      concepts: ["산점도", "추세선(직선) 읽기", "절편의 변화"],
      gen(rng) {
        const s = makeScatter(rng); const t = s.topic; const a = rng.int(1, s.X - 1); const d = rng.pick([-1, 1]) * rng.int(1, 4) * Math.max(1, Math.round(s.S / 5)); const y = pv(s, a) + d; if (!ok(pv(s, a)) || !ok(y) || y <= 0) throw new GenFail("y");
        return gInst(rng, {
          stimulus: `${s.intro} A revised line has the same slope as the line of best fit shown, but its y-intercept is ${d > 0 ? d + " greater" : -d + " less"}.`, question: `According to the revised line, what is the predicted ${lc(t.ya)}, in ${t.yu}, when ${lc(t.xa)} is ${a} ${t.xu}?`, correct: r1d(y),
          wrongs: [W(r1d(pv(s, a)), "step_missing", "원래 직선의 예측값을 답했다."), W(r1d(pv(s, a) - d), "sign_error", "절편의 변화를 반대로 적용했다."), W(r1d(s.m * a + d), "step_missing", "원래 절편을 빠뜨렸다."), W(r1d((s.b + d) * s.m), "formula_misuse", "곱했다."), W(r1d(y + s.m), "other", "계산 중 어긋났다.")].filter((w) => w.v !== r1d(y) && ok(w.v) && w.v > 0),
          verificationJs: figJs({ a, d }, s.figure, `${SC_JS}return Math.round((m * P.a + b + P.d) * 1e6) / 1e6;`),
          trace: [...readTrace(s), [`새 직선: y = ${fmtNum(s.m)}x + ${fmtNum(r1d(s.b + d))} 이다.`, "Keep the slope and shift the intercept."], [`x = ${a} 에서 ${fmtNum(s.m)} × ${a} + ${fmtNum(r1d(s.b + d))} = ${fmtNum(r1d(y))} 이다.`, "Substitute."], [`따라서 ${fmtNum(r1d(y))} 이다.`, "State the prediction."]], variant: "shifted_intercept_prediction",
        }, s.figure);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "y_intercept", structure: "추세선의 y 절편을 읽음", extra: "easy: x = 0 의 값", concepts: ["산점도", "절편"],
      gen(rng) {
        const s = makeScatter(rng); const t = s.topic;
        return gInst(rng, { stimulus: s.intro, question: `According to the line of best fit, what is the predicted ${lc(t.ya)}, in ${t.yu}, when ${lc(t.xa)} is 0?`, correct: s.b, wrongs: [W(s.p2[1], "axis_misread", "직선의 오른쪽 끝 값을 읽었다."), W(r1d(Math.abs(s.m)), "step_missing", "기울기의 크기를 답했다."), W(s.b + s.S, "axis_misread", "눈금 한 칸 위를 읽었다."), W(Math.max(s.b - s.S, 1), "axis_misread", "눈금 한 칸 아래를 읽었다.")].filter((w) => w.v !== s.b && ok(w.v) && w.v > 0), verificationJs: figJs({}, s.figure, `${SC_JS}return b;`), trace: [...readTrace(s), [`x = 0 에서 직선의 값은 ${fmtNum(s.b)} 이다.`, "Read the intercept."]], variant: "read_intercept" }, s.figure);
      },
    },
    {
      lv: "medium", name: "slope_read", structure: "추세선의 기울기를 구함", extra: "medium: 두 점으로 기울기", concepts: ["산점도", "기울기"],
      gen(rng) {
        const s = makeScatter(rng); const t = s.topic; if (s.m === 0) throw new GenFail("m");
        return gInst(rng, { stimulus: s.intro, question: `According to the line of best fit, by how many ${t.yu} does the predicted ${lc(t.ya)} ${s.m > 0 ? "increase" : "decrease"} for each 1-${sing(t.xu)} increase in ${lc(t.xa)}?`, correct: r1d(Math.abs(s.m)), wrongs: [W(s.b, "step_missing", "절편을 답했다."), W(r1d(Math.abs(s.p2[1] - s.p1[1])), "step_missing", "x 로 나누지 않았다."), W(r1d(1 / Math.abs(s.m)), "formula_misuse", "거꾸로 나눴다."), W(r1d(Math.abs(s.m) + 1), "other", "계산 중 1 어긋났다.")].filter((w) => w.v !== r1d(Math.abs(s.m)) && ok(w.v) && w.v > 0), verificationJs: figJs({}, s.figure, `${SC_JS}return Math.round(Math.abs(m) * 1e6) / 1e6;`), trace: [...readTrace(s), [`기울기는 1 ${sing(t.xu)} 당 변화량 ${fmtNum(r1d(Math.abs(s.m)))} 이다.`, "Slope = change per unit."]], variant: "read_slope" }, s.figure);
      },
    },
  ],
});
