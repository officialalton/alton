// inference_margin_error.population_estimate.ST.P — 설문 정보(모집단 크기·표본 크기·응답 수)를 '항목 | 값' 자료로 주고 표본 비율로 모집단 수를 추정한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { factFig, GET_JS, lcf, sampleCounts, sumJs, surv, type Surv } from "./_t7-kit";

const popRow = (s: Surv) => `Total number of ${lcf(s.popLbl)}`;
const intro = (rng: Rng, s: Surv) => rng.pick([
  `A survey asked a random sample of ${s.ent} whether they ${s.ev}. The table shows information about the survey.`,
  `To learn about ${s.topic}, researchers selected ${s.ent} at random and asked whether they ${s.ev}. Details of the survey are shown in the table.`,
  `The table shown summarizes a survey about ${s.topic}. The ${s.ent} in the sample were chosen at random from all ${lcf(s.popLbl)}, and each was asked whether they ${s.ev}.`,
  `A random sample of ${lcf(s.popLbl)} took part in a survey on ${s.topic}. The information in the table shown describes the survey and its results.`,
]);
/** 모집단 크기 N: 추정치 N·yes/n 이 정수가 되게. */
function popSize(rng: Rng, n: number, part: number, lo = 1200, hi = 9600): number {
  for (let t = 0; t < 60; t++) { const N = rng.int(lo / 100, hi / 100) * 100; if ((N * part) % n === 0) return N; }
  throw new GenFail("모집단 크기 표집 실패");
}
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isInteger(w.v));

