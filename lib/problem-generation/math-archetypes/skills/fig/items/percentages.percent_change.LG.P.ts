// percentages.percent_change.LG.P — 연도별 값을 잇는 선그래프에서 퍼센트 변화를 구하고, 최대 증가율 구간·전체 변화율·기준 초과 개수·다음 해 예측으로 확장한다.
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { retry } from "./_t4-kit";
import { LG_TOPICS, lgFig, lgIntro, lgScene, LG_JS, type LgScene } from "./_lg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && Math.abs(w.v) < 1000 && oneDec(w.v));
const pc = (a: number, b: number) => ((b - a) * 100) / a;
const read = (z: LgScene): [string, string] => [`선그래프에서 값을 읽는다: ${z.years.map((y, i) => `${y} ${z.vals[i]}`).join(", ")}.`, "Read the values from the line graph."];
void LG_TOPICS;

export const ITEM = defineItem({
  prefix: "pct", itemId: "percentages.percent_change.LG.P",
  hard: [
    {
      op: "compare_scenarios", structure: "연속한 두 해 사이의 퍼센트 증가를 모두 구해 가장 큰 증가율을 찾음(증가량이 가장 큰 구간과 다름)", extra: "증가량(차)과 증가율(차 ÷ 이전 값)을 구별해 모든 구간을 비교해야 함 — medium 은 한 구간의 퍼센트 변화",
      concepts: ["선그래프", "퍼센트 변화", "비교"],
      gen(rng) {
        return retry(120, () => {
          const z = lgScene(rng, 5, 6); const ps = z.vals.slice(1).map((v, i) => pc(z.vals[i], v)); const mx = Math.max(...ps); if (ps.filter((p) => p === mx).length !== 1 || !oneDec(mx) || mx <= 0) return null;
          const ds = z.vals.slice(1).map((v, i) => v - z.vals[i]); const iD = ds.indexOf(Math.max(...ds)); if (ps[iD] === mx) return null;
          return gInst(rng, {
            stimulus: lgIntro(rng, z),
            question: rng.pick([`What is the greatest percent increase from one year to the next year shown in the graph?`, `Of the year-to-year changes shown, what is the greatest percent increase?`]), correct: mx,
            wrongs: pos([W(ps[iD], "formula_misuse", "증가량이 가장 큰 구간의 퍼센트를 골랐다."), W(Math.max(...ds), "step_missing", "가장 큰 증가량(차)을 답했다."), W(Math.min(...ps), "opposite", "가장 작은 증가율을 골랐다."), W((ds[ps.indexOf(mx)] * 100) / z.vals[ps.indexOf(mx) + 1], "formula_misuse", "나중 값으로 나누었다."), W(mx + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== mx),
            verificationJs: figJs({}, z.fig, `${LG_JS}return Math.max(...v.slice(1).map((x, i) => (x - v[i]) * 100 / v[i]));`),
            trace: [read(z), ["퍼센트 증가 = (나중 - 처음) ÷ 처음 × 100 이다.", "Percent change = change ÷ original × 100."], [`구간별 증가율: ${ps.map((p) => `${fmtNum(p)}%`).join(", ")} 이다.`, "Compute each year-to-year change."], [`증가량이 가장 큰 구간은 증가율이 가장 크지 않다.`, "The largest change is not the largest percent change."], [`가장 큰 증가율은 ${fmtNum(mx)}% 이다.`, "Pick the greatest."]], variant: "greatest_percent_increase_line",
          }, z.fig);
        }, "compare");
      },
    },
    {
      op: "chain2", structure: "첫 해에서 마지막 해까지의 전체 퍼센트 변화를 구함(연도별 퍼센트를 더하면 틀림)", extra: "전체 변화량을 처음 값으로 나눠야 함 — 구간별 퍼센트의 합·평균은 함정 — medium 은 한 구간",
      concepts: ["선그래프", "퍼센트 변화", "전체 변화"],
      gen(rng) {
        return retry(120, () => {
          const z = lgScene(rng, 4, 6); const first = z.vals[0], last = z.vals[z.vals.length - 1]; const c = pc(first, last); if (!oneDec(c) || c === 0) return null; const ps = z.vals.slice(1).map((v, i) => pc(z.vals[i], v));
          return gInst(rng, {
            stimulus: lgIntro(rng, z),
            question: rng.pick([`By what percent did the number change from the first year shown to the last year shown?`, `What is the percent change from the first year in the graph to the last year in the graph?`]), correct: c,
            wrongs: pos([W(ps.reduce((a, b) => a + b, 0), "formula_misuse", "구간별 퍼센트를 더했다."), W(pc(last, first), "formula_misuse", "나중 값을 기준으로 변화율을 구했다."), W(last - first, "unit_error", "변화량을 퍼센트로 답했다."), W((last * 100) / first, "step_missing", "비를 퍼센트로만 바꿨다(1 을 빼지 않음)."), W(ps.reduce((a, b) => a + b, 0) / ps.length, "formula_misuse", "구간별 퍼센트의 평균을 구했다.")]).filter((w) => w.v !== c),
            verificationJs: figJs({}, z.fig, `${LG_JS}return (v[v.length - 1] - v[0]) * 100 / v[0];`),
            trace: [read(z), [`처음 ${first}, 마지막 ${last} 이다.`, "First and last values."], [`변화량 = ${last} - ${first} = ${last - first} 이다.`, "Change in value."], [`변화율 = ${last - first} ÷ ${first} × 100 = ${fmtNum(c)}% 이다.`, "Divide by the original."], [`구간별 퍼센트를 더해서는 안 된다.`, "Do not add the yearly percents."]], variant: "net_percent_change_line",
          }, z.fig);
        }, "chain");
      },
    },
    {
      op: "constraint_select", structure: "연속한 해 사이의 증가율이 T% 보다 큰 구간의 개수를 셈", extra: "감소한 구간·경계와 같은 구간을 가려 가며 증가율(증가량이 아님)로 세야 함 — medium 은 한 구간",
      concepts: ["선그래프", "퍼센트 변화", "조건 개수 세기"],
      gen(rng) {
        return retry(120, () => {
          const z = lgScene(rng, 6, 6); const ps = z.vals.slice(1).map((v, i) => pc(z.vals[i], v)); const T = rng.pick([10, 20, 25, 50]); const cnt = ps.filter((p) => p > T).length, ge = ps.filter((p) => p >= T).length; if (cnt < 1 || cnt > 4) return null;
          const dCnt = z.vals.slice(1).filter((v, i) => v - z.vals[i] > T).length;
          return gInst(rng, {
            stimulus: lgIntro(rng, z),
            question: rng.pick([`For how many of the year-to-year changes in the graph was the percent increase greater than ${T}%?`, `In how many years did the number increase by more than ${T}% compared with the year before?`]), correct: cnt,
            wrongs: [W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(ps.filter((p) => p > 0).length, "condition_ignored", "증가한 구간을 모두 셌다."), W(dCnt, "formula_misuse", "증가량(차)과 기준 수를 비교했다."), W(5 - cnt, "opposite", "기준 이하인 구간을 셌다."), W(cnt + 1, "other", "하나를 더 셌다."), W(cnt - 1, "other", "하나를 빠뜨렸다."), W(0, "other", "하나도 없다고 답했다."), W(5, "other", "전체라고 답했다.")].filter((w) => w.v !== cnt && w.v >= 0 && w.v <= 5),
            verificationJs: figJs({ T }, z.fig, `${LG_JS}return v.slice(1).filter((x, i) => (x - v[i]) * 100 / v[i] > P.T + 1e-9).length;`),
            trace: [read(z), [`구간별 증가율: ${ps.map((p) => `${fmtNum(p)}%`).join(", ")} 이다.`, "Compute each percent change."], [`${T}% 보다 큰 것(같은 것 제외): ${ps.filter((p) => p > T).map((p) => `${fmtNum(p)}%`).join(", ")} 이다.`, "Select those above the threshold."], [`증가량이 아니라 증가율로 판단한다.`, "Use percent change, not the raw increase."], [`개수는 ${cnt} 이다.`, "Count them."]], variant: "count_increase_above_line",
          }, z.fig);
        }, "select");
      },
    },
    {
      op: "param_condition", structure: "마지막 두 해 사이와 같은 증가율로 다음 해가 늘 때 다음 해의 값을 구함", extra: "마지막 구간의 증가율(곱하는 비)을 구해 마지막 값에 적용 — 증가량을 더하면 틀림 — medium 은 증가율만",
      concepts: ["선그래프", "퍼센트 변화", "연속 적용"],
      gen(rng) {
        return retry(200, () => {
          const z = lgScene(rng, 4, 6); const a = z.vals[z.vals.length - 2], b = z.vals[z.vals.length - 1]; const nx = (b * b) / a; if (!Number.isInteger(nx) || nx > 999 || b <= a) return null;
          return gInst(rng, {
            stimulus: lgIntro(rng, z),
            question: rng.pick([`If the number grows next year by the same percent as it did from the second-to-last year to the last year shown, what will the number be next year?`, `The percent increase in the final year of the graph is repeated in the following year. What number does the graph then predict for that following year?`, `Assuming the final year's percent growth continues once more, how many ${z.t.unit} will there be the year after the last year shown?`, `Next year, growth is expected to match the percent growth of the last year shown. What number is expected next year?`, `Suppose the percent increase from the last year shown to the next year equals the percent increase from the year before the last to the last year. What will the number be next year?`]), correct: nx,
            wrongs: pos([W(b + (b - a), "formula_misuse", "같은 증가량을 더했다."), W(b, "step_missing", "마지막 값을 그대로 답했다."), W(Math.round((b * (b - a)) / a), "step_missing", "증가분만 구했다."), W(Math.round((b * (100 + pc(a, b))) / 100 + 10), "other", "계산 중 어긋났다."), W(Math.round((a * a) / b), "opposite", "비를 거꾸로 곱했다.")]).filter((w) => w.v !== nx),
            verificationJs: figJs({}, z.fig, `${LG_JS}const a = v[v.length - 2], b = v[v.length - 1]; return b * b / a;`),
            trace: [read(z), [`마지막 구간: ${a} → ${b}, 배율 = ${b} ÷ ${a} 이다.`, "Growth factor of the last interval."], [`다음 해 = ${b} × ${b} ÷ ${a} = ${nx} 이다.`, "Apply the same factor again."], [`같은 증가율이므로 증가량이 아니라 같은 비로 곱한다.`, "Same percent means the same ratio, not the same increase."], [`따라서 ${nx} 이다.`, "State the value."]], variant: "next_year_same_percent_line",
          }, z.fig);
        }, "param");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "adjacent_change", structure: "연속한 두 해 사이의 퍼센트 변화를 구함", extra: "easy: 한 구간", concepts: ["선그래프", "퍼센트 변화"],
      gen(rng) {
        return retry(120, () => {
          const z = lgScene(rng, 4, 6); const i = rng.int(0, z.vals.length - 2); const a = z.vals[i], b = z.vals[i + 1]; const c = pc(a, b); if (!oneDec(c) || c === 0) return null; 
          return gInst(rng, { stimulus: lgIntro(rng, z), question: rng.pick([`By what percent did the number change from year ${i + 1} to year ${i + 2} of the graph?`, `What is the percent change from year ${i + 1} to year ${i + 2} of those shown, counting from the left?`]), correct: c, wrongs: pos([W(pc(b, a), "formula_misuse", "나중 값을 기준으로 구했다."), W(b - a, "unit_error", "변화량을 답했다."), W((b * 100) / a, "step_missing", "비를 퍼센트로만 바꿨다."), W(c + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c), verificationJs: figJs({ k: i + 1 }, z.fig, `${LG_JS}return (v[P.k] - v[P.k - 1]) * 100 / v[P.k - 1];`), trace: [read(z), [`${a} → ${b} 이다.`, "Pick the two years."], [`(${b} - ${a}) ÷ ${a} × 100 = ${fmtNum(c)}% 이다.`, "Percent change."]], variant: "adjacent_percent_line" }, z.fig);
        }, "easy");
      },
    },
    {
      lv: "medium", name: "ends_decrease", structure: "첫 해에서 가장 낮은 해까지의 퍼센트 감소를 구함", extra: "medium: 최솟값 찾기 + 퍼센트", concepts: ["선그래프", "퍼센트 변화"],
      gen(rng) {
        return retry(160, () => {
          const z = lgScene(rng, 4, 6); const first = z.vals[0], mn = Math.min(...z.vals); if (mn >= first || z.vals.filter((v) => v === mn).length !== 1) return null; const c = ((first - mn) * 100) / first; if (!oneDec(c)) return null;
          return gInst(rng, { stimulus: lgIntro(rng, z), question: `By what percent did the number decrease from the first year shown to the year with the lowest value?`, correct: c, wrongs: pos([W(((first - mn) * 100) / mn, "formula_misuse", "낮은 값을 기준으로 구했다."), W(first - mn, "unit_error", "감소량을 답했다."), W((mn * 100) / first, "step_missing", "비를 퍼센트로만 바꿨다."), W(c + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c), verificationJs: figJs({}, z.fig, `${LG_JS}const mn = Math.min(...v); return (v[0] - mn) * 100 / v[0];`), trace: [read(z), [`처음 ${first}, 가장 낮은 값 ${mn} 이다.`, "Find the first and lowest values."], [`감소량 = ${first - mn} 이다.`, "Decrease."], [`퍼센트 = ${first - mn} ÷ ${first} × 100 = ${fmtNum(c)}% 이다.`, "Divide by the original."]], variant: "percent_decrease_to_min_line" }, z.fig);
        }, "medium");
      },
    },
  ],
});
void GenFail;
void lgFig;
