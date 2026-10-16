// inference_margin_error.population_estimate.BR.P — 설문 응답 막대(Yes·No·Unsure)와 제목의 모집단 크기로 모집단 수를 추정하고, 차·역산·오차범위 결합으로 확장한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { RESP_JS, respIntro, respRead, respScene } from "./_t7bar-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isInteger(w.v));

export const ITEM = defineItem({
  prefix: "ime", itemId: "inference_margin_error.population_estimate.BR.P",
  hard: [
    {
      op: "repr_shift", structure: "응답 막대에서 'Yes' 막대와 표본 전체(세 막대의 합)를 읽어 표본 비율을 구하고 제목의 모집단 크기에 적용해 추정", extra: "표본 크기를 따로 주지 않아 세 막대를 더해 표본 크기를 복원한 뒤 비율 → 모집단 배율 — medium 은 표본 크기가 주어짐",
      concepts: ["표본 비율", "모집단 추정", "막대 합 = 표본 크기"],
      gen(rng) {
        const r = respScene(rng); const est = (r.N * r.a) / r.n; const s = r.s;
        return gInst(rng, {
          stimulus: respIntro(rng, s),
          question: rng.pick([`Based on the survey, what is the best estimate of the number of ${s.ent} in the population who ${s.ev}?`, `Using the information shown, estimate how many of all the ${s.ent} in the population ${s.ev}.`]), correct: est,
          wrongs: pos([{ v: (r.N * r.d) / r.n, kind: "step_missing" as const, reason: "다른 응답의 비율로 추정했다." }, W((r.N * (r.d + r.u)) / r.n, "opposite", "'Yes' 가 아닌 응답의 추정치를 답했다."), W(r.a, "scope", "표본의 막대 값을 그대로 답했다."), W(Math.round((r.N * r.a) / (r.a + r.d)), "condition_ignored", "미정 응답을 표본에서 빼고 비율을 구했다."), W(est + r.N / 100, "other", "비율을 1% 크게 잡았다.")].filter((w) => w.v !== est)),
          verificationJs: figJs({}, r.fig, `${RESP_JS}return N * a / n;`),
          trace: [respRead(r), [`표본 크기 = ${r.a} + ${r.d} + ${r.u} = ${r.n} 이다.`, "Add the three bars."], [`표본 비율 = ${r.a}/${r.n} 이다.`, "Sample proportion."], ["무작위 표본이므로 이 비율을 모집단에 적용한다.", "Apply to the population."], [`추정치 = ${r.N} × ${r.a}/${r.n} = ${est} 이다.`, "Estimate."]], variant: "population_estimate_bar",
        }, r.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 응답(Yes·No)의 모집단 추정치를 각각 구해 그 차를 구함", extra: "두 비율을 모두 모집단으로 확대해 차를 구함(표본 수의 차를 그대로 답하면 오답) — medium 은 한 응답의 추정치",
      concepts: ["표본 비율", "모집단 추정", "두 경우 비교"],
      gen(rng) {
        const r = respScene(rng, { needInt: ["d"] }); const A = (r.N * r.a) / r.n, D = (r.N * r.d) / r.n; const c = Math.abs(A - D); const s = r.s; if (c === 0) throw new GenFail("same");
        return gInst(rng, {
          stimulus: respIntro(rng, s),
          question: rng.pick([`Based on the survey, the estimated number of ${s.ent} in the population who ${s.ev} differs from the estimated number who answered no by how many?`, `By how many does the estimate of the ${s.ent} in the population who ${s.ev} differ from the estimate of those who answered no?`]), correct: c,
          wrongs: pos([W(Math.abs(r.a - r.d), "step_missing", "표본 수의 차를 그대로 답했다."), W(A + D, "sign_error", "차 대신 합을 구했다."), W(Math.max(A, D), "step_missing", "한쪽 추정치만 답했다."), W(Math.round((r.N * Math.abs(r.a - r.d)) / (r.a + r.d)), "condition_ignored", "미정 응답을 빼고 비율을 구했다."), W(c + r.N / 100, "other", "비율을 1% 어긋나게 잡았다.")].filter((w) => w.v !== c)),
          verificationJs: figJs({}, r.fig, `${RESP_JS}return N * Math.abs(a - d) / n;`),
          trace: [respRead(r), [`Yes 추정 = ${r.N} × ${r.a}/${r.n} = ${A} 이다.`, "Estimate for agree."], [`No 추정 = ${r.N} × ${r.d}/${r.n} = ${D} 이다.`, "Estimate for disagree."], [`차 = |${A} - ${D}| = ${c} 이다.`, "Take the positive difference."], ["표본 수의 차에 모집단 배율을 곱한 것과 같다.", "Same as scaling the sample gap."]], variant: "estimate_difference_bar",
        }, r.fig);
      },
    },
    {
      op: "inverse", structure: "지문의 'Yes' 모집단 추정치 E 와 응답 막대의 표본 비율로 모집단 전체 크기를 역산", extra: "추정치 = N × 표본 비율을 N 에 대해 거꾸로 풀어야 함 — medium 은 N 이 주어져 추정치를 구함",
      concepts: ["표본 비율", "모집단 추정", "역산"],
      gen(rng) {
        const r = respScene(rng, { maxEst: 999 }); const E = (r.N * r.a) / r.n; const s = r.s;
        return gInst(rng, {
          stimulus: `${respIntro(rng, s).replace(/, and the graph title gives.*$|, whose title gives.*$|, and the title of the graph gives.*$/, ".")} Based on the survey, the best estimate of the number of ${s.ent} in the population who ${s.ev} is ${E}.`,
          question: rng.pick([`According to this estimate, how many ${s.ent} are in the whole population?`, `What is the total number of ${s.ent} in the population that this estimate assumes?`]), correct: r.N,
          wrongs: pos([W(E, "step_missing", "추정치를 그대로 답했다."), W(Math.round((E * r.n) / (r.n - r.a)), "formula_misuse", "'Yes' 가 아닌 비율로 역산했다."), W(Math.round((E * r.a) / r.n), "formula_misuse", "비율을 곱했다."), W(r.n, "scope", "표본 크기를 답했다."), W(r.N + 100, "other", "100 어긋났다.")].filter((w) => w.v !== r.N)),
          verificationJs: figJs({ E }, r.fig, `${RESP_JS}return P.E * n / a;`),
          trace: [respRead(r).length ? [`막대그래프에서 읽는다: Yes ${r.a}, No ${r.d}, Unsure ${r.u}.`, "Read the bars."] : ["", ""], [`표본 크기 = ${r.n}, 표본 비율 = ${r.a}/${r.n} 이다.`, "Sample proportion."], [`E = N × ${r.a}/${r.n} 이므로 N = ${E} × ${r.n}/${r.a} 이다.`, "Solve for the population size."], [`N = ${r.N} 이다.`, "State the population size."], ["추정치가 맞다는 가정에서 N 이 하나로 정해진다.", "The estimate fixes N."]], variant: "population_size_from_estimate_bar",
        }, r.fig);
      },
    },
    {
      op: "compose_kind", structure: "표본 비율로 모집단 추정치를 구하고 오차범위(백분율 포인트)를 더해 모집단 수의 그럴듯한 최댓값을 구함", extra: "비율 추정과 오차범위(백분율 포인트)를 결합해 구간 끝을 구함 — 오차범위를 모집단 수에 그냥 더하면 틀림 — medium 은 추정치만",
      concepts: ["표본 비율", "오차범위", "구간의 끝"],
      gen(rng) {
        const r = respScene(rng); const m = rng.pick([2, 3, 4, 5, 6]); const est = (r.N * r.a) / r.n; const hi = est + (r.N * m) / 100; const s = r.s;
        return gInst(rng, {
          stimulus: `${respIntro(rng, s)} The margin of error for the percent of the sample who ${s.ev} is ${m} percentage points.`,
          question: rng.pick([`Based on the survey and its margin of error, what is the greatest plausible number of ${s.ent} in the population who ${s.ev}?`, `Using the margin of error, what is the upper end of the plausible range for the number of ${s.ent} in the population who ${s.ev}?`]), correct: hi,
          wrongs: pos([W(est, "step_missing", "추정치만 답했다."), W(est + m, "unit_error", "오차범위를 인원 수로 더했다."), W(est - (r.N * m) / 100, "opposite", "구간의 아래쪽 끝을 답했다."), W((r.N * m) / 100, "step_missing", "오차범위의 인원 수만 답했다."), W(Math.round((r.N * (r.a / r.n + m)) ), "unit_error", "백분율 포인트를 소수로 바꾸지 않았다.")].filter((w) => w.v !== hi)),
          verificationJs: figJs({ m }, r.fig, `${RESP_JS}return N * a / n + N * P.m / 100;`),
          trace: [respRead(r), [`추정치 = ${r.N} × ${r.a}/${r.n} = ${est} 이다.`, "Point estimate."], [`오차범위 ${m} 퍼센트포인트는 모집단의 ${(r.N * m) / 100} 명이다.`, "Convert the margin to people."], [`최댓값 = ${est} + ${(r.N * m) / 100} = ${fmtNum(hi)} 이다.`, "Add the margin."], [`따라서 ${fmtNum(hi)} 이다.`, "State the upper end."]], variant: "plausible_upper_bound_bar",
        }, r.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "sample_percent", structure: "응답 막대로 'Yes' 의 표본 백분율을 구함", extra: "easy: 비율 → 백분율", concepts: ["표본 비율", "비율 → 백분율"],
      gen(rng) {
        for (let t = 0; t < 50; t++) {
          const r = respScene(rng); if ((100 * r.a) % r.n !== 0) continue; const p = (100 * r.a) / r.n; const s = r.s;
          return gInst(rng, { stimulus: respIntro(rng, s), question: `What percent of the ${s.ent} in the sample ${s.ev}?`, correct: p, wrongs: pos([W(100 - p, "opposite", "나머지 백분율을 답했다."), W(r.a, "unit_error", "막대 값을 답했다."), W(Math.round((100 * r.a) / (r.a + r.d)), "condition_ignored", "미정 응답을 빼고 구했다."), W(p + 10, "other", "계산 중 어긋났다.")].filter((w) => w.v !== p)), verificationJs: figJs({}, r.fig, `${RESP_JS}return 100 * a / n;`), trace: [respRead(r), [`${r.a}/${r.n} = ${p}% 이다.`, "Convert to a percent."]], variant: "sample_percent_bar" }, r.fig);
        }
        throw new GenFail("easy");
      },
    },
    {
      lv: "medium", name: "point_estimate", structure: "표본 비율을 모집단 크기에 곱해 모집단 수를 추정", extra: "medium: 비율 × 모집단", concepts: ["표본 비율", "모집단 추정"],
      gen(rng) {
        const r = respScene(rng); const est = (r.N * r.a) / r.n; const s = r.s;
        return gInst(rng, { stimulus: `${respIntro(rng, s)} The sample had ${r.n} ${s.ent} in all.`, question: `Based on the survey, what is the best estimate of the number of ${s.ent} in the population who ${s.ev}?`, correct: est, wrongs: pos([W(r.a, "scope", "막대 값을 답했다."), W(r.N - est, "opposite", "나머지를 답했다."), W((r.N * r.a) / 100, "formula_misuse", "막대 값을 백분율로 보았다."), W(est + r.N / 100, "other", "1% 어긋났다.")].filter((w) => w.v !== est)), verificationJs: figJs({}, r.fig, `${RESP_JS}return N * a / n;`), trace: [respRead(r), [`표본 비율 = ${r.a}/${r.n} 이다.`, "Sample proportion."], [`${r.N} × ${r.a}/${r.n} = ${est} 이다.`, "Estimate."]], variant: "point_estimate_bar" }, r.fig);
      },
    },
  ],
});
