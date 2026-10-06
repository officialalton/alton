// circles.circle_equation_transform.CG.B — B형: 기준 원의 그래프(지문의 그림)에 말(이동·대칭·반지름 변경·새 중심의 방정식)로 주어진 변환을 적용한 원의 그래프를 같은 축의 그래프 4개 중에서 고른다.
// 정답은 기준 그림에서 읽은 중심 (cx, cy)·반지름 r 로 다시 계산하고, 오답은 선언한 규칙(이동 방향·좌표 바꿔 씀·순서·반지름 오류)으로 진단한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { keyBundle, SPR_NO_B } from "../b-kit";
import { TAILS } from "../sx-kit";
import { CIRCLE_KEY_JS, INTRO_TAILS, LEADS_G, circleFig } from "../ln-b-kit";

const intro = (rng: Rng, extra = "") => `${rng.pick(LEADS_G)}${rng.pick([
  "A circle is graphed in the $xy$-plane shown in the given figure.", "The given figure shows a circle in the $xy$-plane.", "In the $xy$-plane of the given figure, a circle is drawn on a coordinate grid.", "The graph of a circle is shown first, followed by four candidate graphs.", "A circle in the $xy$-plane is shown in the first figure.",
])} ${rng.pick(INTRO_TAILS)} ${rng.pick(TAILS)}${extra}`;
const rd: [string, string] = ["기준 그래프에서 중심 (cx, cy) 과 반지름 r 을 읽는다.", "Read the center and the radius."];
const Q = (what: string) => [`Which graph shows ${what}?`, `Which of the following graphs shows ${what}?`, `Which one of the four graphs represents ${what}?`];
const EXPC = (e: string) => `const q=STEMC(); const EXPECT=(${e}).join('|');`;
function scene(rng: Rng) { const R = 10, r = rng.pick([2, 3]), cx = rng.int(-3, 3), cy = rng.int(-3, 3); return { R, r, cx, cy, fig: circleFig(R, cx, cy, r) }; }
const ck = (R: number, cx: number, cy: number, r: number) => circleFig(R, cx, cy, r);
const dir = (v: number, pos: string, neg: string) => (v > 0 ? `${v} units ${pos}` : `${-v} units ${neg}`);

