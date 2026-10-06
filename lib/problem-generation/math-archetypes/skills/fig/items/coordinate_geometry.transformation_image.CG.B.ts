// coordinate_geometry.transformation_image.CG.B — B형: 기준 삼각형(지문의 그림)에 대칭·회전·이동(또는 그 합성)을 적용한 상의 그래프를 같은 축의 그래프 4개 중에서 고른다.
// 정답은 기준 그림에서 읽은 세 꼭짓점으로 변환을 다시 계산하고, 오답은 선언한 규칙(다른 축 대칭·반대 회전·변환 순서·이동 방향)으로 진단한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { keyBundle, SPR_NO_B } from "../b-kit";
import { TAILS } from "../sx-kit";
import { INTRO_TAILS, LEADS_G, POLY_KEY_JS, polyFig, rngPoly } from "../ln-b-kit";

type V = [number, number][];
const intro = (rng: Rng, extra = "") => `${rng.pick(LEADS_G)}${rng.pick([
  "A triangle is graphed in the $xy$-plane of the given figure.", "The given figure shows a triangle drawn on a coordinate grid.", "The first graph shows triangle in the $xy$-plane, followed by four candidate graphs.", "In the $xy$-plane shown first, a triangle is drawn with its vertices on grid points.", "A triangle with vertices at grid points is shown in the given figure.",
])} ${rng.pick(INTRO_TAILS)} ${rng.pick(TAILS)}${extra}`;
const rd: [string, string] = ["기준 그래프에서 세 꼭짓점의 좌표를 읽는다.", "Read the three vertices."];
const Q = (what: string) => [`Which graph shows ${what}?`, `Which of the following graphs shows ${what}?`, `Which one of the four graphs represents ${what}?`];
const SEM = (e: string) => `const V=STEMP(); const f=(v)=>${e}; const EXPECT=fmtKey(V.map(f));`;
const T = (v: V, f: (p: [number, number]) => [number, number]): V => v.map(f);
const pf = (R: number, v: V) => polyFig(R, v);
const scene = (rng: Rng) => { const v = rngPoly(rng); return { R: 10, v, fig: pf(10, v) }; };
const pts = (v: V) => v.map((p) => `(${p[0]}, ${p[1]})`).join(", ");

