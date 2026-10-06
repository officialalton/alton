// percentages.find_whole.BR.P — 막대그래프가 각 행의 '부분 개수'를 보이고, 지문이 그 부분이 행 전체의 몇 퍼센트인지 말한다. 전체를 역산해 합계·차·개수·나머지로 확장한다.
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { nameAt, pos, retry, sum, lcFirst } from "./_t4-kit";
import { bar, barScene, BAR_ROW_JS, gInst, type BarScene } from "../data-kit";

const PARTS = ["on weekends", "in the morning", "by online order", "to first-time customers", "in the first week"];
const P1 = [10, 20, 25, 40, 50, 60, 75, 80];
const whole = (v: number, p: number) => (v * 100) / p;
const intro = (rng: Parameters<typeof barScene>[0], s: BarScene, sub: string) => rng.pick([
  `The graph shows the number of ${s.t.what} ${sub} ${s.t.prep} each of ${s.names.length} ${s.t.many}.`,
  `${s.t.who} counted the ${s.t.what} ${sub} ${s.t.prep} several ${s.t.many}. The counts are shown in the graph.`,
  `The graph shown gives, for several ${s.t.many}, the number of ${s.t.what} ${sub}.`,
  `For a summary, ${lcFirst(s.t.who)} charted the number of ${s.t.what} ${sub} ${s.t.prep} several ${s.t.many}, as shown in the graph.`,
]);
const read = (s: BarScene): [string, string] => [`막대그래프에서 읽는다: ${s.names.map((n, i) => `${n} ${s.vals[i]}`).join(", ")}.`, "Read the bar heights."];
const ok = (s: BarScene, p: number) => s.vals.every((v) => Number.isInteger(whole(v, p)));

