// evaluating_statistical_claims.study_design_random_assignment.ST.P — 실험 설계 정보(배정 방법·두 조건 인원·개선된 인원)를 '항목 | 값' 자료로 주고
// 무작위 배정의 역할(혼란 변수 차단), 설계 수정, 개선 비율의 차를 다룬다. verification_js 는 FIGURE 의 배정 방법과 인원만 읽어 정답을 다시 만든다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { CHOICE_ASSIGN, factFig, GET_JS, RANDOM_ASSIGN, study, sumJs, type FactRow, type Study } from "./_t7-kit";

const H = "Experiment detail";
const intro = (rng: Rng, st: Study) => rng.pick([
  `Researchers tested whether ${st.tr} helps ${st.ent} improve their ${st.out}s. Some participants were given ${st.tr} and the others were not, and each participant was later rated as improved or not improved. The table shows information about the experiment.`,
  `In an experiment on ${st.tr}, a set of ${st.ent} was split into participants given ${st.tr} and participants not given it. After several weeks, the researchers recorded whether each participant's ${st.out} improved. Details are shown in the table.`,
  `The table shown describes a study of whether ${st.tr} improves ${st.out}s among ${st.ent}. Every participant either was given ${st.tr} or was not, and every participant was classified as improved or not improved.`,
  `A team investigating ${st.tr} recorded whether the ${st.out} of each participant in a study of ${st.ent} improved. Some participants were given ${st.tr}; the rest were not. The information in the table shown describes the study.`,
]);
const sizes = (rng: Rng) => ({ n1: rng.pick([20, 25, 40, 50, 60, 80]), n2: rng.pick([20, 25, 40, 50, 60, 80]) });
const imp = (rng: Rng, n: number) => { for (let t = 0; t < 40; t++) { const k = rng.int(Math.ceil(n * 0.15), Math.floor(n * 0.9)); if ((100 * k) % n === 0) return k; } throw new GenFail("k"); };
const rowsOf = (st: Study, method: string, n1: number, n2: number, k1: number, k2: number, o: { hideN1?: boolean } = {}): FactRow[] => [["How participants were assigned", method], ...(o.hideN1 ? [] : [[`Participants given ${st.tr}`, n1] as FactRow]), [`Participants not given ${st.tr}`, n2], ["Total participants", n1 + n2], [`Improved, given ${st.tr}`, k1], [`Improved, not given ${st.tr}`, k2]];
const SUM = sumJs(["participants given", "participants not given"], "total participants");
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isInteger(w.v));

