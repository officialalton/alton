// linear_equations_one_var.literal_rearrange.PG.P — 도형의 공식(둘레·넓이)을 지문에서 주고 그림에 라벨된 값과 지문의 값을 넣어 문자 하나를 구한다(공식 재배열).
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { PG_JS, PG_LEAD, UNITS, parFig, rectFig, trapFig, type PolyFig } from "../pg-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
// 공식의 문자(P·A·S·W·L·B·H·D)와 헷갈리지 않게 꼭짓점 이름에서 뺀다.
const NAMES = "CEFGJKMNQRTUVXYZ".split("");
const quadNames = (rng: Rng): string[] => rng.shuffle([...NAMES]).slice(0, 4).sort();
const PRE = ["", "", "A student is reviewing formulas for a test. ", "A teacher asks the class to rearrange a formula. ", "An engineer needs one measurement from a plan. ", "A designer checks the dimensions of a part. ", "A contractor works from the sketch below. ", "A math club member solves this practice problem. ", "A shop owner measures a piece of material. ", "A survey crew records a shape on paper. "];
const POST = ["", "", " Lengths are in the same unit.", " All measurements use the same unit of length.", " Solve for the labeled quantity.", " Use the figure to find the value you need.", " The formula must be rearranged before you substitute.", " Assume every length is given in meters.", " Rearranging first makes the arithmetic simpler.", " Only one quantity in the formula is unknown."];
const intro = (rng: Rng, what: string) => `${rng.pick(PRE)}${what}${rng.pick(POST)}`.replace(/ {2,}/g, " ").trim();

