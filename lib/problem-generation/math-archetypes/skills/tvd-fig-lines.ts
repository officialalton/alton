// two_variable_data — 자료(산점도·선그래프)가 붙는 원형. 추세선(직선 모형)은 그림에서 읽고, 지문에는 그 값이 없다.
// 항목(조사 문서 5-6 파일럿): scatter_equation(SC·LG)·scatter_predict(SC·LG)·scatter_slope_context(SC·LG)·scatter_count_above(SC) — 지문형(P).
import { GenFail, type Archetype, type Instance, type OperatorId } from "../types";
import type { Rng } from "../rng";
import { gcd } from "../rng";
import { fmtNum, lin, spin } from "../text";
import { W } from "./d-kit";
import { figJs, figInst, makeLineSrc, oneDec, r1d, type LineSrc } from "../figure-kit";
import { CONV_TOPICS as CONV } from "../figure-topics";

const SKILL = "two_variable_data";
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const sing = (u: string) => u.replace(/s$/, "");
const isInt = Number.isInteger;
const sgn = (n: number) => (n < 0 ? "-" : "+");

/** 풀이 해설 앞 3단: 두 격자점 읽기 → 기울기 → 식. */
const readTrace = (s: LineSrc): [string, string][] => [
  [`그림에서 직선 위의 두 격자점 (${s.p1[0]}, ${s.p1[1]}) 과 (${s.p2[0]}, ${s.p2[1]}) 를 읽는다.`, "Read two lattice points on the line."],
  [`기울기 m = (${s.p2[1]} - ${s.p1[1]}) ÷ (${s.p2[0]} - ${s.p1[0]}) = ${fmtNum(s.m)} 이다.`, "Compute the slope from the two points."],
  [`식은 y = ${lin(s.m, s.b)} 이다.`, "Write the equation of the line."],
];
const pv = (s: LineSrc, x: number) => s.m * x + s.b;

type OpDef = { op: OperatorId; structure: string; extra: string; concepts: string[]; gen: (rng: Rng, shape: "SC" | "LG") => Instance };
function build(kind: string, shape: "SC" | "LG", ops: OpDef[], mediumSteps = 3): Archetype[] {
  return ops.map((o) => ({
    id: `tvd.${kind}.${shape}.P.${o.op}`, skill: SKILL, kind: `${kind}.${shape}.P`, operator: o.op, structure: o.structure, extraThinking: o.extra, concepts: o.concepts, mediumSteps,
    figureItem: `two_variable_data.${kind}.${shape}.P`, spr: { capable: true, reason: "정답이 하나의 수(정수·소수)이고 질문이 선택지를 가리키지 않아 선택지 없이 낼 수 있다" },
    generate: (rng) => o.gen(rng, shape),
  }));
}
const CONC = (shape: "SC" | "LG") => (shape === "SC" ? "산점도 추세선" : "선그래프 직선 패턴");

