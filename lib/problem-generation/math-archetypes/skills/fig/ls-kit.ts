// L자형(LS) 계열 공용 장면 키트 — 그림의 변 라벨에만 길이가 있고 지문은 "the figure shown" 으로 가리킨다. 도식은 shape(참값)대로 그려진다(숫자 라벨은 비례).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { TAILS } from "./sx-kit";

export type LScene = { W: number; H: number; w1: number; h1: number; a: number; b: number };
export function makeL(rng: Rng): LScene {
  for (let t = 0; t < 100; t++) { const W = rng.int(8, 20), H = rng.int(8, 20), w1 = rng.int(3, W - 3), h1 = rng.int(3, H - 3); const a = W - w1, b = H - h1; if (a === b || w1 === h1 || Math.abs(W - H) < 1) continue; return { W, H, w1, h1, a, b }; }
  throw new GenFail("L자 장면 표집 실패");
}
/** edge 인덱스: 0 아래(W) · 1 오른쪽(h1) · 2 안쪽 가로(a) · 3 안쪽 세로(b) · 4 위(w1) · 5 왼쪽(H). 값 객체의 키는 edge 번호. */
export function lFig(s: LScene, labels: Partial<Record<0 | 1 | 2 | 3 | 4 | 5, string>>, notToScale = false) {
  return { type: "l_shape" as const, shape: { W: s.W, H: s.H, w1: s.w1, h1: s.h1 }, sides: (Object.entries(labels) as [string, string][]).map(([e, label]) => ({ edge: Number(e) as 0 | 1 | 2 | 3 | 4 | 5, label })), ...(notToScale ? { notToScale: true } : {}) };
}
export const L_JS = `if (!FIGURE||FIGURE.type!=='l_shape') throw new Error('L자형 자료 필요'); const E=(i)=>{ const q=(FIGURE.sides||[]).find(s=>s.edge===i); return q&&/^\\d+(?:\\.\\d+)?$/.test(String(q.label))?Number(q.label):NaN; };\n`;
export const L_INTROS = [
  "A landscaper plans a patio shaped like the figure; every angle of the patio is a right angle and the lengths are labeled in feet.",
  "The floor plan of a small classroom is the shape shown, with all corners square. The measurements on the plan are in meters.",
  "A farmer fences a garden that has the L shape in the figure. All of its corners are right angles, and lengths are in yards.",
  "A school's computer lab has the shape shown. All of the walls meet at right angles, and the labeled lengths are in feet.",
  "A parking lot is laid out as the L-shaped region in the figure, with right angles at every corner and lengths in meters.",
  "A builder drafts the footprint of a house as the figure shows. Every corner is a right angle, and the labels give lengths in feet.",
  "A city park has the L shape shown in the figure. All corners are square, and the labeled lengths are in meters.",
  "A tile installer covers a floor in the shape of the figure. Each angle is a right angle, and the labeled lengths are in feet.",
  "A swimming pool deck is L-shaped, as shown. All of its angles are right angles, and the labeled lengths are in yards.",
  "A museum gallery has the floor shape shown in the figure, with every corner a right angle and lengths in meters.",
  "A rug is cut in the L shape shown, with right angles at all of its corners. The lengths in the figure are in feet.",
  "A basketball team's practice area is the L-shaped region shown. All the angles are right angles, and lengths are in meters.",
];
export const lIntro = (rng: Rng, extra = "") => `${rng.pick(L_INTROS)} ${rng.pick(TAILS)}${extra}`;
