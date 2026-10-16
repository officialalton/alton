// circles.sector_area.CM.P — 직사각형 위에 반원이 얹힌 도형의 치수 라벨에서 반원(반원형 부채꼴)의 넓이·도형 전체의 넓이·반지름을 구한다.
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { piFmt } from "../ci-kit";
import { CM_JS, Q_AREA, Q_PI, RECT_SEMI, SPR_NO_CM, cmIntro, exprPi, type CmFig } from "../cm-kit";
import { retry } from "../ext-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const wFig = (w: string, h?: string, r?: string): CmFig => ({ type: "composite", outer: { kind: "rectangle", ...(w ? { width: w } : {}), ...(h ? { height: h } : {}) }, inner: { kind: "semicircle", ...(r ? { radius: r } : {}), }, shaded: "inner", notToScale: true });

const RAW = defineItem({
  prefix: "ci", itemId: "circles.sector_area.CM.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_CM, structure: "직사각형의 너비가 그림에 라벨되고 그 위에 음영 반원이 얹혔을 때 반지름 = 너비/2 로 반원의 넓이 ½πr² 을 구함", extra: "너비가 지름임을 알아 반지름으로 바꾸고 원의 넓이의 절반을 구해야 함(너비를 반지름으로 쓰거나 절반을 빠뜨리면 오답) — medium 은 반지름이 주어짐",
      concepts: ["부채꼴(반원)의 넓이", "지름과 반지름"],
      gen(rng) { return retry(rng, () => {
        const w = 4 * rng.int(1, 7), h = rng.int(3, 20); const f = wFig(String(w), String(h)); const c = (w * w) / 8;
        return geoInst(rng, {
          stimulus: cmIntro(rng, RECT_SEMI, " The semicircle is shaded."), question: Q_PI(rng, "area of the shaded semicircle"), correct: c, fmt: piFmt,
          wrongs: pos([W(w * w / 4, "step_missing", "반원이 아니라 원의 넓이를 답했다."), W(w * w / 2, "formula_misuse", "너비를 반지름으로 썼다."), W(w / 2, "formula_misuse", "호의 길이를 답했다."), W(c * 2, "formula_misuse", "배로 계산했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c && Number.isInteger(x.v)),
          verificationJs: figJs({}, f, `${CM_JS}if (I.kind!=='semicircle') throw new Error('반원 필요'); const w=on('width'); if (!(w>0)) throw new Error('너비 라벨 없음'); const r=w/2; return r*r/2;`),
          trace: [[`그림에서 직사각형의 너비 ${w} 를 읽는다.`, "Read the rectangle's width."], [`반원의 지름 = ${w} 이므로 반지름 = ${w / 2} 이다.`, "Radius is half the width."], [`원의 넓이 = π × ${w / 2}² = ${(w * w) / 4}π 이다.`, "Area of the full circle."], [`반원의 넓이 = ${(w * w) / 4}π ÷ 2 이다.`, "Half of it."], [`따라서 ${c}π 이다.`, "State the area."]], variant: "semicircle_area_from_width",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_CM, structure: "직사각형의 너비·높이가 그림에 라벨되고 반원이 얹혔을 때 도형 전체의 넓이(직사각형 + 반원)를 구함", extra: "반지름 = 너비/2 → 반원의 넓이, 직사각형의 넓이를 각각 구해 더해야 함(반원을 빠뜨리거나 원 전체로 계산하면 오답) — medium 은 반원의 넓이",
      concepts: ["복합 도형의 넓이", "반원", "직사각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const w = 4 * rng.int(1, 6), h = rng.int(3, 18); const f = wFig(String(w), String(h)); const a = w * h, b = (w * w) / 8;
        return geoInst(rng, {
          stimulus: cmIntro(rng, RECT_SEMI, " The region inside the whole shape is shaded."), question: rng.pick([`What is the total area of the shape, in terms of $\\pi$?`, `Find the area of the entire shaded region in terms of $\\pi$.`, `What is the area of the whole figure, in terms of $\\pi$?`]), correctText: exprPi(a, b), evalAt: {},
          wrongTexts: [{ text: exprPi(a, 2 * b), kind: "formula_misuse", reason: "원 전체의 넓이를 더했다." }, { text: exprPi(a, 0), kind: "step_missing", reason: "반원을 빠뜨렸다." }, { text: exprPi(a, 4 * b), kind: "formula_misuse", reason: "너비를 반지름으로 썼다." }, { text: exprPi(a / 2, b), kind: "formula_misuse", reason: "직사각형을 반으로 계산했다." }, { text: exprPi(a, b / 2), kind: "formula_misuse", reason: "반원을 다시 반으로 계산했다." }],
          verificationJs: figJs({}, f, `${CM_JS}const w=on('width'), h=on('height'); if (!(w>0&&h>0)||I.kind!=='semicircle') throw new Error('라벨 오류'); return w*h+(w/2)*(w/2)/2;`),
          trace: [[`그림에서 너비 ${w}, 높이 ${h} 를 읽는다.`, "Read the width and the height."], [`직사각형의 넓이 = ${w} × ${h} = ${a} 이다.`, "Rectangle area."], [`반원의 반지름 ${w / 2} → 넓이 = ${b}π 이다.`, "Semicircle area."], [`전체 = ${a} + ${b}π 이다.`, "Add."], [`따라서 ${a} + ${b}π 이다.`, "State the total."]], variant: "composite_total_area",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_CM, structure: "반원의 반지름이 그림에 라벨될 때 반원의 넓이 ½πr² 을 구함", extra: "반원의 넓이는 πr² 의 절반임을 써야 함(πr² 로 답하면 오답) — medium 은 너비가 주어짐",
      concepts: ["부채꼴(반원)의 넓이", "반지름"],
      gen(rng) { return retry(rng, () => {
        const r = 2 * rng.int(1, 9); const f = wFig("", String(rng.int(3, 20)), String(r)); const c = (r * r) / 2;
        return geoInst(rng, {
          stimulus: cmIntro(rng, RECT_SEMI, " The semicircle is shaded."), question: Q_PI(rng, "area of the shaded semicircle"), correct: c, fmt: piFmt,
          wrongs: pos([W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W(r, "formula_misuse", "호의 길이를 답했다."), W(2 * r * r, "formula_misuse", "지름으로 계산했다."), W(c / 2, "formula_misuse", "4 로 나누었다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c && Number.isInteger(x.v)),
          verificationJs: figJs({}, f, `${CM_JS}const r=inn('radius'); if (!(r>0)||I.kind!=='semicircle') throw new Error('반지름 라벨 없음'); return r*r/2;`),
          trace: [[`그림에서 반원의 반지름 ${r} 을 읽는다.`, "Read the radius."], [`원의 넓이 = π × ${r}² = ${r * r}π 이다.`, "Area of the full circle."], [`반원의 넓이 = ${r * r}π ÷ 2 이다.`, "Half of it."], [`= ${c}π 이다.`, "Compute."], [`따라서 ${c}π 이다.`, "State the area."]], variant: "semicircle_area_from_radius",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "반원의 넓이가 지문에 kπ 로 주어지고 직사각형의 높이가 그림에 있을 때 반지름을 거꾸로 구해 직사각형의 둘레를 구함", extra: "k = r²/2 로 r = √(2k) 를 구하고 너비 2r 로 둘레를 계산해야 함(k 를 반지름으로 쓰면 오답) — medium 은 반지름",
      concepts: ["부채꼴(반원)의 넓이", "역산", "직사각형의 둘레"],
      gen(rng) { return retry(rng, () => {
        const r = 2 * rng.int(1, 8), h = rng.int(3, 18); const k = (r * r) / 2; const f = wFig("w", String(h)); const w = 2 * r;
        return geoInst(rng, {
          stimulus: cmIntro(rng, RECT_SEMI, ` The area of the shaded semicircle is $${k}\\pi$, and the width of the rectangle is labeled $w$.`), question: rng.pick([`What is the perimeter of the rectangle?`, `Find the perimeter of the rectangular part of the shape.`, `How long is the boundary of the rectangle?`]), correct: 2 * (w + h),
          wrongs: pos([W(w * h, "formula_misuse", "넓이를 답했다."), W(2 * (k + h), "formula_misuse", "k 를 너비로 썼다."), W(w + h, "step_missing", "반둘레를 답했다."), W(2 * (r + h), "formula_misuse", "반지름을 너비로 썼다."), W(2 * (w + h) + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== 2 * (w + h) && Number.isInteger(x.v)),
          verificationJs: figJs({ k }, f, `${CM_JS}const h=on('height'); if (!(h>0)||O.width!=='w') throw new Error('라벨 오류'); const r=Math.sqrt(2*P.k); if (Math.abs(r-Math.round(r))>1e-9) throw new Error('반지름 정수 아님'); return 2*(2*Math.round(r)+h);`),
          trace: [[`그림에서 높이 ${h} 를 읽고 반원의 넓이 ${k}π 는 지문에서 안다.`, "Read the height; the semicircle's area is in the text."], [`½πr² = ${k}π 이므로 r² = ${2 * k} 이다.`, "Set up the area equation."], [`r = ${r} 이고 너비 w = 2r = ${w} 이다.`, "The width is the diameter."], [`둘레 = 2 × (${w} + ${h}) 이다.`, "Rectangle perimeter."], [`따라서 ${2 * (w + h)} 이다.`, "State the perimeter."]], variant: "rectangle_perimeter_from_semicircle_area",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "semicircle_area_radius", sprNo: SPR_NO_CM, structure: "반원의 반지름이 그림에 있을 때 반원의 넓이를 구함", extra: "easy: ½πr²", concepts: ["부채꼴(반원)의 넓이", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const r = 2 * rng.int(1, 10); const f = wFig("", String(rng.int(3, 20)), String(r)); const c = (r * r) / 2;
        return geoInst(rng, { stimulus: cmIntro(rng, RECT_SEMI, " The semicircle is shaded."), question: Q_PI(rng, "area of the shaded semicircle"), correct: c, fmt: piFmt, wrongs: pos([W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W(r, "formula_misuse", "호의 길이를 답했다."), W(2 * r * r, "formula_misuse", "지름으로 계산했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c && Number.isInteger(x.v)), verificationJs: figJs({}, f, `${CM_JS}const r=inn('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); return r*r/2;`), trace: [[`그림에서 반지름 ${r} 을 읽는다.`, "Read the radius."], [`반원의 넓이 = ½ × π × ${r}² = ${c}π 이다.`, "Half of πr²."]], variant: "semicircle_area_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "semicircle_area_width", sprNo: SPR_NO_CM, structure: "직사각형의 너비가 그림에 있을 때 반원의 넓이를 구함", extra: "medium: 너비 → 반지름 → 반원의 넓이", concepts: ["부채꼴(반원)의 넓이", "지름과 반지름"],
      gen(rng) { return retry(rng, () => {
        const w = 4 * rng.int(1, 7); const f = wFig(String(w), String(rng.int(3, 20))); const c = (w * w) / 8;
        return geoInst(rng, { stimulus: cmIntro(rng, RECT_SEMI, " The semicircle is shaded."), question: Q_PI(rng, "area of the shaded semicircle"), correct: c, fmt: piFmt, wrongs: pos([W(w * w / 4, "step_missing", "원 전체의 넓이를 답했다."), W(w * w / 2, "formula_misuse", "너비를 반지름으로 썼다."), W(w / 2, "formula_misuse", "호의 길이를 답했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c && Number.isInteger(x.v)), verificationJs: figJs({}, f, `${CM_JS}const w=on('width'); if (!(w>0)) throw new Error('너비 라벨 없음'); return (w/2)*(w/2)/2;`), trace: [[`그림에서 너비 ${w} 를 읽는다.`, "Read the width."], [`반지름 = ${w} ÷ 2 = ${w / 2} 이다.`, "Radius is half the width."], [`반원의 넓이 = ½ × π × ${w / 2}² = ${c}π 이다.`, "Half of πr²."]], variant: "semicircle_area_width_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
void Q_AREA;
