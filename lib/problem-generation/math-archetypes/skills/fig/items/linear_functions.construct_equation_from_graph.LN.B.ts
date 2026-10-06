// linear_functions.construct_equation_from_graph.LN.B — B형: 기준 직선 그래프(지문의 그림)에서 기울기·절편을 읽어, 말로 주어진 조건(평행·대칭·기울기 2 배·x 절편)을 만족하는 직선의 그래프를 4개 중에서 고른다.
// 오답 규칙은 원형마다 선언한다(점의 좌표를 바꿔 씀·부호 오류·절편 오류 등). 모든 선택지 그래프는 같은 축(x·y)을 쓰고 라벨·점이 없다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { keyBundle, SPR_NO_B } from "../b-kit";
import { makePureLine, pureIntro } from "../pure-kit";
import { COORD_TAILS, INTRO_TAILS, LEADS_G, LINE_KEY_JS, lineChoice, lineKey } from "../ln-b-kit";

const intro = (rng: Rng, extra = "") => `${rng.pick(LEADS_G)}${pureIntro(rng)} ${rng.pick(INTRO_TAILS)} ${rng.pick(COORD_TAILS)}${extra}`;
const rd: [string, string] = ["기준 그래프에서 표시점 두 개를 읽어 기울기 m 과 y 절편 b 를 구한다.", "Read two points to find the slope and the y-intercept."];
const EXP = (expr: string) => `const [m,b]=STEMLINE(); const rd=(x)=>Math.round(x*1e6)/1e6; const EXPECT=rd(${expr.split("|")[0]})+'|'+rd(${expr.split("|")[1]});`;
function mk(rng: Rng, o: { ms?: number[] }) { const s = makePureLine(rng, { ms: o.ms ?? [-3, -2, -1, 1, 2, 3] }); return s; }
const ch = (R: number, m: number, b: number) => ({ fig: lineChoice(R, m, b), key: lineKey(m, b) });
const Qs = (what: string) => [`Which graph shows ${what}?`, `Which of the following graphs shows ${what}?`, `Which one of the four graphs represents ${what}?`];

