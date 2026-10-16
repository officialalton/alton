// inference_margin_error(카탈로그 밖 세부 패턴 3개 제안) — hard 원형 12개(population_estimate·margin_interval·sample_size_effect × 4) + easy 2 + medium 3 원형.
// kind-catalog.ts 에는 컴파일러가 이 세부 패턴을 지원할 때 함께 추가한다(문서 14절). 여기서는 원형 전용 kind 로만 쓴다.
import { GenFail, type Archetype } from "../types";
import { facts, spin, withParams, fmtNum } from "../text";
import { gcd } from "../rng";
import { asLevel, withBind, type LArch } from "../levels-d";
import { W, DATA_CTX, fin as finish } from "./d-kit";
import type { Rng } from "../rng";

const SKILL = "inference_margin_error";
const ctx = (rng: Rng) => DATA_CTX[rng.int(0, DATA_CTX.length - 1)];
type Surv = { pop: string; popS: string; ev: string; evP: string };
const SURVEYS: Surv[] = [
  { pop: "residents", popS: "resident", ev: "support building a new library", evP: "support the new library" },
  { pop: "students", popS: "student", ev: "ride the bus to school", evP: "ride the bus" },
  { pop: "customers", popS: "customer", ev: "prefer online shopping", evP: "prefer online shopping" },
  { pop: "employees", popS: "employee", ev: "work remotely at least one day a week", evP: "work remotely weekly" },
  { pop: "voters", popS: "voter", ev: "favor the ballot measure", evP: "favor the measure" },
  { pop: "members", popS: "member", ev: "attend the monthly meeting", evP: "attend the monthly meeting" },
  { pop: "households", popS: "household", ev: "recycle every week", evP: "recycle weekly" },
  { pop: "commuters", popS: "commuter", ev: "use public transit", evP: "use public transit" },
  { pop: "teachers", popS: "teacher", ev: "use the new software", evP: "use the new software" },
  { pop: "patients", popS: "patient", ev: "are satisfied with the clinic", evP: "are satisfied with the clinic" },
  { pop: "residents", popS: "resident", ev: "own a bicycle", evP: "own a bicycle" },
  { pop: "visitors", popS: "visitor", ev: "would return next year", evP: "would return" },
];
const sv = (rng: Rng) => rng.pick(SURVEYS);
const REL = ["Assume that the margin of error is inversely proportional to the square root of the sample size.", "The margin of error is inversely proportional to the square root of the sample size.", "Assume the margin of error varies inversely with the square root of the sample size.", "In this kind of poll, the margin of error is inversely proportional to $\\sqrt{n}$, where $n$ is the sample size.", "Suppose the margin of error varies inversely as the square root of the number of people sampled."];
const INTRO = ["", "", "A polling firm is planning a set of surveys. ", "A research group compares several opinion polls. ", "A city office is reviewing the results of some polls. ", "A news organization reports on a set of surveys. ", "An analyst studies how precise a poll is. ", "A student is learning about margins of error. "];
const intro = (rng: Rng) => INTRO[rng.int(0, INTRO.length - 1)];
const pc = (v: number) => `${fmtNum(v)}%`;

