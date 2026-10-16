// evaluating_statistical_claims.causal_vs_association.BR.P — 두 조건(처치 사용/비사용)의 평균 점수 막대와 지문의 연구 설계(무작위 배정·무작위 표본 여부)를 함께 읽어
// 인과/연관 결론·일반화 범위를 고르거나 처치 효과(평균 차·퍼센트)를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs, oneDec } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { gInst } from "../graph-kit";
import { STUDIES, type Study } from "./_t7-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v) && Math.abs(w.v) < 1000);
type Bars = { type: "data"; kind: "bar"; categories: string[]; series: { values: number[] }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number };
const CATS = ["Users", "Non-users"];
const barFig = (st: Study, vals: number[], yStep: number, total: boolean): Bars => ({ type: "data", kind: "bar", categories: CATS, series: [{ values: vals }], xTitle: "Group", yTitle: `${total ? "Total" : "Mean"} ${st.out} (points)`, yMin: 0, yMax: (Math.max(...vals) / yStep + 1) * yStep, yStep });
const ASSIGN_R = ["The participants were assigned to the two groups at random by a coin flip.", "Names were drawn at random to decide who would use it.", "A computer randomly assigned each participant to a group."];
const ASSIGN_C = ["Each participant chose for themselves whether to use it.", "Volunteers decided whether to use it.", "Participants picked the group they preferred."];
const intro = (rng: Rng, st: Study, rnd: boolean) => `${rng.pick([
  `A study examined whether ${st.tr} is related to ${st.out}s among ${st.ent}. Some participants used ${st.tr} and the others did not.`,
  `Researchers compared the ${st.out}s of ${st.ent} who used ${st.tr} with those of ${st.ent} who did not.`,
  `To investigate ${st.tr}, a team recorded the ${st.out} of each participant among a set of ${st.ent}, some of whom used it.`,
])} ${rnd ? rng.pick(ASSIGN_R) : rng.pick(ASSIGN_C)} The graph shows the results.`;
const RD = (rnd: boolean, rng: Rng, st: Study, sel: string) => `${intro(rng, st, rnd)} ${sel}`;
const BAR_JS = "const nm=FIGURE.categories, v=FIGURE.series[0].values; if (v.length!==2||v.some(x=>typeof x!=='number'||x<=0)) throw new Error('값 오류'); const u=v[nm.indexOf('Users')], nu=v[nm.indexOf('Non-users')]; if (nm.indexOf('Users')<0||nm.indexOf('Non-users')<0) throw new Error('막대 없음');\n";
const meanScene = (rng: Rng) => { const st = rng.pick(STUDIES); const yStep = rng.pick([5, 10]); const a = yStep * rng.int(4, 9), b = yStep * rng.int(4, 9); if (a === b) throw new GenFail("eq"); return { st, yStep, a, b, fig: barFig(st, [a, b], yStep, false) }; };

