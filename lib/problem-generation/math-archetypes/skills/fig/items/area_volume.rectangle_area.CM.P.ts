// area_volume.rectangle_area.CM.P — 바깥 직사각형과 안쪽 직사각형(음영 테두리)의 치수 라벨에서 음영 넓이·미지 치수·비용을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CM_CTX, CM_JS, CM_LEAD, type CmFig } from "../cm-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const fig = (W0: string, H0: string, w: string, h: string): CmFig => ({ type: "composite", outer: { kind: "rectangle", width: W0, height: H0 }, inner: { kind: "rectangle", width: w, height: h, placement: "center" }, shaded: "outer_minus_inner", notToScale: true });
const I = (rng: Rng, extra = "") => `${rng.pick(CM_LEAD)}${rng.pick(CM_CTX)}${rng.pick(["The figure shows a large rectangle with a smaller rectangle inside it; the region between them is shaded.", "A rectangular frame is shown: a smaller rectangle is cut out of a larger rectangle, and the shaded region is what remains.", "In the figure shown, a small rectangle sits inside a large rectangle, and the shaded region lies outside the small rectangle but inside the large one.", "The shaded border in the figure is the part of the large rectangle that is not covered by the small rectangle inside it.", "A picture frame is modeled in the figure shown: the shaded part is the frame, and the unshaded rectangle is the opening.", "The figure shows a rectangular panel with a rectangular window cut out of its middle, and the panel material is shaded.", "A smaller rectangle is placed in the center of a larger rectangle in the figure shown, and everything outside the small rectangle but inside the large one is shaded.", "The large rectangle in the figure has a smaller rectangular hole; the shaded region is the part that remains."])}${extra}`.replace(/ {2,}/g, " ").trim();
const dims = (rng: Rng) => { for (let i = 0; i < 80; i++) { const Wo = rng.int(12, 32), Ho = rng.int(8, 24), w = rng.int(4, Wo - 4), h = rng.int(3, Ho - 3); if (Wo > Ho && w > h && Wo * Ho - w * h > 0) return { Wo, Ho, w, h }; } throw new GenFail("치수"); };

