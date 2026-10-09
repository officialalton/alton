// area_volume.shaded_region_area.CM.C — 지문에 주어진 음영 넓이(a − bπ 또는 bπ − a)와 같은 음영 영역을 가진 복합 도형 그림을 4개 중에서 고른다.
// 오답 규칙: other_size(같은 도형 배치에 치수만 다름)·circle_outside/square_outside(안팎 도형이 바뀜)·circle_shaded/square_shaded(음영이 안쪽 도형)
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { CM_CTX, CM_LEAD, SPR_NO_CM, exprPi, type CmFig } from "../cm-kit";
import { pickChoices } from "../pg-kit";
import { retry } from "../ext-kit";

const INFO = "const num=(s)=>{ const t=String(s===undefined?'':s).replace(/\\s/g,''); return /^\\d+(?:\\.\\d+)?$/.test(t)?Number(t):NaN; }; const info=(c)=>{ const O=c.outer, I=c.inner; let a, b; if (O.kind==='square'&&I.kind==='circle'){ let s=num(O.side); if(!(s>0)) s=2*num(I.radius); if(!(s>0)) throw new Error('치수 없음'); if (c.shaded==='outer_minus_inner'){a=s*s;b=-s*s/4;} else if (c.shaded==='inner'){a=0;b=s*s/4;} else throw new Error('음영 없음'); } else if (O.kind==='circle'&&I.kind==='square'){ let r=num(O.radius); if(!(r>0)) r=num(O.diameter)/2; if(!(r>0)) throw new Error('치수 없음'); if (c.shaded==='outer_minus_inner'){a=-2*r*r;b=r*r;} else if (c.shaded==='inner'){a=2*r*r;b=0;} else throw new Error('음영 없음'); } else throw new Error('지원하지 않는 배치'); return {a:a,b:b}; };";
const PRED = `${INFO} const v=info(c); return v.a===P.a && v.b===P.b;`;
const DIAG = `${INFO} const key=c.outer.kind+'_'+c.inner.kind+'_'+c.shaded; const ok2=ok.outer.kind+'_'+ok.inner.kind+'_'+ok.shaded; if (key===ok2) return 'other_size'; if (key==='circle_square_outer_minus_inner') return 'circle_outside'; if (key==='square_circle_outer_minus_inner') return 'square_outside'; if (key==='square_circle_inner') return 'circle_shaded'; if (key==='circle_square_inner') return 'square_shaded'; return null;`;
const sq = (s: number, rad: boolean, shaded: CmFig["shaded"] = "outer_minus_inner"): CmFig => ({ type: "composite", outer: { kind: "square", side: rad ? "s" : String(s) }, inner: { kind: "circle", ...(rad ? { radius: String(s / 2) } : {}) }, shaded });
const cs = (r: number, dia: boolean, shaded: CmFig["shaded"] = "outer_minus_inner"): CmFig => ({ type: "composite", outer: { kind: "circle", ...(dia ? { diameter: String(2 * r) } : { radius: String(r) }) }, inner: { kind: "square" }, shaded });
const LEAD = [...CM_LEAD];
const Q = (rng: Rng) => rng.pick([`Which of the following figures has a shaded region with this area?`, `Which figure's shaded region has an area equal to the given expression?`, `Which of the figures shows a shaded region with that area?`, `In which figure does the shaded region have the stated area?`]);
function build(rng: Rng, mode: "sq" | "cs", dia: boolean, variant: string, expl: [string, string][]) {
  const n = rng.int(2, 10); const s = 2 * n, r = n; // sq: side s, inscribed circle radius n; cs: circle radius r
  let ok: CmFig, cands: CmFig[]; let a: number, b: number; let want: string;
  if (mode === "sq") { ok = sq(s, dia); a = s * s; b = -(s * s) / 4; want = `${exprPi(a, b)}`; cands = [sq(rng.pick([s + 2, s - 2, s * 2, s / 2].filter((x) => x >= 4 && x !== s)), dia), cs(r, !dia), cs(s, dia), sq(s, dia, "inner")]; }
  else { ok = cs(r, dia); a = -2 * r * r; b = r * r; want = `${exprPi(a, b)}`; cands = [cs(rng.pick([r + 1, r - 1, r * 2].filter((x) => x >= 2 && x !== r)), dia), sq(2 * r, !dia), sq(r, dia), cs(r, dia, "inner")]; }
  const P = { a, b };
  const { choices, correctIndex, rules } = pickChoices(rng, ok, cands, P, PRED, DIAG);
  return guard(choiceInst(rng, { stimulus: `${rng.pick(LEAD)}${rng.pick(CM_CTX)}The shaded region in exactly one of the figures has an area of ${want}.`.replace(/ {2,}/g, " ").trim(), question: Q(rng), choices, correctIndex, rules, P, predicateJs: PRED, diagnoseJs: DIAG, trace: expl, variant, explainKo: "", explainEn: "" }));
}
const one = (f: (rng: Rng) => ReturnType<typeof build>) => (rng: Rng) => retry(rng, () => f(rng), 30);
const EX_SQ: [string, string][] = [["지문의 넓이는 a − bπ 꼴이므로 (정사각형) − (원) 이다.", "The area has the form a − bπ: a square minus a circle."], ["정사각형의 변 s 에 대해 원의 지름 = s 이므로 넓이 = s² − (s²/4)π 이다.", "For a square of side s, the area is s² − (s²/4)π."], ["각 그림의 치수로 s 를 구해 대입한다(반지름 라벨이면 s = 2r).", "Find s from each figure's labels (s = 2r if a radius is given)."], ["지문의 값과 같은 s 인 그림이 정답이다.", "The matching s identifies the figure."], ["안팎 도형이 바뀐 그림이나 음영이 안쪽인 그림은 제외한다.", "Rule out swapped shapes and figures where the inner shape is shaded."]];
const EX_CS: [string, string][] = [["지문의 넓이는 bπ − a 꼴이므로 (원) − (내접한 정사각형) 이다.", "The area has the form bπ − a: a circle minus an inscribed square."], ["원의 반지름 r 에 대해 정사각형의 넓이 = 2r² 이므로 넓이 = πr² − 2r² 이다.", "The area is πr² − 2r²."], ["각 그림의 치수로 r 을 구해 대입한다(지름 라벨이면 r = d/2).", "Find r from each figure's labels (r = d/2 if a diameter is given)."], ["지문의 값과 같은 r 인 그림이 정답이다.", "The matching r identifies the figure."], ["정사각형이 바깥인 그림이나 음영이 안쪽인 그림은 제외한다.", "Rule out figures with the square outside or the inner shape shaded."]];