// ═════════════ scatter_equation ═════════════
const eqOps: OpDef[] = [
  {
    op: "inverse", structure: "그림의 직선에서 식을 읽은 뒤 예측값이 주어진 값 T 가 되는 x 를 역산", extra: "그림에서 두 점으로 식을 직접 세우고(값이 지문에 없음) y = T 를 거꾸로 푸는 역산 — medium 은 식이 주어진 상태에서 x 를 대입",
    concepts: ["그림 읽기", "직선의 방정식", "역산(y 에서 x)"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const xs = rng.int(2, s.X - 1); const T = r1d(pv(s, xs)); if (!oneDec(pv(s, xs)) || T <= 0) throw new GenFail("T");
      return figInst(rng, {
        stimulus: s.intro,
        question: spin(rng, `[[According to|Based on]] ${s.lineRef}, for what value of ${lc(t.xa)} (in ${t.xu}) is the predicted ${lc(t.ya)} (in ${t.yu}) equal to ${fmtNum(T)}?`), correct: xs,
        wrongs: [W(Math.round(T / s.m), "step_missing", "y 절편을 빼지 않고 T 를 기울기로만 나눴다."), W(Math.round((T + s.b) / s.m), "sign_error", "절편을 더했다."), W(xs + 1, "other", "한 칸 어긋나게 읽었다."), W(xs - 1, "other", "한 칸 어긋나게 읽었다."), W(Math.round((T - s.b) * s.m), "formula_misuse", "나누지 않고 곱했다."), W(s.X - xs, "axis_misread", "축 끝에서 거꾸로 세었다."), W(Math.round(s.m * T + s.b), "formula_misuse", "x 와 y 의 역할을 바꿔 대입했다.")],
        verificationJs: figJs({ T }, s.figure, `${s.extractJs}return (P.T - b) / m;`),
        trace: [...readTrace(s), [`y = ${fmtNum(T)} 을 대입하면 ${fmtNum(T)} = ${lin(s.m, s.b)} 이다.`, "Set the predicted value equal to the target."], [`x = (${fmtNum(T)} - ${fmtNum(s.b)}) ÷ ${fmtNum(s.m)} = ${xs} 이다.`, "Solve for x."]], variant: "x_for_target_y",
      }, s.figure);
    },
  },
  {
    op: "chain2", structure: "그림의 직선에서 x=a 의 예측값을 구하고, 그 값보다 d 만큼 큰·작은 예측값이 되는 x 를 구함", extra: "앞 단계의 예측값이 다음 단계의 목표값이 되는 2단 연쇄이며 식 자체는 그림에서 읽어야 함 — medium 은 식에 x 를 대입",
    concepts: ["그림 읽기", "직선의 방정식", "예측값과 역산의 연쇄"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const a = rng.int(1, s.X - 3); const step = rng.int(1, Math.min(5, s.X - 1 - a)); const d = r1d(s.m * step); if (!oneDec(s.m * step) || d === 0) throw new GenFail("d");
      const x2 = a + step; if (x2 > s.X) throw new GenFail("x2");
      return figInst(rng, {
        stimulus: `${s.intro} The line predicts a certain ${lc(t.ya)} when ${lc(t.xa)} is ${a} ${t.xu}.`,
        question: `At what value of ${lc(t.xa)} (in ${t.xu}) does the line predict a ${lc(t.ya)} that is ${fmtNum(Math.abs(d))} ${t.yu} ${d > 0 ? "greater" : "less"} than that prediction?`, correct: x2,
        wrongs: [W(a + Math.round(d * s.m), "formula_misuse", "차이를 기울기로 나누지 않고 곱했다."), W(a - step, "sign_error", "방향을 거꾸로 적용했다."), W(step, "step_missing", "처음 x 를 더하지 않았다."), W(a + Math.round(d), "step_missing", "차이를 그대로 x 에 더했다."), W(Math.round(pv(s, a) + d), "step_missing", "예측값을 구하고 x 로 되돌리지 않았다."), W(x2 + 1, "other", "한 칸 어긋나게 읽었다.")],
        verificationJs: figJs({ a, d }, s.figure, `${s.extractJs}const first = m * P.a + b; const target = first + P.d; return (target - b) / m;`),
        trace: [...readTrace(s), [`x = ${a} 에서의 예측값은 ${lin(s.m, s.b)} 에 대입한 ${fmtNum(pv(s, a))} 이다.`, "Predict at the first value."], [`목표 예측값 = ${fmtNum(pv(s, a))} ${d > 0 ? "+" : "-"} ${fmtNum(Math.abs(d))} = ${fmtNum(pv(s, x2))} 이다.`, "Form the target prediction."], [`${fmtNum(pv(s, x2))} = ${lin(s.m, s.b)} 을 풀어 x = ${x2} 이다.`, "Solve for the new x."]], variant: "predict_then_invert",
      }, s.figure);
    },
  },
  {
    op: "compare_scenarios", structure: "그림의 직선과 지문의 두 번째 모형 y = m₂x + b₂ 가 같은 예측값을 내는 x(교점)를 구함", extra: "그림에서 읽은 식과 지문의 식을 연립해 교점을 구하는 두 모형 비교 — medium 은 한 식에 대입",
    concepts: ["그림 읽기", "직선의 방정식", "두 모형의 교점(연립)"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const xs = rng.int(2, s.X - 2); const m2 = rng.pick([-3, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]); if (Math.abs(m2 - s.m) < 0.4) throw new GenFail("m2");
      const b2 = pv(s, xs) - m2 * xs; if (!isInt(b2) || b2 < -40 || b2 > 150 || Math.abs(b2 - s.b) < 3) throw new GenFail("b2");
      return figInst(rng, {
        stimulus: `${s.intro} A second model for the same data is $y = ${lin(m2, b2)}$, where $x$ is ${lc(t.xa)} (in ${t.xu}) and $y$ is ${lc(t.ya)} (in ${t.yu}).`,
        question: spin(rng, `[[For what value of $x$ do ${s.lineRef} and the second model predict the same value of $y$?|At what value of $x$ do the two models give the same predicted $y$?]]`), correct: xs,
        wrongs: [W(Math.round((b2 - s.b) / (s.m + m2)), "sign_error", "기울기를 빼지 않고 더했다."), W(Math.round(-xs), "sign_error", "부호를 거꾸로 풀었다."), W(Math.round((b2 + s.b) / (s.m - m2)), "sign_error", "절편을 더했다."), W(xs + 1, "other", "한 칸 어긋나게 읽었다."), W(xs - 1, "other", "한 칸 어긋나게 읽었다."), W(Math.round(pv(s, xs)), "step_missing", "교점의 x 가 아니라 y 를 답했다.")],
        verificationJs: figJs({ m2, b2 }, s.figure, `${s.extractJs}return (P.b2 - b) / (m - P.m2);`),
        trace: [...readTrace(s), [`두 번째 모형은 y = ${lin(m2, b2)} 이다.`, "Read the second model from the text."], [`두 식을 같게 놓으면 ${lin(s.m, s.b)} = ${lin(m2, b2)} 이다.`, "Set the two predictions equal."], [`(${fmtNum(s.m)} - ${fmtNum(m2)})x = ${fmtNum(b2)} - ${fmtNum(s.b)} 이므로 x = ${xs} 이다.`, "Solve for x."]], variant: "two_model_intersection",
      }, s.figure);
    },
  },
  {
    op: "constraint_select", structure: "그림의 직선에서 기울기가 분수일 때, 0 ≤ x ≤ N 의 정수 x 중 예측값이 정수가 되는 x 의 개수", extra: "그림에서 분수 기울기를 읽고 정수 조건과 결합해 x 가 분모의 배수여야 함을 추론, 경계 포함 개수를 셈 — medium 은 식에 x 를 대입",
    concepts: ["그림 읽기", "분수 기울기", "배수 개수 세기"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng, { frac: true }); if (isInt(s.m)) throw new GenFail("정수 기울기");
      const N = rng.int(20, 41); let correct = 0; for (let x = 0; x <= N; x++) if (isInt(Math.round((s.m * x + s.b) * 1e6) / 1e6)) correct++; if (correct < 4) throw new GenFail("count");
      const q = 10 / gcd(Math.round(Math.abs(s.m) * 10), 10);
      return figInst(rng, {
        stimulus: `${s.intro} Consider only whole-number values of ${lc(s.topic.xa)} from 0 to ${N}, inclusive.`,
        question: spin(rng, `[[For how many of these values does ${s.lineRef} predict a whole-number ${lc(s.topic.ya)}?|How many of these values give a whole-number prediction of ${lc(s.topic.ya)}?]]`), correct,
        wrongs: [W(Math.floor(N / q), "step_missing", "x = 0 을 세지 않았다."), W(Math.floor(N / q) + 2, "other", "경계를 잘못 셌다."), W(N + 1, "condition_ignored", "정수 조건을 무시하고 모든 x 를 셌다."), W(Math.floor(N / 2) + 1, "formula_misuse", "분모를 2 로 가정했다."), W(correct - 1, "other", "한 개 덜 셌다."), W(correct + 1, "other", "한 개 더 셌다.")],
        verificationJs: figJs({ N }, s.figure, `${s.extractJs}let c = 0; for (let x = 0; x <= P.N; x++) { const y = m * x + b; if (Math.abs(y - Math.round(y)) < 1e-9) c++; } return c;`),
        trace: [...readTrace(s), [`예측값 y = ${lin(s.m, s.b)} 이 정수가 되려면 기울기 항 ${fmtNum(s.m)}x 가 (절편이 정수일 때) 정수여야 한다.`, "The prediction is a whole number only when the slope term is."], [`기울기의 기약분수 분모가 ${q} 이므로 x 는 ${q} 의 배수여야 한다.`, "x must be a multiple of the slope's denominator."], [`0 이상 ${N} 이하의 ${q} 의 배수는 ${correct} 개다.`, "Count the multiples including 0."]], variant: "whole_number_predictions",
      }, s.figure);
    },
  },
];
export const FIG_EQ_SC = build("scatter_equation", "SC", eqOps);
export const FIG_EQ_LG = build("scatter_equation", "LG", eqOps);

