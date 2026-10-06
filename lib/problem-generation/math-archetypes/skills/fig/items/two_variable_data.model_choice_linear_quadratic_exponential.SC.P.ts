// two_variable_data.model_choice_linear_quadratic_exponential.SC.P — 산점도(점 5개, x = 0..4)가 일차·이차·지수 중 어느 모형을 따르는지 고르고, 그 모형으로 다음 값·핵심 모수를 구한다.
// 점은 정확한 모형을 따른다(분류 규칙: 이차 차분 일정 ≠ 0 → 이차, 1차 차분 일정 → 일차, 비 일정 → 지수). 서술 선지 2개(MC 전용) + 숫자 2개 + 쉬운·중간.
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { gInst } from "../graph-kit";
import { LABEL_TEXT, MODEL_JS, MODEL_TOPICS, MTYPES, classify, genYs, mFig, ptsOf, type MFig, type MParams, type MType } from "./_model-kit";

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
type Sc = { t: (typeof MODEL_TOPICS)[number]; S: number; u: number; m: MParams; fig: MFig };
function scene(rng: Rng, type?: MType): Sc { const t = rng.pick(MODEL_TOPICS); const S = rng.pick([10, 20, 40]); const u = S / 2; const m = genYs(rng, type ?? rng.pick(MTYPES), u); return { t, S, u, m, fig: mFig(t, S, ptsOf(m.ys)) }; }
const intro = (rng: Rng, z: Sc) => rng.pick([
  `The scatterplot shows ${z.t.x} and ${z.t.y} for 5 data points.`,
  `A scatterplot of 5 observations relates ${z.t.x} to ${z.t.y}.`,
  `Researchers recorded ${z.t.x} and ${z.t.y} for 5 cases, and the scatterplot shows the data.`,
  `The graph shown plots ${z.t.y} against ${z.t.x} for five measurements.`,
]);
const RATE: Record<MType, string> = { lin_up: "y increases by the same amount each time x increases by 1.", lin_down: "y decreases by the same amount each time x increases by 1.", quad_up: "y first decreases and then increases as x increases by 1 at a time.", quad_down: "y first increases and then decreases as x increases by 1 at a time.", exp_growth: "y is multiplied by the same factor greater than 1 each time x increases by 1.", exp_decay: "y is multiplied by the same factor between 0 and 1 each time x increases by 1." };
const pickOpts = (rng: Rng, type: MType, texts: Record<MType, string>) => { const others = rng.shuffle(MTYPES.filter((q) => q !== type)).slice(0, 3); return { correct: texts[type], wrongs: others.map((q) => ({ text: texts[q], reason: `${q} 모형으로 잘못 판단했다.` })) }; };
const readTrace = (z: Sc): [string, string] => [`점의 y 값을 읽는다: ${z.m.ys.join(", ")} (x = 0~4).`, "Read the five y-values."];
const diffs = (ys: number[]) => { const d = ys.slice(1).map((y, i) => y - ys[i]); return { d, d2: d.slice(1).map((v, i) => v - d[i]) }; };
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Math.abs(w.v) < 1000);