const RAW = defineItem({
  prefix: "av", itemId: "area_volume.shaded_region_area.CM.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_CM, structure: "음영 넓이가 a − bπ 로 주어진 정사각형 속 내접한 원 그림을 4개 중에서 고름(변 라벨)", extra: "정사각형에서 원을 뺀 식 s² − (s²/4)π 에 각 그림의 변을 대입해 비교해야 함(원과 정사각형이 바뀐 그림이나 변이 다른 그림이 함정) — medium 은 지문에 변이 직접 주어짐", concepts: ["음영 영역의 넓이", "내접한 원", "그림 비교"], gen: one((rng) => build(rng, "sq", false, "figure_square_minus_circle", EX_SQ)) },
    { op: "chain2", sprNo: SPR_NO_CM, structure: "음영 넓이가 bπ − a 로 주어진 원 속 내접한 정사각형 그림을 4개 중에서 고름(반지름 라벨)", extra: "원에서 정사각형(2r²)을 뺀 식 πr² − 2r² 에 각 그림의 r 을 대입해 비교해야 함 — medium 은 지문에 반지름이 직접 주어짐", concepts: ["음영 영역의 넓이", "내접한 정사각형", "그림 비교"], gen: one((rng) => build(rng, "cs", false, "figure_circle_minus_square", EX_CS)) },
    { op: "repr_shift", sprNo: SPR_NO_CM, structure: "음영 넓이 a − bπ 와 같은 그림을 고르되 원이 반지름 라벨로, 정사각형 변은 s 로 표시된 그림을 4개 중에서 고름", extra: "그림의 반지름 r 에서 변 s = 2r 로 바꿔 넓이를 비교해야 함(반지름을 변으로 읽으면 오답) — medium 은 변 라벨", concepts: ["음영 영역의 넓이", "내접한 원", "표현 바꾸기"], gen: one((rng) => build(rng, "sq", true, "figure_square_minus_circle_radius_labels", EX_SQ)) },
    { op: "inverse", sprNo: SPR_NO_CM, structure: "음영 넓이 bπ − a 와 같은 그림을 고르되 원이 지름 라벨로 표시된 그림을 4개 중에서 거꾸로 고름", extra: "그림의 지름 d 에서 반지름 r = d/2 로 바꿔 πr² − 2r² 를 비교해야 함(지름을 반지름으로 읽으면 오답) — medium 은 반지름 라벨", concepts: ["음영 영역의 넓이", "지름과 반지름", "그림 비교"], gen: one((rng) => build(rng, "cs", true, "figure_circle_minus_square_diameter_labels", EX_CS)) },
  ],
  em: [
    { lv: "easy", name: "square_minus_circle", sprNo: SPR_NO_CM, structure: "음영 넓이 a − bπ 와 같은 정사각형 속 원 그림을 4개 중에서 고름", extra: "easy: 정사각형 − 원", concepts: ["음영 영역의 넓이", "그림 비교"], gen: one((rng) => build(rng, "sq", false, "figure_square_minus_circle_easy", EX_SQ.slice(0, 3))) },
    { lv: "medium", name: "circle_minus_square", sprNo: SPR_NO_CM, structure: "음영 넓이 bπ − a 와 같은 원 속 정사각형 그림을 4개 중에서 고름", extra: "medium: 원 − 정사각형", concepts: ["음영 영역의 넓이", "내접한 정사각형"], gen: one((rng) => build(rng, "cs", false, "figure_circle_minus_square_medium", EX_CS.slice(0, 3))) },
  ],
});
export const ITEM = RAW;
void GenFail;