export const ITEM = defineItem({
  prefix: "esc", itemId: "evaluating_statistical_claims.causal_vs_association.BR.P",
  hard: [
    {
      op: "repr_shift", structure: "배정 방법(무작위 / 스스로 선택)과 두 평균 막대의 대소를 함께 읽어 인과·연관 서술과 방향을 동시에 고름", extra: "배정 방법 서술을 인과 가능 여부로 번역하고 막대의 대소로 방향까지 맞춰야 함(방향만 맞거나 인과만 맞는 선지가 함정) — medium 은 평균 합산",
      concepts: ["무작위 배정과 인과", "관찰 연구와 연관", "평균 비교"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const { st, a, b, fig } = meanScene(rng); const rnd = rng.chance(0.5);
        const t = rng.pick([
          { c: `Using ${st.tr} caused a #D mean ${st.out} among the participants.`, s: `Using ${st.tr} is associated with a #D mean ${st.out}, but the study does not show that it caused the difference.` },
          { c: `The study shows that ${st.tr} led to a #D mean ${st.out} for these participants.`, s: `Participants who used ${st.tr} had a #D mean ${st.out}, but the study cannot show that ${st.tr} was the cause.` },
        ]);
        const D = (hi: boolean) => (hi ? "higher" : "lower"); const up = a > b;
        const opts = { ch: t.c.replace("#D", D(up)), cl: t.c.replace("#D", D(!up)), sh: t.s.replace("#D", D(up)), sl: t.s.replace("#D", D(!up)) };
        const correct = rnd ? opts.ch : opts.sh;
        const wrongs = rnd ? [{ text: opts.sh, reason: "무작위 배정인데 인과를 부정했다." }, { text: opts.cl, reason: "방향을 반대로 읽었다." }, { text: opts.sl, reason: "인과·방향 모두 틀렸다." }] : [{ text: opts.ch, reason: "스스로 선택한 연구에서 인과를 주장했다." }, { text: opts.sl, reason: "방향을 반대로 읽었다." }, { text: opts.cl, reason: "인과·방향 모두 틀렸다." }];
        return statementInst(rng, {
          stimulus: intro(rng, st, rnd), question: rng.pick(["Which conclusion is best supported by the information shown?", "Which statement about the study is most appropriate?"]), correct, wrongs, figure: fig, P: { c: t.c, s: t.s, rnd: rnd ? 1 : 0 },
          body: `${BAR_JS}const want=(P.rnd?P.c:P.s).replace('#D', u>nu?'higher':'lower'); const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`처치 결정 방법: ${rnd ? "무작위 배정" : "참가자가 스스로 선택"}.`, "How was the treatment decided?"], [rnd ? "무작위 배정이면 두 조건의 다른 차이가 고르게 섞여 인과 결론이 가능하다." : `스스로 선택하면 사용자가 ${st.conf} 같은 다른 차이가 있을 수 있어 인과를 말할 수 없다.`, "Random assignment vs. self-selection."], [`막대에서 평균을 읽는다: 사용 ${a}, 비사용 ${b}.`, "Compare the bars."], [`사용자 평균이 더 ${up ? "높다" : "낮다"}.`, "Direction."], [rnd ? "따라서 인과 결론 + 해당 방향." : "따라서 연관만 + 해당 방향.", "Combine both judgments."]], variant: "cause_or_association_with_direction_bar",
        });
      },
    },
    {
      op: "compose_kind", structure: "무작위 배정 실험의 두 조건 총점 막대와 인원에서 각 평균을 구하고 그 차(처치 효과의 추정치)를 구함", extra: "총점 ÷ 인원으로 평균을 먼저 구한 뒤 차를 구하고, 무작위 배정이라 이 차를 처치의 효과로 해석 — 총점의 차를 쓰면 틀림 — medium 은 합친 평균",
      concepts: ["평균", "무작위 배정과 인과", "처치 효과의 추정"],
      gen(rng) {
        for (let t = 0; t < 200; t++) {
          const st = rng.pick(STUDIES); const n1 = rng.pick([20, 40, 50, 100]), n2 = rng.pick([20, 40, 50, 100]); if (n1 === n2) continue; const a = rng.int(4, 9), b = rng.int(3, 8); if (a <= b) continue; const T1 = a * n1, T2 = b * n2; if (T1 % 100 || T2 % 100 || T1 === T2) continue; const fig = barFig(st, [T1, T2], 100, true); const d = a - b;
          return gInst(rng, {
            stimulus: `${intro(rng, st, true)} In all, ${n1} participants used ${st.tr} and ${n2} did not; the bars show the total ${st.out} points of each group.`,
            question: rng.pick([`Based on the study, by how many points did ${st.tr} increase the mean ${st.out} of the participants?`, `What is the estimated effect of ${st.tr} on the mean ${st.out}, in points, for the participants in this study?`]), correct: d,
            wrongs: pos([W((T1 - T2) / (n1 + n2), "formula_misuse", "총점의 차를 전체 인원으로 나눴다."), W(T1 - T2, "step_missing", "총점의 차를 답했다."), W(a, "step_missing", "사용자 평균만 답했다."), W((T1 + T2) / (n1 + n2), "formula_misuse", "전체 평균을 구했다."), W(d + 1, "other", "계산 중 어긋났다."), W(b, "axis_misread", "비사용자 평균을 답했다.")].filter((w) => w.v !== d && oneDec(w.v))),
            verificationJs: figJs({ n1, n2 }, fig, `${BAR_JS}return u / P.n1 - nu / P.n2;`),
            trace: [["처치는 무작위로 배정되었으므로 평균의 차를 처치 효과로 볼 수 있다.", "Random assignment allows a causal estimate."], [`막대에서 읽는다: 사용 총점 ${T1}, 비사용 총점 ${T2}.`, "Read the totals."], [`사용자 평균 = ${T1} ÷ ${n1} = ${a} 이다.`, "Mean for users."], [`비사용자 평균 = ${T2} ÷ ${n2} = ${b} 이다.`, "Mean for non-users."], [`효과 추정 = ${a} - ${b} = ${d} 이다.`, "Difference of means."]], variant: "effect_from_totals_bar",
          }, fig);
        }
        throw new GenFail("totals");
      },
    },
    {
      op: "constraint_select", structure: "참가자 선택(무작위 표본 여부)과 처치 배정(무작위 여부)을 읽고, 평균이 더 높은 집단을 막대에서 읽어 인과 여부·일반화 범위를 함께 고름", extra: "2×2 판단(무작위 배정 → 인과, 무작위 표본 → 모집단 일반화)에 막대의 더 높은 집단을 결합 — medium 은 한 조건만",
      concepts: ["무작위 배정과 인과", "무작위 표집과 일반화", "연구 설계 판단"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const { st, a, b, fig } = meanScene(rng); const rs = rng.chance(0.5), ra = rng.chance(0.5); const grp = a > b ? "participants who used it" : "participants who did not use it";
        const sel = rs ? `The ${st.ent} were chosen at random from a full list of ${st.pop}.` : `The ${st.ent} were volunteers who responded to a notice.`;
        const o = { cp: `It can show that ${st.tr} affects ${st.out}s, and the result applies to all ${st.pop}.`, cs: `It can show that ${st.tr} affects ${st.out}s, but only for participants like those in the study.`, ap: `It can show only an association between ${st.tr} and ${st.out}s, and the association applies to all ${st.pop}.`, as: `It can show only an association between ${st.tr} and ${st.out}s, and only for participants like those in the study.` };
        const tag = (x: string) => x.replace(/\.$/, `, with the higher mean for the ${grp}.`);
        const key = (ra ? "c" : "a") + (rs ? "p" : "s") as keyof typeof o; const correct = tag(o[key]);
        const wrongs = (Object.keys(o) as (keyof typeof o)[]).filter((k) => k !== key).map((k) => ({ text: tag(o[k]), reason: k[0] !== key[0] ? "배정 방법(인과 여부)을 잘못 판단했다." : "선택 방법(일반화 범위)을 잘못 판단했다." }));
        return statementInst(rng, {
          stimulus: `${intro(rng, st, ra)} ${sel}`, question: rng.pick(["Which statement best describes what the study can show?", "Which conclusion is appropriate based on how the study was designed?"]), correct, wrongs, figure: fig, P: { cp: tag(o.cp), cs: tag(o.cs), ap: tag(o.ap), as: tag(o.as), ra: ra ? 1 : 0, rs: rs ? 1 : 0 },
          body: `${BAR_JS}const key=(P.ra?'c':'a')+(P.rs?'p':'s'); const want=P[key]; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); if (!want.includes(u>nu?'participants who used it':'participants who did not use it')) throw new Error('방향 불일치'); return i;`,
          trace: [[`참가자 선택: ${rs ? "무작위 표본" : "무작위가 아님"}.`, "How were participants selected?"], [`처치 결정: ${ra ? "무작위 배정" : "스스로 선택"}.`, "How was the treatment decided?"], [`막대에서 더 높은 평균은 ${a > b ? "사용자" : "비사용자"} 집단이다.`, "Read the higher bar."], [ra ? "무작위 배정 → 인과 결론 가능." : "무작위 배정이 아님 → 연관만.", "Cause or association."], [rs ? `무작위 표본 → ${st.pop} 전체로 일반화.` : "무작위 표본이 아님 → 참가자와 비슷한 사람들로 한정.", "Scope."]], variant: "two_by_two_design_bar",
        });
      },
    },
    {
      op: "compare_scenarios", structure: "무작위 배정 실험의 두 평균 막대에서 처치로 인한 평균의 증가율(퍼센트)을 구함", extra: "평균의 차를 비사용자 평균(기준)으로 나눠 퍼센트로 바꿔야 함(사용자 평균으로 나누면 함정) — medium 은 평균의 차",
      concepts: ["평균", "무작위 배정과 인과", "퍼센트 변화"],
      gen(rng) {
        for (let t = 0; t < 200; t++) {
          const { st, a, b, yStep } = meanScene(rng); if (a <= b) continue; const pct = ((a - b) * 100) / b; if (!oneDec(pct)) continue; const fig = barFig(st, [a, b], yStep, false); const c = pct;
          return gInst(rng, {
            stimulus: intro(rng, st, true),
            question: rng.pick([`Based on the study, by what percent did ${st.tr} increase the mean ${st.out} of the participants, relative to those who did not use it?`, `Relative to the participants who did not use it, the mean ${st.out} of the users was how many percent greater?`]), correct: c,
            wrongs: pos([W(((a - b) * 100) / a, "formula_misuse", "사용자 평균으로 나눴다."), W(a - b, "unit_error", "점수 차를 퍼센트로 답했다."), W((a * 100) / b, "step_missing", "비를 퍼센트로만 바꿨다(1 을 빼지 않음)."), W(c + 5, "other", "계산 중 어긋났다."), W(((a + b) * 100) / b, "formula_misuse", "합으로 계산했다.")].filter((w) => Math.abs(w.v - c) > 1e-9 && oneDec(w.v))),
            verificationJs: figJs({}, fig, `${BAR_JS}return (u - nu) * 100 / nu;`),
            trace: [["처치는 무작위로 배정되었으므로 평균의 차를 처치 효과로 볼 수 있다.", "Random assignment allows a causal estimate."], [`막대에서 읽는다: 사용 ${a}, 비사용 ${b}.`, "Read the bars."], [`차 = ${a} - ${b} = ${a - b} 이다.`, "Difference of means."], [`기준은 비사용자 평균 ${b} 이다.`, "The reference is the non-users' mean."], [`증가율 = ${a - b} ÷ ${b} × 100 = ${fmtNum(c)}% 이다.`, "Convert to a percent."]], variant: "percent_effect_bar",
          }, fig);
        }
        throw new GenFail("pct");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "mean_difference", structure: "두 조건의 평균 차를 구함", extra: "easy: 뺄셈", concepts: ["평균 비교", "평균의 차"],
      gen(rng) {
        for (let t = 0; t < 50; t++) {
          const { st, a, b, fig } = meanScene(rng); if (a <= b) continue; const rnd = rng.chance(0.5);
          return gInst(rng, { stimulus: intro(rng, st, rnd), question: `How many points greater was the mean ${st.out} of the users than that of the non-users?`, correct: a - b, wrongs: pos([W(a + b, "sign_error", "합."), W(a, "step_missing", "한 평균."), W(a - b + 5, "other", "계산 오류."), W(b, "axis_misread", "다른 막대.")]).filter((w) => w.v !== a - b), verificationJs: figJs({}, fig, `${BAR_JS}return u - nu;`), trace: [[`평균 ${a}, ${b}.`, "Read the means."], [`${a} - ${b} = ${a - b}.`, "Subtract."]], variant: "mean_difference_bar" }, fig);
        }
        throw new GenFail("easy");
      },
    },
    {
      lv: "medium", name: "combined_mean", structure: "두 조건의 평균 막대와 인원으로 전체 참가자의 평균을 구함", extra: "medium: 가중평균", concepts: ["평균", "가중평균"],
      gen(rng) {
        for (let t = 0; t < 200; t++) {
          const { st, a, b, fig } = meanScene(rng); const n1 = rng.pick([10, 20, 30, 40, 60]), n2 = rng.pick([10, 20, 30, 40, 60]); if (n1 === n2) continue; const c = (a * n1 + b * n2) / (n1 + n2); if (!oneDec(c)) continue; const rnd = rng.chance(0.5);
          return gInst(rng, { stimulus: `${intro(rng, st, rnd)} In all, ${n1} participants used ${st.tr} and ${n2} did not.`, question: `What was the mean ${st.out}, in points, of all the participants combined?`, correct: c, wrongs: pos([W((a + b) / 2, "formula_misuse", "두 평균의 단순 평균을 구했다."), W(a * n1 + b * n2, "step_missing", "총점을 답했다."), W(a, "step_missing", "한 평균만 답했다."), W(c + 5, "other", "계산 오류.")].filter((w) => Math.abs(w.v - c) > 1e-9 && oneDec(w.v))), verificationJs: figJs({ n1, n2 }, fig, `${BAR_JS}return (u * P.n1 + nu * P.n2) / (P.n1 + P.n2);`), trace: [[`막대에서 읽는다: ${a}, ${b}.`, "Read the means."], [`총점 = ${a}×${n1} + ${b}×${n2} = ${a * n1 + b * n2}, 인원 ${n1 + n2}.`, "Total and count."], [`평균 = ${fmtNum(c)}.`, "Divide."]], variant: "combined_mean_bar" }, fig);
        }
        throw new GenFail("med");
      },
    },
  ],
});
void RD;