export const ITEM = defineItem({
  prefix: "tvd", itemId: "two_variable_data.model_choice_linear_quadratic_exponential.SC.P",
  hard: [
    {
      op: "repr_shift", sprNo: MC_ONLY_STATEMENT, structure: "산점도의 점 5개가 따르는 모형(일차·이차·지수, 증가·감소·위/아래 볼록)을 서술 선지에서 고름", extra: "차분이 일정한지(일차)·차분의 차가 일정한지(이차)·비가 일정한지(지수)를 점의 값으로 가려야 함(증가하는 곡선을 모두 지수라고 하는 선지가 함정) — medium 은 한 유형",
      concepts: ["산점도", "모형 선택", "일차·이차·지수 관계"],
      gen(rng) {
        const z = scene(rng); const o = pickOpts(rng, z.m.type, LABEL_TEXT); const { d, d2 } = diffs(z.m.ys);
        return statementInst(rng, {
          stimulus: intro(rng, z), question: rng.pick(["Which type of function best models the relationship shown in the scatterplot?", "Which of the following models best fits the data in the scatterplot?"]), correct: o.correct, wrongs: o.wrongs, figure: z.fig, P: { map: JSON.stringify(LABEL_TEXT) },
          body: `${MODEL_JS}const want = JSON.parse(P.map)[label]; const i = P.options.indexOf(want); if (i < 0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [readTrace(z), [`1차 차분: ${d.join(", ")} 이다.`, "First differences."], [`차분의 차: ${d2.join(", ")} 이다.`, "Second differences."], [z.m.type.startsWith("quad") ? "차분이 부호를 바꾸고 차분의 차가 일정하므로 이차이다." : z.m.type.startsWith("lin") ? "차분이 일정하므로 일차이다." : "연속한 값의 비가 일정하므로 지수이다.", "Decide the model."], [`따라서 ${lc(LABEL_TEXT[z.m.type])} 이다.`, "Choose the matching statement."]], variant: "model_type_statement",
        });
      },
    },
    {
      op: "chain2", structure: "점이 따르는 모형을 먼저 가려낸 뒤 그 모형으로 x = 5 의 값을 예측", extra: "모형이 일차(같은 차)·이차(차분의 차가 일정)·지수(같은 비) 중 무엇인지에 따라 다음 값이 달라짐(다른 모형으로 이어 가는 것이 함정) — medium 은 이어 가기 한 단계",
      concepts: ["산점도", "모형 선택", "다음 값 예측"],
      gen(rng) {
        const z = scene(rng); const ys = z.m.ys; const { d, d2 } = diffs(ys); const lab = z.m.type; const a = lab.startsWith("lin") ? ys[4] + d[3] : lab.startsWith("quad") ? ys[4] + d[3] + d2[0] : ys[4] * (ys[4] / ys[3]); if (!(a > 0) || !Number.isFinite(a)) throw new GenFail("a");
        const linX = ys[4] + d[3], quadX = ys[4] + d[3] + d2[0], expX = ys[4] * (ys[4] / ys[3]);
        return gInst(rng, {
          stimulus: intro(rng, z), question: rng.pick([`Assume the pattern in the scatterplot continues. What is the predicted ${lc(z.t.ya)}, in ${z.t.yu}, when ${lc(z.t.xa)} is 5 ${z.t.xu}?`, `If the same pattern holds, what ${lc(z.t.ya)} (in ${z.t.yu}) would be expected at a ${lc(z.t.xa)} of 5?`]), correct: a,
          wrongs: pos([W(linX, "formula_misuse", "일차 모형(같은 차)으로 이어 갔다."), W(quadX, "formula_misuse", "이차 모형(차분의 차 일정)으로 이어 갔다."), W(expX, "formula_misuse", "지수 모형(같은 비)으로 이어 갔다."), W(ys[4], "step_missing", "마지막 값을 답했다."), W(a + z.u, "other", "눈금 반 칸 어긋났다.")]).filter((w) => w.v !== a),
          verificationJs: figJs({}, z.fig, `${MODEL_JS}return Math.round(nextAny * 1e6) / 1e6;`),
          trace: [readTrace(z), [`1차 차분 ${d.join(", ")}, 차분의 차 ${d2.join(", ")}, 비 ${ys.slice(1).map((y, i) => fmtNum(Math.round((y / ys[i]) * 100) / 100)).join(", ")} 이다.`, "Differences and ratios."], [`모형: ${lc(LABEL_TEXT[lab])} 이다.`, "Identify the model."], [lab.startsWith("lin") ? `x = 5 값 = ${ys[4]} + ${d[3]} = ${fmtNum(a)} 이다.` : lab.startsWith("quad") ? `다음 차분 = ${d[3]} + ${d2[0]}, x = 5 값 = ${fmtNum(a)} 이다.` : `x = 5 값 = ${ys[4]} × ${fmtNum(ys[4] / ys[3])} = ${fmtNum(a)} 이다.`, "Extend the pattern."], [`따라서 ${fmtNum(a)} 이다.`, "State the prediction."]], variant: "next_value_by_model",
        }, z.fig);
      },
    },
    {
      op: "constraint_select", sprNo: MC_ONLY_STATEMENT, structure: "y 가 x 가 1 늘 때마다 어떻게 변하는지(같은 양 / 같은 배 / 방향 전환) 서술 선지에서 고름", extra: "점의 y 값에서 변화 방식(차·비·방향 전환)을 읽어 모형의 성질로 번역해야 함(증가·감소만 보면 일차·지수가 구별되지 않음) — medium 은 한 유형",
      concepts: ["산점도", "변화율", "모형의 성질"],
      gen(rng) {
        const z = scene(rng); const o = pickOpts(rng, z.m.type, RATE); const { d, d2 } = diffs(z.m.ys);
        return statementInst(rng, {
          stimulus: intro(rng, z), question: rng.pick(["Which statement best describes how y changes as x increases by 1?", "Which of the following correctly describes the pattern of the data in the scatterplot?"]), correct: o.correct, wrongs: o.wrongs, figure: z.fig, P: { map: JSON.stringify(RATE) },
          body: `${MODEL_JS}const want = JSON.parse(P.map)[label]; const i = P.options.indexOf(want); if (i < 0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [readTrace(z), [`1차 차분: ${d.join(", ")} 이다.`, "First differences."], [`차분의 차: ${d2.join(", ")} 이다.`, "Second differences."], ["차분이 일정하면 같은 양, 비가 일정하면 같은 배, 차분의 부호가 바뀌면 방향 전환이다.", "Match the pattern to a description."], [`따라서 "${RATE[z.m.type]}" 이다.`, "Choose the matching statement."]], variant: "rate_of_change_statement",
        });
      },
    },
    {
      op: "param_condition", structure: "점이 따르는 모형의 핵심 모수(일차의 기울기·이차의 꼭짓점 x·지수의 비)를 구함", extra: "모형을 먼저 구분해야 어떤 모수를 읽을지 정해짐(차분 · 꼭짓점 · 비) — 모형을 잘못 고르면 엉뚱한 값 — medium 은 한 유형",
      concepts: ["산점도", "모형 선택", "모수 읽기"],
      gen(rng) {
        const z = scene(rng); const ys = z.m.ys; const { d } = diffs(ys); const lab = z.m.type;
        const [ans, q, wr, why] = lab.startsWith("lin") ? [d[0], `By how many ${z.t.yu} does the best-fitting linear model change ${lc(z.t.ya)} each time ${lc(z.t.xa)} increases by 1 ${z.t.xu.replace(/s$/, "")}? (Give a negative answer for a decrease.)`, [W(-d[0], "sign_error", "부호를 반대로 했다."), W(ys[0], "step_missing", "x = 0 의 값을 답했다."), W(ys[4] - ys[0], "step_missing", "전체 변화량을 답했다."), W(d[0] + z.u, "other", "눈금 반 칸 어긋났다.")], "차분이 기울기이다."] as const
          : lab.startsWith("quad") ? [z.m.h as number, `At what value of ${lc(z.t.xa)} (in ${z.t.xu}) does the best-fitting quadratic model reach its ${lab === "quad_up" ? "minimum" : "maximum"}?`, [W((z.m.h as number) + 1, "other", "한 칸 어긋났다."), W(Math.max(0, (z.m.h as number) - 1), "other", "한 칸 어긋났다."), W(ys[z.m.h as number], "axis_misread", "꼭짓점의 y 값을 답했다."), W(ys.indexOf(lab === "quad_up" ? Math.max(...ys) : Math.min(...ys)), "opposite", "반대쪽 끝점의 x 를 답했다.")], "차분의 부호가 바뀌는 x 가 꼭짓점이다."] as const
          : [ys[1] / ys[0], `The best-fitting exponential model has the form $y = a \\cdot b^x$ with $a > 0$. What is the value of $b$?`, [W(ys[0] / ys[1], "opposite", "비를 거꾸로 구했다."), W(ys[1] - ys[0], "formula_misuse", "차를 답했다."), W(ys[0], "step_missing", "초깃값 a 를 답했다."), W(ys[1] / ys[0] + 1, "other", "계산 중 1 어긋났다.")], "연속한 값의 비가 b 이다."] as const;
        if (!(Number.isFinite(ans))) throw new GenFail("ans");
        return gInst(rng, {
          stimulus: intro(rng, z), question: q, correct: ans, wrongs: wr.filter((w) => w.v !== ans && Number.isFinite(w.v) && Math.abs(w.v) < 1000 && (lab.startsWith("lin") || w.v > 0)),
          verificationJs: figJs({}, z.fig, `${MODEL_JS}return Math.round(par * 1e6) / 1e6;`),
          trace: [readTrace(z), [`1차 차분 ${d.join(", ")} 이다.`, "First differences."], [`모형: ${lc(LABEL_TEXT[lab])} 이다.`, "Identify the model."], [why, "Which parameter to read."], [`따라서 ${fmtNum(ans)} 이다.`, "State the parameter."]], variant: lab.startsWith("lin") ? "linear_slope" : lab.startsWith("quad") ? "quad_vertex_x" : "exp_base",
        }, z.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_y", structure: "x = k 의 점의 y 값을 읽음", extra: "easy: 점 읽기", concepts: ["산점도", "점 읽기"],
      gen(rng) {
        const z = scene(rng); const k = rng.int(1, 4); const ys = z.m.ys; const c = ys[k];
        return gInst(rng, { stimulus: intro(rng, z), question: `What is the ${lc(z.t.ya)}, in ${z.t.yu}, of the data point at ${lc(z.t.xa)} equal to ${k} ${z.t.xu}?`, correct: c, wrongs: pos([W(ys[k - 1], "axis_misread", "한 점 앞을 읽었다."), W(ys[Math.min(k + 1, 4)], "axis_misread", "한 점 뒤를 읽었다."), W(c + z.u, "axis_misread", "눈금 반 칸 위를 읽었다."), W(Math.max(c - z.u, z.u), "axis_misread", "눈금 반 칸 아래를 읽었다.")]).filter((w) => w.v !== c), verificationJs: figJs({ k }, z.fig, `${MODEL_JS}return ys[P.k];`), trace: [readTrace(z), [`x = ${k} 의 y 는 ${c} 이다.`, "Read the point."]], variant: "read_point" }, z.fig);
      },
    },
    {
      lv: "medium", name: "total_change", structure: "마지막 점과 첫 점의 y 의 차를 구함", extra: "medium: 두 점 읽기 + 뺄셈", concepts: ["산점도", "변화량"],
      gen(rng) {
        const z = scene(rng); const ys = z.m.ys; const c = ys[4] - ys[0]; if (c === 0) throw new GenFail("c");
        return gInst(rng, { stimulus: intro(rng, z), question: `By how many ${z.t.yu} does the ${lc(z.t.ya)} at ${lc(z.t.xa)} equal to 4 ${z.t.xu} differ from the ${lc(z.t.ya)} at 0 ${z.t.xu}? (A negative answer means it is less.)`, correct: c, wrongs: [W(-c, "sign_error", "부호를 반대로 했다."), W(ys[4], "step_missing", "마지막 값만 답했다."), W(ys[0], "step_missing", "첫 값만 답했다."), W(ys[4] + ys[0], "sign_error", "더했다.")].filter((w) => w.v !== c), verificationJs: figJs({}, z.fig, `${MODEL_JS}return ys[4] - ys[0];`), trace: [readTrace(z), [`${ys[4]} - ${ys[0]} = ${c} 이다.`, "Subtract."], ["부호는 값이 늘면 양수, 줄면 음수이다.", "The sign shows the direction."]], variant: "end_to_end_change" }, z.fig);
      },
    },
  ],
});
void classify;
