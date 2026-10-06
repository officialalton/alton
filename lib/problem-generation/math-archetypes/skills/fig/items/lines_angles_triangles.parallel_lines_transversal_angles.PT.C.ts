// lines_angles_triangles.parallel_lines_transversal_angles.PT.C — 지문이 말하는 각의 관계(맞꼭지·동위·엇각·동측내각 등)를 만족하는 두 각(x°, y°)을 표시한 평행선·횡단선 그림을 4개 중에서 고른다.
// 오답 규칙: 그림에 표시된 두 각의 위치 관계 — vertical·corresponding·alternate_interior·alternate_exterior(같은 크기) / linear_pair·cointerior·coexterior(합 180°) 중 지문과 다른 관계.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { placeChoices } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { retry } from "../ext-kit";

const SPR_NO_PT = "정답이 평행선·횡단선 그림 4개 중 지문의 각 관계를 만족하는 그림을 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
type Rel = "vertical" | "corresponding" | "alternate_interior" | "alternate_exterior" | "linear_pair" | "cointerior" | "coexterior";
const EQUAL: Rel[] = ["vertical", "corresponding", "alternate_interior", "alternate_exterior"], SUPP: Rel[] = ["linear_pair", "cointerior", "coexterior"];
type Reg = "NE" | "NW" | "SE" | "SW";
const OPP: Record<Reg, Reg> = { NE: "SW", SW: "NE", NW: "SE", SE: "NW" };
const ADJ: Record<Reg, Reg[]> = { NE: ["NW", "SE"], SW: ["NW", "SE"], NW: ["NE", "SW"], SE: ["NE", "SW"] };
/** 관계 → 표시할 두 각 [{line(0 위/1 아래), region}]. */
function pairFor(rng: Rng, rel: Rel): [{ line: 0 | 1; region: Reg }, { line: 0 | 1; region: Reg }] {
  const flip = rng.chance(0.5); const E = (r: Reg): Reg => (flip ? ({ NE: "NW", NW: "NE", SE: "SW", SW: "SE" } as Record<Reg, Reg>)[r] : r);
  switch (rel) {
    case "corresponding": { const r = rng.pick(["NE", "NW", "SE", "SW"] as Reg[]); return [{ line: 0, region: r }, { line: 1, region: r }]; }
    case "alternate_interior": return [{ line: 0, region: E("SE") }, { line: 1, region: E("NW") }];
    case "cointerior": return [{ line: 0, region: E("SE") }, { line: 1, region: E("NE") }];
    case "alternate_exterior": return [{ line: 0, region: E("NE") }, { line: 1, region: E("SW") }];
    case "coexterior": return [{ line: 0, region: E("NE") }, { line: 1, region: E("SE") }];
    case "vertical": { const l = rng.pick([0, 1] as const), r = rng.pick(["NE", "NW", "SE", "SW"] as Reg[]); return [{ line: l, region: r }, { line: l, region: OPP[r] }]; }
    default: { const l = rng.pick([0, 1] as const), r = rng.pick(["NE", "NW", "SE", "SW"] as Reg[]); return [{ line: l, region: r }, { line: l, region: rng.pick(ADJ[r]) }]; }
  }
}
type Fig = { type: "parallel_transversal"; parallel: [string, string]; transversals: { id: string }[]; angles: { at: [string, string]; region: Reg; label: string }[] };
const mkFig = (par: [string, string], t: string, pr: [{ line: 0 | 1; region: Reg }, { line: 0 | 1; region: Reg }]): Fig => ({ type: "parallel_transversal", parallel: par, transversals: [{ id: t }], angles: pr.map((a, i) => ({ at: [par[a.line], t] as [string, string], region: a.region, label: i === 0 ? "x°" : "y°" })) });
/** 그림에서 두 각의 관계를 읽는 JS(함수 cls(c) → 관계 이름). */
const CLS_JS = "const cls=(c)=>{ const a=c.angles[0], b=c.angles[1]; const la=c.parallel.findIndex(p=>a.at.includes(p)), lb=c.parallel.findIndex(p=>b.at.includes(p)); const OPP={NE:'SW',SW:'NE',NW:'SE',SE:'NW'}; if (la<0||lb<0) throw new Error('평행선 교점 아님'); if (la===lb) return b.region===OPP[a.region]?'vertical':'linear_pair'; const T=la===0?a.region:b.region, B=la===0?b.region:a.region; if (T===B) return 'corresponding'; if (T[0]==='S'&&B[0]==='N') return T[1]!==B[1]?'alternate_interior':'cointerior'; if (T[0]==='N'&&B[0]==='S') return T[1]!==B[1]?'alternate_exterior':'coexterior'; return 'other'; };";
const EQ_SET = "['vertical','corresponding','alternate_interior','alternate_exterior']";
const REL_NAME: Record<Rel, string> = { vertical: "vertical angles", corresponding: "corresponding angles", alternate_interior: "alternate interior angles", alternate_exterior: "alternate exterior angles", linear_pair: "a linear pair of angles", cointerior: "same-side interior angles", coexterior: "same-side exterior angles" };
const REL_KO: Record<Rel, string> = { vertical: "맞꼭지각", corresponding: "동위각", alternate_interior: "엇각(안쪽)", alternate_exterior: "엇각(바깥쪽)", linear_pair: "이웃한 보각(일직선)", cointerior: "동측내각", coexterior: "동측외각" };
const NAMES: [string, string][] = [["m", "n"], ["j", "k"], ["p", "q"], ["a", "b"]];
const TRS = ["t", "s", "r", "w", "z", "c"];
const LEAD = ["", "", "A student is studying angles formed by parallel lines. ", "A teacher draws parallel lines on the board. ", "A designer sketches parallel streets crossed by a road. ", "A surveyor marks two parallel fences crossed by a path. ", "An architect draws two parallel beams crossed by a brace. ", "A geometry book shows several diagrams of parallel lines. ", "A map maker draws two parallel rivers crossed by a bridge. "];