export const ITEM = defineItem({
  prefix: "lf", itemId: "linear_functions.construct_equation_from_graph.LN.B",
  hard: [
    {
      op: "repr_shift", structure: "기준 직선과 평행하면서 주어진 점을 지나는 직선의 그래프를 고름", extra: "기준 직선에서 기울기를 읽어 주어진 점을 지나게 절편을 다시 구해야 함(점의 좌표를 바꿔 쓰거나 q 를 절편으로 쓰는 함정) — medium 은 기울기의 부호만 바꾼 직선", sprNo: SPR_NO_B,
      concepts: ["직선의 방정식", "평행한 직선", "그래프 읽기"],
      gen(rng) {
        const s = mk(rng, {}); const p = rng.nz(-4, 4), q = rng.int(-(s.R - 2), s.R - 2); const b2 = q - s.m * p; if (!Number.isInteger(b2) || q === 0) throw new GenFail("절편");
        const ok = ch(s.R, s.m, b2); const w1 = ch(s.R, s.m, p - s.m * q), w2 = ch(s.R, -s.m, q + s.m * p), w3 = ch(s.R, s.m, q);
        return keyBundle(rng, { stimulus: intro(rng, ` The point marked off the line in the given graph is used in the question.`), question: rng.pick(Qs(`the line that is parallel to the given line and passes through the point $(${p}, ${q})$`)), stem: { ...s.fig, objects: [...s.fig.objects, { id: "Q1", kind: "point", at: [p, q] }] }, correct: ok, wrongs: [{ ...w1, rule: "LNB_SWAP_POINT" }, { ...w2, rule: "LNB_NEG_SLOPE" }, { ...w3, rule: "LNB_Q_AS_INTERCEPT" }], P: { p, q }, keyJs: LINE_KEY_JS, semanticJs: EXP("m|P.q-m*P.p"),
          trace: [rd, [`평행하므로 기울기는 m = ${s.m} 로 같다.`, "Parallel lines have equal slopes."], [`점 (${p}, ${q}) 을 지나므로 b' = ${q} - (${s.m})(${p}) = ${b2} 이다.`, "Fit the intercept to the point."], [`y = ${s.m}x + ${b2} 의 그래프를 고른다.`, "Choose that graph."], [`다른 그래프는 점의 좌표를 바꿔 쓰거나 기울기 부호를 바꾸거나 q 를 절편으로 쓴 것이다.`, "The others misuse the point or the slope."]], variant: "parallel_through_point" });
      },
    },
    {
      op: "chain2", structure: "기준 직선을 y 축에 대해 대칭이동한 직선(기울기 부호 반대, 절편 같음)의 그래프를 고름", extra: "y 축 대칭은 기울기의 부호만 바뀌고 y 절편은 그대로임을 알아야 함(x 축 대칭·원점 대칭과 구별하는 함정) — medium 은 기울기 부호만 바뀐 경우", sprNo: SPR_NO_B,
      concepts: ["직선의 방정식", "대칭이동", "그래프 읽기"],
      gen(rng) {
        const s = mk(rng, {}); const ok = ch(s.R, -s.m, s.b), w1 = ch(s.R, -s.m, -s.b), w2 = ch(s.R, s.m, -s.b), w3 = ch(s.R, -s.m, s.b + (rng.chance(0.5) ? 3 : -3));
        return keyBundle(rng, { stimulus: intro(rng), question: rng.pick(Qs("the reflection of the given line over the $y$-axis")), stem: s.fig, correct: ok, wrongs: [{ ...w1, rule: "LNB_X_AXIS" }, { ...w2, rule: "LNB_ORIGIN" }, { ...w3, rule: "LNB_Y_SHIFT" }], P: {}, keyJs: LINE_KEY_JS, semanticJs: EXP("-m|b"),
          trace: [rd, [`y 축 대칭: (x, y) → (-x, y) 이므로 기울기는 ${-s.m}, y 절편은 ${s.b} 로 그대로이다.`, "Reflection over the y-axis negates the slope and keeps the intercept."], [`y = ${-s.m}x + ${s.b} 의 그래프를 고른다.`, "Choose that graph."], [`x 축 대칭은 절편의 부호도 바뀌고 원점 대칭과는 기울기가 다르다.`, "The x-axis and origin reflections differ."], [`절편이 달라진 그래프는 대칭이동이 아니다.`, "A shifted intercept is not a reflection."]], variant: "reflect_over_y_axis" });
      },
    },
    {
      op: "compose_kind", structure: "기준 직선과 y 절편은 같고 기울기가 2 배인 직선의 그래프를 고름", extra: "기울기만 2 배로 하고 절편은 그대로 둬야 함(절편을 2 배 하거나 부호를 바꾸거나 2 를 더하는 함정) — medium 은 기울기 부호", sprNo: SPR_NO_B,
      concepts: ["직선의 방정식", "기울기", "그래프 읽기"],
      gen(rng) {
        const s = mk(rng, { ms: [-2, -1, 1, 2] }); const ok = ch(s.R, 2 * s.m, s.b), w1 = ch(s.R, s.m, 2 * s.b), w2 = ch(s.R, 2 * s.m, -s.b), w3 = ch(s.R, s.m + 2, s.b);
        return keyBundle(rng, { stimulus: intro(rng), question: rng.pick(Qs("the line with the same $y$-intercept as the given line and a slope that is twice the slope of the given line")), stem: s.fig, correct: ok, wrongs: [{ ...w1, rule: "LNB_B_DOUBLED" }, { ...w2, rule: "LNB_SIGN_FLIP" }, { ...w3, rule: "LNB_SLOPE_ADD" }], P: {}, keyJs: LINE_KEY_JS, semanticJs: EXP("2*m|b"),
          trace: [rd, [`기울기 ${s.m} 의 2 배는 ${2 * s.m} 이고 y 절편은 ${s.b} 로 같다.`, "Double the slope and keep the intercept."], [`y = ${2 * s.m}x + ${s.b} 의 그래프를 고른다.`, "Choose that graph."], [`절편을 2 배 하거나 부호를 바꾼 그래프는 조건에 맞지 않는다.`, "Do not change the intercept."], [`기울기에 2 를 더한 그래프도 2 배가 아니다.`, "Adding 2 is not doubling."]], variant: "slope_doubled" });
      },
    },
    {
      op: "inverse", structure: "기준 직선과 기울기가 같고 x 절편이 주어진 직선의 그래프를 고름", extra: "x 절편 (a, 0) 을 지나도록 y 절편 −ma 를 거꾸로 구해야 함(x 절편을 y 절편으로 쓰는 함정) — medium 은 y 절편이 주어진 경우", sprNo: SPR_NO_B,
      concepts: ["직선의 방정식", "x 절편", "역산"],
      gen(rng) {
        const s = mk(rng, {}); const a = rng.nz(-4, 4); const b2 = -s.m * a; if (b2 === 0 || Math.abs(b2) > s.R - 2) throw new GenFail("절편");
        const ok = ch(s.R, s.m, b2), w1 = ch(s.R, s.m, a), w2 = ch(s.R, -s.m, s.m * a), w3 = ch(s.R, s.m, s.m * a);
        return keyBundle(rng, { stimulus: intro(rng), question: rng.pick(Qs(`the line with the same slope as the given line that crosses the $x$-axis where $x = ${a}$`)), stem: s.fig, correct: ok, wrongs: [{ ...w1, rule: "LNB_X_AS_Y_INT" }, { ...w2, rule: "LNB_SIGN_FLIP" }, { ...w3, rule: "LNB_SIGN_B" }], P: { a }, keyJs: LINE_KEY_JS, semanticJs: EXP("m|-m*P.a"),
          trace: [rd, [`기울기는 m = ${s.m} 이고 (${a}, 0) 을 지나므로 0 = ${s.m}·${a} + b' 에서 b' = ${b2} 이다.`, "Solve for the intercept using the x-intercept."], [`y = ${s.m}x + ${b2} 의 그래프를 고른다.`, "Choose that graph."], [`x 절편 ${a} 를 y 절편으로 쓴 그래프는 오답이다.`, "Do not use the x-intercept as the y-intercept."], [`부호를 잘못 구한 그래프도 오답이다.`, "Check the sign."]], variant: "same_slope_x_intercept" });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "same_slope_new_intercept", structure: "기준 직선과 기울기가 같고 y 절편이 주어진 직선의 그래프를 고름", extra: "easy: 기울기 그대로, 절편 교체", sprNo: SPR_NO_B, concepts: ["직선의 방정식", "그래프 읽기"],
      gen(rng) {
        const s = mk(rng, {}); const k = rng.int(-(s.R - 3), s.R - 3); if (k === 0 || k === s.b) throw new GenFail("절편");
        const ok = ch(s.R, s.m, k), w1 = ch(s.R, -s.m, k), w2 = ch(s.R, s.m, -k), w3 = ch(s.R, s.m, s.b);
        return keyBundle(rng, { stimulus: intro(rng), question: rng.pick(Qs(`the line with the same slope as the given line and $y$-intercept ${k}`)), stem: s.fig, correct: ok, wrongs: [{ ...w1, rule: "LNB_NEG_SLOPE" }, { ...w2, rule: "LNB_SIGN_B" }, { ...w3, rule: "LNB_OLD_INTERCEPT" }], P: { k }, keyJs: LINE_KEY_JS, semanticJs: EXP("m|P.k"), trace: [rd, [`기울기 ${s.m} 은 그대로이고 y 절편은 ${k} 이다.`, "Keep the slope; use the new intercept."]], variant: "easy_same_slope" });
      },
    },
    {
      lv: "medium", name: "negated_slope", structure: "기준 직선과 y 절편이 같고 기울기의 부호가 반대인 직선의 그래프를 고름", extra: "medium: 부호만 바꿈", sprNo: SPR_NO_B, concepts: ["직선의 방정식", "기울기"],
      gen(rng) {
        const s = mk(rng, {}); const ok = ch(s.R, -s.m, s.b), w1 = ch(s.R, s.m, -s.b), w2 = ch(s.R, -s.m, -s.b), w3 = ch(s.R, -s.m, s.b + 3);
        return keyBundle(rng, { stimulus: intro(rng), question: rng.pick(Qs("the line with the same $y$-intercept as the given line and the opposite slope")), stem: s.fig, correct: ok, wrongs: [{ ...w1, rule: "LNB_SIGN_B" }, { ...w2, rule: "LNB_BOTH_SIGNS" }, { ...w3, rule: "LNB_Y_SHIFT" }], P: {}, keyJs: LINE_KEY_JS, semanticJs: EXP("-m|b"), trace: [rd, [`기울기 ${-s.m}, 절편 ${s.b} 이다.`, "Negate only the slope."], [`절편의 부호까지 바꾸면 오답이다.`, "Keep the intercept."]], variant: "medium_negated_slope" });
      },
    },
  ],
});
