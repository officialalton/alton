// area_volume.prism_missing_dimension.SO.C — 지문의 부피(와 조건)를 만족하는 직육면체 그림(세 치수 라벨)을 4개 중에서 고른다.
// 오답 규칙: surface_area_for_volume(겉넓이를 부피로 착각)·base_area_for_volume(밑면의 넓이를 부피로 착각)·not_square(부피는 맞으나 밑면이 정사각형 아님)·wrong_height(부피는 맞으나 높이 조건 어김)·fails_volume.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { SO_CTX, SO_LEAD, soFig, type SoFig } from "../so-kit";
import { pickChoices } from "../pg-kit";
import { retry } from "../ext-kit";

const SPR_NO_SO = "정답이 직육면체 그림 4개 중 조건을 만족하는 그림을 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
const N = "const nn=(s)=>{ const t=String(s===undefined?'':s).replace(/\\s/g,''); const m=/^\\d+(?:\\.\\d+)?$/.exec(t); if(!m) throw new Error('치수 라벨 오류'); return Number(t); }; const dm=(c)=>({l:nn(c.dims.length),w:nn(c.dims.width),h:nn(c.dims.height)});";
const PRED = `${N} const x=dm(c); return x.l*x.w*x.h===P.V && (P.sq===undefined||x.l===x.w) && (P.h===undefined||x.h===P.h);`;
const DIAG = `${N} const x=dm(c); const v=x.l*x.w*x.h, sa=2*(x.l*x.w+x.l*x.h+x.w*x.h), ba=x.l*x.w; if (v===P.V){ if (P.sq!==undefined&&x.l!==x.w) return 'not_square'; if (P.h!==undefined&&x.h!==P.h) return 'wrong_height'; return null; } if (sa===P.V) return 'surface_area_for_volume'; if (ba===P.V) return 'base_area_for_volume'; return 'fails_volume';`;
const fig = (l: number, w: number, h: number): SoFig => soFig("rectangular_prism", { length: String(l), width: String(w), height: String(h) });
const LEAD = [...SO_LEAD];
const Q = (rng: Rng) => rng.pick(["Which of the following figures shows the prism described?", "Which figure matches the description of the prism?", "Which of the figures shows a prism with these properties?", "Which figure could be the prism described above?"]);
const DESC: Record<string, string[]> = {
  vol: ["A rectangular prism has a volume of {V} cubic units.", "The volume of a rectangular box is {V} cubic units.", "A tank in the shape of a rectangular prism holds {V} cubic units of water."],
  base: ["A rectangular prism has a height of {h} and a volume of {V} cubic units.", "The height of a rectangular box is {h} units, and its volume is {V} cubic units.", "A tank {h} units tall holds exactly {V} cubic units."],
  square: ["A rectangular prism has a square base and a volume of {V} cubic units.", "The base of a rectangular box is a square, and its volume is {V} cubic units.", "A tank with a square base holds {V} cubic units."],
  liters: ["A box with dimensions in centimeters holds exactly {V} cubic centimeters.", "A rectangular container measured in centimeters has a capacity of {V} cubic centimeters.", "In centimeters, a rectangular prism has a volume of {V} cubic centimeters."],
};
function triple(rng: Rng, o: { sq?: boolean; h?: number } = {}) { for (let i = 0; i < 60; i++) { const l = rng.int(3, 14), w = o.sq ? l : rng.int(3, 12), h = o.h ?? rng.int(2, 12); if (l * w * h < 500 && l * w * h >= 24 && (o.sq || l !== w)) return { l, w, h }; } throw new GenFail("치수"); }
function build(rng: Rng, mode: "vol" | "base" | "square" | "liters", variant: string, expl: [string, string][]) {
  const t = mode === "square" ? triple(rng, { sq: true }) : triple(rng); const hh = mode === "base" ? triple(rng).h : undefined;
  const o = mode === "base" ? triple(rng, { h: hh }) : t; const { l, w, h } = o; const V = l * w * h; const P: Record<string, number | string> = { V }; if (mode === "square") P.sq = 1; if (mode === "base") P.h = h;
  const cands: SoFig[] = [];
  // 겉넓이·밑면의 넓이가 V 인 후보, 부피는 같으나 조건을 어기는 후보, 부피가 다른 후보
  for (let a = 3; a <= 14; a++) for (let b = 3; b <= 14; b++) for (let c = 2; c <= 14; c++) { const vv = a * b * c; const sa = 2 * (a * b + a * c + b * c); if (sa === V) cands.push(fig(a, b, c)); if (a * b === V && c <= 14) cands.push(fig(a, b, c)); if (vv === V && (mode === "square" ? a !== b : mode === "base" ? c !== h : false)) cands.push(fig(a, b, c)); if (vv !== V && Math.abs(vv - V) <= Math.max(12, V * 0.3) && cands.length < 400) cands.push(fig(a, b, c)); }
  const okF = fig(l, w, h); const { choices, correctIndex, rules } = pickChoices(rng, okF, cands, P, PRED, DIAG);
  const txt = rng.pick(DESC[mode === "base" ? "base" : mode === "square" ? "square" : mode === "liters" ? "liters" : "vol"]).replace("{V}", String(V)).replace("{h}", String(h));
  return guard(choiceInst(rng, { stimulus: `${rng.pick(LEAD)}${rng.pick(SO_CTX)}${txt}`.replace(/ {2,}/g, " ").trim(), question: Q(rng), choices, correctIndex, rules, P, predicateJs: PRED, diagnoseJs: DIAG, trace: expl, variant, explainKo: "", explainEn: "" }));
}
const one = (f: (rng: Rng) => ReturnType<typeof build>) => (rng: Rng) => retry(rng, () => f(rng), 40);
const EX_VOL: [string, string][] = [["각 그림의 길이·너비·높이를 곱해 부피를 구한다.", "Multiply the three labeled dimensions of each figure."], ["지문의 부피와 같은 그림을 찾는다.", "Find the volume that equals the stated value."], ["겉넓이나 밑면의 넓이가 지문의 수와 같은 그림은 부피가 아니라 다른 양이 같은 것이다.", "A matching surface area or base area is not a matching volume."], ["따라서 세 치수의 곱이 지문의 부피인 그림을 고른다.", "Pick the figure whose product matches."], ["다른 부피의 그림은 제외한다.", "Rule out the others."]];
const EX_BASE: [string, string][] = [["지문의 높이와 부피에서 밑면의 넓이 = V ÷ 높이 를 구한다.", "Base area = volume ÷ height."], ["각 그림의 높이가 지문과 같은지 먼저 본다.", "Check the height first."], ["높이가 같은 그림에서 길이 × 너비 가 밑면의 넓이와 같은지 본다.", "Compare length × width."], ["부피는 맞아도 높이가 다른 그림은 제외한다.", "Rule out figures with a different height."], ["조건을 모두 만족하는 그림을 고른다.", "Pick the figure that satisfies all conditions."]];
const EX_SQ: [string, string][] = [["밑면이 정사각형이므로 길이 = 너비 인 그림만 후보이다.", "A square base means length = width."], ["각 그림의 길이 × 너비 × 높이 를 구한다.", "Compute each volume."], ["지문의 부피와 같은 그림을 찾는다.", "Match the volume."], ["부피는 맞아도 밑면이 정사각형이 아닌 그림은 제외한다.", "Rule out figures whose base is not square."], ["따라서 조건을 모두 만족하는 그림을 고른다.", "Pick the figure that satisfies both conditions."]];

