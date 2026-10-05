// evaluating_statistical_claims.sampling_generalization.ST.P — 연구 정보(목표 모집단 크기·표집 명단·선택 방법·응답 수)를 '항목 | 값' 자료로 주고 결과를 어디까지 일반화할 수 있는지 판단한다.
// 일반화 범위는 자료의 수(명단 크기 = 모집단 크기인가)와 선택 방법(무작위인가)에서 정해진다 — verification_js 는 FIGURE 만 읽어 정답 서술을 다시 만든다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { factFig, GET_JS, lcf, NONRANDOM_SAMPLE, RANDOM_SAMPLE, sampleCounts, sumJs, surv, type FactRow, type Surv } from "./_t7-kit";

const H = "Study detail";
const intro = (rng: Rng, s: Surv) => rng.pick([
  `A researcher wanted to learn whether ${lcf(s.popLbl)} ${s.ev}. The table shows how the sample was chosen and what the sample reported.`,
  `To study ${s.topic}, an organization surveyed a sample of ${s.ent} about whether they ${s.ev}. Details of the study are shown in the table.`,
  `The table shown describes a survey about ${s.topic}, in which each person in the sample was asked whether they ${s.ev}.`,
  `A team investigating ${s.topic} asked a sample of ${s.ent} whether they ${s.ev}. The information in the table shown describes the study.`,
]);
const studyRows = (s: Surv, N: number, L: number, list: string, method: string, n: number, yes: number, no: number): FactRow[] => [["Target population size", N], ["List used to select the sample", list], ["Number of people on the list", L], ["Selection method", method], ["Sample size", n], ["Number in sample who said yes", yes], ["Number in sample who said no", no]];
const SUM = sumJs(["said yes", "said no"], "sample size");
const fullList = (s: Surv) => `Complete list of all ${lcf(s.popLbl)}`;
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isInteger(w.v));