export const ITEM = defineItem({
  prefix: "cg", itemId: "coordinate_geometry.transformation_image.CG.B",
  hard: [
    {
      op: "repr_shift", structure: "기준 삼각형을 y 축에 대해 대칭한 상의 그래프를 고름", extra: "y 축 대칭은 x 좌표의 부호만 바뀜을 알아야 함(x 축 대칭·원점 대칭·y = x 대칭과 구별하는 함정) — medium 은 x 축 대칭", sprNo: SPR_NO_B,
      concepts: ["좌표평면의 변환", "대칭이동", "그래프 읽기"],
      gen(rng) {
        const s = scene(rng); const ok = pf(s.R, T(s.v, ([x, y]) => [-x, y])), w1 = pf(s.R, T(s.v, ([x, y]) => [x, -y])), w2 = pf(s.R, T(s.v, ([x, y]) => [-x, -y])), w3 = pf(s.R, T(s.v, ([x, y]) => [y, x]));
        return keyBundle(rng, { stimulus: intro(rng, ` The triangle is reflected over the $y$-axis.`), question: rng.pick(Q("the image of the triangle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_X_AXIS" }, { ...w2, rule: "CGB_ROT180" }, { ...w3, rule: "CGB_Y_EQ_X" }], P: {}, keyJs: POLY_KEY_JS, semanticJs: SEM("[-v[0],v[1]]"),
          trace: [rd, [`꼭짓점: ${pts(s.v)} 이다.`, "The vertices."], [`y 축 대칭: (x, y) → (-x, y) 이므로 x 좌표의 부호만 바뀐다.`, "Reflection over the y-axis."], [`상의 꼭짓점: ${pts(T(s.v, ([x, y]) => [-x, y]))} 이다.`, "The image."], [`x 축 대칭·원점 대칭·y = x 대칭은 다른 좌표를 바꾼다.`, "Other reflections change other coordinates."]], variant: "reflect_over_y_axis" });
      },
    },
    {
      op: "chain2", structure: "기준 삼각형을 x 축에 대해 대칭한 뒤 평행이동한 상의 그래프를 고름", extra: "변환 순서(대칭 → 이동)를 지켜야 함(이동 후 대칭하거나 한 변환만 적용하는 함정) — medium 은 평행이동", sprNo: SPR_NO_B,
      concepts: ["좌표평면의 변환", "합성 변환", "순서"],
      gen(rng) {
        const s = scene(rng); const dx = rng.pick([-3, -2, 2, 3]), dy = rng.pick([-3, -2, 2, 3]);
        const ok = pf(s.R, T(s.v, ([x, y]) => [x + dx, -y + dy])), w1 = pf(s.R, T(s.v, ([x, y]) => [x + dx, -(y + dy)])), w2 = pf(s.R, T(s.v, ([x, y]) => [x, -y])), w3 = pf(s.R, T(s.v, ([x, y]) => [x + dx, y + dy]));
        return keyBundle(rng, { stimulus: intro(rng, ` The triangle is first reflected over the $x$-axis and then translated ${dx > 0 ? `${dx} units to the right` : `${-dx} units to the left`} and ${dy > 0 ? `${dy} units up` : `${-dy} units down`}.`), question: rng.pick(Q("the final image of the triangle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_ORDER" }, { ...w2, rule: "CGB_REFLECT_ONLY" }, { ...w3, rule: "CGB_TRANSLATE_ONLY" }], P: { dx, dy }, keyJs: POLY_KEY_JS, semanticJs: SEM("[v[0]+P.dx,-v[1]+P.dy]"),
          trace: [rd, [`x 축 대칭: (x, y) → (x, -y) 이다.`, "Reflect first."], [`이동: (x, -y) → (x ${dx < 0 ? "-" : "+"} ${Math.abs(dx)}, -y ${dy < 0 ? "-" : "+"} ${Math.abs(dy)}) 이다.`, "Then translate."], [`상의 꼭짓점: ${pts(T(s.v, ([x, y]) => [x + dx, -y + dy]))} 이다.`, "The image."], [`이동을 먼저 하면 y 좌표가 -(y ${dy < 0 ? "-" : "+"} ${Math.abs(dy)}) 로 달라진다.`, "Order matters."]], variant: "reflect_then_translate" });
      },
    },
    {
      op: "compose_kind", structure: "기준 삼각형을 원점을 중심으로 시계 반대 방향으로 90° 회전한 상의 그래프를 고름", extra: "(x, y) → (−y, x) 를 알아야 함(시계 방향 회전·180° 회전·y = x 대칭과 구별하는 함정) — medium 은 y 축 대칭", sprNo: SPR_NO_B,
      concepts: ["좌표평면의 변환", "회전", "그래프 읽기"],
      gen(rng) {
        const s = scene(rng); const ok = pf(s.R, T(s.v, ([x, y]) => [-y, x])), w1 = pf(s.R, T(s.v, ([x, y]) => [y, -x])), w2 = pf(s.R, T(s.v, ([x, y]) => [-x, -y])), w3 = pf(s.R, T(s.v, ([x, y]) => [y, x]));
        return keyBundle(rng, { stimulus: intro(rng, ` The triangle is rotated $90^\\circ$ counterclockwise about the origin.`), question: rng.pick(Q("the image of the triangle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_CLOCKWISE" }, { ...w2, rule: "CGB_ROT180" }, { ...w3, rule: "CGB_Y_EQ_X" }], P: {}, keyJs: POLY_KEY_JS, semanticJs: SEM("[-v[1],v[0]]"),
          trace: [rd, [`꼭짓점: ${pts(s.v)} 이다.`, "The vertices."], [`시계 반대 방향 90° 회전: (x, y) → (-y, x) 이다.`, "The rotation rule."], [`상의 꼭짓점: ${pts(T(s.v, ([x, y]) => [-y, x]))} 이다.`, "The image."], [`시계 방향이면 (y, -x), 180° 이면 (-x, -y) 이다.`, "The other rotations differ."]], variant: "rotate_90_ccw" });
      },
    },
    {
      op: "inverse", structure: "x 좌표가 가장 큰 꼭짓점이 옮겨진 점의 x·y 좌표가 말로 주어질 때 평행이동 벡터를 거꾸로 구해 상의 그래프를 고름", extra: "도착한 점에서 원래 꼭짓점을 빼 이동 벡터를 구해야 함(도착점 좌표를 이동량으로 쓰거나 부호를 반대로 하는 함정) — medium 은 이동량이 주어진 경우", sprNo: SPR_NO_B,
      concepts: ["좌표평면의 변환", "평행이동", "역산"],
      gen(rng) {
        const s = scene(rng); const vi = s.v.reduce((b, p, i) => (p[0] > s.v[b][0] ? i : b), 0); const [ax, ay] = s.v[vi]; if (s.v.filter((p) => p[0] === ax).length > 1) throw new GenFail("최대 x 중복"); const dx = rng.pick([-3, -2, 2, 3]), dy = rng.pick([-3, -2, 2, 3]); const px = ax + dx, py = ay + dy;
        const ok = pf(s.R, T(s.v, ([x, y]) => [x + dx, y + dy])), w1 = pf(s.R, T(s.v, ([x, y]) => [x + px, y + py])), w2 = pf(s.R, T(s.v, ([x, y]) => [x - dx, y - dy])), w3 = pf(s.R, T(s.v, ([x, y]) => [x + dy, y + dx]));
        return keyBundle(rng, { stimulus: intro(rng, ` The triangle is translated so that its vertex with the greatest $x$-coordinate moves to the point with $x$-coordinate ${px} and $y$-coordinate ${py}.`), question: rng.pick(Q("the image of the triangle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_VECTOR_AS_POINT" }, { ...w2, rule: "CGB_REVERSED" }, { ...w3, rule: "CGB_SWAPPED" }], P: { px, py }, keyJs: POLY_KEY_JS, semanticJs: `const V=STEMP(); const mx=Math.max(...V.map(p=>p[0])); const a=V.find(p=>p[0]===mx); const dx=P.px-a[0], dy=P.py-a[1]; const EXPECT=fmtKey(V.map(p=>[p[0]+dx,p[1]+dy]));`,
          trace: [rd, [`x 좌표가 가장 큰 꼭짓점은 (${ax}, ${ay}) 이다.`, "The rightmost vertex."], [`이동 벡터 = (${px} - ${ax}, ${py} - ${ay}) = (${dx}, ${dy}) 이다.`, "The translation vector."], [`모든 꼭짓점에 (${dx}, ${dy}) 를 더한다.`, "Apply it to every vertex."], [`도착점 좌표를 이동량으로 쓰거나 부호를 반대로 하면 오답이다.`, "Do not use the destination as the shift."]], variant: "translation_from_vertex" });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "translate", structure: "기준 삼각형을 평행이동한 상의 그래프를 고름", extra: "easy: 이동량이 직접 주어짐", sprNo: SPR_NO_B, concepts: ["좌표평면의 변환", "평행이동"],
      gen(rng) {
        const s = scene(rng); const dx = rng.pick([-3, -2, 2, 3]), dy = rng.pick([-3, -2, 2, 3]); const ok = pf(s.R, T(s.v, ([x, y]) => [x + dx, y + dy])), w1 = pf(s.R, T(s.v, ([x, y]) => [x - dx, y - dy])), w2 = pf(s.R, T(s.v, ([x, y]) => [x + dy, y + dx])), w3 = pf(s.R, T(s.v, ([x, y]) => [x + dx, y]));
        return keyBundle(rng, { stimulus: intro(rng, ` The triangle is translated ${dx > 0 ? `${dx} units to the right` : `${-dx} units to the left`} and ${dy > 0 ? `${dy} units up` : `${-dy} units down`}.`), question: rng.pick(Q("the image of the triangle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_REVERSED" }, { ...w2, rule: "CGB_SWAPPED" }, { ...w3, rule: "CGB_ONE_DIRECTION" }], P: { dx, dy }, keyJs: POLY_KEY_JS, semanticJs: SEM("[v[0]+P.dx,v[1]+P.dy]"), trace: [rd, [`모든 꼭짓점에 (${dx}, ${dy}) 를 더한다.`, "Add the shift."]], variant: "easy_translate" });
      },
    },
    {
      lv: "medium", name: "reflect_x", structure: "기준 삼각형을 x 축에 대해 대칭한 상의 그래프를 고름", extra: "medium: y 좌표의 부호만 바뀜", sprNo: SPR_NO_B, concepts: ["좌표평면의 변환", "대칭이동"],
      gen(rng) {
        const s = scene(rng); const ok = pf(s.R, T(s.v, ([x, y]) => [x, -y])), w1 = pf(s.R, T(s.v, ([x, y]) => [-x, y])), w2 = pf(s.R, T(s.v, ([x, y]) => [-x, -y])), w3 = pf(s.R, T(s.v, ([x, y]) => [y, x]));
        return keyBundle(rng, { stimulus: intro(rng, ` The triangle is reflected over the $x$-axis.`), question: rng.pick(Q("the image of the triangle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_Y_AXIS" }, { ...w2, rule: "CGB_ROT180" }, { ...w3, rule: "CGB_Y_EQ_X" }], P: {}, keyJs: POLY_KEY_JS, semanticJs: SEM("[v[0],-v[1]]"), trace: [rd, [`x 축 대칭: (x, y) → (x, -y) 이다.`, "Reflection over the x-axis."], [`y 좌표의 부호만 바뀌므로 상은 x 축 반대편에 놓인다.`, "Only the y-coordinates change sign."]], variant: "medium_reflect_x" });
      },
    },
  ],
});
void ([] as V);