const RAW = defineItem({
  prefix: "av", itemId: "area_volume.prism_missing_dimension.SO.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_SO, structure: "부피가 주어진 직육면체를 4개 그림 중에서 고름(오답은 겉넓이·밑면의 넓이를 부피로 착각한 그림)", extra: "세 치수의 곱으로 부피를 구해 비교해야 함(겉넓이나 밑면의 넓이가 같은 그림이 함정) — medium 은 높이가 주어짐", concepts: ["직육면체의 부피", "그림 비교"], gen: one((rng) => build(rng, "vol", "figure_prism_volume", EX_VOL)) },
    { op: "chain2", sprNo: SPR_NO_SO, structure: "높이와 부피가 주어진 직육면체를 고름(밑면의 넓이 = V ÷ 높이 를 구한 뒤 길이 × 너비 와 비교)", extra: "V ÷ 높이 → 밑면의 넓이 → 각 그림과 비교 의 연쇄(높이가 다른 그림이 함정) — medium 은 부피만", concepts: ["직육면체의 부피", "밑면의 넓이", "그림 비교"], gen: one((rng) => build(rng, "base", "figure_prism_height_and_volume", EX_BASE)) },
    { op: "repr_shift", sprNo: SPR_NO_SO, structure: "'밑면이 정사각형이고 부피가 V' 라는 말을 길이 = 너비 와 곱 = V 로 옮겨 직육면체를 고름", extra: "정사각형 조건과 부피 조건을 함께 식으로 옮겨 확인해야 함(부피만 맞는 그림이 함정) — medium 은 부피만", concepts: ["직육면체의 부피", "정사각형", "표현 바꾸기"], gen: one((rng) => build(rng, "square", "figure_square_base_prism", EX_SQ)) },
    { op: "inverse", sprNo: SPR_NO_SO, structure: "센티미터 치수와 입방센티미터 부피가 주어진 직육면체를 거꾸로 확인해 4개 그림 중에서 고름", extra: "세 치수의 곱이 V 인지 거꾸로 확인해야 함(겉넓이가 V 인 그림이 함정) — medium 은 단위 없는 부피", concepts: ["직육면체의 부피", "역추론", "그림 비교"], gen: one((rng) => build(rng, "liters", "figure_prism_cm3", EX_VOL)) },
  ],
  em: [
    { lv: "easy", name: "volume_given", sprNo: SPR_NO_SO, structure: "부피가 주어진 직육면체를 4개 그림 중에서 고름", extra: "easy: 세 치수의 곱", concepts: ["직육면체의 부피"], gen: one((rng) => build(rng, "vol", "figure_prism_volume_easy", EX_VOL.slice(0, 3))) },
    { lv: "medium", name: "square_base", sprNo: SPR_NO_SO, structure: "밑면이 정사각형이고 부피가 주어진 직육면체를 고름", extra: "medium: 길이 = 너비 와 부피", concepts: ["직육면체의 부피", "정사각형"], gen: one((rng) => build(rng, "square", "figure_square_base_medium", EX_SQ.slice(0, 3))) },
  ],
});
export const ITEM = RAW;
