// area_volume.shaded_region_area.CM.P — 정사각형·원이 서로 내접한 음영 영역 그림의 치수 라벨(변·반지름·지름)에서 음영 넓이를 a ± bπ 꼴로 구한다.
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CIRC_SQ, CM_JS, Q_AREA, SPR_NO_CM, SQ_CIRCLE, cmIntro, exprPi, type CmFig } from "../cm-kit";
import { retry } from "../ext-kit";

const sqCirc = (s: string, radius?: string): CmFig => ({ type: "composite", outer: { kind: "square", side: s }, inner: { kind: "circle", ...(radius ? { radius } : {}) }, shaded: "outer_minus_inner" });
const circSq = (o: { radius?: string; diameter?: string }): CmFig => ({ type: "composite", outer: { kind: "circle", ...o }, inner: { kind: "square" }, shaded: "outer_minus_inner" });
const SH = (rng: import("../../../rng").Rng, extra = "") => extra;
const SQ_SH = SQ_CIRCLE.map((t) => `${t} The region inside the square but outside the circle is shaded.`);
const CS_SH = CIRC_SQ.map((t) => `${t} The region inside the circle but outside the square is shaded.`);
const QS = (rng: import("../../../rng").Rng) => rng.pick([`What is the area of the shaded region?`, `Find the area of the shaded region.`, `How large is the shaded area?`, `Determine the area of the shaded region.`, `The shaded region has what area?`]);

