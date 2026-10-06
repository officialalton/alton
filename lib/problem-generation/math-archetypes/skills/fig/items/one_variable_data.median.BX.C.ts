// one_variable_data.median.BX.C — 조건(중앙값·사분위수·사분위범위)을 만족하는 상자그림을 4개 중에서 고른다.
// 네 상자그림은 최솟값·최댓값(같은 가로 눈금·같은 크기)이 같고 Q1·중앙값·Q3 만 다르다. 오답은 조건 A 만 / B 만 / 둘 다 어긋난 그림이다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { makeBox } from "../data-kit";
import { SPR_NO_DATA_CHOICE, cInst, oneCond, poolChoices, twoCond } from "../data-c-kit";

const STATS = "const b=c.boxes[0]; return {med:b.median,q1:b.q1,q3:b.q3,iqr:b.q3-b.q1,up:b.q3-b.median,lo:b.median-b.q1};";
type Sc = ReturnType<typeof makeBox>;
const nm = (s: Sc) => s.names[0];
const mk = (s: Sc, ps: number[]) => { const b0 = s.boxes[0]; const v = ps.map((p) => b0.min + p * s.s); return { type: "data" as const, kind: "boxplot" as const, boxes: [{ name: nm(s), min: b0.min, q1: v[0], median: v[1], q3: v[2], max: b0.max }], xTitle: s.fig.xTitle }; };
const triple = (rng: Rng, s: Sc) => rng.shuffle(Array.from({ length: s.R - 1 }, (_, i) => i + 1)).slice(0, 3).sort((a, b) => a - b);
const pool = (rng: Rng, s: Sc) => Array.from({ length: 400 }, () => mk(s, triple(rng, s)));
function scene(rng: Rng): Sc { const s = makeBox(rng); const b = s.boxes[0]; if (b.max - b.min !== s.s * s.R) throw new GenFail("범위"); return s; }
const stat = (f: ReturnType<typeof mk>) => { const b = f.boxes[0]; return { med: b.median, q1: b.q1, q3: b.q3, iqr: b.q3 - b.q1, up: b.q3 - b.median, lo: b.median - b.q1 }; };
const intro = (s: Sc, rng: Rng) => rng.pick([
  `Four box plots are shown for the ${s.t.what} of ${s.t.ent} ${s.t.where}. All four have the same minimum and maximum.`,
  `A box plot is to be drawn for the ${s.t.what} of ${s.t.ent} ${s.t.where}; four possible plots with the same minimum and maximum are shown.`,
  `A data set records the ${s.t.what} for ${s.t.ent} ${s.t.where}. The box plots shown all have the same least and greatest values.`,
  `The ${s.t.what} of ${s.t.ent} ${s.t.where} is summarized in one of the four box plots shown. Each has the same smallest and largest value.`,
]);
const Q = ["Which of the following box plots could show these data?", "Which box plot is consistent with the information given?", "Which of the box plots shown matches this description?"];
const TAIL: [string, string] = ["다른 상자그림은 조건 하나 이상이 어긋난다.", "Each other box plot violates at least one condition."];
const readOk = (f: ReturnType<typeof mk>): [string, string] => { const b = f.boxes[0]; return [`정답 상자그림: Q1 ${b.q1}, 중앙값 ${b.median}, Q3 ${b.q3}.`, "The correct box plot."]; };
const ELIM: [string, string] = ["조건을 만족하지 못하는 상자그림을 하나씩 지워 나간다.", "Eliminate the plots that fail a condition."];

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.median.BX.C",
  hard: [
    {
      op: "inverse", sprNo: SPR_NO_DATA_CHOICE, structure: "중앙값과 사분위범위(Q3-Q1)를 서술로 주고, 두 조건을 모두 만족하는 상자그림을 4개 중에서 고름", extra: "중앙값은 상자 안의 선, 사분위범위는 상자 너비임을 알고 네 그림에서 두 값을 읽어 대조해야 함(중앙값만 맞거나 너비만 맞는 그림이 함정) — medium 은 중앙값 하나",
      concepts: ["상자그림", "중앙값", "사분위범위"],
      gen(rng) {
        const s = scene(rng); const ok = mk(s, triple(rng, s)); const st = stat(ok); const P = { m: st.med, I: st.iqr };
        const c = twoCond(STATS, "s.med === P.m", "s.iqr === P.I", ["median_off", "iqr_off", "both_off"]); const ch = poolChoices(rng, { ok, pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The median is ${st.med} ${s.t.unit}, and the interquartile range is ${st.iqr} ${s.t.unit}.`, `The middle value of the data is ${st.med} ${s.t.unit}, and the middle half of the data spans ${st.iqr} ${s.t.unit}.`, `The data have a median of ${st.med} ${s.t.unit} and an interquartile range of ${st.iqr} ${s.t.unit}.`])}`, question: rng.pick(Q), P, ...c, variant: "box_by_median_and_iqr", trace: [[`중앙값은 상자 안의 선이므로 ${st.med} 인 그림만 남긴다.`, "The median is the line inside the box."], [`사분위범위는 Q3 - Q1 = 상자의 너비이므로 ${st.iqr} 인 그림만 남긴다.`, "IQR = Q3 - Q1 is the width of the box."], ELIM, readOk(ok)] }, TAIL);
      },
    },
    {
      op: "chain2", sprNo: SPR_NO_DATA_CHOICE, structure: "중앙값과 제1사분위수를 서술로 주고, 두 조건을 모두 만족하는 상자그림을 4개 중에서 고름", extra: "상자의 왼쪽 끝(Q1)과 가운데 선(중앙값)을 구별해 읽어 네 그림을 거르는 두 단계 — medium 은 중앙값 하나",
      concepts: ["상자그림", "중앙값", "사분위수"],
      gen(rng) {
        const s = scene(rng); const ok = mk(s, triple(rng, s)); const st = stat(ok); const P = { m: st.med, a: st.q1 };
        const c = twoCond(STATS, "s.med === P.m", "s.q1 === P.a", ["median_off", "q1_off", "both_off"]); const ch = poolChoices(rng, { ok, pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The median is ${st.med} ${s.t.unit}, and the first quartile is ${st.q1} ${s.t.unit}.`, `One quarter of the values are at most ${st.q1} ${s.t.unit}, and the median is ${st.med} ${s.t.unit}.`, `The lower quartile of the data is ${st.q1} ${s.t.unit}; the median is ${st.med} ${s.t.unit}.`])}`, question: rng.pick(Q), P, ...c, variant: "box_by_median_and_q1", trace: [[`상자의 왼쪽 끝이 제1사분위수 ${st.q1} 인 그림을 찾는다.`, "The left edge of the box is Q1."], [`상자 안의 선이 중앙값 ${st.med} 인 그림을 찾는다.`, "The line in the box is the median."], ELIM, readOk(ok)] }, TAIL);
      },
    },
    {
      op: "compare_scenarios", sprNo: SPR_NO_DATA_CHOICE, structure: "중앙값과 '중앙값에서 Q3 까지가 Q1 에서 중앙값까지보다 길다(오른쪽으로 치우침)'는 조건을 주고 상자그림을 고름", extra: "상자 안에서 중앙값 선이 왼쪽에 치우친 그림을 두 거리를 비교해 판단해야 함 — medium 은 중앙값 하나",
      concepts: ["상자그림", "중앙값", "분포의 치우침"],
      gen(rng) {
        const s = scene(rng); let ok = mk(s, triple(rng, s)); for (let i = 0; i < 80 && !(stat(ok).up > stat(ok).lo); i++) ok = mk(s, triple(rng, s)); const st = stat(ok); if (!(st.up > st.lo)) throw new GenFail("치우침");
        const P = { m: st.med }; const c = twoCond(STATS, "s.up > s.lo", "s.med === P.m", ["skew_off", "median_off", "both_off"]); const ch = poolChoices(rng, { ok, pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The median is ${st.med} ${s.t.unit}, and the distance from the median to the third quartile is greater than the distance from the first quartile to the median.`, `The median of the data is ${st.med} ${s.t.unit}. The upper part of the box (median to Q3) is longer than the lower part (Q1 to median).`, `Given: the median equals ${st.med} ${s.t.unit}, and the median lies closer to the first quartile than to the third quartile.`])}`, question: rng.pick(Q), P, ...c, variant: "box_by_median_and_skew", trace: [[`중앙값 ${st.med} 인 그림만 남긴다.`, "Keep plots with the right median."], [`Q3 - 중앙값 = ${st.up} 이 중앙값 - Q1 = ${st.lo} 보다 큰 그림을 고른다.`, "Compare the two halves of the box."], ELIM, readOk(ok)] }, TAIL);
      },
    },
    {
      op: "param_condition", sprNo: SPR_NO_DATA_CHOICE, structure: "사분위범위와 제3사분위수를 서술로 주고, 두 조건을 모두 만족하는 상자그림을 4개 중에서 고름", extra: "상자의 오른쪽 끝(Q3)과 상자 너비(IQR)를 함께 만족하는 그림을 찾아야 함 — medium 은 사분위범위 하나",
      concepts: ["상자그림", "사분위범위", "사분위수"],
      gen(rng) {
        const s = scene(rng); const ok = mk(s, triple(rng, s)); const st = stat(ok); const P = { I: st.iqr, u: st.q3 };
        const c = twoCond(STATS, "s.iqr === P.I", "s.q3 === P.u", ["iqr_off", "q3_off", "both_off"]); const ch = poolChoices(rng, { ok, pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The third quartile is ${st.q3} ${s.t.unit}, and the interquartile range is ${st.iqr} ${s.t.unit}.`, `Three quarters of the values are at most ${st.q3} ${s.t.unit}; the IQR is ${st.iqr} ${s.t.unit}.`, `The upper quartile is ${st.q3} ${s.t.unit} and the box is ${st.iqr} ${s.t.unit} wide.`])}`, question: rng.pick(Q), P, ...c, variant: "box_by_iqr_and_q3", trace: [[`상자의 오른쪽 끝이 Q3 = ${st.q3} 인 그림을 찾는다.`, "The right edge of the box is Q3."], [`Q3 - Q1 = ${st.iqr} 이므로 Q1 = ${st.q3 - st.iqr} 이어야 한다.`, "Q1 = Q3 - IQR."], ELIM, readOk(ok)] }, TAIL);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "median_line", sprNo: SPR_NO_DATA_CHOICE, structure: "중앙값이 m 인 상자그림을 4개 중에서 고름", extra: "easy: 상자 안의 선 읽기", concepts: ["상자그림", "중앙값"],
      gen(rng) {
        const s = scene(rng); const ok = mk(s, triple(rng, s)); const st = stat(ok); const P = { m: st.med }; const c = oneCond(STATS, "s.med", "P.m", String(s.s));
        const ch = poolChoices(rng, { ok, pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} The median of the data is ${st.med} ${s.t.unit}.`, question: rng.pick(Q), P, ...c, variant: "box_by_median", trace: [[`상자 안의 선이 ${st.med} 인 그림을 찾는다.`, "The median is the line in the box."], readOk(ok)] }, ["중앙값이 다른 그림은 정답이 아니다.", "A different median is not correct."]);
      },
    },
    {
      lv: "medium", name: "iqr_only", sprNo: SPR_NO_DATA_CHOICE, structure: "사분위범위가 I 인 상자그림을 4개 중에서 고름", extra: "medium: Q3 - Q1", concepts: ["상자그림", "사분위범위"],
      gen(rng) {
        const s = scene(rng); const ok = mk(s, triple(rng, s)); const st = stat(ok); const P = { I: st.iqr }; const c = oneCond(STATS, "s.iqr", "P.I", String(s.s));
        const ch = poolChoices(rng, { ok, pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} The interquartile range of the data is ${st.iqr} ${s.t.unit}.`, question: rng.pick(Q), P, ...c, variant: "box_by_iqr", trace: [[`각 그림에서 Q3 - Q1 을 계산한다.`, "IQR = Q3 - Q1."], readOk(ok)] }, ["사분위범위가 다른 그림은 정답이 아니다.", "A different IQR is not correct."]);
      },
    },
  ],
});
