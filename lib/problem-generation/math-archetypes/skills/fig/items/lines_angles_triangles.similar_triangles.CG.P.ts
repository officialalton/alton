// lines_angles_triangles.similar_triangles.CG.P — 좌표평면의 직각삼각형과 원점 중심 닮음변환(확대)의 상 사이의 닮음비·변의 길이·넓이비를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, POLY_JS, cgIntro, names, planeFig, polyO, ptO, type CgObj, type P2 } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const TJS = `${CG_JS}${POLY_JS}const TR=OB('transform')[0]; const kk=()=>{ if(!TR||!TR.op||TR.op.type!=='dilate') throw new Error('확대 필요'); return TR.op.k; };\n`;
const sc = (a: string, b: string, c: string, img: boolean) => img
  ? [`The figure shows triangle ${a}${b}${c} and its image after a dilation centered at the origin; the image is drawn with dashed sides.`, `Triangle ${a}${b}${c} is plotted in the coordinate plane shown, along with its dashed image under a dilation about the origin.`, `In the figure shown, a dilation centered at the origin maps triangle ${a}${b}${c} to a larger triangle, drawn dashed.`, `The coordinate grid shown contains right triangle ${a}${b}${c} and its dashed image after a dilation centered at the origin.`]
  : [`The figure shows triangle ${a}${b}${c} on a coordinate grid; the right angle is at ${b}.`, `Triangle ${a}${b}${c}, with its right angle at ${b}, is plotted in the coordinate plane shown.`, `In the figure shown, points ${a}, ${b}, and ${c} form a right triangle with the right angle at ${b}.`];
function scene(rng: Rng, kChoices: number[] = [2, 3]) {
  const n = names(rng, 3) as [string, string, string]; const k = rng.pick(kChoices); const [a, b] = rng.pick([[3, 4], [4, 3]]); const bx = rng.int(1, 2), by = rng.int(1, 2); const c = 5;
  const A: P2 = [bx + a, by], B: P2 = [bx, by], C: P2 = [bx, by + b]; if (k * Math.max(bx + a, by + b) > 18) throw new GenFail("큼");
  return { n, k, a, b, c, A, B, C };
}
type S = ReturnType<typeof scene>;
const objs = (s: S, img: boolean): CgObj[] => [ptO(s.n[0], s.A), ptO(s.n[1], s.B), ptO(s.n[2], s.C), polyO("T", s.n), ...(img ? [{ id: "I", kind: "transform", of: "T", op: { type: "dilate", k: s.k } } as CgObj] : [])];
const fig = (s: S, img: boolean) => planeFig(objs(s, img), [s.A, s.B, s.C, ...(img ? ([s.A, s.B, s.C].map((p) => [p[0] * s.k, p[1] * s.k]) as P2[]) : [])], { margin: 1 });
const sName = (s: S) => `${s.n[0]}′${s.n[1]}′`;

