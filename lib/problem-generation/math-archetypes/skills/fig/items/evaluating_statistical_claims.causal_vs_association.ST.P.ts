// evaluating_statistical_claims.causal_vs_association.ST.P — 연구 정보(처치 배정 방법·참가자 선택 방법·두 조건의 인원과 평균)를 '항목 | 값' 자료로 주고
// 인과 결론(무작위 배정) / 연관 결론(스스로 선택)과 일반화 범위(무작위 표본)를 판단한다. verification_js 는 FIGURE 의 배정·선택 방법과 평균을 읽어 정답 서술을 다시 만든다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, oneDec } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { CHOICE_ASSIGN, factFig, GET_JS, NONRANDOM_SAMPLE, RANDOM_ASSIGN, RANDOM_SAMPLE, study, sumJs, type FactRow, type Study } from "./_t7-kit";

const H = "Study detail";
const intro = (rng: Rng, st: Study) => rng.pick([
  `A study examined whether ${st.tr} is related to ${st.out}s among ${st.ent}. Some participants used ${st.tr} and the others did not. The table shows information about the study.`,
  `Researchers compared the ${st.out}s of ${st.ent} who used ${st.tr} with those of ${st.ent} who did not. Details of the study are shown in the table.`,
  `The table shown describes a study of ${st.tr} and ${st.out}s. Each participant either used ${st.tr} or did not, and each participant's ${st.out} was recorded.`,
  `To investigate ${st.tr}, a team recorded the ${st.out} of each participant among a set of ${st.ent} after some participants used it and the rest did not. The information in the table shown describes the study.`,
]);
const counts = (rng: Rng) => { const n1 = rng.int(10, 60) * 2, n2 = rng.int(10, 60) * 2; return { n1, n2, n: n1 + n2 }; };
const baseRows = (st: Study, sel: string, asg: string, n1: number, n2: number): FactRow[] => [["How participants were selected", sel], [`How use of ${st.tr} was decided`, asg], [`Participants who used ${st.tr}`, n1], [`Participants who did not use ${st.tr}`, n2], ["Total participants", n1 + n2]];
const SUM = sumJs(["participants who used", "participants who did not"], "total participants");
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0);