type Mode = { kind: "rel"; rel: Rel } | { kind: "equal" } | { kind: "supp" };
function stem(rng: Rng, par: [string, string], t: string, m: Mode): string {
  const L = rng.pick(LEAD); void m;
  return rng.pick([`${L}In each figure, lines $${par[0]}$ and $${par[1]}$ are parallel and are cut by transversal $${t}$, and two angles are marked $x°$ and $y°$.`, `${L}Each figure shows parallel lines $${par[0]}$ and $${par[1]}$ crossed by transversal $${t}$, with two angles marked $x°$ and $y°$.`, `${L}In every figure below, line $${par[0]}$ is parallel to line $${par[1]}$ and transversal $${t}$ crosses both lines. The marked angles are labeled $x°$ and $y°$.`, `${L}The four figures show lines $${par[0]}$ and $${par[1]}$, which are parallel, intersected by transversal $${t}$. Two angles in each figure are marked $x°$ and $y°$.`, `${L}Lines $${par[0]}$ and $${par[1]}$ are parallel in each of the figures shown, and transversal $${t}$ intersects them. Two of the angles formed are marked $x°$ and $y°$.`]);
}
function question(rng: Rng, m: Mode): string {
  if (m.kind === "rel") return rng.pick([`Which of the following figures marks $x°$ and $y°$ as ${REL_NAME[m.rel]}?`, `In which figure are the marked angles $x°$ and $y°$ ${REL_NAME[m.rel]}?`, `Which figure shows ${REL_NAME[m.rel]} marked $x°$ and $y°$?`, `Which figure has $x°$ and $y°$ marked on ${REL_NAME[m.rel]}?`, `The marked angles in exactly one figure are ${REL_NAME[m.rel]}. Which figure is it?`]);
  if (m.kind === "equal") return rng.pick([`Which of the following figures marks two angles, $x°$ and $y°$, that must be equal in measure?`, `In which figure must the marked angles $x°$ and $y°$ have the same measure?`, `Which figure shows marked angles $x°$ and $y°$ that are always equal?`, `In exactly one figure, $x°$ and $y°$ are equal for every pair of parallel lines. Which figure is it?`, `Which figure marks a pair of angles guaranteed to be congruent?`]);
  return rng.pick([`Which of the following figures marks two angles, $x°$ and $y°$, whose measures must add to $180°$?`, `In which figure must the marked angles $x°$ and $y°$ be supplementary?`, `Which figure shows marked angles $x°$ and $y°$ that always add up to $180°$?`, `In exactly one figure, $x° + y° = 180°$ must hold. Which figure is it?`, `Which figure marks a pair of supplementary angles?`]);
}
function build(rng: Rng, m: Mode, correctRel: Rel, wrongRels: Rel[], variant: string) {
  const par = rng.pick(NAMES), t = rng.pick(TRS); if (par.includes(t)) throw new GenFail("이름");
  const ok = mkFig(par, t, pairFor(rng, correctRel)); const wrong = wrongRels.map((r) => ({ fig: mkFig(par, t, pairFor(rng, r)), rule: r }));
  const { choices, correctIndex, rules } = placeChoices(rng, ok, wrong);
  const predicate = m.kind === "rel" ? `${CLS_JS} return cls(c)===P.rel;` : m.kind === "equal" ? `${CLS_JS} return ${EQ_SET}.includes(cls(c));` : `${CLS_JS} return !${EQ_SET}.includes(cls(c)) && cls(c)!=='other';`;
  const diagnose = `${CLS_JS} const r=cls(c); return r==='other'?null:r;`;
  const P: Record<string, string> = m.kind === "rel" ? { rel: m.rel } : { mode: m.kind };
  const trace: [string, string][] = [[`지문은 ${m.kind === "rel" ? `${REL_KO[m.rel]}` : m.kind === "equal" ? "크기가 항상 같은 두 각" : "합이 항상 180° 인 두 각"}을 표시한 그림을 찾으라고 한다.`, "Read which relationship the marked angles must have."], [`평행선 ${par[0]}, ${par[1]} 와 횡단선 ${t} 에서 각 그림의 두 각이 어느 교점·어느 쪽에 있는지 본다.`, "Locate each marked angle by intersection and side."], [`각 그림의 관계: ${choices.map((_, i) => `${"ABCD"[i]}=${REL_KO[rules[i] === "correct" ? correctRel : (rules[i] as Rel)]}`).join(", ")}.`, "Classify the pair in each figure."], [m.kind === "rel" ? `${REL_KO[m.rel]} 인 그림을 고른다.` : m.kind === "equal" ? "관계가 맞꼭지각·동위각·엇각이면 두 각의 크기가 같다." : "관계가 이웃한 보각·동측내각·동측외각이면 합이 180° 이다.", "Apply the parallel-line angle rules."], [`따라서 정답은 ${"ABCD"[correctIndex]} 이다.`, "Choose that figure."]];
  return guard(choiceInst(rng, { stimulus: stem(rng, par, t, m), question: question(rng, m), choices, correctIndex, rules, P, predicateJs: predicate, diagnoseJs: diagnose, trace, variant, explainKo: "", explainEn: "" }));
}
const pickN = <T,>(rng: Rng, xs: T[], n: number): T[] => rng.shuffle([...xs]).slice(0, n);
const one = (f: (rng: Rng) => ReturnType<typeof build>) => (rng: Rng) => retry(rng, () => f(rng), 24);

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.parallel_lines_transversal_angles.PT.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_PT, structure: "'엇각(안쪽)'을 표시한 그림을 4개 중에서 고름(각 그림은 두 각의 위치만 다름)", extra: "엇각·동위각·동측내각의 위치 구분을 모두 해야 함(같은 쪽 안쪽 각이면 동측내각, 같은 자리면 동위각) — medium 은 동위각", concepts: ["평행선의 각", "엇각", "그림 비교"], gen: one((rng) => build(rng, { kind: "rel", rel: "alternate_interior" }, "alternate_interior", pickN(rng, ["corresponding", "cointerior", "alternate_exterior", "linear_pair", "vertical", "coexterior"] as Rel[], 3), "figure_alternate_interior")) },
    { op: "chain2", sprNo: SPR_NO_PT, structure: "'두 각의 합이 항상 180°' 인 그림을 4개 중에서 고름(보각 관계를 위치로 판단한 뒤 같은 크기 관계와 구분)", extra: "각 그림에서 관계(맞꼭지·동위·엇각 = 같음 / 동측내각·동측외각·이웃한 각 = 합 180°)를 먼저 읽고 합 180° 인 것을 골라야 함 — medium 은 동위각", concepts: ["평행선의 각", "보각", "그림 비교"], gen: one((rng) => { const c = rng.pick(SUPP); return build(rng, { kind: "supp" }, c, pickN(rng, EQUAL, 3), "figure_supplementary_pair"); }) },
    { op: "repr_shift", sprNo: SPR_NO_PT, structure: "'크기가 항상 같은' 두 각을 표시한 그림을 4개 중에서 고름(나머지 세 그림은 합이 180° 인 관계)", extra: "각 그림의 관계를 위치로 읽어 같은 크기 관계(맞꼭지·동위·엇각)와 합 180° 관계를 구분해야 함 — medium 은 동위각", concepts: ["평행선의 각", "동위각·엇각", "그림 비교"], gen: one((rng) => { const c = rng.pick(EQUAL); return build(rng, { kind: "equal" }, c, SUPP, "figure_equal_pair"); }) },
    { op: "inverse", sprNo: SPR_NO_PT, structure: "'동측내각'(같은 쪽 안쪽 각, 합 180°)을 표시한 그림을 4개 중에서 고름", extra: "같은 쪽 안쪽 위치를 판단해 엇각·동위각과 구분해야 함 — medium 은 동위각", concepts: ["평행선의 각", "동측내각", "그림 비교"], gen: one((rng) => build(rng, { kind: "rel", rel: "cointerior" }, "cointerior", pickN(rng, ["alternate_interior", "corresponding", "alternate_exterior", "vertical", "linear_pair", "coexterior"] as Rel[], 3), "figure_cointerior")) },
  ],
  em: [
    { lv: "easy", name: "vertical_angles", sprNo: SPR_NO_PT, structure: "'맞꼭지각'을 표시한 그림을 4개 중에서 고름", extra: "easy: 한 교점 둘레의 마주 보는 각", concepts: ["맞꼭지각", "그림 비교"], gen: one((rng) => build(rng, { kind: "rel", rel: "vertical" }, "vertical", pickN(rng, ["linear_pair", "cointerior", "coexterior", "alternate_interior", "corresponding"] as Rel[], 3), "figure_vertical_easy")) },
    { lv: "medium", name: "corresponding", sprNo: SPR_NO_PT, structure: "'동위각'을 표시한 그림을 4개 중에서 고름", extra: "medium: 두 교점의 같은 자리 각", concepts: ["평행선의 각", "동위각", "그림 비교"], gen: one((rng) => build(rng, { kind: "rel", rel: "corresponding" }, "corresponding", pickN(rng, ["cointerior", "alternate_interior", "linear_pair", "coexterior", "vertical"] as Rel[], 3), "figure_corresponding")) },
  ],
});