// ═════════════ scatter_predict ═════════════
const predOps: OpDef[] = [
  {
    op: "chain2", structure: "그림의 직선으로 x=a 의 예측값을 구한 뒤, 실제 값이 예측보다 p% 크다는 조건으로 실제 값을 구함", extra: "식을 그림에서 읽고 예측값을 낸 뒤 퍼센트 증가를 적용하는 3단 연쇄(기준이 예측값) — medium 은 식에 대입만",
    concepts: ["그림 읽기", "직선 예측", "퍼센트 증가"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const a = rng.int(1, s.X - 1); const p = rng.pick([10, 20, 25, 50]); const pred = pv(s, a); const actual = pred * (1 + p / 100); if (pred <= 0 || !oneDec(actual) || !oneDec(pred)) throw new GenFail("val");
      return figInst(rng, {
        stimulus: `${s.intro} In one additional case, ${lc(t.xa)} is ${a} ${t.xu}. The actual ${lc(t.ya)} is ${p}% greater than the value predicted by the line for that case.`,
        question: `What is the actual ${lc(t.ya)} for this case, in ${t.yu}?`, correct: r1d(actual),
        wrongs: [W(r1d(pred), "step_missing", "퍼센트 증가를 적용하지 않았다."), W(r1d((pred * p) / 100), "step_missing", "증가분만 답했다."), W(r1d(pred + p), "unit_error", "퍼센트를 그대로 더했다."), W(r1d(pred * (1 - p / 100)), "sign_error", "증가가 아니라 감소로 계산했다."), W(r1d(s.m * a * (1 + p / 100) + s.b), "formula_misuse", "절편에는 퍼센트를 적용하지 않았다."), W(r1d(actual + 1), "other", "계산 중 어긋났다."), W(r1d(actual - 1), "other", "계산 중 어긋났다.")],
        verificationJs: figJs({ a, p }, s.figure, `${s.extractJs}return (m * P.a + b) * (1 + P.p / 100);`),
        trace: [...readTrace(s), [`x = ${a} 에서의 예측값은 ${fmtNum(pred)} 이다.`, "Predict at the given value."], [`실제 값은 예측값의 ${100 + p}% 이므로 ${fmtNum(pred)} × ${(100 + p) / 100} 이다.`, "Apply the percent increase to the prediction."], [`실제 값 = ${fmtNum(r1d(actual))} 이다.`, "Compute the actual value."]], variant: "predict_then_percent",
      }, s.figure);
    },
  },
  {
    op: "compare_scenarios", structure: "그림의 직선이 x=a 에서 예측한 값과 지문의 실제 값 c 의 차(잔차의 크기)를 구함", extra: "식을 그림에서 읽어 예측값을 낸 뒤 실제 값과 비교하는 잔차 계산(절편을 빠뜨리기 쉬움) — medium 은 식이 주어진 상태에서 대입",
    concepts: ["그림 읽기", "직선 예측", "예측값과 실제 값의 차(잔차)"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const a = rng.int(1, s.X - 1); const pred = pv(s, a); if (!oneDec(pred)) throw new GenFail("pred");
      const r = rng.int(3, 12) * (rng.chance(0.5) ? 1 : -1); const c = Math.round(pred) + r; if (c <= 0) throw new GenFail("c"); const diff = r1d(Math.abs(c - pred)); if (diff < 1) throw new GenFail("diff");
      return figInst(rng, {
        stimulus: `${s.intro} In one case, ${lc(t.xa)} is ${a} ${t.xu} and the actual ${lc(t.ya)} is ${c} ${t.yu}.`,
        question: spin(rng, `[[By how many ${t.yu} does the actual ${lc(t.ya)} differ from the value predicted by the line?|What is the positive difference, in ${t.yu}, between the actual ${lc(t.ya)} and the value the line predicts?]]`), correct: diff,
        wrongs: [W(r1d(Math.abs(c - s.m * a)), "step_missing", "절편을 빼지 않고 기울기 항만 예측값으로 썼다."), W(r1d(c + pred), "sign_error", "차가 아니라 합을 구했다."), W(r1d(pred), "step_missing", "예측값 자체를 답했다."), W(r1d(Math.abs(c - s.b)), "step_missing", "절편만 예측값으로 썼다."), W(r1d(diff + 1), "other", "계산 중 어긋났다."), W(r1d(Math.max(1, diff - 1)), "other", "계산 중 어긋났다.")],
        verificationJs: figJs({ a, c }, s.figure, `${s.extractJs}return Math.abs(P.c - (m * P.a + b));`),
        trace: [...readTrace(s), [`x = ${a} 에서의 예측값은 ${fmtNum(pred)} 이다.`, "Predict at the given value."], [`실제 값은 ${c} 이다.`, "Read the actual value from the text."], [`차 = |${c} - ${fmtNum(pred)}| = ${fmtNum(diff)} 이다.`, "Take the difference."]], variant: "actual_minus_predicted",
      }, s.figure);
    },
  },
  {
    op: "unit_ratio", structure: "x 가 그림의 단위(예: 시간)와 다른 단위(예: 분)로 주어질 때 환산한 뒤 직선의 예측값을 구함", extra: "그림 축의 단위와 지문의 단위가 달라 환산(÷ per)을 먼저 해야 하며, 환산을 빠뜨리면 완전히 다른 값이 나옴 — medium 은 같은 단위의 대입",
    concepts: ["그림 읽기", "단위 환산", "직선 예측"],
    gen(rng, shape) {
      const t0 = rng.pick(CONV); const s = makeLineSrc(shape, rng, { topic: t0, convNote: true }); const t = s.topic; const cv = t.conv!;
      const a = rng.pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5].filter((v) => v <= s.X - 1)); const sv = a * cv.per; if (!isInt(sv)) throw new GenFail("sv"); const pred = pv(s, a); if (!oneDec(pred) || pred <= 0) throw new GenFail("pred");
      return figInst(rng, {
        stimulus: `${s.intro} Note that 1 ${sing(t.xu)} = ${cv.per} ${cv.small}. In a new case, ${lc(t.xa)} is ${sv} ${cv.small}.`,
        question: `According to ${s.lineRef}, what is the predicted ${lc(t.ya)} for this case, in ${t.yu}?`, correct: r1d(pred),
        wrongs: [W(r1d(s.m * sv + s.b), "unit_error", "단위를 환산하지 않고 그대로 대입했다."), W(r1d(s.m * a), "step_missing", "절편을 더하지 않았다."), W(r1d((s.m * sv) / cv.per), "step_missing", "절편을 더하지 않았다(환산만 함)."), W(r1d(pred + s.m), "other", "x 를 한 칸 어긋나게 대입했다."), W(r1d(pred - s.m), "other", "x 를 한 칸 어긋나게 대입했다.")],
        verificationJs: figJs({ sv, per: cv.per }, s.figure, `${s.extractJs}const x = P.sv / P.per; return m * x + b;`),
        trace: [...readTrace(s), [`${sv} ${cv.small} = ${sv} ÷ ${cv.per} = ${fmtNum(a)} ${t.xu} 이다(그림의 축은 ${t.xu} 단위).`, "Convert the given value to the graph's unit."], [`x = ${fmtNum(a)} 을 식에 대입한다.`, "Substitute the converted value."], [`예측값 = ${fmtNum(pred)} 이다.`, "Compute the prediction."]], variant: "convert_then_predict",
      }, s.figure);
    },
  },
  {
    op: "constraint_select", structure: "그림의 직선에서 예측값이 T 를 넘는 가장 작은(기울기 음수면 가장 큰) 정수 x 를 구함", extra: "식을 그림에서 읽고 부등식을 세운 뒤 정수 조건으로 경계를 올림·내림해야 함(경계값이 정수가 아님) — medium 은 식에 대입",
    concepts: ["그림 읽기", "직선의 부등식", "정수 경계 처리"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const xc = rng.int(2, s.X - 2) + rng.pick([0.2, 0.4, 0.5, 0.6, 0.8]); const T = r1d(pv(s, xc)); if (!oneDec(pv(s, xc)) || T <= 0) throw new GenFail("T"); const xcr = (T - s.b) / s.m; if (Math.abs(xcr - Math.round(xcr)) < 0.15) throw new GenFail("xcr");
      const up = s.m > 0; const correct = up ? Math.floor(xcr) + 1 : Math.ceil(xcr) - 1;
      return figInst(rng, {
        stimulus: s.intro,
        question: up ? `What is the least whole-number value of ${lc(t.xa)} (in ${t.xu}) for which ${s.lineRef} predicts a ${lc(t.ya)} greater than ${fmtNum(T)} ${t.yu}?` : `What is the greatest whole-number value of ${lc(t.xa)} (in ${t.xu}) for which ${s.lineRef} predicts a ${lc(t.ya)} greater than ${fmtNum(T)} ${t.yu}?`, correct,
        wrongs: up ? [W(Math.floor(xcr), "condition_ignored", "경계를 포함해(예측값이 T 와 같거나 작은 x 를) 답했다."), W(Math.ceil(xcr) + 1, "other", "올림 뒤 한 칸 더 갔다."), W(Math.round(xcr) + (Math.round(xcr) > xcr ? 1 : 0), "step_missing", "반올림만 했다."), W(Math.ceil(xcr) - 1, "other", "한 칸 덜 갔다."), W(Math.round(T / s.m), "step_missing", "절편을 빼지 않았다.")] : [W(Math.ceil(xcr), "condition_ignored", "경계를 포함해 답했다."), W(Math.floor(xcr) - 1, "other", "한 칸 더 갔다."), W(Math.round(xcr), "step_missing", "반올림만 했다."), W(Math.floor(xcr), "other", "내림만 했다."), W(Math.round(T / s.m), "step_missing", "절편을 빼지 않았다.")],
        verificationJs: figJs({ T }, s.figure, `${s.extractJs}let out = null; for (let x = -200; x <= 200; x++) { if (m * x + b > P.T) { if (m > 0) { out = x; break; } else out = x; } } if (out === null) throw new Error('해 없음'); return out;`),
        trace: [...readTrace(s), [`예측값이 ${fmtNum(T)} 보다 크려면 ${lin(s.m, s.b)} > ${fmtNum(T)} 이다.`, "Write the inequality."], [`x ${up ? ">" : "<"} ${fmtNum(r1d(xcr))} 이다(기울기가 ${up ? "양수" : "음수"}라 부등호 ${up ? "유지" : "반전"}).`, "Solve, watching the sign of the slope."], [`정수 조건: ${up ? "가장 작은" : "가장 큰"} 정수는 ${correct} 이다.`, "Apply the whole-number condition."]], variant: "integer_threshold",
      }, s.figure);
    },
  },
];
export const FIG_PRED_SC = build("scatter_predict", "SC", predOps);
export const FIG_PRED_LG = build("scatter_predict", "LG", predOps);

