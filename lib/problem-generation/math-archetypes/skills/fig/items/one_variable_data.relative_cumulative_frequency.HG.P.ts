// one_variable_data.relative_cumulative_frequency.HG.P — 히스토그램에서 상대 도수(%)·누적 상대 도수(%)를 구하고 더 큰 표본 예측·역산·기준 경계로 확장한다. 전체 개수는 20·25·50 이다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { G_JS, HG_TOPICS, histFig, intro, label, readStep, type GScene } from "../hist-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
/** 전체 개수가 20·25·50 인 히스토그램(모든 막대 높이 1~10). */
function pctHist(rng: Rng): GScene {
  for (let tr = 0; tr < 400; tr++) {
    const t = rng.pick(HG_TOPICS); const k = rng.int(4, 6); const N = rng.pick([20, 25, 50].filter((n) => n <= 10 * k && n >= k)); const f = Array(k).fill(1) as number[]; let ok = true;
    for (let r = 0; r < N - k; r++) { const cand = f.map((x, i) => (x < 10 ? i : -1)).filter((i) => i >= 0); if (!cand.length) { ok = false; break; } f[rng.pick(cand)]++; }
    if (!ok) continue; const s0 = rng.pick(t.starts); const los = Array.from({ length: k }, (_, i) => s0 + t.w * i);
    return { t, los, freqs: f, N, fig: histFig(t, los, f) };
  }
  throw new GenFail("상대 도수 히스토그램 표집 실패");
}
const cum = (s: GScene) => { let c = 0; return s.freqs.map((x) => (c += x)); };
const PCT_CHK = "if (![20, 25, 50].includes(N)) throw new Error('전체 개수 전제 위반');\n";
const pctStep = (s: GScene): [string, string] => [`한 개체는 전체의 100 ÷ ${s.N} = ${100 / s.N}% 이다.`, "Each member is 100/N percent."];

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.relative_cumulative_frequency.HG.P",
  hard: [
    {
      op: "chain2", structure: "히스토그램의 막대 높이를 더해 어떤 경계(E) 아래의 개수를 구하고, 전체에 대한 퍼센트로 바꿈", extra: "경계 아래 막대들의 높이를 누적하고 전체(막대 높이 합)로 나눠 퍼센트로 연결해야 함 — medium 은 한 막대의 퍼센트",
      concepts: ["히스토그램", "누적 상대 도수", "퍼센트"],
      gen(rng) {
        const s = pctHist(rng); const i = rng.int(1, s.los.length - 1); const E = s.los[i]; const c = cum(s)[i - 1]; const correct = (c * 100) / s.N;
        return gInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`What percent of the data are less than ${E} ${s.t.unit}?`, `Based on the histogram, ${E} ${s.t.unit} is greater than what percent of the values?`]), correct,
          wrongs: pos([W(c, "step_missing", "개수를 퍼센트로 바꾸지 않았다."), W(100 - correct, "opposite", "그 값 이상인 퍼센트를 답했다."), W(((c + s.freqs[i]) * 100) / s.N, "condition_ignored", "경계가 속한 막대까지 포함했다."), W((s.freqs[i - 1] * 100) / s.N, "step_missing", "바로 아래 막대 하나만 셌다."), W(correct + 100 / s.N, "other", "한 명 더 셌다.")]).filter((w) => Math.abs(w.v - correct) > 1e-9 && w.v <= 100),
          verificationJs: figJs({ E }, s.fig, `${G_JS}${PCT_CHK}const i=los.indexOf(P.E); if (i<1) throw new Error('경계가 아님'); return fr.slice(0,i).reduce((a,b)=>a+b,0)*100/N;`),
          trace: [readStep(s), pctStep(s), [`${E} 아래의 막대 높이를 더하면 ${c} 이다.`, "Add the bars below the boundary."], [`${c} ÷ ${s.N} × 100 = ${correct}% 이다.`, "Convert to a percent."], [`따라서 ${correct}% 이다.`, "State the percent."]], variant: "percent_below_boundary",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 경계(E1 < E2) 아래의 누적 퍼센트를 각각 구해 퍼센트포인트 차를 구함", extra: "두 누적 퍼센트를 따로 구해 빼야 함(두 경계 사이 막대들의 퍼센트와 같음) — medium 은 한 경계의 누적 퍼센트",
      concepts: ["히스토그램", "누적 상대 도수", "퍼센트포인트"],
      gen(rng) {
        const s = pctHist(rng); const i = rng.int(1, s.los.length - 2), j = rng.int(i + 1, s.los.length - 1); const c = cum(s); const p1 = (c[i - 1] * 100) / s.N, p2 = (c[j - 1] * 100) / s.N; const correct = p2 - p1;
        return gInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`By how many percentage points does the percent of values less than ${s.los[j]} ${s.t.unit} exceed the percent of values less than ${s.los[i]} ${s.t.unit}?`, `What is the difference, in percentage points, between the percent of the data below ${s.los[j]} ${s.t.unit} and the percent below ${s.los[i]} ${s.t.unit}?`]), correct,
          wrongs: pos([W(p2, "step_missing", "더 큰 경계의 퍼센트만 답했다."), W(p1, "step_missing", "더 작은 경계의 퍼센트만 답했다."), W(p1 + p2, "sign_error", "합을 구했다."), W(((c[j - 1] - c[i - 1]) * 100) / s.N + 100 / s.N, "other", "한 명 더 셌다."), W(c[j - 1] - c[i - 1], "step_missing", "개수 차를 퍼센트로 바꾸지 않았다.")]).filter((w) => Math.abs(w.v - correct) > 1e-9 && w.v <= 100),
          verificationJs: figJs({ E1: s.los[i], E2: s.los[j] }, s.fig, `${G_JS}${PCT_CHK}const a=los.indexOf(P.E1), b=los.indexOf(P.E2); if (a<1||b<=a) throw new Error('경계 오류'); const cu=(k)=>fr.slice(0,k).reduce((x,y)=>x+y,0)*100/N; return cu(b)-cu(a);`),
          trace: [readStep(s), pctStep(s), [`${s.los[i]} 아래 ${c[i - 1]} 개 = ${p1}%, ${s.los[j]} 아래 ${c[j - 1]} 개 = ${p2}% 이다.`, "Two cumulative percents."], [`차 = ${p2} - ${p1} = ${correct} 퍼센트포인트 이다.`, "Subtract."], [`두 경계 사이의 막대 높이 합과 같다.`, "It equals the share of the bars between them."]], variant: "cumulative_percent_gap",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "어떤 경계 아래에 X 개가 있는 더 큰 표본이 같은 분포를 가질 때, 경계 아래 퍼센트를 읽어 그 표본의 전체 개수를 역산", extra: "퍼센트를 구한 뒤 X ÷ 퍼센트 로 거꾸로 전체를 구해야 함 — medium 은 한 경계의 누적 퍼센트",
      concepts: ["히스토그램", "누적 상대 도수", "역산"],
      gen(rng) {
        for (let t = 0; t < 120; t++) {
          const s = pctHist(rng); const i = rng.int(1, s.los.length - 1); const c = cum(s)[i - 1]; const T = rng.pick([40, 80, 100, 120, 200, 400, 500, 1000]); const X = (T * c) / s.N; if (!Number.isInteger(X) || X < 3) continue;
          return gInst(rng, {
            stimulus: `${intro(rng, s)} A larger sample of the same kind has the same distribution. In the larger sample, ${X} values are less than ${s.los[i]} ${s.t.unit}.`,
            question: rng.pick([`How many values are in the larger sample?`, `What is the total number of values in the larger sample?`]), correct: T,
            wrongs: pos([W(X, "step_missing", "경계 아래 개수를 답했다."), W(Math.round((X * s.N) / 100), "formula_misuse", "퍼센트 대신 전체 개수를 곱했다."), W(Math.round((X * 100) / (100 - (c * 100) / s.N)), "opposite", "그 값 이상의 퍼센트로 나눴다."), W(T + s.N, "other", "원래 전체를 더했다."), W(Math.round(T / 2), "other", "계산 중 어긋났다.")]).filter((w) => w.v !== T),
            verificationJs: figJs({ E: s.los[i], X }, s.fig, `${G_JS}${PCT_CHK}const i=los.indexOf(P.E); if (i<1) throw new Error('경계가 아님'); const p=fr.slice(0,i).reduce((a,b)=>a+b,0)/N; return P.X/p;`),
            trace: [readStep(s), pctStep(s), [`${s.los[i]} 아래의 비율 = ${c} ÷ ${s.N} = ${(c * 100) / s.N}% 이다.`, "Fraction below the boundary."], [`${X} 개가 전체의 ${(c * 100) / s.N}% 이므로 전체 = ${X} ÷ ${(c * 100) / s.N}% 이다.`, "Divide by the percent."], [`따라서 ${T} 개이다.`, "State the total."]], variant: "total_from_cumulative_share",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "constraint_select", structure: "누적 퍼센트가 p% 이상이 되는 가장 낮은 막대 경계(오른쪽 끝)를 구함", extra: "막대 높이를 차례로 누적해 처음으로 기준을 넘는 경계를 골라야 함('초과'가 아니라 '이상') — medium 은 한 경계의 누적 퍼센트",
      concepts: ["히스토그램", "누적 상대 도수", "기준 경계"],
      gen(rng) {
        const s = pctHist(rng); const c = cum(s); const p = rng.pick([30, 40, 50, 60, 70, 75, 80, 90]); const j = c.findIndex((x) => (x * 100) / s.N >= p); if (j < 0 || j === s.los.length - 1 && c[j] * 100 / s.N < p) throw new GenFail("p"); const correct = s.los[j] + s.t.w;
        if (j > 0 && (c[j - 1] * 100) / s.N >= p) throw new GenFail("order");
        return gInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`What is the least boundary value, in ${s.t.unit}, below which at least ${p}% of the data lie?`, `Below which interval boundary, the smallest one possible, in ${s.t.unit}, are at least ${p}% of the values?`]), correct,
          wrongs: pos([W(s.los[j], "condition_ignored", "한 칸 왼쪽 경계를 골랐다."), W(correct + s.t.w, "other", "한 칸 오른쪽 경계를 골랐다."), W(s.los[s.los.length - 1] + s.t.w, "step_missing", "마지막 경계를 답했다."), W(s.los[0], "step_missing", "첫 경계를 답했다."), W(Math.round(((c[j] * 100) / s.N)), "formula_misuse", "누적 퍼센트를 답했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ p }, s.fig, `${G_JS}${PCT_CHK}let c=0; for (let i=0;i<fr.length;i++){ c+=fr[i]; if (c*100/N>=P.p) return bins[i].to; } throw new Error('해 없음');`),
          trace: [readStep(s), pctStep(s), [`누적 개수: ${s.los.map((lo, k) => `${label(s.t, lo)}→${c[k]}`).join(", ")} 이다.`, "Accumulate the heights."], [`${p}% 이상이 되는 첫 막대는 ${label(s.t, s.los[j])} (${(c[j] * 100) / s.N}%) 이다.`, "First bar reaching the target."], [`그 막대의 오른쪽 끝 ${correct} 이다.`, "Right edge of that bar."]], variant: "least_boundary_for_percent",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "relative_frequency", structure: "한 막대의 높이를 전체로 나눠 상대 도수(%)를 구함", extra: "easy: 막대 ÷ 전체 × 100", concepts: ["히스토그램", "상대 도수"],
      gen(rng) {
        const s = pctHist(rng); const i = rng.int(0, s.los.length - 1); const correct = (s.freqs[i] * 100) / s.N;
        return gInst(rng, { stimulus: intro(rng, s), question: rng.pick([`What percent of the data are in the interval ${label(s.t, s.los[i])} ${s.t.unit}?`, `The interval from ${s.los[i]} to ${s.los[i] + s.t.w} ${s.t.unit} holds what percent of all the values?`]), correct, wrongs: pos([W(s.freqs[i], "step_missing", "막대 높이를 그대로 답했다."), W(100 - correct, "opposite", "나머지 퍼센트를 답했다."), W(s.N, "axis_misread", "전체 개수를 답했다."), W(correct + 100 / s.N, "other", "한 명 더 셌다.")]).filter((w) => Math.abs(w.v - correct) > 1e-9 && w.v <= 100), verificationJs: figJs({ lo: s.los[i] }, s.fig, `${G_JS}${PCT_CHK}const i=los.indexOf(P.lo); if (i<0) throw new Error('구간 없음'); return fr[i]*100/N;`), trace: [readStep(s), pctStep(s), [`${s.freqs[i]} ÷ ${s.N} × 100 = ${correct}% 이다.`, "Divide by the total."]], variant: "relative_frequency_of_bar",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "cumulative_percent", structure: "한 경계 아래 막대 높이를 누적해 전체에 대한 퍼센트를 구함", extra: "medium: 누적 ÷ 전체", concepts: ["히스토그램", "누적 상대 도수"],
      gen(rng) {
        const s = pctHist(rng); const i = rng.int(1, s.los.length - 1); const c = cum(s)[i - 1]; const correct = (c * 100) / s.N;
        return gInst(rng, { stimulus: intro(rng, s), question: `What percent of the data are less than ${s.los[i]} ${s.t.unit}?`, correct, wrongs: pos([W(c, "step_missing", "개수를 그대로 답했다."), W(100 - correct, "opposite", "그 값 이상인 퍼센트를 답했다."), W(((c + s.freqs[i]) * 100) / s.N, "condition_ignored", "경계가 속한 막대까지 포함했다."), W((s.freqs[i - 1] * 100) / s.N, "step_missing", "바로 아래 막대 하나만 셌다.")]).filter((w) => Math.abs(w.v - correct) > 1e-9 && w.v <= 100), verificationJs: figJs({ E: s.los[i] }, s.fig, `${G_JS}${PCT_CHK}const i=los.indexOf(P.E); if (i<1) throw new Error('경계가 아님'); return fr.slice(0,i).reduce((a,b)=>a+b,0)*100/N;`), trace: [readStep(s), [`${s.los[i]} 아래의 막대 높이 합 = ${c} 이다.`, "Add the bars below the boundary."], [`${c} ÷ ${s.N} × 100 = ${correct}% 이다.`, "Convert to a percent."]], variant: "cumulative_percent_below",
        }, s.fig);
      },
    },
  ],
});
