// percentages.find_whole.TB.P — 행마다 '부분 개수'와 '그 부분이 전체에서 차지하는 퍼센트'가 있는 표에서 전체를 구하고, 합계·비교·개수·결합 퍼센트로 확장한다.
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { COUNT_TOPICS, lcFirst, nameAt, pos, r1, retry, sum, tab, type CountTopic } from "./_t4-kit";

const PARTS = ["on weekends", "in the morning", "by online order", "to first-time customers", "in the first week"];
type WScene = { t: CountTopic; names: string[]; part: number[]; pct: number[]; whole: number[]; sub: string };
function wholeScene(rng: Rng, n: number, maxWhole = 400): WScene {
  const t = rng.pick(COUNT_TOPICS); const sub = rng.pick(PARTS); const names = t.rows.slice(0, n);
  return retry(80, () => {
    const pct = names.map(() => rng.pick([10, 20, 25, 30, 40, 50, 60, 75, 80])); const whole = names.map(() => 20 * rng.int(2, Math.floor(maxWhole / 20)));
    const part = whole.map((w, i) => (w * pct[i]) / 100); if (part.some((p) => !Number.isInteger(p)) || new Set(whole).size < n) return null;
    return { t, names, part, pct, whole, sub };
  }, "부분·퍼센트 장면");
}
const wFig = (s: WScene) => tab([s.t.rowHead, `${cap(s.sub)} (${s.t.unit})`, "Percent of total (%)"], s.names.map((nm, i) => [nm, s.part[i], s.pct[i]]), s.t.col);
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const intro = (rng: Rng, s: WScene) => rng.pick([
  `For each of ${s.names.length} ${s.t.many}, the table shows the number of ${s.t.what} ${s.sub} and the percent of all the ${s.t.what} there that this number represents.`,
  `${s.t.who} counted the ${s.t.what} ${s.sub} ${s.t.prep} several ${s.t.many}. The table gives each count and what percent it is of the total number of ${s.t.what} ${s.t.prep} that location.`,
  `The table shown lists, for several ${s.t.many}, the number of ${s.t.what} ${s.sub} along with that number as a percent of all ${s.t.what} ${s.t.prep} the same location.`,
  `In a summary, ${lcFirst(s.t.who)} reported the number of ${s.t.what} ${s.sub} ${s.t.prep} each of several ${s.t.many}, together with the percent of the total that number makes up, as shown in the table.`,
]);
/** FIGURE 에서 부분 c·퍼센트 q·전체 w 를 읽는 JS. 퍼센트가 0~100 밖이거나 전체가 정수가 아니면 던진다. */
const W_JS = "const nm=FIGURE.rows.map(r=>r[0]); const c=FIGURE.rows.map(r=>r[1]), q=FIGURE.rows.map(r=>r[2]); if (q.some(x=>!(x>0&&x<=100))) throw new Error('퍼센트 오류'); const w=c.map((x,i)=>x*100/q[i]); if (w.some(x=>Math.abs(x-Math.round(x))>1e-9||x<=0)) throw new Error('전체가 정수가 아님'); const idx=(k)=>{ const i=nm.indexOf(k); if (i<0) throw new Error('행 없음'); return i; };\n";
const read = (s: WScene): [string, string] => [`표에서 읽는다: ${s.names.map((n, i) => `${n} ${s.part[i]}(${s.pct[i]}%)`).join(", ")}.`, "Read each count and its percent."];
const wh = (s: WScene, i: number): [string, string] => [`${s.names[i]}: 전체 = ${s.part[i]} ÷ ${s.pct[i] / 100} = ${s.whole[i]} 이다.`, `Find the total for ${s.names[i]}.`];

