// 입체 확장(SX) 계열 공용 장면 키트 — 직육면체 대각선·삼각기둥·원기둥 축 단면·원기둥+반구 조합이 함께 쓴다.
// 규칙: 치수는 그림의 dims[].label 에만 있고(모르는 값은 x) 지문은 "the figure shown" 으로 가리킨다. 도식은 항상 not drawn to scale. verification_js 는 FIGURE.dims 만 읽어 다시 계산한다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";

// l² + w² + h² = d² (정수 직육면체)
export const BOX4: [number, number, number, number][] = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 4, 4, 6], [2, 6, 9, 11], [4, 4, 7, 9], [3, 4, 12, 13], [6, 6, 7, 11], [4, 8, 8, 12], [3, 6, 6, 9], [6, 8, 24, 26], [9, 12, 20, 25], [12, 16, 15, 25], [2, 10, 11, 15], [4, 5, 20, 21]];
/** 밑면 대각선도 정수인 것(l²+w² 가 제곱수). */
export const BOX_FACE_OK = BOX4.filter(([l, w]) => Number.isInteger(Math.sqrt(l * l + w * w)));
export type BoxScene = { l: number; w: number; h: number; d: number; f: number };
export function makeBox(rng: Rng, o: { faceOk?: boolean } = {}): BoxScene {
  const [a, b, c, d] = rng.pick(o.faceOk ? BOX_FACE_OK : BOX4); const p = o.faceOk ? (rng.chance(0.5) ? [a, b, c] : [b, a, c]) : rng.shuffle([a, b, c]); const sc = d > 15 ? 1 : rng.pick([1, 1, 2, 3]);
  const [l, w, h] = p.map((x) => x * sc); return { l, w, h, d: d * sc, f: Math.sqrt(l * l + w * w) };
}
export const dimsOf = (o: Record<string, string | undefined>) => Object.entries(o).filter(([, v]) => v !== undefined).map(([id, label]) => ({ id, label: label as string }));
export const boxFig = (diagonal: "space" | "face_bottom" | "face_front" | "both", o: Record<string, string | undefined>) => ({ type: "solid_x" as const, kind: "box_diagonal" as const, diagonal, dims: dimsOf(o), notToScale: true });
export const prismFig = (o: Record<string, string | undefined>) => ({ type: "solid_x" as const, kind: "triangular_prism" as const, dims: dimsOf(o), notToScale: true });
export const cylFig = (o: Record<string, string | undefined>) => ({ type: "solid_x" as const, kind: "cylinder_section" as const, dims: dimsOf(o), notToScale: true });
export const compFig = (o: Record<string, string | undefined>) => ({ type: "solid_x" as const, kind: "cylinder_hemisphere" as const, dims: dimsOf(o), notToScale: true });
export const DIM_JS = "if (!FIGURE||FIGURE.type!=='solid_x') throw new Error('입체 확장 자료 필요'); const D=(id)=>{ const q=FIGURE.dims.find(x=>x.id===id); if(!q) return NaN; return /^\\d+(?:\\.\\d+)?$/.test(String(q.label))?Number(q.label):NaN; }; const HAS=(id)=>!!FIGURE.dims.find(x=>x.id===id);\n";

// 직각삼각형 밑면(삼각기둥): (a, b, c) 와 배수
export const TRI3: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25], [12, 16, 20], [15, 20, 25]];
export type PrismScene = { a: number; b: number; c: number; L: number };
export function makePrism(rng: Rng): PrismScene { const [a0, b0, c0] = rng.pick(TRI3); const sw = rng.chance(0.5); return { a: sw ? b0 : a0, b: sw ? a0 : b0, c: c0, L: rng.int(4, 14) }; }

// 원기둥 축 단면: (2r)² + h² = d²
export const CYL3: [number, number, number][] = [[2, 3, 5], [3, 8, 10], [4, 6, 10], [4, 15, 17], [6, 5, 13], [6, 9, 15], [6, 16, 20], [5, 24, 26], [8, 12, 20], [3, 4, 5]];
export type CylScene = { r: number; h: number; d: number };
export function makeCyl(rng: Rng): CylScene { const [r, h, d] = rng.pick(CYL3); return { r, h, d }; }
export const piT = (k: number | string) => `$${k}\\pi$`;
export function frT(n: number, den: number): string { if (den === 1) return String(n); return `\\frac{${n}}{${den}}`; }
export const KOs = (k: number) => String(Math.round(k * 100) / 100);

