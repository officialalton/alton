// area_volume.prism_missing_dimension.SO.P — 직육면체 그림에서 한 치수가 미지수 x 로 라벨되고 부피가 지문에 있을 때 미지의 치수·겉넓이·정사각형 밑변을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { PRISM_SCENES, SO_JS, soFig, soIntro } from "../so-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const dims3 = (rng: Rng) => { for (let i = 0; i < 60; i++) { const l = rng.int(4, 20), w = rng.int(3, 14), h = rng.int(2, 12); if (l > w && l * w * h < 1000 && l * w * h >= 24) return { l, w, h }; } throw new GenFail("치수"); };
const QX = (rng: Rng) => rng.pick(["What is the value of $x$?", "In the figure shown, what is $x$?", "Find the value of $x$.", "What number does $x$ represent?", "Determine $x$."]);
const VOLS = (V: number) => rng2(V);
function rng2(V: number) { return V; }

const RAW = defineItem({
  prefix: "av", itemId: "area_volume.prism_missing_dimension.SO.P",
  hard: [
    {
      op: "compose_kind", structure: "직육면체의 두 치수가 그림에 있고 높이가 x 이며 부피가 지문에 있을 때 x = V ÷ (l w) 로 높이를 구함", extra: "부피를 밑면의 넓이로 나눠야 함(l 로만 나누거나 부피에서 빼면 오답) — medium 은 밑면이 주어짐",
      concepts: ["직육면체의 부피", "역산", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const V = l * w * h; const f = soFig("rectangular_prism", { length: String(l), width: String(w), height: "x" });
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, ` The volume of the prism is ${V} cubic units.`), question: QX(rng), correct: h,
          wrongs: pos([W(V / l, "step_missing", "너비로 나누지 않았다."), W(V / (l + w), "formula_misuse", "밑면의 합으로 나누었다."), W(V - l * w, "formula_misuse", "밑면의 넓이를 빼서 구했다."), W(h + 1, "other", "계산 중 어긋났다."), W(V / (l * w) + w, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== h),
          verificationJs: figJs({ V }, f, `${SO_JS}const l=d('length'), w=d('width'); if (!(l>0&&w>0)||D.height!=='x') throw new Error('라벨 오류'); const x=P.V/(l*w); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return Math.round(x);`),
          trace: [[`그림에서 길이 ${l}, 너비 ${w}, 높이 x 를 읽고 부피 ${V} 는 지문에서 안다.`, "Read the labels; the volume is in the text."], [`밑면의 넓이 = ${l} × ${w} = ${l * w} 이다.`, "Base area."], [`${V} = ${l * w} × x 이다.`, "Volume equation."], [`x = ${V} ÷ ${l * w} 이다.`, "Divide."], [`따라서 ${h} 이다.`, "State x."]], variant: "missing_height",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "직육면체의 높이 x 를 부피로 구한 뒤 겉넓이 2(lw + lx + wx) 를 구함", extra: "x → 세 면의 넓이 쌍의 합 의 연쇄(부피를 답하거나 한 면만 계산하면 오답) — medium 은 x",
      concepts: ["직육면체의 부피", "겉넓이", "역산"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const V = l * w * h; const SA = 2 * (l * w + l * h + w * h); const f = soFig("rectangular_prism", { length: String(l), width: String(w), height: "x" });
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, ` The volume of the prism is ${V} cubic units.`), question: rng.pick(["What is the surface area of the prism?", "Find the total surface area of the prism.", "How large is the surface area of the solid?"]), correct: SA,
          wrongs: pos([W(l * w + l * h + w * h, "formula_misuse", "2 를 곱하지 않았다."), W(V, "step_missing", "부피를 답했다."), W(2 * l * w, "step_missing", "두 밑면만 더했다."), W(2 * (l * h + w * h), "step_missing", "옆면만 더했다."), W(SA + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== SA),
          verificationJs: figJs({ V }, f, `${SO_JS}const l=d('length'), w=d('width'); if (!(l>0&&w>0)||D.height!=='x') throw new Error('라벨 오류'); const x=P.V/(l*w); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return 2*(l*w+l*x+w*x);`),
          trace: [[`그림에서 길이 ${l}, 너비 ${w} 를 읽고 부피 ${V} 는 지문에서 안다.`, "Read the labels; the volume is in the text."], [`x = ${V} ÷ (${l} × ${w}) = ${h} 이다.`, "Find the height."], [`겉넓이 = 2(lw + lx + wx) 이다.`, "Surface area formula."], [`= 2(${l * w} + ${l * h} + ${w * h}) 이다.`, "Substitute."], [`따라서 ${SA} 이다.`, "State the surface area."]], variant: "surface_area_after_missing_height",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "치수가 센티미터로 그림에 있고 부피가 지문에 리터로 주어질 때 1 L = 1000 cm³ 로 바꿔 높이 x 를 구함", extra: "리터를 입방센티미터로 환산(× 1000)한 뒤 밑면의 넓이로 나눠야 함(환산을 빠뜨리면 오답) — medium 은 같은 단위",
      concepts: ["직육면체의 부피", "단위 환산", "역산"],
      gen(rng) { return retry(rng, () => {
        const all: [number, number, number][] = []; for (let l0 = 20; l0 <= 60; l0 += 1) for (let w0 = 4; w0 <= 14; w0++) for (let x0 = 2; x0 <= 30; x0++) if ((l0 * w0 * x0) % 1000 === 0 && (l0 * w0 * x0) / 1000 <= 60) all.push([l0, w0, x0]); const [l, w, x] = rng.pick(all); const cm3 = l * w * x; const L = cm3 / 1000; const f = soFig("rectangular_prism", { length: `${l}`, width: `${w}`, height: "x" });
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, ` The length, width, and height are in centimeters. The tank holds exactly ${L} liters, and 1 liter is 1000 cubic centimeters.`), question: QX(rng), correct: x,
          wrongs: pos([W(L / (l * w), "unit_error", "리터를 환산하지 않았다."), W(cm3 / l, "step_missing", "너비로 나누지 않았다."), W(Math.round(L * 100 / (l * w)) + 3, "unit_error", "환산을 잘못했다."), W(x + 1, "other", "계산 중 어긋났다."), W(x + 2, "other", "계산 중 어긋났다."), W(cm3 / (l + w), "formula_misuse", "합으로 나누었다.")]).filter((v) => v.v !== x),
          verificationJs: figJs({ L }, f, `${SO_JS}const l=d('length'), w=d('width'); if (!(l>0&&w>0)||D.height!=='x') throw new Error('라벨 오류'); const x=P.L*1000/(l*w); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return Math.round(x);`),
          trace: [[`그림에서 길이 ${l} cm, 너비 ${w} cm 를 읽고 용량 ${L} 리터는 지문에서 안다.`, "Read the labels; the capacity is in the text."], [`${L} 리터 = ${L} × 1000 = ${cm3} cm³ 이다.`, "Convert liters to cubic centimeters."], [`밑면의 넓이 = ${l} × ${w} = ${l * w} 이다.`, "Base area."], [`x = ${cm3} ÷ ${l * w} 이다.`, "Divide."], [`따라서 ${x} 이다.`, "State x."]], variant: "missing_height_liters",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "밑면이 정사각형(길이 = 너비 = s)이고 높이와 부피가 주어질 때 s² = V ÷ h 로 거꾸로 밑변 s 를 구함", extra: "부피를 높이로 나눈 뒤 제곱근을 취해야 함(제곱근을 빠뜨리거나 나누지 않으면 오답) — medium 은 밑면의 넓이",
      concepts: ["직육면체의 부피", "제곱근", "역산"],
      gen(rng) { return retry(rng, () => {
        const s = rng.int(3, 14), h = rng.int(2, 12); const V = s * s * h; if (V >= 1000) throw new GenFail("큼"); const f = soFig("rectangular_prism", { length: "s", width: "s", height: String(h) });
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, ` The base of the prism is a square, and the volume of the prism is ${V} cubic units.`), question: rng.pick(["What is the value of $s$?", "In the figure shown, what is $s$?", "Find the side length $s$ of the square base."]), correct: s,
          wrongs: pos([W(V / h, "step_missing", "제곱근을 취하지 않았다."), W(V / (2 * h), "formula_misuse", "2 로 나누었다."), W(V / h / 2, "formula_misuse", "밑면의 넓이를 반으로 나누었다."), W(s + 1, "other", "계산 중 어긋났다."), W(V - h, "formula_misuse", "빼서 구했다.")]).filter((x) => x.v !== s),
          verificationJs: figJs({ V }, f, `${SO_JS}const h=d('height'); if (!(h>0)||D.length!=='s'||D.width!=='s') throw new Error('라벨 오류'); const a=P.V/h; const s=Math.sqrt(a); if (Math.abs(s-Math.round(s))>1e-9) throw new Error('정수 아님'); return Math.round(s);`),
          trace: [[`그림에서 높이 ${h} 를 읽고 부피 ${V} 는 지문에서 안다.`, "Read the height; the volume is in the text."], [`밑면의 넓이 = V ÷ 높이 = ${V} ÷ ${h} = ${s * s} 이다.`, "Base area."], [`밑면이 정사각형이므로 s² = ${s * s} 이다.`, "The base is a square."], [`s = √${s * s} 이다.`, "Take the square root."], [`따라서 ${s} 이다.`, "State s."]], variant: "square_base_side",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "height_from_base_area", structure: "밑면의 넓이와 높이 x 가 라벨된 직육면체에서 부피가 주어질 때 x 를 구함", extra: "easy: V ÷ 밑면", concepts: ["직육면체의 부피", "역산"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const V = l * w * h; const f = soFig("rectangular_prism", { length: String(l), width: String(w), height: "x" });
        return geoInst(rng, { stimulus: soIntro(rng, PRISM_SCENES, ` The volume is ${V} cubic units.`), question: QX(rng), correct: h, wrongs: pos([W(V / l, "step_missing", "너비로 나누지 않았다."), W(V - l * w, "formula_misuse", "빼서 구했다."), W(h + 1, "other", "계산 중 어긋났다."), W(V / (l + w), "formula_misuse", "합으로 나누었다.")]).filter((x) => x.v !== h), verificationJs: figJs({ V }, f, `${SO_JS}const l=d('length'), w=d('width'); if (!(l>0&&w>0)) throw new Error('치수 라벨 없음'); const x=P.V/(l*w); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return Math.round(x);`), trace: [[`그림에서 ${l}, ${w} 를 읽고 부피 ${V} 를 안다.`, "Read the labels; the volume is given."], [`x = ${V} ÷ (${l} × ${w}) = ${h} 이다.`, "Divide by the base area."]], variant: "missing_height_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "missing_length", structure: "너비·높이가 라벨되고 길이가 x 인 직육면체에서 부피로 x 를 구함", extra: "medium: V ÷ (w h)", concepts: ["직육면체의 부피", "역산"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const V = l * w * h; const f = soFig("rectangular_prism", { length: "x", width: String(w), height: String(h) });
        return geoInst(rng, { stimulus: soIntro(rng, PRISM_SCENES, ` The volume is ${V} cubic units.`), question: QX(rng), correct: l, wrongs: pos([W(V / w, "step_missing", "높이로 나누지 않았다."), W(V / (w + h), "formula_misuse", "합으로 나누었다."), W(l + 1, "other", "계산 중 어긋났다."), W(V - w * h, "formula_misuse", "빼서 구했다.")]).filter((x) => x.v !== l), verificationJs: figJs({ V }, f, `${SO_JS}const w=d('width'), h=d('height'); if (!(w>0&&h>0)||D.length!=='x') throw new Error('라벨 오류'); const x=P.V/(w*h); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return Math.round(x);`), trace: [[`그림에서 너비 ${w}, 높이 ${h} 를 읽고 부피 ${V} 를 안다.`, "Read the labels; the volume is given."], [`옆면의 넓이 w × h = ${w * h} 이다.`, "w times h."], [`x = ${V} ÷ ${w * h} = ${l} 이다.`, "Divide."]], variant: "missing_length_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
void VOLS;