const RAW = defineItem({
  prefix: "le", itemId: "linear_equations_one_var.literal_rearrange.PG.P",
  hard: [
    {
      op: "compose_kind", structure: "직사각형의 둘레 공식 P = 2ℓ + 2w 를 지문에서 주고 한 변 w 는 그림에, P 는 지문에 있을 때 ℓ 을 두 항에서 묶어 재배열해 구함", extra: "문자 ℓ 을 구하려고 2w 를 이항하고 2 로 나눠야 함(2 로 나누지 않거나 w 를 한 번만 빼면 오답) — medium 은 넓이 공식",
      concepts: ["문자식 재배열", "둘레", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const w = rng.int(3, 14), l = rng.int(w + 1, 30); const P = 2 * (l + w); const v = quadNames(rng); const fig = rectFig(v, "ℓ", String(w)) as PolyFig; const u = rng.pick(UNITS);
        return geoInst(rng, {
          stimulus: intro(rng, `${rng.pick([`The perimeter $P$ of the rectangle shown is given by $P = 2\\ell + 2w$, where $\\ell$ is the length and $w$ is the width. The perimeter is ${P}.`, `A rectangle's perimeter equals twice its length plus twice its width: $P = 2\\ell + 2w$. For the rectangle in the figure, $P = ${P}$.`, `For the rectangle in the figure, the formula $P = 2\\ell + 2w$ relates the perimeter $P$, the length $\\ell$, and the width $w$. Here the perimeter is ${P}.`, `Use $P = 2\\ell + 2w$ for the perimeter of a rectangle. The rectangle drawn in the figure has a perimeter of ${P}, and its length is the unknown $\\ell$.`, `Adding all four sides of a rectangle gives its perimeter, $P = 2\\ell + 2w$. The perimeter of the rectangle in the figure is ${P}.`, `Walking once around the rectangle in the figure covers a distance $P = 2\\ell + 2w$, and that distance is ${P}.`])} ${u}`), question: rng.pick([`What is the value of $\\ell$?`, `What is the length $\\ell$ of the rectangle?`, `In the figure shown, what is $\\ell$?`, `Find the length labeled $\\ell$.`, `How long is the side marked $\\ell$?`]), correct: l,
          wrongs: pos([W(P - w, "step_missing", "2 로 나누지 않았다."), W(P / 2, "step_missing", "w 를 빼지 않았다."), W((P - w) / 2, "formula_misuse", "w 를 한 번만 뺐다."), W(P - 2 * w, "step_missing", "2 로 나누지 않았다."), W(l + 2, "other", "계산 중 어긋났다.")]).filter((w2) => w2.v !== l),
          verificationJs: figJs({ P }, fig, `${PG_JS}const w=side(V[1],V[2]); if (!(w>0)) throw new Error('변 라벨 없음'); const lab=(FIGURE.sideLabels||[]).find(s=>s.between[0]===V[0]&&s.between[1]===V[1]); if (!lab||lab.label!=='ℓ') throw new Error('ℓ 라벨 없음'); return (P.P-2*w)/2;`),
          trace: [[`그림에서 w = ${w} 를 읽고 P = ${P} 는 지문에서 안다.`, "Read w from the figure; P is in the text."], [`P = 2ℓ + 2w 에서 ℓ 에 대해 정리한다.`, "Solve the formula for ℓ."], [`2ℓ = P - 2w = ${P} - ${2 * w} = ${P - 2 * w} 이다.`, "Subtract 2w."], [`ℓ = ${P - 2 * w} ÷ 2 = ${l} 이다.`, "Divide by 2."], [`따라서 ${l} 이다.`, "State ℓ."]], variant: "length_from_perimeter",
        }, fig);
      }); },
    },
    {
      op: "inverse", structure: "사다리꼴의 넓이 공식 A = ½(b₁ + b₂)h 를 지문에서 주고 한 밑변 b₁ 과 높이 h 는 그림에, A 는 지문에 있을 때 b₂ 를 거꾸로 구함", extra: "2A ÷ h 로 두 밑변의 합을 구하고 b₁ 을 빼야 함(½ 를 곱하거나 b₁ 을 빼지 않으면 오답) — medium 은 평행사변형",
      concepts: ["문자식 재배열", "사다리꼴의 넓이", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const b1 = rng.int(10, 22), b2 = rng.int(4, b1 - 3), h = rng.int(4, 12); const S = b1 + b2; if ((S * h) % 2) throw new GenFail("홀수"); const A = (S * h) / 2; const v = quadNames(rng); const fig = trapFig(v, { ab: String(b1), dc: "b", h: String(h) });
        return geoInst(rng, {
          stimulus: intro(rng, rng.pick([`The area $A$ of a trapezoid is $A = \\frac{1}{2}(b_1 + b_2)h$, where $b_1$ and $b_2$ are the lengths of the bases and $h$ is the height. The trapezoid shown has area ${A}, and its short base is labeled $b$.`, `A trapezoid with bases $b_1$ and $b_2$ and height $h$ has area $A = \\frac{1}{2}(b_1 + b_2)h$. In the figure, the area is ${A}, and the shorter base is marked $b$.`, `For the trapezoid in the figure, $A = \\frac{1}{2}(b_1 + b_2)h$ gives the area. The area of this trapezoid is ${A}; its top base is the unknown $b$.`, `Half the sum of the parallel sides times the height gives the area of a trapezoid: $A = \\frac{1}{2}(b_1 + b_2)h$. The area of the trapezoid in the figure is ${A}, and the base labeled $b$ is unknown.`, `The formula $A = \\frac{1}{2}(b_1 + b_2)h$ applies to the trapezoid shown. Its area is ${A}, and one of its bases has an unknown length $b$.`])), question: rng.pick([`What is the value of $b$?`, `What is the length $b$ of the short base?`, `In the figure shown, what is $b$?`, `Find the length of the base marked $b$.`, `The base marked $b$ has what length?`]), correct: b2,
          wrongs: pos([W((2 * A) / h, "step_missing", "긴 밑변을 빼지 않았다."), W(A / h - b1, "formula_misuse", "2 를 곱하지 않았다."), W(A / h, "step_missing", "2 를 곱하지 않고 b₁ 도 빼지 않았다."), W((2 * A) / h + b1, "sign_error", "b₁ 을 더했다."), W(b2 + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== b2),
          verificationJs: figJs({ A }, fig, `${PG_JS}const b1=side(V[0],V[1]); if (!(b1>0&&HT>0)) throw new Error('라벨 없음'); const dc=(FIGURE.sideLabels||[]).find(s=>s.between[0]===V[3]&&s.between[1]===V[2]); if(!dc||dc.label!=='b') throw new Error('b 라벨 없음'); return 2*P.A/HT-b1;`),
          trace: [[`그림에서 b₁ = ${b1}, h = ${h} 를 읽고 A = ${A} 는 지문에서 안다.`, "Read b₁ and h; A is in the text."], [`A = ½(b₁ + b₂)h 에서 b₂ 에 대해 정리한다.`, "Solve for b₂."], [`b₁ + b₂ = 2A ÷ h = ${2 * A} ÷ ${h} = ${S} 이다.`, "Multiply by 2 and divide by h."], [`b₂ = ${S} - ${b1} = ${b2} 이다.`, "Subtract b₁."], [`따라서 ${b2} 이다.`, "State b₂."]], variant: "short_base_from_trapezoid_area",
        }, fig);
      }); },
    },
    {
      op: "chain2", structure: "마름모의 넓이 공식 A = ½d₁d₂ 를 지문에서 주고 한 대각선은 그림에, A 는 지문에 있을 때 다른 대각선을 구한 뒤 두 대각선의 합을 구함", extra: "d₂ = 2A ÷ d₁ 을 구하고 두 대각선을 더해야 함(2 를 곱하지 않거나 d₂ 만 답하면 오답) — medium 은 평행사변형",
      concepts: ["문자식 재배열", "마름모의 넓이", "대각선"],
      gen(rng) { return retry(rng, () => {
        const d1 = rng.int(6, 20), d2 = rng.int(4, 18); if (Math.abs(d1 - d2) <= 1 || (d1 * d2) % 2) throw new GenFail("범위"); const A = (d1 * d2) / 2; const v = quadNames(rng); const fig: PolyFig = { type: "polygon", kind: "rhombus", vertices: v, diagonals: [{ between: [v[0], v[2]], label: String(d1) }, { between: [v[1], v[3]], label: "d" }], notToScale: true };
        return geoInst(rng, {
          stimulus: intro(rng, rng.pick([`The area $A$ of a rhombus is $A = \\frac{1}{2}d_1 d_2$, where $d_1$ and $d_2$ are the lengths of its diagonals. The rhombus shown has area ${A}, and one diagonal is labeled $d$.`, `A rhombus with diagonals $d_1$ and $d_2$ has area $A = \\frac{1}{2}d_1 d_2$. The rhombus in the figure has area ${A}; the diagonal marked $d$ is unknown.`, `For the rhombus in the figure, $A = \\frac{1}{2}d_1 d_2$. Its area is ${A}, and the length of one diagonal is the unknown $d$.`, `Half the product of the diagonals is the area of a rhombus: $A = \\frac{1}{2}d_1 d_2$. The rhombus in the figure has area ${A}, with one diagonal labeled $d$.`, `Use $A = \\frac{1}{2}d_1 d_2$ for the area of a rhombus. The area of the rhombus in the figure is ${A}, and the second diagonal has length $d$.`])), question: rng.pick([`What is the sum of the lengths of the two diagonals?`, `What is the total length of the two diagonals of the rhombus?`, `How long are the two diagonals together?`, `If the two diagonals were laid end to end, how long would they be?`, `Find $d_1 + d_2$ for the rhombus.`]), correct: d1 + d2,
          wrongs: pos([W(d2, "step_missing", "다른 대각선만 답했다."), W(A / d1 + d1, "formula_misuse", "2 를 곱하지 않았다."), W(A, "step_missing", "넓이를 답했다."), W(d1 * d2, "formula_misuse", "대각선의 곱을 답했다."), W(d1 + d2 + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== d1 + d2),
          verificationJs: figJs({ A }, fig, `${PG_JS}if (FIGURE.kind!=='rhombus') throw new Error('마름모 아님'); const D=FIGURE.diagonals||[]; const known=D.map(d=>num(d.label)).filter(n=>n>0); const unk=D.filter(d=>d.label==='d'); if (known.length!==1||unk.length!==1) throw new Error('대각선 라벨 오류'); const d2=2*P.A/known[0]; return known[0]+d2;`),
          trace: [[`그림에서 d₁ = ${d1} 을 읽고 A = ${A} 는 지문에서 안다.`, "Read d₁; A is in the text."], [`A = ½d₁d₂ 에서 d₂ 에 대해 정리한다.`, "Solve for d₂."], [`d₂ = 2A ÷ d₁ = ${2 * A} ÷ ${d1} = ${d2} 이다.`, "Multiply by 2 and divide by d₁."], [`두 대각선의 합 = ${d1} + ${d2} 이다.`, "Add the diagonals."], [`따라서 ${d1 + d2} 이다.`, "State the sum."]], variant: "diagonal_sum_from_rhombus_area",
        }, fig);
      }); },
    },
    {
      op: "repr_shift", structure: "정다각형의 둘레 공식 P = ns 를 지문에서 주고 변의 수 n 은 그림의 꼭짓점 수로, P 는 지문에 있을 때 한 변의 길이 s 를 구함", extra: "그림에서 변의 수를 세어 s = P ÷ n 으로 정리해야 함(n 을 틀리게 세거나 곱하면 오답) — medium 은 직사각형 넓이",
      concepts: ["문자식 재배열", "정다각형", "그림 읽기"],
      gen(rng) { return retry(rng, () => {
        const n = rng.pick([5, 6, 7, 8]); const s = rng.int(3, 12); const P = n * s; const vs = rng.shuffle([...NAMES]).slice(0, n).sort(); const fig: PolyFig = { type: "polygon", kind: "regular", sides: n, vertices: vs, sideLabels: [{ between: [vs[0], vs[1]], label: "s" }] };
        return geoInst(rng, {
          stimulus: intro(rng, rng.pick([`The perimeter $P$ of a regular polygon with $n$ sides, each of length $s$, is $P = ns$. The perimeter of the polygon shown is ${P}.`, `A regular polygon with $n$ equal sides of length $s$ has perimeter $P = ns$. The polygon in the figure has a perimeter of ${P}.`, `For the regular polygon in the figure, $P = ns$ relates the perimeter $P$, the number of sides $n$, and the side length $s$. The perimeter is ${P}.`, `Every side of the polygon in the figure has the same length $s$, so $P = ns$ where $n$ is the number of sides. The total perimeter is ${P}.`, `Multiplying the number of sides by the side length gives the perimeter of a regular polygon: $P = ns$. The perimeter of the figure is ${P}.`])), question: rng.pick([`What is the value of $s$?`, `What is the length $s$ of each side of the polygon shown?`, `In the figure shown, what is $s$?`, `Find the side length marked $s$.`, `How long is each side of this polygon?`]), correct: s,
          wrongs: pos([W(P / (n - 1), "formula_misuse", "n − 1 로 나누었다."), W(P / (n + 1), "formula_misuse", "n + 1 로 나누었다."), W(P - n, "formula_misuse", "빼서 구했다."), W(P, "step_missing", "둘레를 답했다."), W(s + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== s && Number.isInteger(w.v)),
          verificationJs: figJs({ P }, fig, `const n=FIGURE.sides; if (FIGURE.kind!=='regular'||!(n>=3&&n<=8)||FIGURE.vertices.length!==n) throw new Error('정다각형 오류'); const q=(FIGURE.sideLabels||[]).find(t=>t.label==='s'); if (!q) throw new Error('s 라벨 없음'); return P.P/n;`),
          trace: [[`그림의 다각형은 꼭짓점이 ${n}개이므로 n = ${n} 이다.`, "Count the vertices to get n."], [`P = ns 에서 s 에 대해 정리한다.`, "Solve for s."], [`s = P ÷ n = ${P} ÷ ${n} 이다.`, "Divide."], [`= ${s} 이다.`, "Compute."], [`따라서 ${s} 이다.`, "State s."]], variant: "side_from_regular_perimeter",
        }, fig);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "length_from_area", structure: "직사각형의 넓이 공식 A = ℓw 를 지문에서 주고 한 변이 그림에, A 가 지문에 있을 때 다른 변을 구함", extra: "easy: A ÷ w", concepts: ["문자식 재배열", "직사각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const w = rng.int(3, 12), l = rng.int(w + 1, 24); const A = l * w; const v = quadNames(rng); const fig = rectFig(v, "ℓ", String(w));
        return geoInst(rng, { stimulus: intro(rng, `The area $A$ of the rectangle shown is $A = \\ell w$. The area is ${A}.`), question: rng.pick([`What is the value of $\\ell$?`, `What is the length $\\ell$ of the rectangle?`]), correct: l, wrongs: pos([W(A - w, "formula_misuse", "빼서 구했다."), W(A * w, "formula_misuse", "곱해서 구했다."), W(A / 2, "formula_misuse", "2 로 나누었다."), W(l + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== l), verificationJs: figJs({ A }, fig, `${PG_JS}const w=side(V[1],V[2]); if (!(w>0)) throw new Error('변 라벨 없음'); return P.A/w;`), trace: [[`그림에서 w = ${w} 이고 A = ${A} 는 지문에서 안다.`, "Read w; A is in the text."], [`A = ℓw 에서 ℓ = A ÷ w = ${A} ÷ ${w} = ${l} 이다.`, "Divide by w."]], variant: "length_from_area" }, fig);
      }); },
    },
    {
      lv: "medium", name: "height_from_parallelogram_area", structure: "평행사변형의 넓이 공식 A = bh 를 지문에서 주고 밑변이 그림에, A 가 지문에 있을 때 높이 h 를 구함", extra: "medium: 비스듬한 변이 함정, h = A ÷ b", concepts: ["문자식 재배열", "평행사변형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const b = rng.int(5, 20), h = rng.int(3, 12), s = h + rng.int(2, 6); const A = b * h; const v = quadNames(rng); const fig = parFig(v, { ab: String(b), ad: String(s), h: "h" });
        return geoInst(rng, { stimulus: intro(rng, `The area $A$ of a parallelogram is $A = bh$, where $b$ is a base and $h$ is the perpendicular height. The parallelogram shown has area ${A}.`), question: rng.pick([`What is the value of $h$?`, `What is the height $h$ of the parallelogram?`]), correct: h, wrongs: pos([W(A / s, "formula_misuse", "비스듬한 변으로 나누었다."), W(A - b, "formula_misuse", "빼서 구했다."), W(A / 2, "formula_misuse", "2 로 나누었다."), W(h + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== h && Number.isInteger(x.v)), verificationJs: figJs({ A }, fig, `${PG_JS}const b=side(V[0],V[1]); if (!(b>0)) throw new Error('밑변 라벨 없음'); return P.A/b;`), trace: [[`그림에서 밑변 b = ${b} 를 읽는다(비스듬한 변 ${s} 는 쓰지 않는다).`, "Read the base; ignore the slanted side."], [`A = bh 에서 h = A ÷ b = ${A} ÷ ${b} = ${h} 이다.`, "Divide by b."], [`따라서 ${h} 이다.`, "State h."]], variant: "height_from_parallelogram_area" }, fig);
      }); },
    },
  ],
});
export const ITEM = RAW;