export const BOX_INTROS = [
  "A shipping company packs parcels in crates shaped like the rectangular box in the figure; the measurements and a dashed diagonal are labeled.",
  "The fish tank in an aquarium shop is a rectangular box, drawn in the figure with its dimensions and a dashed line stretching across it.",
  "A hardware store sells a toolbox whose shape is the rectangular box shown, with the labeled edges and a dashed segment inside the box.",
  "An engineer sketches a concrete block as the rectangular box in the figure, adding dashed segments to mark distances through the block.",
  "A moving company measures a wardrobe carton, modeled by the rectangular box shown. Dashed segments inside the carton are drawn for reference.",
  "A designer plans a gift box in the shape shown in the figure. The edge lengths are labeled, and a dashed segment runs from one corner to another.",
  "Workers load a cargo container shaped like the rectangular box in the figure; the labeled lengths and a dashed segment describe its inside.",
  "A kitchen cooler is shaped like the rectangular box in the figure. Its dimensions are marked, and a dashed segment is drawn through the cooler.",
  "A student models a closet as the rectangular box shown, with labeled dimensions and a dashed segment drawn from one corner of the floor.",
  "A warehouse stores sheets of glass in boxes shaped like the one in the figure; some dimensions and a dashed segment are labeled.",
  "A toy maker builds a block set. One block is the rectangular box shown, with its measurements labeled and dashed segments inside.",
  "A carpenter builds a storage bench in the shape of the rectangular box in the figure, marking its edges and a dashed segment inside.",
];
export const PRISM_INTROS = [
  "A wedge-shaped doorstop is a triangular prism, shown in the figure with its right-triangle face and the length of the prism labeled.",
  "The roof section of a small shed is modeled by the triangular prism in the figure; the labeled lengths describe its triangular end and its length.",
  "A cheese shop cuts a wedge shaped like the triangular prism shown, with the right angle of its triangular end marked.",
  "A ramp-shaped concrete block has two congruent right-triangle ends, as in the figure, and the labeled lengths are in feet.",
  "A tent is modeled as the triangular prism in the figure. Its triangular ends are right triangles, and the labeled lengths are in feet.",
  "A loading wedge for a truck is a triangular prism, drawn in the figure with a right-triangle base and the labeled measurements.",
  "A rooftop vent has the shape of the triangular prism shown, whose triangular faces have a right angle where marked.",
  "A candle holder is carved as the triangular prism in the figure; the labels give measurements of its triangular face and its depth.",
];
export const CYL_INTROS = [
  "A water tank is a right circular cylinder, shown in the figure with a dashed rectangle through its axis and a dashed diagonal of that rectangle.",
  "A grain bin is modeled by the cylinder in the figure. The dashed rectangle is a cross section through the axis of the cylinder.",
  "A metal drum has the shape of the cylinder shown, and a dashed cross section through its central axis is drawn with a diagonal.",
  "A concrete column is a cylinder. The figure shows a vertical cross section through the axis, with its diagonal drawn as a dashed segment.",
  "A paint can is shaped like the cylinder in the figure; the dashed rectangle shows the cross section through the axis of the can.",
  "An engineer cuts a cylindrical fuel tank along its axis; the figure shows the cross section as a dashed rectangle with a dashed diagonal.",
  "A storage canister is a cylinder. In the figure, a dashed cross section through the axis shows the diameter, the height, and a diagonal.",
  "A pillar in a museum is a cylinder, drawn in the figure with a dashed cross section through its axis and one dashed diagonal.",
];
export const COMP_INTROS = [
  "A storage silo is made of a cylinder topped by a hemisphere, as shown in the figure; the labels give its radius and the height of the cylinder part.",
  "A capsule-shaped container is a cylinder with a hemisphere attached to one end, shown in the figure with its radius and the cylinder height labeled.",
  "A garden pavilion has a cylindrical base and a hemispherical dome, drawn in the figure with the radius and the height of the cylinder labeled.",
  "An observatory tower is a cylinder capped by a hemisphere. The figure shows the radius of the dome and the height of the cylinder.",
  "A decorative lamp is built from a cylinder and a hemisphere placed on top; the figure labels the radius and the height of the cylinder.",
  "A tank for storing gas is a cylinder with a half-sphere cap, as in the figure; the radius and the cylinder height are labeled.",
];
const TAILS = [
  "Use only the measurements shown in the figure to answer the question that follows, and give your answer in the unit used there.",
  "Study the labeled measurements in the figure carefully before answering, because every length you need appears on the drawing.",
  "The drawing is not to scale, so rely on the labeled numbers rather than on how long each segment looks.",
  "Read each label in the figure as a length in the same unit, and then work out the quantity asked for below.",
  "Everything needed to answer the question is given in the labeled drawing, so no other measurements are required.",
  "Some measurements are missing from the drawing and are marked with a letter; the others are labeled with numbers.",
  "Look at which edges and segments are labeled in the figure before you decide which relationship between them to use.",
  "All of the dimensions in the figure use the same unit of length, so the answer needs no conversion.",
  "Before you calculate, decide which of the labeled lengths are needed and which ones are only there for reference.",
  "A neat sketch of the situation is drawn below, and the labels on it are the only information you need.",
  "Pay attention to which quantities are labeled with numbers and which are labeled with letters in the diagram.",
  "The question below refers to the labeled drawing, in which each number is a length in the same unit.",
];
export const ctxBox = (rng: Rng) => `${rng.pick(BOX_INTROS)} ${rng.pick(TAILS)}`;
export const ctxPrism = (rng: Rng) => `${rng.pick(PRISM_INTROS)} ${rng.pick(TAILS)}`;
export const ctxCyl = (rng: Rng) => `${rng.pick(CYL_INTROS)} ${rng.pick(TAILS)}`;
export const ctxComp = (rng: Rng) => `${rng.pick(COMP_INTROS)} ${rng.pick(TAILS)}`;
export { GenFail };