export const IME_HARD: Archetype[] = [
  // ───────── population_estimate ─────────
  {
    id: "ime.population_estimate.unit_ratio", skill: SKILL, kind: "population_estimate", operator: "unit_ratio",
    structure: "'타(12개)' 단위로 주어진 전체 수량에서 표본 비율로 불량 개수를 추정하고 개수 단위로 환산",
    extraThinking: "표본 비율을 모집단에 적용하기 전에 모집단의 단위(타 = 12개)를 개수로 환산해야 하는 단위·비율 결합 — medium 은 표본 비율을 모집단 수에 곱하는 한 단계",
    concepts: ["표본 비율의 일반화", "단위 환산(타 → 개)", "비례 추정"], mediumSteps: 2,
    generate(rng) {
      const [item, bad] = rng.pick([["eggs", "cracked"], ["light bulbs", "defective"], ["apples", "bruised"], ["pens", "leaking"], ["tiles", "chipped"], ["mugs", "flawed"]]); const n = rng.pick([20, 25, 30, 40, 50, 60]); const c = rng.int(2, Math.floor(n / 3)); const D = rng.int(5, 90);
      const est = (12 * D * c) / n; if (!Number.isInteger(est) || est > 999 || gcd(c, n) === n) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A shipment contains ${D} dozen ${item}.`, `A warehouse receives a shipment of ${D} dozen ${item}.`, `One order consists of ${D} dozen ${item}.`], [`An inspector randomly selects ${n} of the ${item} and finds that ${c} are ${bad}.`, `In a random sample of ${n} ${item} from the shipment, ${c} turned out to be ${bad}.`, `A random sample of ${n} ${item} is checked, and ${c} of them are ${bad}.`]]),
        question: spin(rng, `[[Based on the sample, about how many of the ${item} in the whole shipment are expected to be ${bad}?|What is the best estimate of the number of ${bad} ${item} in the entire shipment?|Using the sample, estimate how many ${item} in the shipment are ${bad}.]]`), correct: est,
        wrongs: [W((D * c) / n, "unit_error", "타(12개)를 개수로 환산하지 않고 D 를 그대로 썼다."), W(Math.round((D * c * 12) / (n + 12)), "formula_misuse", "표본 크기에 12 를 더해 나눴다."), W(Math.round(est / 12), "unit_error", "환산 방향(곱/나눔)을 거꾸로 적용했다."), W(c * 12, "step_missing", "표본의 불량 개수에 12 만 곱했다."), W(est + 12, "other", "계산 중 12 어긋났다.")],
        verificationJs: withParams({ D, n, c }, "const total=P.D*12; return total*P.c/P.n;"),
        trace: [[`${D} 타 = ${D} × 12 = ${12 * D} 개이다.`, "Convert dozens to a count."], [`표본에서 불량 비율 = ${c}/${n} 이다.`, "Sample proportion."], [`표본이 무작위이므로 전체에도 같은 비율을 적용한다.`, "A random sample supports the generalization."], [`추정 개수 = ${12 * D} × ${c}/${n} 이다.`, "Apply the proportion."], [`추정값은 ${est} 이다.`, "Compute."]], variant: "dozen_to_count" }), [{ noun: ["shipment", "order"], value: D }, { noun: ["random sample", "randomly selects"], value: n }]);
    },
  },
  {
    id: "ime.population_estimate.inverse", skill: SKILL, kind: "population_estimate", operator: "inverse",
    structure: "표본 비율과 전체에서의 추정 인원이 주어질 때 비례식을 거꾸로 풀어 모집단 크기를 구함",
    extraThinking: "추정값이 표본 비율 × 모집단이라는 관계를 역으로 풀어(나눗셈) 모집단을 복원 — medium 은 표본 비율을 모집단에 곱하는 정방향",
    concepts: ["표본 비율의 일반화", "비례식 역산", "추정"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const n = rng.pick([40, 50, 60, 80, 100, 120, 150, 200]); const c = rng.int(5, Math.floor(n * 0.7)); const pop = rng.pick([300, 400, 500, 600, 800, 900, 450, 750]); const est = (pop * c) / n; if (!Number.isInteger(est) || est > 900 || c === n || est === n) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`In a random sample of ${n} ${s.pop}, ${c} ${s.ev}.`, `A random sample of ${n} ${s.pop} was surveyed, and ${c} of them ${s.ev}.`, `Of ${n} randomly selected ${s.pop}, ${c} ${s.ev}.`], [`Based on this sample, it is estimated that ${est} ${s.pop} in the whole group ${s.ev}.`, `The sample is used to estimate that ${est} of all the ${s.pop} ${s.ev}.`, `This leads to an estimate of ${est} ${s.pop} in the entire group who ${s.ev}.`]]),
        question: spin(rng, `[[How many ${s.pop} are in the whole group?|What is the total number of ${s.pop} in the group being estimated?|According to the estimate, how large is the whole group of ${s.pop}?]]`), correct: pop,
        wrongs: [W(est, "other", "추정 인원을 그대로 답했다."), W(Math.round((est * c) / n), "formula_misuse", "비율을 거꾸로 곱했다."), W(Math.round(est + n), "formula_misuse", "표본 크기를 더했다."), W(Math.round((est * (n - c)) / n) === pop ? pop + 50 : Math.round((est * (n - c)) / n), "formula_misuse", "반대 비율로 계산했다."), W(pop + 100, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ n, c, est }, "let out=null;\nfor(let N=1;N<=5000;N++){ if(N*P.c===P.est*P.n) out=N; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`표본 비율 = ${c}/${n} 이다.`, "Sample proportion."], [`추정 인원 = 전체 × ${c}/${n} 이므로 ${est} = N × ${c}/${n} 이다.`, "Write the proportional relation."], [`N = ${est} × ${n}/${c} 이다.`, "Solve for N."], [`N = ${pop} 이다.`, "Compute."], [`${pop} × ${c}/${n} = ${est} 로 검산한다.`, "Verify."]], variant: "estimate_to_population" }), [{ noun: ["random sample", "randomly selected"], value: n }]);
    },
  },
  {
    id: "ime.population_estimate.chain2", skill: SKILL, kind: "population_estimate", operator: "chain2",
    structure: "표본에서 첫 집단의 비율을 모집단에 적용해 인원을 구하고, 그 집단 안의 두 번째 비율을 다시 적용",
    extraThinking: "한 번 추정한 하위 집단 인원을 다음 비율의 기준(모집단)으로 쓰는 2단계 연쇄(기준이 바뀌는 비율) — medium 은 한 번의 표본→모집단 추정",
    concepts: ["표본 비율의 일반화", "조건부 비율", "2단계 추정"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const n = rng.pick([50, 100, 200, 250]); const c1 = (n * rng.pick([20, 25, 40, 50, 60])) / 100; const q = rng.pick([20, 25, 40, 50, 60, 75]); const pop = rng.pick([300, 400, 500, 600, 800, 900]); const g1 = (pop * c1) / n; const ans = (g1 * q) / 100; if (![c1, g1, ans].every(Number.isInteger) || ans < 5 || c1 < 1) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A random sample of ${n} ${s.pop} was taken from a group of ${pop} ${s.pop}.`, `From a group of ${pop} ${s.pop}, a random sample of ${n} was surveyed.`], [`In the sample, ${c1} ${s.ev}.`, `${c1} of the sampled ${s.pop} ${s.ev}.`], [`Of those who ${s.ev}, ${q}% also said they would recommend it to a friend.`, `Among those ${s.pop} who ${s.ev}, ${q}% would recommend it.`]]),
        question: spin(rng, `[[Based on the sample, about how many ${s.pop} in the whole group ${s.ev} and would also recommend it?|What is the best estimate of the number of ${s.pop} in the group who ${s.ev} and would recommend it?]]`), correct: ans,
        wrongs: [W(g1, "step_missing", "첫 집단의 추정 인원에서 멈췄다."), W((pop * q) / 100, "formula_misuse", "두 번째 비율을 전체 모집단에 적용했다."), W((c1 * q) / 100, "step_missing", "표본에서의 값만 구하고 모집단으로 확장하지 않았다."), W(Math.round((g1 + ans) / 2), "formula_misuse", "두 값을 평균했다."), W(ans + 5, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ n, pop, c1, q }, "const g=P.pop*P.c1/P.n;\nreturn g*P.q/100;"),
        trace: [[`표본에서 첫 집단 비율 = ${c1}/${n} 이다.`, "First proportion."], [`전체에 적용하면 ${pop} × ${c1}/${n} = ${g1} 명이다.`, "Estimate the first subgroup."], [`그 ${g1} 명 중 ${q}% 가 두 번째 조건이다.`, "Second proportion applies to the subgroup."], [`${g1} × ${q}% = ${ans} 이다.`, "Compute."], [`두 번째 비율의 기준이 전체가 아님을 확인한다.`, "Check the base of the second percent."]], variant: "two_stage_estimate" }), [{ noun: "sample", value: n }]);
    },
  },
  {
    id: "ime.population_estimate.compare_scenarios", skill: SKILL, kind: "population_estimate", operator: "compare_scenarios",
    structure: "서로 다른 두 지역의 표본 결과와 인구로 각각의 추정 인원을 구해 차이를 비교",
    extraThinking: "표본 비율이 큰 쪽이 추정 인원도 큰 것은 아님을 모집단 크기까지 반영해 각각 추정하고 비교 — medium 은 한 번의 추정",
    concepts: ["표본 비율의 일반화", "두 집단 비교", "비례 추정"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const n1 = rng.pick([50, 100, 200]), n2 = rng.pick([50, 100, 200]); const c1 = (n1 * rng.pick([20, 25, 40, 50, 60])) / 100, c2 = (n2 * rng.pick([20, 25, 40, 50, 60])) / 100; const p1 = rng.pick([200, 300, 400, 600, 800]), p2 = rng.pick([200, 300, 400, 600, 800]); const e1 = (p1 * c1) / n1, e2 = (p2 * c2) / n2; if (![c1, c2, e1, e2].every(Number.isInteger) || e1 === e2 || p1 === p2) throw new GenFail("x");
      const [t1, t2] = rng.pick([["Town A", "Town B"], ["School X", "School Y"], ["District 1", "District 2"], ["Branch North", "Branch South"]]); const correct = Math.abs(e1 - e2);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`In ${t1}, which has ${p1} ${s.pop}, a random sample of ${n1} ${s.pop} showed that ${c1} ${s.ev}.`, `${t1} has ${p1} ${s.pop}; in a random sample of ${n1} of them, ${c1} ${s.ev}.`], [`In ${t2}, which has ${p2} ${s.pop}, a random sample of ${n2} ${s.pop} showed that ${c2} ${s.ev}.`, `${t2} has ${p2} ${s.pop}; in a random sample of ${n2} of them, ${c2} ${s.ev}.`]]),
        question: spin(rng, `[[Based on the samples, what is the positive difference between the estimated numbers of ${s.pop} who ${s.evP} in the two places?|By how many does the estimated number of ${s.pop} who ${s.evP} differ between ${t1} and ${t2}?]]`), correct,
        wrongs: [W(Math.abs(c1 - c2), "step_missing", "표본의 값만 비교하고 모집단으로 확장하지 않았다."), W(Math.abs(p1 - p2), "other", "인구의 차를 답했다."), W(e1 + e2, "formula_misuse", "차가 아니라 합을 답했다."), W(Math.abs(Math.round(((c1 / n1) - (c2 / n2)) * 100)), "unit_error", "비율(%)의 차를 답했다."), W(correct + 10, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ p1, n1, c1, p2, n2, c2 }, "return Math.abs(P.p1*P.c1/P.n1-P.p2*P.c2/P.n2);"),
        trace: [[`${t1} 추정 = ${p1} × ${c1}/${n1} = ${e1} 이다.`, "Estimate for the first place."], [`${t2} 추정 = ${p2} × ${c2}/${n2} = ${e2} 이다.`, "Estimate for the second place."], [`두 추정값을 비교한다.`, "Compare."], [`차 = |${e1} - ${e2}| = ${correct} 이다.`, "Difference."], [`비율이 큰 쪽이 항상 인원이 많은 것은 아님을 확인한다.`, "Check the intuition."]], variant: "two_places_estimate" }), [{ noun: t1, value: p1 }, { noun: t2, value: p2 }]);
    },
  },
  // ───────── margin_interval ─────────
  {
    id: "ime.margin_interval.inverse", skill: SKILL, kind: "margin_interval", operator: "inverse",
    structure: "여론조사의 타당한 범위 양 끝값이 주어질 때 표본 추정 비율과 오차 한계를 거꾸로 구함",
    extraThinking: "구간 끝값에서 중심(표본 비율)과 반폭(오차 한계)을 역으로 구성하고 묻는 값을 선택 — medium 은 '표본 비율 ± 오차한계'로 구간 계산",
    concepts: ["오차 한계", "신뢰 구간의 구조", "중심·반폭 역산"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const p = rng.int(20, 70), m = rng.int(2, 9); const lo = p - m, hi = p + m; const ask = rng.int(0, 1); const correct = ask === 0 ? m : p;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A poll of randomly selected ${s.pop} reports that, based on the sample percent and its margin of error, the percent of all ${s.pop} who ${s.ev} is plausibly between ${lo}% and ${hi}%.`, `Using a random sample, a poll estimates that the percent of ${s.pop} who ${s.ev} is plausibly from ${lo}% to ${hi}%.`, `A random-sample poll gives a plausible range of ${lo}% to ${hi}% for the percent of ${s.pop} who ${s.ev}.`], [`The interval is the sample percent plus or minus the margin of error.`, `The range is centered at the sample percent and extends one margin of error on each side.`]]),
        question: spin(rng, ask === 0 ? `[[What is the margin of error, in percentage points?|What margin of error does the poll report, in percentage points?]]` : `[[What was the sample percent?|What percent of the sample ${s.ev}?]]`), correct, fmt: pc,
        wrongs: [W(ask === 0 ? hi - lo : hi, "formula_misuse", ask === 0 ? "구간의 전체 폭을 오차 한계로 답했다(반으로 나누지 않았다)." : "구간의 위쪽 끝값을 답했다."), W(ask === 0 ? p : m, "other", "묻지 않은 값을 답했다."), W(ask === 0 ? (hi - lo) / 4 : lo, "formula_misuse", ask === 0 ? "폭을 4 로 나눴다." : "구간의 아래쪽 끝값을 답했다."), W(ask === 0 ? m + 1 : p + 1, "other", "계산 중 1 어긋났다."), W(ask === 0 ? hi : hi - lo, "other", "끝값 또는 폭을 답했다.")],
        verificationJs: withParams({ lo, hi, ask }, "const center=(P.lo+P.hi)/2, half=(P.hi-P.lo)/2;\nreturn P.ask===0?half:center;"),
        trace: [[`구간은 (표본 비율 - 오차 한계) 부터 (표본 비율 + 오차 한계) 까지이다.`, "Recall the structure of the interval."], [`중심 = (${lo} + ${hi}) ÷ 2 = ${p} 이다.`, "Midpoint is the sample percent."], [`반폭 = (${hi} - ${lo}) ÷ 2 = ${m} 이다.`, "Half-width is the margin of error."], [`묻는 값은 ${correct}% 이다.`, "Select the requested quantity."], [`구간의 전체 폭(${hi - lo})과 구분한다.`, "Distinguish from the full width."]], variant: ask === 0 ? "interval_to_margin" : "interval_to_center" }), [{ noun: ["plausibly", "plausible range"], value: lo }]);
    },
  },
  {
    id: "ime.margin_interval.constraint_select", skill: SKILL, kind: "margin_interval", operator: "constraint_select",
    structure: "표본 비율 ± 오차 한계의 구간과 추가 조건(주장된 비율 초과·5 의 배수)을 동시에 만족하는 정수 퍼센트의 개수를 셈",
    extraThinking: "구간의 양 끝을 계산하고 '초과·이하'의 경계 포함 여부와 배수 조건을 함께 처리해 정수 값의 개수를 셈 — medium 은 구간 끝값 계산",
    concepts: ["오차 한계", "구간과 경계 처리", "정수·배수 개수 세기"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const p = rng.int(25, 70), m = rng.int(3, 9); const lo = p - m, hi = p + m; const mode = rng.int(0, 1); const claim = rng.int(lo - 1, p + 1); const mult = rng.pick([1, 5]); let correct = 0; for (let v = 0; v <= 100; v++) if (v >= lo && v <= hi && (mode === 0 ? v > claim : true) && v % mult === 0) correct++;
      if (correct < 3 || (mult === 5 && correct < 2)) throw new GenFail("x"); let noClaim = 0; for (let v = lo; v <= hi; v++) if (v % mult === 0) noClaim++; if (mode === 0 && noClaim === correct) throw new GenFail("x");
      const multT = mult === 1 ? "whole-number percents" : "percents that are multiples of 5";
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`In a random sample of ${s.pop}, ${p}% ${s.ev}, and the margin of error is ${m} percentage points.`, `A random-sample poll finds that ${p}% of the ${s.pop} ${s.ev}, with a margin of error of ${m} percentage points.`, `The sample percent of ${s.pop} who ${s.ev} is ${p}%, and the poll's margin of error is ${m} percentage points.`], [mode === 0 ? `A claim says that more than ${claim}% of all the ${s.pop} ${s.ev}.` : `Consider only ${multT}.`, mode === 0 ? `Someone claims that the true percent of ${s.pop} who ${s.ev} is greater than ${claim}%.` : `Only ${multT} are considered.`], mode === 0 ? [`Consider only ${multT}.`, `Only ${multT} count.`] : [`The plausible values are those within the margin of error of the sample percent.`, `A value is plausible if it lies within the margin of error of the sample percent.`]]),
        question: spin(rng, mode === 0 ? `[[How many ${multT} are both plausible (within the margin of error) and greater than ${claim}%?|For how many ${multT} is the claim of more than ${claim}% consistent with the poll?]]` : `[[How many ${multT} are plausible values for the percent of all ${s.pop} who ${s.ev}?|How many ${multT} lie within the margin of error?]]`), correct,
        wrongs: [W(noClaim, "condition_ignored", mode === 0 ? "주장(초과) 조건을 무시하고 구간 안의 값을 모두 셌다." : "배수 조건을 무시했다."), W(correct + 1, "step_missing", "경계(끝값 포함/제외)를 하나 더 센다."), W(Math.max(1, correct - 1), "step_missing", "경계를 하나 뺐다."), W(2 * m, "formula_misuse", "구간의 폭(끝점 하나 제외)만 셌다."), W(2 * m + 1 === correct ? correct + 2 : 2 * m + 1, "condition_ignored", "추가 조건을 무시하고 정수 값 전체를 셌다.")],
        verificationJs: withParams({ p, m, ...(mode === 0 ? { claim } : { claim: 0 }), mode, mult }, "let c=0;\nfor(let v=0;v<=100;v++){ if(v>=P.p-P.m && v<=P.p+P.m && (P.mode===0 ? v>P.claim : true) && v%P.mult===0) c++; }\nreturn c;"),
        trace: [[`타당한 구간 = ${p} ± ${m} = [${lo}, ${hi}] 이다.`, "Compute the plausible interval."], [mode === 0 ? `주장(${claim}% 초과)을 만족하려면 값이 ${claim + 1} 이상이어야 한다.` : "추가 조건 없이 구간 안의 값만 고려한다.", "Apply the claim condition."], [mult === 1 ? "정수 퍼센트를 모두 센다." : "5 의 배수인 값만 센다.", "Apply the multiple condition."], [`양 끝값(${lo}, ${hi})을 포함하는지 확인한다.`, "Check the endpoints."], [`해당하는 값은 ${correct} 개이다.`, "Count."]], variant: mode === 0 ? "interval_with_claim" : "interval_multiples" }), [{ noun: "margin of error", value: m }]);
    },
  },
  {
    id: "ime.margin_interval.compare_scenarios", skill: SKILL, kind: "margin_interval", operator: "compare_scenarios",
    structure: "서로 다른 두 조사의 타당한 구간이 겹치는 정수 퍼센트의 개수를 셈",
    extraThinking: "두 구간(표본 비율 ± 오차 한계)을 각각 구해 겹치는 부분의 정수를 세는 두 조사 비교(겹침이 없으면 0 개) — medium 은 한 조사의 구간 끝값 계산",
    concepts: ["오차 한계", "두 구간의 교집합", "정수 개수 세기"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const p1 = rng.int(30, 60), m1 = rng.int(3, 8), p2 = rng.int(30, 60), m2 = rng.int(3, 8); const lo = Math.max(p1 - m1, p2 - m2), hi = Math.min(p1 + m1, p2 + m2); const correct = Math.max(0, hi - lo + 1); if (correct < 2 || p1 === p2 || m1 === m2) throw new GenFail("x");
      const [a, b] = rng.pick([["Poll A", "Poll B"], ["Survey 1", "Survey 2"], ["The spring poll", "The fall poll"], ["Pollster X", "Pollster Y"]]);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${a} found that ${p1}% of a random sample of ${s.pop} ${s.ev}, with a margin of error of ${m1} percentage points.`, `In ${a}, ${p1}% of the randomly sampled ${s.pop} ${s.ev}, and the margin of error is ${m1} percentage points.`], [`${b} found that ${p2}% of a different random sample ${s.ev}, with a margin of error of ${m2} percentage points.`, `In ${b}, ${p2}% of another random sample ${s.ev}; its margin of error is ${m2} percentage points.`]]),
        question: spin(rng, `[[How many whole-number percents are plausible for the true percent according to both polls?|For how many whole-number percents do the two polls' plausible ranges agree?]]`), correct,
        wrongs: [W(hi - lo, "step_missing", "겹침 구간의 양 끝을 모두 세지 않았다(끝점 하나 제외)."), W(correct + 1, "other", "경계를 하나 더 센다."), W(2 * m1 + 1, "other", "한 조사의 구간 정수 개수를 답했다."), W(2 * m2 + 1, "other", "다른 조사의 구간 정수 개수를 답했다."), W(Math.abs(p1 - p2), "other", "두 표본 비율의 차를 답했다.")],
        verificationJs: withParams({ p1, m1, p2, m2 }, "let c=0;\nfor(let v=0;v<=100;v++){ if(v>=P.p1-P.m1 && v<=P.p1+P.m1 && v>=P.p2-P.m2 && v<=P.p2+P.m2) c++; }\nreturn c;"),
        trace: [[`${a} 의 구간 = [${p1 - m1}, ${p1 + m1}] 이다.`, "First interval."], [`${b} 의 구간 = [${p2 - m2}, ${p2 + m2}] 이다.`, "Second interval."], [`겹치는 구간 = [${lo}, ${hi}] 이다.`, "Intersection."], [`양 끝을 포함하므로 정수 개수 = ${hi} - ${lo} + 1 이다.`, "Count with both endpoints."], [`답은 ${correct} 이다.`, "Answer."]], variant: "two_polls_overlap" }), [{ noun: a, value: p1 }, { noun: b, value: p2 }]);
    },
  },
  {
    id: "ime.margin_interval.repr_shift", skill: SKILL, kind: "margin_interval", operator: "repr_shift",
    structure: "표본 비율(퍼센트)과 오차 한계(퍼센트포인트)를 전체 인원수로 환산해 타당한 인원의 상한을 구함",
    extraThinking: "퍼센트 구간을 모집단의 인원수 구간으로 번역(비율 → 개수)하고 상한을 선택 — medium 은 퍼센트 구간 끝값 계산",
    concepts: ["오차 한계", "퍼센트 → 개수 환산", "구간의 상한"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const pop = rng.pick([200, 300, 400, 500, 600, 800]); const p = rng.pick([20, 25, 30, 35, 40, 45, 50, 55, 60]); const m = rng.pick([2, 3, 4, 5, 6, 8]); const hiN = (pop * (p + m)) / 100, loN = (pop * (p - m)) / 100; if (!Number.isInteger(hiN) || !Number.isInteger(loN)) throw new GenFail("x"); const ask = rng.int(0, 1); const correct = ask === 0 ? hiN : loN;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A group has ${pop} ${s.pop}.`, `There are ${pop} ${s.pop} in the whole group.`], [`In a random sample, ${p}% ${s.ev}, and the margin of error is ${m} percentage points.`, `A random sample shows ${p}% of ${s.pop} who ${s.ev}, with a margin of error of ${m} percentage points.`]]),
        question: spin(rng, ask === 0 ? `[[According to the poll, what is the greatest plausible number of ${s.pop} in the whole group who ${s.evP}?|What is the highest number of ${s.pop} in the whole group who ${s.evP} that the poll considers plausible?]]` : `[[According to the poll, what is the least plausible number of ${s.pop} in the whole group who ${s.evP}?|What is the lowest number of ${s.pop} in the whole group who ${s.evP} that the poll considers plausible?]]`), correct,
        wrongs: [W(ask === 0 ? (pop * p) / 100 : (pop * p) / 100, "step_missing", "오차 한계를 반영하지 않고 표본 비율만 적용했다."), W(ask === 0 ? hiN - (pop * m) / 100 * 2 : loN + (pop * m) / 100 * 2, "other", "반대쪽 끝값을 답했다."), W(ask === 0 ? p + m : p - m, "unit_error", "퍼센트 값을 인원수로 환산하지 않았다."), W(ask === 0 ? (pop * p) / 100 + m : (pop * p) / 100 - m, "unit_error", "오차 한계(퍼센트포인트)를 인원수에 그대로 더했다."), W(correct + 10, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ pop, p, m, ask }, "const s=P.ask===0?P.p+P.m:P.p-P.m;\nreturn P.pop*s/100;"),
        trace: [[`타당한 퍼센트 구간 = ${p}% ± ${m} = [${p - m}%, ${p + m}%] 이다.`, "Plausible percent interval."], [`전체 ${pop} 명에 적용한다.`, "Apply to the whole group."], [`상한 = ${pop} × ${p + m}% = ${hiN}, 하한 = ${pop} × ${p - m}% = ${loN} 이다.`, "Convert both ends to counts."], [`묻는 값은 ${correct} 이다.`, "Select the requested end."], [`퍼센트포인트를 인원수로 착각하지 않았는지 확인한다.`, "Check units."]], variant: ask === 0 ? "interval_upper_count" : "interval_lower_count" }), [{ noun: "random sample", value: p }]);
    },
  },
  // ───────── sample_size_effect ─────────
  {
    id: "ime.sample_size_effect.param_condition", skill: SKILL, kind: "sample_size_effect", operator: "param_condition",
    structure: "오차 한계가 표본 크기의 제곱근에 반비례할 때 목표 오차 한계 이하가 되는 최소 표본 크기를 구함",
    extraThinking: "반비례 관계를 제곱 비로 번역(오차를 1/k 로 줄이려면 표본을 k² 배)하고 '이하' 조건에서 올림해 최소 표본 크기를 결정 — medium 은 주어진 표본 크기로 오차 한계 비교",
    concepts: ["오차 한계와 표본 크기", "제곱근 반비례", "부등식 조건(최소)"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const n = rng.pick([100, 150, 200, 250, 300, 400]); const m = rng.pick([6, 8, 9, 10, 12]); const t = rng.int(2, m - 1); const need = Math.ceil((n * m * m) / (t * t)); if ((n * m * m) % (t * t) === 0 && rng.chance(0.5)) throw new GenFail("x"); if (need <= n || need > 999) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + intro(rng) + facts(rng, [[`A poll of ${n} randomly selected ${s.pop} has a margin of error of ${m} percentage points.`, `With a random sample of ${n} ${s.pop}, a poll's margin of error is ${m} percentage points.`], REL, [`A new poll must have a margin of error of at most ${t} percentage points.`, `The new poll's margin of error must be ${t} percentage points or less.`]]),
        question: spin(rng, `[[What is the least sample size that guarantees this margin of error?|What is the smallest whole-number sample size that achieves a margin of error of at most ${t} percentage points?]]`), correct: need,
        wrongs: [W(Math.floor((n * m * m) / (t * t)), "step_missing", "올림하지 않고 내림했다(조건을 만족하지 못한다)."), W(Math.round((n * m) / t), "formula_misuse", "제곱 비 대신 선형 비로 계산했다."), W(Math.round(n * (m / t) * (m / t) * (m / t)), "formula_misuse", "비를 세제곱했다."), W(need + n, "other", "원래 표본 크기를 더했다."), W(Math.round(Math.sqrt(n * m * m) / t), "formula_misuse", "제곱근 위치를 잘못 적용했다.")],
        verificationJs: withParams({ n, m, t }, "let out=null;\nfor(let k=1;k<=5000;k++){ const margin=P.m*Math.sqrt(P.n/k); if(margin<=P.t+1e-12){ out=k; break; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`오차 한계 ∝ 1/√n 이므로 오차 한계 × √n 은 일정하다.`, "Margin times sqrt(n) is constant."], [`${m}·√${n} = ${t}·√n′ 이다.`, "Set up the proportion."], [`n′ = ${n}·(${m}/${t})² = ${fmtNum((n * m * m) / (t * t))} 이다.`, "Solve for the new sample size."], [`'이하' 조건이므로 올림하여 정수 표본 크기를 정한다.`, "Round up for 'at most'."], [`최소 표본 크기는 ${need} 이다.`, "Answer."]], variant: "min_sample_for_margin" }), [{ noun: "margin of error", value: m }, { noun: ["sample", "poll of"], value: n }]);
    },
  },
  {
    id: "ime.sample_size_effect.compare_scenarios", skill: SKILL, kind: "sample_size_effect", operator: "compare_scenarios",
    structure: "표본 크기가 다른 두 조사에서 한 조사의 오차 한계로 다른 조사의 오차 한계를 제곱근 반비례로 구함",
    extraThinking: "표본 크기의 비를 제곱근으로 바꿔 오차 한계 비를 구하는 두 조사 비교(표본이 4 배면 오차는 1/2) — medium 은 한 조사의 오차 한계 읽기",
    concepts: ["오차 한계와 표본 크기", "제곱근 반비례", "두 조사 비교"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const k = rng.pick([2, 3, 4, 5]); const bigger = rng.chance(0.5); const nA = rng.pick([50, 100, 150, 200]); const nB = bigger ? nA * k * k : nA; const nA2 = bigger ? nA : nA * k * k; const mA = bigger ? rng.pick([6, 8, 9, 10, 12, 15]) : rng.pick([2, 3, 4, 5]); const mB = bigger ? mA / k : mA * k; if (!Number.isInteger(mB) || nA * k * k > 999) throw new GenFail("x");
      const nSmall = Math.min(nA, nB, nA2), nLarge = Math.max(nA, nB, nA2); const [x, y] = ["Poll A", "Poll B"];
      void nB;
      const nKnown = bigger ? nA : nA; const nAsk = bigger ? nA * k * k : nA * k * k; const mKnown = mA; const mAsk = bigger ? mA / k : mA * k;
      return withBind(finish(rng, { stimulus: ctx(rng) + intro(rng) + facts(rng, [[`${x} used a random sample of ${bigger ? nKnown : nAsk} ${s.pop} and had a margin of error of ${bigger ? mKnown : mAsk} percentage points.`, `In ${x}, ${bigger ? nKnown : nAsk} ${s.pop} were randomly sampled, and the margin of error was ${bigger ? mKnown : mAsk} percentage points.`], [`${y} used a random sample of ${bigger ? nAsk : nKnown} ${s.pop}.`, `For ${y}, a random sample of ${bigger ? nAsk : nKnown} ${s.pop} was taken.`], REL]),
        question: spin(rng, `[[What is the margin of error of ${y}, in percentage points?|According to this relationship, what margin of error does ${y} have, in percentage points?]]`), correct: bigger ? mAsk : mKnown, fmt: fmtNum,
        wrongs: [W(bigger ? mKnown : mAsk, "other", "알려진 조사의 오차 한계를 그대로 답했다."), W(bigger ? mKnown / (k * k) : mKnown * (k * k), "formula_misuse", "제곱근을 취하지 않고 표본 크기의 비를 그대로 썼다."), W(bigger ? mKnown * k : mKnown / k, "sign_error", "비의 방향을 거꾸로 적용했다."), W((bigger ? mAsk : mKnown) + 1, "other", "계산 중 1 어긋났다."), W(Math.abs((bigger ? mKnown : mAsk) - k), "other", "배율을 더하거나 뺐다.")].filter((w) => w.v > 0),
        verificationJs: withParams({ mKnown, big: bigger ? 1 : 0 }, `const k=${k};\nreturn P.big===1 ? P.mKnown/k : P.mKnown;`),
        trace: [[`표본 크기의 비 = ${k * k} 배이므로 √비 = ${k} 이다.`, "Take the square root of the size ratio."], [`표본이 ${k * k} 배이면 오차 한계는 ${k} 분의 1 이 된다.`, "Margin shrinks by the root."], [bigger ? `${y} 의 표본이 더 크므로 오차 한계 = ${mKnown} ÷ ${k} = ${mAsk} 이다.` : `${y} 의 표본은 ${x} 보다 작으므로 오차 한계는 ${y} = ${mKnown} 이다(알려진 값).`, "Apply to the unknown margin."], [`방향(커지면 작아짐)을 확인한다.`, "Check the direction."], [`답은 ${bigger ? mAsk : mKnown} 이다.`, "Answer."]], variant: bigger ? "bigger_sample_smaller_margin" : "smaller_sample_larger_margin" }), [{ noun: x, value: bigger ? nKnown : nAsk }]);
    },
  },
  {
    id: "ime.sample_size_effect.inverse", skill: SKILL, kind: "sample_size_effect", operator: "inverse",
    structure: "두 조사의 오차 한계와 한 조사의 표본 크기로 제곱근 반비례 관계를 거꾸로 풀어 다른 조사의 표본 크기를 구함",
    extraThinking: "오차 한계의 비를 제곱해 표본 크기의 비로 되돌리는 역산(제곱 방향) — medium 은 표본 크기로 오차 한계 비교",
    concepts: ["오차 한계와 표본 크기", "제곱근 반비례", "비의 역산"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const k = rng.pick([2, 3, 4]); const nA = rng.pick([50, 100, 150, 200, 250]); const mA = rng.pick([6, 8, 9, 10, 12, 15]); const smaller = rng.chance(0.5); const nB = smaller ? nA / (k * k) : nA * k * k; const mB = smaller ? mA * k : mA / k; if (!Number.isInteger(nB) || !Number.isInteger(mB) || nB < 10 || nB > 999) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + intro(rng) + facts(rng, [[`Poll A used a random sample of ${nA} ${s.pop} and had a margin of error of ${mA} percentage points.`, `In Poll A, ${nA} ${s.pop} were randomly sampled, giving a margin of error of ${mA} percentage points.`], [`Poll B, of the same kind, had a margin of error of ${mB} percentage points.`, `Poll B had a margin of error of ${mB} percentage points.`], REL]),
        question: spin(rng, `[[How many ${s.pop} were sampled in Poll B?|What was the sample size of Poll B?]]`), correct: nB,
        wrongs: [W(nA * k, "formula_misuse", "제곱하지 않고 선형 비로 계산했다."), W(smaller ? nA * k * k : nA / (k * k), "sign_error", "비의 방향을 거꾸로 적용했다."), W(smaller ? nA / k : nA * k, "formula_misuse", "제곱근 방향을 잘못 적용했다."), W(nA + nB, "other", "두 표본 크기를 더했다."), W(nB + 50, "other", "계산 중 어긋났다.")].filter((w) => w.v > 0),
        verificationJs: withParams({ nA, mA, mB }, "let out=null;\nfor(let n=1;n<=5000;n++){ if(Math.abs(P.mA*Math.sqrt(P.nA)-P.mB*Math.sqrt(n))<1e-9) out=n; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`오차 한계 × √(표본 크기) 는 두 조사에서 같다.`, "The product margin × sqrt(n) is constant."], [`${mA}·√${nA} = ${mB}·√n 이다.`, "Set up the equation."], [`√n = ${mA}·√${nA} ÷ ${mB} 이므로 n = ${nA}·(${mA}/${mB})² 이다.`, "Square both sides."], [`n = ${nB} 이다.`, "Compute."], [`오차가 ${mB > mA ? "더 크므로 표본이 더 작아야" : "더 작으므로 표본이 더 커야"} 함을 확인한다.`, "Check the direction."]], variant: "margin_to_sample_size" }), [{ noun: "Poll A", value: nA }]);
    },
  },
  {
    id: "ime.sample_size_effect.chain2", skill: SKILL, kind: "sample_size_effect", operator: "chain2",
    structure: "현재 표본 크기와 오차 한계, 목표 오차 한계로 필요한 표본 크기를 구한 뒤 현재와의 차(추가로 조사할 인원)를 구함",
    extraThinking: "제곱 비로 필요한 표본 크기를 구한 뒤 현재 표본 크기를 빼는 2단계 연쇄(최종 답은 표본 크기 자체가 아니라 추가 인원) — medium 은 한 번의 오차 비교",
    concepts: ["오차 한계와 표본 크기", "제곱근 반비례", "추가 인원 계산"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const k = rng.pick([2, 3, 4]); const n = rng.pick([50, 100, 150, 200, 250]); const m = rng.pick([6, 8, 9, 10, 12, 15]); if (m % k !== 0) throw new GenFail("x"); const t = m / k; const need = n * k * k; const extra = need - n; if (need > 999) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + intro(rng) + facts(rng, [[`A poll of ${n} randomly selected ${s.pop} has a margin of error of ${m} percentage points.`, `A random sample of ${n} ${s.pop} gives a margin of error of ${m} percentage points.`], REL, [`The pollsters want a margin of error of exactly ${t} percentage points.`, `The goal is to reduce the margin of error to ${t} percentage points.`]]),
        question: spin(rng, `[[How many more ${s.pop} must be surveyed in addition to the original ${n}?|By how many does the sample size need to increase?]]`), correct: extra,
        wrongs: [W(need, "step_missing", "필요한 전체 표본 크기를 답했다(기존 인원을 빼지 않았다)."), W(n * k - n, "formula_misuse", "제곱 대신 선형 배율로 계산했다."), W(n * k, "formula_misuse", "선형 배율로 계산한 전체 표본 크기를 답했다."), W(extra + n, "other", "원래 인원을 더했다."), W(Math.round(n * (k * k - 1) / 2), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ n, m, t }, "let need=null;\nfor(let k=1;k<=10000;k++){ if(Math.abs(P.m*Math.sqrt(P.n/k)-P.t)<1e-9){ need=k; break; } }\nif(need===null) throw new Error('해 없음');\nreturn need-P.n;"),
        trace: [[`오차를 ${m} 에서 ${t} 로 줄이므로 오차 비 = ${t}/${m} = 1/${k} 이다.`, "Ratio of margins."], [`표본 크기의 비는 오차 비의 제곱의 역수이므로 ${k * k} 배이다.`, "Square and invert."], [`필요한 표본 크기 = ${n} × ${k * k} = ${need} 이다.`, "Required sample size."], [`추가 인원 = ${need} - ${n} = ${extra} 이다.`, "Subtract the current size."], [`묻는 값은 추가 인원임을 확인한다.`, "Check what is asked."]], variant: "additional_respondents" }), [{ noun: "margin of error", value: m }]);
    },
  },
];

// ───────── easy / medium ─────────
export const IME_LEVELS: LArch[] = [
  {
    id: "ime.population_estimate.easy_estimate", skill: SKILL, kind: "population_estimate", operator: "repr_shift", level: "easy",
    structure: "표본 비율을 전체 인원에 적용해 추정", extraThinking: "easy: 표본 비율 × 전체 인원", concepts: ["표본 비율", "비례 추정"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const n = rng.pick([20, 25, 40, 50, 100]); const c = rng.int(2, n - 3); const pop = rng.pick([100, 200, 300, 400, 500, 600, 800]); const est = (pop * c) / n; if (!Number.isInteger(est) || est > 900) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`In a random sample of ${n} ${s.pop}, ${c} ${s.ev}.`, `A random sample of ${n} ${s.pop} was taken, and ${c} of them ${s.ev}.`, `Of ${n} randomly selected ${s.pop}, ${c} ${s.ev}.`], [`There are ${pop} ${s.pop} in the whole group.`, `The whole group has ${pop} ${s.pop}.`, `The entire group contains ${pop} ${s.pop}.`]]), question: spin(rng, `[[About how many ${s.pop} in the whole group are expected to ${s.evP}?|Based on the sample, estimate the number of ${s.pop} in the group who ${s.evP}.|What is the best estimate of the number of ${s.pop} in the whole group who ${s.evP}?]]`), correct: est,
        wrongs: [W(c, "step_missing", "표본의 인원을 그대로 답했다."), W(pop - est, "opposite", "해당하지 않는 인원을 답했다."), W(Math.round((pop * n) / c), "formula_misuse", "비율을 거꾸로 곱했다."), W(est + 20, "other", "계산 중 어긋났다."), W(Math.max(1, est - 20), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ n, c, pop }, "return P.pop*P.c/P.n;"),
        trace: [[`표본 비율 = ${c}/${n} 이다.`, "Sample proportion."], [`전체에 같은 비율을 적용한다.`, "Apply to the group."], [`${pop} × ${c}/${n} = ${est} 이다.`, "Compute."]], variant: "sample_to_group" }), [{ noun: ["random sample", "randomly selected"], value: n }]);
    },
  },
  {
    id: "ime.margin_interval.easy_interval", skill: SKILL, kind: "margin_interval", operator: "repr_shift", level: "easy",
    structure: "표본 비율 ± 오차 한계로 구간의 한 끝을 구함", extraThinking: "easy: 표본 비율에 오차 한계를 더하거나 뺌", concepts: ["오차 한계", "구간"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const p = rng.int(20, 80), m = rng.int(2, 9); const up = rng.chance(0.5); const correct = up ? p + m : p - m;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A random sample shows that ${p}% of ${s.pop} ${s.ev}, with a margin of error of ${m} percentage points.`, `In a poll of randomly selected ${s.pop}, ${p}% ${s.ev}; the margin of error is ${m} percentage points.`, `A poll reports that ${p}% of the sampled ${s.pop} ${s.ev}, plus or minus ${m} percentage points.`]]), question: spin(rng, up ? `[[What is the greatest plausible percent of all ${s.pop} who ${s.evP}?|According to the poll, what is the largest plausible value for the true percent?]]` : `[[What is the least plausible percent of all ${s.pop} who ${s.evP}?|According to the poll, what is the smallest plausible value for the true percent?]]`), correct, fmt: pc,
        wrongs: [W(up ? p - m : p + m, "sign_error", "반대쪽 끝값을 답했다."), W(p, "step_missing", "표본 비율을 그대로 답했다."), W(m, "other", "오차 한계를 답했다."), W(up ? p + 2 * m : p - 2 * m, "formula_misuse", "오차 한계를 두 번 적용했다."), W(correct + 1, "other", "계산 중 1 어긋났다.")].filter((w) => w.v > 0),
        verificationJs: withParams({ p, m, up: up ? 1 : 0 }, "return P.up===1?P.p+P.m:P.p-P.m;"),
        trace: [[`구간은 ${p}% ± ${m} 이다.`, "Form the interval."], [up ? `상한 = ${p} + ${m} 이다.` : `하한 = ${p} - ${m} 이다.`, "Choose the end."], [`답은 ${correct}% 이다.`, "Compute."]], variant: up ? "upper_end" : "lower_end" }), [{ noun: ["margin of error", "plus or minus"], value: m }]);
    },
  },
  {
    id: "ime.population_estimate.med_percent_population", skill: SKILL, kind: "population_estimate", operator: "chain2", level: "medium",
    structure: "표본 비율(퍼센트)을 전체 인원에 적용하고 해당하지 않는 인원을 구함", extraThinking: "medium: 퍼센트 → 개수 추정 후 여집합", concepts: ["표본 비율", "퍼센트 환산", "여집합"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const p = rng.pick([10, 20, 25, 30, 40, 60, 75]); const pop = rng.pick([200, 300, 400, 500, 600, 800]); const n = rng.pick([50, 100, 200]); const est = (pop * p) / 100; if (!Number.isInteger(est)) throw new GenFail("x"); const ask = rng.int(0, 1); const correct = ask === 0 ? est : pop - est;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`In a random sample of ${n} ${s.pop}, ${p}% ${s.ev}.`, `A random sample of ${n} ${s.pop} shows that ${p}% of them ${s.ev}.`, `${p}% of ${n} randomly sampled ${s.pop} ${s.ev}.`], [`The whole group has ${pop} ${s.pop}.`, `There are ${pop} ${s.pop} in the whole group.`]]), question: spin(rng, ask === 0 ? `[[About how many ${s.pop} in the whole group ${s.ev}?|Estimate the number of ${s.pop} in the group who ${s.evP}.]]` : `[[About how many ${s.pop} in the whole group do NOT ${s.evP}?|Estimate the number of ${s.pop} in the group who do not ${s.evP}.]]`), correct,
        wrongs: [W(ask === 0 ? pop - est : est, "opposite", "반대 집단의 인원을 답했다."), W(Math.round((n * p) / 100), "step_missing", "표본의 인원만 구했다."), W(pop * p, "unit_error", "퍼센트를 소수로 바꾸지 않았다."), W(correct + 20, "other", "계산 중 어긋났다."), W(Math.max(1, correct - 20), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ p, pop, ask }, "const e=P.pop*P.p/100; return P.ask===0?e:P.pop-e;"),
        trace: [[`표본 비율은 ${p}% 이다.`, "Sample percent."], [`전체에 적용하면 ${pop} × ${p}% = ${est} 이다.`, "Apply to the group."], [ask === 0 ? `답은 ${est} 이다.` : `해당하지 않는 인원 = ${pop} - ${est} = ${pop - est} 이다.`, "Select the requested group."]], variant: ask === 0 ? "percent_to_count" : "percent_to_complement" }), [{ noun: "sample", value: n }]);
    },
  },
  {
    id: "ime.margin_interval.med_interval_margin", skill: SKILL, kind: "margin_interval", operator: "inverse", level: "medium",
    structure: "구간의 양 끝으로 오차 한계를 구함", extraThinking: "medium: (상한 - 하한) ÷ 2", concepts: ["오차 한계", "구간의 폭"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const p = rng.int(25, 75), m = rng.int(2, 9); const lo = p - m, hi = p + m;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A random-sample poll estimates that the percent of ${s.pop} who ${s.ev} is between ${lo}% and ${hi}%.`, `Based on a random sample, the percent of ${s.pop} who ${s.ev} is estimated to be from ${lo}% to ${hi}%.`, `A poll of randomly selected ${s.pop} reports a plausible range of ${lo}% to ${hi}% for the percent who ${s.ev}.`], [`This range is the sample percent plus or minus the margin of error.`, `The range is centered at the sample percent.`]]), question: spin(rng, `[[What is the margin of error, in percentage points?|What margin of error does this poll have, in percentage points?]]`), correct: m, fmt: pc,
        wrongs: [W(hi - lo, "formula_misuse", "구간의 전체 폭을 답했다."), W(p, "other", "표본 비율을 답했다."), W(hi, "other", "상한을 답했다."), W(m + 1, "other", "계산 중 1 어긋났다."), W(Math.max(1, m - 1), "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ lo, hi }, "return (P.hi-P.lo)/2;"),
        trace: [[`구간의 폭 = ${hi} - ${lo} = ${hi - lo} 이다.`, "Width of the interval."], [`폭은 오차 한계의 2 배이다.`, "Width is twice the margin."], [`오차 한계 = ${hi - lo} ÷ 2 = ${m} 이다.`, "Half the width."]], variant: "margin_from_interval" }), [{ noun: ["between", "from", "range of"], value: lo }]);
    },
  },
  {
    id: "ime.sample_size_effect.med_quadruple", skill: SKILL, kind: "sample_size_effect", operator: "compare_scenarios", level: "medium",
    structure: "표본 크기를 k² 배로 늘렸을 때 오차 한계(제곱근 반비례)를 구함", extraThinking: "medium: 표본 크기 비의 제곱근으로 오차를 나눔", concepts: ["오차 한계와 표본 크기", "제곱근"], mediumSteps: 2,
    generate(rng) {
      const s = sv(rng); const k = rng.pick([2, 3, 4]); const n = rng.pick([25, 40, 50, 60, 100]); const m = rng.pick([6, 8, 9, 10, 12, 15]); if (m % k !== 0) throw new GenFail("x"); const nn = n * k * k; const correct = m / k; if (nn > 999) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + intro(rng) + facts(rng, [[`A random sample of ${n} ${s.pop} gives a margin of error of ${m} percentage points.`, `A poll of ${n} randomly selected ${s.pop} has a margin of error of ${m} percentage points.`, `With ${n} randomly sampled ${s.pop}, the margin of error is ${m} percentage points.`], REL, [`A new poll uses a random sample of ${nn} ${s.pop}.`, `The sample size of the new poll is ${nn}.`]]), question: spin(rng, `[[What is the margin of error of the new poll, in percentage points?|What margin of error does the new poll have, in percentage points?]]`), correct, fmt: pc,
        wrongs: [W(m / (k * k), "formula_misuse", "제곱근을 취하지 않고 표본 크기 비를 그대로 썼다."), W(m * k, "sign_error", "비의 방향을 거꾸로 적용했다."), W(m, "condition_ignored", "표본 크기가 달라져도 오차가 같다고 봤다."), W(correct + 1, "other", "계산 중 1 어긋났다."), W(m - k, "formula_misuse", "비율이 아니라 차로 계산했다.")].filter((w) => w.v > 0),
        verificationJs: withParams({ n, m, nn }, "return P.m*Math.sqrt(P.n/P.nn);"),
        trace: [[`표본 크기는 ${nn}/${n} = ${k * k} 배이다.`, "Size ratio."], [`오차 한계는 √(${k * k}) = ${k} 로 나뉜다.`, "Take the square root."], [`새 오차 한계 = ${m} ÷ ${k} = ${correct} 이다.`, "Divide."]], variant: "bigger_sample_margin" }), [{ noun: "margin of error", value: m }]);
    },
  },
];
export const IME_ALL: LArch[] = [...IME_HARD.map((a) => asLevel(a)), ...IME_LEVELS];