// ═════════════ scatter_slope_context ═════════════
const slopeOps: OpDef[] = [
  {
    op: "unit_ratio", structure: "기울기를 그림에서 읽고, 지문이 다른 단위(예: 30분)로 준 x 의 증가량에 대한 y 의 예측 변화량을 구함", extra: "기울기를 그림에서 직접 구한 뒤 x 의 단위를 환산해 곱해야 함(기울기는 1 단위당 변화량) — medium 은 기울기가 주어짐",
    concepts: ["그림 읽기", "기울기의 의미", "단위 환산"],
    gen(rng, shape) {
      const t0 = rng.pick(CONV); const s = makeLineSrc(shape, rng, { topic: t0, convNote: true }); const t = s.topic; const cv = t.conv!;
      const us = [cv.per / 2, cv.per / 4, cv.per / 5, cv.per / 10, cv.per * 2].filter((v) => isInt(v) && v >= 2); const u = rng.pick(us); const ans = Math.abs(s.m * (u / cv.per)); if (!oneDec(ans) || ans === 0) throw new GenFail("ans");
      return figInst(rng, {
        stimulus: `${s.intro} Note that 1 ${sing(t.xu)} = ${cv.per} ${cv.small}.`,
        question: `According to ${s.lineRef}, by how many ${t.yu} does the predicted ${lc(t.ya)} change each time ${lc(t.xa)} increases by ${u} ${cv.small}?`, correct: r1d(ans),
        wrongs: [W(r1d(Math.abs(s.m) * u), "unit_error", "단위를 환산하지 않고 기울기에 곱했다."), W(r1d(Math.abs(s.m)), "step_missing", "기울기를 그대로 답했다."), W(r1d((Math.abs(s.m) * cv.per) / u), "formula_misuse", "환산 방향을 반대로 했다."), W(r1d(ans + Math.abs(s.m)), "other", "계산 중 어긋났다."), W(r1d(Math.abs(s.b) * (u / cv.per)), "formula_misuse", "기울기가 아니라 절편을 썼다."), W(r1d(ans * 2), "other", "계산 중 어긋났다.")],
        verificationJs: figJs({ u, per: cv.per }, s.figure, `${s.extractJs}return Math.abs(m * (P.u / P.per));`),
        trace: [...readTrace(s).slice(0, 2), [`기울기 ${fmtNum(s.m)} 는 ${t.xu} 1 당 ${t.yu} 의 변화량이다.`, "The slope is the change per 1 unit of x."], [`${u} ${cv.small} = ${u} ÷ ${cv.per} = ${fmtNum(u / cv.per)} ${t.xu} 이다.`, "Convert the increase to the graph's unit."], [`변화량 = ${fmtNum(s.m)} × ${fmtNum(u / cv.per)} 의 크기 = ${fmtNum(r1d(ans))} 이다.`, "Multiply the slope by the converted change."]], variant: "slope_with_unit_conversion",
      }, s.figure);
    },
  },
  {
    op: "repr_shift", structure: "기울기를 그림에서 읽고 x 가 a 에서 c 로 늘 때의 y 의 예측 변화량(부호 포함)을 구함", extra: "그림에서 기울기를 구한 뒤 변화량 (c − a) 에 곱해 부호까지 해석하는 표현 변환 — medium 은 기울기가 식으로 주어짐",
    concepts: ["그림 읽기", "기울기의 의미", "변화량 계산(부호)"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const a = rng.int(0, s.X - 3); const c = rng.int(a + 2, s.X); const ans = r1d(s.m * (c - a)); if (!oneDec(s.m * (c - a))) throw new GenFail("ans");
      return figInst(rng, {
        stimulus: s.intro,
        question: `According to ${s.lineRef}, what is the predicted change in ${lc(t.ya)} (in ${t.yu}) when ${lc(t.xa)} increases from ${a} to ${c} ${t.xu}? Enter a negative number for a decrease.`, correct: ans,
        wrongs: [W(r1d(-ans), "sign_error", "증가·감소의 부호를 거꾸로 답했다."), W(r1d(s.m), "step_missing", "변화량 (c − a) 를 곱하지 않았다."), W(r1d(s.m * c + s.b), "step_missing", "변화량이 아니라 c 에서의 예측값을 답했다."), W(r1d(s.m * c), "step_missing", "a 에서의 값을 빼지 않았다."), W(r1d(Math.abs(ans) + 1), "other", "계산 중 어긋났다."), W(r1d(s.m * (c + a)), "formula_misuse", "차가 아니라 합을 곱했다.")],
        verificationJs: figJs({ a, c }, s.figure, `${s.extractJs}return m * (P.c - P.a);`),
        trace: [...readTrace(s).slice(0, 2), [`x 의 변화량은 ${c} - ${a} = ${c - a} 이다.`, "Compute the change in x."], [`y 의 예측 변화량 = ${fmtNum(s.m)} × ${c - a} = ${fmtNum(ans)} 이다.`, "Multiply the slope by the change in x."], [`기울기가 ${s.m > 0 ? "양수" : "음수"}이므로 ${s.m > 0 ? "증가" : "감소"}한다(부호 ${sgn(ans)}).`, "Interpret the sign."]], variant: "change_between_two_values",
      }, s.figure);
    },
  },
  {
    op: "compare_scenarios", structure: "그림 직선의 기울기를 읽고, 기울기가 그 p 배인 두 번째 직선과 x 가 d 늘 때 예측 변화량의 차를 구함", extra: "그림에서 읽은 기울기를 배수 관계의 두 번째 모형에 연결해 두 변화량을 비교(p 배 → p−1 배의 차) — medium 은 한 직선의 변화량",
    concepts: ["그림 읽기", "기울기의 배수 관계", "두 모형의 변화량 비교"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const p = rng.pick([2, 3, 4]); const d = rng.int(2, 8); const ans = Math.abs(s.m * (p - 1) * d); if (!oneDec(ans) || ans === 0) throw new GenFail("ans");
      const word = p === 2 ? "twice" : p === 3 ? "three times" : "four times";
      return figInst(rng, {
        stimulus: `${s.intro} A second line of best fit, for a different group, has a slope that is ${word} the slope of the line shown.`,
        question: `For each increase of ${d} ${t.xu} in ${lc(t.xa)}, by how many ${t.yu} do the changes in predicted ${lc(t.ya)} for the two lines differ?`, correct: r1d(ans),
        wrongs: [W(r1d(Math.abs(s.m * p * d)), "step_missing", "두 번째 직선의 변화량만 답했다."), W(r1d(Math.abs(s.m * d)), "step_missing", "그림 직선의 변화량만 답했다."), W(r1d(Math.abs(s.m * (p - 1))), "step_missing", "x 의 증가량 d 를 곱하지 않았다."), W(r1d(Math.abs(s.m * (p + 1) * d)), "sign_error", "차가 아니라 합으로 계산했다."), W(r1d(ans + Math.abs(s.m)), "other", "계산 중 어긋났다."), W(r1d(Math.abs(s.m) * d * (p - 1) * 2), "other", "계산 중 어긋났다.")],
        verificationJs: figJs({ p, d }, s.figure, `${s.extractJs}const m2 = P.p * m; return Math.abs(m2 * P.d - m * P.d);`),
        trace: [...readTrace(s).slice(0, 2), [`그림 직선: ${d} 늘 때 변화량 = ${fmtNum(s.m)} × ${d} = ${fmtNum(r1d(s.m * d))} 이다.`, "Change for the line shown."], [`두 번째 직선의 기울기는 ${p} × ${fmtNum(s.m)} = ${fmtNum(r1d(s.m * p))} 이다.`, "Slope of the second line."], [`두 번째 직선의 변화량 = ${fmtNum(r1d(s.m * p * d))} 이다.`, "Change for the second line."], [`두 변화량의 차 = ${fmtNum(r1d(ans))} 이다.`, "Take the difference."]], variant: "slope_multiple_difference",
      }, s.figure);
    },
  },
  {
    op: "inverse", structure: "그림 직선의 기울기를 읽고 예측값이 T 만큼 증가(감소)하려면 x 가 얼마나 늘어야 하는지 구함", extra: "기울기를 그림에서 읽은 뒤 변화량 T 를 기울기로 나눠 x 의 증가량을 거꾸로 구함(감소하는 직선은 크기로 해석) — medium 은 x 증가량이 주어짐",
    concepts: ["그림 읽기", "기울기의 의미", "역산(변화량 → x 증가량)"],
    gen(rng, shape) {
      const s = makeLineSrc(shape, rng); const t = s.topic; const tt = rng.int(2, 10); const T = r1d(Math.abs(s.m) * tt); if (!oneDec(Math.abs(s.m) * tt) || T === 0) throw new GenFail("T");
      const up = s.m > 0;
      return figInst(rng, {
        stimulus: s.intro,
        question: `According to ${s.lineRef}, by how many ${t.xu} must ${lc(t.xa)} increase for the predicted ${lc(t.ya)} to ${up ? "increase" : "decrease"} by ${fmtNum(T)} ${t.yu}?`, correct: tt,
        wrongs: [W(Math.round(T * Math.abs(s.m)), "formula_misuse", "나누지 않고 곱했다."), W(Math.round(T + Math.abs(s.m)), "formula_misuse", "더했다."), W(Math.round(Math.abs(T - Math.abs(s.m))), "formula_misuse", "뺐다."), W(tt + 1, "other", "계산 중 어긋났다."), W(tt - 1, "other", "계산 중 어긋났다."), W(Math.round(T), "step_missing", "기울기로 나누지 않았다.")],
        verificationJs: figJs({ T }, s.figure, `${s.extractJs}return P.T / Math.abs(m);`),
        trace: [...readTrace(s).slice(0, 2), [`기울기 ${fmtNum(s.m)} 는 x 가 1 늘 때 예측값이 ${up ? "증가" : "감소"}하는 양(${fmtNum(Math.abs(s.m))})이다.`, "Interpret the slope per unit of x."], [`예측값이 ${fmtNum(T)} 변하려면 x 의 증가량 Δ 에 대해 ${fmtNum(Math.abs(s.m))} × Δ = ${fmtNum(T)} 이다.`, "Set the change equal to slope times Δ."], [`Δ = ${fmtNum(T)} ÷ ${fmtNum(Math.abs(s.m))} = ${tt} 이다.`, "Solve for the change in x."]], variant: "x_change_for_target_change",
      }, s.figure);
    },
  },
];
export const FIG_SLOPE_SC = build("scatter_slope_context", "SC", slopeOps);
export const FIG_SLOPE_LG = build("scatter_slope_context", "LG", slopeOps);