export const ITEM = defineItem({
  prefix: "esc", itemId: "evaluating_statistical_claims.sampling_generalization.ST.P",
  hard: [
    {
      op: "constraint_select", structure: "무작위 표본이지만 명단 크기와 목표 모집단 크기를 비교해, 명단이 모집단 전체인지 일부인지에 따라 일반화 범위를 고름", extra: "'무작위'라는 말만으로 전체에 일반화하지 않고 명단(표집 틀)이 모집단을 다 덮는지 수로 확인해야 함 — medium 은 무작위/비무작위 구분만",
      concepts: ["무작위 표집", "표집 틀과 목표 모집단", "일반화 범위"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const s = surv(rng); const { n, yes, no } = sampleCounts(rng, { nPool: [50, 100, 200, 250] }); const N = rng.int(8, 60) * 50; const full = rng.chance(0.45); const L = full ? N : rng.int(3, Math.floor(N / 100)) * 50; if (L <= n) throw new GenFail("L");
        const list = full ? fullList(s) : s.frame; const method = rng.pick(RANDOM_SAMPLE);
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, studyRows(s, N, L, list, method, n, yes, no), H);
        const t = rng.pick([
          { all: `To all ${lcf(s.popLbl)}`, frame: `Only to #, not necessarily to all ${lcf(s.popLbl)}`, sample: `Only to the ${n} ${s.ent} who were surveyed`, none: `To no one, because the sample is much smaller than the population` },
          { all: `The result applies to all ${lcf(s.popLbl)}.`, frame: `The result applies only to #, not necessarily to all ${lcf(s.popLbl)}.`, sample: `The result applies only to the ${n} ${s.ent} in the sample.`, none: `The result applies to no one, since too few people were surveyed.` },
        ]);
        const fr = t.frame.replace("#", lcf(s.frame));
        const correct = full ? t.all : fr; const wrongs = [{ text: full ? fr : t.all, reason: full ? "명단이 모집단 전체인데 일부로 보았다." : "명단 밖의 사람까지 일반화했다." }, { text: t.sample, reason: "무작위 표본의 일반화 가능성을 무시했다." }, { text: t.none, reason: "표본 크기가 작다는 이유로 일반화를 부정했다." }];
        return statementInst(rng, {
          stimulus: intro(rng, s), question: rng.pick(["Based on the information shown, to which group of people can the result most appropriately be generalized?", "What is the broadest population to which the survey result can reasonably be generalized?"]), correct, wrongs, figure: fig, P: { all: t.all, frame: t.frame },
          body: `${GET_JS}${SUM}if (!/^random/i.test(String(g('selection method')))) throw new Error('무작위 아님'); const L=g('number of people on the list'), N=g('target population size'); if (L>N) throw new Error('명단이 모집단보다 큼'); const lst=String(g('list used')); const want = L===N ? P.all : P.frame.replace('#', lst.charAt(0).toLowerCase()+lst.slice(1)); const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [["선택 방법이 무작위이므로 표본은 명단 전체를 대표한다.", "A random sample represents its list."], [`명단에 있는 사람 수는 ${L}, 목표 모집단은 ${N} 이다.`, "Compare list size with population size."], [full ? "명단이 모집단 전체(같은 수)이다." : "명단은 모집단의 일부이다.", "Is the list the whole population?"], [full ? `따라서 모든 ${lcf(s.popLbl)} 에게 일반화할 수 있다.` : `명단 밖의 ${s.ent} 에게는 근거가 없다.`, "Decide the scope."], ["표본 크기가 작아도 무작위면 명단 전체로 일반화할 수 있다.", "Sample size does not block generalization."]], variant: "frame_vs_population_size",
        });
      },
    },
    {
      op: "compose_kind", structure: "명단에서 무작위로 뽑은 표본의 비율을 명단 크기(목표 모집단이 아님)에 곱해 추정치를 구함", extra: "일반화 범위(명단까지) 판단과 비율 추정의 합성 — 목표 모집단 크기를 곱하면 함정. medium 은 명단 = 모집단인 단순 추정",
      concepts: ["표집 틀과 일반화 범위", "표본 비율", "모집단 추정"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no } = sampleCounts(rng, { nPool: [50, 100, 200, 250], pLo: 15, pHi: 85 }); const N = rng.int(20, 60) * 50; const L = rng.int(4, Math.floor(N / 100)) * 50; const ans = (L * yes) / n; if (!Number.isInteger(ans) || L <= n || ans > 999) throw new GenFail("int");
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, studyRows(s, N, L, s.frame, rng.pick(RANDOM_SAMPLE), n, yes, no), H);
        return figInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`Based on the survey, what is the best estimate of the number of people on the list used who ${s.ev}?`, `For the group of people on the list used to select the sample, estimate how many ${s.ev}.`]), correct: ans,
          wrongs: pos([W((N * yes) / n, "scope", "목표 모집단 전체로 확대했다."), W(yes, "step_missing", "표본의 수를 답했다."), W((L * no) / n, "opposite", "'아니오' 비율을 썼다."), W(((N - L) * yes) / n, "scope", "명단 밖의 사람 수로 확대했다."), W((L * yes) / 100, "formula_misuse", "응답 수를 백분율로 보았다.")]),
          verificationJs: figJs({}, fig, `${GET_JS}${SUM}if (!/^random/i.test(String(g('selection method')))) throw new Error('무작위 아님'); return g('number of people on the list')*g('said yes')/g('sample size');`),
          trace: [["표본은 명단에서 무작위로 뽑았으므로 명단 전체를 대표한다.", "Random sample from the list."], [`표본 비율 = ${yes}/${n} = ${fmtNum((100 * yes) / n)}% 이다.`, "Sample proportion."], [`명단에는 ${L} 명이 있다(목표 모집단 ${N} 이 아님).`, "Use the list size, not the target population."], [`${L} × ${yes}/${n} 을 계산한다.`, "Scale to the list."], [`추정치는 ${ans} 이다.`, "Estimate."]], variant: "estimate_within_frame",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "선택 방법(무작위 추출 / 자원자·선착순 등)을 읽어 큰 표본이라도 비무작위면 일반화할 수 없음을 서술 선지에서 고름", extra: "선택 방법 서술을 무작위/비무작위로 번역하고, 표본 크기(함정)와 무관하게 근거를 고름 — medium 은 크기 정보 없는 판별",
      concepts: ["표집 방법", "무작위 표집과 일반화", "표본 크기의 역할"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const s = surv(rng); const rnd = rng.chance(0.5); const { n, yes, no } = sampleCounts(rng, { nPool: rnd ? [50, 100] : [400, 500, 600, 800] }); const N = rng.int(20, 60) * 50;
        const method = rnd ? rng.pick(RANDOM_SAMPLE) : rng.pick(NONRANDOM_SAMPLE);
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, studyRows(s, N, N, fullList(s), method, n, yes, no), H);
        const t = rng.pick([
          { y: `Yes, because the sample was selected at random from the complete list.`, big: `Yes, because the sample is large.`, nr: `No, because the sample was not selected at random.`, small: `No, because the sample is small compared with the population.` },
          { y: `Yes; random selection from a complete list makes the sample representative.`, big: `Yes; with this many responses, the sample must be representative.`, nr: `No; without random selection, the sample may not be representative.`, small: `No; a sample this much smaller than the population cannot represent it.` },
        ]);
        const correct = rnd ? t.y : t.nr; const wrongs = rnd ? [{ text: t.small, reason: "표본 크기 때문에 일반화할 수 없다고 보았다." }, { text: t.nr, reason: "선택 방법을 잘못 읽었다." }, { text: t.big, reason: "옳은 결론이지만 근거가 틀렸다(크기)." }] : [{ text: t.big, reason: "큰 표본이면 대표성이 있다고 보았다." }, { text: t.y, reason: "선택 방법을 잘못 읽었다." }, { text: t.small, reason: "결론은 같지만 근거가 틀렸다(크기)." }];
        return statementInst(rng, {
          stimulus: intro(rng, s), question: `Can the result be generalized to all ${lcf(s.popLbl)}?`, correct, wrongs, figure: fig, P: { y: t.y, nr: t.nr },
          body: `${GET_JS}${SUM}if (g('number of people on the list')!==g('target population size')) throw new Error('명단 불완전'); const want = /^random/i.test(String(g('selection method'))) ? P.y : P.nr; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`선택 방법: ${method}.`, "Read the selection method."], [rnd ? "완전한 명단에서 무작위로 뽑았다." : "무작위가 아니다(스스로 응답하거나 편의로 모음).", "Random or not?"], [`표본 크기 ${n} 은 일반화 여부의 근거가 아니다.`, "Sample size is not the deciding factor."], [rnd ? "무작위 표본은 모집단을 대표한다." : "비무작위 표본은 큰 표본이라도 편향될 수 있다.", "Representativeness."], [rnd ? "따라서 일반화할 수 있다." : "따라서 일반화할 수 없다.", "Conclusion."]], variant: "random_vs_volunteer",
        });
      },
    },
    {
      op: "compare_scenarios", structure: "두 표본(작은 무작위 표본 / 큰 비무작위 표본)의 정보를 비교해 어느 결과가 모집단에 일반화되는지 고름", extra: "두 표본의 크기와 방법을 함께 비교해 크기가 아니라 무작위성으로 판단 — medium 은 표본 하나",
      concepts: ["표집 방법 비교", "무작위 표집과 일반화", "표본 크기의 역할"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const s = surv(rng); const R = sampleCounts(rng, { nPool: [50, 100, 200] }); const V = sampleCounts(rng, { nPool: [400, 500, 600, 800] }); const rFirst = rng.chance(0.5); const [X, Y] = rFirst ? [R, V] : [V, R];
        const mX = rFirst ? rng.pick(RANDOM_SAMPLE) : rng.pick(NONRANDOM_SAMPLE), mY = rFirst ? rng.pick(NONRANDOM_SAMPLE) : rng.pick(RANDOM_SAMPLE);
        const rows: FactRow[] = [["Sample 1 selection method", mX], ["Sample 1 size", X.n], ["Sample 1 number who said yes", X.yes], ["Sample 1 number who said no", X.no], ["Sample 2 selection method", mY], ["Sample 2 size", Y.n], ["Sample 2 number who said yes", Y.yes], ["Sample 2 number who said no", Y.no]];
        const fig = factFig(`Two samples of ${lcf(s.popLbl)}`, rows, H);
        const rName = rFirst ? "1" : "2", vName = rFirst ? "2" : "1";
        const t = rng.pick([
          { ok: "Sample #, because it was selected at random", big: "Sample #, because it is larger", both: "Both samples, because each has more than 40 people", neither: "Neither sample, because neither includes everyone" },
          { ok: "Only Sample #, since its members were chosen at random", big: "Only Sample #, since it has more responses", both: "Both samples, since together they include many people", neither: "Neither sample, since only a census can describe a population" },
        ]);
        const correct = t.ok.replace("#", rName) + "."; const wrongs = [{ text: t.big.replace("#", vName) + ".", reason: "큰 표본을 골랐다." }, { text: t.both + ".", reason: "방법 차이를 무시했다." }, { text: t.neither + ".", reason: "표본으로 모집단을 추론할 수 없다고 보았다." }];
        return statementInst(rng, {
          stimulus: `Two samples of ${lcf(s.popLbl)} were asked whether they ${s.ev}. ${rng.pick(["The table shows how each sample was selected and the responses.", "Details of both samples are shown in the table.", "The information in the table shown describes both samples."])}`,
          question: rng.pick([`The result from which sample can most appropriately be generalized to all ${lcf(s.popLbl)}?`, `Which sample gives a result that can reasonably be generalized to all ${lcf(s.popLbl)}, and why?`]), correct, wrongs, figure: fig, P: { ok: t.ok },
          body: `${GET_JS}${sumJs(["sample 1 number who said yes", "sample 1 number who said no"], "sample 1 size")}${sumJs(["sample 2 number who said yes", "sample 2 number who said no"], "sample 2 size")}const r1=/^random/i.test(String(g('sample 1 selection'))), r2=/^random/i.test(String(g('sample 2 selection'))); if (r1===r2) throw new Error('둘 다 같음'); const want=P.ok.replace('#', r1?'1':'2')+'.'; const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [[`표본 1: ${mX}, ${X.n} 명.`, "Sample 1."], [`표본 2: ${mY}, ${Y.n} 명.`, "Sample 2."], [`무작위로 뽑은 것은 표본 ${rName} 뿐이다.`, "Which is random?"], [`표본 ${vName} 은 더 크지만 무작위가 아니라 편향될 수 있다.`, "Size does not fix bias."], [`따라서 표본 ${rName} 의 결과만 일반화할 수 있다.`, "Conclusion."]], variant: "random_small_vs_volunteer_large",
        });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "sample_percent", structure: "표본에서 '예'라고 답한 백분율을 구함", extra: "easy: 비율", concepts: ["표본 비율", "비율 → 백분율"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no, p } = sampleCounts(rng); const N = rng.int(20, 60) * 50;
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, studyRows(s, N, N, fullList(s), rng.pick(RANDOM_SAMPLE), n, yes, no), H);
        return figInst(rng, { stimulus: intro(rng, s), question: `What percent of the ${s.ent} in the sample said yes?`, correct: p, wrongs: pos([W(100 - p, "opposite", "'아니오' 백분율."), W(yes, "unit_error", "응답 수."), W(Math.round((100 * yes) / N) || p + 3, "scope", "모집단으로 나눴다."), W(p + 5, "other", "계산 오류.")]).filter((w) => w.v !== p),
          verificationJs: figJs({}, fig, `${GET_JS}${SUM}return 100*g('said yes')/g('sample size');`), trace: [[`'예' ${yes}, 표본 ${n}.`, "Read the counts."], [`${yes}/${n} = ${p}%.`, "Percent."]], variant: "sample_percent" }, fig);
      },
    },
    {
      lv: "medium", name: "estimate_full_list", structure: "완전한 명단에서 뽑은 무작위 표본의 비율로 목표 모집단의 수를 추정", extra: "medium: 비율 × 모집단", concepts: ["무작위 표집", "모집단 추정"],
      gen(rng) {
        const s = surv(rng); const { n, yes, no } = sampleCounts(rng, { nPool: [50, 100, 200, 250] }); const N = rng.int(4, 40) * 50; const ans = (N * yes) / n; if (!Number.isInteger(ans) || ans > 999) throw new GenFail("int");
        const fig = factFig(`Survey of ${lcf(s.popLbl)}`, studyRows(s, N, N, fullList(s), rng.pick(RANDOM_SAMPLE), n, yes, no), H);
        return figInst(rng, { stimulus: intro(rng, s), question: `Based on the survey, what is the best estimate of the number of ${lcf(s.popLbl)} who ${s.ev}?`, correct: ans, wrongs: pos([W(yes, "step_missing", "표본 수."), W(N - ans, "opposite", "'아니오' 추정."), W((N * yes) / 100, "formula_misuse", "백분율로 보았다."), W(ans + 10, "other", "계산 오류.")]).filter((w) => w.v !== ans),
          verificationJs: figJs({}, fig, `${GET_JS}${SUM}if (!/^random/i.test(String(g('selection method')))) throw new Error('무작위 아님'); return g('target population size')*g('said yes')/g('sample size');`), trace: [["완전한 명단에서 무작위로 뽑았다.", "Random from a complete list."], [`비율 ${yes}/${n}.`, "Proportion."], [`${N} × ${yes}/${n} = ${ans}.`, "Estimate."]], variant: "estimate_full_list" }, fig);
      },
    },
  ],
});
