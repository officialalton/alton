// circles.circumference_radius.CM.P — 정사각형에 내접한 원(또는 원의 지름) 그림의 치수 라벨에서 원의 둘레·넓이·정사각형과의 차를 π 로 구한다.
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { piFmt } from "../ci-kit";
import { CM_JS, SPR_NO_CM, SQ_CIRCLE, cmIntro, exprPi, type CmFig } from "../cm-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const posT = (ws: { text: string; kind: import("../../../../review").DistractorKind; reason: string }[]) => ws;
const sqFig = (side: string, shaded: CmFig["shaded"] = "none"): CmFig => ({ type: "composite", outer: { kind: "square", side }, inner: { kind: "circle" }, shaded });
const circDiamFig = (d: string): CmFig => ({ type: "composite", outer: { kind: "circle", diameter: d }, inner: { kind: "square" }, shaded: "none" });
const Q = (rng: Rng, what: string) => rng.pick([`What is the ${what}, in terms of $\\pi$?`, `Find the ${what} in terms of $\\pi$.`, `The ${what} is how many units, in terms of $\\pi$?`]);
const CS = ["The figure shows a square drawn inside a circle; each vertex of the square lies on the circle, and the diameter of the circle is labeled.", "A circle with a labeled diameter is shown in the figure, with a square inscribed in it.", "In the figure shown, a square is inscribed in a circle whose diameter is labeled."];