// ═════════════ scatter_count_above (산점도 전용) ═════════════
const CJS = "const pts = FIGURE.points, m = FIGURE.fitLine.slope, b = FIGURE.fitLine.intercept; const above = (p) => p[1] > m * p[0] + b;\n";
const cntOps: OpDef[] = [
  {
    op: "constraint_select", structure: "산점도에서 x 값이 a 이상인 점 중 추세선 위에 있는 점의 개수", extra: "추세선 위·아래 판정에 x 조건(부분집합)을 결합해 두 조건을 동시에 세어야 함 — medium 은 전체 중 위쪽 점 수",
    concepts: ["산점도 읽기", "추세선 위·아래 판정", "조건부 개수 세기"],
    gen(rng) {
      const s = makeLineSrc("SC", rng); const a = rng.int(3, s.X - 3); const pts = s.points!; const sub = pts.filter((p) => p[0] >= a); const correct = sub.filter((p) => p[1] > pv(s, p[0])).length; if (sub.length < 3 || correct === 0 || correct === sub.length) throw new GenFail("sub");
      const totalAbove = pts.filter((p) => p[1] > pv(s, p[0])).length;
      return figInst(rng, {
        stimulus: s.intro,
        question: spin(rng, `[[How many of the data points with ${lc(s.topic.xa)} of at least ${a} ${s.topic.xu} are above the line of best fit?|Among the data points whose ${lc(s.topic.xa)} is ${a} ${s.topic.xu} or more, how many lie above the line of best fit?]]`), correct,
        wrongs: [W(totalAbove, "condition_ignored", "x 조건을 무시하고 전체에서 센 위쪽 점 수를 답했다."), W(sub.length - correct, "opposite", "추세선 아래 점의 수를 답했다."), W(sub.length, "condition_ignored", "추세선 조건을 무시하고 x 조건의 점 전체를 셌다."), W(correct + 1, "other", "한 개 더 셌다."), W(Math.max(0, correct - 1), "other", "한 개 덜 셌다."), W(pts.filter((p) => p[0] > a && p[1] > pv(s, p[0])).length, "condition_ignored", "'이상'을 '초과'로 읽었다.")],
        verificationJs: figJs({ a }, s.figure, `${CJS}return pts.filter((p) => p[0] >= P.a && above(p)).length;`),
        trace: [["그림에서 추세선이 지나는 두 격자점을 읽어 선의 위치를 파악한다.", "Locate the line of best fit on the graph."], [`x 값이 ${a} 이상인 점만 고른다(${sub.length}개).`, "Select the points that satisfy the x condition."], ["각 점이 추세선보다 위에 있는지 판정한다.", "Judge each selected point against the line."], [`위쪽에 있는 점을 센다: ${correct}개.`, "Count the points above the line."], [`전체에서 센 위쪽 점(${totalAbove}개)이나, x 조건을 만족하는 점 중 아래쪽 점(${sub.length - correct}개)과 구별한다.`, "Distinguish from the count over all points and from the points below the line within the x condition."]], variant: "above_line_with_x_condition",
      }, s.figure);
    },
  },
  {
    op: "repr_shift", structure: "산점도 10개 점 중 추세선 위에 있는 점이 전체의 몇 퍼센트인지 구함", extra: "점의 개수를 센 뒤 전체 개수(그림에서 센 10개)를 분모로 퍼센트로 번역 — medium 은 위쪽 점의 개수만 셈",
    concepts: ["산점도 읽기", "추세선 위·아래 판정", "개수 → 퍼센트"],
    gen(rng) {
      const s = makeLineSrc("SC", rng, { n: 10 }); const pts = s.points!; const above = pts.filter((p) => p[1] > pv(s, p[0])).length; if (above === 0 || above === 10) throw new GenFail("above");
      return figInst(rng, {
        stimulus: s.intro,
        question: spin(rng, `[[What percent of the data points are above the line of best fit?|The data points that lie above the line of best fit make up what percent of all the points shown?]]`), correct: above * 10,
        wrongs: [W((10 - above) * 10, "opposite", "추세선 아래 점의 퍼센트를 답했다."), W(above, "unit_error", "개수를 퍼센트로 바꾸지 않았다."), W(above * 10 + 10, "other", "한 개 더 셌다."), W(Math.max(0, above * 10 - 10), "other", "한 개 덜 셌다."), W(Math.round((above / 9) * 100), "formula_misuse", "분모를 9 로 잡았다."), W(100 - above, "unit_error", "개수로 퍼센트를 계산했다.")],
        verificationJs: figJs({}, s.figure, `${CJS}return pts.filter(above).length / pts.length * 100;`),
        trace: [["그림에서 추세선의 위치(두 격자점)를 읽는다.", "Locate the line of best fit."], ["전체 점의 개수를 센다: 10개.", "Count all the points."], ["각 점이 추세선보다 위에 있는지 판정한다.", "Judge each point against the line."], [`위쪽 점은 ${above}개이다.`, "Count the points above."], [`퍼센트 = ${above} ÷ 10 × 100 = ${above * 10} 이다.`, "Convert the count to a percent."]], variant: "percent_above_line",
      }, s.figure);
    },
  },
  {
    op: "compare_scenarios", structure: "산점도에서 추세선 위의 점 수와 아래의 점 수의 차를 구함", extra: "위·아래 두 개수를 모두 세어 비교해야 함(어느 쪽이 더 많은지 방향을 해석) — medium 은 한쪽 개수만 셈",
    concepts: ["산점도 읽기", "추세선 위·아래 판정", "두 개수 비교"],
    gen(rng) {
      const s = makeLineSrc("SC", rng); const pts = s.points!; const above = pts.filter((p) => p[1] > pv(s, p[0])).length; const below = pts.length - above; const ans = Math.abs(above - below); if (ans === 0) throw new GenFail("tie");
      return figInst(rng, {
        stimulus: s.intro,
        question: spin(rng, `[[What is the positive difference between the number of data points above the line of best fit and the number below it?|By how many does the number of points on one side of the line of best fit exceed the number on the other side?]]`), correct: ans,
        wrongs: [W(above, "step_missing", "위쪽 점 수만 답했다."), W(below, "step_missing", "아래쪽 점 수만 답했다."), W(pts.length, "other", "전체 점 수를 답했다."), W(above + below - 1 === ans ? ans + 2 : above + below - 1, "other", "계산 중 어긋났다."), W(ans + 1, "other", "계산 중 어긋났다."), W(Math.max(0, ans - 1), "other", "계산 중 어긋났다."), W(Math.round(ans / 2), "formula_misuse", "차를 반으로 나눴다.")],
        verificationJs: figJs({}, s.figure, `${CJS}const a = pts.filter(above).length; return Math.abs(a - (pts.length - a));`),
        trace: [["그림에서 추세선의 위치를 읽는다.", "Locate the line of best fit."], [`전체 점은 ${pts.length}개이다.`, "Count all the points."], [`추세선 위의 점은 ${above}개이다.`, "Count the points above."], [`추세선 아래의 점은 ${pts.length} - ${above} = ${below}개이다.`, "Count the points below."], [`차 = |${above} - ${below}| = ${ans} 이다.`, "Take the positive difference."]], variant: "above_minus_below",
      }, s.figure);
    },
  },
  {
    op: "chain2", structure: "산점도에서 추세선 위에 있으면서 수평선 y=T 아래에 있는 점의 개수", extra: "추세선 기준과 수평 기준 두 번의 판정을 연쇄로 결합해(첫 판정의 결과를 둘째 조건으로 거름) 세어야 함 — medium 은 추세선 위 점 수",
    concepts: ["산점도 읽기", "추세선 위·아래 판정", "수평 기준과의 조건 결합"],
    gen(rng) {
      const s = makeLineSrc("SC", rng); const pts = s.points!; const gap = Math.max(2, Math.ceil(0.25 * s.S)); const maxY = Math.max(...pts.map((p) => p[1]));
      const aboveOnly = pts.filter((p) => p[1] > pv(s, p[0])).length;
      const Ts = rng.shuffle(Array.from({ length: Math.max(0, Math.floor((maxY - 1) / s.S) - 1) }, (_, i) => (i + 2) * s.S)).filter((T) => T < maxY && pts.every((p) => Math.abs(p[1] - T) >= gap) && (() => { const c = pts.filter((p) => p[1] > pv(s, p[0]) && p[1] < T).length; return c > 0 && c < aboveOnly; })());
      if (!Ts.length) throw new GenFail("gap");
      const T = Ts[0]; const correct = pts.filter((p) => p[1] > pv(s, p[0]) && p[1] < T).length; const belowT = pts.filter((p) => p[1] < T).length;
      return figInst(rng, {
        stimulus: s.intro,
        question: `How many of the data points are above the line of best fit and also below ${fmtNum(T)} ${s.topic.yu} on the vertical axis?`, correct,
        wrongs: [W(aboveOnly, "condition_ignored", "수평 조건을 무시하고 추세선 위 점만 셌다."), W(belowT, "condition_ignored", "추세선 조건을 무시하고 수평선 아래 점만 셌다."), W(pts.filter((p) => p[1] > pv(s, p[0]) || p[1] < T).length, "condition_ignored", "'그리고'를 '또는'으로 읽었다."), W(pts.filter((p) => p[1] > pv(s, p[0]) && p[1] > T).length, "opposite", "수평선 위쪽을 셌다."), W(correct + 1, "other", "한 개 더 셌다."), W(Math.max(0, correct - 1), "other", "한 개 덜 셌다.")],
        verificationJs: figJs({ T }, s.figure, `${CJS}return pts.filter((p) => above(p) && p[1] < P.T).length;`),
        trace: [["그림에서 추세선의 위치를 읽는다.", "Locate the line of best fit."], [`세로축 ${fmtNum(T)} 의 수평 기준을 잡는다.`, "Mark the horizontal reference level."], [`추세선 위에 있는 점을 고른다(${aboveOnly}개).`, "Select the points above the line."], [`그중 ${fmtNum(T)} 보다 아래에 있는 점만 남긴다.`, "Keep those below the level."], [`남은 점은 ${correct}개이다.`, "Count what remains."]], variant: "above_line_below_level",
      }, s.figure);
    },
  },
];
export const FIG_CNT_SC = build("scatter_count_above", "SC", cntOps);

export const FIG_LINE_HARD: Archetype[] = [...FIG_EQ_SC, ...FIG_EQ_LG, ...FIG_PRED_SC, ...FIG_PRED_LG, ...FIG_SLOPE_SC, ...FIG_SLOPE_LG, ...FIG_CNT_SC];
export { CONC };