export const ITEM = defineItem({
  prefix: "ime", itemId: "inference_margin_error.population_estimate.ST.P",
  hard: [
    {
      op: "repr_shift", structure: "자료에 '아니오'·'미정' 응답 수와 표본 크기만 있을 때 '예' 응답 수를 먼저 구하고 그 비율로 모집단 수를 추정", extra: "표본의 '예' 수를 표본 크기에서 다른 응답을 빼 복원한 뒤 비율 → 모집단 배율 — medium 은 '예' 수가 바로 주어짐",
      concepts: ["표본 비율", "모집단 추정", "응답 범주의 합 = 표본 크기"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no } = sampleCounts(rng, { pLo: 20, pHi: 70 }); const und = rng.int(1, Math.floor(no / 3)); const no2 = no - und; if (no2 <= 0) throw new GenFail("no");
        const N = popSize(rng, n, yes); const est = (N * yes) / n;
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [[popRow(s), N], ["Sample size", n], ["Number in sample who said no", no2], ["Number in sample who were undecided", und]]);
        return figInst(rng, {
          stimulus: intro(rng, s) + ` Each person in the sample answered yes, no, or undecided to the question of whether they ${s.ev}.`,
          question: rng.pick([`Based on the survey, what is the best estimate of the number of ${lcf(s.popLbl)} who ${s.ev}?`, `Using the information shown, estimate how many of all ${lcf(s.popLbl)} ${s.ev}.`]), correct: est,
          wrongs: pos([W((N * no2) / n, "step_missing", "'아니오' 비율로 추정했다."), W((N * (no2 + und)) / n, "opposite", "'예'가 아닌 응답의 추정치를 답했다."), W(yes, "scope", "표본의 '예' 수를 그대로 답했다."), W((N * (n - no2)) / n, "condition_ignored", "미정 응답을 '예'에 넣었다."), W(est + N / 100, "other", "비율을 1% 크게 잡았다.")]),
          verificationJs: figJs({}, fig, `${GET_JS}const n=g('sample size'), y=n-g('said no')-g('undecided'); if (y<=0) throw new Error('예 응답 없음'); return g('total number')*y/n;`),
          trace: [[`표본 크기 ${n} 에서 '아니오' ${no2} 와 '미정' ${und} 을 뺀다.`, "Remove the other responses from the sample size."], [`'예' 응답 수는 ${n} - ${no2} - ${und} = ${yes} 이다.`, "Number of yes responses."], [`표본 비율은 ${yes}/${n} = ${fmtNum((100 * yes) / n)}% 이다.`, "Sample proportion."], ["무작위 표본이므로 이 비율을 모집단에 적용한다.", "Apply the sample proportion to the population."], [`${N} × ${yes}/${n} = ${est} 이다.`, "Estimate for the population."]], variant: "estimate_from_complement_counts",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 선택지(Plan A·B) 응답 수로 각 선택의 모집단 추정치를 구하고 둘의 차를 구함", extra: "두 비율을 모두 모집단으로 확대해 차를 구함(표본 수의 차를 그대로 답하면 오답) — medium 은 하나의 추정치",
      concepts: ["표본 비율", "모집단 추정", "두 추정치의 비교"],
      gen(rng) {
        const s = surv(rng); const { n, yes: a, no: b } = sampleCounts(rng, { pLo: 52, pHi: 85 }); const N = popSize(rng, n, a - b); const ea = (N * a) / n, eb = (N * b) / n; const d = ea - eb; if (!Number.isInteger(ea)) throw new GenFail("ea");
        const fig = factFig(`Plan preference survey of ${lcf(s.popLbl)}`, [[popRow(s), N], ["Sample size", n], ["Number in sample who chose Plan A", a], ["Number in sample who chose Plan B", b]]);
        return figInst(rng, {
          stimulus: rng.pick([
            `Leaders are choosing between Plan A and Plan B for ${s.topic}. A random sample of ${lcf(s.popLbl)} was asked to choose one plan, and every person in the sample chose exactly one plan. The table shows information about the survey.`,
            `Two plans, Plan A and Plan B, have been proposed for ${s.topic}. Researchers asked ${s.ent} selected at random to pick the plan they prefer; each of them picked one plan. Details are shown in the table.`,
            `The table shown describes a poll about ${s.topic}. ${s.ent.charAt(0).toUpperCase() + s.ent.slice(1)} were chosen at random from all ${lcf(s.popLbl)} and asked whether they prefer Plan A or Plan B, and each one named a single plan.`,
            `To decide between Plan A and Plan B for ${s.topic}, organizers surveyed a random sample of ${s.ent}. No one in the sample chose both plans or neither plan. The table summarizes the results.`,
          ]),
          question: rng.pick([`Based on the survey, about how many more of all ${lcf(s.popLbl)} are estimated to prefer Plan A than Plan B?`, `Using the table, what is the estimated difference between the number of ${lcf(s.popLbl)} who prefer Plan A and the number who prefer Plan B?`]), correct: d,
          wrongs: pos([W(a - b, "scope", "표본 수의 차를 답했다."), W(ea, "step_missing", "Plan A 추정치만 답했다."), W((N * (a - b)) / 100, "formula_misuse", "응답 수의 차를 백분율로 보았다."), W(ea + eb === N ? eb : eb + 1, "opposite", "Plan B 추정치를 답했다."), W(d / 2, "other", "차를 반으로 나눴다.")]),
          verificationJs: figJs({}, fig, `${GET_JS}${sumJs(["plan a", "plan b"], "sample size")}return g('total number')*(g('plan a')-g('plan b'))/g('sample size');`),
          trace: [[`표본 ${n} 명 중 Plan A ${a}, Plan B ${b} 이다(합 = 표본 크기).`, "Read the counts; they add to the sample size."], [`Plan A 비율 ${a}/${n}, Plan B 비율 ${b}/${n} 이다.`, "Two sample proportions."], [`Plan A 추정치 = ${N} × ${a}/${n} = ${fmtNum(ea)} 이다.`, "Estimate for Plan A."], [`Plan B 추정치 = ${N} × ${b}/${n} = ${fmtNum(eb)} 이다.`, "Estimate for Plan B."], [`차 = ${fmtNum(ea)} - ${fmtNum(eb)} = ${fmtNum(d)} 이다.`, "Difference of the estimates."]], variant: "difference_of_two_estimates",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "표본 정보와 지문의 모집단 추정치 E 로 모집단 전체 크기를 역산", extra: "추정치 = N × 표본 비율을 N 에 대해 거꾸로 풀어야 함 — medium 은 N 이 주어져 추정치를 구함",
      concepts: ["표본 비율", "모집단 추정의 역산", "비례식"],
      gen(rng) {
        const s = surv(rng); let n = 0, yes = 0, no = 0, N = 0, E = 0;
        for (let t = 0; t < 80 && !E; t++) { ({ n, yes, no } = sampleCounts(rng, { pLo: 10, pHi: 40 })); try { N = popSize(rng, n, yes, 1200, 2400); } catch { continue; } const e = (N * yes) / n; if (e <= 999 && e >= 10) E = e; }
        if (!E) throw new GenFail("E 범위");
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [["Sample size", n], ["Number in sample who said yes", yes], ["Number in sample who said no", no]]);
        return figInst(rng, {
          stimulus: `${intro(rng, s)} Based on the survey, the estimated number of ${lcf(s.popLbl)} who ${s.ev} is ${E}.`,
          question: rng.pick([`What is the total number of ${lcf(s.popLbl)}?`, `Based on this estimate, how many ${lcf(s.popLbl)} are there in all?`]), correct: N,
          wrongs: pos([W((E * yes) / n, "formula_misuse", "비율을 곱했다(나눠야 함)."), W((E * n) / no, "step_missing", "'아니오' 수로 나눴다."), W(E + n, "other", "추정치에 표본 크기를 더했다."), W(E * 100 / yes, "formula_misuse", "'예' 수를 백분율로 보았다."), W(N - E, "opposite", "'예'가 아닌 사람 수를 구했다.")]),
          verificationJs: figJs({ E }, fig, `${GET_JS}${sumJs(["said yes", "said no"], "sample size")}return P.E*g('sample size')/g('said yes');`),
          trace: [[`표본에서 '예'는 ${yes}/${n} 이다(합 확인 ${yes} + ${no} = ${n}).`, "Sample proportion."], ["추정치 = 전체 수 × 표본 비율 이다.", "Estimate = total × proportion."], [`${E} = N × ${yes}/${n} 이다.`, "Set up the equation."], [`N = ${E} × ${n} ÷ ${yes} 이다.`, "Solve for N."], [`N = ${N} 이다.`, "Total population."]], variant: "population_from_estimate",
        }, fig);
      },
    },
    {
      op: "compose_kind", structure: "표본 비율로 모집단 추정치를 구하고 자료의 오차범위를 더해 모집단 수의 그럴듯한 최댓값(또는 최솟값)을 구함", extra: "비율 추정과 오차범위(백분율 포인트)를 결합해 구간 끝을 모집단 수로 환산 — medium 은 점추정치만",
      concepts: ["표본 비율", "오차범위", "모집단 추정"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no, p } = sampleCounts(rng, { pLo: 20, pHi: 75 }); const m = rng.int(2, 6); const hi = rng.chance(0.5); const q = hi ? p + m : p - m;
        const N = rng.int(12, 96) * 100; const ans = (N * q) / 100; if (!Number.isInteger(ans)) throw new GenFail("ans");
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [[popRow(s), N], ["Sample size", n], ["Number in sample who said yes", yes], ["Number in sample who said no", no], ["Margin of error (percentage points)", m]]);
        return figInst(rng, {
          stimulus: intro(rng, s),
          question: `Based on the sample percent and the margin of error, what is the ${hi ? "greatest" : "least"} plausible number of ${lcf(s.popLbl)} who ${s.ev}?`, correct: ans,
          wrongs: pos([W((N * p) / 100, "step_missing", "오차범위를 쓰지 않았다."), W((N * (hi ? p - m : p + m)) / 100, "opposite", "반대쪽 끝을 구했다."), W((N * p) / 100 + (hi ? m : -m), "unit_error", "오차범위를 사람 수로 더했다."), W(yes + (hi ? m : -m), "scope", "표본 수에 오차범위를 더했다."), W((N * (hi ? p + 2 * m : p - 2 * m)) / 100, "formula_misuse", "오차범위를 두 번 적용했다.")]),
          verificationJs: figJs({}, fig, `${GET_JS}${sumJs(["said yes", "said no"], "sample size")}const p=100*g('said yes')/g('sample size'); return g('total number')*(p${hi ? "+" : "-"}g('margin of error'))/100;`),
          trace: [[`표본 비율 = ${yes}/${n} = ${p}% 이다.`, "Sample percent."], [`오차범위는 ${m} 퍼센트 포인트이다.`, "Margin of error."], [`그럴듯한 구간은 ${p - m}% ~ ${p + m}% 이다.`, "Plausible interval."], [`${hi ? "최댓값" : "최솟값"}은 ${q}% 를 쓴다.`, "Choose the needed endpoint."], [`${N} × ${q}% = ${ans} 이다.`, "Convert to a count."]], variant: "interval_endpoint_count",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "sample_percent", structure: "표본 크기와 '예' 응답 수로 표본 백분율을 구함", extra: "easy: 비율 → 백분율", concepts: ["표본 비율", "비율 → 백분율"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no, p } = sampleCounts(rng);
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [["Sample size", n], ["Number in sample who said yes", yes], ["Number in sample who said no", no]]);
        return figInst(rng, { stimulus: intro(rng, s), question: `What percent of the ${s.ent} in the sample said yes?`, correct: p, wrongs: pos([W(100 - p, "opposite", "'아니오' 백분율을 답했다."), W(yes, "unit_error", "응답 수를 답했다."), W(p + 10, "other", "계산 중 어긋났다."), W(Math.round((100 * yes) / (n + yes)), "formula_misuse", "분모를 잘못 잡았다.")]).filter((w) => w.v !== p),
          verificationJs: figJs({}, fig, `${GET_JS}${sumJs(["said yes", "said no"], "sample size")}return 100*g('said yes')/g('sample size');`), trace: [[`'예' ${yes}, 표본 ${n} 이다.`, "Read the counts."], [`${yes}/${n} = ${p}% 이다.`, "Convert to a percent."]], variant: "sample_percent" }, fig);
      },
    },
    {
      lv: "medium", name: "point_estimate", structure: "표본 비율을 모집단 크기에 곱해 모집단 수를 추정", extra: "medium: 비율 × 모집단", concepts: ["표본 비율", "모집단 추정"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no } = sampleCounts(rng); const N = popSize(rng, n, yes); const est = (N * yes) / n;
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [[popRow(s), N], ["Sample size", n], ["Number in sample who said yes", yes], ["Number in sample who said no", no]]);
        return figInst(rng, { stimulus: intro(rng, s), question: `Based on the survey, what is the best estimate of the number of ${lcf(s.popLbl)} who ${s.ev}?`, correct: est, wrongs: pos([W(yes, "scope", "표본 수를 답했다."), W(N - est, "opposite", "'아니오' 추정치를 답했다."), W((N * yes) / 100, "formula_misuse", "응답 수를 백분율로 보았다."), W(est + N / 100, "other", "1% 어긋났다.")]).filter((w) => w.v !== est),
          verificationJs: figJs({}, fig, `${GET_JS}${sumJs(["said yes", "said no"], "sample size")}return g('total number')*g('said yes')/g('sample size');`), trace: [[`표본 비율 ${yes}/${n} 이다.`, "Sample proportion."], ["무작위 표본이므로 모집단에 적용한다.", "Apply to the population."], [`${N} × ${yes}/${n} = ${est} 이다.`, "Estimate."]], variant: "point_estimate" }, fig);
      },
    },
  ],
});