export const ITEM = defineItem({
  prefix: "pct", itemId: "percentages.find_whole.BR.P",
  hard: [
    {
      op: "compare_scenarios", structure: "두 행의 부분 개수가 각각 행 전체의 p%·q% 일 때 두 전체의 차를 구함(부분이 큰 행의 전체가 더 작을 수 있음)", extra: "행마다 다른 퍼센트로 전체를 역산해 비교해야 함 — 부분의 크기만 비교하면 틀림 — medium 은 한 행의 나머지",
      concepts: ["막대그래프", "전체 구하기", "두 경우 비교"],
      gen(rng) {
        return retry(120, () => {
          const s = barScene(rng, rng.int(4, 5), 20, 200, 5); const sub = rng.pick(PARTS); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const p = rng.pick(P1), q = rng.pick(P1); if (p === q) return null;
          const A = whole(s.vals[i], p), B = whole(s.vals[j], q); if (!Number.isInteger(A) || !Number.isInteger(B) || A === B) return null; const c = Math.abs(A - B); const fig = bar(s);
          return gInst(rng, {
            stimulus: `${intro(rng, s, sub)} The number ${nameAt(s.t, s.names[i])} is ${p}% of all the ${s.t.what} there, and the number ${nameAt(s.t, s.names[j])} is ${q}% of all the ${s.t.what} there.`,
            question: rng.pick([`What is the positive difference between the total number of ${s.t.what} ${nameAt(s.t, s.names[i])} and the total number ${nameAt(s.t, s.names[j])}?`, `By how many ${s.t.unit} do the two totals differ?`]), correct: c,
            wrongs: pos([W(Math.abs(s.vals[i] - s.vals[j]), "step_missing", "부분 개수의 차를 구했다."), W(A + B, "sign_error", "차 대신 합을 구했다."), W(Math.abs(whole(s.vals[i], q) - whole(s.vals[j], p)), "axis_misread", "두 퍼센트를 바꿔 썼다."), W(Math.max(A, B), "step_missing", "한쪽 전체만 답했다."), W(Math.abs((s.vals[i] * p) / 100 - (s.vals[j] * q) / 100), "formula_misuse", "부분에 퍼센트를 곱했다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j], p, q }, fig, `${BAR_ROW_JS}return Math.abs(at(P.ni) * 100 / P.p - at(P.nj) * 100 / P.q);`),
            trace: [read(s), ["전체 = 부분 ÷ (퍼센트 ÷ 100) 이다.", "Total = part ÷ percent."], [`${s.names[i]}: ${s.vals[i]} ÷ ${p / 100} = ${A} 이다.`, "First total."], [`${s.names[j]}: ${s.vals[j]} ÷ ${q / 100} = ${B} 이다.`, "Second total."], [`차 = |${A} - ${B}| = ${c} 이다.`, "Take the positive difference."]], variant: "difference_of_wholes_bar",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "chain2", structure: "모든 행의 부분 개수가 각 행 전체의 같은 p% 일 때 모든 행의 전체를 합함", extra: "부분의 합을 먼저 구한 뒤 한 번에 p% 로 역산(합의 전체) — 막대마다 계산해도 같지만 부분 합만 답하면 틀림 — medium 은 한 행의 나머지",
      concepts: ["막대그래프", "합계", "전체 구하기"],
      gen(rng) {
        return retry(120, () => {
          const s = barScene(rng, rng.int(4, 5), 20, 200, 5); const sub = rng.pick(PARTS); const p = rng.pick(P1); const S = sum(s.vals); const T = whole(S, p); if (!Number.isInteger(T)) return null; const fig = bar(s);
          return gInst(rng, {
            stimulus: `${intro(rng, s, sub)} At every one of these ${s.t.many}, the number shown is ${p}% of all the ${s.t.what} there.`,
            question: rng.pick([`What is the total number of ${s.t.what} at all these ${s.t.many} combined?`, `In all, how many ${s.t.unit} were there at the ${s.t.many} shown, counting every one of them?`]), correct: T,
            wrongs: pos([W(S, "step_missing", "부분 개수의 합만 답했다."), W(T - S, "opposite", "나머지(부분이 아닌 것)만 더했다."), W((S * p) / 100, "opposite", "합에 퍼센트를 곱했다."), W(T - s.vals[s.vals.length - 1] * (100 / p), "step_missing", "마지막 행을 빠뜨렸다."), W(T + 100, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v)), T),
            verificationJs: figJs({ p }, fig, `${BAR_ROW_JS}return S * 100 / P.p;`),
            trace: [read(s), [`부분의 합 = ${s.vals.join(" + ")} = ${S} 이다.`, "Add the parts."], ["모든 행에서 부분이 같은 퍼센트이므로 합의 전체도 같은 퍼센트로 역산한다.", "The same percent applies to the sum."], [`전체 = ${S} ÷ ${p / 100} = ${fmtNum(T)} 이다.`, "Divide by the percent."], [`따라서 ${fmtNum(T)} 이다.`, "State the total."]], variant: "sum_of_wholes_bar",
          }, fig);
        }, "chain");
      },
    },
    {
      op: "constraint_select", structure: "모든 행의 부분이 각 행 전체의 같은 p% 일 때, 전체가 기준 T 보다 큰 행의 개수를 셈", extra: "행마다 전체를 역산하거나 기준을 T × p% 로 바꿔 경계(같은 경우 제외)를 따져 세야 함 — medium 은 한 행의 나머지",
      concepts: ["막대그래프", "전체 구하기", "조건 개수 세기"],
      gen(rng) {
        return retry(120, () => {
          const s = barScene(rng, 6, 20, 200, 5); const sub = rng.pick(PARTS); const p = rng.pick(P1); if (!ok(s, p)) return null; const tot = s.vals.map((v) => whole(v, p));
          const T = rng.pick(tot) + rng.pick([0, 0, 10, 20]); const cnt = tot.filter((x) => x > T).length; const ge = tot.filter((x) => x >= T).length; if (cnt < 1 || cnt > 5 || T > 999) return null; const fig = bar(s);
          return gInst(rng, {
            stimulus: `${intro(rng, s, sub)} At every one of these ${s.t.many}, the number shown is ${p}% of all the ${s.t.what} there.`,
            question: rng.pick([`For how many of the ${s.t.many} was the total number of ${s.t.what} greater than ${T}?`, `How many of these ${s.t.many} had more than ${T} ${s.t.unit} in all?`]), correct: cnt,
            wrongs: pos([W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(6 - cnt, "opposite", "기준 이하인 개수를 셌다."), W(s.vals.filter((v) => v > T).length || cnt + 2, "step_missing", "부분 개수와 기준을 비교했다."), W(cnt - 1, "other", "하나를 빠뜨렸다."), W(cnt + 1, "other", "하나를 더 셌다.")], cnt).filter((w) => w.v <= 6),
            verificationJs: figJs({ p, T }, fig, `${BAR_ROW_JS}return v.filter(x => x * 100 / P.p > P.T + 1e-9).length;`),
            trace: [read(s), ["전체 = 부분 ÷ (퍼센트 ÷ 100) 이다.", "Total = part ÷ percent."], [`행별 전체: ${tot.join(", ")} 이다.`, "Find each total."], [`${T} 보다 큰 것(같은 것 제외): ${tot.filter((x) => x > T).join(", ")} 이다.`, "Select the totals above the threshold."], [`개수는 ${cnt} 이다.`, "Count them."]], variant: "count_wholes_above_bar",
          }, fig);
        }, "select");
      },
    },
    {
      op: "inverse", structure: "한 행의 부분이 전체의 p% 이고 나머지(부분이 아닌 것)의 r% 가 얼마인지 구함", extra: "전체를 역산한 뒤 나머지를 구하고 다시 퍼센트를 적용하는 세 단계 — 부분의 r% 로 계산하면 틀림 — medium 은 나머지만",
      concepts: ["막대그래프", "전체 구하기", "나머지의 퍼센트"],
      gen(rng) {
        return retry(160, () => {
          const s = barScene(rng, rng.int(4, 5), 20, 200, 5); const sub = rng.pick(PARTS); const i = rng.int(0, s.names.length - 1); const p = rng.pick([20, 25, 40, 50, 60, 75]); const r = rng.pick([10, 20, 25, 50]);
          const Wh = whole(s.vals[i], p); const rest = Wh - s.vals[i]; const c = (rest * r) / 100; if (!Number.isInteger(Wh) || !Number.isInteger(c) || c < 2) return null; const fig = bar(s);
          return gInst(rng, {
            stimulus: `${intro(rng, s, sub)} The number ${nameAt(s.t, s.names[i])} is ${p}% of all the ${s.t.what} there.`,
            question: rng.pick([`What is ${r}% of the number of ${s.t.what} ${nameAt(s.t, s.names[i])} that were not counted in the graph?`, `${r}% of the ${s.t.unit} ${nameAt(s.t, s.names[i])} that are not included in the graph is how many ${s.t.unit}?`]), correct: c,
            wrongs: pos([W((s.vals[i] * r) / 100, "step_missing", "그래프의 값에 바로 r% 를 적용했다."), W((Wh * r) / 100, "step_missing", "전체에 r% 를 적용했다."), W(rest, "step_missing", "나머지를 답했다."), W((s.vals[i] * (100 - p) * r) / 10000, "formula_misuse", "부분에 나머지 퍼센트를 곱했다."), W(c + 1, "other", "계산 중 어긋났다.")].filter((w) => w.v !== c), c),
            verificationJs: figJs({ nm: s.names[i], p, r }, fig, `${BAR_ROW_JS}const w = at(P.nm) * 100 / P.p; return (w - at(P.nm)) * P.r / 100;`),
            trace: [read(s), [`전체 = ${s.vals[i]} ÷ ${p / 100} = ${Wh} 이다.`, "Find the total."], [`그래프에 없는 나머지 = ${Wh} - ${s.vals[i]} = ${rest} 이다.`, "Subtract the part."], [`나머지의 ${r}% = ${rest} × ${r / 100} = ${fmtNum(c)} 이다.`, "Apply the second percent."], [`따라서 ${fmtNum(c)} 이다.`, "State the answer."]], variant: "percent_of_rest_bar",
          }, fig);
        }, "inverse");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "whole_of_row", structure: "한 행의 부분과 퍼센트로 전체를 구함", extra: "easy: 부분 ÷ 퍼센트", concepts: ["막대그래프", "전체 구하기"],
      gen(rng) {
        return retry(80, () => {
          const s = barScene(rng, rng.int(4, 5), 20, 200, 5); const sub = rng.pick(PARTS); const i = rng.int(0, s.names.length - 1); const p = rng.pick(P1); const x = whole(s.vals[i], p); if (!Number.isInteger(x)) return null; const fig = bar(s);
          return gInst(rng, { stimulus: `${intro(rng, s, sub)} The number ${nameAt(s.t, s.names[i])} is ${p}% of all the ${s.t.what} there.`, question: rng.pick([`What was the total number of ${s.t.what} ${nameAt(s.t, s.names[i])}?`, `How many ${s.t.what} were there in all ${nameAt(s.t, s.names[i])}?`]), correct: x, wrongs: pos([W(s.vals[i], "step_missing", "부분 개수를 답했다."), W((s.vals[i] * p) / 100, "opposite", "부분에 퍼센트를 곱했다."), W(x - s.vals[i], "opposite", "나머지를 답했다."), W(s.vals[i] + p, "formula_misuse", "부분과 퍼센트를 더했다."), W(x + 20, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v)), x), verificationJs: figJs({ nm: s.names[i], p }, fig, `${BAR_ROW_JS}return at(P.nm) * 100 / P.p;`), trace: [read(s), [`전체 = ${s.vals[i]} ÷ ${p / 100} = ${x} 이다.`, "Divide by the percent."]], variant: "whole_of_row_bar" }, fig);
        }, "easy");
      },
    },
    {
      lv: "medium", name: "rest_of_row", structure: "한 행의 전체를 구해 부분이 아닌 나머지 개수를 구함", extra: "medium: 전체 역산 후 뺄셈", concepts: ["막대그래프", "전체 구하기"],
      gen(rng) {
        return retry(80, () => {
          const s = barScene(rng, rng.int(4, 5), 20, 200, 5); const sub = rng.pick(PARTS); const i = rng.int(0, s.names.length - 1); const p = rng.pick(P1); const Wh = whole(s.vals[i], p); if (!Number.isInteger(Wh)) return null; const x = Wh - s.vals[i]; const fig = bar(s);
          return gInst(rng, { stimulus: `${intro(rng, s, sub)} The number ${nameAt(s.t, s.names[i])} is ${p}% of all the ${s.t.what} there.`, question: rng.pick([`How many of the ${s.t.what} ${nameAt(s.t, s.names[i])} were not counted in the graph?`, `What number of the ${s.t.unit} ${nameAt(s.t, s.names[i])} are not shown in the graph?`]), correct: x, wrongs: pos([W(Wh, "step_missing", "전체를 답했다."), W(s.vals[i], "opposite", "부분을 답했다."), W(((100 - p) * s.vals[i]) / 100, "formula_misuse", "부분에 나머지 퍼센트를 곱했다."), W(100 - p, "unit_error", "나머지 퍼센트를 답했다."), W(x + 10, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v)), x), verificationJs: figJs({ nm: s.names[i], p }, fig, `${BAR_ROW_JS}const w = at(P.nm) * 100 / P.p; return w - at(P.nm);`), trace: [read(s), [`전체 = ${s.vals[i]} ÷ ${p / 100} = ${Wh} 이다.`, "Find the total."], [`나머지 = ${Wh} - ${s.vals[i]} = ${x} 이다.`, "Subtract the part."]], variant: "rest_of_row_bar" }, fig);
        }, "medium");
      },
    },
  ],
});