const RAW = defineItem({
  prefix: "av", itemId: "area_volume.shaded_region_area.CM.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_CM, structure: "정사각형의 변이 그림에 라벨되고 원이 내접할 때 음영 영역(정사각형 − 원)의 넓이 s² − (s²/4)π 를 구함", extra: "원의 지름 = 변 이라 πr² = (s²/4)π 를 정사각형의 넓이에서 빼야 함(변을 반지름으로 쓰면 오답) — medium 은 원의 넓이",
      concepts: ["음영 영역의 넓이", "내접한 원", "넓이의 차"],
      gen(rng) { return retry(rng, () => {
        const s = 2 * rng.int(2, 12); const f = sqCirc(String(s)); const a = s * s, b = (s * s) / 4;
        return geoInst(rng, {
          stimulus: cmIntro(rng, SQ_SH), question: QS(rng), correctText: exprPi(a, -b), evalAt: {},
          wrongTexts: [{ text: exprPi(a, -4 * b), kind: "geometry_misapplied", reason: "변을 반지름으로 썼다." }, { text: exprPi(a, -2 * b), kind: "formula_misuse", reason: "원의 넓이를 2πr² 로 계산했다." }, { text: exprPi(a / 2, -b), kind: "formula_misuse", reason: "정사각형 넓이를 반으로 계산했다." }, { text: exprPi(0, b), kind: "step_missing", reason: "원의 넓이만 답했다." }, { text: exprPi(a, b), kind: "sign_error", reason: "넓이를 더했다." }],
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='square'||I.kind!=='circle'||FIGURE.shaded!=='outer_minus_inner') throw new Error('정사각형·원·음영 필요'); const s=on('side'); if (!(s>0)) throw new Error('변 라벨 없음'); return s*s-s*s/4;`),
          trace: [[`그림에서 정사각형의 변 ${s} 를 읽는다.`, "Read the square's side."], [`정사각형의 넓이 = ${s}² = ${a} 이다.`, "Area of the square."], [`원의 지름 = 변 = ${s} 이므로 반지름 ${s / 2}, 넓이 = ${b}π 이다.`, "Area of the inscribed circle."], [`음영 = 정사각형 − 원 = ${a} - ${b}π 이다.`, "Shaded = square − circle."], [`따라서 ${a} - ${b}π 이다.`, "State the area."]], variant: "square_minus_circle",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_CM, structure: "원의 반지름이 그림에 라벨되고 정사각형이 내접할 때 정사각형의 대각선 = 지름 으로 넓이 2r² 를 구해 음영(원 − 정사각형) 넓이를 구함", extra: "정사각형의 넓이를 대각선 2r 로 구해(2r²) 원의 넓이 πr² 에서 빼야 함(변을 r 로 쓰면 오답) — medium 은 원의 넓이",
      concepts: ["음영 영역의 넓이", "내접한 정사각형", "대각선"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 12); const f = circSq({ radius: String(r) }); const a = -2 * r * r, b = r * r;
        return geoInst(rng, {
          stimulus: cmIntro(rng, CS_SH), question: QS(rng), correctText: exprPi(a, b), evalAt: {},
          wrongTexts: [{ text: exprPi(-r * r, b), kind: "geometry_misapplied", reason: "정사각형의 변을 r 로 썼다." }, { text: exprPi(-4 * r * r, b), kind: "geometry_misapplied", reason: "정사각형의 넓이를 4r² 으로 계산했다." }, { text: exprPi(2 * r * r, b), kind: "sign_error", reason: "넓이를 더했다." }, { text: exprPi(0, -a), kind: "step_missing", reason: "정사각형을 빠뜨렸다." }, { text: exprPi(a, 2 * b), kind: "formula_misuse", reason: "원의 넓이를 2πr² 로 계산했다." }],
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='circle'||I.kind!=='square'||FIGURE.shaded!=='outer_minus_inner') throw new Error('원·정사각형·음영 필요'); const r=on('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); return r*r-2*r*r;`),
          trace: [[`그림에서 원의 반지름 ${r} 을 읽는다.`, "Read the radius."], [`정사각형의 대각선 = 원의 지름 = ${2 * r} 이다.`, "The square's diagonal is the diameter."], [`정사각형의 넓이 = 대각선² ÷ 2 = ${(2 * r) ** 2} ÷ 2 = ${2 * r * r} 이다.`, "Area from the diagonal."], [`음영 = 원 − 정사각형 = ${r * r}π - ${2 * r * r} 이다.`, "Shaded = circle − square."], [`따라서 ${-2 * r * r} + ${r * r}π 이다.`, "State the area."]], variant: "circle_minus_square",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_CM, structure: "원의 지름이 그림에 라벨되고 정사각형이 내접할 때 지름을 반지름 d/2 로 바꿔 음영(원 − 정사각형) 넓이를 구함", extra: "지름을 반지름으로 바꾸고 정사각형은 대각선 = 지름 으로 구해야 함(지름을 반지름으로 쓰면 오답) — medium 은 반지름이 주어짐",
      concepts: ["음영 영역의 넓이", "지름과 반지름", "내접한 정사각형"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 12), d = 2 * r; const f = circSq({ diameter: String(d) }); const a = -2 * r * r, b = r * r;
        return geoInst(rng, {
          stimulus: cmIntro(rng, CS_SH), question: QS(rng), correctText: exprPi(a, b), evalAt: {},
          wrongTexts: [{ text: exprPi(-2 * d * d, d * d), kind: "geometry_misapplied", reason: "지름을 반지름으로 썼다." }, { text: exprPi(-d * d, b), kind: "formula_misuse", reason: "정사각형의 넓이를 지름² 으로 계산했다." }, { text: exprPi(2 * r * r, b), kind: "sign_error", reason: "넓이를 더했다." }, { text: exprPi(a, d), kind: "formula_misuse", reason: "원의 넓이를 πd 로 계산했다." }, { text: exprPi(-r * r, b), kind: "geometry_misapplied", reason: "정사각형의 변을 r 로 썼다." }],
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='circle'||I.kind!=='square'||FIGURE.shaded!=='outer_minus_inner') throw new Error('원·정사각형·음영 필요'); const d=on('diameter'); if (!(d>0)) throw new Error('지름 라벨 없음'); const r=d/2; return r*r-d*d/2;`),
          trace: [[`그림에서 원의 지름 ${d} 를 읽는다.`, "Read the diameter."], [`반지름 = ${d} ÷ 2 = ${r} 이고 원의 넓이 = ${r * r}π 이다.`, "Radius and circle area."], [`정사각형의 대각선 = 지름 ${d} 이므로 넓이 = ${d}² ÷ 2 = ${2 * r * r} 이다.`, "Square area from its diagonal."], [`음영 = ${r * r}π - ${2 * r * r} 이다.`, "Circle minus square."], [`따라서 ${-2 * r * r} + ${r * r}π 이다.`, "State the area."]], variant: "circle_minus_square_from_diameter",
        }, f);
      }); },
    },
    {
      op: "inverse", sprNo: SPR_NO_CM, structure: "원의 반지름이 그림에 라벨되고 정사각형의 변이 s 일 때 s = 2r 를 거꾸로 구해 음영(정사각형 − 원) 넓이를 구함", extra: "반지름에서 거꾸로 변(= 지름)을 구해 변² − πr² 을 계산해야 함(반지름을 변으로 쓰면 오답) — medium 은 원의 넓이",
      concepts: ["음영 영역의 넓이", "내접한 원", "역산"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 12); const f = sqCirc("s", String(r)); const a = 4 * r * r, b = r * r;
        return geoInst(rng, {
          stimulus: cmIntro(rng, SQ_SH, " The side of the square is labeled $s$."), question: QS(rng), correctText: exprPi(a, -b), evalAt: {},
          wrongTexts: [{ text: exprPi(b, -b), kind: "geometry_misapplied", reason: "반지름을 변으로 썼다." }, { text: exprPi(a, -2 * b), kind: "formula_misuse", reason: "원의 넓이를 2πr² 로 계산했다." }, { text: exprPi(2 * a, -b), kind: "geometry_misapplied", reason: "변을 4r 로 계산했다." }, { text: exprPi(0, b), kind: "step_missing", reason: "원의 넓이만 답했다." }, { text: exprPi(a, -4 * b), kind: "formula_misuse", reason: "지름으로 원의 넓이를 계산했다." }],
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='square'||I.kind!=='circle'||O.side!=='s'||FIGURE.shaded!=='outer_minus_inner') throw new Error('라벨 오류'); const r=inn('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); const s=2*r; return s*s-r*r;`),
          trace: [[`그림에서 원의 반지름 ${r} 을 읽는다.`, "Read the radius."], [`원이 정사각형의 네 변에 닿으므로 s = 2 × ${r} = ${2 * r} 이다.`, "The side equals the diameter."], [`정사각형의 넓이 = ${2 * r}² = ${a} 이다.`, "Square area."], [`원의 넓이 = π × ${r}² = ${b}π 이다.`, "Circle area."], [`음영 = ${a} - ${b}π 이다.`, "Shaded = square − circle."]], variant: "square_minus_circle_from_radius",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "circle_area", sprNo: SPR_NO_CM, structure: "정사각형의 변과 내접한 원이 그림에 있을 때 원의 넓이를 π 로 구함", extra: "easy: 반지름 = 변/2", concepts: ["내접한 원", "원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const s = 2 * rng.int(2, 13); const f = sqCirc(String(s)); const c = (s * s) / 4;
        return geoInst(rng, { stimulus: cmIntro(rng, SQ_SH), question: `What is the area of the unshaded circle, in terms of $\\pi$?`, correctText: exprPi(0, c), evalAt: {}, wrongTexts: [{ text: exprPi(0, s * s), kind: "formula_misuse", reason: "변을 반지름으로 썼다." }, { text: exprPi(0, s), kind: "formula_misuse", reason: "둘레의 계수를 답했다." }, { text: exprPi(0, 2 * c), kind: "formula_misuse", reason: "배로 계산했다." }, { text: exprPi(s * s, 0), kind: "step_missing", reason: "정사각형의 넓이를 답했다." }], verificationJs: figJs({}, f, `${CM_JS}const s=on('side'); if (!(s>0)) throw new Error('변 라벨 없음'); return s*s/4;`), trace: [[`그림에서 정사각형의 변 ${s} 를 읽는다.`, "Read the side."], [`반지름 = ${s / 2} 이므로 넓이 = ${c}π 이다.`, "Area of the inscribed circle."]], variant: "circle_area_easy_cm" }, f);
      }); },
    },
    {
      lv: "medium", name: "square_minus_circle_numeric", sprNo: SPR_NO_CM, structure: "정사각형의 변과 내접한 원이 그림에 있을 때 음영 넓이를 구함", extra: "medium: 정사각형의 넓이 − 원의 넓이", concepts: ["음영 영역의 넓이", "내접한 원"],
      gen(rng) { return retry(rng, () => {
        const s = 2 * rng.int(2, 11); const f = sqCirc(String(s)); const a = s * s, b = (s * s) / 4;
        return geoInst(rng, { stimulus: cmIntro(rng, SQ_SH), question: QS(rng), correctText: exprPi(a, -b), evalAt: {}, wrongTexts: [{ text: exprPi(a, -4 * b), kind: "geometry_misapplied", reason: "변을 반지름으로 썼다." }, { text: exprPi(a, -2 * b), kind: "formula_misuse", reason: "원의 넓이를 2πr² 로 계산했다." }, { text: exprPi(0, b), kind: "step_missing", reason: "원의 넓이만 답했다." }, { text: exprPi(a, b), kind: "sign_error", reason: "넓이를 더했다." }], verificationJs: figJs({}, f, `${CM_JS}const s=on('side'); if (!(s>0)) throw new Error('변 라벨 없음'); return s*s-s*s/4;`), trace: [[`그림에서 정사각형의 변 ${s} 를 읽는다.`, "Read the side."], [`정사각형 ${a}, 원 ${b}π 이다.`, "Areas of the square and the circle."], [`음영 = ${a} - ${b}π 이다.`, "Square minus circle."]], variant: "square_minus_circle_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
void SH; void Q_AREA;