const RAW = defineItem({
  prefix: "av", itemId: "area_volume.rectangle_area.CM.P",
  hard: [
    {
      op: "compose_kind", structure: "바깥 직사각형과 안쪽 직사각형의 치수가 그림에 있을 때 음영 영역(바깥 − 안쪽)의 넓이를 구함", extra: "두 직사각형의 넓이를 각각 구해 빼야 함(바깥의 넓이만 답하거나 테두리 폭으로 계산하면 오답) — medium 은 안쪽의 넓이",
      concepts: ["직사각형의 넓이", "음영 영역", "넓이의 차"],
      gen(rng) { return retry(rng, () => {
        const { Wo, Ho, w, h } = dims(rng); const A = Wo * Ho - w * h; const f = fig(String(Wo), String(Ho), String(w), String(h));
        return geoInst(rng, {
          stimulus: I(rng), question: rng.pick([`What is the area of the shaded region?`, `Find the area of the shaded region.`, `How large is the shaded border?`]), correct: A,
          wrongs: pos([W(Wo * Ho, "step_missing", "바깥의 넓이만 답했다."), W(w * h, "step_missing", "안쪽의 넓이만 답했다."), W((Wo - w) * (Ho - h), "formula_misuse", "치수의 차를 곱했다."), W(2 * (Wo + Ho) - 2 * (w + h), "formula_misuse", "둘레의 차를 답했다."), W(A + w, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== A),
          verificationJs: figJs({}, f, `${CM_JS}const a=on('width')*on('height')-inn('width')*inn('height'); if (!(a>0)) throw new Error('치수 오류'); return a;`),
          trace: [[`그림에서 바깥 ${Wo} × ${Ho}, 안쪽 ${w} × ${h} 를 읽는다.`, "Read the outer and inner dimensions."], [`바깥의 넓이 = ${Wo} × ${Ho} = ${Wo * Ho} 이다.`, "Outer area."], [`안쪽의 넓이 = ${w} × ${h} = ${w * h} 이다.`, "Inner area."], [`음영 = ${Wo * Ho} - ${w * h} 이다.`, "Shaded = outer − inner."], [`따라서 ${A} 이다.`, "State the area."]], variant: "frame_area",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "음영 영역의 넓이가 지문에 주어지고 바깥 직사각형과 안쪽 직사각형의 너비가 그림에 있을 때 안쪽 높이 h 를 거꾸로 구함", extra: "바깥 넓이 − 음영 = 안쪽 넓이 로 거꾸로 구한 뒤 너비로 나눠야 함(음영을 그대로 나누면 오답) — medium 은 음영 넓이",
      concepts: ["직사각형의 넓이", "역산", "음영 영역"],
      gen(rng) { return retry(rng, () => {
        const { Wo, Ho, w, h } = dims(rng); const A = Wo * Ho - w * h; const f = fig(String(Wo), String(Ho), String(w), "h");
        return geoInst(rng, {
          stimulus: I(rng, ` The area of the shaded region is ${A}.`), question: rng.pick([`What is the value of $h$?`, `What is the height $h$ of the inner rectangle?`, `In the figure shown, what is $h$?`]), correct: h,
          wrongs: pos([W(A / w, "step_missing", "음영을 그대로 나누었다."), W((Wo * Ho) / w, "step_missing", "바깥 넓이를 나누었다."), W(Ho - h, "other", "다른 값을 답했다."), W(h + 1, "other", "계산 중 어긋났다."), W(A / (Wo - w), "formula_misuse", "너비의 차로 나누었다.")]).filter((x) => x.v !== h),
          verificationJs: figJs({ A }, f, `${CM_JS}const w=inn('width'); if (!(w>0)||I.height!=='h') throw new Error('라벨 오류'); const hh=(on('width')*on('height')-P.A)/w; if (!(hh>0)||Math.abs(hh-Math.round(hh))>1e-9) throw new Error('h 정수 아님'); return Math.round(hh);`),
          trace: [[`그림에서 바깥 ${Wo} × ${Ho} 와 안쪽 너비 ${w} 를 읽고 음영 넓이 ${A} 는 지문에서 안다.`, "Read the outer rectangle and the inner width; the shaded area is in the text."], [`바깥의 넓이 = ${Wo * Ho} 이다.`, "Outer area."], [`안쪽의 넓이 = ${Wo * Ho} - ${A} = ${w * h} 이다.`, "Inner area = outer − shaded."], [`${w} × h = ${w * h} 이므로 h = ${h} 이다.`, "Solve for h."], [`따라서 ${h} 이다.`, "State h."]], variant: "inner_height_from_shaded_area",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "음영 영역(테두리)의 넓이를 구한 뒤 지문의 단위 면적당 비용을 곱해 총비용을 구함", extra: "음영 넓이를 구하고 단가를 곱하는 연쇄(바깥 전체 넓이에 곱하면 오답) — medium 은 음영 넓이",
      concepts: ["직사각형의 넓이", "음영 영역", "단위 비용"],
      gen(rng) { return retry(rng, () => {
        const { Wo, Ho, w, h } = dims(rng); const A = Wo * Ho - w * h; const k = rng.int(2, 9); if (A * k >= 1000) throw new GenFail("큼"); const f = fig(String(Wo), String(Ho), String(w), String(h));
        return geoInst(rng, {
          stimulus: I(rng, rng.pick([` The shaded region will be painted, and the paint costs ${k} dollars per square unit.`, ` Paint for the shaded region costs ${k} dollars for every square unit covered.`, ` Each square unit of the shaded region is covered with material that costs ${k} dollars.`, ` Covering the shaded region costs ${k} dollars per square unit.`, ` A coating priced at ${k} dollars per square unit is applied only to the shaded region.`])), question: rng.pick([`What is the total cost, in dollars, to paint the shaded region?`, `How many dollars will the paint for the shaded region cost?`, `Find the cost of painting the shaded region.`]), correct: A * k,
          wrongs: pos([W(Wo * Ho * k, "step_missing", "바깥 전체의 넓이에 곱했다."), W(A, "step_missing", "넓이를 답했다."), W(w * h * k, "step_missing", "안쪽의 넓이에 곱했다."), W(A + k, "formula_misuse", "단가를 더했다."), W(A * k + k, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== A * k),
          verificationJs: figJs({ k }, f, `${CM_JS}const a=on('width')*on('height')-inn('width')*inn('height'); if (!(a>0)) throw new Error('치수 오류'); return a*P.k;`),
          trace: [[`그림에서 바깥 ${Wo} × ${Ho}, 안쪽 ${w} × ${h} 를 읽는다.`, "Read the dimensions."], [`음영 넓이 = ${Wo * Ho} - ${w * h} = ${A} 이다.`, "Shaded area."], [`단가는 ${k} 이다.`, "The price per square unit."], [`비용 = ${A} × ${k} 이다.`, "Multiply."], [`따라서 ${A * k} 이다.`, "State the cost."]], variant: "frame_paint_cost",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "안쪽 직사각형의 한 변이 바깥의 절반이라는 지문의 말을 식으로 옮겨 음영 영역의 넓이를 구함", extra: "'절반' 을 안쪽 치수로 번역(w = W/2, h = H/2)해 바깥 − 안쪽 을 계산해야 함(안쪽이 바깥의 절반 넓이라고 읽으면 오답) — medium 은 치수가 직접 주어짐",
      concepts: ["직사각형의 넓이", "문장의 식 번역", "음영 영역"],
      gen(rng) { return retry(rng, () => {
        const Wo = 2 * rng.int(6, 20), Ho = 2 * rng.int(4, 14); if (Wo <= Ho) throw new GenFail("비율"); const w = Wo / 2, h = Ho / 2; const A = Wo * Ho - w * h; const f = fig(String(Wo), String(Ho), "w", "h");
        return geoInst(rng, {
          stimulus: I(rng, rng.pick([" The width and the height of the inner rectangle are each half of the width and the height of the large rectangle.", " Each side of the inner rectangle is exactly half as long as the matching side of the outer rectangle.", " The inner rectangle is built by halving both the width and the height of the outer rectangle.", " Both dimensions of the small rectangle equal one half of the corresponding dimensions of the large rectangle.", " The unshaded rectangle has half the width and half the height of the whole figure."])), question: rng.pick([`What is the area of the shaded region?`, `Find the area of the shaded region.`]), correct: A,
          wrongs: pos([W((Wo * Ho) / 2, "formula_misuse", "안쪽 넓이를 바깥의 절반으로 계산했다."), W(Wo * Ho, "step_missing", "바깥의 넓이만 답했다."), W(w * h, "step_missing", "안쪽의 넓이만 답했다."), W(A + w, "other", "계산 중 어긋났다."), W((Wo * Ho * 2) / 3, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== A),
          verificationJs: figJs({}, f, `${CM_JS}if (I.width!=='w'||I.height!=='h') throw new Error('안쪽 라벨 오류'); const a=on('width')*on('height'); return a-(on('width')/2)*(on('height')/2);`),
          trace: [[`그림에서 바깥 ${Wo} × ${Ho} 를 읽는다.`, "Read the outer dimensions."], [`안쪽 너비 w = ${Wo} ÷ 2 = ${w}, 높이 h = ${Ho} ÷ 2 = ${h} 이다.`, "Translate 'half' into the inner dimensions."], [`안쪽의 넓이 = ${w} × ${h} = ${w * h} 이다.`, "Inner area."], [`음영 = ${Wo * Ho} - ${w * h} = ${A} 이다.`, "Outer minus inner."], [`따라서 ${A} 이다.`, "State the area."]], variant: "frame_area_from_half_words",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "inner_area", structure: "안쪽 직사각형의 치수가 그림에 있을 때 안쪽 넓이를 구함", extra: "easy: 너비 × 높이", concepts: ["직사각형의 넓이", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const { Wo, Ho, w, h } = dims(rng); const f = fig(String(Wo), String(Ho), String(w), String(h));
        return geoInst(rng, { stimulus: I(rng), question: rng.pick([`What is the area of the inner rectangle?`, `Find the area of the small unshaded rectangle.`]), correct: w * h, wrongs: pos([W(Wo * Ho, "step_missing", "바깥의 넓이를 답했다."), W(Wo * Ho - w * h, "step_missing", "음영의 넓이를 답했다."), W(2 * (w + h), "formula_misuse", "둘레를 답했다."), W(w * h + w, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== w * h), verificationJs: figJs({}, f, `${CM_JS}return inn('width')*inn('height');`), trace: [[`그림에서 안쪽 ${w} × ${h} 를 읽는다.`, "Read the inner dimensions."], [`넓이 = ${w} × ${h} = ${w * h} 이다.`, "Area = width × height."]], variant: "inner_area_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "shaded_area", structure: "안쪽·바깥 직사각형의 치수가 그림에 있을 때 음영 넓이를 구함", extra: "medium: 두 넓이의 차", concepts: ["직사각형의 넓이", "음영 영역"],
      gen(rng) { return retry(rng, () => {
        const { Wo, Ho, w, h } = dims(rng); const A = Wo * Ho - w * h; const f = fig(String(Wo), String(Ho), String(w), String(h));
        return geoInst(rng, { stimulus: I(rng), question: rng.pick([`What is the area of the shaded region?`, `Find the area of the shaded border.`]), correct: A, wrongs: pos([W(Wo * Ho, "step_missing", "바깥의 넓이를 답했다."), W(w * h, "step_missing", "안쪽의 넓이를 답했다."), W((Wo - w) * (Ho - h), "formula_misuse", "치수의 차를 곱했다."), W(A + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== A), verificationJs: figJs({}, f, `${CM_JS}return on('width')*on('height')-inn('width')*inn('height');`), trace: [[`그림에서 바깥 ${Wo} × ${Ho}, 안쪽 ${w} × ${h} 를 읽는다.`, "Read the dimensions."], [`음영 = ${Wo * Ho} - ${w * h} = ${A} 이다.`, "Outer minus inner."], [`따라서 ${A} 이다.`, "State the area."]], variant: "shaded_area_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
