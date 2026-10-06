// one_variable_data.grouped_median_interval.HG.C — 조건(중앙값이 든 구간·전체 개수·최빈 구간·첫 구간 도수·기준 미만 개수)을 만족하는 히스토그램을 4개 중에서 고른다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { SPR_NO_DATA_CHOICE, cInst, oneCond, poolChoices, twoCond } from "../data-c-kit";
import { H_STATS, hFig, hIntro, hLabel, hPool, hQ, hScene, hStat, hVec, type HSc } from "../hist-c-kit";

const TAIL: [string, string] = ["다른 히스토그램은 조건 하나 이상이 어긋난다.", "Each other histogram violates at least one condition."];
const ELIM: [string, string] = ["조건을 만족하지 못하는 히스토그램을 하나씩 지워 나간다.", "Eliminate the histograms that fail a condition."];
const readOk = (s: HSc, f: number[]): [string, string] => [`정답 히스토그램: ${s.los.map((l, i) => `${hLabel(s, l)}(${f[i]})`).join(", ")}.`, "The correct histogram."];
const okVec = (rng: Rng, s: HSc, good: (st: ReturnType<typeof hStat>) => boolean) => { for (let i = 0; i < 500; i++) { const f = hVec(rng, s); const st = hStat(s, f); if (st.N >= 14 && st.N <= 50 && st.medLo !== null && good(st)) return f; } throw new GenFail("정답 히스토그램 표집 실패"); };
const medFilter = (f: unknown) => { const c = f as { bins: { count: number }[] }; const fr = c.bins.map((b) => b.count); const N = fr.reduce((a, b) => a + b, 0); if (N % 2) return true; const at = (p: number) => { let q = 0; for (let i = 0; i < fr.length; i++) { q += fr[i]; if (p <= q) return i; } return -1; }; return at(N / 2) === at(N / 2 + 1); };

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.grouped_median_interval.HG.C",
  hard: [
    {
      op: "inverse", sprNo: SPR_NO_DATA_CHOICE, structure: "중앙값이 속한 구간과 전체 개수를 서술로 주고, 누적 도수로 중앙값 구간이 같은 히스토그램을 4개 중에서 고름", extra: "전체 개수로 중앙값 위치를 정하고 막대 도수를 누적해 네 히스토그램의 중앙값 구간을 구해야 함(개수만 맞거나 구간만 맞는 그림이 함정) — medium 은 중앙값 구간 하나",
      concepts: ["히스토그램", "누적 도수", "중앙값 구간"],
      gen(rng) {
        const s = hScene(rng); const f = okVec(rng, s, () => true); const st = hStat(s, f); const L = st.medLo as number, n = st.N; const P = { L, n };
        const c = twoCond(H_STATS, "s.medLo === P.L", "s.N === P.n", ["median_interval_off", "count_off", "both_off"]); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, sameAxis: medFilter, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} ${rng.pick([`There are ${n} values in all, and the median falls in the interval ${hLabel(s, L)} ${s.t.unit}.`, `The data set has ${n} values, and its median lies in the ${hLabel(s, L)} ${s.t.unit} interval.`, `In all there are ${n} ${s.t.ent}; the median ${s.t.col.toLowerCase()} is in the interval from ${L} to ${L + s.t.w} ${s.t.unit}.`])}`, question: rng.pick(hQ), P, ...c, variant: "hist_by_median_interval_and_count", trace: [[`전체 개수가 ${n} 인 히스토그램만 남긴다(막대 높이의 합).`, "Keep histograms whose bar heights sum to the total."], [`왼쪽 구간부터 도수를 누적해 중앙값 위치(${n % 2 ? (n + 1) / 2 : `${n / 2}, ${n / 2 + 1}`}번째)가 ${hLabel(s, L)} 에 드는지 본다.`, "Accumulate frequencies to the median position."], ELIM, readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "chain2", sprNo: SPR_NO_DATA_CHOICE, structure: "중앙값이 속한 구간과 가장 많은 값이 있는 구간을 서술로 주고 히스토그램을 고름", extra: "누적 도수로 중앙값 구간을, 막대 높이 비교로 최빈 구간을 따로 구해 두 조건을 함께 검사 — medium 은 중앙값 구간 하나",
      concepts: ["히스토그램", "중앙값 구간", "최빈 구간"],
      gen(rng) {
        const s = hScene(rng); const f = okVec(rng, s, (st) => st.mode !== null); const st = hStat(s, f); const L = st.medLo as number, m = st.mode as number; const P = { L, m };
        const c = twoCond(H_STATS, "s.medLo === P.L", "s.mode === P.m", ["median_interval_off", "mode_off", "both_off"]); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, sameAxis: medFilter, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} ${rng.pick([`The median is in the interval ${hLabel(s, L)} ${s.t.unit}, and the interval with the most values is ${hLabel(s, m)} ${s.t.unit}.`, `The ${hLabel(s, m)} ${s.t.unit} interval has more values than any other, and the median lies in the ${hLabel(s, L)} ${s.t.unit} interval.`])}`, question: rng.pick(hQ), P, ...c, variant: "hist_by_median_interval_and_mode", trace: [[`가장 높은 막대가 ${hLabel(s, m)} 인 히스토그램만 남긴다.`, "The tallest bar is the most common interval."], [`도수를 누적해 중앙값 구간이 ${hLabel(s, L)} 인지 본다.`, "Accumulate to find the median interval."], ELIM, readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "compare_scenarios", sprNo: SPR_NO_DATA_CHOICE, structure: "기준값 미만인 값의 개수와 전체 개수를 서술로 주고 히스토그램을 고름", extra: "구간 경계(왼쪽 포함)를 지켜 기준 미만 막대의 도수를 누적하고 전체 개수와 함께 대조 — medium 은 중앙값 구간 하나",
      concepts: ["히스토그램", "누적 도수", "구간 경계"],
      gen(rng) {
        const s = hScene(rng); const f = okVec(rng, s, () => true); const st = hStat(s, f); const j = rng.int(1, s.los.length - 2); const x = s.los[j]; const cb = st.below(x), n = st.N; const P = { x, cb, n };
        const c = twoCond(H_STATS, "s.below(P.x) === P.cb", "s.N === P.n", ["below_off", "count_off", "both_off"]); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, sameAxis: medFilter, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} ${rng.pick([`There are ${n} values in all, and exactly ${cb} of them are less than ${x} ${s.t.unit}.`, `The data set has ${n} values; ${cb} of the values are below ${x} ${s.t.unit}.`])}`, question: rng.pick(hQ), P, ...c, variant: "hist_by_count_below_and_total", trace: [[`${x} 미만의 값은 ${x} 왼쪽 막대들의 도수 합이다.`, "Values below the cutoff are the bars to its left."], [`그 합이 ${cb} 이고 전체가 ${n} 인 히스토그램을 찾는다.`, "Match both the partial and the total count."], ELIM, readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "param_condition", sprNo: SPR_NO_DATA_CHOICE, structure: "중앙값이 속한 구간과 첫 구간의 도수를 서술로 주고 히스토그램을 고름", extra: "첫 막대의 높이를 읽고 누적 도수로 중앙값 구간을 따로 구해 두 조건을 함께 검사 — medium 은 중앙값 구간 하나",
      concepts: ["히스토그램", "중앙값 구간", "막대 높이"],
      gen(rng) {
        const s = hScene(rng); const f = okVec(rng, s, () => true); const st = hStat(s, f); const L = st.medLo as number, a = st.f0; const P = { L, a };
        const c = twoCond(H_STATS, "s.medLo === P.L", "s.f0 === P.a", ["median_interval_off", "first_bar_off", "both_off"]); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, sameAxis: medFilter, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} ${rng.pick([`The median is in the interval ${hLabel(s, L)} ${s.t.unit}, and exactly ${a} values are in the first interval, ${hLabel(s, s.los[0])} ${s.t.unit}.`, `The first interval, ${hLabel(s, s.los[0])} ${s.t.unit}, contains ${a} values, and the median lies in ${hLabel(s, L)} ${s.t.unit}.`])}`, question: rng.pick(hQ), P, ...c, variant: "hist_by_median_interval_and_first_bar", trace: [[`첫 막대의 높이가 ${a} 인 히스토그램만 남긴다.`, "The first bar has the given height."], [`도수를 누적해 중앙값 구간이 ${hLabel(s, L)} 인지 본다.`, "Accumulate to find the median interval."], ELIM, readOk(s, f)] }, TAIL);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "total_count", sprNo: SPR_NO_DATA_CHOICE, structure: "전체 개수가 n 인 히스토그램을 4개 중에서 고름", extra: "easy: 막대 높이 합", concepts: ["히스토그램", "전체 개수"],
      gen(rng) {
        const s = hScene(rng); const f = hVec(rng, s); const n = hStat(s, f).N; const P = { n }; const c = oneCond(H_STATS, "s.N", "P.n", "3"); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} The data set has ${n} values in all.`, question: rng.pick(hQ), P, ...c, variant: "hist_by_count", trace: [[`각 히스토그램의 막대 높이를 모두 더한다.`, "Add the bar heights."], readOk(s, f)] }, ["개수가 다른 히스토그램은 정답이 아니다.", "A different total is not correct."]);
      },
    },
    {
      lv: "medium", name: "median_interval", sprNo: SPR_NO_DATA_CHOICE, structure: "중앙값이 속한 구간이 주어진 히스토그램을 4개 중에서 고름", extra: "medium: 누적 도수로 중앙값 위치 찾기", concepts: ["히스토그램", "중앙값 구간"],
      gen(rng) {
        const s = hScene(rng); const f = okVec(rng, s, () => true); const L = hStat(s, f).medLo as number; const P = { L }; const c = oneCond(H_STATS, "s.medLo", "P.L", String(s.t.w)); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, sameAxis: medFilter, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} The median falls in the interval ${hLabel(s, L)} ${s.t.unit}.`, question: rng.pick(hQ), P, ...c, variant: "hist_by_median_interval", trace: [[`도수를 왼쪽부터 누적해 가운데 값이 있는 구간을 찾는다.`, "Accumulate frequencies to the middle."], readOk(s, f)] }, ["중앙값 구간이 다른 히스토그램은 정답이 아니다.", "A different median interval is not correct."]);
      },
    },
  ],
});
