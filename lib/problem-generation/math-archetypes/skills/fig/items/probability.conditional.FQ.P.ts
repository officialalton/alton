// probability.conditional.FQ.P — 도수표의 조건부 확률(조건에 맞는 도수 합을 분모로). 평균 기준·수 성질·두 조건 비교·추가 개체 역산·기준값 탐색으로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { fmtNum, frac, spin } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { FQ_JS, fqIntro, fqRead, makeFq, type FqScene } from "../table-kit";

const FW = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
const one = (ent: string) => (ent === "people" ? "person" : ent === "fish" ? "fish" : ent.endsWith("ies") ? `${ent.slice(0, -3)}y` : ent.replace(/s$/, ""));
const cnt = (s: FqScene, f: (v: number) => boolean) => s.vals.reduce((a, v, i) => a + (f(v) ? s.freqs[i] : 0), 0);
const nStep = (s: FqScene): [string, string] => [`전체 개수 = ${s.freqs.join(" + ")} = ${s.N} 이다.`, "Add the frequencies."];
const small = (t: string) => t.split("/").every((x) => Number(x) <= 999);
const an = (w: string) => (/^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`);
const given = (rng: Rng, s: FqScene, cond: string) => spin(rng, `[[One ${one(s.t.ent)} is chosen at random from those with a value ${cond}.|Suppose ${an(one(s.t.ent))} is selected at random from the ${s.t.ent} with a value ${cond}.|A researcher picks, at random, one of the ${s.t.ent} with a value ${cond}.]]`);
const big = (k: number) => { if (k < 2) throw new GenFail("기준값 1 이하"); return k; };
type Prop = { id: string; text: string; fn: (v: number) => boolean };
const PROPS: Prop[] = [
  { id: "even", text: "an even number", fn: (v) => v % 2 === 0 },
  { id: "odd", text: "an odd number", fn: (v) => v % 2 === 1 },
  { id: "mult3", text: "a multiple of 3", fn: (v) => v % 3 === 0 },
];
const PROP_JS = "function prop(id,v){ if(id==='even') return v%2===0; if(id==='odd') return Math.abs(v%2)===1; if(id==='mult3') return v%3===0; throw new Error('prop'); }\n";

export const ITEM = defineItem({
  prefix: "pr", itemId: "probability.conditional.FQ.P",
  hard: [
    {
      op: "chain2", structure: "도수표의 평균을 구한 뒤, 기준값 이상인 개체 중 평균보다 큰 값을 가진 개체의 조건부 확률을 구함", extra: "가중 평균 → 조건(기준값 이상)의 도수 합 → 그 안에서 평균 초과 도수의 연쇄 — medium 은 범위 조건부 확률",
      concepts: ["도수표", "평균", "조건부 확률"],
      gen(rng) {
        for (let tr = 0; tr < 40; tr++) {
          const s = makeFq(rng); const m = s.sum / s.N; const k = big(s.vals[rng.int(0, s.vals.length - 2)]); const c = cnt(s, (v) => v >= k); const x = cnt(s, (v) => v >= k && v > m);
          if (x === 0 || x === c || k > m) continue;
          return figInst(rng, {
            stimulus: `${fqIntro(rng, s)} ${given(rng, s, `of at least ${k} ${s.t.unit}`)}`,
            question: spin(rng, `[[What is the probability that the chosen ${one(s.t.ent)} has a value greater than the mean of all the data in the table?|What is the probability that the value for the chosen ${one(s.t.ent)} is greater than the mean of the whole data set?]]`), correctText: frac(x, c), range: [0, 1],
            wrongTexts: [FW(x, s.N, "condition_ignored", "조건을 무시하고 전체로 나눴다."), FW(c - x, c, "opposite", "평균 이하를 셌다."), FW(cnt(s, (v) => v > m), s.N, "condition_ignored", "조건 없이 평균 초과 확률을 구했다."), FW(x, s.N - c || 1, "formula_misuse", "조건 밖의 개수로 나눴다."), FW(x + cnt(s, (v) => v === Math.ceil(m) && v <= m), c, "condition_ignored", "평균과 같은 값까지 셌다."), FW(x - 1, c, "other", "한 개를 빠뜨렸다.")],
            verificationJs: figJs({ k }, s.fig, `${FQ_JS}const m = S / N; let c = 0, x = 0; vals.forEach((v, i) => { if (v >= P.k) { c += fr[i]; if (v > m) x += fr[i]; } }); if (c === 0) throw new Error('조건 없음'); return x / c;`),
            trace: [fqRead(s), nStep(s), [`평균 = ${s.sum} ÷ ${s.N} ≈ ${fmtNum(Math.round(m * 100) / 100)} 이다.`, "Compute the mean."], [`${k} 이상인 값의 도수 합(조건) = ${c} 이다.`, "Size of the condition."], [`그중 평균보다 큰 값의 도수 합은 ${x} 이다.`, "Favorable count within the condition."], [`확률 = ${x}/${c} = ${frac(x, c)} 이다.`, "Divide by the condition size."]], variant: "above_mean_given_threshold",
          }, s.fig);
        }
        throw new GenFail("chain2");
      },
    },
    {
      op: "compare_scenarios", structure: "값이 짝수인 개체 중과 홀수인 개체 중에서 각각 기준값 이상일 조건부 확률을 구해 두 확률의 차를 구함", extra: "조건(짝수·홀수)을 바꾼 두 조건부 확률을 각각 구하고 통분해 비교해야 함 — medium 은 조건부 확률 하나",
      concepts: ["도수표", "조건부 확률", "분수의 차(통분)"],
      gen(rng) {
        for (let tr = 0; tr < 40; tr++) {
          const s = makeFq(rng); const k = big(s.vals[rng.int(1, s.vals.length - 2)]); const ev = (v: number) => v % 2 === 0;
          const ce = cnt(s, ev), co = s.N - ce, xe = cnt(s, (v) => ev(v) && v >= k), xo = cnt(s, (v) => !ev(v) && v >= k); if (!ce || !co) continue;
          const nu = Math.abs(xe * co - xo * ce), de = ce * co; if (nu === 0) continue; const ans = frac(nu, de); if (!small(ans)) continue;
          return figInst(rng, {
            stimulus: `${fqIntro(rng, s)} ${rng.pick(["An analyst compares two groups:", "The data are split into two groups:", "Consider two groups:"])} the ${s.t.ent} whose value is an even number and the ${s.t.ent} whose value is an odd number.`,
            question: spin(rng, `[[What is the positive difference between the probability that a randomly chosen ${one(s.t.ent)} from the even-value group has a value of at least ${k} ${s.t.unit} and the same probability for the odd-value group?|By how much do the two groups differ in the probability that a randomly chosen member has a value of at least ${k} ${s.t.unit}?]]`), correctText: ans, range: [0, 1],
            wrongTexts: [FW(Math.abs(xe - xo), s.N, "formula_misuse", "두 분자의 차를 전체로 나눴다."), FW(xe * co + xo * ce, de, "sign_error", "차 대신 합을 구했다."), FW(Math.abs((ce - xe) * co - (co - xo) * ce), de, "opposite", "기준값 미만의 확률로 비교했다."), FW(Math.abs(xe - xo), Math.abs(ce - co) || 1, "formula_misuse", "분자끼리·분모끼리 뺐다."), FW(xe + xo, s.N, "condition_ignored", "조건 없이 기준값 이상의 확률을 구했다.")],
            verificationJs: figJs({ k }, s.fig, `${FQ_JS}let ce = 0, co = 0, xe = 0, xo = 0; vals.forEach((v, i) => { if (v % 2 === 0) { ce += fr[i]; if (v >= P.k) xe += fr[i]; } else { co += fr[i]; if (v >= P.k) xo += fr[i]; } }); if (!ce || !co) throw new Error('조건 없음'); return Math.abs(xe / ce - xo / co);`),
            trace: [fqRead(s), [`짝수 값의 도수 합 ${ce}, 그중 ${k} 이상 ${xe} 이다.`, "Even-value group."], [`홀수 값의 도수 합 ${co}, 그중 ${k} 이상 ${xo} 이다.`, "Odd-value group."], [`두 확률은 ${xe}/${ce} 와 ${xo}/${co} 이다.`, "Two conditional probabilities."], [`차 = |${xe}·${co} - ${xo}·${ce}| ÷ ${de} = ${nu}/${de} 이다.`, "Common denominator."], [`기약분수로 ${ans} 이다.`, "Reduce."]], variant: "even_vs_odd_condition",
          }, s.fig);
        }
        throw new GenFail("compare");
      },
    },
    {
      op: "inverse", structure: "기준값 이상인 개체 중 최댓값을 가진 개체의 조건부 확률이, 최댓값 개체 x 개가 더해진 뒤 주어진 분수가 될 때 x 를 역산", extra: "조건의 크기와 분자가 함께 x 만큼 바뀌는 식을 세워 역산해야 함 — medium 은 조건부 확률 계산까지",
      concepts: ["도수표", "조건부 확률", "분수 방정식의 역산"],
      gen(rng) {
        for (let tr = 0; tr < 80; tr++) {
          const s = makeFq(rng); const k = big(s.vals[rng.int(0, s.vals.length - 3)]); const c = cnt(s, (v) => v >= k); const fl = s.freqs[s.freqs.length - 1]; const x = rng.int(2, 30);
          const g = frac(fl + x, c + x); if (!g.includes("/")) continue; const [a, b] = g.split("/").map(Number); if (b > 999 || a < 2) continue;
          return figInst(rng, {
            stimulus: `${fqIntro(rng, s)} ${spin(rng, `[[Later, more ${s.t.ent} are added, and each new ${one(s.t.ent)} has the greatest value shown in the table.|Some new ${s.t.ent} are then included, each with the largest value listed in the table.]]`)} After that, for a ${one(s.t.ent)} chosen at random from those with a value of at least ${k} ${s.t.unit}, the probability that it has the greatest value is ${a}/${b}.`,
            question: spin(rng, `[[How many ${s.t.ent} were added?|How many new ${s.t.ent} were included?]]`), correct: x,
            wrongs: [W(x + fl, "step_missing", "원래 도수를 다시 더했다."), W(b - c, "formula_misuse", "기약분수의 분모를 새 조건 크기로 착각했다."), W((a * s.N - b * fl) / (b - a), "condition_ignored", "조건 대신 전체 개수로 식을 세웠다."), W(x + 1, "other", "계산 중 1 어긋났다."), W(x - 1, "other", "계산 중 1 어긋났다."), W(c + x, "step_missing", "새 조건의 크기를 답했다.")].filter((w) => w.v > 0 && Number.isInteger(w.v)),
            verificationJs: figJs({ k, a, b }, s.fig, `${FQ_JS}let j = 0; vals.forEach((v, i) => { if (v > vals[j]) j = i; }); const f = fr[j]; const c = vals.reduce((t, v, i) => t + (v >= P.k ? fr[i] : 0), 0); const x = (P.a * c - P.b * f) / (P.b - P.a); if (!Number.isInteger(x) || x < 0) throw new Error('정수 아님'); return x;`),
            trace: [fqRead(s), [`${k} 이상인 값의 도수 합(조건) = ${c} 이다.`, "Size of the condition."], [`가장 큰 값 ${s.vals[s.vals.length - 1]} 의 도수는 ${fl} 이다.`, "Frequency of the greatest value."], [`(${fl} + x) ÷ (${c} + x) = ${a}/${b} 이다.`, "Both grow by x."], [`${b}(${fl} + x) = ${a}(${c} + x) 이므로 ${b - a}x = ${a * c - b * fl} 이다.`, "Cross-multiply and collect terms."], [`x = ${x} 이다.`, "Solve."]], variant: "added_max_to_reach_conditional",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "param_condition", structure: "기준값 m 이상인 개체를 조건으로, '값이 v 이하'일 조건부 확률이 1/2 을 넘게 되는 가장 작은 표의 값 v 를 찾음", extra: "조건부 누적 도수를 값마다 갱신하며 임계 조건(과반)을 처음 넘는 값을 골라야 함 — medium 은 범위 조건부 확률 하나",
      concepts: ["도수표", "조건부 확률", "누적 도수와 임계값"],
      gen(rng) {
        const s = makeFq(rng); const mi = rng.int(0, 1); const m = big(s.vals[mi]); const c = cnt(s, (v) => v >= m); let acc = 0; let v = NaN; const steps: string[] = [];
        for (let i = mi; i < s.vals.length; i++) { acc += s.freqs[i]; steps.push(`${s.vals[i]}: ${acc}/${c}`); if (2 * acc > c) { v = s.vals[i]; break; } }
        if (v === s.vals[mi] || v === s.vals[s.vals.length - 1]) throw new GenFail("edge");
        const iv = s.vals.indexOf(v);
        return figInst(rng, {
          stimulus: `${fqIntro(rng, s)} ${given(rng, s, `of at least ${m} ${s.t.unit}`)}`,
          question: spin(rng, `[[What is the least value v in the table for which the probability that the chosen ${one(s.t.ent)} has a value of at most v ${s.t.unit} is greater than 1/2?|Of the values listed in the table, what is the smallest value v such that the chosen ${one(s.t.ent)} has a value of v ${s.t.unit} or less with probability greater than 1/2?]]`), correct: v,
          wrongs: [W(s.vals[iv - 1], "condition_ignored", "1/2 이상(같음 포함)으로 보거나 한 값 일찍 멈췄다."), W(s.vals[iv + 1], "other", "한 값 늦게 멈췄다."), W(s.vals[Math.floor((s.vals.length - 1) / 2)], "formula_misuse", "도수를 무시하고 값 목록의 가운데를 골랐다."), W(s.vals[s.vals.length - 1], "opposite", "가장 큰 값을 골랐다."), W(m, "step_missing", "조건의 기준값을 답했다.")].filter((w) => Number.isFinite(w.v)),
          verificationJs: figJs({ m }, s.fig, `${FQ_JS}const idx = vals.map((_, i) => i).sort((p, q) => vals[p] - vals[q]); const c = vals.reduce((t, v, i) => t + (v >= P.m ? fr[i] : 0), 0); if (!c) throw new Error('조건 없음'); let acc = 0; for (const i of idx) { if (vals[i] < P.m) continue; acc += fr[i]; if (2 * acc > c) return vals[i]; } throw new Error('없음');`),
          trace: [fqRead(s), [`조건: 값이 ${m} 이상 — 도수 합 ${c} 이다.`, "Size of the condition."], ["작은 값부터 조건 안의 누적 도수를 구한다.", "Accumulate frequencies from the smallest value."], [`누적: ${steps.join(", ")} 이다.`, "Cumulative conditional probabilities."], [`처음으로 1/2 을 넘는 곳은 v = ${v} 이다.`, "First value where it exceeds 1/2."], [`따라서 v = ${v} 이다.`, "State the value."]], variant: "least_value_majority_given",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "value_given_at_least", structure: "기준값 이상인 개체 중 값이 정확히 기준값인 개체의 조건부 확률을 구함", extra: "easy: 한 도수 ÷ 조건의 도수 합", concepts: ["도수표", "조건부 확률"],
      gen(rng) {
        const s = makeFq(rng); const i = rng.int(0, s.vals.length - 2); const k = big(s.vals[i]); const c = cnt(s, (v) => v >= k); const f = s.freqs[i];
        return figInst(rng, {
          stimulus: `${fqIntro(rng, s)} ${given(rng, s, `of at least ${k} ${s.t.unit}`)}`, question: spin(rng, `[[What is the probability that the chosen ${one(s.t.ent)} has a value of exactly ${k} ${s.t.unit}?|What is the probability that the value for the chosen ${one(s.t.ent)} is exactly ${k} ${s.t.unit}?]]`), correctText: frac(f, c), range: [0, 1],
          wrongTexts: [FW(f, s.N, "condition_ignored", "전체로 나눴다."), FW(c - f, c, "opposite", "기준값보다 큰 쪽을 셌다."), FW(1, s.vals.length - i, "axis_misread", "행의 수로 확률을 냈다."), FW(f, c - f, "formula_misuse", "비(odds)를 구했다.")],
          verificationJs: figJs({ k }, s.fig, `${FQ_JS}const j = vals.indexOf(P.k); if (j < 0) throw new Error('값 없음'); const c = vals.reduce((t, v, i) => t + (v >= P.k ? fr[i] : 0), 0); return fr[j] / c;`), trace: [fqRead(s), [`${k} 이상인 값의 도수 합(조건) = ${c} 이다.`, "Size of the condition."], [`확률 = ${f}/${c} = ${frac(f, c)} 이다.`, "Divide by the condition size."]], variant: "exact_given_at_least",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "property_given", structure: "도수표에서 기준값 이상(조건)인 개체 중 값이 수 성질(짝수·홀수·3의 배수)을 만족하는 개체의 조건부 확률을 구함", extra: "medium: 조건(기준값 이상)의 도수 합 → 그 안에서 수 성질 도수 → 조건부 확률",
      concepts: ["도수표", "수 성질(배수·짝홀)", "조건부 확률"],
      gen(rng) {
        const s = makeFq(rng); const k = big(s.vals[rng.int(1, s.vals.length - 2)]); const pr = rng.pick(PROPS); const c = cnt(s, (v) => v >= k); const x = cnt(s, (v) => v >= k && pr.fn(v));
        if (x === 0 || x === c) throw new GenFail("prop");
        return figInst(rng, {
          stimulus: `${fqIntro(rng, s)} ${given(rng, s, `of at least ${k} ${s.t.unit}`)}`,
          question: spin(rng, `[[What is the probability that the value for the chosen ${one(s.t.ent)} is ${pr.text}?|What is the probability that the chosen ${one(s.t.ent)} has a value that is ${pr.text}?]]`), correctText: frac(x, c), range: [0, 1],
          wrongTexts: [FW(cnt(s, pr.fn), s.N, "condition_ignored", "조건 없이 전체에서 셌다."), FW(x, s.N, "condition_ignored", "분모를 전체로 잡았다."), FW(c - x, c, "opposite", "성질을 만족하지 않는 쪽을 셌다."), FW(s.vals.filter((v) => v >= k && pr.fn(v)).length, s.vals.filter((v) => v >= k).length, "axis_misread", "도수 대신 값의 종류 수로 셌다."), FW(cnt(s, (v) => v > k && pr.fn(v)), cnt(s, (v) => v > k), "condition_ignored", "기준값과 같은 값을 조건에서 뺐다.")],
          verificationJs: figJs({ k, prop: pr.id }, s.fig, `${FQ_JS}${PROP_JS}let c = 0, x = 0; vals.forEach((v, i) => { if (v >= P.k) { c += fr[i]; if (prop(P.prop, v)) x += fr[i]; } }); if (c === 0) throw new Error('조건 없음'); return x / c;`),
          trace: [fqRead(s), [`조건은 값이 ${k} 이상인 것이다.`, "State the condition."], [`조건에 맞는 값: ${s.vals.filter((v) => v >= k).join(", ")} — 도수 합 ${c} 이다.`, "Size of the condition."], [`그중 ${pr.text} 인 값: ${s.vals.filter((v) => v >= k && pr.fn(v)).join(", ")} — 도수 합 ${x} 이다.`, "Favorable values within the condition."], [`확률 = ${x}/${c} 이다.`, "Divide by the condition size."], [`기약분수로 ${frac(x, c)} 이다.`, "Reduce."]], variant: `property_given_${pr.id}`,
        }, s.fig);
      },
    },
  ],
});
