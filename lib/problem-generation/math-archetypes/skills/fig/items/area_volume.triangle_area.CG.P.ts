// area_volume.triangle_area.CG.P — 좌표평면의 삼각형에서 밑변·높이를 읽거나 감싸는 직사각형으로 넓이를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, POLY_JS, cgIntro, names, planeFig, polyO, ptO, segO, type P2 } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const sc3 = (a: string, b: string, c: string) => [`The figure shows triangle ${a}${b}${c} on a coordinate grid.`, `Triangle ${a}${b}${c} is plotted in the coordinate plane shown.`, `In the figure shown, points ${a}, ${b}, and ${c} are the vertices of a triangle.`, `A triangle with vertices ${a}, ${b}, and ${c} is drawn on the grid shown.`, `The coordinate grid shown contains triangle ${a}${b}${c}.`];
const Q_AREA = (rng: Rng, t: string) => rng.pick([`What is the area of triangle ${t}?`, `Find the area of triangle ${t}.`, `How many square units does triangle ${t} cover?`, `What is the area of the triangle, in square units?`, `Determine the area of triangle ${t}.`]);
const AJ = `${CG_JS}${POLY_JS}`;
/** 밑변 AB 가 가로, 꼭짓점 C 가 위·아래: 넓이 = base·h/2 가 정수. */
function baseTri(rng: Rng) { for (let i = 0; i < 80; i++) { const x = rng.int(1, 8), y = rng.int(1, 8), w = rng.int(3, 9), h = rng.int(2, 8); const cx = x + rng.int(0, w); if ((w * h) % 2) continue; if (y + h > 16 || x + w > 16) continue; return { A: [x, y] as P2, B: [x + w, y] as P2, C: [cx, y + h] as P2, w, h }; } throw new GenFail("삼각형"); }
const trObjs = (n: [string, string, string], A: P2, B: P2, C: P2) => [ptO(n[0], A), ptO(n[1], B), ptO(n[2], C), polyO("T", n)];

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.triangle_area.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "가로 변 AB 를 밑변으로, 꼭짓점 C 의 높이를 읽어 삼각형의 넓이를 구함", extra: "밑변의 길이와 높이를 격자에서 읽어 곱한 뒤 2 로 나눠야 함(2 로 나누지 않거나 기울어진 변을 밑변으로 쓰면 오답) — medium 은 직각삼각형",
      concepts: ["삼각형의 넓이", "좌표 읽기", "밑변과 높이"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const { A, B, C, w, h } = baseTri(rng); const f = planeFig(trObjs(n, A, B, C), [A, B, C]); const ar = (w * h) / 2;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...n)), question: Q_AREA(rng, n.join("")), correct: ar,
          wrongs: pos([W(w * h, "formula_misuse", "2 로 나누지 않았다."), W(w + h, "formula_misuse", "밑변과 높이를 더했다."), W(Math.round((w + h) / 2 * 2), "formula_misuse", "합의 절반의 두 배를 답했다."), W(ar + w, "other", "계산 중 어긋났다."), W(Math.round(Math.hypot(w, h) * h / 2), "formula_misuse", "기울어진 변을 밑변으로 썼다.")]).filter((x) => x.v !== ar),
          verificationJs: figJs({ a: n[0], b: n[1], c: n[2] }, f, `${AJ}const A=PA(P.a), B=PA(P.b), C=PA(P.c); if (A[1]!==B[1]) throw new Error('밑변이 가로 아님'); return ip(Math.abs(B[0]-A[0])*Math.abs(C[1]-A[1])/2);`),
          trace: [[`그림에서 ${n[0]}, ${n[1]}, ${n[2]} 의 좌표를 읽는다.`, "Read the coordinates."], [`${n[0]}${n[1]} 는 가로 변이므로 밑변 = ${w} 이다.`, "The base is horizontal."], [`${n[2]} 에서 밑변까지의 높이 = ${h} 이다.`, "The height."], [`넓이 = ${w} × ${h} ÷ 2 이다.`, "Area formula."], [`따라서 ${ar} 이다.`, "State the area."]], variant: "triangle_area_base_height",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "격자 한 칸이 k 미터일 때 삼각형의 넓이를 격자 단위로 구한 뒤 제곱미터로 환산함", extra: "넓이를 구한 뒤 칸의 크기를 제곱해 곱해야 함(k 를 한 번만 곱하면 오답) — medium 은 격자 단위 넓이",
      concepts: ["삼각형의 넓이", "넓이 단위 환산", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const { A, B, C, w, h } = baseTri(rng); const k = rng.pick([2, 3]); const f = planeFig(trObjs(n, A, B, C), [A, B, C]); const ar = (w * h) / 2; const c = ar * k * k; if (c >= 1000) throw new GenFail("큼");
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...n), ` Each side of a grid square is ${k} meters long.`), question: rng.pick([`What is the area of triangle ${n.join("")}, in square meters?`, `How many square meters does the triangle cover?`, `Find the real area of triangle ${n.join("")}, in square meters.`]), correct: c,
          wrongs: pos([W(ar, "unit_error", "격자 단위 넓이를 답했다."), W(ar * k, "unit_error", "칸의 크기를 한 번만 곱했다."), W(w * h * k * k, "formula_misuse", "2 로 나누지 않았다."), W(c + k, "other", "계산 중 어긋났다."), W(ar + k * k, "unit_error", "칸의 넓이를 더했다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ a: n[0], b: n[1], c: n[2], k }, f, `${AJ}const A=PA(P.a), B=PA(P.b), C=PA(P.c); if (A[1]!==B[1]) throw new Error('밑변이 가로 아님'); return ip(Math.abs(B[0]-A[0])*Math.abs(C[1]-A[1])/2*P.k*P.k);`),
          trace: [[`그림에서 ${n[0]}, ${n[1]}, ${n[2]} 의 좌표를 읽는다.`, "Read the coordinates."], [`밑변 = ${w}, 높이 = ${h} 칸이다.`, "Base and height in grid units."], [`격자 넓이 = ${w} × ${h} ÷ 2 = ${ar} 이다.`, "Area in grid squares."], [`한 칸의 넓이 = ${k}² = ${k * k} m² 이다.`, "One square's area."], [`따라서 ${ar} × ${k * k} = ${c} m² 이다.`, "Convert to square meters."]], variant: "triangle_area_scaled",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "어느 변도 축과 평행하지 않은 삼각형의 넓이를 감싸는 직사각형에서 세 직각삼각형을 빼는 식으로 바꿔 구함", extra: "직사각형의 넓이에서 세 모서리의 직각삼각형 넓이를 모두 빼야 함(하나를 빠뜨리거나 직사각형의 넓이를 답하면 오답) — medium 은 밑변이 가로인 삼각형",
      concepts: ["삼각형의 넓이", "감싸는 직사각형", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const x0 = rng.int(1, 5), y0 = rng.int(1, 5), W0 = rng.int(6, 11), H0 = rng.int(5, 10);
        const A: P2 = [x0, y0 + rng.int(1, H0 - 2)], B: P2 = [x0 + rng.int(2, W0 - 2), y0 + H0], C: P2 = [x0 + W0, y0 + rng.int(0, H0 - 2)];
        if (A[1] === y0 && C[1] === y0) throw new GenFail("평행"); if (C[1] === B[1] || A[1] === B[1] || A[0] === B[0]) throw new GenFail("축 평행");
        const twice = Math.abs(A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1])); if (twice % 2) throw new GenFail("정수 아님"); const ar = twice / 2;
        const xs = [A[0], B[0], C[0]], ys = [A[1], B[1], C[1]]; const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
        if ([[A, B], [B, C], [A, C]].some(([p, q]) => p[0] === q[0] || p[1] === q[1])) throw new GenFail("축 평행 변"); if (bw * bh <= ar || ar < 8) throw new GenFail("범위");
        const f = planeFig(trObjs(n, A, B, C), [A, B, C]);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...n), " None of its sides is horizontal or vertical."), question: Q_AREA(rng, n.join("")), correct: ar,
          wrongs: pos([W(bw * bh, "step_missing", "감싸는 직사각형의 넓이를 답했다."), W(Math.round(bw * bh / 2), "formula_misuse", "직사각형의 절반을 답했다."), W(ar + bw, "other", "계산 중 어긋났다."), W(Math.abs(ar - 3), "other", "계산 중 어긋났다."), W(bw * bh - ar, "step_missing", "빼야 할 영역의 넓이를 답했다.")]).filter((x) => x.v !== ar),
          verificationJs: figJs({ a: n[0], b: n[1], c: n[2] }, f, `${AJ}const A=PA(P.a), B=PA(P.b), C=PA(P.c); return ip(shoe([A,B,C]));`),
          trace: [[`그림에서 ${n[0]}, ${n[1]}, ${n[2]} 의 좌표를 읽는다.`, "Read the coordinates."], [`삼각형을 감싸는 직사각형은 ${bw} × ${bh} = ${bw * bh} 이다.`, "The bounding rectangle."], [`직사각형에서 삼각형 밖의 세 직각삼각형을 뺀다.`, "Subtract the three corner triangles."], [`세 직각삼각형의 넓이의 합 = ${bw * bh - ar} 이다.`, "Total area of the corner triangles."], [`따라서 ${bw * bh} − ${bw * bh - ar} = ${ar} 이다.`, "State the area."]], variant: "triangle_area_bounding_rectangle",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "밑변 AB 는 그림에 있고 넓이가 지문에 주어질 때 삼각형의 높이 2·넓이 ÷ 밑변 을 거꾸로 구함", extra: "넓이의 두 배를 밑변으로 나눠야 함(넓이를 밑변으로만 나누면 오답) — medium 은 넓이",
      concepts: ["삼각형의 넓이", "역산", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const x = rng.int(1, 8), y = rng.int(1, 8), w = rng.int(3, 9), h = rng.int(2, 8); if ((w * h) % 2 || x + w > 16) throw new GenFail("정수"); const A: P2 = [x, y], B: P2 = [x + w, y]; const ar = (w * h) / 2; const f = planeFig([ptO(a, A), ptO(b, B), segO("s", a, b)], [A, B, [x, y + h]]);
        return geoInst(rng, {
          stimulus: cgIntro(rng, [`In the figure shown, segment ${a}${b} is the base of a triangle.`, `Points ${a} and ${b} are plotted on the grid shown, and ${a}${b} is the base of a triangle.`, `The coordinate grid shown has base ${a}${b} of a triangle drawn along a grid line.`, `A triangle has base ${a}${b}, which is plotted in the figure.`], ` The area of the triangle is ${ar} square units.`), question: rng.pick(["What is the height of the triangle?", "How tall is the triangle, measured from the base?", "Find the height of the triangle.", "The triangle's height, measured from the base, is how many units?"]), correct: h,
          wrongs: pos([W(ar / w, "step_missing", "넓이를 밑변으로만 나누었다."), W(2 * ar * w, "formula_misuse", "곱했다."), W(w - h || w + 1, "other", "계산 중 어긋났다."), W(h + 1, "other", "계산 중 어긋났다."), W(Math.round(ar - w), "formula_misuse", "넓이에서 밑변을 뺐다.")]).filter((x) => x.v !== h && Number.isInteger(x.v)),
          verificationJs: figJs({ a, b, ar }, f, `${AJ}const A=PA(P.a), B=PA(P.b); if (A[1]!==B[1]) throw new Error('밑변이 가로 아님'); return ip(2*P.ar/Math.abs(B[0]-A[0]));`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다.`, "Read the coordinates."], [`밑변 = ${w} 이고 넓이는 ${ar} 이다.`, "The base and the area."], [`넓이 = 밑변 × 높이 ÷ 2 이므로 ${ar} = ${w} × h ÷ 2 이다.`, "Area equation."], [`h = 2 × ${ar} ÷ ${w} 이다.`, "Solve for h."], [`따라서 ${h} 이다.`, "State the height."]], variant: "triangle_height_from_area",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "right_triangle_area", structure: "축에 평행한 두 변을 가진 직각삼각형의 넓이를 구함", extra: "easy: 두 직각변의 곱의 절반", concepts: ["삼각형의 넓이", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const x = rng.int(1, 8), y = rng.int(1, 8), w = rng.int(2, 8), h = rng.int(2, 8); if ((w * h) % 2) throw new GenFail("정수"); const A: P2 = [x, y], B: P2 = [x + w, y], C: P2 = [x + w, y + h]; const f = planeFig(trObjs(n, A, B, C), [A, B, C]); const ar = (w * h) / 2;
        return geoInst(rng, { stimulus: cgIntro(rng, sc3(...n)), question: Q_AREA(rng, n.join("")), correct: ar, wrongs: pos([W(w * h, "formula_misuse", "2 로 나누지 않았다."), W(w + h, "formula_misuse", "더했다."), W(ar + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== ar), verificationJs: figJs({ a: n[0], b: n[1], c: n[2] }, f, `${AJ}const A=PA(P.a), B=PA(P.b), C=PA(P.c); return ip(shoe([A,B,C]));`), trace: [[`그림에서 직각변 ${w} 와 ${h} 를 읽는다.`, "Read the legs."], [`넓이 = ${w} × ${h} ÷ 2 이다.`, "Area formula."], [`따라서 ${ar} 이다.`, "State the area."]], variant: "right_triangle_area_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "base_height", structure: "가로 변을 밑변으로 하는 삼각형의 넓이를 구함", extra: "medium: 밑변 × 높이 ÷ 2", concepts: ["삼각형의 넓이", "밑변과 높이"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const { A, B, C, w, h } = baseTri(rng); const f = planeFig(trObjs(n, A, B, C), [A, B, C]); const ar = (w * h) / 2;
        return geoInst(rng, { stimulus: cgIntro(rng, sc3(...n)), question: Q_AREA(rng, n.join("")), correct: ar, wrongs: pos([W(w * h, "formula_misuse", "2 로 나누지 않았다."), W(w + h, "formula_misuse", "더했다."), W(ar + w, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== ar), verificationJs: figJs({ a: n[0], b: n[1], c: n[2] }, f, `${AJ}const A=PA(P.a), B=PA(P.b), C=PA(P.c); if (A[1]!==B[1]) throw new Error('밑변이 가로 아님'); return ip(Math.abs(B[0]-A[0])*Math.abs(C[1]-A[1])/2);`), trace: [[`그림에서 밑변 ${w}, 높이 ${h} 를 읽는다.`, "Read the base and height."], [`넓이 = ${w} × ${h} ÷ 2 이다.`, "Area formula."], [`따라서 ${ar} 이다.`, "State the area."]], variant: "triangle_area_base_height_medium" }, f);
      }); },
    },
  ],
});
