// lines_angles_triangles.polygon_interior_angle.PG.P — 정다각형 그림(변의 수는 그림의 꼭짓점 수)과 각 라벨에서 내각의 합·한 내각·이웃한 두 내각의 합을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { PG_LEAD, type PolyFig } from "../pg-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const NAMES = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
const polyNames = (rng: Rng, n: number): string[] => { const s = rng.shuffle([...NAMES]).slice(0, n).sort(); return s; };
const regFig = (v: string[], angles?: PolyFig["angles"]): PolyFig => ({ type: "polygon", kind: "regular", sides: v.length, vertices: v, ...(angles ? { angles } : {}) });
const REG_JS = "const n=FIGURE.sides; if (FIGURE.kind!=='regular'||!(n>=3&&n<=8)) throw new Error('정다각형 아님'); if (FIGURE.vertices.length!==n) throw new Error('꼭짓점 수 오류'); const INT=(n-2)*180/n;\n";
const LEADS = ["", "", "A tile designer is studying a pattern. ", "A student draws the polygon below for a geometry class. ", "A craftsperson cuts a shape for a mosaic. ", "A game designer models the shape below. ", "A teacher shows the class the figure below. ", "An engineer sketches a bolt head. ", "A landscaper plans a garden bed with the shape below. ", "A museum builds a display case in the shape below. "];
const BODY = ["The figure shows a regular polygon.", "A regular polygon is shown in the figure.", "In the figure shown, all the sides and all the angles of the polygon are equal.", "The polygon shown in the figure is regular.", "Look at the regular polygon in the figure.", "Every side of the polygon in the figure has the same length, and every angle has the same measure.", "The figure displays a polygon whose sides are congruent and whose angles are congruent.", "Consider the regular polygon drawn in the figure.", "The shape in the figure is a regular polygon with congruent sides and congruent angles.", "A regular polygon, with all sides equal and all angles equal, appears in the figure."];
const CTX = ["", "", "Pieces of this shape will be fitted together without gaps along one edge. ", "The angles matter because the pieces must meet cleanly at the corners. ", "Think about how the corners of this shape are measured. ", "A ruler is not needed; the figure tells you what you need. ", "Count what you can see in the figure before using a formula. ", "Remember that the number of sides can be read directly from the drawing. ", "The shape is drawn with each corner labeled by a letter. ", "Angle measures are in degrees. ", "Use the figure and your knowledge of polygon angles to answer. ", "Each corner of the shape is marked with a point. "];
const intro = (rng: Rng, extra = "") => `${rng.pick(LEADS)}${rng.pick(BODY)} ${rng.pick(CTX)}${extra}`.replace(/ {2,}/g, " ").trim();
const SIDES = [5, 6, 8];

