// area_volume.similar_solids_scale.SO.B — B형: 기준 입체(지문의 그림)와 닮은 입체를 선택지 입체 4개 중에서 고른다. 닮음비는 말로 주어지거나 한 치수·부피의 비·겉넓이의 비로 간접적으로 주어진다.
// 정답은 기준 그림의 치수 × 닮음비로 다시 계산하고, 오답은 선언한 규칙(일부 치수만 변경·치수에 더하기·부피비/넓이비를 닮음비로 오인)으로 진단한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { keyBundle, SPR_NO_B } from "../b-kit";
import { TAILS } from "../sx-kit";
import { SOLID_KEY_JS, rngSolid, solidFig, type SolidKind } from "../ln-b-kit";

const KINDS: SolidKind[] = ["cylinder", "cone"];
const NOUN: Record<SolidKind, string> = { cylinder: "cylinder", cone: "cone", rectangular_prism: "rectangular prism" };
const LEADS_S = ["", "", "A student studies solids in a geometry class. ", "A teacher draws a solid on the board. ", "A designer sketches a figure of a solid. ", "In a practice set, a solid is shown. ", "An engineer models an object as a solid. "];
const TAILS_S = [
  "The first figure is the given solid, and four candidate solids are shown as choices.",
  "Use the given figure to answer the question, and compare the four choices shown.",
  "The given figure is drawn first. Each of the four choices is a solid drawn below it.",
  "Four possible solids are shown below the given figure; their dimensions are labeled in the figure.",
];
const intro = (rng: Rng, kind: SolidKind, extra = "") => `${rng.pick(LEADS_S)}${rng.pick([
  `A ${NOUN[kind]} with labeled dimensions is shown in the given figure.`, `The given figure shows a ${NOUN[kind]}; its dimensions are labeled in the same unit.`, `The first figure is a ${NOUN[kind]} whose dimensions are labeled. Four more solids are shown as the choices.`, `A ${NOUN[kind]} is drawn first, with the lengths of its dimensions labeled, followed by four candidate solids.`, `In the given figure, the dimensions of a ${NOUN[kind]} are labeled in one unit.`,
])} ${rng.pick(TAILS_S)} ${rng.pick(TAILS)}${extra}`;
const rd = (kind: SolidKind): [string, string] => [`기준 입체(${NOUN[kind]})의 치수 라벨을 읽는다.`, "Read the dimensions of the given solid."];
const Q = (kind: SolidKind) => [`Which of the following ${NOUN[kind]}s is similar to the ${NOUN[kind]} in the given figure?`, `Which one of the four solids is similar to the given ${NOUN[kind]}?`, `Which ${NOUN[kind]} below has the same shape as the given one, only larger or smaller?`];
const sc = (d: number[], k: number) => d.map((x) => x * k);
const sk = (kind: SolidKind, d: number[]) => solidFig(kind, d);
const SEMK = (e: string) => `const S=STEMS(); const EXPECT=fmtS(S.kind, S.d.map(x=>x*(${e})));`;

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.similar_solids_scale.SO.B",
  hard: [
    {
      op: "repr_shift", structure: "닮음비(확대 또는 축소)가 말로 주어질 때 기준 입체의 모든 치수에 닮음비를 곱한 입체를 고름", extra: "치수마다 같은 비를 곱해야 함(일부 치수만 바꾸거나 더하기를 쓰는 함정) — medium 은 닮음비 2", sprNo: SPR_NO_B,
      concepts: ["닮은 입체", "닮음비", "치수 비례"],
      gen(rng) {
        const kind = rng.pick(KINDS); const d = rngSolid(rng, kind); const kk = rng.pick([2, 3]); const ok = sk(kind, sc(d, kk)); const w1 = sk(kind, d.map((x, i) => (i === 0 ? x * kk : x))), w2 = sk(kind, d.map((x) => x + kk)), w3 = sk(kind, d.map((x, i) => (i === d.length - 1 ? x * kk + 1 : x * kk)));
        return keyBundle(rng, { stimulus: intro(rng, kind, ` The scale factor from the given ${NOUN[kind]} to the ${NOUN[kind]} in the correct choice is ${kk}.`), question: rng.pick(Q(kind)), stem: sk(kind, d).fig, correct: ok, wrongs: [{ ...w1, rule: "SOB_ONE_DIMENSION" }, { ...w2, rule: "SOB_ADDED" }, { ...w3, rule: "SOB_ONE_OFF" }], P: { k: kk }, keyJs: SOLID_KEY_JS, semanticJs: SEMK("P.k"),
          trace: [rd(kind), [`치수는 ${d.join(", ")} 이다.`, "The dimensions."], [`모든 치수에 ${kk} 를 곱하면 ${sc(d, kk).join(", ")} 이다.`, "Multiply every dimension."], [`일부 치수만 바꾸거나 일정한 수를 더한 입체는 닮음이 아니다.`, "Similar solids scale all dimensions by the same factor."], [`한 치수만 어긋난 입체도 오답이다.`, "One off dimension breaks similarity."]], variant: `scale_${kind}` });
      },
    },
    {
      op: "chain2", structure: "한 치수(첫 번째 치수)가 주어진 값으로 바뀐 닮은 입체에서 닮음비를 구한 뒤 나머지 치수를 비례해 입체를 고름", extra: "첫 치수의 비로 닮음비를 구해 나머지 치수에도 곱해야 함(주어진 값을 다른 치수에 쓰는 함정) — medium 은 닮음비가 주어진 경우", sprNo: SPR_NO_B,
      concepts: ["닮은 입체", "닮음비", "비례"],
      gen(rng) {
        const kind = rng.pick(KINDS); const d = rngSolid(rng, kind); const kk = rng.pick([2, 3]); const given = d[0] * kk; const ok = sk(kind, sc(d, kk)); const w1 = sk(kind, d.map((x, i) => (i === 0 ? given : x))), w2 = sk(kind, d.map((x, i) => (i === d.length - 1 ? given : x * kk))), w3 = sk(kind, d.map((x) => x + (given - d[0])));
        return keyBundle(rng, { stimulus: intro(rng, kind, ` The ${NOUN[kind]} in the correct choice is similar to the given one, and the distance from the center of its circular base to the edge of the base is ${given}.`), question: rng.pick(Q(kind)), stem: sk(kind, d).fig, correct: ok, wrongs: [{ ...w1, rule: "SOB_ONLY_GIVEN" }, { ...w2, rule: "SOB_GIVEN_AS_LAST" }, { ...w3, rule: "SOB_ADDED" }], P: { g: given }, keyJs: SOLID_KEY_JS, semanticJs: `const S=STEMS(); const k=P.g/S.d[0]; const EXPECT=fmtS(S.kind, S.d.map(x=>x*k));`,
          trace: [rd(kind), [`첫 치수 ${d[0]} 가 ${given} 이 되었으므로 닮음비는 ${given} ÷ ${d[0]} = ${kk} 이다.`, "The scale factor from one dimension."], [`나머지 치수에도 ${kk} 를 곱하면 ${sc(d, kk).join(", ")} 이다.`, "Scale the other dimensions."], [`주어진 값을 그대로 다른 치수에 쓰거나 같은 수를 더하면 오답이다.`, "Do not reuse the given value or add."], [`따라서 ${sc(d, kk).join(", ")} 인 입체가 정답이다.`, "Pick the scaled solid."]], variant: `scale_from_dimension_${kind}` });
      },
    },
    {
      op: "compose_kind", structure: "부피의 비(닮음비의 세제곱)가 주어질 때 닮음비를 구해 치수에 곱한 입체를 고름", extra: "부피의 비의 세제곱근이 닮음비임을 써야 함(부피의 비를 닮음비로 쓰거나 제곱근을 쓰는 함정) — medium 은 닮음비가 주어진 경우", sprNo: SPR_NO_B,
      concepts: ["닮은 입체", "부피의 비", "닮음비"],
      gen(rng) {
        const kind = rng.pick(KINDS); const d = rngSolid(rng, kind); const kk = rng.pick([2, 3]); const vr = kk ** 3; const ok = sk(kind, sc(d, kk)), w1 = sk(kind, sc(d, vr)), w2 = sk(kind, sc(d, kk * kk)), w3 = sk(kind, sc(d, kk + 1));
        return keyBundle(rng, { stimulus: intro(rng, kind, ` The volume of the ${NOUN[kind]} in the correct choice is ${vr} times the volume of the given ${NOUN[kind]}.`), question: rng.pick(Q(kind)), stem: sk(kind, d).fig, correct: ok, wrongs: [{ ...w1, rule: "SOB_RATIO_AS_K" }, { ...w2, rule: "SOB_SQUARED" }, { ...w3, rule: "SOB_PLUS_ONE" }], P: { v: vr }, keyJs: SOLID_KEY_JS, semanticJs: `const S=STEMS(); const k=Math.round(Math.cbrt(P.v)); if (k*k*k!==P.v) throw new Error('세제곱 아님'); const EXPECT=fmtS(S.kind, S.d.map(x=>x*k));`,
          trace: [rd(kind), [`부피의 비 ${vr} = (닮음비)³ 이므로 닮음비 = ∛${vr} = ${kk} 이다.`, "The volume ratio is the cube of the scale factor."], [`모든 치수에 ${kk} 를 곱하면 ${sc(d, kk).join(", ")} 이다.`, "Scale every dimension."], [`부피의 비 ${vr} 을 닮음비로 쓰면 치수가 ${sc(d, vr).join(", ")} 로 너무 커진다.`, "Do not use the volume ratio as the scale factor."], [`닮음비의 제곱 ${kk * kk} 도 오답이다.`, "The square is the area ratio, not the scale factor."]], variant: `scale_from_volume_${kk}` });
      },
    },
    {
      op: "inverse", structure: "겉넓이의 비(닮음비의 제곱)가 주어질 때 닮음비를 구해 치수에 곱한 입체를 고름", extra: "겉넓이의 비의 제곱근이 닮음비임을 써야 함(겉넓이의 비를 닮음비로 쓰거나 세제곱근을 쓰는 함정) — medium 은 닮음비가 주어진 경우", sprNo: SPR_NO_B,
      concepts: ["닮은 입체", "겉넓이의 비", "닮음비"],
      gen(rng) {
        const kind = rng.pick(KINDS); const d = rngSolid(rng, kind); const kk = rng.pick([2, 3]); const ar = kk * kk; const ok = sk(kind, sc(d, kk)), w1 = sk(kind, sc(d, ar)), w2 = sk(kind, sc(d, kk ** 3)), w3 = sk(kind, sc(d, kk + 1));
        return keyBundle(rng, { stimulus: intro(rng, kind, ` The total surface area of the ${NOUN[kind]} in the correct choice is ${ar} times the total surface area of the given ${NOUN[kind]}.`), question: rng.pick(Q(kind)), stem: sk(kind, d).fig, correct: ok, wrongs: [{ ...w1, rule: "SOB_RATIO_AS_K" }, { ...w2, rule: "SOB_CUBED" }, { ...w3, rule: "SOB_PLUS_ONE" }], P: { a: ar }, keyJs: SOLID_KEY_JS, semanticJs: `const S=STEMS(); const k=Math.round(Math.sqrt(P.a)); if (k*k!==P.a) throw new Error('제곱 아님'); const EXPECT=fmtS(S.kind, S.d.map(x=>x*k));`,
          trace: [rd(kind), [`겉넓이의 비 ${ar} = (닮음비)² 이므로 닮음비 = √${ar} = ${kk} 이다.`, "The area ratio is the square of the scale factor."], [`모든 치수에 ${kk} 를 곱하면 ${sc(d, kk).join(", ")} 이다.`, "Scale every dimension."], [`겉넓이의 비 ${ar} 를 닮음비로 쓰면 오답이다.`, "Do not use the area ratio as the scale factor."], [`세제곱한 ${kk ** 3} 도 오답이다.`, "The cube is the volume ratio."]], variant: `scale_from_area_${kk}` });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "double", structure: "닮음비 2 인 입체를 고름", extra: "easy: 모든 치수의 2 배", sprNo: SPR_NO_B, concepts: ["닮은 입체", "닮음비"],
      gen(rng) {
        const kind = rng.pick(KINDS); const d = rngSolid(rng, kind); const ok = sk(kind, sc(d, 2)), w1 = sk(kind, d.map((x, i) => (i === 0 ? x * 2 : x))), w2 = sk(kind, d.map((x) => x + 2)), w3 = sk(kind, sc(d, 3));
        return keyBundle(rng, { stimulus: intro(rng, kind, ` The scale factor from the given ${NOUN[kind]} to the ${NOUN[kind]} in the correct choice is 2.`), question: rng.pick(Q(kind)), stem: sk(kind, d).fig, correct: ok, wrongs: [{ ...w1, rule: "SOB_ONE_DIMENSION" }, { ...w2, rule: "SOB_ADDED" }, { ...w3, rule: "SOB_OTHER_FACTOR" }], P: {}, keyJs: SOLID_KEY_JS, semanticJs: SEMK("2"), trace: [rd(kind), [`모든 치수를 2 배로 한다.`, "Double every dimension."]], variant: "easy_double" });
      },
    },
    {
      lv: "medium", name: "half_given", structure: "한 치수가 주어진 닮은 입체(닮음비 1/2)를 고름", extra: "medium: 축소", sprNo: SPR_NO_B, concepts: ["닮은 입체", "닮음비"],
      gen(rng) {
        const kind = rng.pick(KINDS); const d = rngSolid(rng, kind).map((x) => x * 2); const ok = sk(kind, d.map((x) => x / 2)), w1 = sk(kind, d.map((x, i) => (i === 0 ? x / 2 : x))), w2 = sk(kind, d.map((x) => x - 1)), w3 = sk(kind, d);
        if (new Set([ok.key, w1.key, w2.key, w3.key]).size < 4) throw new GenFail("키 중복");
        return keyBundle(rng, { stimulus: intro(rng, kind, ` The ${NOUN[kind]} in the correct choice is half as large in every dimension as the given one.`), question: rng.pick(Q(kind)), stem: sk(kind, d).fig, correct: ok, wrongs: [{ ...w1, rule: "SOB_ONE_DIMENSION" }, { ...w2, rule: "SOB_SUBTRACTED" }, { ...w3, rule: "SOB_SAME" }], P: {}, keyJs: SOLID_KEY_JS, semanticJs: SEMK("1/2"), trace: [rd(kind), [`모든 치수를 절반으로 한다.`, "Halve every dimension."], [`일부 치수만 줄이거나 같은 수를 빼면 닮음이 아니다.`, "Scale every dimension by the same factor."]], variant: "medium_half" });
      },
    },
  ],
});
