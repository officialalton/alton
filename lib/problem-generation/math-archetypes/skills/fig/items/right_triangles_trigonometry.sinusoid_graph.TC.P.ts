// right_triangles_trigonometry.sinusoid_graph.TC.P — 맥락이 있는 사인곡선 그래프의 최댓점·최솟점 라벨에서 진폭·주기·각진동수(b)·특정 시각의 값·시각 간 차·값에 이르는 시각을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { SIN_JS, makeSinScene, type SinScene } from "../tc-kit";

const W = (v: number, kind: DistractorKind, reason: string) => ({ v, kind, reason });
const piOpt = (n: number) => `$\\frac{\\pi}{${n}}$`;
const FUNC = ["f", "g", "h", "p", "q", "d"];
const intro = (rng: Rng, s: SinScene, extra = "") => `${s.ctx.lead} ` + rng.pick([
  `The graph shows ${s.ctx.ent} for two complete cycles. The maximum and minimum values in the first cycle are labeled with their coordinates.${extra}`,
  `In the graph shown, ${s.ctx.ent} varies periodically with time. Points marking the first maximum and the first minimum are labeled.${extra}`,
  `A periodic model of ${s.ctx.ent} is shown in the graph for two cycles. The labeled points mark a highest value and the next lowest value.${extra}`,
  `The figure shows how ${s.ctx.ent} changes over time. The graph repeats the same pattern, and a maximum and a minimum are marked with their coordinates.${extra}`,
  `Over the time interval shown, ${s.ctx.ent} follows a sinusoidal pattern. Two points on the graph, a maximum and a minimum, are labeled.${extra}`,
]);
const readStep = (s: SinScene): [string, string] => [`그림에서 최댓점 (${s.xmax}, ${s.ymax}) 과 최솟점 (${s.xmin}, ${s.ymin}) 의 라벨을 읽는다.`, "Read the labeled maximum and minimum."];
const ampStep = (s: SinScene): [string, string] => [`진폭 = (${s.ymax} - ${s.ymin}) ÷ 2 = ${s.A} 이고 중심선은 y = ${s.k} 이다.`, "Amplitude and midline from the extremes."];
const perStep = (s: SinScene): [string, string] => [`최댓점과 최솟점은 반주기 떨어져 있으므로 주기 = 2 × (${s.xmin} - ${s.xmax}) = ${s.T} ${s.ctx.xu} 이다.`, "The extremes are half a period apart."];
const numFmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
const cosAt = (c: number) => c; void cosAt;

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.sinusoid_graph.TC.P",
  hard: [
    {
      op: "chain2", structure: "최댓점·최솟점 좌표에서 주기를 구한 뒤 각진동수 b = 2π ÷ 주기 를 구함", extra: "반주기에서 주기를 구하고 b = 2π ÷ 주기 로 넘어가야 함(반주기를 주기로 보거나 2 를 빠뜨리는 함정) — medium 은 주기",
      sprNo: "정답이 π 가 든 수(b = π/n)라 단답(수)으로 낼 수 없다",
      concepts: ["삼각함수 그래프", "주기", "각진동수"],
      gen(rng) {
        const s = makeSinScene(rng); const fn = rng.pick(FUNC); const n = s.T / 2; const form = s.kind === "cos" ? "\\cos" : "\\sin";
        return gInst(rng, {
          stimulus: intro(rng, s, ` The function $${fn}$ models this graph and can be written as $${fn}(t) = a${form}(bt) + c$, where $a$, $b$, and $c$ are positive constants.`), question: rng.pick(["What is the value of $b$?", "What is $b$?"]), correctText: piOpt(n), range: [0, 100],
          wrongTexts: [{ text: piOpt(s.T), kind: "formula_misuse", reason: "2 를 빠뜨려 π ÷ 주기 로 구했다." }, { text: piOpt(s.T / 4), kind: "formula_misuse", reason: "반주기를 주기로 보고 구했다." }, { text: piOpt(2 * s.T), kind: "formula_misuse", reason: "분모에 주기의 2 배를 넣었다." }],
          verificationJs: figJs({ fn: s.kind }, s.fig, `${SIN_JS}return 2/PER;`),
          trace: [readStep(s), perStep(s), [`b = 2π ÷ 주기 = 2π ÷ ${s.T} = π/${n} 이다.`, "b equals 2π over the period."], [`진폭 ${s.A}, 중심선 ${s.k} 는 b 에 영향을 주지 않는다.`, "Amplitude and midline do not affect b."], [`따라서 π/${n} 이다.`, "State b."]], variant: `angular_frequency_${s.kind}`,
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "최댓점·최솟점 좌표에서 모형(진폭·중심선·주기)을 세워 특정 시각의 값을 구함", extra: "모형을 세운 뒤 코사인 값(1/2, −1/2, 0)에 대입해야 함(최댓값·중심선을 그대로 답하는 함정) — medium 은 진폭",
      concepts: ["삼각함수 그래프", "진폭·중심선·주기", "특정 시각의 값"],
      gen(rng) {
        const s = makeSinScene(rng, { T: [12, 24] }); const cs = rng.pick([{ off: s.T / 6, c: 0.5 }, { off: s.T / 3, c: -0.5 }, { off: s.T / 4, c: 0 }]); const t0 = s.xmax + cs.off; const v = s.k + s.A * cs.c;
        return gInst(rng, {
          stimulus: intro(rng, s), question: rng.pick([`According to the graph, what is ${s.ctx.y}, in ${s.ctx.yu}, at time ${t0} ${s.ctx.xu}?`, `What is ${s.ctx.y}, in ${s.ctx.yu}, ${t0} ${s.ctx.xu} after ${s.ctx.x0}?`]), correct: v,
          wrongs: [W(s.ymax, "step_missing", "최댓값을 답했다."), W(s.ymin, "step_missing", "최솟값을 답했다."), W(s.k, "step_missing", "중심선의 값을 답했다."), W(s.k - s.A * cs.c, "sign_error", "코사인 값의 부호를 반대로 정했다."), W(s.A, "formula_misuse", "진폭을 답했다.")],
          verificationJs: figJs({ t0 }, s.fig, `${SIN_JS}return ff(P.t0);`),
          trace: [readStep(s), ampStep(s), perStep(s), [`시각 ${t0} 은 최댓점 ${s.xmax} 에서 ${cs.off} 지난 때이다(주기의 ${cs.off === s.T / 6 ? "1/6" : cs.off === s.T / 3 ? "1/3" : "1/4"}).`, "Measure the offset from the maximum."], [`값 = ${s.k} + ${s.A} × cos(${cs.off === s.T / 6 ? "60°" : cs.off === s.T / 3 ? "120°" : "90°"}) = ${numFmt(v)} 이다.`, "Evaluate the cosine form."]], variant: `value_at_time_${cs.c}`,
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 시각의 값을 각각 구한 뒤 두 값의 차를 계산해 답을 구함", extra: "모형을 세워 두 시각을 따로 대입해 빼야 함(최댓값과 최솟값의 차로 단순화하는 함정) — medium 은 주기",
      concepts: ["삼각함수 그래프", "두 시각 비교", "차"],
      gen(rng) {
        const s = makeSinScene(rng, { T: [12, 24] }); const offs = [{ o: 0, c: 1 }, { o: s.T / 6, c: 0.5 }, { o: s.T / 4, c: 0 }, { o: s.T / 3, c: -0.5 }, { o: s.T / 2, c: -1 }]; const [i, j] = (() => { const a = rng.int(0, 3), b = rng.int(a + 1, 4); return [a, b]; })();
        if (j - i === 4) throw new GenFail("최댓-최솟 차 단순");
        const t1 = s.xmax + offs[i].o, t2 = s.xmax + offs[j].o; const d = s.A * (offs[i].c - offs[j].c);
        return gInst(rng, {
          stimulus: intro(rng, s), question: rng.pick([`By how many ${s.ctx.yu} does ${s.ctx.y} at time ${t1} ${s.ctx.xu} exceed ${s.ctx.y} at time ${t2} ${s.ctx.xu}?`, `How many ${s.ctx.yu} greater is ${s.ctx.y} at time ${t1} ${s.ctx.xu} than at time ${t2} ${s.ctx.xu}?`]), correct: d,
          wrongs: [W(2 * s.A, "step_missing", "최댓값과 최솟값의 차를 답했다."), W(s.A, "step_missing", "진폭을 답했다."), W(-d, "sign_error", "빼는 순서를 바꿨다."), W(s.A * (offs[i].c + offs[j].c), "sign_error", "합으로 구했다."), W(d / 2, "formula_misuse", "차를 절반으로 구했다.")],
          verificationJs: figJs({ t1, t2 }, s.fig, `${SIN_JS}return ff(P.t1)-ff(P.t2);`),
          trace: [readStep(s), ampStep(s), perStep(s), [`시각 ${t1} 의 값은 ${numFmt(s.k + s.A * offs[i].c)}, 시각 ${t2} 의 값은 ${numFmt(s.k + s.A * offs[j].c)} 이다.`, "Evaluate at both times."], [`차 = ${numFmt(s.k + s.A * offs[i].c)} - ${numFmt(s.k + s.A * offs[j].c)} = ${numFmt(d)} 이다.`, "Subtract."]], variant: `difference_two_times_${i}${j}`,
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "값이 주어질 때 최댓점 이후 처음 그 값에 이르는 시각을 구함", extra: "값에서 코사인 값(1/2, 0, −1/2)을 거꾸로 구해 최댓점 위치에 더해야 함(최댓점 위치를 빠뜨리거나 두 번째로 이르는 시각을 답하는 함정) — medium 은 중심선",
      concepts: ["삼각함수 그래프", "역산", "주기의 분수"],
      gen(rng) {
        const s = makeSinScene(rng, { T: [12, 24], A: [2, 4, 6] }); const cs = rng.pick([{ off: s.T / 6, c: 0.5 }, { off: s.T / 4, c: 0 }, { off: s.T / 3, c: -0.5 }]); const y0 = s.k + s.A * cs.c; const t = s.xmax + cs.off;
        return gInst(rng, {
          stimulus: intro(rng, s), question: rng.pick([`After the first maximum, ${s.ctx.y} first equals ${y0} ${s.ctx.yu} at what time, in ${s.ctx.xu}?`, `At what time, in ${s.ctx.xu}, does ${s.ctx.y} first reach ${y0} ${s.ctx.yu} after the first maximum?`]), correct: t,
          wrongs: [W(cs.off, "step_missing", "최댓점 위치를 더하지 않았다."), W(s.xmax + s.T - cs.off, "condition_ignored", "두 번째로 이르는 시각을 답했다."), W(s.xmin, "other", "최솟점의 시각을 답했다."), W(t + 1, "other", "계산 중 어긋났다."), W(s.xmax + cs.off / 2, "formula_misuse", "주기의 분수를 절반으로 계산했다.")],
          verificationJs: figJs({ y0 }, s.fig, `${SIN_JS}for (let t=XMAX; t<=XMAX+PER+1e-9; t+=0.25) { if (Math.abs(ff(t)-P.y0)<1e-9) return t; } throw new Error('값에 이르는 시각 없음');`),
          trace: [readStep(s), ampStep(s), perStep(s), [`${y0} = ${s.k} + ${s.A} × cos(θ) 에서 cos θ = ${cs.c} 이므로 최댓점에서 주기의 ${cs.off === s.T / 6 ? "1/6" : cs.off === s.T / 4 ? "1/4" : "1/3"} = ${cs.off} 지난 때이다.`, "Solve for the cosine value, then the offset."], [`시각 = ${s.xmax} + ${cs.off} = ${t} 이다.`, "Add to the position of the maximum."]], variant: `time_for_value_${cs.c}`,
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "amplitude", structure: "최댓점·최솟점 좌표에서 진폭을 구함", extra: "easy: (최댓값 − 최솟값) ÷ 2", concepts: ["삼각함수 그래프", "진폭"],
      gen(rng) {
        const s = makeSinScene(rng);
        return gInst(rng, {
          stimulus: intro(rng, s), question: rng.pick(["What is the amplitude of the function modeled by the graph?", "What is the amplitude of the sinusoidal function shown in the graph?"]), correct: s.A,
          wrongs: [W(s.ymax - s.ymin, "step_missing", "최댓값과 최솟값의 차를 그대로 답했다."), W(s.k, "formula_misuse", "중심선의 값을 답했다."), W(s.ymax, "step_missing", "최댓값을 답했다."), W(s.T, "axis_misread", "주기를 답했다.")],
          verificationJs: figJs({}, s.fig, `${SIN_JS}return AMP;`),
          trace: [readStep(s), [`진폭 = (${s.ymax} - ${s.ymin}) ÷ 2 = ${s.A} 이다.`, "Half the distance between extremes."]], variant: "amplitude_from_extremes",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "period", structure: "최댓점·최솟점의 시각에서 주기를 구함", extra: "medium: 두 극점의 시각 차의 2 배", concepts: ["삼각함수 그래프", "주기"],
      gen(rng) {
        const s = makeSinScene(rng);
        return gInst(rng, {
          stimulus: intro(rng, s), question: rng.pick([`What is the period, in ${s.ctx.xu}, of the function modeled by the graph?`, `What is the length of one full cycle, in ${s.ctx.xu}?`]), correct: s.T,
          wrongs: [W(s.T / 2, "step_missing", "반주기를 주기로 답했다."), W(2 * s.T, "formula_misuse", "두 주기를 답했다."), W(s.xmin, "axis_misread", "최솟점의 시각을 답했다."), W(s.T / 4, "formula_misuse", "주기의 1/4 을 답했다.")],
          verificationJs: figJs({}, s.fig, `${SIN_JS}return PER;`),
          trace: [readStep(s), [`두 극점의 시각 차는 ${s.xmin} - ${s.xmax} = ${s.T / 2} 이고 이것이 반주기이다.`, "The gap between extremes is half a period."], perStep(s)], variant: "period_from_extremes",
        }, s.fig);
      },
    },
  ],
});