export const ITEM = defineItem({
  prefix: "ci", itemId: "circles.circle_equation_transform.CG.B",
  hard: [
    {
      op: "repr_shift", structure: "기준 원을 오른쪽·아래쪽으로 평행이동한 원의 그래프를 고름", extra: "이동 방향(오른쪽 = x 증가, 아래 = y 감소)과 x·y 이동량을 구분해야 함(방향을 반대로 하거나 x·y 이동량을 바꾸는 함정) — medium 은 x 축 대칭", sprNo: SPR_NO_B,
      concepts: ["원의 방정식", "평행이동", "그래프 읽기"],
      gen(rng) {
        const s = scene(rng); const dx = rng.pick([-4, -3, 3, 4]), dy = rng.pick([-4, -3, 3, 4]); if (Math.abs(dx) === Math.abs(dy)) throw new GenFail("같음");
        const ok = ck(s.R, s.cx + dx, s.cy + dy, s.r), w1 = ck(s.R, s.cx - dx, s.cy - dy, s.r), w2 = ck(s.R, s.cx + dy, s.cy + dx, s.r), w3 = ck(s.R, s.cx + dx, s.cy + dy, s.r + 1);
        return keyBundle(rng, { stimulus: intro(rng, ` The circle is translated ${dir(dx, "to the right", "to the left")} and ${dir(dy, "up", "down")}.`), question: rng.pick(Q("the translated circle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_OPPOSITE" }, { ...w2, rule: "CGB_SWAPPED_SHIFTS" }, { ...w3, rule: "CGB_RADIUS_CHANGED" }], P: { dx, dy }, keyJs: CIRCLE_KEY_JS, semanticJs: EXPC("[q.cx+P.dx,q.cy+P.dy,q.r]"),
          trace: [rd, [`중심은 (${s.cx}, ${s.cy}), 반지름은 ${s.r} 이다.`, "The center and radius."], [`${dir(dx, "오른쪽", "왼쪽")}으로 x 에 ${dx} 를, ${dir(dy, "위", "아래")}로 y 에 ${dy} 를 더한다.`, "Add the shifts to the coordinates."], [`새 중심은 (${s.cx + dx}, ${s.cy + dy}) 이고 반지름은 그대로이다.`, "The new center."], [`방향이나 이동량을 바꾸거나 반지름이 달라진 그래프는 오답이다.`, "The others change direction, amounts, or radius."]], variant: "circle_translate" });
      },
    },
    {
      op: "chain2", structure: "기준 원을 y 축에 대해 대칭한 뒤 평행이동한 원의 그래프를 고름", extra: "대칭을 먼저 하고 이동해야 함(이동한 뒤 대칭하거나 한 변환만 적용하는 함정) — medium 은 x 축 대칭", sprNo: SPR_NO_B,
      concepts: ["원의 방정식", "대칭이동", "평행이동"],
      gen(rng) {
        const s = scene(rng); if (s.cx === 0) throw new GenFail("중심이 y 축 위"); const dx = rng.pick([-3, 3]), dy = rng.pick([-3, -2, 2, 3]);
        const ok = ck(s.R, -s.cx + dx, s.cy + dy, s.r), w1 = ck(s.R, -(s.cx + dx), s.cy + dy, s.r), w2 = ck(s.R, -s.cx, s.cy, s.r), w3 = ck(s.R, s.cx + dx, s.cy + dy, s.r);
        return keyBundle(rng, { stimulus: intro(rng, ` The circle is first reflected over the $y$-axis and then translated ${dir(dx, "to the right", "to the left")} and ${dir(dy, "up", "down")}.`), question: rng.pick(Q("the resulting circle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_ORDER" }, { ...w2, rule: "CGB_REFLECT_ONLY" }, { ...w3, rule: "CGB_TRANSLATE_ONLY" }], P: { dx, dy }, keyJs: CIRCLE_KEY_JS, semanticJs: EXPC("[-q.cx+P.dx,q.cy+P.dy,q.r]"),
          trace: [rd, [`y 축 대칭: 중심 (${s.cx}, ${s.cy}) → (${-s.cx}, ${s.cy}) 이다.`, "Reflect the center."], [`이동: (${-s.cx + dx}, ${s.cy + dy}) 이다.`, "Then translate."], [`반지름 ${s.r} 은 그대로이다.`, "The radius is unchanged."], [`순서를 바꾸면 중심이 (${-(s.cx + dx)}, ${s.cy + dy}) 로 달라진다.`, "Order matters."]], variant: "circle_reflect_then_translate" });
      },
    },
    {
      op: "compose_kind", structure: "중심은 그대로이고 반지름이 2 배인 원의 그래프를 고름", extra: "반지름만 2 배로 하고 중심은 유지해야 함(중심까지 2 배 하거나 반지름에 더하거나 빼는 함정) — medium 은 y 축 대칭", sprNo: SPR_NO_B,
      concepts: ["원의 방정식", "반지름", "닮음 변환"],
      gen(rng) {
        const s = scene(rng); if (s.r !== 2) throw new GenFail("반지름 2"); const ok = ck(s.R, s.cx, s.cy, 4), w1 = ck(s.R, 2 * s.cx, 2 * s.cy, 4), w2 = ck(s.R, s.cx, s.cy, 3), w3 = ck(s.R, s.cx, s.cy, 1);
        return keyBundle(rng, { stimulus: intro(rng, ` A new circle has the same center as the circle shown, and its radius is twice the radius of the circle shown.`), question: rng.pick(Q("the new circle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_CENTER_SCALED" }, { ...w2, rule: "CGB_ADDED" }, { ...w3, rule: "CGB_SUBTRACTED" }], P: {}, keyJs: CIRCLE_KEY_JS, semanticJs: EXPC("[q.cx,q.cy,2*q.r]"),
          trace: [rd, [`중심은 (${s.cx}, ${s.cy}), 반지름은 ${s.r} 이다.`, "The center and radius."], [`새 원의 반지름 = 2 × ${s.r} = 4 이다.`, "Double the radius."], [`중심은 그대로 (${s.cx}, ${s.cy}) 이다.`, "Keep the center."], [`중심까지 2 배 하거나 반지름에 더하거나 빼면 오답이다.`, "Do not scale the center."]], variant: "circle_radius_doubled" });
      },
    },
    {
      op: "inverse", structure: "새 원의 방정식 (x − p)² + (y − q)² = r² 에서 중심을 읽고 반지름은 기준 원과 같을 때 그래프를 고름", extra: "방정식의 부호를 뒤집어 중심을 읽어야 함(부호를 그대로 쓰거나 x·y 를 바꾸는 함정) — medium 은 x 축 대칭", sprNo: SPR_NO_B,
      concepts: ["원의 방정식", "중심 읽기", "역산"],
      gen(rng) {
        const s = scene(rng); const p = rng.nz(-4, 4), q = rng.nz(-4, 4); if (p === q) throw new GenFail("같음");
        const ok = ck(s.R, p, q, s.r), w1 = ck(s.R, -p, -q, s.r), w2 = ck(s.R, q, p, s.r), w3 = ck(s.R, p, -q, s.r);
        const eq = `(x ${p < 0 ? "+" : "-"} ${Math.abs(p)})^2 + (y ${q < 0 ? "+" : "-"} ${Math.abs(q)})^2 = r^2`;
        return keyBundle(rng, { stimulus: intro(rng, ` A circle with the same radius as the circle shown has an equation of the form $${eq}$.`), question: rng.pick(Q("this circle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_SIGNS_KEPT" }, { ...w2, rule: "CGB_XY_SWAPPED" }, { ...w3, rule: "CGB_Y_SIGN" }], P: { p, q }, keyJs: CIRCLE_KEY_JS, semanticJs: EXPC("[P.p,P.q,q.r]"),
          trace: [rd, [`방정식 (x ${p < 0 ? "+" : "-"} ${Math.abs(p)})² + (y ${q < 0 ? "+" : "-"} ${Math.abs(q)})² 에서 중심은 (${p}, ${q}) 이다.`, "Read the center with opposite signs."], [`반지름은 기준 원과 같은 ${s.r} 이다.`, "Same radius."], [`중심 (${p}, ${q}) 이고 반지름 ${s.r} 인 원을 고른다.`, "Choose that circle."], [`부호를 그대로 읽거나 x·y 를 바꾸면 오답이다.`, "Watch the signs and the order."]], variant: "circle_from_equation" });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "shift_right", structure: "기준 원을 가로로만 평행이동한 원의 그래프를 고름", extra: "easy: x 방향 이동", sprNo: SPR_NO_B, concepts: ["원의 방정식", "평행이동"],
      gen(rng) {
        const s = scene(rng); const dx = rng.pick([-4, -3, 3, 4]); const ok = ck(s.R, s.cx + dx, s.cy, s.r), w1 = ck(s.R, s.cx - dx, s.cy, s.r), w2 = ck(s.R, s.cx, s.cy + dx, s.r), w3 = ck(s.R, s.cx + dx, s.cy, s.r + 1);
        return keyBundle(rng, { stimulus: intro(rng, ` The circle is translated ${dir(dx, "to the right", "to the left")}.`), question: rng.pick(Q("the translated circle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_OPPOSITE" }, { ...w2, rule: "CGB_WRONG_AXIS" }, { ...w3, rule: "CGB_RADIUS_CHANGED" }], P: { dx }, keyJs: CIRCLE_KEY_JS, semanticJs: EXPC("[q.cx+P.dx,q.cy,q.r]"), trace: [rd, [`x 좌표에 ${dx} 를 더한다.`, "Shift the x-coordinate."]], variant: "easy_circle_shift" });
      },
    },
    {
      lv: "medium", name: "reflect_x", structure: "기준 원을 x 축에 대해 대칭한 원의 그래프를 고름", extra: "medium: 중심의 y 부호만 바뀜", sprNo: SPR_NO_B, concepts: ["원의 방정식", "대칭이동"],
      gen(rng) {
        const s = scene(rng); if (s.cy === 0) throw new GenFail("중심이 x 축 위"); const ok = ck(s.R, s.cx, -s.cy, s.r), w1 = ck(s.R, -s.cx, s.cy, s.r), w2 = ck(s.R, -s.cx, -s.cy, s.r), w3 = ck(s.R, s.cy, s.cx, s.r);
        if (s.cx === 0 || s.cx === s.cy) throw new GenFail("겹침");
        return keyBundle(rng, { stimulus: intro(rng, ` The circle is reflected over the $x$-axis.`), question: rng.pick(Q("the reflected circle")), stem: s.fig.fig, correct: ok, wrongs: [{ ...w1, rule: "CGB_Y_AXIS" }, { ...w2, rule: "CGB_ORIGIN" }, { ...w3, rule: "CGB_XY_SWAPPED" }], P: {}, keyJs: CIRCLE_KEY_JS, semanticJs: EXPC("[q.cx,-q.cy,q.r]"), trace: [rd, [`x 축 대칭은 y 좌표의 부호만 바꾼다.`, "Reflection over the x-axis."], [`중심 (${s.cx}, ${s.cy}) 은 (${s.cx}, ${-s.cy}) 이 되고 반지름은 그대로이다.`, "The new center."]], variant: "medium_circle_reflect_x" });
      },
    },
  ],
});
