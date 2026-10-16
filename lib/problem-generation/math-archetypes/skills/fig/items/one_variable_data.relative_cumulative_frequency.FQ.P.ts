// one_variable_data.relative_cumulative_frequency.FQ.P — 도수표에서 상대 도수(%)·누적 상대 도수(%)를 구하고, 추가·백분위·비교·확대 적용으로 확장한다.
// 전체 개수를 20·25·50 으로 두어 퍼센트가 정수로 떨어지게 한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { fqFig, FQ_JS, fqIntro, fqRead, makeFq, type FqScene } from "../table-kit";

/** 전체 개수가 20·25·50 인 도수표(모든 도수 ≥ 1). */
function pctFq(rng: Rng): FqScene {
  const base = makeFq(rng); const k = base.vals.length; const N = rng.pick([20, 25, 50].filter((n) => n >= k * 2));
  const f = Array(k).fill(1) as number[]; for (let r = 0; r < N - k; r++) f[rng.int(0, k - 1)]++;
  const sum = base.vals.reduce((a, v, i) => a + v * f[i], 0);
  return { ...base, freqs: f, N, sum, fig: fqFig(base.t, base.vals, f) };
}
const cum = (s: FqScene) => { let c = 0; return s.freqs.map((x) => (c += x)); };
const pct = (s: FqScene, c: number) => (c * 100) / s.N;
const cumStep = (s: FqScene): [string, string] => { const c = cum(s); return [`누적 도수: ${s.vals.map((v, i) => `${v}→${c[i]}`).join(", ")} 이다.`, "Accumulate the frequencies."]; };
const pctStep = (s: FqScene): [string, string] => [`한 개체는 전체의 100 ÷ ${s.N} = ${100 / s.N}% 이다.`, "Each member is 100/N percent."];
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const PCT_CHK = "if (![20, 25, 50].includes(N)) throw new Error('전체 개수 전제 위반');\n";

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.relative_cumulative_frequency.FQ.P",
  hard: [
    {
      op: "inverse", structure: "가장 큰 값을 가진 개체가 몇 명 더해진 뒤 그 값의 상대 도수가 p% 가 될 때 더해진 수를 역산", extra: "상대 도수 = (도수 + k) ÷ (전체 + k) 를 세워 k 를 역산 — medium 은 누적 상대 도수 하나",
      concepts: ["도수표", "상대 도수(퍼센트)", "비율 방정식"],
      gen(rng) {
        for (let t = 0; t < 40; t++) {
          const s = pctFq(rng); const f = s.freqs[s.freqs.length - 1]; const ks = Array.from({ length: 40 }, (_, i) => i + 2).filter((k) => (100 * (f + k)) % (s.N + k) === 0);
          if (!ks.length) continue; const k = rng.pick(ks); const p = (100 * (f + k)) / (s.N + k); if (p >= 100) continue;
          return figInst(rng, {
            stimulus: `${fqIntro(rng, s)} ${rng.pick(["Later, some", "Afterward, additional", "Then more"])} ${s.t.ent} join, and each of them has the greatest value shown in the table. After they join, ${p}% of all the ${s.t.ent} have that greatest value.`,
            question: rng.pick([`How many ${s.t.ent} joined?`, `How many new ${s.t.ent} were added?`]), correct: k,
            wrongs: pos([W(Math.round((p * s.N) / 100) - f, "formula_misuse", "새 전체 개수에 k 를 더하지 않았다."), W(f + k, "step_missing", "새 도수를 답했다."), W(s.N + k, "axis_misread", "새 전체 개수를 답했다."), W(k + 1, "other", "1 어긋났다."), W(k - 1, "other", "1 어긋났다.")]).filter((w) => w.v !== k && w.v > 0),
            verificationJs: figJs({ p }, s.fig, `${FQ_JS}const f = fr[fr.length - 1]; const k = (P.p * N - 100 * f) / (100 - P.p); if (!Number.isInteger(k) || k <= 0) throw new Error('정수 해 없음'); return k;`),
            trace: [fqRead(s), [`가장 큰 값 ${s.vals[s.vals.length - 1]} 의 도수는 ${f}, 전체는 ${s.N} 이다.`, "Read the top frequency and the total."], [`k 명이 더해지면 (${f} + k) ÷ (${s.N} + k) = ${p}/100 이다.`, "Set up the relative frequency equation."], [`100(${f} + k) = ${p}(${s.N} + k) → ${100 - p}k = ${p * s.N - 100 * f} 이다.`, "Cross-multiply."], [`k = ${p * s.N - 100 * f} ÷ ${100 - p} = ${k} 이다.`, "Solve for k."]], variant: "added_count_from_relative_freq",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "constraint_select", structure: "누적 상대 도수를 계산해 '값이 V 이하인 비율이 p% 이상' 이 되는 가장 작은 V 를 고름", extra: "모든 값의 누적 퍼센트를 계산하고 조건을 처음 만족하는 값을 골라야 함(백분위) — medium 은 한 값의 누적 퍼센트",
      concepts: ["도수표", "누적 상대 도수", "조건을 만족하는 최소 값"],
      gen(rng) {
        const s = pctFq(rng); const c = cum(s).map((x) => pct(s, x)); const p = rng.pick([30, 40, 50, 60, 70, 75, 80, 90]); const i = c.findIndex((x) => x >= p); if (i <= 0) throw new GenFail("i");
        const ans = s.vals[i];
        return figInst(rng, {
          stimulus: fqIntro(rng, s),
          question: rng.pick([`What is the least value $V$ in the table such that at least ${p}% of the ${s.t.ent} have a value less than or equal to $V$?`, `For the least value $V$ in the table, at least ${p}% of the ${s.t.ent} have a value of $V$ or less. What is $V$?`]), correct: ans,
          wrongs: pos([W(s.vals[i - 1], "condition_ignored", "p% 에 못 미치는 바로 아래 값을 골랐다."), W(s.vals[Math.min(i + 1, s.vals.length - 1)], "other", "한 칸 위 값을 골랐다."), W(p, "axis_misread", "퍼센트를 답했다."), W(s.vals[s.freqs.indexOf(Math.max(...s.freqs))], "formula_misuse", "최빈값을 골랐다.")]).filter((w) => w.v !== ans),
          verificationJs: figJs({ p }, s.fig, `${FQ_JS}${PCT_CHK}let c = 0; for (let i = 0; i < vals.length; i++) { c += fr[i]; if (c * 100 / N >= P.p) return vals[i]; } throw new Error('없음');`),
          trace: [fqRead(s), pctStep(s), cumStep(s), [`누적 퍼센트: ${s.vals.map((v, j) => `${v}→${c[j]}%`).join(", ")} 이다.`, "Convert cumulative counts to percents."], [`처음으로 ${p}% 이상이 되는 값은 ${ans} 이다.`, "Pick the first value reaching the percent."]], variant: "percentile_value",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "표의 누적 상대 도수(V 이하)와 다른 집단의 비율을 비교해 퍼센트포인트 차를 구함", extra: "표 집단의 누적 퍼센트와 지문의 두 번째 집단 퍼센트를 각각 구해 비교 — medium 은 표 집단 하나",
      concepts: ["도수표", "누적 상대 도수", "두 집단 비교"],
      gen(rng) {
        const s = pctFq(rng); const i = rng.int(1, s.vals.length - 2); const V = s.vals[i]; const pt = pct(s, cum(s)[i]); const M = rng.pick([20, 25, 50]); const c2 = rng.int(1, M - 1); const p2 = (c2 * 100) / M; if (p2 === pt) throw new GenFail("eq");
        const ans = Math.abs(pt - p2);
        return figInst(rng, {
          stimulus: `${fqIntro(rng, s)} In another survey of ${M} ${s.t.ent}, ${c2} have a value of ${V} or less.`,
          question: rng.pick([`What is the positive difference, in percentage points, between the percent of ${s.t.ent} in the table with a value of ${V} or less and the corresponding percent in the other survey?`, `By how many percentage points do the two surveys differ in the percent of ${s.t.ent} with a value of at most ${V}?`]), correct: ans,
          wrongs: pos([W(Math.abs(cum(s)[i] - c2), "step_missing", "퍼센트로 바꾸지 않고 개수를 비교했다."), W(pt, "step_missing", "표 집단 퍼센트만 답했다."), W(p2, "step_missing", "두 번째 집단 퍼센트만 답했다."), W(Math.abs(pct(s, s.freqs[i]) - p2), "formula_misuse", "누적이 아니라 그 값 하나의 상대 도수를 썼다."), W(Math.abs(pct(s, cum(s)[i - 1]) - p2), "condition_ignored", "V 를 빼고 누적했다.")]).filter((w) => w.v !== ans),
          verificationJs: figJs({ V, M, c2 }, s.fig, `${FQ_JS}${PCT_CHK}const c = vals.reduce((a, v, i) => a + (v <= P.V ? fr[i] : 0), 0); return Math.abs(c * 100 / N - P.c2 * 100 / P.M);`),
          trace: [fqRead(s), cumStep(s), [`표 집단: ${V} 이하 ${cum(s)[i]} 명 ÷ ${s.N} = ${pt}% 이다.`, "Cumulative percent for the table."], [`두 번째 집단: ${c2} ÷ ${M} = ${p2}% 이다.`, "Percent for the second group."], [`차 = |${pt} - ${p2}| = ${ans} 퍼센트포인트이다.`, "Take the positive difference."]], variant: "cumulative_percent_vs_second_group",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "누적 상대 도수(V 이하)를 구한 뒤, 같은 분포를 가정한 더 큰 집단 T 에서 예상 개수를 구함", extra: "누적 도수 → 퍼센트 → 큰 집단에 적용의 연쇄 — medium 은 누적 퍼센트까지",
      concepts: ["도수표", "누적 상대 도수", "비율 적용"],
      gen(rng) {
        const s = pctFq(rng); const i = rng.int(0, s.vals.length - 2); const V = s.vals[i]; const pt = pct(s, cum(s)[i]); const T = rng.pick([200, 300, 400, 500]); const ans = (pt * T) / 100;
        return figInst(rng, {
          stimulus: `${fqIntro(rng, s)} ${rng.pick(["A planner assumes", "Suppose", "A researcher assumes"])} that a larger group of ${T} ${s.t.ent} has the same relative frequencies as the data in the table.`,
          question: rng.pick([`Based on this assumption, how many of the ${T} ${s.t.ent} would be expected to have a value of ${V} or less?`, `How many of the ${T} ${s.t.ent} are expected to have a value of at most ${V}?`]), correct: ans,
          wrongs: pos([W(pt, "step_missing", "퍼센트를 개수로 바꾸지 않았다."), W((pct(s, s.freqs[i]) * T) / 100, "formula_misuse", "누적이 아니라 그 값 하나의 비율을 썼다."), W(T - ans, "opposite", "V 보다 큰 쪽을 셌다."), W(cum(s)[i], "step_missing", "표의 누적 도수를 그대로 답했다."), W(i > 0 ? (pct(s, cum(s)[i - 1]) * T) / 100 : ans + T / 10, "condition_ignored", "V 를 빼고 누적했다.")]).filter((w) => w.v !== ans),
          verificationJs: figJs({ V, T }, s.fig, `${FQ_JS}${PCT_CHK}const c = vals.reduce((a, v, i) => a + (v <= P.V ? fr[i] : 0), 0); return c / N * P.T;`),
          trace: [fqRead(s), cumStep(s), pctStep(s), [`${V} 이하: ${cum(s)[i]} ÷ ${s.N} = ${pt}% 이다.`, "Cumulative relative frequency."], [`${T} 명 중 예상 = ${T} × ${pt}% = ${ans} 이다.`, "Apply the percent to the larger group."]], variant: "scale_cumulative_to_population",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "relative_frequency", structure: "한 값의 도수를 전체로 나눠 상대 도수(%)를 구함", extra: "easy: 도수 ÷ 전체 × 100", concepts: ["도수표", "상대 도수"],
      gen(rng) {
        const s = pctFq(rng); const i = rng.int(0, s.vals.length - 1); const V = s.vals[i]; const ans = pct(s, s.freqs[i]);
        return figInst(rng, { stimulus: fqIntro(rng, s), question: rng.pick([`What percent of the ${s.t.ent} have a value of exactly ${V}?`, `Exactly ${V} is the value for what percent of the ${s.t.ent}?`]), correct: ans, wrongs: pos([W(s.freqs[i], "step_missing", "도수를 그대로 답했다."), W(pct(s, cum(s)[i]), "formula_misuse", "누적 퍼센트를 구했다."), W(100 - ans, "opposite", "나머지 비율을 구했다."), W(ans + 100 / s.N, "other", "한 명 더 셌다."), W(Math.round((100 * s.freqs[i]) / s.vals.length), "formula_misuse", "행 수로 나눴다.")]).filter((w) => w.v !== ans), verificationJs: figJs({ V }, s.fig, `${FQ_JS}${PCT_CHK}const i = vals.indexOf(P.V); if (i < 0) throw new Error('값 없음'); return fr[i] * 100 / N;`), trace: [fqRead(s), [`${V} 의 도수 ${s.freqs[i]} ÷ ${s.N} × 100 = ${ans}% 이다.`, "Divide by the total and convert to percent."]], variant: "relative_freq_one_value" }, s.fig);
      },
    },
    {
      lv: "medium", name: "cumulative_percent", structure: "V 이하인 도수를 누적해 전체에 대한 퍼센트를 구함", extra: "medium: 누적 도수 → 퍼센트", concepts: ["도수표", "누적 상대 도수"],
      gen(rng) {
        const s = pctFq(rng); const i = rng.int(1, s.vals.length - 2); const V = s.vals[i]; const ans = pct(s, cum(s)[i]);
        return figInst(rng, { stimulus: fqIntro(rng, s), question: rng.pick([`What percent of the ${s.t.ent} have a value of ${V} or less?`, `What is the cumulative relative frequency, as a percent, for a value of ${V}?`]), correct: ans, wrongs: pos([W(cum(s)[i], "step_missing", "누적 도수를 그대로 답했다."), W(pct(s, s.freqs[i]), "formula_misuse", "그 값 하나의 상대 도수를 구했다."), W(pct(s, cum(s)[i - 1]), "condition_ignored", "V 를 빼고 누적했다."), W(100 - ans, "opposite", "V 보다 큰 쪽을 구했다.")]).filter((w) => w.v !== ans), verificationJs: figJs({ V }, s.fig, `${FQ_JS}${PCT_CHK}const c = vals.reduce((a, v, i) => a + (v <= P.V ? fr[i] : 0), 0); return c * 100 / N;`), trace: [fqRead(s), cumStep(s), [`${V} 이하 ${cum(s)[i]} ÷ ${s.N} × 100 = ${ans}% 이다.`, "Convert the cumulative count to percent."]], variant: "cumulative_percent" }, s.fig);
      },
    },
  ],
});
