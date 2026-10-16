// percentages.compound_change.TB.P — 기간별 퍼센트 변화 표(기간 × 퍼센트 변화)와 처음 값으로 연속 변화 후의 값을 구하고, 전체 퍼센트 변화·단순 합 비교·개수 세기로 확장한다.
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { COUNT_TOPICS, nameAt, pos, r1, retry, sum, tab, type CountTopic } from "./_t4-kit";

const PERS: [string, string][] = [["Year", "year"], ["Month", "month"], ["Quarter", "quarter"], ["Season", "season"], ["Week", "week"]];
type CScene = { t: CountTopic; name: string; per: [string, string]; V: number; ch: number[]; path: number[] };
const CH = [-30, -20, -10, 10, 20, 30, 40, 50, -25, 25];
function cScene(rng: Rng, k: number): CScene {
  const t = rng.pick(COUNT_TOPICS); const name = rng.pick(t.rows); const per = rng.pick(PERS);
  return retry(200, () => {
    const V = rng.pick([200, 300, 400, 500, 600, 700, 800, 900]); const ch = Array.from({ length: k }, () => rng.pick(CH)); const path = [V]; for (const c of ch) path.push((path[path.length - 1] * (100 + c)) / 100);
    if (path.some((x) => !Number.isInteger(Math.round(x * 1e6) / 1e6) || x > 999)) return null; return { t, name, per, V, ch, path };
  }, "연속 변화 장면");
}
const cFig = (s: CScene) => tab([s.per[0], "Percent change (%)"], s.ch.map((c, i) => [`${s.per[0]} ${i + 1}`, c]), `Change from the previous ${s.per[1]}`);
const intro = (rng: Rng, s: CScene) => rng.pick([
  `In the ${s.per[1]} before ${s.per[0]} 1, there were ${s.V} ${s.t.what} ${nameAt(s.t, s.name)}. The table shows the percent change in this number in each later ${s.per[1]}, compared with the ${s.per[1]} before it.`,
  `${s.t.who} tracks the number of ${s.t.what} ${nameAt(s.t, s.name)}. In the starting ${s.per[1]}, the number was ${s.V}. The table shown gives the percent change from each ${s.per[1]} to the next.`,
  `The number of ${s.t.what} ${nameAt(s.t, s.name)} was ${s.V} in a starting ${s.per[1]}. Each row of the table gives the percent change in this number from the previous ${s.per[1]}, where a negative value means a decrease.`,
  `Starting from ${s.V} ${s.t.unit}, the number of ${s.t.what} ${nameAt(s.t, s.name)} changed by the percents shown in the table, one ${s.per[1]} at a time.`,
]);
/** FIGURE(기간 × 퍼센트 변화)에서 변화율 배열 ch 와 경로 path 를 계산하는 JS(P.V 가 처음 값). 퍼센트가 -100 이하면 던진다. */
const C_JS = "const ch=FIGURE.rows.map(r=>r[1]); if (ch.some(c=>typeof c!=='number'||c<=-100)) throw new Error('변화율 오류'); const path=[P.V]; for (const c of ch) path.push(path[path.length-1]*(100+c)/100);\n";
const read = (s: CScene): [string, string] => [`표에서 변화율을 읽는다: ${s.ch.map((c) => `${c}%`).join(", ")}.`, "Read the percent changes."];
const steps = (s: CScene, upto: number): [string, string][] => s.ch.slice(0, upto).map((c, i) => [`${s.per[0]} ${i + 1}: ${fmtNum(s.path[i])} × ${fmtNum((100 + c) / 100)} = ${fmtNum(s.path[i + 1])} 이다.`, `Apply the change for ${s.per[1]} ${i + 1}.`]);

