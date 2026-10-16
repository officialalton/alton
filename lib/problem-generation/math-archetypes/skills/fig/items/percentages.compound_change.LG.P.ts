// percentages.compound_change.LG.P — 해마다 '전해 대비 퍼센트 변화'를 보이는 선그래프와 처음 값으로 연속 변화 후의 값을 구하고, 전체 변화율·단순 합과의 차·기준 초과 개수로 확장한다.
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { retry } from "./_t4-kit";
import { LG_TOPICS, type LgFig } from "./_lg-kit";
import { lcFirst } from "./_t4-kit";

type CScene = { t: (typeof LG_TOPICS)[number]; name: string; years: string[]; V: number; ch: number[]; path: number[]; fig: LgFig };
const CH = [10, 20, 30, 40, 50];
function cScene(rng: Rng, kLo: number, kHi: number): CScene {
  const t = rng.pick(LG_TOPICS); const name = rng.pick(t.rows); const k = rng.int(kLo, kHi); const y0 = rng.int(2012, 2020); const years = Array.from({ length: k }, (_, i) => String(y0 + i));
  return retry(300, () => {
    const V = rng.pick([100, 200, 300, 400, 500, 600, 800]); const ch = Array.from({ length: k }, () => rng.pick(CH)); const path = [V]; for (const c of ch) path.push((path[path.length - 1] * (100 + c)) / 100);
    if (path.some((x) => !Number.isInteger(Math.round(x * 1e6) / 1e6) || x > 999)) return null; if (new Set(ch).size < 2) return null;
    const fig: LgFig = { type: "data", kind: "line", categories: years, series: [{ values: ch }], xTitle: "Time (years)", yTitle: "Percent change from the previous year (%)", yMin: 0, yMax: 60, yStep: 10 };
    return { t, name, years, V, ch, path, fig };
  }, "연속 변화 장면");
}
const intro = (rng: Rng, s: CScene) => rng.pick([
  `In the year before the first year shown, there were ${s.V} ${s.t.what} ${s.t.prep} ${s.name}. The line graph shows the percent change in this number from the previous year, for each of ${s.years.length} years.`,
  `${s.t.who} tracks the number of ${s.t.what} ${s.t.prep} ${s.name}. At the start there were ${s.V}. The graph shown gives the percent increase from each year to the next.`,
  `The number of ${s.t.what} ${s.t.prep} ${s.name} was ${s.V} one year before the graph begins. Each point on the graph gives the percent increase over the year before.`,
  `A year before the graph begins, ${s.t.who.toLowerCase()} counted ${s.V} ${s.t.what} ${s.t.prep} ${s.name}. In the graph, each year's percent increase is measured against the year just before it.`,
  `There were ${s.V} ${s.t.what} ${s.t.prep} ${s.name} at the beginning. The line graph shows by what percent the count rose in each following year.`,
  `${s.name}: ${s.V} ${s.t.what} at the outset. For each of the next ${s.years.length} years, the graph shows the percent growth over the prior year.`,
  `Growth in the number of ${s.t.what} ${s.t.prep} ${s.name} is plotted in the graph year by year as a percent of the previous year's total. The count at the start was ${s.V}.`,
  `Starting from ${s.V} ${s.t.unit}, the number of ${s.t.what} ${s.t.prep} ${s.name} grew by the percent shown in the graph each year; ${lcFirst(s.t.who)} reports each year's growth over the year before.`,
]);
const C_JS = "const ch=FIGURE.series[0].values; if (ch.some(c=>typeof c!=='number'||c<=-100)) throw new Error('변화율 오류'); const path=[P.V]; for (const c of ch) path.push(path[path.length-1]*(100+c)/100);\n";
const read = (s: CScene): [string, string] => [`선그래프에서 해마다의 증가율을 읽는다: ${s.ch.map((c) => `${c}%`).join(", ")}.`, "Read the yearly percent increases."];
const steps = (s: CScene, upto: number): [string, string][] => s.ch.slice(0, upto).map((c, i) => [`${i + 1}년째: ${fmtNum(s.path[i])} × ${fmtNum((100 + c) / 100)} = ${fmtNum(s.path[i + 1])} 이다.`, `Apply the increase for year ${i + 1}.`]);
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Math.abs(w.v) < 1000 && oneDec(w.v));

