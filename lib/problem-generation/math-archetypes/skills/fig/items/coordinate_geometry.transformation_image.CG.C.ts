import { un } from "../cg-kit";
// coordinate_geometry.transformation_image.CG.C — 지문의 삼각형과 변환(대칭·이동 포함 연속 변환·회전 규칙·상에서 원래 삼각형)에 맞는 상(점선)을 보여 주는 그림을 4개 중에서 고른다.
// 오답 규칙: rx·ry(축 대칭 오독)·cw·ccw(회전 방향 오독)·half(180°)·swap·anti(대각선 대칭)·S_/O_(이동 순서·누락) 등.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { retry } from "../ext-kit";
import type { P2 } from "../cg-kit";
import { OPS_JS, SPR_NO_CG, TR_JS, cgcTriIntro, triChoices, type Tri } from "../cgc-kit";

const Q = (rng: Rng) => rng.pick(["Which figure shows the triangle and its image, drawn dashed?", "Which graph shows the image of the triangle as a dashed triangle?", "Which of the following figures shows the correct image?", "Which figure shows the dashed image after the transformation?"]);
const tri = (rng: Rng): Tri => { for (let i = 0; i < 60; i++) { const p: Tri = [0, 1, 2].map(() => [rng.int(1, 6), rng.int(1, 6)] as P2); if (new Set(p.map((q) => q.join())).size < 3) continue; const ar = Math.abs(p[0][0] * (p[1][1] - p[2][1]) + p[1][0] * (p[2][1] - p[0][1]) + p[2][0] * (p[0][1] - p[1][1])); if (ar < 6) continue; if (new Set(p.map((q) => q[0])).size < 3 || new Set(p.map((q) => q[1])).size < 3) continue; if (p.some((q) => q[0] === q[1])) continue; return p; } throw new GenFail("삼각형"); };
const vt = (t: Tri) => `(${t[0].join(", ")}), (${t[1].join(", ")}), and (${t[2].join(", ")})`;
const mv = (f: (v: P2) => P2, t: Tri): Tri => t.map(f);
const shift = (t: Tri, dx: number, dy: number): Tri => t.map((v) => [v[0] + dx, v[1] + dy] as P2);
const LEAD_T = ["A triangle has vertices", "Consider the triangle with vertices", "The vertices of a triangle are", "A triangle is drawn with vertices", "In the coordinate plane, a triangle has vertices", "Take the triangle whose vertices are"];
const GEN_DIAG = "const t=V(c,'T'), im=V(c,'I'); for (const n of Object.keys(OPS)) { if (n==='id') continue; if (same(im, mv(OPS[n], t))) return n; } return null;";
const SH_DIAG = "const t=V(c,'T'), im=V(c,'I'); for (const n of Object.keys(OPS)) { if (same(im, mv(OPS[n], t))) return 'N_'+n; if (same(im, shift(mv(OPS[n], t), P.dx, P.dy))) return 'S_'+n; if (same(im, mv(OPS[n], shift(t, P.dx, P.dy)))) return 'O_'+n; } return null;";
function build(rng: Rng, t: Tri, ok: Tri, cands: Tri[], P: Record<string, number>, pred: string, diag: string, stim: string, trace: [string, string][], variant: string) {
  const { choices, correctIndex, rules } = triChoices(rng, t, ok, cands, P, pred, diag);
  return guard(choiceInst(rng, { stimulus: cgcTriIntro(rng, stim), question: Q(rng), choices, correctIndex, rules, P, predicateJs: `${TR_JS}${pred}`, diagnoseJs: `${TR_JS}${diag}`, trace, variant, explainKo: "", explainEn: "" }));
}
const one = (f: (rng: Rng) => ReturnType<typeof build>) => (rng: Rng) => retry(rng, () => f(rng), 24);
const allOps = (t: Tri, skip: string[] = []) => Object.entries(OPS_JS).filter(([n]) => n !== "id" && !skip.includes(n)).map(([, f]) => mv(f, t));
const stim = (rng: Rng, t: Tri, tail: string) => `${rng.pick(LEAD_T)} ${vt(t)}. ${tail}`;

