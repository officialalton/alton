// coordinate_geometry.polygon_area_on_plane — 좌표평면의 사다리꼴·직사각형·ㄱ자 도형의 넓이를 꼭짓점 좌표로 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, POLY_JS, cgIntro, names, planeFig, polyO, ptO, segO, type P2 } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const PJ = `${CG_JS}${POLY_JS}`;
const scN = (n: string[], what: string) => [`The figure shows ${what} ${n.join("")} on a coordinate grid.`, `${what[0].toUpperCase()}${what.slice(1)} ${n.join("")} is plotted in the coordinate plane shown.`, `In the figure shown, points ${n.slice(0, -1).join(", ")}, and ${n[n.length - 1]} are the vertices of ${what}.`, `${what[0].toUpperCase()}${what.slice(1)} with vertices ${n.slice(0, -1).join(", ")}, and ${n[n.length - 1]} is drawn on the grid shown.`, `The coordinate grid shown contains ${what} ${n.join("")}.`];
const Q_AREA = (rng: Rng) => rng.pick(["What is the area of the shape, in square units?", "Find the area of the shape.", "How many square units does the shape cover?", "Determine the area of the figure shown."]);
const shape = (n: string[], pts: P2[]) => planeFig([...n.map((id, i) => ptO(id, pts[i])), polyO("G", n)], pts);

