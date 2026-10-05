// inference_margin_error.margin_interval.ST.P — 설문 정보(표본 응답 수·오차범위)를 '항목 | 값' 자료로 주고 그럴듯한 구간(표본 % ± 오차범위)을 만들고 해석한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { factFig, GET_JS, lcf, sampleCounts, sumJs, surv, type Surv } from "./_t7-kit";

const intro = (rng: Rng, s: Surv) => rng.pick([
  `A survey asked a random sample of ${s.ent} whether they ${s.ev}. The table shows information about the survey, including the margin of error for the sample percent.`,
  `Researchers chose ${s.ent} at random from all ${lcf(s.popLbl)} and asked whether they ${s.ev}. Details of the survey are shown in the table.`,
  `The table shown summarizes a survey about ${s.topic}. The ${s.ent} in the sample were selected at random from all ${lcf(s.popLbl)}.`,
  `For a study of ${s.topic}, a random sample of ${lcf(s.popLbl)} answered one yes-or-no question about whether they ${s.ev}. The information in the table shown describes the results.`,
]);
const baseRows = (n: number, yes: number, no: number, m: number): [string, number][] => [["Sample size", n], ["Number in sample who said yes", yes], ["Number in sample who said no", no], ["Margin of error (percentage points)", m]];
const P_JS = `${GET_JS}${sumJs(["said yes", "said no"], "sample size")}const p=100*g('said yes')/g('sample size'), m=g('margin of error');\n`;
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0);

