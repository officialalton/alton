// two_variable_data.model_choice_linear_quadratic_exponential.SC.C — 산점도 4개(서로 다른 모형을 따르는 점 5개씩) 중 지문의 모형(일차·이차·지수, 증가·감소·위/아래 볼록)을 따르는 것을 고른다.
// 네 산점도는 같은 축(눈금·최댓값)·같은 x 범위(0~4)를 쓰고, 오답은 다른 모형을 따르는 그림(모형 label 이 규칙)이다.
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { defineItem } from "../item-kit";
import { SPR_NO_DATA_CHOICE, cInst, poolChoices } from "../data-c-kit";
import { LABEL_TEXT, MODEL_JS, MODEL_TOPICS, MTYPES, genYs, mFig, ptsOf, type MFig, type MType } from "./_model-kit";

const STATS = MODEL_JS.replace("FIGURE.points || []", "c.points || []");
const PRED = `${STATS} return label === P.t;`;
const DIAG = `${STATS} return label === P.t ? null : label;`;
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
type Sc = { t: (typeof MODEL_TOPICS)[number]; S: number; u: number; yMax: number };
const scene = (rng: Rng): Sc => { const S = rng.pick([10, 20, 40]); return { t: rng.pick(MODEL_TOPICS), S, u: S / 2, yMax: 9 * S }; };
const figOf = (rng: Rng, z: Sc, type: MType): MFig => mFig(z.t, z.S, ptsOf(genYs(rng, type, z.u).ys), z.yMax);
const intro = (rng: Rng, z: Sc) => rng.pick([
  `Four scatterplots of ${z.t.x} and ${z.t.y} are shown, each with 5 data points.`,
  `Each of the four scatterplots shown relates ${z.t.x} to ${z.t.y} for five observations.`,
  `The four graphs shown plot ${z.t.y} against ${z.t.x}, with 5 data points in each graph.`,
  `Researchers recorded ${z.t.x} and ${z.t.y} in four different studies; each scatterplot shows five measurements.`,
]);
const Q = (type: MType) => { const m = lc(LABEL_TEXT[type]); return [`Which scatterplot shows data that are best modeled by ${m}?`, `Which of the scatterplots is best modeled by ${m}?`, `The data in which scatterplot most closely follow ${m}?`]; };
const TAIL: [string, string] = ["다른 산점도는 다른 유형의 모형을 따른다.", "Each other scatterplot follows a different type of model."];
const mk = (rng: Rng, targets: MType[], variant: string, trace: [string, string][]) => {
  const z = scene(rng); const t = rng.pick(targets); const ok = figOf(rng, z, t); const pool: MFig[] = []; for (let i = 0; i < 60; i++) pool.push(figOf(rng, z, rng.pick(MTYPES.filter((q) => q !== t))));
  const P = { t }; const ch = poolChoices(rng, { ok, pool, P, predicateJs: PRED, diagnoseJs: DIAG });
  return cInst(rng, ch, { stimulus: intro(rng, z), question: rng.pick(Q(t)), P, predicateJs: PRED, diagnoseJs: DIAG, trace: [...trace, [`찾는 모형: ${lc(LABEL_TEXT[t])}.`, "The model asked for."]], variant }, TAIL);
};
const STEPS: [string, string][] = [["각 산점도의 점 5개의 y 값을 읽고 1차 차분을 구한다.", "Read the y-values and take first differences."], ["차분이 일정하면 일차, 차분의 차가 일정하면 이차, 연속한 값의 비가 일정하면 지수이다.", "Constant differences, constant second differences, or constant ratios."], ["증가·감소와 위/아래 볼록까지 구별한다.", "Also tell increasing from decreasing and opening up from down."], ["다른 유형의 산점도를 하나씩 지워 나간다.", "Eliminate the plots that follow other models."]];

export const ITEM = defineItem({
  prefix: "tvd", itemId: "two_variable_data.model_choice_linear_quadratic_exponential.SC.C",
  hard: [
    {
      op: "repr_shift", sprNo: SPR_NO_DATA_CHOICE, structure: "네 산점도 중 지수(증가 또는 감소) 모형을 따르는 것을 고름", extra: "연속한 값의 비가 일정한지(지수)를 일차·이차와 구별해 네 그림을 검사해야 함(증가하는 곡선을 모두 지수라고 하는 것이 함정) — medium 은 한 유형",
      concepts: ["산점도", "모형 선택", "지수 관계"],
      gen(rng) { return mk(rng, ["exp_growth", "exp_decay"], "pick_exponential_scatter", STEPS); },
    },
    {
      op: "inverse", sprNo: SPR_NO_DATA_CHOICE, structure: "네 산점도 중 이차(위로 또는 아래로 볼록) 모형을 따르는 것을 고름", extra: "차분의 부호가 바뀌고 차분의 차가 일정한 그림을 찾아야 함(꼭짓점이 있는 것만으로는 위/아래 볼록이 정해지지 않음) — medium 은 한 유형",
      concepts: ["산점도", "모형 선택", "이차 관계"],
      gen(rng) { return mk(rng, ["quad_up", "quad_down"], "pick_quadratic_scatter", STEPS); },
    },
    {
      op: "compare_scenarios", sprNo: SPR_NO_DATA_CHOICE, structure: "네 산점도 중 일차(증가 또는 감소) 모형을 따르는 것을 고름", extra: "점이 일정한 차로 늘거나 줄어드는 그림을 곡선 모양과 구별해야 함 — 기울기 부호까지 지문의 서술과 맞춤 — medium 은 한 유형",
      concepts: ["산점도", "모형 선택", "일차 관계"],
      gen(rng) { return mk(rng, ["lin_up", "lin_down"], "pick_linear_scatter", STEPS); },
    },
    {
      op: "param_condition", sprNo: SPR_NO_DATA_CHOICE, structure: "네 산점도 중 지문이 말한 정확한 모형(증가·감소·볼록 방향까지)을 따르는 것을 고름", extra: "여섯 모형 중 지문의 하나와 방향까지 일치하는 그림을 가려야 함(같은 유형이지만 방향이 반대인 그림이 함정) — medium 은 한 유형",
      concepts: ["산점도", "모형 선택", "방향까지의 구별"],
      gen(rng) { return mk(rng, [...MTYPES], "pick_exact_model_scatter", STEPS); },
    },
  ],
  em: [
    {
      lv: "easy", name: "linear_scatter", sprNo: SPR_NO_DATA_CHOICE, structure: "일차 모형을 따르는 산점도를 고름", extra: "easy: 일정한 차", concepts: ["산점도", "일차 관계"],
      gen(rng) { return mk(rng, ["lin_up", "lin_down"], "easy_pick_linear", [["점이 일정한 차로 늘거나 줄어드는 그림을 찾는다.", "Constant differences mean linear."]]); },
    },
    {
      lv: "medium", name: "quadratic_scatter", sprNo: SPR_NO_DATA_CHOICE, structure: "이차 모형을 따르는 산점도를 고름", extra: "medium: 방향이 바뀌는 그림", concepts: ["산점도", "이차 관계"],
      gen(rng) { return mk(rng, ["quad_up", "quad_down"], "med_pick_quadratic", [["증가했다가 감소(또는 반대)하는 그림을 찾는다.", "Quadratic data turn around."], ["차분의 차가 일정한지 확인한다.", "Check the second differences."]]); },
    },
  ],
});
void GenFail;
