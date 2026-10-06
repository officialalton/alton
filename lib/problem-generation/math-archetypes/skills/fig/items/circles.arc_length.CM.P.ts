// circles.arc_length.CM.P — 직사각형 위에 반원이 얹힌 도형(창문)의 치수 라벨에서 반원 호의 길이·도형의 둘레·너비를 구한다.
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { piFmt } from "../ci-kit";
import { CM_JS, Q_AREA, Q_PI, RECT_SEMI, SPR_NO_CM, cmIntro, exprPi, type CmFig } from "../cm-kit";
import { retry } from "../ext-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const wFig = (w: string, h?: string, r?: string): CmFig => ({ type: "composite", outer: { kind: "rectangle", ...(w ? { width: w } : {}), ...(h ? { height: h } : {}) }, inner: { kind: "semicircle", ...(r ? { radius: r } : {}) }, shaded: "none", notToScale: true });


const RAW = defineItem({
  prefix: "ci", itemId: "circles.arc_length.CM.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_CM, structure: "직사각형의 너비가 그림에 라벨되고 그 위에 반원이 얹혔을 때 반원의 지름 = 너비 임을 써서 반원 호의 길이 πw/2 를 구함", extra: "너비가 반원의 지름이라는 관계와 반원은 원둘레의 절반임을 함께 써야 함(너비를 반지름으로 쓰거나 원둘레를 답하면 오답) — medium 은 반지름이 주어짐",
      concepts: ["호의 길이", "반원", "지름"],
      gen(rng) { return retry(rng, () => {
        const w = 2 * rng.int(2, 14), h = rng.int(3, 20); const f = wFig(String(w), String(h)); const c = w / 2;
        return geoInst(rng, {
          stimulus: cmIntro(rng, RECT_SEMI), question: Q_PI(rng, "length of the curved part (the semicircular arc)"), correct: c, fmt: piFmt,
          wrongs: pos([W(w, "step_missing", "원 전체의 둘레를 답했다."), W(w * 2, "formula_misuse", "너비를 반지름으로 썼다."), W(c / 2, "formula_misuse", "4 로 나누었다."), W(w * w / 8, "formula_misuse", "반원의 넓이로 계산했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c && Number.isInteger(x.v)),
          verificationJs: figJs({}, f, `${CM_JS}if (O.kind!=='rectangle'||I.kind!=='semicircle') throw new Error('직사각형·반원 필요'); const w=on('width'); if (!(w>0)) throw new Error('너비 라벨 없음'); return w/2;`),
          trace: [[`그림에서 직사각형의 너비 ${w} 를 읽는다.`, "Read the rectangle's width."], [`반원의 지름은 직사각형의 윗변 = ${w} 이다.`, "The semicircle's diameter is the top side."], [`반원의 호 = 원둘레의 절반 = π × ${w} ÷ 2 이다.`, "Half of the circumference."], [`= ${c}π 이다.`, "Compute."], [`따라서 ${c}π 이다.`, "State the arc length."]], variant: "semicircle_arc_from_width",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_CM, structure: "직사각형의 너비·높이가 그림에 라벨되고 반원이 얹혔을 때 윗변을 제외한 도형 둘레(밑변 + 두 높이 + 반원 호)를 구함", extra: "반원의 지름인 윗변은 둘레에서 빠지고 대신 호가 들어감을 알아야 함(윗변까지 더하면 오답) — medium 은 호의 길이",
      concepts: ["호의 길이", "복합 도형의 둘레", "반원"],
      gen(rng) { return retry(rng, () => {
        const w = 2 * rng.int(2, 12), h = rng.int(3, 18); const f = wFig(String(w), String(h)); const a = w + 2 * h, b = w / 2;
        return geoInst(rng, {
          stimulus: cmIntro(rng, RECT_SEMI), question: rng.pick([`What is the distance around the entire shape, in terms of $\\pi$? (The top side of the rectangle is not part of the boundary.)`, `What is the perimeter of the whole shape, in terms of $\\pi$? (The diameter of the semicircle is not part of the boundary.)`, `Find the length of the outer boundary of the shape in terms of $\\pi$. The top side of the rectangle is inside the shape and is not counted.`]), correctText: exprPi(a, b), evalAt: {},
          wrongTexts: [{ text: exprPi(a + w, b), kind: "step_missing", reason: "윗변까지 더했다." }, { text: exprPi(2 * (w + h), 0), kind: "step_missing", reason: "호를 빠뜨렸다." }, { text: exprPi(a, w), kind: "formula_misuse", reason: "원 전체의 둘레를 더했다." }, { text: exprPi(a, w / 4), kind: "formula_misuse", reason: "호를 4 로 나눴다." }, { text: exprPi(w + h, b), kind: "step_missing", reason: "높이를 한 번만 더했다." }],
          verificationJs: figJs({}, f, `${CM_JS}const w=on('width'), h=on('height'); if (!(w>0&&h>0)) throw new Error('라벨 없음'); if (I.kind!=='semicircle') throw new Error('반원 필요'); return w+2*h+w/2;`),
          trace: [[`그림에서 너비 ${w}, 높이 ${h} 를 읽는다.`, "Read the width and the height."], [`반원의 호 = ${w / 2}π 이다.`, "The semicircular arc."], [`경계 = 밑변 ${w} + 두 높이 ${2 * h} + 호 이다.`, "The boundary excludes the top side."], [`= ${a} + ${w / 2}π 이다.`, "Add."], [`따라서 ${a} + ${b}π 이다.`, "State the perimeter."]], variant: "window_perimeter",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_CM, structure: "반원의 반지름이 그림에 라벨될 때 호의 길이 πr 을 구함(반원 = 원둘레의 절반)", extra: "반원의 호는 2πr 의 절반인 πr 임을 써야 함(2πr 로 답하면 오답) — medium 은 너비가 주어짐",
      concepts: ["호의 길이", "반원", "반지름"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 18); const f = wFig("", String(rng.int(3, 20)), String(r));
        return geoInst(rng, {
          stimulus: cmIntro(rng, RECT_SEMI), question: Q_PI(rng, "length of the semicircular arc"), correct: r, fmt: piFmt,
          wrongs: pos([W(2 * r, "step_missing", "원 전체의 둘레를 답했다."), W(r / 2, "formula_misuse", "절반을 두 번 했다."), W(r * r / 2, "formula_misuse", "반원의 넓이로 계산했다."), W(4 * r, "formula_misuse", "지름으로 계산했다."), W(r + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== r && Number.isInteger(x.v)),
          verificationJs: figJs({}, f, `${CM_JS}const r=inn('radius'); if (!(r>0)||I.kind!=='semicircle') throw new Error('반지름 라벨 없음'); return r;`),
          trace: [[`그림에서 반원의 반지름 ${r} 을 읽는다.`, "Read the radius."], [`원둘레 = 2π × ${r} = ${2 * r}π 이다.`, "Circumference of the full circle."], [`반원의 호 = ${2 * r}π ÷ 2 이다.`, "Half of it."], [`= ${r}π 이다.`, "Compute."], [`따라서 ${r}π 이다.`, "State the arc length."]], variant: "semicircle_arc_from_radius",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "반원 호의 길이가 지문에 kπ 로 주어지고 직사각형의 높이가 그림에 있을 때 너비 w 를 거꾸로 구한 뒤 직사각형의 넓이를 구함", extra: "k = w/2 로 거꾸로 w = 2k 를 구해 w × h 를 계산해야 함(k 를 너비로 쓰면 오답) — medium 은 너비",
      concepts: ["호의 길이", "역산", "직사각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const k = rng.int(2, 12), h = rng.int(3, 18); const w = 2 * k; const f = wFig("w", String(h));
        return geoInst(rng, {
          stimulus: cmIntro(rng, RECT_SEMI, ` The length of the semicircular arc is $${k}\\pi$, and the width of the rectangle is labeled $w$.`), question: rng.pick([Q_AREA(rng, "area of the rectangular part of the shape")]), correct: w * h,
          wrongs: pos([W(k * h, "formula_misuse", "호의 계수를 너비로 썼다."), W(w, "step_missing", "너비를 답했다."), W(w * h / 2, "formula_misuse", "반으로 계산했다."), W(2 * (w + h), "formula_misuse", "둘레를 답했다."), W(w * h + h, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== w * h && Number.isInteger(x.v)),
          verificationJs: figJs({ k }, f, `${CM_JS}const h=on('height'); if (!(h>0)||O.width!=='w') throw new Error('라벨 오류'); return 2*P.k*h;`),
          trace: [[`그림에서 높이 ${h} 를 읽고 호의 길이 ${k}π 는 지문에서 안다.`, "Read the height; the arc length is in the text."], [`반원의 호 = πw/2 = ${k}π 이다.`, "Arc length formula."], [`w = 2 × ${k} = ${w} 이다.`, "Solve for the width."], [`직사각형의 넓이 = ${w} × ${h} 이다.`, "Rectangle area."], [`따라서 ${w * h} 이다.`, "State the area."]], variant: "rectangle_area_from_arc",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "semicircle_arc", sprNo: SPR_NO_CM, structure: "직사각형의 너비가 그림에 있을 때 반원 호의 길이를 구함", extra: "easy: 너비의 절반 × π", concepts: ["호의 길이", "반원"],
      gen(rng) { return retry(rng, () => {
        const w = 2 * rng.int(2, 16); const f = wFig(String(w)); const c = w / 2;
        return geoInst(rng, { stimulus: cmIntro(rng, RECT_SEMI), question: Q_PI(rng, "length of the semicircular arc"), correct: c, fmt: piFmt, wrongs: pos([W(w, "step_missing", "원 전체의 둘레를 답했다."), W(2 * w, "formula_misuse", "너비를 반지름으로 썼다."), W(c + 1, "other", "계산 중 어긋났다."), W(c / 2, "formula_misuse", "4 로 나누었다.")]).filter((x) => x.v !== c && Number.isInteger(x.v)), verificationJs: figJs({}, f, `${CM_JS}const w=on('width'); if (!(w>0)) throw new Error('너비 라벨 없음'); return w/2;`), trace: [[`그림에서 너비 ${w} 를 읽는다.`, "Read the width."], [`반원의 호 = π × ${w} ÷ 2 = ${c}π 이다.`, "Half of πd."]], variant: "semicircle_arc_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "radius_arc", sprNo: SPR_NO_CM, structure: "반원의 반지름이 그림에 있을 때 호의 길이를 구함", extra: "medium: πr", concepts: ["호의 길이", "반지름"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 18); const f = wFig("", String(rng.int(3, 20)), String(r));
        return geoInst(rng, { stimulus: cmIntro(rng, RECT_SEMI), question: Q_PI(rng, "length of the semicircular arc"), correct: r, fmt: piFmt, wrongs: pos([W(2 * r, "step_missing", "원 전체의 둘레를 답했다."), W(r / 2, "formula_misuse", "절반을 두 번 했다."), W(r * r / 2, "formula_misuse", "넓이로 계산했다."), W(r + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== r && Number.isInteger(x.v)), verificationJs: figJs({}, f, `${CM_JS}const r=inn('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); return r;`), trace: [[`그림에서 반지름 ${r} 을 읽는다.`, "Read the radius."], [`원둘레 = 2π × ${r} = ${2 * r}π 이다.`, "Circumference of the full circle."], [`반원의 호 = ${2 * r}π ÷ 2 = ${r}π 이다.`, "Half of 2πr."]], variant: "semicircle_arc_radius_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
