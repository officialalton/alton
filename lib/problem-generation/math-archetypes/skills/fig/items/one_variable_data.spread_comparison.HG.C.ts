// one_variable_data.spread_comparison.HG.C — 가능한 가장 큰 범위(첫·마지막 점유 구간의 경계)와 다른 조건을 만족하는 히스토그램을 4개 중에서 고른다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { SPR_NO_DATA_CHOICE, cInst, oneCond, poolChoices, twoCond } from "../data-c-kit";
import { H_STATS, hFig, hIntro, hLabel, hPool, hQ, hScene, hStat, hVec, type HSc } from "../hist-c-kit";

const TAIL: [string, string] = ["다른 히스토그램은 조건 하나 이상이 어긋난다.", "Each other histogram violates at least one condition."];
const ELIM: [string, string] = ["조건을 만족하지 못하는 히스토그램을 하나씩 지워 나간다.", "Eliminate the histograms that fail a condition."];
const readOk = (s: HSc, f: number[]): [string, string] => [`정답 히스토그램: ${s.los.map((l, i) => `${hLabel(s, l)}(${f[i]})`).join(", ")}.`, "The correct histogram."];
const okVec = (rng: Rng, s: HSc, good: (st: ReturnType<typeof hStat>) => boolean) => { for (let i = 0; i < 500; i++) { const f = hVec(rng, s); const st = hStat(s, f); if (st.N >= 12 && st.N <= 50 && good(st)) return f; } throw new GenFail("정답 히스토그램 표집 실패"); };
const GP = "가능한 가장 큰 범위(도수가 0 이 아닌 첫 구간의 왼쪽 끝부터 마지막 구간의 오른쪽 끝까지)";

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.spread_comparison.HG.C",
  hard: [
    {
      op: "compare_scenarios", sprNo: SPR_NO_DATA_CHOICE, structure: "가능한 가장 큰 범위와 전체 개수를 서술로 주고, 두 조건을 모두 만족하는 히스토그램을 4개 중에서 고름", extra: "높이가 0 인 양 끝 구간을 제외하고 첫·마지막 점유 구간의 경계에서 범위를 구한 뒤 개수도 함께 대조해야 함 — medium 은 범위 하나",
      concepts: ["히스토그램", "범위", "전체 개수"],
      gen(rng) {
        const s = hScene(rng, true); const f = okVec(rng, s, (st) => st.gp < s.t.w * s.los.length); const st = hStat(s, f); const P = { R: st.gp, n: st.N };
        const c = twoCond(H_STATS, "s.gp === P.R", "s.N === P.n", ["range_off", "count_off", "both_off"]); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} ${rng.pick([`The greatest possible range of the data is ${st.gp} ${s.t.unit}, and there are ${st.N} values in all.`, `There are ${st.N} values, and the greatest possible range is ${st.gp} ${s.t.unit}.`])}`, question: rng.pick(hQ), P, ...c, variant: "hist_by_range_and_count", trace: [[`도수가 0 이 아닌 가장 왼쪽·오른쪽 막대의 바깥 경계 차가 ${st.gp} 인 그림을 찾는다.`, "Greatest range = right edge of the last occupied bar - left edge of the first."], [`막대 높이의 합이 ${st.N} 인지 확인한다.`, "Check the total count."], ELIM, readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "chain2", sprNo: SPR_NO_DATA_CHOICE, structure: "가능한 가장 큰 범위와 가장 많은 값이 있는 구간을 서술로 주고 히스토그램을 고름", extra: "범위를 위해 양 끝 점유 구간을, 최빈 구간을 위해 가장 높은 막대를 따로 읽어 두 조건을 검사 — medium 은 범위 하나",
      concepts: ["히스토그램", "범위", "최빈 구간"],
      gen(rng) {
        const s = hScene(rng, true); const f = okVec(rng, s, (st) => st.mode !== null && st.gp < s.t.w * s.los.length); const st = hStat(s, f); const P = { R: st.gp, m: st.mode as number };
        const c = twoCond(H_STATS, "s.gp === P.R", "s.mode === P.m", ["range_off", "mode_off", "both_off"]); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} ${rng.pick([`The greatest possible range is ${st.gp} ${s.t.unit}, and the interval with the most values is ${hLabel(s, st.mode as number)} ${s.t.unit}.`, `The ${hLabel(s, st.mode as number)} ${s.t.unit} interval has more values than any other, and the greatest possible range is ${st.gp} ${s.t.unit}.`])}`, question: rng.pick(hQ), P, ...c, variant: "hist_by_range_and_mode", trace: [[`가장 높은 막대가 ${hLabel(s, st.mode as number)} 인 그림만 남긴다.`, "The tallest bar is the most common interval."], [`양 끝 점유 구간의 경계로 범위가 ${st.gp} 인지 확인한다.`, "Check the greatest possible range."], ELIM, readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "inverse", sprNo: SPR_NO_DATA_CHOICE, structure: "가장 낮은 값이 든 구간과 가능한 가장 큰 범위를 서술로 주고, 마지막 점유 구간을 역으로 추론해 히스토그램을 고름", extra: "첫 구간의 왼쪽 끝과 범위로 마지막 구간의 오른쪽 끝을 역산해 네 히스토그램과 대조 — medium 은 범위 하나",
      concepts: ["히스토그램", "범위의 역산", "구간 경계"],
      gen(rng) {
        const s = hScene(rng, true); const f = okVec(rng, s, (st) => st.gp < s.t.w * s.los.length); const st = hStat(s, f); const P = { lo: st.lo, R: st.gp };
        const c = twoCond(H_STATS, "s.lo === P.lo", "s.gp === P.R", ["lowest_off", "range_off", "both_off"]); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} ${rng.pick([`The lowest value is in the interval that starts at ${st.lo} ${s.t.unit}, and the greatest possible range is ${st.gp} ${s.t.unit}.`, `The first interval that has any values begins at ${st.lo} ${s.t.unit}; the greatest possible range of the data is ${st.gp} ${s.t.unit}.`])}`, question: rng.pick(hQ), P, ...c, variant: "hist_by_lowest_and_range", trace: [[`도수가 있는 첫 구간이 ${st.lo} 에서 시작하는 그림만 남긴다.`, "The first occupied bar starts at the given value."], [`마지막 점유 구간의 오른쪽 끝은 ${st.lo} + ${st.gp} = ${st.hi} 이어야 한다.`, "The last occupied bar must end at lowest + range."], ELIM, readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "param_condition", sprNo: SPR_NO_DATA_CHOICE, structure: "가능한 가장 큰 범위와 기준값 미만 개수를 서술로 주고 히스토그램을 고름", extra: "범위와 기준 미만 누적 도수를 함께 만족하는 그림을 구간 경계 규칙으로 가려내야 함 — medium 은 범위 하나",
      concepts: ["히스토그램", "범위", "누적 도수"],
      gen(rng) {
        const s = hScene(rng, true); const f = okVec(rng, s, (st) => st.gp < s.t.w * s.los.length); const st = hStat(s, f); const j = rng.int(1, s.los.length - 2); const x = s.los[j]; const cb = st.below(x); const P = { R: st.gp, x, cb };
        const c = twoCond(H_STATS, "s.gp === P.R", "s.below(P.x) === P.cb", ["range_off", "below_off", "both_off"]); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} ${rng.pick([`The greatest possible range is ${st.gp} ${s.t.unit}, and exactly ${cb} values are less than ${x} ${s.t.unit}.`, `Exactly ${cb} of the values are below ${x} ${s.t.unit}, and the greatest possible range of the data is ${st.gp} ${s.t.unit}.`])}`, question: rng.pick(hQ), P, ...c, variant: "hist_by_range_and_count_below", trace: [[`${x} 왼쪽 막대의 도수 합이 ${cb} 인 그림을 찾는다.`, "Add the bars to the left of the cutoff."], [`양 끝 점유 구간의 경계로 범위가 ${st.gp} 인지 확인한다.`, "Check the greatest possible range."], ELIM, readOk(s, f)] }, TAIL);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "lowest_start", sprNo: SPR_NO_DATA_CHOICE, structure: "도수가 있는 첫 구간이 v 에서 시작하는 히스토그램을 4개 중에서 고름", extra: "easy: 첫 점유 구간 읽기", concepts: ["히스토그램", "구간 경계"],
      gen(rng) {
        const s = hScene(rng, true); const f = okVec(rng, s, (q) => q.lo === s.los[2]); const st = hStat(s, f); const P = { lo: st.lo }; const c = oneCond(H_STATS, "s.lo", "P.lo", String(s.t.w)); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} The lowest value in the data is in the interval that starts at ${st.lo} ${s.t.unit}.`, question: rng.pick(hQ), P, ...c, variant: "hist_by_lowest_start", trace: [[`왼쪽부터 높이가 0 이 아닌 첫 막대의 왼쪽 끝을 읽는다.`, "Read the left edge of the first non-empty bar."], readOk(s, f)] }, ["첫 점유 구간이 다른 히스토그램은 정답이 아니다.", "A different first interval is not correct."]);
      },
    },
    {
      lv: "medium", name: "greatest_range", sprNo: SPR_NO_DATA_CHOICE, structure: `${GP}가 R 인 히스토그램을 4개 중에서 고름`, extra: "medium: 마지막 경계 - 첫 경계", concepts: ["히스토그램", "범위"],
      gen(rng) {
        const s = hScene(rng, true); const f = okVec(rng, s, (st) => st.gp < s.t.w * s.los.length); const st = hStat(s, f); const P = { R: st.gp }; const c = oneCond(H_STATS, "s.gp", "P.R", String(s.t.w)); const ch = poolChoices(rng, { ok: hFig(s, f), pool: hPool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${hIntro(s, rng)} The greatest possible range of the data is ${st.gp} ${s.t.unit}.`, question: rng.pick(hQ), P, ...c, variant: "hist_by_range", trace: [[`각 그림에서 점유 구간의 마지막 오른쪽 끝 - 첫 왼쪽 끝을 구한다.`, "Last right edge minus first left edge."], readOk(s, f)] }, ["범위가 다른 히스토그램은 정답이 아니다.", "A different range is not correct."]);
      },
    },
  ],
});