export const ITEM = defineItem({
  prefix: "av", itemId: "coordinate_geometry.polygon_area_on_plane.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "윗변과 아랫변이 가로인 사다리꼴 ABCD 의 두 밑변과 높이를 좌표에서 읽어 넓이를 구함", extra: "두 밑변의 합에 높이를 곱하고 2 로 나눠야 함(밑변 하나만 쓰거나 2 로 나누지 않으면 오답) — medium 은 평행사변형",
      concepts: ["사다리꼴의 넓이", "좌표 읽기", "밑변과 높이"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 4); const x = rng.int(1, 5), y = rng.int(1, 6), b1 = rng.int(6, 12), h = rng.int(3, 8), b2 = rng.int(2, b1 - 2); if (((b1 + b2) * h) % 2) throw new GenFail("정수"); const off = rng.int(0, b1 - b2);
        const pts: P2[] = [[x, y], [x + b1, y], [x + off + b2, y + h], [x + off, y + h]]; const f = shape(n, pts); const ar = ((b1 + b2) * h) / 2; if (x + b1 > 16) throw new GenFail("범위");
        return geoInst(rng, {
          stimulus: cgIntro(rng, scN(n, "trapezoid")), question: Q_AREA(rng), correct: ar,
          wrongs: pos([W(b1 * h, "step_missing", "아랫변만 썼다."), W((b1 + b2) * h, "formula_misuse", "2 로 나누지 않았다."), W(b2 * h, "step_missing", "윗변만 썼다."), W(ar + h, "other", "계산 중 어긋났다."), W((b1 + b2 + h) / 2 * 2, "formula_misuse", "합으로 계산했다.")]).filter((v) => v.v !== ar),
          verificationJs: figJs({}, f, `${PJ}const v=vs('G'); if (v.length!==4) throw new Error('사각형 필요'); return ip(shoe(v));`),
          trace: [[`그림에서 꼭짓점 ${n.join(", ")} 의 좌표를 읽는다.`, "Read the coordinates."], [`아랫변 = ${b1}, 윗변 = ${b2} 이다.`, "The two bases."], [`높이 = ${h} 이다.`, "The height."], [`넓이 = (${b1} + ${b2}) × ${h} ÷ 2 이다.`, "Trapezoid area formula."], [`따라서 ${ar} 이다.`, "State the area."]], variant: "trapezoid_area",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "직사각형의 가로·세로를 좌표에서 읽어 넓이를 구한 뒤 한 칸당 가격을 곱해 총액을 구함", extra: "넓이를 구한 뒤 단가를 곱해야 함(둘레에 단가를 곱하거나 넓이만 답하면 오답) — medium 은 직사각형의 넓이",
      concepts: ["직사각형의 넓이", "단가와 총액", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 4); const x = rng.int(1, 6), y = rng.int(1, 6), w = rng.int(3, 9), h = rng.int(2, 7), k = rng.pick([2, 3, 4, 5]); const pts: P2[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; const f = shape(n, pts); const c = w * h * k; if (c >= 1000) throw new GenFail("큼");
        return geoInst(rng, {
          stimulus: cgIntro(rng, scN(n, "rectangle"), ` Covering one square unit costs ${k} dollars.`), question: rng.pick(["What is the total cost, in dollars, to cover the whole rectangle?", "How many dollars does it cost to cover the rectangle?", "Find the cost in dollars of covering the entire shape."]), correct: c,
          wrongs: pos([W(w * h, "step_missing", "넓이만 답했다."), W(2 * (w + h) * k, "formula_misuse", "둘레에 단가를 곱했다."), W((w + h) * k, "formula_misuse", "가로·세로의 합에 곱했다."), W(c + k, "other", "계산 중 어긋났다."), W(w * h + k, "formula_misuse", "단가를 더했다.")]).filter((v) => v.v !== c),
          verificationJs: figJs({ k }, f, `${PJ}const v=vs('G'); if (v.length!==4) throw new Error('사각형 필요'); return ip(shoe(v)*P.k);`),
          trace: [[`그림에서 꼭짓점 ${n.join(", ")} 의 좌표를 읽는다.`, "Read the coordinates."], [`가로 = ${w}, 세로 = ${h} 이다.`, "Width and height."], [`넓이 = ${w} × ${h} = ${w * h} 이다.`, "Area."], [`단가는 ${k} 이다.`, "Cost per square unit."], [`따라서 ${w * h} × ${k} = ${c} 이다.`, "Total cost."]], variant: "rectangle_cost",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "ㄱ자 모양 여섯 꼭짓점 도형의 넓이를 큰 직사각형에서 잘려 나간 직사각형을 빼는 식으로 바꿔 구함", extra: "큰 직사각형에서 모서리가 잘려 나간 부분을 빼야 함(큰 직사각형의 넓이를 답하거나 잘린 부분을 더하면 오답) — medium 은 사다리꼴 없는 단순 도형",
      concepts: ["복합 도형의 넓이", "직사각형의 넓이", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 6); const x = rng.int(1, 4), y = rng.int(1, 4), w = rng.int(6, 11), h = rng.int(6, 10), cw = rng.int(2, w - 3), ch = rng.int(2, h - 3); const pts: P2[] = [[x, y], [x + w, y], [x + w, y + h - ch], [x + w - cw, y + h - ch], [x + w - cw, y + h], [x, y + h]]; const f = shape(n, pts); const ar = w * h - cw * ch;
        return geoInst(rng, {
          stimulus: cgIntro(rng, scN(n, "polygon")), question: Q_AREA(rng), correct: ar,
          wrongs: pos([W(w * h, "step_missing", "큰 직사각형의 넓이를 답했다."), W(w * h + cw * ch, "formula_misuse", "잘린 부분을 더했다."), W(cw * ch, "step_missing", "잘린 부분의 넓이를 답했다."), W(ar + w, "other", "계산 중 어긋났다."), W((w - cw) * (h - ch), "formula_misuse", "작은 직사각형만 계산했다.")]).filter((v) => v.v !== ar),
          verificationJs: figJs({}, f, `${PJ}const v=vs('G'); if (v.length!==6) throw new Error('여섯 꼭짓점 필요'); return ip(shoe(v));`),
          trace: [[`그림에서 꼭짓점 ${n.join(", ")} 의 좌표를 읽는다.`, "Read the coordinates."], [`도형을 감싸는 직사각형은 ${w} × ${h} = ${w * h} 이다.`, "The bounding rectangle."], [`한 모서리가 ${cw} × ${ch} 만큼 잘려 있다.`, "A corner is cut out."], [`잘린 부분의 넓이 = ${cw * ch} 이다.`, "Area of the cut-out corner."], [`따라서 ${w * h} − ${cw * ch} = ${ar} 이다.`, "Subtract."]], variant: "l_shape_area",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "직사각형의 한 변 AB 가 그림에 있고 넓이가 지문에 있을 때 윗변이 놓인 높이(y 좌표)를 거꾸로 구함", extra: "넓이를 가로로 나눈 세로를 구해 아랫변의 y 좌표에 더해야 함(세로만 답하거나 넓이를 가로로 곱하면 오답) — medium 은 세로",
      concepts: ["직사각형의 넓이", "역산", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const x = rng.int(1, 8), y = rng.int(1, 6), w = rng.int(3, 9), h = rng.int(2, 8); const ar = w * h; if (ar >= 100 || x + w > 16) throw new GenFail("범위"); const A: P2 = [x, y], B: P2 = [x + w, y]; const f = planeFig([ptO(a, A), ptO(b, B), segO("s", a, b)], [A, B, [x, y + h]]); const c = y + h;
        return geoInst(rng, {
          stimulus: cgIntro(rng, [`In the figure shown, segment ${a}${b} is the bottom side of a rectangle.`, `Points ${a} and ${b} are plotted on the grid shown and are the endpoints of the bottom side of a rectangle.`, `A rectangle has bottom side ${a}${b}, drawn along a grid line in the figure shown.`], ` The area of the rectangle is ${ar} square units, and the rectangle extends upward from that side.`), question: rng.pick(["What is the $y$-coordinate of the top side of the rectangle?", "At what $y$-value does the top side of the rectangle lie?", "Find the $y$-coordinate of the rectangle's top side."]), correct: c,
          wrongs: pos([W(h, "step_missing", "세로 길이만 답했다."), W(y, "step_missing", "아랫변의 y 좌표를 답했다."), W(y + ar, "formula_misuse", "넓이를 더했다."), W(c + 1, "other", "계산 중 어긋났다."), W(y + w, "formula_misuse", "가로를 더했다.")]).filter((v) => v.v !== c),
          verificationJs: figJs({ a, b, ar }, f, `${PJ}const A=PA(P.a), B=PA(P.b); if (A[1]!==B[1]) throw new Error('아랫변이 가로 아님'); return ip(A[1]+P.ar/Math.abs(B[0]-A[0]));`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다.`, "Read the coordinates."], [`가로 = ${w} 이고 넓이는 ${ar} 이다.`, "Width and area."], [`세로 = ${ar} ÷ ${w} = ${h} 이다.`, "The height of the rectangle."], [`아랫변의 y 좌표는 ${y} 이다.`, "The bottom side's y-coordinate."], [`따라서 ${y} + ${h} = ${c} 이다.`, "State the y-coordinate."]], variant: "top_side_from_area",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "rectangle_area", structure: "직사각형의 넓이를 꼭짓점 좌표에서 구함", extra: "easy: 가로 × 세로", concepts: ["직사각형의 넓이", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 4); const x = rng.int(1, 6), y = rng.int(1, 6), w = rng.int(3, 9), h = rng.int(2, 7); const pts: P2[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; const f = shape(n, pts);
        return geoInst(rng, { stimulus: cgIntro(rng, scN(n, "rectangle")), question: Q_AREA(rng), correct: w * h, wrongs: pos([W(2 * (w + h), "formula_misuse", "둘레를 답했다."), W(w + h, "formula_misuse", "더했다."), W(w * h + w, "other", "계산 중 어긋났다.")]).filter((v) => v.v !== w * h), verificationJs: figJs({}, f, `${PJ}const v=vs('G'); if (v.length!==4) throw new Error('사각형 필요'); return ip(shoe(v));`), trace: [[`그림에서 가로 ${w}, 세로 ${h} 를 읽는다.`, "Read the width and height."], [`넓이 = ${w} × ${h} 이다.`, "Area formula."], [`따라서 ${w * h} 이다.`, "State the area."]], variant: "rectangle_area_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "parallelogram_area", structure: "밑변이 가로인 평행사변형의 넓이를 구함", extra: "medium: 밑변 × 높이", concepts: ["평행사변형의 넓이", "밑변과 높이"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 4); const x = rng.int(1, 5), y = rng.int(1, 6), w = rng.int(3, 8), h = rng.int(2, 7), s = rng.int(1, 4); const pts: P2[] = [[x, y], [x + w, y], [x + w + s, y + h], [x + s, y + h]]; const f = shape(n, pts); if (x + w + s > 16) throw new GenFail("범위");
        return geoInst(rng, { stimulus: cgIntro(rng, scN(n, "parallelogram")), question: Q_AREA(rng), correct: w * h, wrongs: pos([W(Math.round(Math.hypot(s, h)) * w, "formula_misuse", "기울어진 변을 높이로 썼다."), W(w * h / 2, "formula_misuse", "2 로 나누었다."), W(2 * (w + h), "formula_misuse", "둘레로 계산했다."), W(w * h + s, "other", "계산 중 어긋났다.")]).filter((v) => v.v !== w * h), verificationJs: figJs({}, f, `${PJ}const v=vs('G'); if (v.length!==4) throw new Error('사각형 필요'); return ip(shoe(v));`), trace: [[`그림에서 밑변 ${w}, 높이 ${h} 를 읽는다.`, "Read the base and height."], [`넓이 = ${w} × ${h} 이다.`, "Parallelogram area."], [`따라서 ${w * h} 이다.`, "State the area."]], variant: "parallelogram_area_medium" }, f);
      }); },
    },
  ],
});