const RAW = defineItem({
  prefix: "av", itemId: "coordinate_geometry.transformation_image.CG.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_CG, structure: "삼각형을 y 축에 대해 대칭이동한 상을 좌표로 구해 그 상이 점선으로 그려진 그림을 고름", extra: "x 좌표의 부호만 바꿔야 함(x 축 대칭·회전·좌표 맞바꿈이 함정) — medium 은 x 축 대칭", concepts: ["대칭이동", "좌표 읽기", "그림 비교"],
      gen: one((rng) => { const t = tri(rng); const ok = mv(OPS_JS.ry, t); return build(rng, t, ok, allOps(t, ["ry"]), {}, "const t=V(c,'T'); return same(V(c,'I'), mv(OPS.ry, t));", GEN_DIAG, stim(rng, t, rng.pick(["It is reflected across the $y$-axis.", "The triangle is reflected across the $y$-axis to form its image.", "Its image is formed by a reflection across the $y$-axis.", "The triangle undergoes a reflection across the $y$-axis."])), [[`y 축 대칭은 (x, y) → (−x, y) 이다.`, "Reflection across the y-axis."], [`세 꼭짓점의 x 좌표의 부호를 바꾼다.`, "Flip the sign of each x-coordinate."], [`상의 꼭짓점은 ${vt(ok)} 이다.`, "The image vertices."], [`x 축 대칭·회전·좌표를 맞바꾼 그림은 오답이다.`, "Other transformations give different images."], [`이 꼭짓점을 가진 점선 삼각형을 고른다.`, "Pick the matching dashed triangle."]], "triangle_image_choice_reflect_y"); }) },
    { op: "chain2", sprNo: SPR_NO_CG, structure: "삼각형을 x 축에 대해 대칭이동한 뒤 오른쪽·위로 평행이동한 상을 구해 점선으로 그려진 그림을 고름", extra: "대칭이동 뒤에 이동해야 함(이동 순서를 바꾸거나 한 변환을 빠뜨리면 오답) — medium 은 대칭이동만", concepts: ["대칭이동", "평행이동", "연속 변환"],
      gen: one((rng) => { const t = tri(rng); const dx = rng.int(1, 4), dy = rng.int(5, 8); const ok = shift(mv(OPS_JS.rx, t), dx, dy); const cands = [mv(OPS_JS.rx, t), mv(OPS_JS.rx, shift(t, dx, dy)), shift(t, dx, dy), shift(mv(OPS_JS.ry, t), dx, dy), shift(mv(OPS_JS.half, t), dx, dy)];
        return build(rng, t, ok, cands, { dx, dy }, "const t=V(c,'T'); return same(V(c,'I'), shift(mv(OPS.rx, t), P.dx, P.dy));", SH_DIAG, stim(rng, t, `It is reflected across the $x$-axis and then translated ${un(dx)} to the right and ${un(dy)} up.`), [[`x 축 대칭은 (x, y) → (x, −y) 이다.`, "Reflection across the x-axis."], [`대칭이동한 꼭짓점은 ${vt(mv(OPS_JS.rx, t))} 이다.`, "After the reflection."], [`오른쪽으로 ${dx}, 위로 ${dy} 이동한다.`, "Then translate."], [`상의 꼭짓점은 ${vt(ok)} 이다.`, "The final vertices."], [`이 꼭짓점을 가진 점선 삼각형을 고른다.`, "Pick the matching dashed triangle."]], "triangle_image_choice_reflect_translate"); }) },
    { op: "repr_shift", sprNo: SPR_NO_CG, structure: "규칙 (x, y) → (−y, x) 로 주어진 변환을 반시계 방향 90° 회전으로 옮겨 상이 점선으로 그려진 그림을 고름", extra: "규칙을 좌표에 적용해야 함(시계 방향으로 읽거나 부호를 놓치면 오답) — medium 은 회전이 말로 주어짐", concepts: ["회전", "표현 바꾸기", "그림 비교"],
      gen: one((rng) => { const t = tri(rng); const ok = mv(OPS_JS.ccw, t); return build(rng, t, ok, allOps(t, ["ccw"]), {}, "const t=V(c,'T'); return same(V(c,'I'), mv(OPS.ccw, t));", GEN_DIAG, stim(rng, t, rng.pick(["Each point $(x, y)$ of the triangle is mapped to $(-y, x)$.", "The triangle is transformed by the rule $(x, y) \\to (-y, x)$.", "Its image is formed by sending every point $(x, y)$ to $(-y, x)$.", "Every point $(x, y)$ moves to the point $(-y, x)$."])), [[`규칙 (x, y) → (−y, x) 를 각 꼭짓점에 적용한다.`, "Apply the rule to each vertex."], [`x 좌표는 −y 가 되고 y 좌표는 x 가 된다.`, "The new x is −y, and the new y is x."], [`상의 꼭짓점은 ${vt(ok)} 이다.`, "The image vertices."], [`시계 방향 회전이나 대칭이동의 그림은 오답이다.`, "A clockwise turn or a reflection gives a different image."], [`이 꼭짓점을 가진 점선 삼각형을 고른다.`, "Pick the matching dashed triangle."]], "triangle_image_choice_rotate_rule"); }) },
    { op: "inverse", sprNo: SPR_NO_CG, structure: "실선 삼각형이 시계 방향 90° 회전의 상이라고 할 때 반시계 방향 90° 회전으로 거꾸로 원래 삼각형을 구해 점선으로 그려진 그림을 고름", extra: "변환을 거꾸로 되돌려야 함(같은 방향으로 한 번 더 회전하거나 대칭이동하면 오답) — medium 은 대칭이동의 역", concepts: ["회전", "역변환", "그림 비교"],
      gen: one((rng) => { const t = tri(rng); const ok = mv(OPS_JS.ccw, t); return build(rng, t, ok, allOps(t, ["ccw"]), {}, "const t=V(c,'T'); return same(V(c,'I'), mv(OPS.ccw, t));", GEN_DIAG, `${rng.pick(LEAD_T)} ${vt(t)}. ${rng.pick(["This triangle is the image of another triangle after a rotation of 90 degrees clockwise about the origin. Which figure shows that original triangle as the dashed triangle?", "It was obtained by rotating a triangle 90 degrees clockwise about the origin. Which figure shows the triangle that was rotated, drawn dashed?", "A triangle was turned a quarter turn clockwise about the origin and landed here. Which figure shows the starting triangle as the dashed one?", "This triangle is what remains after a 90-degree clockwise rotation about the origin. Which figure draws the pre-image dashed?", "The triangle shown is the result of rotating another triangle clockwise through 90 degrees about the origin. In which figure is that other triangle dashed?", "Rotating some triangle 90 degrees clockwise about the origin gives this triangle. Which figure shows that pre-image as a dashed triangle?"])}`, [[`시계 방향 90° 회전은 (x, y) → (y, −x) 이다.`, "A clockwise quarter turn."], [`되돌리려면 반시계 방향 90° 회전 (x, y) → (−y, x) 를 적용한다.`, "Undo it with a counterclockwise quarter turn."], [`원래 꼭짓점은 ${vt(ok)} 이다.`, "The original vertices."], [`같은 방향으로 한 번 더 돌린 그림은 오답이다.`, "Turning the same way again is wrong."], [`이 꼭짓점을 가진 점선 삼각형을 고른다.`, "Pick the matching dashed triangle."]], "triangle_image_choice_inverse_rotation"); }) },
  ],
  em: [
    { lv: "easy", name: "reflect_x", sprNo: SPR_NO_CG, structure: "삼각형을 x 축에 대해 대칭이동한 상이 점선으로 그려진 그림을 고름", extra: "easy: y 좌표의 부호만 바뀜", concepts: ["대칭이동", "문제 조건 해석"],
      gen: one((rng) => { const t = tri(rng); const ok = mv(OPS_JS.rx, t); return build(rng, t, ok, allOps(t, ["rx"]), {}, "const t=V(c,'T'); return same(V(c,'I'), mv(OPS.rx, t));", GEN_DIAG, stim(rng, t, "It is reflected across the $x$-axis."), [[`x 축 대칭은 (x, y) → (x, −y) 이다.`, "Reflection across the x-axis."], [`상의 꼭짓점은 ${vt(ok)} 이다.`, "The image vertices."], [`이 점선 삼각형을 고른다.`, "Pick the matching dashed triangle."]], "triangle_image_choice_easy"); }) },
    { lv: "medium", name: "reflect_yx", sprNo: SPR_NO_CG, structure: "삼각형을 직선 y = x 에 대해 대칭이동한 상이 점선으로 그려진 그림을 고름", extra: "medium: 좌표를 맞바꿈", concepts: ["대칭이동", "그림 비교"],
      gen: one((rng) => { const t = tri(rng); const ok = mv(OPS_JS.swap, t); return build(rng, t, ok, allOps(t, ["swap"]), {}, "const t=V(c,'T'); return same(V(c,'I'), mv(OPS.swap, t));", GEN_DIAG, stim(rng, t, "It is reflected across the line $y = x$."), [[`y = x 대칭은 (x, y) → (y, x) 이다.`, "Reflection across y = x."], [`상의 꼭짓점은 ${vt(ok)} 이다.`, "The image vertices."], [`이 점선 삼각형을 고른다.`, "Pick the matching dashed triangle."]], "triangle_image_choice_medium"); }) },
  ],
});
export const ITEM = RAW;
void (null as unknown as Rng);