export const ITEM = defineItem({
  prefix: "pct", itemId: "percentages.compound_change.TB.P",
  hard: [
    {
      op: "chain2", structure: "처음 값에 표의 모든 기간 변화율을 차례로 곱해 마지막 값을 구함", extra: "각 변화의 기준이 직전 값이라 배수를 차례로 곱해야 함(퍼센트를 더하면 틀림) — medium 은 두 기간까지",
      concepts: ["퍼센트 변화 표", "연속 변화(배수의 곱)", "증가·감소"],
      gen(rng) {
        const s = cScene(rng, rng.int(3, 4)); const k = s.ch.length; const c = s.path[k]; const fig = cFig(s);
        return figInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`Based on the table, what was the number of ${s.t.what} in ${s.per[0]} ${k}?`, `How many ${s.t.unit} were there in ${s.per[0]} ${k}, according to the table?`]), correct: c,
          wrongs: pos([W(r1((s.V * (100 + sum(s.ch))) / 100), "formula_misuse", "퍼센트를 모두 더해 한 번에 적용했다."), W(s.path[k - 1], "step_missing", "마지막 기간의 변화를 빠뜨렸다."), W(r1(s.V + sum(s.ch)), "unit_error", "퍼센트 수를 그대로 더했다."), W(r1(s.path[k - 1] * (100 - s.ch[k - 1]) / 100), "sign_error", "마지막 변화의 방향을 반대로 적용했다."), W(r1(s.V * (100 + s.ch[k - 1]) / 100), "step_missing", "마지막 변화만 적용했다.")], c),
          verificationJs: figJs({ V: s.V, k }, fig, `${C_JS}if (ch.length !== P.k) throw new Error('기간 수'); return path[P.k];`),
          trace: [read(s), [`처음 값은 ${s.V} 이고, 변화마다 직전 값에 배수를 곱한다.`, "Each change uses the previous value as its base."], ...steps(s, k), [`따라서 ${s.per[0]} ${k} 의 값은 ${fmtNum(c)} 이다.`, "That is the final value."]], variant: "final_after_all_changes",
        }, fig);
      },
    },
    {
      op: "compose_kind", structure: "표의 변화율을 배수로 바꿔 곱한 뒤 전체 기간의 퍼센트 변화로 다시 바꿈", extra: "배수의 곱 → 퍼센트 변화로의 합성(퍼센트를 더하면 틀림) — medium 은 두 기간 후 값",
      concepts: ["퍼센트 변화 표", "배수의 곱", "전체 퍼센트 변화"],
      gen(rng) {
        return retry(80, () => {
          const s = cScene(rng, 3); const f = s.path[3] / s.V; const c = (f - 1) * 100; if (!oneDec(c) || Math.abs(c) < 1e-9) return null; const fig = cFig(s); const up = c > 0;
          const ans = Math.abs(c);
          return figInst(rng, {
            stimulus: intro(rng, s),
            question: `From the starting ${s.per[1]} to ${s.per[0]} 3, the number of ${s.t.what} ${up ? "increased" : "decreased"} by what percent?`, correct: ans,
            wrongs: pos([W(Math.abs(sum(s.ch)), "formula_misuse", "변화율을 더했다."), W(r1(f * 100), "formula_misuse", "마지막 값이 처음 값의 몇 퍼센트인지를 답했다."), W(r1(Math.abs(s.path[3] - s.V)), "step_missing", "변화량(차)을 답했다."), W(r1(Math.abs((s.path[3] - s.V) / s.path[3]) * 100), "formula_misuse", "마지막 값으로 나누었다."), W(Math.abs(s.ch[2]), "step_missing", "마지막 기간의 변화율만 답했다.")], ans),
            verificationJs: figJs({ V: s.V }, fig, `${C_JS}if (ch.length !== 3) throw new Error('기간 수'); return Math.abs((path[3] / P.V - 1) * 100);`),
            trace: [read(s), [`배수: ${s.ch.map((x) => fmtNum((100 + x) / 100)).join(" × ")} 이다.`, "Write each change as a multiplier."], [`곱 = ${fmtNum(f)} 이다.`, "Multiply the multipliers."], [`전체 변화 = (${fmtNum(f)} - 1) × 100 = ${fmtNum(c)}% 이다.`, "Convert back to a percent change."], [`따라서 ${up ? "증가" : "감소"}율은 ${fmtNum(ans)}% 이다.`, "State the size of the change."]], variant: "overall_percent_change",
          }, fig);
        }, "compose");
      },
    },
    {
      op: "compare_scenarios", structure: "실제(배수의 곱) 마지막 값과 퍼센트를 단순히 더해 적용한 값의 차를 구함", extra: "두 계산 방식(연속 적용 vs 합산 적용)을 모두 수행해 비교해야 함 — medium 은 연속 적용 두 기간",
      concepts: ["퍼센트 변화 표", "연속 변화", "두 경우 비교"],
      gen(rng) {
        return retry(80, () => {
          const s = cScene(rng, rng.int(3, 4)); const k = s.ch.length; const real = s.path[k]; const naive = (s.V * (100 + sum(s.ch))) / 100; const c = Math.abs(real - naive); if (!oneDec(c) || c < 1e-9 || naive <= 0) return null; const fig = cFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} ${rng.pick([`A student instead adds all the percents in the table and applies the sum once to the starting number.`, `To estimate quickly, ${rng.pick(["Dana", "Lee", "Marco", "Ines", "Ravi"])} totals the percent changes in the table and applies that single percent to the starting value.`, `An analyst makes a shortcut estimate: the percents in the table are summed, and the starting number is changed once by that sum.`, `One reporter treats the changes as if they could be added, finding the sum of the table's percents and applying it to the starting count just once.`])}`,
            question: rng.pick([`What is the positive difference between this estimate and the actual number in ${s.per[0]} ${k}?`, `By how many ${s.t.unit} does the estimate differ from the actual number in ${s.per[0]} ${k}?`, `How far, in ${s.t.unit}, is the shortcut result from the true value for ${s.per[0]} ${k}?`, `What is the absolute difference between the true number for ${s.per[0]} ${k} and the shortcut estimate?`]), correct: c,
            wrongs: pos([W(r1(real), "step_missing", "실제 값만 답했다."), W(r1(naive), "step_missing", "학생의 값만 답했다."), W(r1(Math.abs(real - s.V)), "formula_misuse", "실제 변화량을 답했다."), W(r1(Math.abs(naive - s.V)), "formula_misuse", "학생 방식의 변화량을 답했다."), W(r1(c + Math.abs(s.ch[k - 1])), "other", "계산 중 어긋났다.")], c),
            verificationJs: figJs({ V: s.V, k }, fig, `${C_JS}if (ch.length !== P.k) throw new Error('기간 수'); return Math.abs(path[P.k] - P.V * (100 + ch.reduce((a, b) => a + b, 0)) / 100);`),
            trace: [read(s), ...steps(s, k), [`퍼센트의 합 = ${sum(s.ch)}% 이므로 학생의 값 = ${s.V} × ${fmtNum((100 + sum(s.ch)) / 100)} = ${fmtNum(naive)} 이다.`, "Compute the student's result."], [`차 = |${fmtNum(real)} - ${fmtNum(naive)}| = ${fmtNum(c)} 이다.`, "Take the positive difference."]], variant: "compound_vs_added",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "constraint_select", structure: "기간마다 값을 차례로 구해 기준 T 보다 큰 기간의 개수를 셈", extra: "모든 중간 값을 연쇄 계산하고 경계를 따져 세야 함 — medium 은 두 기간 후 값",
      concepts: ["퍼센트 변화 표", "연속 변화", "조건 개수 세기"],
      gen(rng) {
        return retry(80, () => {
          const s = cScene(rng, 4); const vals = s.path.slice(1); const T = Math.round(rng.pick(vals)) + rng.pick([0, 0, 5, 10]); if (T > 999) return null; const cnt = vals.filter((v) => v > T).length; if (cnt < 1 || cnt > 3) return null; const ge = vals.filter((v) => v >= T).length; const fig = cFig(s);
          return figInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`In how many of the ${s.per[1]}s listed in the table was the number of ${s.t.what} greater than ${T}?`, `For how many of the ${s.per[1]}s shown in the table was the number of ${s.t.unit} more than ${T}?`]), correct: cnt,
            wrongs: pos([W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(4 - cnt, "opposite", "기준 이하인 기간을 셌다."), W(s.ch.filter((c) => c > 0).length === cnt ? cnt + 2 : s.ch.filter((c) => c > 0).length, "formula_misuse", "증가한 기간을 셌다."), W(cnt - 1, "other", "하나를 빠뜨렸다."), W(cnt + 1, "other", "하나를 더 셌다.")], cnt).filter((w) => w.v <= 4),
            verificationJs: figJs({ V: s.V, T }, fig, `${C_JS}return path.slice(1).filter(x => x > P.T + 1e-9).length;`),
            trace: [read(s), ...steps(s, 4), [`${T} 보다 큰 값(같은 것 제외): ${vals.filter((v) => v > T).map(fmtNum).join(", ")} → ${cnt} 개이다.`, "Count the periods above the threshold."]], variant: "count_periods_above",
          }, fig);
        }, "select");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "after_first", structure: "처음 값에 첫 기간의 변화율을 적용", extra: "easy: 한 번의 퍼센트 변화", concepts: ["퍼센트 변화 표", "증가·감소"],
      gen(rng) {
        const s = cScene(rng, 3); const c = s.path[1]; const fig = cFig(s);
        return figInst(rng, { stimulus: intro(rng, s), question: `What was the number of ${s.t.what} in ${s.per[0]} 1?`, correct: c, wrongs: pos([W(r1(s.V + s.ch[0]), "unit_error", "퍼센트 수를 그대로 더했다."), W(r1((s.V * (100 - s.ch[0])) / 100), "sign_error", "방향을 반대로 적용했다."), W(r1((s.V * Math.abs(s.ch[0])) / 100), "step_missing", "변화량만 구했다."), W(s.path[2], "axis_misread", "다음 기간까지 적용했다."), W(s.V, "step_missing", "처음 값을 답했다.")], c), verificationJs: figJs({ V: s.V }, fig, `${C_JS}return path[1];`), trace: [[`${s.per[0]} 1 의 변화율 ${s.ch[0]}% 를 읽는다.`, "Read the first change."], [`${s.V} × ${fmtNum((100 + s.ch[0]) / 100)} = ${fmtNum(c)} 이다.`, "Apply it."]], variant: "after_first" }, fig);
      },
    },
    {
      lv: "medium", name: "after_two", structure: "처음 값에 두 기간의 변화율을 차례로 적용", extra: "medium: 두 번 연속 적용", concepts: ["퍼센트 변화 표", "연속 변화"],
      gen(rng) {
        const s = cScene(rng, 3); const c = s.path[2]; const fig = cFig(s);
        return figInst(rng, { stimulus: intro(rng, s), question: `What was the number of ${s.t.what} in ${s.per[0]} 2?`, correct: c, wrongs: pos([W(r1((s.V * (100 + s.ch[0] + s.ch[1])) / 100), "formula_misuse", "두 퍼센트를 더해 한 번에 적용했다."), W(s.path[1], "step_missing", "한 기간만 적용했다."), W(s.path[3], "axis_misread", "한 기간 더 적용했다."), W(r1((s.V * (100 + s.ch[1])) / 100), "step_missing", "두 번째 변화만 적용했다.")], c), verificationJs: figJs({ V: s.V }, fig, `${C_JS}return path[2];`), trace: [read(s), ...steps(s, 2)], variant: "after_two" }, fig);
      },
    },
  ],
});