export const ITEM = defineItem({
  prefix: "pct", itemId: "percentages.find_whole.TB.P",
  hard: [
    {
      op: "chain2", structure: "행마다 부분 ÷ 퍼센트로 전체를 구한 뒤 모든 행의 전체를 더함", extra: "행마다 다른 퍼센트로 전체를 역산한 뒤 합산 — 부분끼리 더한 뒤 한 번에 역산하면 틀림 — medium 은 한 행의 나머지",
      concepts: ["부분·퍼센트 표", "전체 구하기", "합계"],
      gen(rng) {
        const s = wholeScene(rng, rng.int(3, 4), 240); const T = sum(s.whole); const fig = wFig(s); const avgP = sum(s.pct) / s.pct.length;
        return figInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`What is the total number of ${s.t.what} for all the ${s.t.many} in the table combined?`, `Based on the table, how many ${s.t.unit} were there in all, for these ${s.t.many} together?`]), correct: T,
          wrongs: pos([W(sum(s.part), "step_missing", "부분 개수만 더했다."), W(Math.round((sum(s.part) * 100) / avgP), "formula_misuse", "부분의 합을 평균 퍼센트로 한 번에 역산했다."), W(T - sum(s.part), "opposite", "나머지(부분이 아닌 것)만 더했다."), W(sum(s.part.map((p, i) => (p * s.pct[i]) / 100)), "opposite", "부분에 퍼센트를 곱했다."), W(T - s.whole[s.whole.length - 1], "step_missing", "마지막 행을 빠뜨렸다.")].filter((w) => Number.isInteger(w.v)), T),
          verificationJs: figJs({}, fig, `${W_JS}return w.reduce((a, b) => a + b, 0);`),
          trace: [read(s), ["전체 = 부분 ÷ (퍼센트 ÷ 100) 이다.", "Total = part ÷ percent."], ...s.names.map((_, i) => wh(s, i)), [`합 = ${s.whole.join(" + ")} = ${T} 이다.`, "Add the totals."]], variant: "sum_of_wholes",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 행의 전체를 각각 역산해 차를 구함(부분이 큰 행의 전체가 더 작을 수 있음)", extra: "부분의 크기와 전체의 크기가 순서가 다를 수 있어 두 전체를 실제로 구해 비교해야 함 — medium 은 한 행",
      concepts: ["부분·퍼센트 표", "전체 구하기", "두 경우 비교"],
      gen(rng) {
        return retry(60, () => {
          const s = wholeScene(rng, rng.int(4, 5)); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); if (s.whole[i] === s.whole[j]) return null; const c = Math.abs(s.whole[i] - s.whole[j]); const fig = wFig(s);
          return figInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`What is the positive difference between the total number of ${s.t.what} ${nameAt(s.t, s.names[i])} and the total number ${nameAt(s.t, s.names[j])}?`, `By how many ${s.t.unit} does the total ${nameAt(s.t, s.names[i])} differ from the total ${nameAt(s.t, s.names[j])}?`]), correct: c,
            wrongs: pos([W(Math.abs(s.part[i] - s.part[j]), "step_missing", "부분 개수의 차를 구했다."), W(s.whole[i] + s.whole[j], "sign_error", "차 대신 합을 구했다."), W(Math.abs(s.whole[i] - s.part[i] - (s.whole[j] - s.part[j])), "opposite", "나머지끼리의 차를 구했다."), W(Math.abs((s.part[i] * 100) / s.pct[j] - (s.part[j] * 100) / s.pct[i]), "axis_misread", "두 행의 퍼센트를 바꿔 썼다."), W(Math.max(s.whole[i], s.whole[j]), "step_missing", "한쪽 전체만 답했다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j] }, fig, `${W_JS}return Math.abs(w[idx(P.ni)] - w[idx(P.nj)]);`),
            trace: [read(s), ["전체 = 부분 ÷ (퍼센트 ÷ 100) 이다.", "Total = part ÷ percent."], wh(s, i), wh(s, j), [`차 = |${s.whole[i]} - ${s.whole[j]}| = ${c} 이다.`, "Take the positive difference."]], variant: "difference_of_wholes",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "constraint_select", structure: "모든 행의 전체를 역산해 기준 T 보다 큰 행의 개수를 셈", extra: "행마다 전체를 역산하고 경계(같은 경우 제외)를 따져 세야 함 — 부분만 비교하면 틀림 — medium 은 한 행",
      concepts: ["부분·퍼센트 표", "전체 구하기", "조건 개수 세기"],
      gen(rng) {
        return retry(60, () => {
          const s = wholeScene(rng, 5); const T = rng.pick(s.whole) + rng.pick([0, 0, 10, 20]); const cnt = s.whole.filter((w) => w > T).length; const ge = s.whole.filter((w) => w >= T).length; if (cnt < 1 || cnt > 4) return null; const fig = wFig(s);
          return figInst(rng, {
            stimulus: intro(rng, s),
            question: rng.pick([`For how many of the ${s.t.many} was the total number of ${s.t.what} greater than ${T}?`, `How many of these ${s.t.many} had more than ${T} ${s.t.unit} in all?`]), correct: cnt,
            wrongs: pos([W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(5 - cnt, "opposite", "기준 이하인 개수를 셌다."), W(s.part.filter((p) => p > T).length || cnt + 2, "step_missing", "부분 개수와 기준을 비교했다."), W(cnt - 1, "other", "하나를 빠뜨렸다."), W(cnt + 1, "other", "하나를 더 셌다.")], cnt).filter((w) => w.v <= 5),
            verificationJs: figJs({ T }, fig, `${W_JS}return w.filter(x => x > P.T).length;`),
            trace: [read(s), ["전체 = 부분 ÷ (퍼센트 ÷ 100) 이다.", "Total = part ÷ percent."], [`행별 전체: ${s.whole.join(", ")} 이다.`, "Find each total."], [`${T} 보다 큰 것(같은 것 제외): ${s.whole.filter((w) => w > T).join(", ")} 이다.`, "Select totals above the threshold."], [`개수는 ${cnt} 이다.`, "Count them."]], variant: "count_wholes_above",
          }, fig);
        }, "select");
      },
    },
    {
      op: "compose_kind", structure: "두 행의 전체를 역산해 합친 뒤, 합친 부분이 합친 전체에서 차지하는 퍼센트를 구함", extra: "역산(전체 구하기)과 퍼센트 구하기를 합성 — 두 퍼센트의 평균을 내면 틀림 — medium 은 한 행",
      concepts: ["부분·퍼센트 표", "전체 구하기", "결합 퍼센트"],
      gen(rng) {
        return retry(120, () => {
          const s = wholeScene(rng, rng.int(4, 5)); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); if (s.pct[i] === s.pct[j]) return null;
          const c = ((s.part[i] + s.part[j]) * 100) / (s.whole[i] + s.whole[j]); if (!oneDec(c)) return null; const avg = (s.pct[i] + s.pct[j]) / 2; if (Math.abs(avg - c) < 1e-9) return null; const fig = wFig(s);
          return figInst(rng, {
            stimulus: `${intro(rng, s)} The counts for ${s.names[i]} and ${s.names[j]} are then put together.`,
            question: rng.pick([`Taken together, what percent of all the ${s.t.what} at these two locations were ${s.sub}?`, `For both locations together, what percent of all the ${s.t.unit} were ${s.sub}?`]), correct: c,
            wrongs: pos([W(avg, "formula_misuse", "두 퍼센트의 평균을 냈다."), W(s.pct[i] + s.pct[j], "formula_misuse", "두 퍼센트를 더했다."), W(100 - c, "opposite", "나머지의 퍼센트를 구했다."), W(r1(((s.part[i] + s.part[j]) * 100) / (s.part[i] + s.part[j] + s.whole[i] + s.whole[j])), "formula_misuse", "부분을 전체에 한 번 더 더했다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j] }, fig, `${W_JS}const a = idx(P.ni), b = idx(P.nj); return (c[a] + c[b]) * 100 / (w[a] + w[b]);`),
            trace: [read(s), wh(s, i), wh(s, j), [`부분의 합 = ${s.part[i]} + ${s.part[j]} = ${s.part[i] + s.part[j]}, 전체의 합 = ${s.whole[i] + s.whole[j]} 이다.`, "Combine parts and totals."], [`퍼센트 = ${s.part[i] + s.part[j]} ÷ ${s.whole[i] + s.whole[j]} × 100 = ${fmtNum(c)} 이다.`, "Divide and convert to a percent."]], variant: "combined_percent",
          }, fig);
        }, "compose");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "whole_of_row", structure: "한 행의 부분과 퍼센트로 전체를 구함", extra: "easy: 부분 ÷ 퍼센트", concepts: ["부분·퍼센트 표", "전체 구하기"],
      gen(rng) {
        const s = wholeScene(rng, rng.int(4, 5)); const i = rng.int(0, s.names.length - 1); const fig = wFig(s); const x = s.whole[i];
        return figInst(rng, { stimulus: intro(rng, s), question: rng.pick([`What was the total number of ${s.t.what} ${nameAt(s.t, s.names[i])}?`, `How many ${s.t.what} were there in all ${nameAt(s.t, s.names[i])}?`]), correct: x, wrongs: pos([W(s.part[i], "step_missing", "부분 개수를 답했다."), W((s.part[i] * s.pct[i]) / 100, "opposite", "부분에 퍼센트를 곱했다."), W(s.part[i] + s.pct[i], "formula_misuse", "부분과 퍼센트를 더했다."), W(x - s.part[i], "opposite", "나머지를 답했다."), W(x + 20, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v)), x), verificationJs: figJs({ nm: s.names[i] }, fig, `${W_JS}return w[idx(P.nm)];`), trace: [[`${s.names[i]} 행: 부분 ${s.part[i]}, 퍼센트 ${s.pct[i]}% 이다.`, "Read the row."], [`전체 = ${s.part[i]} ÷ ${s.pct[i] / 100} = ${x} 이다.`, "Divide by the percent."]], variant: "whole_of_row" }, fig);
      },
    },
    {
      lv: "medium", name: "rest_of_row", structure: "한 행의 전체를 구해 부분이 아닌 나머지 개수를 구함", extra: "medium: 전체 역산 후 뺄셈", concepts: ["부분·퍼센트 표", "전체 구하기"],
      gen(rng) {
        const s = wholeScene(rng, rng.int(4, 5)); const i = rng.int(0, s.names.length - 1); const fig = wFig(s); const x = s.whole[i] - s.part[i];
        return figInst(rng, { stimulus: intro(rng, s), question: rng.pick([`How many of the ${s.t.what} ${nameAt(s.t, s.names[i])} were not ${s.sub}?`, `What number of the ${s.t.unit} ${nameAt(s.t, s.names[i])} were not ${s.sub}?`]), correct: x, wrongs: pos([W(s.whole[i], "step_missing", "전체를 답했다."), W(s.part[i], "opposite", "부분을 답했다."), W(((100 - s.pct[i]) * s.part[i]) / 100, "formula_misuse", "부분에 나머지 퍼센트를 곱했다."), W(100 - s.pct[i], "unit_error", "나머지 퍼센트를 답했다."), W(x + 10, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v)), x), verificationJs: figJs({ nm: s.names[i] }, fig, `${W_JS}const k = idx(P.nm); return w[k] - c[k];`), trace: [[`${s.names[i]} 행: 부분 ${s.part[i]}, 퍼센트 ${s.pct[i]}% 이다.`, "Read the row."], [`전체 = ${s.part[i]} ÷ ${s.pct[i] / 100} = ${s.whole[i]} 이다.`, "Find the total."], [`나머지 = ${s.whole[i]} - ${s.part[i]} = ${x} 이다.`, "Subtract the part."]], variant: "rest_of_row" }, fig);
      },
    },
  ],
});
