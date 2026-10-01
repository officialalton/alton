// percentages.find_percent.TB.P — 행 이름 × 개수 표에서 한 값이 다른 값·합계의 몇 퍼센트인지 구하고, 묶음 비율·퍼센트포인트 차·역산·개수 세기로 확장한다.
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { countFig, countIntro, countScene, nameAt, pos, r1, retry, ROW_JS, sum, type CountScene } from "./_t4-kit";

const read = (s: CountScene): [string, string] => [`표에서 값을 읽는다: ${s.names.map((n, i) => `${n} ${s.vals[i]}`).join(", ")}.`, "Read the values from the table."];
const totStep = (s: CountScene): [string, string] => [`합계 = ${s.vals.join(" + ")} = ${sum(s.vals)} 이다.`, "Add all the values."];
/** 합계가 100·200·250·400·500 등 퍼센트가 깔끔해지기 쉬운 장면. */
const niceScene = (rng: Rng, n: number) => retry(400, () => { const s = countScene(rng, n, 10, 200, 5); return [100, 200, 250, 400, 500, 300, 150, 600].includes(sum(s.vals)) ? s : null; }, "합계 장면");

export const ITEM = defineItem({
  prefix: "pct", itemId: "percentages.find_percent.TB.P",
  hard: [
    {
      op: "chain2", structure: "합계를 구한 뒤 두 행을 합친 값이 합계의 몇 퍼센트인지 구함", extra: "합계 → 두 행 묶음 → 퍼센트의 연쇄(분모는 표 전체 합계) — medium 은 한 행의 퍼센트",
      concepts: ["값 목록 표", "합계", "퍼센트 구하기"],
      gen(rng) {
        return retry(80, () => {
          const s = niceScene(rng, rng.int(4, 5)); const S = sum(s.vals); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const k = s.vals[i] + s.vals[j]; const c = (k * 100) / S; if (!oneDec(c)) return null; const fig = countFig(s);
          return figInst(rng, {
            stimulus: countIntro(rng, s),
            question: rng.pick([`The ${s.t.what} ${nameAt(s.t, s.names[i])} and ${nameAt(s.t, s.names[j])} together make up what percent of the total for all the ${s.t.many} in the table?`, `What percent of all the ${s.t.what} shown in the table were ${nameAt(s.t, s.names[i])} or ${nameAt(s.t, s.names[j])}?`]), correct: c,
            wrongs: pos([W(r1((s.vals[i] * 100) / S), "step_missing", "한 행의 퍼센트만 구했다."), W(r1((k * 100) / (S - k)), "formula_misuse", "나머지 행의 합으로 나누었다."), W(100 - c, "opposite", "나머지 행의 퍼센트를 구했다."), W(k, "step_missing", "두 행의 합을 답했다."), W(r1((s.vals[i] / s.vals[j]) * 100), "formula_misuse", "한 행을 다른 행으로 나누었다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j] }, fig, `${ROW_JS}return (at(P.ni) + at(P.nj)) * 100 / S;`),
            trace: [read(s), totStep(s), [`두 행의 합 = ${s.vals[i]} + ${s.vals[j]} = ${k} 이다.`, "Combine the two rows."], [`${k} ÷ ${S} = ${fmtNum(k / S)} 이다.`, "Divide by the total."], [`퍼센트로 바꾸면 ${fmtNum(c)}% 이다.`, "Convert to a percent."]], variant: "two_rows_share",
          }, fig);
        }, "chain2");
      },
    },
    {
      op: "compare_scenarios", structure: "두 행이 각각 합계의 몇 퍼센트인지 구해 퍼센트포인트 차를 구함", extra: "두 비율을 같은 분모(합계)로 구해 비교 — 한 행을 다른 행으로 나누면 틀림 — medium 은 한 행의 퍼센트",
      concepts: ["값 목록 표", "퍼센트 구하기", "두 경우 비교"],
      gen(rng) {
        return retry(80, () => {
          const s = niceScene(rng, rng.int(4, 5)); const S = sum(s.vals); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const pi = (s.vals[i] * 100) / S, pj = (s.vals[j] * 100) / S; const c = Math.abs(pi - pj); if (!oneDec(c) || !oneDec(pi)) return null; const fig = countFig(s);
          const rel = (Math.abs(s.vals[i] - s.vals[j]) / Math.min(s.vals[i], s.vals[j])) * 100;
          return figInst(rng, {
            stimulus: `${countIntro(rng, s)} For each ${s.t.rowHead.toLowerCase()}, an analyst finds the percent of the total for all the ${s.t.many} that it accounts for.`,
            question: rng.pick([`By how many percentage points does the percent for ${s.names[i]} differ from the percent for ${s.names[j]}?`, `What is the positive difference, in percentage points, between the percents for ${s.names[i]} and ${s.names[j]}?`]), correct: c,
            wrongs: pos([W(Math.abs(s.vals[i] - s.vals[j]), "step_missing", "값의 차를 답했다."), W(r1(rel), "formula_misuse", "작은 값에 대한 상대 차이를 구했다."), W(r1(pi + pj), "sign_error", "두 퍼센트를 더했다."), W(r1(Math.max(pi, pj)), "step_missing", "한쪽 퍼센트만 답했다."), W(r1((Math.abs(s.vals[i] - s.vals[j]) * 100) / (S - s.vals[i] - s.vals[j] || 1)), "formula_misuse", "다른 행들의 합으로 나누었다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j] }, fig, `${ROW_JS}return Math.abs(at(P.ni) - at(P.nj)) * 100 / S;`),
            trace: [read(s), totStep(s), [`${s.names[i]}: ${s.vals[i]} ÷ ${S} × 100 = ${fmtNum(pi)}% 이다.`, "First percent."], [`${s.names[j]}: ${s.vals[j]} ÷ ${S} × 100 = ${fmtNum(pj)}% 이다.`, "Second percent."], [`차 = ${fmtNum(c)} 퍼센트포인트이다.`, "Subtract the percents."]], variant: "percentage_point_gap",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "inverse", structure: "한 행에 k 를 더해 그 행이 새 합계의 p% 가 되게 하는 k 를 역산", extra: "더한 만큼 합계도 늘어나므로 (v + k) = p%(S + k) 를 풀어야 함 — 기존 합계의 p% 에 맞추면 틀림 — medium 은 퍼센트 구하기",
      concepts: ["값 목록 표", "퍼센트", "일차방정식"],
      gen(rng) {
        return retry(200, () => {
          const s = countScene(rng, rng.int(4, 5), 10, 150, 5); const S = sum(s.vals); const i = rng.int(0, s.names.length - 1); const v = s.vals[i]; const p = rng.pick([20, 25, 30, 40, 50, 60]);
          const k = (p * S - 100 * v) / (100 - p); if (!Number.isInteger(k) || k <= 0 || k > 999) return null; const naive = (p * S) / 100 - v; const fig = countFig(s);
          return figInst(rng, {
            stimulus: `${countIntro(rng, s)} Suppose some ${s.t.unit} are added to the number ${nameAt(s.t, s.names[i])}, and no other numbers change.`,
            question: rng.pick([`How many must be added so that ${s.names[i]} accounts for exactly ${p}% of the new total for all the ${s.t.many}?`, `What number of ${s.t.unit} must be added so that, after the change, ${s.names[i]} makes up ${p}% of the total?`]), correct: k,
            wrongs: pos([W(naive, "formula_misuse", "합계가 늘어나는 것을 무시하고 기존 합계의 p% 에 맞췄다."), W((p * S) / 100, "step_missing", "기존 합계의 p% 를 답했다."), W(k + v, "step_missing", "더한 뒤의 값을 답했다."), W((p * (S - v)) / (100 - p), "other", "더한 뒤의 값을 답했다."), W(k + 5, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v)), k),
            verificationJs: figJs({ nm: s.names[i], p }, fig, `${ROW_JS}const x = at(P.nm); return (P.p * S - 100 * x) / (100 - P.p);`),
            trace: [read(s), totStep(s), [`더할 수를 k 라 하면 ${v} + k = ${p / 100}(${S} + k) 이다.`, "Set up the equation; the total also grows."], [`${v} + k = ${fmtNum((p * S) / 100)} + ${p / 100}k 이므로 ${fmtNum(1 - p / 100)}k = ${fmtNum((p * S) / 100 - v)} 이다.`, "Collect the k terms."], [`k = ${k} 이다.`, "Solve for k."]], variant: "add_to_reach_percent",
          }, fig);
        }, "inverse");
      },
    },
    {
      op: "constraint_select", structure: "행마다 합계에 대한 퍼센트를 구해 p% 보다 큰 행의 개수를 셈", extra: "합계를 구해 기준을 p% × 합계로 바꾸고 경계를 따져 세야 함 — medium 은 한 행의 퍼센트",
      concepts: ["값 목록 표", "퍼센트 구하기", "조건 개수 세기"],
      gen(rng) {
        return retry(120, () => {
          const s = countScene(rng, 6, 10, 200, 5); const p = rng.pick([10, 12, 15, 18, 20, 25]); const S0 = sum(s.vals.slice(0, 5)); const last = (p * S0) / (100 - p); if (!Number.isInteger(last) || last < 5 || last > 300 || s.vals.slice(0, 5).includes(last)) return null; s.vals[5] = last; const S = sum(s.vals); const cut = (p * S) / 100; const cnt = s.vals.filter((v) => v > cut).length; if (cnt < 1 || cnt > 5) return null;
          const ge = s.vals.filter((v) => v >= cut).length; const fig = countFig(s);
          return figInst(rng, {
            stimulus: countIntro(rng, s),
            question: rng.pick([`For how many of the ${s.t.many} is the number of ${s.t.what} more than ${p}% of the total for all the ${s.t.many} in the table?`, `How many of these ${s.t.many} account for more than ${p}% of the combined total?`]), correct: cnt,
            wrongs: pos([W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(6 - cnt, "opposite", "기준 이하인 행을 셌다."), W(s.vals.filter((v) => v > p).length, "step_missing", "값을 퍼센트 기준 수와 바로 비교했다."), W(cnt - 1, "other", "하나를 빠뜨렸다."), W(cnt + 2, "other", "경계를 잘못 잡았다.")], cnt).filter((w) => w.v <= 6),
            verificationJs: figJs({ p }, fig, `${ROW_JS}return v.filter(x => x * 100 / S > P.p + 1e-9).length;`),
            trace: [read(s), totStep(s), [`기준 = ${S} × ${p / 100} = ${fmtNum(cut)} 이다.`, "Convert the percent to a count."], [`${fmtNum(cut)} 보다 큰 값: ${s.vals.filter((v) => v > cut).join(", ")} 이다.`, "Select the rows above the cutoff."], [`개수는 ${cnt} 이다.`, "Count them."]], variant: "count_share_above",
          }, fig);
        }, "select");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "row_of_row", structure: "한 행의 값이 다른 행의 값의 몇 퍼센트인지 구함", extra: "easy: 나눗셈 후 × 100", concepts: ["값 목록 표", "퍼센트 구하기"],
      gen(rng) {
        return retry(200, () => {
          const s = countScene(rng, rng.int(4, 5), 10, 200, 5); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const c = (s.vals[i] * 100) / s.vals[j]; if (!Number.isInteger(c)) return null; const fig = countFig(s);
          return figInst(rng, { stimulus: countIntro(rng, s), question: `The number of ${s.t.what} ${nameAt(s.t, s.names[i])} is what percent of the number ${nameAt(s.t, s.names[j])}?`, correct: c, wrongs: pos([W(r1((s.vals[j] * 100) / s.vals[i]), "opposite", "나누는 순서를 바꿨다."), W(Math.abs(s.vals[i] - s.vals[j]), "step_missing", "차를 구했다."), W(c / 10, "unit_error", "자리를 잘못 옮겼다."), W(Math.abs(c - 100), "formula_misuse", "퍼센트 차이를 답했다."), W(c + 10, "other", "어긋났다.")], c), verificationJs: figJs({ ni: s.names[i], nj: s.names[j] }, fig, `${ROW_JS}return at(P.ni) * 100 / at(P.nj);`), trace: [[`${s.names[i]} ${s.vals[i]}, ${s.names[j]} ${s.vals[j]} 을 읽는다.`, "Read the two rows."], [`${s.vals[i]} ÷ ${s.vals[j]} × 100 = ${c}% 이다.`, "Divide and convert."]], variant: "row_of_row" }, fig);
        }, "easy");
      },
    },
    {
      lv: "medium", name: "share_of_total", structure: "한 행의 값이 합계의 몇 퍼센트인지 구함", extra: "medium: 합계 → 나눗셈 → 퍼센트", concepts: ["값 목록 표", "퍼센트 구하기"],
      gen(rng) {
        return retry(80, () => {
          const s = niceScene(rng, rng.int(4, 5)); const S = sum(s.vals); const i = rng.int(0, s.names.length - 1); const c = (s.vals[i] * 100) / S; if (!oneDec(c)) return null; const fig = countFig(s);
          return figInst(rng, { stimulus: countIntro(rng, s), question: rng.pick([`What percent of the total for all the ${s.t.many} in the table is the number ${nameAt(s.t, s.names[i])}?`, `The ${s.t.unit} ${nameAt(s.t, s.names[i])} make up what percent of all the ${s.t.unit} shown?`]), correct: c, wrongs: pos([W(r1((s.vals[i] * 100) / (S - s.vals[i])), "formula_misuse", "나머지 행의 합으로 나누었다."), W(100 - c, "opposite", "나머지의 퍼센트를 구했다."), W(s.vals[i], "step_missing", "값을 답했다."), W(r1(100 / s.vals.length), "other", "행 수로 균등하게 나누었다."), W(c + 5, "other", "어긋났다.")], c), verificationJs: figJs({ nm: s.names[i] }, fig, `${ROW_JS}return at(P.nm) * 100 / S;`), trace: [[`${s.names[i]} 의 값 ${s.vals[i]} 를 읽는다.`, "Read the row."], totStep(s), [`${s.vals[i]} ÷ ${S} × 100 = ${fmtNum(c)}% 이다.`, "Divide and convert."]], variant: "share_of_total" }, fig);
        }, "medium");
      },
    },
  ],
});