const RAW = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.polygon_interior_angle.PG.P",
  hard: [
    {
      op: "compose_kind", structure: "그림의 정다각형에서 꼭짓점 수로 변의 수 n 을 읽고 내각의 합 (n − 2) × 180° 를 구함", extra: "그림에서 변의 수를 세어 (n − 2) × 180 을 적용해야 함(n × 180 이나 360 을 쓰면 오답) — medium 은 한 내각",
      concepts: ["다각형의 내각의 합", "정다각형", "그림 읽기"],
      gen(rng) {
        const n = rng.pick([5, 6, 7, 8]); const v = polyNames(rng, n); const fig = regFig(v); const S = (n - 2) * 180;
        return geoInst(rng, {
          stimulus: intro(rng), question: rng.pick([`What is the sum, in degrees, of the interior angles of the polygon?`, `What is the sum of the measures of the interior angles of the polygon shown?`, `The interior angles of the polygon add up to how many degrees?`, `If all of the interior angles of the polygon shown are added together, what is the total in degrees?`, `Find the total degree measure of all interior angles of this polygon.`, `How many degrees do all the interior angles of the polygon measure altogether?`]), correct: S,
          wrongs: pos([W(n * 180, "formula_misuse", "n × 180 으로 계산했다."), W(360, "formula_misuse", "외각의 합을 답했다."), W((n - 1) * 180, "formula_misuse", "n − 1 을 썼다."), W(((n - 2) * 180) / n, "step_missing", "한 내각을 답했다."), W(S + 180, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== S),
          verificationJs: figJs({}, fig, `${REG_JS}return (n-2)*180;`),
          trace: [[`그림의 다각형은 꼭짓점이 ${n}개이므로 변이 ${n}개이다.`, "Count the vertices to find the number of sides."], [`n 각형은 ${n - 2} 개의 삼각형으로 나뉜다.`, "An n-gon splits into n − 2 triangles."], [`삼각형 한 개의 내각의 합은 180° 이다.`, "Each triangle has angle sum 180°."], [`합 = (${n} - 2) × 180° = ${S}° 이다.`, "Multiply."], [`따라서 ${S} 이다.`, "State the sum."]], variant: "interior_sum_regular",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "그림의 정다각형에서 한 내각을 구한 뒤 이웃한 두 내각의 합을 구함", extra: "내각의 합 → 한 내각 → 두 배 의 연쇄(한 내각이나 합을 답하면 오답) — medium 은 한 내각",
      concepts: ["다각형의 내각의 합", "정다각형", "그림 읽기"],
      gen(rng) {
        const n = rng.pick(SIDES); const v = polyNames(rng, n); const fig = regFig(v); const one = ((n - 2) * 180) / n; const two = 2 * one;
        return geoInst(rng, {
          stimulus: intro(rng), question: rng.pick([`What is the sum, in degrees, of the measures of two adjacent interior angles of the polygon?`, `Two adjacent interior angles of the polygon are added. What is their sum, in degrees?`, `How many degrees do two neighboring interior angles of the polygon measure together?`, `Pick any two interior angles that share a side. What is the sum of their measures, in degrees?`, `Two interior angles that share a side of the polygon are added together. What is the total, in degrees?`, `What is the combined measure, in degrees, of a pair of adjacent interior angles of this polygon?`]), correct: two,
          wrongs: pos([W(one, "step_missing", "한 내각만 답했다."), W(180, "formula_misuse", "이웃한 각의 합을 180 으로 보았다."), W((n - 2) * 180, "formula_misuse", "내각의 합을 답했다."), W(360 / n, "formula_misuse", "한 외각을 답했다."), W(two + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== two),
          verificationJs: figJs({}, fig, `${REG_JS}return 2*INT;`),
          trace: [[`그림에서 꼭짓점이 ${n}개이므로 정${n}각형이다.`, "Count the vertices."], [`내각의 합 = (${n} - 2) × 180° = ${(n - 2) * 180}° 이다.`, "Interior angle sum."], [`한 내각 = ${(n - 2) * 180}° ÷ ${n} = ${one}° 이다.`, "The angles are equal."], [`이웃한 두 내각의 합 = 2 × ${one}° = ${two}° 이다.`, "Add two of them."], [`따라서 ${two} 이다.`, "State the sum."]], variant: "two_adjacent_interior_angles",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "그림의 정다각형 한 꼭짓점의 각이 x° 로 라벨되었을 때 내각의 합 ÷ 변의 수로 x 를 구함", extra: "그림에서 변의 수를 읽어 (n − 2) × 180 ÷ n 으로 한 내각을 구해야 함(외각 360 ÷ n 을 답하면 오답) — medium 은 내각의 합",
      concepts: ["정다각형의 한 내각", "내각의 합", "그림 읽기"],
      gen(rng) {
        const n = rng.pick(SIDES); const v = polyNames(rng, n); const fig = regFig(v, [{ at: v[0], label: "x°" }]); const x = ((n - 2) * 180) / n;
        return geoInst(rng, {
          stimulus: intro(rng), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`, `What is the measure, in degrees, of the interior angle marked $x°$?`, `The interior angle at one vertex is marked $x°$. What is $x$?`, `For the angle marked $x°$ in the polygon, what value does $x$ have?`, `What degree measure does the marked angle $x°$ have?`]), correct: x,
          wrongs: pos([W(360 / n, "formula_misuse", "한 외각을 답했다."), W(180 - x, "formula_misuse", "보각을 답했다."), W((n - 2) * 180, "step_missing", "내각의 합을 답했다."), W((n * 180) / n, "formula_misuse", "180 을 답했다."), W(x + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x),
          verificationJs: figJs({}, fig, `${REG_JS}const a=(FIGURE.angles||[]).find(g=>/^x/.test(g.label)); if (!a) throw new Error('x 라벨 없음'); return INT;`),
          trace: [[`그림에서 꼭짓점이 ${n}개이므로 정${n}각형이고 x° 는 한 내각이다.`, "Count the vertices; x is one interior angle."], [`내각의 합 = (${n} - 2) × 180° = ${(n - 2) * 180}° 이다.`, "Interior angle sum."], [`정다각형이므로 모든 내각이 같다.`, "All interior angles are equal."], [`x = ${(n - 2) * 180} ÷ ${n} = ${x} 이다.`, "Divide by the number of angles."], [`따라서 ${x} 이다.`, "State x."]], variant: "one_interior_angle_regular",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "그림의 정다각형 한 내각이 숫자로 라벨되었을 때 한 외각 180° − 내각 으로 변의 수 n = 360° ÷ 외각 을 구한 뒤 내각의 합을 구함", extra: "한 내각에서 거꾸로 변의 수(360 ÷ 외각)를 구해 (n − 2) × 180 을 해야 함(내각 × 변의 수를 모르면 오답) — medium 은 한 내각",
      concepts: ["정다각형", "외각의 합 360°", "내각의 합"],
      gen(rng) {
        const n = rng.pick(SIDES); const v = polyNames(rng, n); const a = ((n - 2) * 180) / n; const fig = regFig(v, [{ at: v[0], label: `${a}°` }]); const S = (n - 2) * 180;
        return geoInst(rng, {
          stimulus: intro(rng), question: rng.pick([`What is the sum, in degrees, of the interior angles of the polygon?`, `What is the sum of the measures of all the interior angles of the polygon?`, `The interior angles of the polygon add up to how many degrees?`, `If every interior angle of the polygon is added, what total in degrees results?`, `Find the total measure, in degrees, of the interior angles of the polygon shown.`, `Altogether, how many degrees do the interior angles of this polygon measure?`]), correct: S,
          wrongs: pos([W(a * 2, "step_missing", "두 내각만 더했다."), W(n * 180, "formula_misuse", "n × 180 으로 계산했다."), W(360, "formula_misuse", "외각의 합을 답했다."), W(a * (n - 1), "other", "n − 1 개를 더했다."), W(S + 180, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== S),
          verificationJs: figJs({}, fig, `${REG_JS}const a=(FIGURE.angles||[]).find(g=>/^\\d+(?:\\.\\d+)?°?$/.test(String(g.label).trim())); if (!a) throw new Error('숫자 각 라벨 없음'); const av=parseFloat(a.label); if (Math.abs(av-INT)>1e-9) throw new Error('라벨이 정다각형의 내각이 아님'); const ext=180-av; const k=360/ext; if (Math.abs(k-n)>1e-9) throw new Error('변의 수 불일치'); return Math.round(k)*av;`),
          trace: [[`그림에서 한 내각이 ${a}° 로 라벨되어 있다.`, "Read the interior angle."], [`한 외각 = 180° - ${a}° = ${180 - a}° 이다.`, "The exterior angle is its supplement."], [`외각의 합은 360° 이므로 변의 수 = 360° ÷ ${180 - a}° = ${n} 이다.`, "The exterior angles add to 360°."], [`내각의 합 = ${n} × ${a}° = ${S}° 이다.`, "All interior angles are equal."], [`따라서 ${S} 이다.`, "State the sum."]], variant: "interior_sum_from_angle",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "exterior_angle", structure: "그림의 정다각형 한 꼭짓점의 외각 x° 를 360° ÷ 변의 수 로 구함", extra: "easy: 외각의 합 360° 를 변의 수로 나눔", concepts: ["정다각형", "외각"],
      gen(rng) {
        const n = rng.pick(SIDES); const v = polyNames(rng, n); const fig = regFig(v); const x = 360 / n;
        return geoInst(rng, { stimulus: intro(rng), question: rng.pick([`What is the measure, in degrees, of one exterior angle of the polygon (formed by extending one side)?`, `One side of the polygon is extended, forming an exterior angle at a vertex. What is its measure, in degrees?`, `What is the degree measure of an exterior angle of this polygon?`, `Each exterior angle of the polygon has what measure, in degrees?`]), correct: x, wrongs: pos([W(((n - 2) * 180) / n, "formula_misuse", "한 내각을 답했다."), W(360, "step_missing", "외각의 합을 답했다."), W(180 / n, "formula_misuse", "180 을 n 으로 나누었다."), W(x + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({}, fig, `${REG_JS}return 360/n;`), trace: [[`그림에서 꼭짓점이 ${n}개이므로 정${n}각형이다.`, "Count the vertices."], [`외각의 합은 360° 이고 외각이 모두 같으므로 x = 360 ÷ ${n} = ${x} 이다.`, "Exterior angles add to 360° and are equal."]], variant: "exterior_angle_regular" }, fig);
      },
    },
    {
      lv: "medium", name: "interior_angle", structure: "그림의 정다각형 한 내각(x°)을 내각의 합 ÷ 변의 수 로 구함", extra: "medium: 변의 수 읽기 → 내각의 합 → 나누기", concepts: ["정다각형의 한 내각", "내각의 합"],
      gen(rng) {
        const n = rng.pick(SIDES); const v = polyNames(rng, n); const fig = regFig(v, [{ at: v[0], label: "x°" }]); const x = ((n - 2) * 180) / n;
        return geoInst(rng, { stimulus: intro(rng), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is $x$?`]), correct: x, wrongs: pos([W(360 / n, "formula_misuse", "한 외각을 답했다."), W(180 - x, "formula_misuse", "보각을 답했다."), W((n - 2) * 180, "step_missing", "내각의 합을 답했다."), W(x + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({}, fig, `${REG_JS}return INT;`), trace: [[`그림에서 정${n}각형이다.`, "Count the vertices."], [`내각의 합 = ${(n - 2) * 180}° 를 ${n} 로 나누면 x = ${x} 이다.`, "Divide the angle sum by n."], [`따라서 ${x} 이다.`, "State x."]], variant: "interior_angle_regular_medium" }, fig);
      },
    },
  ],
});
export const ITEM = RAW.map((a) => ({ ...a, generate: (rng: Rng) => retry(rng, () => a.generate(rng)) })) as typeof RAW;
void GenFail;