export const ITEM = defineItem({
  prefix: "esc", itemId: "evaluating_statistical_claims.causal_vs_association.ST.P",
  hard: [
    {
      op: "repr_shift", structure: "배정 방법(무작위 / 스스로 선택)과 두 평균의 대소를 함께 읽어 인과·연관 서술과 방향을 동시에 고름", extra: "배정 방법 서술을 인과 가능 여부로 번역하고, 평균의 대소로 방향까지 맞춰야 함(방향만 맞거나 인과만 맞는 선지가 함정) — medium 은 평균 계산",
      concepts: ["무작위 배정과 인과", "관찰 연구와 연관", "평균 비교"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const st = study(rng); const { n1, n2 } = counts(rng); const rnd = rng.chance(0.5); const a = rng.int(40, 90), b = rng.int(40, 90); if (a === b) throw new GenFail("eq");
        const rows: FactRow[] = [...baseRows(st, rng.pick(NONRANDOM_SAMPLE), rnd ? rng.pick(RANDOM_ASSIGN) : rng.pick(CHOICE_ASSIGN), n1, n2), [`Mean ${st.out}, users (points)`, a], [`Mean ${st.out}, non-users (points)`, b]];
        const fig = factFig(`Study of ${st.tr}`, rows, H);
        const t = rng.pick([
          { c: `Using ${st.tr} caused a #D mean ${st.out} among the participants.`, s: `Using ${st.tr} is associated with a #D mean ${st.out}, but the study does not show that it caused the difference.` },
          { c: `The study shows that ${st.tr} led to a #D mean ${st.out} for these participants.`, s: `Participants who used ${st.tr} had a #D mean ${st.out}, but the study cannot show that ${st.tr} was the cause.` },
        ]);
        const D = (hi: boolean) => (hi ? "higher" : "lower"); const up = a > b;
        const opts = { ch: t.c.replace("#D", D(up)), cl: t.c.replace("#D", D(!up)), sh: t.s.replace("#D", D(up)), sl: t.s.replace("#D", D(!up)) };
        const correct = rnd ? opts.ch : opts.sh;
        const wrongs = rnd ? [{ text: opts.sh, reason: "무작위 배정인데 인과를 부정했다." }, { text: opts.cl, reason: "방향을 반대로 읽었다." }, { text: opts.sl, reason: "인과·방향 모두 틀렸다." }] : [{ text: opts.ch, reason: "스스로 선택한 연구에서 인과를 주장했다." }, { text: opts.sl, reason: "방향을 반대로 읽었다." }, { text: opts.cl, reason: "인과·방향 모두 틀렸다." }];
        return statementInst(rng, {
          stimulus: intro(rng, st), question: rng.pick(["Which conclusion is best supported by the information shown?", "Which statement about the study is most appropriate?"]), correct, wrongs, figure: fig, P: { c: t.c, s: t.s },
          body: `${GET_JS}${SUM}const a=g(', users'), b=g('non-users'); if (a===b) throw new Error('같음'); const rnd=/^random/i.test(String(g('how use of'))); const want=(rnd?P.c:P.s).replace('#D', a>b?'higher':'lower'); const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`처치 결정 방법을 읽는다: ${rnd ? "무작위 배정" : "참가자가 스스로 선택"}.`, "How was the treatment decided?"], [rnd ? "무작위 배정이면 두 조건의 다른 차이가 고르게 섞여 인과 결론이 가능하다." : `스스로 선택하면 사용자가 ${st.conf} 같은 다른 차이가 있을 수 있어 인과를 말할 수 없다.`, "Random assignment vs. self-selection."], [`평균: 사용 ${a}, 비사용 ${b} 이다.`, "Compare the means."], [`사용자 평균이 더 ${up ? "높다" : "낮다"}.`, "Direction."], [rnd ? "따라서 인과 결론 + 해당 방향." : "따라서 연관만 + 해당 방향.", "Combine both judgments."]], variant: "cause_or_association_with_direction",
        });
      },
    },
    {
      op: "compose_kind", structure: "무작위 배정 실험의 두 조건 총점·인원에서 각 평균을 구하고 그 차(처치 효과의 추정치)를 구함", extra: "총점 ÷ 인원으로 평균을 먼저 구한 뒤 차를 구하고, 무작위 배정이라 이 차를 처치의 효과로 해석 — medium 은 평균 하나",
      concepts: ["평균", "무작위 배정과 인과", "처치 효과의 추정"],
      gen(rng) {
        const st = study(rng); const { n1, n2 } = counts(rng); const a = rng.int(50, 90) + rng.pick([0, 0.5]), b = a - rng.int(2, 15) - rng.pick([0, 0.5]); const T1 = a * n1, T2 = b * n2; if (!Number.isInteger(T1) || !Number.isInteger(T2) || b <= 0) throw new GenFail("int"); const d = a - b;
        const rows: FactRow[] = [...baseRows(st, rng.pick(NONRANDOM_SAMPLE), rng.pick(RANDOM_ASSIGN), n1, n2), [`Total ${st.out} points, users`, T1], [`Total ${st.out} points, non-users`, T2]];
        const fig = factFig(`Experiment on ${st.tr}`, rows, H);
        return figInst(rng, {
          stimulus: intro(rng, st), question: rng.pick([`Based on the study, by how many points did ${st.tr} increase the mean ${st.out} of the participants?`, `What is the estimated effect of ${st.tr} on the mean ${st.out}, in points, for the participants in this study?`]), correct: d, fmt: fmtNum,
          wrongs: pos([W((T1 - T2) / (n1 + n2), "formula_misuse", "총점의 차를 전체 인원으로 나눴다."), W(T1 - T2, "step_missing", "총점의 차를 답했다."), W(a, "step_missing", "사용자 평균만 답했다."), W((T1 + T2) / (n1 + n2), "formula_misuse", "전체 평균을 구했다."), W(d + 1, "other", "계산 중 어긋났다."), W(b, "axis_misread", "비사용자 평균을 답했다."), W(d * 2, "other", "차를 두 배로 셌다.")]).filter((w) => w.v !== d && oneDec(w.v) && Math.abs(w.v) < 1000),
          verificationJs: figJs({}, fig, `${GET_JS}${SUM}if (!/^random/i.test(String(g('how use of')))) throw new Error('무작위 배정 아님'); return g('points, users')/g('participants who used') - g('non-users')/g('participants who did not');`),
          trace: [["처치는 무작위로 배정되었으므로 평균의 차를 처치 효과로 볼 수 있다.", "Random assignment allows a causal estimate."], [`사용자 평균 = ${T1} ÷ ${n1} = ${fmtNum(a)} 이다.`, "Mean for users."], [`비사용자 평균 = ${T2} ÷ ${n2} = ${fmtNum(b)} 이다.`, "Mean for non-users."], ["두 조건의 인원이 달라 총점의 차를 그대로 쓰면 안 된다.", "Totals are not comparable."], [`효과 추정 = ${fmtNum(a)} - ${fmtNum(b)} = ${fmtNum(d)} 이다.`, "Difference of means."]], variant: "effect_from_totals",
        }, fig);
      },
    },
    {
      op: "constraint_select", structure: "참가자 선택(무작위 표본 여부)과 처치 배정(무작위 여부) 두 조건을 모두 읽어 인과 여부와 일반화 범위를 함께 고름", extra: "2×2 판단(무작위 배정 → 인과, 무작위 표본 → 모집단 일반화)을 동시에 적용 — medium 은 한 조건만",
      concepts: ["무작위 배정과 인과", "무작위 표집과 일반화", "연구 설계 판단"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const st = study(rng); const { n1, n2 } = counts(rng); const rs = rng.chance(0.5), ra = rng.chance(0.5);
        const sel = rs ? `${rng.pick(RANDOM_SAMPLE)} of ${st.pop}` : `${rng.pick(NONRANDOM_SAMPLE)} among ${st.pop}`;
        const fig = factFig(`Study of ${st.tr}`, baseRows(st, sel, ra ? rng.pick(RANDOM_ASSIGN) : rng.pick(CHOICE_ASSIGN), n1, n2), H);
        const o = { cp: `It can show that ${st.tr} affects ${st.out}s, and the result applies to all ${st.pop}.`, cs: `It can show that ${st.tr} affects ${st.out}s, but only for participants like those in the study.`, ap: `It can show only an association between ${st.tr} and ${st.out}s, and the association applies to all ${st.pop}.`, as: `It can show only an association between ${st.tr} and ${st.out}s, and only for participants like those in the study.` };
        const key = (ra ? "c" : "a") + (rs ? "p" : "s") as keyof typeof o; const correct = o[key];
        const wrongs = (Object.keys(o) as (keyof typeof o)[]).filter((k) => k !== key).map((k) => ({ text: o[k], reason: k[0] !== key[0] ? "배정 방법(인과 여부)을 잘못 판단했다." : "선택 방법(일반화 범위)을 잘못 판단했다." }));
        return statementInst(rng, {
          stimulus: `${intro(rng, st)} The researchers recorded each participant's ${st.out} at the end of the study.`, question: rng.pick(["Which statement best describes what the study can show?", "Which conclusion is appropriate based on how the study was designed?"]), correct, wrongs, figure: fig, P: o,
          body: `${GET_JS}${SUM}const ra=/^random/i.test(String(g('how use of'))), rs=/^random/i.test(String(g('how participants were selected'))); const want=P[(ra?'c':'a')+(rs?'p':'s')]; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`참가자 선택: ${rs ? "무작위 표본" : "무작위가 아님"}.`, "How were participants selected?"], [`처치 결정: ${ra ? "무작위 배정" : "스스로 선택"}.`, "How was the treatment decided?"], [ra ? "무작위 배정 → 인과 결론 가능." : "무작위 배정이 아님 → 연관만.", "Cause or association."], [rs ? `무작위 표본 → ${st.pop} 전체로 일반화.` : "무작위 표본이 아님 → 참가자와 비슷한 사람들로 한정.", "Scope."], ["두 판단을 모두 만족하는 서술을 고른다.", "Choose the statement matching both."]], variant: "two_by_two_design",
        });
      },
    },
    {
      op: "compare_scenarios", structure: "두 연구(작은 무작위 배정 실험 / 큰 관찰 연구)의 정보를 비교해 인과 주장을 뒷받침하는 연구를 고름", extra: "참가자 수(함정)가 아니라 배정 방법으로 판단해야 함 — medium 은 연구 하나",
      concepts: ["무작위 배정과 인과", "관찰 연구", "연구 비교"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const st = study(rng); const s1 = { n1: rng.int(8, 25) * 2, n2: rng.int(8, 25) * 2 }, s2 = { n1: rng.int(80, 200) * 2, n2: rng.int(80, 200) * 2 }; const rFirst = rng.chance(0.5); const [X, Y] = rFirst ? [s1, s2] : [s2, s1];
        const rows: FactRow[] = [["Study 1: how use was decided", rFirst ? rng.pick(RANDOM_ASSIGN) : rng.pick(CHOICE_ASSIGN)], ["Study 1: participants who used it", X.n1], ["Study 1: participants who did not", X.n2], ["Study 1: total participants", X.n1 + X.n2], ["Study 2: how use was decided", rFirst ? rng.pick(CHOICE_ASSIGN) : rng.pick(RANDOM_ASSIGN)], ["Study 2: participants who used it", Y.n1], ["Study 2: participants who did not", Y.n2], ["Study 2: total participants", Y.n1 + Y.n2]];
        const fig = factFig(`Two studies of ${st.tr}`, rows, H); const rN = rFirst ? "1" : "2", oN = rFirst ? "2" : "1";
        const t = rng.pick([{ ok: "Study #, because its participants were randomly assigned", big: "Study #, because it had more participants", both: "Both studies, because each compared users with non-users", neither: `Neither study, because neither included all ${st.pop}` }, { ok: "Only Study #, since chance alone decided who used it", big: "Only Study #, since its larger size rules out other explanations", both: "Both studies, since both found a difference between the conditions", neither: "Neither study, since no study can show cause and effect" }]);
        const correct = t.ok.replace("#", rN) + "."; const wrongs = [{ text: t.big.replace("#", oN) + ".", reason: "참가자 수로 판단했다." }, { text: t.both + ".", reason: "배정 방법 차이를 무시했다." }, { text: t.neither + ".", reason: "일반화와 인과를 혼동했다." }];
        return statementInst(rng, {
          stimulus: `Two studies investigated whether ${st.tr} improves ${st.out}s among ${st.ent}. ${rng.pick(["The table shows how each study was run.", "Details of both studies are shown in the table.", "The information in the table shown describes both studies."])}`,
          question: rng.pick([`Which study provides better evidence that ${st.tr} causes a change in ${st.out}?`, `Which study could support the claim that ${st.tr} causes higher ${st.out}s, and why?`]), correct, wrongs, figure: fig, P: { ok: t.ok },
          body: `${GET_JS}${sumJs(["study 1: participants who used", "study 1: participants who did not"], "study 1: total")}${sumJs(["study 2: participants who used", "study 2: participants who did not"], "study 2: total")}const r1=/^random/i.test(String(g('study 1: how'))), r2=/^random/i.test(String(g('study 2: how'))); if (r1===r2) throw new Error('같음'); const want=P.ok.replace('#', r1?'1':'2')+'.'; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`연구 1: ${rFirst ? "무작위 배정" : "스스로 선택"}, ${X.n1 + X.n2} 명.`, "Study 1."], [`연구 2: ${rFirst ? "스스로 선택" : "무작위 배정"}, ${Y.n1 + Y.n2} 명.`, "Study 2."], ["인과 결론에는 무작위 배정이 필요하다.", "Causation requires random assignment."], [`연구 ${oN} 은 크지만 스스로 선택해 다른 요인(예: ${st.conf})이 섞일 수 있다.`, "Size does not remove confounding."], [`따라서 연구 ${rN} 이 더 나은 근거이다.`, "Conclusion."]], variant: "small_experiment_vs_large_observational",
        });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "mean_difference", structure: "두 조건의 평균 차를 구함", extra: "easy: 뺄셈", concepts: ["평균 비교"],
      gen(rng) {
        const st = study(rng); const { n1, n2 } = counts(rng); const a = rng.int(50, 95), b = a - rng.int(2, 20);
        const fig = factFig(`Study of ${st.tr}`, [...baseRows(st, rng.pick(NONRANDOM_SAMPLE), rng.pick([...RANDOM_ASSIGN, ...CHOICE_ASSIGN]), n1, n2), [`Mean ${st.out}, users (points)`, a], [`Mean ${st.out}, non-users (points)`, b]], H);
        return figInst(rng, { stimulus: intro(rng, st), question: `How many points greater was the mean ${st.out} of the users than that of the non-users?`, correct: a - b, wrongs: pos([W(a + b, "sign_error", "합."), W(a, "step_missing", "한 평균."), W(n1 - n2 || 1, "axis_misread", "인원 차."), W(a - b + 2, "other", "계산 오류.")]).filter((w) => w.v !== a - b),
          verificationJs: figJs({}, fig, `${GET_JS}${SUM}return g(', users') - g('non-users');`), trace: [[`평균 ${a}, ${b}.`, "Read the means."], [`${a} - ${b} = ${a - b}.`, "Subtract."]], variant: "mean_difference" }, fig);
      },
    },
    {
      lv: "medium", name: "mean_from_total", structure: "한 조건의 총점과 인원으로 평균을 구함", extra: "medium: 총점 ÷ 인원", concepts: ["평균"],
      gen(rng) {
        const st = study(rng); const { n1, n2 } = counts(rng); const a = rng.int(50, 90) + rng.pick([0, 0.5]); const T1 = a * n1, T2 = rng.int(40, 90) * n2; if (!Number.isInteger(T1)) throw new GenFail("int");
        const fig = factFig(`Study of ${st.tr}`, [...baseRows(st, rng.pick(NONRANDOM_SAMPLE), rng.pick([...RANDOM_ASSIGN, ...CHOICE_ASSIGN]), n1, n2), [`Total ${st.out} points, users`, T1], [`Total ${st.out} points, non-users`, T2]], H);
        return figInst(rng, { stimulus: intro(rng, st), question: `What was the mean ${st.out}, in points, of the participants who used ${st.tr}?`, correct: a, fmt: fmtNum, wrongs: pos([W(T1 / (n1 + n2), "formula_misuse", "전체 인원으로 나눔."), W(T2 / n2, "axis_misread", "비사용자 평균."), W((T1 + T2) / (n1 + n2), "formula_misuse", "전체 평균."), W(a + 2, "other", "계산 오류."), W(a - 3, "other", "계산 오류."), W(a + 5, "other", "계산 오류.")]).filter((w) => w.v !== a && oneDec(w.v)),
          verificationJs: figJs({}, fig, `${GET_JS}${SUM}return g('points, users')/g('participants who used');`), trace: [[`총점 ${T1}, 인원 ${n1}.`, "Read the values."], ["평균 = 총점 ÷ 인원.", "Mean formula."], [`${T1} ÷ ${n1} = ${fmtNum(a)}.`, "Divide."]], variant: "mean_from_total" }, fig);
      },
    },
  ],
});