export const ITEM = defineItem({
  prefix: "pct", itemId: "percentages.compound_change.LG.P",
  hard: [
    {
      op: "chain2", structure: "해마다 전해 대비 증가율 선그래프와 처음 값으로 마지막 해의 값을 연속 계산", extra: "해마다 이전 값에 새 비율을 곱하는 연쇄(증가율을 모두 더해 한 번에 적용하면 틀림) — medium 은 두 해",
      concepts: ["선그래프", "연속 퍼센트 변화", "복리"],
      gen(rng) {
        const s = cScene(rng, 3, 4); const fin = s.path[s.path.length - 1]; const sumP = s.ch.reduce((a, b) => a + b, 0);
        return gInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`How many ${s.t.what} ${s.t.prep} ${s.name} were there at the end of the last year shown?`, `What is the number of ${s.t.what} ${s.t.prep} ${s.name} after all ${s.years.length} years in the graph?`]), correct: fin,
          wrongs: pos([W((s.V * (100 + sumP)) / 100, "formula_misuse", "증가율을 모두 더해 한 번에 적용했다."), W(s.path[s.path.length - 2], "step_missing", "마지막 해를 빠뜨렸다."), W(s.V + s.ch.reduce((a, c, i) => a + (s.path[i] * c) / 100, 0) + 10, "other", "계산 중 어긋났다."), W(s.V + sumP, "unit_error", "퍼센트를 개수로 더했다."), W(Math.round(s.path[1] * (100 + s.ch[s.ch.length - 1]) / 100 + 0), "step_missing", "첫 해와 마지막 해만 적용했다.")]).filter((w) => w.v !== fin),
          verificationJs: figJs({ V: s.V }, s.fig, `${C_JS}return path[path.length - 1];`),
          trace: [read(s), ["각 해에 전해 값 × (1 + 증가율) 을 차례로 적용한다.", "Apply each increase to the previous year's value."], ...steps(s, s.ch.length), [`따라서 ${fmtNum(fin)} 이다.`, "State the final value."]], variant: "final_value_after_compound_line",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "연속 증가를 모두 적용해 처음 값 대비 전체 퍼센트 변화를 구함", extra: "곱한 비로 전체 증가율을 구해야 함(증가율의 합은 함정) — medium 은 한 해",
      concepts: ["선그래프", "연속 퍼센트 변화", "전체 변화율"],
      gen(rng) {
        return retry(120, () => {
          const s = cScene(rng, 3, 4); const fin = s.path[s.path.length - 1]; const tot = ((fin - s.V) * 100) / s.V; if (!oneDec(tot)) return null; const sumP = s.ch.reduce((a, b) => a + b, 0);
          return gInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`By what percent did the number increase from the year before the graph begins to the end of the last year shown?`, `Compared with the starting number, by what percent is the number larger at the end of the last year shown?`, `Taken together, the yearly increases amount to what overall percent increase?`, `What is the total percent increase over all ${s.years.length} years shown?`]), correct: tot,
            wrongs: pos([W(sumP, "formula_misuse", "증가율을 모두 더했다."), W(fin - s.V, "unit_error", "증가량을 답했다."), W((fin * 100) / s.V, "step_missing", "비를 퍼센트로만 바꿨다."), W(sumP / s.ch.length, "formula_misuse", "증가율의 평균을 구했다."), W(tot + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== tot),
            verificationJs: figJs({ V: s.V }, s.fig, `${C_JS}return (path[path.length - 1] - path[0]) * 100 / path[0];`),
            trace: [read(s), ...steps(s, s.ch.length), [`전체 증가 = ${fmtNum(fin)} - ${s.V} = ${fmtNum(fin - s.V)} 이다.`, "Total change."], [`전체 증가율 = ${fmtNum(fin - s.V)} ÷ ${s.V} × 100 = ${fmtNum(tot)}% 이다.`, "Convert to a percent of the starting value."]], variant: "total_percent_compound_line",
          }, s.fig);
        }, "compose");
      },
    },
    {
      op: "compare_scenarios", structure: "해마다 연속 적용한 값과 증가율을 모두 더해 한 번에 적용한 값의 차를 구함", extra: "두 계산을 모두 해서 비교해야 함(한쪽만 구하면 틀림) — medium 은 한 계산",
      concepts: ["선그래프", "연속 퍼센트 변화", "두 방법 비교"],
      gen(rng) {
        return retry(120, () => {
          const s = cScene(rng, 3, 4); const fin = s.path[s.path.length - 1]; const sumP = s.ch.reduce((a, b) => a + b, 0); const one = (s.V * (100 + sumP)) / 100; const c = Math.abs(fin - one); if (c === 0 || !oneDec(c)) return null;
          return gInst(rng, {
            stimulus: `${intro(rng, s)} ${rng.pick([`A planner estimates the final number by adding up all the yearly percent increases and applying that single total percent to the starting number once.`, `A planner shortcut: add the yearly percent increases together, then raise the starting number by that one total percent.`, `To estimate the end result quickly, a planner sums the yearly percents and applies the sum a single time to the starting count.`])}`,
            question: rng.pick([`By how much does the planner's estimate differ from the actual number at the end of the last year shown?`, `How far off, in ${s.t.unit}, is the planner's estimate from the true year-end number?`, `The planner's method is wrong. By how many ${s.t.unit} does it miss the real final number?`, `What is the positive difference between the actual final number and the planner's estimate?`]), correct: c,
            wrongs: pos([W(fin, "step_missing", "실제 값만 답했다."), W(one, "step_missing", "추정값만 답했다."), W(fin + one, "sign_error", "차 대신 합을 구했다."), W(Math.abs(fin - s.V), "formula_misuse", "처음 값과의 차를 구했다."), W(c + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c),
            verificationJs: figJs({ V: s.V }, s.fig, `${C_JS}const sumP = ch.reduce((a, b) => a + b, 0); return Math.abs(path[path.length - 1] - path[0] * (100 + sumP) / 100);`),
            trace: [read(s), ...steps(s, s.ch.length), [`추정값 = ${s.V} × (1 + ${sumP}/100) = ${fmtNum(one)} 이다.`, "The planner's single-step estimate."], [`차 = |${fmtNum(fin)} - ${fmtNum(one)}| = ${fmtNum(c)} 이다.`, "Positive difference."]], variant: "compound_vs_simple_sum_line",
          }, s.fig);
        }, "compare");
      },
    },
    {
      op: "constraint_select", structure: "해마다의 값 중 기준 T 보다 커진 해의 개수를 연속 계산으로 셈", extra: "해마다 값을 계산해 기준과 비교(같은 값 제외) — 증가율만 보면 틀림 — medium 은 한 해",
      concepts: ["선그래프", "연속 퍼센트 변화", "조건 개수 세기"],
      gen(rng) {
        return retry(200, () => {
          const s = cScene(rng, 4, 4); const vals = s.path.slice(1); const T = Math.round(rng.pick(vals) + rng.pick([0, 0, 20, 50])); if (T > 999 || T < 20) return null; const cnt = vals.filter((v) => v > T).length, ge = vals.filter((v) => v >= T).length; if (cnt < 1 || cnt > 3) return null;
          return gInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`At the end of how many of the ${s.years.length} years shown was the number greater than ${T}?`, `Over the years shown, in how many year-ends did the count exceed ${T}?`, `How many of the year-end counts are above ${T}?`, `For how many of the years in the graph was the year-end number more than ${T}?`]), correct: cnt,
            wrongs: [W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(s.years.length - cnt, "opposite", "기준 이하인 해를 셌다."), W(s.ch.filter((c) => c > T).length, "formula_misuse", "증가율과 기준을 비교했다."), W(cnt + 1, "other", "하나를 더 셌다."), W(cnt - 1, "other", "하나를 빠뜨렸다."), W(0, "other", "하나도 없다고 답했다."), W(4, "other", "모두라고 답했다.")].filter((w) => w.v !== cnt && w.v >= 0 && w.v <= 4),
            verificationJs: figJs({ V: s.V, T }, s.fig, `${C_JS}return path.slice(1).filter(x => x > P.T + 1e-9).length;`),
            trace: [read(s), ...steps(s, s.ch.length), [`${T} 보다 큰 해(같은 값 제외): ${vals.filter((v) => v > T).map((v) => fmtNum(v)).join(", ")} 이다.`, "Select the years above the threshold."], [`개수는 ${cnt} 이다.`, "Count them."]], variant: "count_years_above_line",
          }, s.fig);
        }, "select");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "first_year", structure: "첫 해의 증가율을 처음 값에 적용해 첫 해 말의 값을 구함", extra: "easy: 한 해", concepts: ["선그래프", "퍼센트 증가"],
      gen(rng) {
        const s = cScene(rng, 3, 4); const x = s.path[1];
        return gInst(rng, { stimulus: intro(rng, s), question: rng.pick([`How many ${s.t.what} ${s.t.prep} ${s.name} were there at the end of the first year shown?`, `What was the number after the first year in the graph?`]), correct: x, wrongs: pos([W(s.V, "step_missing", "처음 값을 답했다."), W((s.V * s.ch[0]) / 100, "step_missing", "증가분만 답했다."), W(s.V + s.ch[0], "unit_error", "퍼센트를 개수로 더했다."), W(x + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({ V: s.V }, s.fig, `${C_JS}return path[1];`), trace: [read(s), ...steps(s, 1)], variant: "first_year_value_line" }, s.fig);
      },
    },
    {
      lv: "medium", name: "two_years", structure: "첫 두 해의 증가율을 차례로 적용해 두 해 말의 값을 구함", extra: "medium: 두 해 연속", concepts: ["선그래프", "연속 퍼센트 변화"],
      gen(rng) {
        const s = cScene(rng, 3, 4); const x = s.path[2];
        return gInst(rng, { stimulus: intro(rng, s), question: rng.pick([`How many ${s.t.what} ${s.t.prep} ${s.name} were there at the end of the second year shown?`, `What was the number after the first two years in the graph?`]), correct: x, wrongs: pos([W((s.V * (100 + s.ch[0] + s.ch[1])) / 100, "formula_misuse", "두 증가율을 더해 한 번에 적용했다."), W(s.path[1], "step_missing", "첫 해만 적용했다."), W(s.V, "step_missing", "처음 값을 답했다."), W(x + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({ V: s.V }, s.fig, `${C_JS}return path[2];`), trace: [read(s), ...steps(s, 2)], variant: "two_year_value_line" }, s.fig);
      },
    },
  ],
});
void GenFail;
