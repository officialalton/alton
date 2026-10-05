// inference_margin_error.sample_size_effect.ST.P — 설문 정보(표본 크기·오차범위)를 '항목 | 값' 자료로 주고 표본 크기와 오차범위의 관계(오차범위 ∝ 1/√n)를 쓴다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, oneDec } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { factFig, GET_JS, lcf, sampleCounts, sumJs, surv, type Surv } from "./_t7-kit";

const NOTES = ["Assume the margin of error varies inversely with the square root of the sample size.", "For these surveys, the margin of error is inversely proportional to the square root of the sample size.", "Treat the margin of error as inversely proportional to the square root of the sample size.", "Suppose the margin of error changes in inverse proportion to the square root of the sample size."];
const intro = (rng: Rng, s: Surv) => rng.pick([
  `A survey asked a random sample of ${s.ent} whether they ${s.ev}. The table shows information about the survey.`,
  `Researchers studying ${s.topic} chose ${s.ent} at random from all ${lcf(s.popLbl)} and asked whether they ${s.ev}. Details of their survey are shown in the table.`,
  `The table shown summarizes a random-sample survey of ${lcf(s.popLbl)} about ${s.topic}, in which each person said whether they ${s.ev}.`,
  `For a study of ${s.topic}, ${s.ent} were selected at random and asked whether they ${s.ev}. The information in the table shown describes the survey.`,
]);
const TIMES: Record<number, string> = { 4: "four times", 9: "nine times" };
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0);