export const ITEM = defineItem({
  prefix: "esc", itemId: "evaluating_statistical_claims.study_design_random_assignment.ST.P",
  hard: [
    {
      op: "repr_shift", structure: "배정 방법(무작위 / 스스로 선택)을 읽어 결과에 대한 올바른 설명(무작위 배정의 역할 또는 혼란 변수)을 서술 선지에서 고름", extra: "배정 서술을 '다른 차이가 고르게 섞였는가'로 번역하고, 참가자 수·개선 인원 같은 무관한 근거(함정)를 배제 — medium 은 비율 계산",
      concepts: ["무작위 배정", "혼란 변수", "인과 결론의 조건"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const st = study(rng); const { n1, n2 } = sizes(rng); const k1 = imp(rng, n1), k2 = imp(rng, n2); if (k1 / n1 <= k2 / n2) throw new GenFail("방향"); const rnd = rng.chance(0.5);
        const fig = factFig(`Experiment on ${st.tr}`, rowsOf(st, rnd ? rng.pick(RANDOM_ASSIGN) : rng.pick(CHOICE_ASSIGN), n1, n2, k1, k2), H);
        const o = {
          r: `Because participants were randomly assigned, other differences between the conditions should be balanced, so ${st.tr} likely caused the improvement.`,
          c: `Participants who chose ${st.tr} may differ in other ways (for example, some ${st.ent} ${st.conf}), so a difference other than ${st.tr} could explain the result.`,
          z: `The study cannot support any conclusion because it had fewer than 200 participants.`,
          k: `Because more participants improved with ${st.tr}, the study proves that ${st.tr} works for all ${st.pop}.`,
        };
        const correct = rnd ? o.r : o.c; const wrongs = [{ text: rnd ? o.c : o.r, reason: rnd ? "무작위 배정인데 스스로 선택했다고 보았다." : "스스로 선택했는데 무작위 배정이라고 보았다." }, { text: o.z, reason: "참가자 수로 판단했다." }, { text: o.k, reason: "개선 인원만으로 인과·일반화를 주장했다." }];
        return statementInst(rng, {
          stimulus: intro(rng, st), question: rng.pick([`Which statement best explains what can be concluded about ${st.tr} from this experiment?`, "Which choice gives the most appropriate interpretation of the results?"]), correct, wrongs, figure: fig, P: { r: o.r, c: o.c },
          body: `${GET_JS}${SUM}const want=/^random/i.test(String(g('how participants were assigned'))) ? P.r : P.c; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`개선 비율: 처치 ${k1}/${n1}, 비처치 ${k2}/${n2} 로 처치 쪽이 높다.`, "Compare improvement rates."], [`배정 방법: ${rnd ? "무작위" : "참가자 스스로 선택"}.`, "How were participants assigned?"], [rnd ? "무작위 배정이면 다른 차이가 두 조건에 고르게 나뉜다." : `스스로 선택하면 처치를 고른 사람이 ${st.conf} 같은 다른 차이를 가질 수 있다.`, "Role of random assignment."], ["참가자 수나 개선 인원은 인과 판단의 근거가 아니다.", "Sample size is not the issue."], [rnd ? "따라서 처치가 원인일 가능성이 높다." : "따라서 혼란 변수가 결과를 설명할 수 있다.", "Conclusion."]], variant: "why_random_assignment_matters",
        });
      },
    },
    {
      op: "compose_kind", structure: "총 인원에서 비처치 인원을 빼 처치 인원을 구한 뒤 두 조건의 개선 백분율을 구해 그 차(퍼센트 포인트)를 구함", extra: "빠진 인원 복원 → 두 비율 → 차의 합성(개선 인원의 차를 그대로 쓰면 함정) — medium 은 비율 하나",
      concepts: ["무작위 배정 실험", "비율 비교", "인원 복원"],
      gen(rng) {
        const st = study(rng); const { n1, n2 } = sizes(rng); const k1 = imp(rng, n1), k2 = imp(rng, n2); const p1 = (100 * k1) / n1, p2 = (100 * k2) / n2; const d = p1 - p2; if (d <= 0) throw new GenFail("d");
        const fig = factFig(`Experiment on ${st.tr}`, rowsOf(st, rng.pick(RANDOM_ASSIGN), n1, n2, k1, k2, { hideN1: true }), H);
        return figInst(rng, {
          stimulus: intro(rng, st), question: rng.pick([`By how many percentage points was the percent of participants given ${st.tr} who improved greater than the percent of participants not given ${st.tr} who improved?`, `What is the difference, in percentage points, between the improvement rates of participants given ${st.tr} and participants not given ${st.tr}?`]), correct: d,
          wrongs: pos([W(k1 - k2, "step_missing", "개선 인원의 차를 답했다."), W(Math.round((100 * k1) / (n1 + n2) - p2), "formula_misuse", "처치 인원 대신 전체 인원으로 나눴다."), W(p1, "step_missing", "처치 쪽 비율만 답했다."), W(Math.round((100 * (k1 - k2)) / (n1 + n2)), "formula_misuse", "차를 전체 인원으로 나눴다."), W(d + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== d),
          verificationJs: figJs({}, fig, `${GET_JS}const n2=g('participants not given'), n1=g('total participants')-n2; if (n1<=0) throw new Error('인원 오류'); if (g('improved, given')>n1||g('improved, not given')>n2) throw new Error('개선 인원 초과'); return 100*g('improved, given')/n1 - 100*g('improved, not given')/n2;`),
          trace: [[`처치 인원 = ${n1 + n2} - ${n2} = ${n1} 이다.`, "Recover the treatment count."], [`처치 개선 비율 = ${k1}/${n1} = ${p1}% 이다.`, "Treatment rate."], [`비처치 개선 비율 = ${k2}/${n2} = ${p2}% 이다.`, "Control rate."], ["두 조건의 인원이 달라 개선 인원의 차를 그대로 비교하면 안 된다.", "Compare rates, not counts."], [`차 = ${p1} - ${p2} = ${d} 퍼센트 포인트이다.`, "Difference in percentage points."]], variant: "rate_difference_missing_count",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "지문의 처치 쪽 개선 백분율 X% 와 자료의 총 인원·비처치 인원으로 처치 쪽 개선 인원을 역산하고 비처치 개선 인원과의 차를 구함", extra: "백분율에서 인원을 거꾸로 구하려면 처치 인원(총 - 비처치)을 먼저 복원해야 함 — medium 은 인원에서 백분율",
      concepts: ["백분율의 역산", "인원 복원", "두 조건 비교"],
      gen(rng) {
        const st = study(rng); const { n1, n2 } = sizes(rng); const k1 = imp(rng, n1), k2 = imp(rng, n2); const X = (100 * k1) / n1; const d = k1 - k2; if (d <= 0 || X === 50) throw new GenFail("d");
        const rows: FactRow[] = [["How participants were assigned", rng.pick(RANDOM_ASSIGN)], [`Participants not given ${st.tr}`, n2], ["Total participants", n1 + n2], [`Improved, not given ${st.tr}`, k2]];
        const fig = factFig(`Experiment on ${st.tr}`, rows, H);
        return figInst(rng, {
          stimulus: `${intro(rng, st)} Of the participants given ${st.tr}, ${X} percent improved.`,
          question: `How many more participants given ${st.tr} improved than participants not given ${st.tr}?`, correct: d,
          wrongs: pos([W(Math.round((X * (n1 + n2)) / 100) - k2, "formula_misuse", "전체 인원에 백분율을 곱했다."), W(k1, "step_missing", "처치 쪽 개선 인원만 답했다."), W(Math.round((X * n2) / 100) - k2 || 1, "axis_misread", "비처치 인원에 백분율을 곱했다."), W(X - Math.round((100 * k2) / n2), "unit_error", "백분율의 차를 답했다."), W(d + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== d),
          verificationJs: figJs({ X }, fig, `${GET_JS}const n2=g('participants not given'), n1=g('total participants')-n2; if (n1<=0||g('improved, not given')>n2) throw new Error('인원 오류'); return P.X*n1/100 - g('improved, not given');`),
          trace: [[`처치 인원 = ${n1 + n2} - ${n2} = ${n1} 이다.`, "Recover the treatment count."], [`처치 쪽 개선 인원 = ${X}% × ${n1} = ${k1} 이다.`, "Percent to count."], [`비처치 쪽 개선 인원은 ${k2} 이다.`, "Read the control count."], ["두 개선 인원을 비교한다.", "Compare counts."], [`차 = ${k1} - ${k2} = ${d} 이다.`, "Difference."]], variant: "count_from_percent",
        }, fig);
      },
    },
    {
      op: "constraint_select", structure: "현재 배정 방법을 읽고, 인과 결론을 가능하게 하는 설계 수정(또는 수정 불필요)을 고름", extra: "무작위 배정 여부를 판단해 '무작위 배정으로 바꾸기' / '이미 무작위라 불필요' 중 하나를 고르고 참가자 수 늘리기 같은 무관한 수정(함정)을 배제 — medium 은 비율 계산",
      concepts: ["무작위 배정", "실험 설계 수정", "인과 결론의 조건"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const st = study(rng); const { n1, n2 } = sizes(rng); const k1 = imp(rng, n1), k2 = imp(rng, n2); const rnd = rng.chance(0.5);
        const fig = factFig(`Experiment on ${st.tr}`, rowsOf(st, rnd ? rng.pick(RANDOM_ASSIGN) : rng.pick(CHOICE_ASSIGN), n1, n2, k1, k2), H);
        const o = {
          ra: `Use a random process to decide which participants are given ${st.tr}.`,
          ok: `No change to the assignment is needed, because participants were already assigned at random.`,
          big: `Double the number of participants but keep the same way of assigning ${st.tr}.`,
          only: `Include only participants who ${st.conf}.`,
        };
        const correct = rnd ? o.ok : o.ra; const wrongs = [{ text: rnd ? o.ra : o.ok, reason: rnd ? "이미 무작위인데 바꾸라고 했다." : "스스로 선택했는데 무작위라고 보았다." }, { text: o.big, reason: "참가자 수만 늘리면 혼란 변수가 사라지지 않는다." }, { text: o.only, reason: "한 부류만 넣으면 일반화가 좁아질 뿐 배정 문제를 풀지 못한다." }];
        return statementInst(rng, {
          stimulus: intro(rng, st), question: `The researchers want to conclude that ${st.tr} causes improvement. Which of the following is the most appropriate recommendation about the design?`, correct, wrongs, figure: fig, P: { ra: o.ra, ok: o.ok },
          body: `${GET_JS}${SUM}const want=/^random/i.test(String(g('how participants were assigned'))) ? P.ok : P.ra; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`배정 방법: ${rnd ? "무작위" : "스스로 선택"}.`, "Read the assignment method."], ["인과 결론에는 처치를 무작위로 배정해야 한다.", "Causation needs random assignment."], [rnd ? "이미 무작위로 배정되었다." : "현재는 참가자가 스스로 골라 혼란 변수가 생길 수 있다.", "Is the condition met?"], ["참가자 수를 늘리는 것은 배정 문제를 해결하지 못한다.", "More participants is not the fix."], [rnd ? "따라서 배정 방법을 바꿀 필요가 없다." : "따라서 무작위 배정으로 바꿔야 한다.", "Recommendation."]], variant: "design_fix",
        });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "treatment_rate", structure: "처치 쪽 개선 백분율을 구함", extra: "easy: 비율", concepts: ["비율"],
      gen(rng) {
        const st = study(rng); const { n1, n2 } = sizes(rng); const k1 = imp(rng, n1), k2 = imp(rng, n2); const p = (100 * k1) / n1;
        const fig = factFig(`Experiment on ${st.tr}`, rowsOf(st, rng.pick([...RANDOM_ASSIGN, ...CHOICE_ASSIGN]), n1, n2, k1, k2), H);
        return figInst(rng, { stimulus: intro(rng, st), question: `What percent of the participants given ${st.tr} improved?`, correct: p, wrongs: pos([W(100 - p, "opposite", "개선되지 않은 비율."), W(k1, "unit_error", "인원."), W(Math.round((100 * k1) / (n1 + n2)), "formula_misuse", "전체로 나눔."), W(p + 5, "other", "계산 오류.")]).filter((w) => w.v !== p),
          verificationJs: figJs({}, fig, `${GET_JS}${SUM}return 100*g('improved, given')/g('participants given');`), trace: [[`개선 ${k1}, 인원 ${n1}.`, "Read the values."], [`${k1}/${n1} = ${p}%.`, "Percent."]], variant: "treatment_rate" }, fig);
      },
    },
    {
      lv: "medium", name: "rate_missing_count", structure: "총 인원에서 비처치 인원을 빼 처치 인원을 구한 뒤 처치 쪽 개선 백분율을 구함", extra: "medium: 뺄셈 → 비율", concepts: ["인원 복원", "비율"],
      gen(rng) {
        const st = study(rng); const { n1, n2 } = sizes(rng); const k1 = imp(rng, n1), k2 = imp(rng, n2); const p = (100 * k1) / n1;
        const fig = factFig(`Experiment on ${st.tr}`, rowsOf(st, rng.pick([...RANDOM_ASSIGN, ...CHOICE_ASSIGN]), n1, n2, k1, k2, { hideN1: true }), H);
        return figInst(rng, { stimulus: intro(rng, st), question: `What percent of the participants given ${st.tr} improved?`, correct: p, wrongs: pos([W(Math.round((100 * k1) / (n1 + n2)), "formula_misuse", "전체로 나눔."), W(Math.round((100 * k1) / n2), "axis_misread", "비처치 인원으로 나눔."), W(100 - p, "opposite", "개선되지 않은 비율."), W(k1, "unit_error", "인원."), W(p + 5, "other", "계산 오류.")]).filter((w) => w.v !== p),
          verificationJs: figJs({}, fig, `${GET_JS}const n1=g('total participants')-g('participants not given'); if (n1<=0) throw new Error('인원'); return 100*g('improved, given')/n1;`), trace: [[`처치 인원 = ${n1 + n2} - ${n2} = ${n1}.`, "Recover the count."], [`개선 ${k1}.`, "Read improved."], [`${k1}/${n1} = ${p}%.`, "Percent."]], variant: "rate_missing_count" }, fig);
      },
    },
  ],
});