const RAW = defineItem({
  prefix: "ci", itemId: "circles.circumference_radius.CM.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_CM, structure: "정사각형의 변이 그림에 라벨되고 원이 그 안에 내접할 때 원의 지름 = 변 임을 써서 원의 둘레 πs 를 구함", extra: "내접한 원의 지름이 정사각형의 변과 같다는 관계를 알아야 함(변을 반지름으로 쓰면 오답) — medium 은 원의 넓이",
      concepts: ["내접한 원", "원의 둘레", "지름"],
      gen(rng) { return retry(rng, () => {
        const s = 2 * rng.int(2, 14); const f = sqFig(String(s));
        return geoInst(rng, {
          stimulus: cmIntro(rng, SQ_CIRCLE), question: Q(rng, "circumference of the circle"), correct: s, fmt: piFmt,
          wrongs: pos([W(2 * s, "formula_misuse", "변을 반지름으로 썼다."), W(s / 2, "formula_misuse", "πr 로 계산했다."), W(s * s / 4, "formula_misuse", "넓이로 계산했다."), W(4 * s, "formula_misuse", "정사각형의 둘레를 답했다."), W(s + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== s && Number.isInteger(x.v)),
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='square'||I.kind!=='circle') throw new Error('정사각형·원 필요'); const s=on('side'); if (!(s>0)) throw new Error('변 라벨 없음'); return s;`),
          trace: [[`그림에서 정사각형의 변 ${s} 를 읽는다.`, "Read the square's side."], [`원이 정사각형의 네 변에 닿으므로 원의 지름 = 변 = ${s} 이다.`, "The circle's diameter equals the square's side."], [`둘레 = π × ${s} 이다.`, "Circumference = πd."], [`= ${s}π 이다.`, "Compute."], [`따라서 ${s}π 이다.`, "State the circumference."]], variant: "circumference_from_square_side",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "원의 반지름이 그림에 라벨되고 정사각형의 변이 s 일 때 s = 지름 = 2r 로 거꾸로 구해 정사각형의 넓이를 구함", extra: "반지름에서 지름(= 변)을 구해 제곱해야 함(반지름을 변으로 쓰면 오답) — medium 은 원의 넓이",
      concepts: ["내접한 원", "지름과 반지름", "정사각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 14); const f: CmFig = { type: "composite", outer: { kind: "square", side: "s" }, inner: { kind: "circle", radius: String(r) }, shaded: "none" };
        return geoInst(rng, {
          stimulus: cmIntro(rng, SQ_CIRCLE, " The side length of the square is labeled $s$."), question: rng.pick([`What is the area of the square?`, `Find the area of the square.`, `How large is the area of the square surrounding the circle?`]), correct: 4 * r * r,
          wrongs: pos([W(r * r, "formula_misuse", "반지름을 변으로 썼다."), W(2 * r, "step_missing", "변을 답했다."), W(8 * r, "formula_misuse", "정사각형의 둘레를 답했다."), W(2 * r * r, "formula_misuse", "계산을 잘못했다."), W(4 * r * r + 4, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== 4 * r * r && Number.isInteger(x.v)),
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='square'||I.kind!=='circle'||O.side!=='s') throw new Error('라벨 오류'); const r=inn('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); const s=2*r; return s*s;`),
          trace: [[`그림에서 원의 반지름 ${r} 을 읽는다.`, "Read the circle's radius."], [`원이 정사각형의 네 변에 닿으므로 변 s = 지름 = 2 × ${r} = ${2 * r} 이다.`, "The side equals the diameter."], [`정사각형의 넓이 = s² = ${2 * r}² 이다.`, "Area of the square."], [`= ${4 * r * r} 이다.`, "Compute."], [`따라서 ${4 * r * r} 이다.`, "State the area."]], variant: "square_area_from_circle_radius",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_CM, structure: "원의 지름이 그림에 라벨되고 정사각형이 내접할 때 반지름 d ÷ 2 로 바꿔 원의 넓이를 π 로 구함", extra: "지름을 반지름으로 바꿔 πr² 을 계산해야 함(지름을 제곱하면 오답) — medium 은 둘레",
      concepts: ["원의 넓이", "지름과 반지름", "내접한 정사각형"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 13), d = 2 * r; const f = circDiamFig(String(d));
        return geoInst(rng, {
          stimulus: cmIntro(rng, CS), question: Q(rng, "area of the circle"), correct: r * r, fmt: piFmt,
          wrongs: pos([W(d * d, "formula_misuse", "지름을 제곱했다."), W(d, "formula_misuse", "둘레의 계수를 답했다."), W(r, "step_missing", "반지름을 답했다."), W(2 * r * r, "formula_misuse", "정사각형의 넓이를 답했다."), W(r * r + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== r * r),
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='circle'||I.kind!=='square') throw new Error('원·정사각형 필요'); const d=on('diameter'); if (!(d>0)) throw new Error('지름 라벨 없음'); return (d/2)*(d/2);`),
          trace: [[`그림에서 원의 지름 ${d} 를 읽는다.`, "Read the diameter."], [`반지름 = ${d} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."], [`넓이 = πr² 이다.`, "Area formula."], [`= π × ${r}² = ${r * r}π 이다.`, "Compute."], [`따라서 ${r * r}π 이다.`, "State the area."]], variant: "circle_area_from_diameter_with_square",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_CM, structure: "정사각형의 변과 내접한 원이 그림에 있을 때 정사각형의 둘레와 원의 둘레의 차 4s − πs 를 구함", extra: "정사각형의 둘레 4s 와 원의 둘레 πs 를 각각 구해 빼야 함(변을 반지름으로 쓰거나 둘레를 더하면 오답) — medium 은 원의 둘레",
      concepts: ["내접한 원", "둘레", "넓이의 차"],
      gen(rng) { return retry(rng, () => {
        const s = 2 * rng.int(2, 12); const f = sqFig(String(s));
        return geoInst(rng, {
          stimulus: cmIntro(rng, SQ_CIRCLE), question: rng.pick([`How much greater is the perimeter of the square than the circumference of the circle, in terms of $\\pi$?`, `What is the perimeter of the square minus the circumference of the circle, in terms of $\\pi$?`]), correctText: exprPi(4 * s, -s), evalAt: {},
          wrongTexts: [{ text: exprPi(4 * s, -2 * s), kind: "formula_misuse", reason: "변을 반지름으로 썼다." }, { text: exprPi(4 * s, s), kind: "sign_error", reason: "둘레를 더했다." }, { text: exprPi(2 * s, -s), kind: "formula_misuse", reason: "정사각형의 둘레를 2s 로 계산했다." }, { text: exprPi(s, -s / 2), kind: "formula_misuse", reason: "반지름으로 계산했다." }, { text: exprPi(4 * s, -s / 2), kind: "formula_misuse", reason: "πr 로 계산했다." }],
          verificationJs: figJs({}, f, `${CM_JS}const s=on('side'); if (!(s>0)) throw new Error('변 라벨 없음'); return 4*s-s;`),
          trace: [[`그림에서 정사각형의 변 ${s} 를 읽는다.`, "Read the square's side."], [`정사각형의 둘레 = 4 × ${s} = ${4 * s} 이다.`, "Perimeter of the square."], [`원의 지름 = 변 = ${s} 이므로 둘레 = ${s}π 이다.`, "Circumference of the inscribed circle."], [`차 = ${4 * s} - ${s}π 이다.`, "Subtract."], [`따라서 ${4 * s} - ${s}π 이다.`, "State the difference."]], variant: "perimeter_minus_circumference",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "circumference", sprNo: SPR_NO_CM, structure: "정사각형의 변과 내접한 원이 그림에 있을 때 원의 둘레를 π 로 구함", extra: "easy: 지름 = 변", concepts: ["내접한 원", "원의 둘레"],
      gen(rng) { return retry(rng, () => {
        const s = rng.int(3, 24); const f = sqFig(String(s));
        return geoInst(rng, { stimulus: cmIntro(rng, SQ_CIRCLE), question: Q(rng, "circumference of the circle"), correct: s, fmt: piFmt, wrongs: pos([W(2 * s, "formula_misuse", "변을 반지름으로 썼다."), W(4 * s, "formula_misuse", "정사각형의 둘레를 답했다."), W(s / 2, "formula_misuse", "πr 로 계산했다."), W(s + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== s && Number.isInteger(x.v)), verificationJs: figJs({}, f, `${CM_JS}const s=on('side'); if (!(s>0)) throw new Error('변 라벨 없음'); return s;`), trace: [[`그림에서 정사각형의 변 ${s} 를 읽는다.`, "Read the side."], [`원의 지름 = ${s} 이므로 둘레 = ${s}π 이다.`, "Circumference = πd."]], variant: "circumference_easy_cm" }, f);
      }); },
    },
    {
      lv: "medium", name: "area", sprNo: SPR_NO_CM, structure: "정사각형의 변과 내접한 원이 그림에 있을 때 원의 넓이를 π 로 구함", extra: "medium: 반지름 = 변/2", concepts: ["내접한 원", "원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const s = 2 * rng.int(2, 13); const f = sqFig(String(s)); const c = (s * s) / 4;
        return geoInst(rng, { stimulus: cmIntro(rng, SQ_CIRCLE), question: Q(rng, "area of the circle"), correct: c, fmt: piFmt, wrongs: pos([W(s * s, "formula_misuse", "변을 반지름으로 썼다."), W(s, "formula_misuse", "둘레의 계수를 답했다."), W(c * 2, "formula_misuse", "배로 계산했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c && Number.isInteger(x.v)), verificationJs: figJs({}, f, `${CM_JS}const s=on('side'); if (!(s>0)) throw new Error('변 라벨 없음'); return (s/2)*(s/2);`), trace: [[`그림에서 정사각형의 변 ${s} 를 읽는다.`, "Read the side."], [`반지름 = ${s} ÷ 2 = ${s / 2} 이다.`, "Radius is half the side."], [`넓이 = π × ${s / 2}² = ${c}π 이다.`, "Area = πr²."]], variant: "area_medium_cm" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
void posT;