export const ITEM = defineItem({
  prefix: "ime", itemId: "inference_margin_error.sample_size_effect.ST.P",
  hard: [
    {
      op: "inverse", structure: "자료의 표본 크기·오차범위와 지문의 목표 오차범위로 필요한 새 표본 크기를 역산", extra: "오차범위를 1/k 로 줄이려면 표본 크기는 k² 배여야 함(k 배로 답하면 함정) — medium 은 표본 크기가 주어진 배수로 바뀔 때의 오차범위",
      concepts: ["오차범위와 표본 크기", "제곱근 반비례", "역산"],
      gen(rng) {
        const s = surv(rng); const k = rng.pick([2, 3, 4]); const m2 = rng.pick([1, 2, 3]) ; const mA = k * m2; if (mA > 12) throw new GenFail("m"); const nA = rng.pick([100, 150, 200, 250, 300, 400]); const ans = nA * k * k;
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [["Sample size", nA], ["Margin of error (percentage points)", mA]]);
        return figInst(rng, {
          stimulus: `${intro(rng, s)} The researchers plan a new survey of the same population with a margin of error of ${m2} percentage ${m2 === 1 ? "point" : "points"}. ${rng.pick(NOTES)}`,
          question: rng.pick(["What sample size should the new survey use?", "How many people should be in the sample for the new survey?"]), correct: ans,
          wrongs: pos([W(nA * k, "formula_misuse", "오차범위와 표본 크기가 반비례한다고 보았다."), W(Math.round(nA / (k * k)), "opposite", "표본 크기를 줄였다."), W(nA * k * k * k, "formula_misuse", "세제곱으로 늘렸다."), W(nA + (mA - m2) * 100, "other", "줄인 오차범위만큼 100씩 더했다."), W(nA * 2 * k, "formula_misuse", "2k 배로 늘렸다.")]).filter((w) => w.v !== ans && Number.isInteger(w.v)),
          verificationJs: figJs({ m2 }, fig, `${GET_JS}const r=g('margin of error')/P.m2; return g('sample size')*r*r;`),
          trace: [[`현재 오차범위는 ${mA}, 목표는 ${m2} 이다.`, "Current and target margins."], [`오차범위를 ${mA} ÷ ${m2} = ${k} 분의 1 로 줄여야 한다.`, "Factor of reduction."], ["오차범위는 √n 에 반비례하므로 √n 을 같은 배수만큼 키워야 한다.", "Margin ∝ 1/√n."], [`n 은 ${k}² = ${k * k} 배가 되어야 한다.`, "Square the factor."], [`새 표본 크기 = ${nA} × ${k * k} = ${ans} 이다.`, "New sample size."]], variant: "sample_size_for_target_margin",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 설문(A·B)의 표본 크기와 A 의 오차범위로 B 의 오차범위를 구함", extra: "두 표본 크기의 비를 구하고 그 제곱근으로 오차범위를 나눔(비를 그대로 쓰면 함정) — medium 은 배수가 지문에 주어짐",
      concepts: ["오차범위와 표본 크기", "제곱근 반비례", "두 설문 비교"],
      gen(rng) {
        const s = surv(rng); const k = rng.pick([2, 3, 4]); const big = rng.chance(0.6); const nA = rng.pick([100, 150, 200, 250]) * (big ? 1 : k * k); const nB = big ? nA * k * k : nA / (k * k);
        const mA = big ? rng.int(2, 6) * k : rng.int(1, 3); const mB = big ? mA / k : mA * k; if (!oneDec(mB) || nA > 3600) throw new GenFail("dec");
        const fig = factFig(`Two surveys of ${lcf(s.popLbl)}`, [["Survey A sample size", nA], ["Survey A margin of error (percentage points)", mA], ["Survey B sample size", nB]]);
        return figInst(rng, {
          stimulus: `${rng.pick([`Survey A and Survey B were each given to ${s.ent} selected at random from all ${lcf(s.popLbl)}, asking whether they ${s.ev}. The table shows information about the two surveys.`, `To study ${s.topic}, two random samples of ${lcf(s.popLbl)} were asked whether they ${s.ev}: one for Survey A and one for Survey B. Details are shown in the table.`, `The table shown describes Survey A and Survey B, two random-sample surveys of ${lcf(s.popLbl)} about ${s.topic}.`])} ${rng.pick(NOTES)}`,
          question: rng.pick(["What is the margin of error for Survey B, in percentage points?", "Based on the information shown, what margin of error, in percentage points, should Survey B have?"]), correct: mB, fmt: fmtNum,
          wrongs: pos([W(big ? mA / (k * k) : mA * k * k, "formula_misuse", "표본 크기 비를 제곱근 없이 썼다."), W(big ? mA * k : mA / k, "opposite", "표본이 클수록 오차범위가 크다고 보았다."), W(mA, "step_missing", "오차범위가 같다고 보았다."), W(big ? mA - k : mA + k, "other", "배수를 빼거나 더했다."), W(big ? mA / 2 : mA * 2, "other", "항상 2배로 바뀐다고 보았다.")]).filter((w) => w.v !== mB && oneDec(w.v)),
          verificationJs: figJs({}, fig, `${GET_JS}return g('survey a margin')*Math.sqrt(g('survey a sample size')/g('survey b sample size'));`),
          trace: [[`표본 크기: A ${nA}, B ${nB} 이다.`, "Read the sample sizes."], [`B 는 A 의 ${big ? k * k : `1/${k * k}`} 배이다.`, "Ratio of sample sizes."], ["오차범위는 √n 에 반비례한다.", "Margin ∝ 1/√n."], [`√${big ? k * k : `(1/${k * k})`} = ${big ? k : `1/${k}`} 이므로 오차범위는 ${big ? `1/${k}` : k} 배이다.`, "Square root of the ratio."], [`B 의 오차범위 = ${mA} × ${big ? `1/${k}` : k} = ${fmtNum(mB)} 이다.`, "Margin for Survey B."]], variant: "margin_from_size_ratio",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "두 설문의 응답 수(표본 크기·'예'·'아니오')를 읽어 어느 설문의 오차범위가 더 작은지와 그 이유를 서술 선지에서 고름", extra: "표본 크기(합)를 확인해 정밀도를 판단하고, 표본 %·'예' 수 같은 무관한 기준(함정)을 배제 — medium 은 오차범위 수치 계산",
      concepts: ["오차범위와 표본 크기", "표본 비율", "정밀도 판단 근거"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const s = surv(rng); const A = sampleCounts(rng, { nPool: [100, 200, 250, 400] }); const B = sampleCounts(rng, { nPool: [500, 600, 800] }); const sw = rng.chance(0.5); const [X, Y] = sw ? [B, A] : [A, B];
        const bigName = X.n > Y.n ? "A" : "B", smName = bigName === "A" ? "B" : "A"; const bigP = (bigName === "A" ? X : Y).p, smP = (bigName === "A" ? Y : X).p; if (bigP === smP) throw new GenFail("p");
       
        const fig = factFig(`Two surveys of ${lcf(s.popLbl)}`, [["Survey A sample size", X.n], ["Survey A number who said yes", X.yes], ["Survey A number who said no", X.no], ["Survey B sample size", Y.n], ["Survey B number who said yes", Y.yes], ["Survey B number who said no", Y.no]]);
        const t = rng.pick([
          { ok: "Survey #, because it has the larger sample size", pct: "Survey #, because it has the greater sample percent", same: "Neither, because both surveys sampled the same population", sm: "Survey #, because it has the smaller sample size" },
          { ok: "Survey #, since more people were sampled", pct: "Survey #, since a greater percent of its sample said yes", same: "Neither, since the margin of error depends only on the population", sm: "Survey #, since fewer people were sampled" },
        ]);
        const hiPct = bigP > smP ? bigName : smName;
        const correct = t.ok.replace("#", bigName) + ".";
        const wrongs = [{ text: t.sm.replace("#", smName) + ".", reason: "표본이 작을수록 정밀하다고 보았다." }, { text: t.pct.replace("#", hiPct) + ".", reason: "표본 %로 판단했다." }, { text: t.same + ".", reason: "같은 모집단이면 오차범위가 같다고 보았다." }];
        if (new Set([correct, ...wrongs.map((w) => w.text)]).size !== 4) throw new GenFail("dup");
        return statementInst(rng, {
          stimulus: `Survey A and Survey B each asked ${s.ent} selected at random from all ${lcf(s.popLbl)} whether they ${s.ev}. Both surveys used the same confidence level. The table shows the results.`,
          question: rng.pick(["Which survey is expected to have the smaller margin of error, and why?", "Which choice correctly identifies the survey whose estimate should have the smaller margin of error, with a correct reason?"]), correct, wrongs, figure: fig, P: { ok: t.ok },
          body: `${GET_JS}${sumJs(["survey a number who said yes", "survey a number who said no"], "survey a sample size")}${sumJs(["survey b number who said yes", "survey b number who said no"], "survey b sample size")}const a=g('survey a sample size'), b=g('survey b sample size'); if (a===b) throw new Error('같음'); const want=P.ok.replace('#', a>b?'A':'B')+'.'; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`설문 A 표본 = ${X.yes} + ${X.no} = ${X.n} 이다.`, "Sample size of Survey A."], [`설문 B 표본 = ${Y.yes} + ${Y.no} = ${Y.n} 이다.`, "Sample size of Survey B."], ["같은 신뢰수준에서 오차범위는 표본 크기가 클수록 작다.", "Larger samples give smaller margins."], ["표본 %나 '예' 응답 수는 오차범위 비교의 근거가 아니다.", "Sample percent is not the reason."], [`따라서 표본이 더 큰 설문 ${bigName} 의 오차범위가 더 작다.`, "Choose the larger sample."]], variant: "which_margin_smaller",
        });
      },
    },
    {
      op: "chain2", structure: "표본 크기가 지문의 배수만큼 커질 때 새 오차범위를 구하고, 같은 표본 %로 새 구간의 위(아래) 끝을 구함", extra: "표본 크기 배수 → 오차범위 배수(제곱근) → 응답 수의 표본 % 와 결합한 새 구간 끝의 연쇄 — medium 은 새 오차범위까지",
      concepts: ["오차범위와 표본 크기", "제곱근 반비례", "그럴듯한 구간"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no, p } = sampleCounts(rng, { pLo: 20, pHi: 75, nPool: [100, 200, 250, 300, 400] }); const K = rng.pick([4, 9]); const k = Math.sqrt(K); const m = rng.int(1, 4) * k; const m2 = m / k; const hi = rng.chance(0.5); const ans = hi ? p + m2 : p - m2;
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [["Sample size", n], ["Number in sample who said yes", yes], ["Number in sample who said no", no], ["Margin of error (percentage points)", m]]);
        return figInst(rng, {
          stimulus: `${intro(rng, s)} A second survey of the same population will use a sample ${TIMES[K]} as large and is expected to have the same sample percent. ${rng.pick(NOTES)}`,
          question: `What is the ${hi ? "upper" : "lower"} end, in percent, of the plausible interval from the second survey?`, correct: ans,
          wrongs: pos([W(hi ? p + m : p - m, "step_missing", "오차범위를 바꾸지 않았다."), W(hi ? p + m / K : p - m / K, "formula_misuse", "제곱근 없이 배수로 나눴다."), W(hi ? p - m2 : p + m2, "opposite", "반대쪽 끝을 구했다."), W(hi ? p + m * k : p - m * k, "opposite", "오차범위를 키웠다."), W(hi ? yes + m2 : yes - m2, "unit_error", "응답 수에 더했다.")]).filter((w) => w.v !== ans && oneDec(w.v)),
          verificationJs: figJs({ K }, fig, `${GET_JS}${sumJs(["said yes", "said no"], "sample size")}const p=100*g('said yes')/g('sample size'); const m2=g('margin of error')/Math.sqrt(P.K); return p${hi ? "+" : "-"}m2;`),
          trace: [[`표본 % = ${yes}/${n} = ${p}% 이다.`, "Sample percent."], [`표본 크기가 ${K} 배가 된다.`, "Factor for the sample size."], [`오차범위는 1/√${K} = 1/${k} 배가 된다.`, "Margin scales by 1/√K."], [`새 오차범위 = ${m} ÷ ${k} = ${fmtNum(m2)} 이다.`, "New margin."], [`${hi ? "위" : "아래"} 끝 = ${p} ${hi ? "+" : "-"} ${fmtNum(m2)} = ${fmtNum(ans)} 이다.`, "New endpoint."]], variant: "new_interval_after_bigger_sample",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "size_ratio", structure: "두 설문의 표본 크기 비를 구함", extra: "easy: 나눗셈", concepts: ["표본 크기", "오차한계와 표본 크기의 관계"],
      gen(rng) {
        const s = surv(rng); const nA = rng.pick([50, 100, 150, 200]); const K = rng.pick([2, 3, 4, 5, 6]); const nB = nA * K;
        const fig = factFig(`Two surveys of ${lcf(s.popLbl)}`, [["Survey A sample size", nA], ["Survey B sample size", nB]]);
        return figInst(rng, { stimulus: rng.pick([`Survey A and Survey B each asked a random sample of ${lcf(s.popLbl)} whether they ${s.ev}. The table shows the sample sizes.`, `Two surveys about ${s.topic} selected ${s.ent} at random. The sizes of the two samples are shown in the table.`, `The table shown gives the sample sizes for two random-sample surveys of ${lcf(s.popLbl)} on ${s.topic}.`]), question: "The sample for Survey B is how many times as large as the sample for Survey A?", correct: K, wrongs: pos([W(nB - nA, "formula_misuse", "차를 구했다."), W(K * K, "formula_misuse", "제곱했다."), W(K + 1, "other", "1 어긋났다."), W(K - 1, "other", "1 어긋났다.")]).filter((w) => w.v !== K),
          verificationJs: figJs({}, fig, `${GET_JS}return g('survey b sample size')/g('survey a sample size');`), trace: [[`A ${nA}, B ${nB} 이다.`, "Read the sizes."], [`${nB} ÷ ${nA} = ${K} 이다.`, "Divide."]], variant: "size_ratio" }, fig);
      },
    },
    {
      lv: "medium", name: "new_margin", structure: "표본 크기가 지문의 배수만큼 커질 때 새 오차범위를 구함", extra: "medium: 제곱근 반비례", concepts: ["오차범위와 표본 크기", "제곱근"],
      gen(rng) {
        const s = surv(rng); const n = rng.pick([100, 200, 300, 400]); const K = rng.pick([4, 9]); const k = Math.sqrt(K); const m = rng.int(1, 4) * k; const m2 = m / k;
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [["Sample size", n], ["Margin of error (percentage points)", m]]);
        return figInst(rng, { stimulus: `${intro(rng, s)} A new survey of the same population will use a sample ${TIMES[K]} as large. ${rng.pick(NOTES)}`, question: "What is the expected margin of error, in percentage points, for the new survey?", correct: m2, fmt: fmtNum, wrongs: pos([W(m / K, "formula_misuse", "제곱근 없이 나눴다."), W(m * k, "opposite", "오차범위를 키웠다."), W(m, "step_missing", "그대로 두었다."), W(m - k, "other", "배수를 뺐다.")]).filter((w) => w.v !== m2 && oneDec(w.v)),
          verificationJs: figJs({ K }, fig, `${GET_JS}return g('margin of error')/Math.sqrt(P.K);`), trace: [[`현재 오차범위 ${m} 이다.`, "Current margin."], [`√${K} = ${k} 이다.`, "Square root of the factor."], [`${m} ÷ ${k} = ${fmtNum(m2)} 이다.`, "New margin."]], variant: "new_margin" }, fig);
      },
    },
  ],
});