export const ITEM = defineItem({
  prefix: "ime", itemId: "inference_margin_error.margin_interval.ST.P",
  hard: [
    {
      op: "inverse", structure: "자료가 그럴듯한 구간의 두 끝(%)만 줄 때 구간 중심(표본 %)을 복원해 표본에서 '예'라고 답한 사람 수를 역산", extra: "구간 = 표본 % ± 오차범위 를 거꾸로 써서 중심을 찾고 표본 크기로 사람 수를 복원 — medium 은 구간 끝 계산",
      concepts: ["그럴듯한 구간의 구조", "표본 비율", "역산"],
      gen(rng) {
        const s = surv(rng); const { n, yes, p } = sampleCounts(rng, { pLo: 15, pHi: 80 }); const m = rng.int(2, 7); const L = p - m, U = p + m; if (L <= 0) throw new GenFail("L");
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [["Sample size", n], ["Lower end of plausible interval (percent)", L], ["Upper end of plausible interval (percent)", U]]);
        return figInst(rng, {
          stimulus: `${intro(rng, s).replace(", including the margin of error for the sample percent", "")} The plausible interval for the percent of all ${lcf(s.popLbl)} who ${s.ev} was found as the sample percent plus or minus the margin of error.`,
          question: rng.pick([`How many ${s.ent} in the sample said yes?`, `Based on the information shown, what number of the ${s.ent} in the sample said yes?`]), correct: yes,
          wrongs: pos([W((n * L) / 100, "step_missing", "구간의 아래 끝을 표본 %로 보았다."), W((n * U) / 100, "step_missing", "구간의 위 끝을 표본 %로 보았다."), W(p, "unit_error", "표본 %를 사람 수로 답했다."), W((n * m) / 100, "formula_misuse", "오차범위를 사람 수로 바꿨다."), W(n - yes, "opposite", "'아니오' 수를 구했다.")]).filter((w) => Number.isInteger(w.v)),
          verificationJs: figJs({}, fig, `${GET_JS}const L=g('lower end'), U=g('upper end'); if (U<=L) throw new Error('구간 오류'); return g('sample size')*(L+U)/200;`),
          trace: [[`구간은 ${L}% ~ ${U}% 이다.`, "Read the interval."], ["구간은 표본 % ± 오차범위이므로 표본 %는 구간의 중심이다.", "The sample percent is the center."], [`표본 % = (${L} + ${U}) ÷ 2 = ${p}% 이다.`, "Center of the interval."], [`오차범위는 ${U} - ${p} = ${m} 퍼센트 포인트이다(확인).`, "Check the margin."], [`'예' 수 = ${n} × ${p}% = ${yes} 이다.`, "Convert to a count."]], variant: "count_from_interval_ends",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 설문(A·B)의 표본 %와 오차범위로 두 구간을 만들고 겹치는지로 '참 비율이 다르다는 근거' 여부를 판단", extra: "각 설문의 응답 수에서 표본 %를 구하고 두 구간의 겹침을 비교해 결론 문장을 고름(점추정치만 비교하면 함정) — medium 은 구간 하나",
      concepts: ["그럴듯한 구간", "두 구간의 겹침", "차이에 대한 근거"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const s = surv(rng); const A = sampleCounts(rng, { pLo: 20, pHi: 80 }); const B = sampleCounts(rng, { pLo: 20, pHi: 80 }); const mA = rng.int(2, 6), mB = rng.int(2, 6);
        if (A.p === B.p) throw new GenFail("same"); const sep = Math.abs(A.p - B.p) > mA + mB; if (Math.abs(Math.abs(A.p - B.p) - (mA + mB)) < 1) throw new GenFail("경계"); if (!sep && rng.chance(0.4)) throw new GenFail("균형");
        const hiName = A.p > B.p ? "A" : "B", loName = hiName === "A" ? "B" : "A";
        const fig = factFig(`Two surveys of ${lcf(s.popLbl)}`, [["Survey A sample size", A.n], ["Survey A number who said yes", A.yes], ["Survey A number who said no", A.no], ["Survey A margin of error (percentage points)", mA], ["Survey B sample size", B.n], ["Survey B number who said yes", B.yes], ["Survey B number who said no", B.no], ["Survey B margin of error (percentage points)", mB]]);
        const ev = s.ev; const ph = rng.pick([
          { over: `The plausible intervals overlap, so the surveys do not give convincing evidence that the true percents of ${s.ent} who ${ev} differ.`, sep: `The plausible intervals do not overlap, so there is convincing evidence that a greater percent of ${s.ent} ${ev} in Survey #'s population.`, pt: `Because Survey # has the greater sample percent, there is convincing evidence that more ${s.ent} ${ev} in its population, even though the intervals overlap.` },
          { over: `Since the two intervals share some values, the data do not show convincingly that the percents of ${s.ent} who ${ev} are different.`, sep: `Since the two intervals share no values, the data show convincingly that the percent of ${s.ent} who ${ev} is higher in Survey #'s population.`, pt: `Since Survey # has the higher sample percent, the data show convincingly that the percent of ${s.ent} who ${ev} is higher there, even though the intervals share values.` },
          { over: `The difference between the sample percents is small compared with the margins of error, so it is not clear that the percents of ${s.ent} who ${ev} differ.`, sep: `The sample percents differ by more than the two margins of error combined, so it is likely that more ${s.ent} ${ev} in Survey #'s population.`, pt: `Survey # has the larger sample percent, so it is certain that more ${s.ent} ${ev} in its population, regardless of the margins of error.` },
        ]);
        const L = (t: string, x: string) => t.replace("#", x);
        const correct = sep ? L(ph.sep, hiName) : ph.over;
        const wrongs = sep ? [{ text: ph.over, reason: "구간이 겹친다고 잘못 판단했다." }, { text: L(ph.sep, loName), reason: "어느 쪽이 큰지 반대로 읽었다." }, { text: L(ph.pt, hiName), reason: "구간을 보지 않고 점추정치만 비교했다." }] : [{ text: L(ph.sep, hiName), reason: "구간이 겹치는데 겹치지 않는다고 보았다." }, { text: L(ph.pt, hiName), reason: "점추정치의 차만 보고 근거가 있다고 했다." }, { text: L(ph.sep, loName), reason: "겹침과 방향을 모두 잘못 읽었다." }];
        return statementInst(rng, {
          stimulus: rng.pick([
            `Two independent surveys, Survey A and Survey B, each asked a random sample of ${s.ent} whether they ${s.ev}. The surveys were taken from two different populations of ${s.ent}. The table shows information about both surveys.`,
            `To compare ${s.topic} in two cities, Survey A and Survey B each selected ${s.ent} at random in one city and asked whether they ${s.ev}. Details of both surveys are shown in the table.`,
            `The table shown describes two surveys about ${s.topic}. Survey A sampled ${s.ent} at random from one population, and Survey B sampled ${s.ent} at random from a different population; each person was asked whether they ${s.ev}.`,
            `Researchers studying ${s.topic} ran Survey A and Survey B on two separate populations of ${s.ent}, choosing participants at random each time. The information about both surveys is shown in the table.`,
          ]),
          question: rng.pick(["Which statement is best supported by the information shown?", "Which conclusion about the two populations is most appropriate?"]), correct, wrongs, figure: fig, P: { over: ph.over, sep: ph.sep },
          body: `${GET_JS}const ck=(x)=>{ if (g('survey '+x+' number who said yes')+g('survey '+x+' number who said no')!==g('survey '+x+' sample size')) throw new Error('합 불일치'); return [100*g('survey '+x+' number who said yes')/g('survey '+x+' sample size'), g('survey '+x+' margin')]; };
const [pA,mA]=ck('a'), [pB,mB]=ck('b'); const hi = pA>pB?'A':'B';
const want = Math.abs(pA-pB) > mA+mB ? P.sep.replace('#', hi) : P.over;
const i = P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`설문 A: ${A.yes}/${A.n} = ${A.p}%, 구간 ${A.p - mA}% ~ ${A.p + mA}% 이다.`, "Interval for Survey A."], [`설문 B: ${B.yes}/${B.n} = ${B.p}%, 구간 ${B.p - mB}% ~ ${B.p + mB}% 이다.`, "Interval for Survey B."], [`두 표본 %의 차는 ${Math.abs(A.p - B.p)} 이고 오차범위의 합은 ${mA + mB} 이다.`, "Compare the gap with the margins."], [sep ? "차가 오차범위의 합보다 커서 두 구간이 겹치지 않는다." : "차가 오차범위의 합보다 작아 두 구간이 겹친다.", "Do the intervals overlap?"], [sep ? `겹치지 않으므로 설문 ${hiName} 쪽 참 비율이 더 크다는 근거가 있다.` : "겹치므로 참 비율이 다르다는 확실한 근거가 없다.", "State the conclusion."]], variant: "overlap_of_two_intervals",
        });
      },
    },
    {
      op: "constraint_select", structure: "표본 %와 오차범위로 구간을 만들고 질문의 주장값 C% 가 그 안에 드는지로 주장의 그럴듯함을 판단", extra: "응답 수 → 표본 % → 구간 → 주장값 대조의 연쇄, 구간 밖이면 '그럴듯하지 않음'(구간이 참값의 확정 범위가 아님에 유의) — medium 은 구간 끝",
      concepts: ["표본 비율", "그럴듯한 구간", "주장의 평가"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const s = surv(rng); const { n, yes, no, p } = sampleCounts(rng, { pLo: 20, pHi: 75 }); const m = rng.int(2, 6); const inside = rng.chance(0.5);
        const C = inside ? p + rng.pick([-1, 1]) * rng.int(0, m - 1) : p + rng.pick([-1, 1]) * (m + rng.int(2, 6)); if (C === p || C <= 0 || C >= 100) throw new GenFail("C");
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, baseRows(n, yes, no, m));
        const ok = `Yes, because ${C} percent is within the plausible interval.`, notOk = `No, because ${C} percent is outside the plausible interval.`;
        const wrongs = inside
          ? [{ text: notOk, reason: "구간을 잘못 만들었다." }, { text: `No, because the true percent must equal the sample percent exactly.`, reason: "표본 %를 참값으로 보았다." }, { text: `Yes, because any value from 0 to 100 percent is plausible.`, reason: "구간을 쓰지 않았다." }]
          : [{ text: ok, reason: "구간을 잘못 만들었다." }, { text: `Yes, because the sample percent is within ${m} points of every plausible value.`, reason: "오차범위의 뜻을 뒤집었다." }, { text: `No, because a survey can never support any claim about all ${lcf(s.popLbl)}.`, reason: "무작위 표본의 추론 자체를 부정했다." }];
        return statementInst(rng, {
          stimulus: intro(rng, s), question: `A news report claims that ${C} percent of all ${lcf(s.popLbl)} ${s.ev}. Is this claim plausible based on the survey?`, correct: inside ? ok : notOk, wrongs, figure: fig, P: { C },
          body: `${P_JS}const inside = P.C >= p - m && P.C <= p + m; const want = inside ? 'Yes, because '+P.C+' percent is within the plausible interval.' : 'No, because '+P.C+' percent is outside the plausible interval.'; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`표본 % = ${yes}/${n} = ${p}% 이다.`, "Sample percent."], [`오차범위 ${m} 퍼센트 포인트를 더하고 뺀다.`, "Use the margin of error."], [`그럴듯한 구간은 ${p - m}% ~ ${p + m}% 이다.`, "Plausible interval."], [`주장값 ${C}% 는 구간 ${inside ? "안" : "밖"}에 있다.`, "Compare the claim with the interval."], [inside ? "따라서 주장은 그럴듯하다." : "따라서 주장은 그럴듯하지 않다.", "Conclusion."]], variant: "claim_inside_interval",
        });
      },
    },
    {
      op: "chain2", structure: "'예' 비율의 구간을 '아니오' 비율의 구간으로 바꾸고, 그 구간 끝을 모집단 사람 수로 환산", extra: "보수(100 - %)를 취하면 구간의 위·아래 끝이 뒤바뀌는 점과 모집단 환산을 연결 — medium 은 '예' 구간 끝",
      concepts: ["그럴듯한 구간", "여사건 비율", "모집단 추정"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no, p } = sampleCounts(rng, { pLo: 20, pHi: 75 }); const m = rng.int(2, 6); const hi = rng.chance(0.5); const N = rng.int(12, 96) * 100;
        const q = hi ? 100 - p + m : 100 - p - m; const ans = (N * q) / 100; if (!Number.isInteger(ans)) throw new GenFail("int");
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [[`Total number of ${lcf(s.popLbl)}`, N], ...baseRows(n, yes, no, m)]);
        return figInst(rng, {
          stimulus: `${intro(rng, s)} Each person in the sample said either yes or no.`,
          question: `Based on the survey, what is the ${hi ? "greatest" : "least"} plausible number of ${lcf(s.popLbl)} who would say no?`, correct: ans,
          wrongs: pos([W((N * (hi ? p + m : p - m)) / 100, "opposite", "'예' 구간의 끝을 썼다."), W((N * (hi ? 100 - p - m : 100 - p + m)) / 100, "opposite", "구간의 반대쪽 끝을 썼다."), W((N * (100 - p)) / 100, "step_missing", "오차범위를 쓰지 않았다."), W((n * q) / 100, "scope", "표본 크기로 환산했다."), W((N * (hi ? 100 - p + 2 * m : 100 - p - 2 * m)) / 100, "formula_misuse", "오차범위를 두 번 적용했다.")]).filter((w) => Number.isInteger(w.v)),
          verificationJs: figJs({}, fig, `${P_JS}return g('total number')*(100-p${hi ? "+" : "-"}m)/100;`),
          trace: [[`표본 % ('예') = ${yes}/${n} = ${p}% 이다.`, "Sample percent for yes."], [`'아니오' 표본 % = 100 - ${p} = ${100 - p}% 이다.`, "Sample percent for no."], [`'아니오' 구간은 ${100 - p - m}% ~ ${100 - p + m}% 이다.`, "Interval for no."], [`${hi ? "최댓값" : "최솟값"}은 ${q}% 이다.`, "Choose the endpoint."], [`${N} × ${q}% = ${ans} 이다.`, "Convert to a count."]], variant: "complement_interval_count",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "upper_end", structure: "표본 %와 오차범위로 구간의 위 끝을 구함", extra: "easy: % + 오차범위", concepts: ["그럴듯한 구간", "표본 비율 ± 오차한계"],
      gen(rng) {
        const s = surv(rng); const { n, p } = sampleCounts(rng, { pLo: 15, pHi: 85 }); const m = rng.int(2, 7);
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, [["Sample size", n], ["Percent in sample who said yes", p], ["Margin of error (percentage points)", m]]);
        return figInst(rng, { stimulus: intro(rng, s), question: `What is the upper end, in percent, of the plausible interval for the percent of all ${lcf(s.popLbl)} who ${s.ev}?`, correct: p + m, wrongs: pos([W(p - m, "opposite", "아래 끝을 구했다."), W(p, "step_missing", "오차범위를 더하지 않았다."), W(p + 2 * m, "formula_misuse", "오차범위를 두 번 더했다."), W(2 * m, "other", "구간의 폭을 답했다.")]).filter((w) => w.v !== p + m),
          verificationJs: figJs({}, fig, `${GET_JS}return g('percent in sample') + g('margin of error');`), trace: [[`표본 % ${p}, 오차범위 ${m} 이다.`, "Read the values."], [`위 끝 = ${p} + ${m} = ${p + m} 이다.`, "Add the margin."]], variant: "upper_end" }, fig);
      },
    },
    {
      lv: "medium", name: "lower_end_from_counts", structure: "응답 수로 표본 %를 구한 뒤 구간의 아래 끝을 구함", extra: "medium: 수 → % → 끝", concepts: ["표본 비율", "그럴듯한 구간"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no, p } = sampleCounts(rng, { pLo: 15, pHi: 85 }); const m = rng.int(2, 7);
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, baseRows(n, yes, no, m));
        return figInst(rng, { stimulus: intro(rng, s), question: `What is the lower end, in percent, of the plausible interval for the percent of all ${lcf(s.popLbl)} who ${s.ev}?`, correct: p - m, wrongs: pos([W(p + m, "opposite", "위 끝을 구했다."), W(p, "step_missing", "오차범위를 빼지 않았다."), W(yes - m, "unit_error", "응답 수에서 뺐다."), W(100 - p - m, "opposite", "'아니오' 비율을 썼다.")]).filter((w) => w.v !== p - m),
          verificationJs: figJs({}, fig, `${P_JS}return p - m;`), trace: [[`표본 % = ${yes}/${n} = ${p}% 이다.`, "Sample percent."], [`오차범위는 ${m} 이다.`, "Margin."], [`아래 끝 = ${p} - ${m} = ${p - m} 이다.`, "Subtract the margin."]], variant: "lower_end_from_counts" }, fig);
      },
    },
  ],
});