export const ITEM = defineItem({
  prefix: "av", itemId: "lines_angles_triangles.similar_triangles.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "원점 중심의 확대로 얻은 닮은 삼각형 A′B′C′ 의 빗변 길이를 닮음비와 원래 삼각형의 변으로 구함", extra: "원래 삼각형의 빗변을 구한 뒤 닮음비를 곱해야 함(직각변만 곱하거나 닮음비를 더하면 오답) — medium 은 한 직각변",
      concepts: ["닮음비", "피타고라스 정리", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = fig(s, true); const c = s.k * s.c;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(...s.n, true)), question: rng.pick([`What is the length of ${s.n[0]}′${s.n[2]}′?`, `How long is side ${s.n[0]}′${s.n[2]}′ of the larger triangle?`, `Find the length of the hypotenuse of the dashed triangle.`]), correct: c,
          wrongs: pos([W(s.c, "step_missing", "원래 삼각형의 빗변을 답했다."), W(s.c + s.k, "formula_misuse", "닮음비를 더했다."), W(s.k * (s.a + s.b), "formula_misuse", "직각변의 합에 닮음비를 곱했다."), W(s.k * s.k * s.c, "formula_misuse", "닮음비를 제곱해 곱했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ a: s.n[0], c: s.n[2] }, f, `${TJS}const A=PA(P.a), C=PA(P.c); return ip(dist(A,C)*kk());`),
          trace: [[`그림에서 ${s.n.join(", ")} 의 좌표를 읽는다.`, "Read the coordinates."], [`직각변은 ${s.a} 와 ${s.b} 이므로 ${s.n[0]}${s.n[2]} = ${s.c} 이다.`, "The hypotenuse of the original triangle."], [`확대 배율은 상의 좌표가 원래 좌표의 몇 배인지로 읽는다: ${s.k} 이다.`, "The scale factor from the image coordinates."], [`${s.n[0]}′${s.n[2]}′ = ${s.k} × ${s.c} 이다.`, "Scale the hypotenuse."], [`따라서 ${c} 이다.`, "State the length."]], variant: "image_hypotenuse",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "확대의 닮음비와 원래 삼각형의 세 변으로 상 삼각형의 둘레를 구함", extra: "원래 삼각형의 둘레에 닮음비를 곱해야 함(상의 두 변만 더하거나 닮음비를 더하면 오답) — medium 은 빗변",
      concepts: ["닮음비", "둘레", "피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = fig(s, true); const per = s.a + s.b + s.c; const c = s.k * per;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(...s.n, true)), question: rng.pick(["What is the perimeter of the dashed triangle?", "Find the total length of the three sides of the larger, dashed triangle.", "How long is a path around the image triangle?"]), correct: c,
          wrongs: pos([W(per, "step_missing", "원래 삼각형의 둘레를 답했다."), W(per + s.k, "formula_misuse", "닮음비를 더했다."), W(s.k * (s.a + s.b), "step_missing", "빗변을 빠뜨렸다."), W(s.k * s.k * per, "formula_misuse", "닮음비를 제곱해 곱했다."), W(c + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ a: s.n[0], b: s.n[1], c: s.n[2] }, f, `${TJS}const A=PA(P.a), B=PA(P.b), C=PA(P.c); return ip((dist(A,B)+dist(B,C)+dist(A,C))*kk());`),
          trace: [[`그림에서 ${s.n.join(", ")} 의 좌표를 읽는다.`, "Read the coordinates."], [`원래 삼각형의 변: ${s.a}, ${s.b}, ${s.c} 이다.`, "The original side lengths."], [`둘레 = ${s.a} + ${s.b} + ${s.c} = ${per} 이다.`, "The original perimeter."], [`확대 배율은 ${s.k} 이다.`, "The scale factor."], [`따라서 ${per} × ${s.k} = ${c} 이다.`, "Perimeters scale by the scale factor."]], variant: "image_perimeter",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "닮음변환의 배율을 길이의 비에서 넓이의 비로 옮겨 상 삼각형과 원래 삼각형의 넓이의 비를 구함", extra: "닮음비를 제곱해야 함(닮음비를 그대로 답하거나 세제곱하면 오답) — medium 은 닮음비",
      concepts: ["닮음비와 넓이비", "표현 바꾸기", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng, [2, 3]); const f = fig(s, true); const c = s.k * s.k;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(...s.n, true)), question: rng.pick(["The area of the dashed triangle is how many times the area of the original triangle?", "What is the ratio of the area of the larger triangle to the area of the original triangle?", "Find how many times as large the area of the image is compared with the area of the original."]), correct: c,
          wrongs: pos([W(s.k, "formula_misuse", "닮음비를 그대로 답했다."), W(s.k * s.k * s.k, "formula_misuse", "닮음비를 세제곱했다."), W(2 * s.k, "formula_misuse", "닮음비를 두 배 했다."), W(c + 1, "other", "계산 중 어긋났다."), W(s.k + 1, "formula_misuse", "닮음비에 1 을 더했다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ a: s.n[0] }, f, `${TJS}const k=kk(); return ip(k*k);`),
          trace: [[`그림에서 상의 좌표가 원래 좌표의 몇 배인지 읽는다.`, "Compare the image and original coordinates."], [`길이의 닮음비는 ${s.k} 이다.`, "The length ratio."], [`넓이는 길이를 두 번 곱한 값이다.`, "Area is length times length."], [`넓이의 비 = ${s.k}² 이다.`, "Area ratio is the square of the length ratio."], [`따라서 ${c} 이다.`, "State the ratio."]], variant: "image_area_ratio",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "원래 삼각형이 그림에 있고 닮은 상의 빗변 길이가 지문에 주어질 때 닮음비를 거꾸로 구함", extra: "상의 빗변을 원래 빗변으로 나눠야 함(곱하거나 직각변으로 나누면 오답) — medium 은 배율이 주어짐",
      concepts: ["닮음비", "역산", "피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng, [2, 3, 4]); const L = s.k * s.c; const f = fig(s, false);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(...s.n, false), ` Triangle ${s.n[0]}′${s.n[1]}′${s.n[2]}′ is the image of triangle ${s.n.join("")} after a dilation centered at the origin, and ${s.n[0]}′${s.n[2]}′ is ${L} units long.`), question: rng.pick(["What is the scale factor of the dilation?", "By what factor does the dilation enlarge the triangle?", "Find the scale factor."]), correct: s.k,
          wrongs: pos([W(L, "step_missing", "상의 빗변을 답했다."), W(Math.round(L / s.a), "formula_misuse", "한 직각변으로 나누었다."), W(L - s.c, "formula_misuse", "차를 구했다."), W(s.k + 1, "other", "계산 중 어긋났다."), W(L * s.c, "formula_misuse", "곱했다.")]).filter((x) => x.v !== s.k && Number.isInteger(x.v)),
          verificationJs: figJs({ a: s.n[0], c: s.n[2], L }, f, `${CG_JS}const A=PA(P.a), C=PA(P.c); return ip(P.L/dist(A,C));`),
          trace: [[`그림에서 ${s.n.join(", ")} 의 좌표를 읽는다.`, "Read the coordinates."], [`직각변은 ${s.a} 와 ${s.b} 이다.`, "The legs."], [`${s.n[0]}${s.n[2]} = √(${s.a}² + ${s.b}²) = ${s.c} 이다.`, "The original hypotenuse."], [`상의 빗변은 ${L} 이다.`, "The image's hypotenuse."], [`닮음비 = ${L} ÷ ${s.c} = ${s.k} 이다.`, "Divide the corresponding sides."]], variant: "scale_factor_from_image_side",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "scale_factor", structure: "원점 중심의 확대에서 상과 원래 삼각형의 좌표를 비교해 배율을 구함", extra: "easy: 상의 좌표 ÷ 원래 좌표", concepts: ["닮음비", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng, [2, 3]); const f = fig(s, true);
        return geoInst(rng, { stimulus: cgIntro(rng, sc(...s.n, true)), question: rng.pick(["What is the scale factor of the dilation?", "By what factor does the dilation enlarge the triangle?", "Find the scale factor."]), correct: s.k, wrongs: pos([W(s.k + 1, "other", "계산 중 어긋났다."), W(s.k * s.k, "formula_misuse", "제곱했다."), W(s.k - 1 || s.k + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== s.k), verificationJs: figJs({ a: s.n[0] }, f, `${TJS}return ip(kk());`), trace: [[`그림에서 점 ${s.n[0]} 와 ${s.n[0]}′ 의 좌표를 읽는다.`, "Read a point and its image."], [`상의 좌표는 원래 좌표의 ${s.k} 배이다.`, "Compare coordinates."], [`따라서 ${s.k} 이다.`, "State the scale factor."]], variant: "scale_factor_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "image_leg", structure: "확대의 상 삼각형의 한 직각변의 길이를 구함", extra: "medium: 원래 직각변 × 배율", concepts: ["닮음비", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = fig(s, true); const c = s.k * s.a;
        return geoInst(rng, { stimulus: cgIntro(rng, sc(...s.n, true)), question: rng.pick([`What is the length of ${s.n[0]}′${s.n[1]}′?`, `How long is side ${s.n[0]}′${s.n[1]}′ of the larger triangle?`]), correct: c, wrongs: pos([W(s.a, "step_missing", "원래 변을 답했다."), W(s.a + s.k, "formula_misuse", "배율을 더했다."), W(s.k * s.k * s.a, "formula_misuse", "배율을 제곱해 곱했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c), verificationJs: figJs({ a: s.n[0], b: s.n[1] }, f, `${TJS}const A=PA(P.a), B=PA(P.b); return ip(dist(A,B)*kk());`), trace: [[`그림에서 ${s.n[0]}${s.n[1]} = ${s.a} 를 읽는다.`, "Read the original side."], [`배율은 ${s.k} 이다.`, "The scale factor."], [`${s.n[0]}′${s.n[1]}′ = ${s.k} × ${s.a} = ${c} 이다.`, "Scale the side."]], variant: "image_leg_medium" }, f);
      }); },
    },
  ],
});
