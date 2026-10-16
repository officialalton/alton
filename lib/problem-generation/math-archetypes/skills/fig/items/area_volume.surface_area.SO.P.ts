// area_volume.surface_area.SO.P — 직육면체·정육면체·원기둥 그림의 라벨에서 겉넓이를 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CUBE_SCENES, CYL_SCENES, PRISM_SCENES, SO_JS, SPR_NO_PI_SO, piFmt, soFig, soIntro } from "../so-kit";
import { retry } from "../ext-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const QS = (rng: { pick<T>(a: T[]): T }) => rng.pick(["What is the surface area of the solid?", "Find the total surface area of the solid.", "Determine the surface area of the solid shown.", "How large is the surface area of the solid?", "Calculate the total area of all the faces."]);
const QX = (rng: { pick<T>(a: T[]): T }) => rng.pick(["What is the value of $x$?", "In the figure shown, what is $x$?", "Find the value of $x$.", "What number does $x$ represent?", "Determine $x$."]);
const dims3 = (rng: { int(a: number, b: number): number }) => { for (let i = 0; i < 60; i++) { const l = rng.int(4, 14), w = rng.int(3, 10), h = rng.int(2, 9); if (l > w && 2 * (l * w + l * h + w * h) < 1000) return { l, w, h }; } throw new GenFail("치수"); };

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.surface_area.SO.P",
  hard: [
    {
      op: "compose_kind", structure: "직육면체의 길이·너비·높이가 그림에 있을 때 여섯 면의 넓이를 쌍으로 묶어 겉넓이 2(lw + lh + wh) 를 구함", extra: "세 쌍의 면의 넓이를 모두 더하고 2 배 해야 함(2 를 곱하지 않거나 한 쌍을 빠뜨리면 오답) — medium 은 두 쌍의 합",
      concepts: ["직육면체의 겉넓이", "면의 넓이"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const f = soFig("rectangular_prism", { length: String(l), width: String(w), height: String(h) }); const c = 2 * (l * w + l * h + w * h);
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES), question: QS(rng), correct: c,
          wrongs: pos([W(l * w * h, "formula_misuse", "부피를 답했다."), W(l * w + l * h + w * h, "step_missing", "2 를 곱하지 않았다."), W(2 * (l * w + l * h), "step_missing", "한 쌍의 면을 빠뜨렸다."), W(2 * (l + w + h), "formula_misuse", "모서리의 합으로 계산했다."), W(c + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({}, f, `${SO_JS}if (K!=='rectangular_prism') throw new Error('직육면체 필요'); const l=d('length'), w=d('width'), h=d('height'); if (!(l>0&&w>0&&h>0)) throw new Error('라벨 오류'); return 2*(l*w+l*h+w*h);`),
          trace: [[`그림에서 길이 ${l}, 너비 ${w}, 높이 ${h} 를 읽는다.`, "Read the labels."], [`위·아래 면의 넓이 = 2 × ${l} × ${w} = ${2 * l * w} 이다.`, "Top and bottom."], [`앞·뒤 면의 넓이 = 2 × ${l} × ${h} = ${2 * l * h} 이다.`, "Front and back."], [`양 옆 면의 넓이 = 2 × ${w} × ${h} = ${2 * w * h} 이다.`, "Left and right."], [`따라서 ${2 * l * w} + ${2 * l * h} + ${2 * w * h} = ${c} 이다.`, "Add the three pairs."]], variant: "prism_surface_area",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "정육면체의 모서리가 그림에 있고 지문에서 '바닥 면만 빼고 모든 면을 칠한다' 고 할 때 다섯 면의 넓이 5e² 을 구함", extra: "한 면의 넓이를 구하고 6 이 아니라 5 를 곱해야 함(6 을 곱하거나 모서리만 곱하면 오답) — medium 은 한 면의 넓이",
      concepts: ["정육면체의 겉넓이", "한 면의 넓이"],
      gen(rng) { return retry(rng, () => {
        const e = rng.int(2, 14); const f = soFig("cube", { edge: String(e) }); const c = 5 * e * e; const open = rng.pick(["bottom face", "top face"]);
        return geoInst(rng, {
          stimulus: soIntro(rng, CUBE_SCENES, ` Every face is painted except the ${open}.`), question: rng.pick(["What is the total area that is painted?", "How large is the painted area?", "Find the area of the painted part of the solid."]), correct: c,
          wrongs: pos([W(6 * e * e, "step_missing", "여섯 면 모두 더했다."), W(e * e, "step_missing", "한 면의 넓이만 답했다."), W(5 * e, "formula_misuse", "모서리에 5 를 곱했다."), W(4 * e * e, "step_missing", "옆면 네 개만 더했다."), W(c + e, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({}, f, `${SO_JS}if (K!=='cube') throw new Error('정육면체 필요'); const e=d('edge'); if (!(e>0)) throw new Error('모서리 라벨 없음'); return 5*e*e;`),
          trace: [[`그림에서 모서리 ${e} 를 읽는다.`, "Read the label."], [`한 면의 넓이 = ${e}² = ${e * e} 이다.`, "One face."], [`정육면체는 면이 6 개이다.`, "A cube has six faces."], [`${open === "top face" ? "윗면" : "바닥 면"}은 칠하지 않으므로 5 면이다.`, "One face is not painted."], [`따라서 5 × ${e * e} = ${c} 이다.`, "State the painted area."]], variant: "cube_painted_faces",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_PI_SO, structure: "원기둥의 반지름이 그림에 있고 높이는 h 로 라벨되며 지문에서 '높이는 반지름의 k 배' 라고 할 때 겉넓이 2πr² + 2πrh 를 π 로 구함", extra: "k 배 관계로 높이를 구해 두 밑면과 옆면의 넓이를 모두 더해야 함(밑면을 빠뜨리거나 한 밑면만 더하면 오답) — medium 은 높이가 주어짐",
      concepts: ["원기둥의 겉넓이", "비", "문장의 식 번역"],
      gen(rng) { return retry(rng, () => {
        const k = rng.pick([2, 3, 4]), r = rng.int(2, 9); const h = k * r; const c = 2 * r * r + 2 * r * h; if (c >= 1000) throw new GenFail("큼"); const f = soFig("cylinder", { radius: String(r), height: "h" });
        const word = k === 2 ? "twice" : k === 3 ? "three times" : "four times";
        return geoInst(rng, {
          stimulus: soIntro(rng, CYL_SCENES, ` The height, labeled $h$, is ${word} the length of the radius.`), question: rng.pick(["What is the total surface area of the cylinder, in terms of $\\pi$?", "Find the total surface area in terms of $\\pi$.", "The surface area, including both circular bases, is how many square units in terms of $\\pi$?"]), correct: c, fmt: piFmt,
          wrongs: pos([W(2 * r * h, "step_missing", "옆면의 넓이만 답했다."), W(r * r + 2 * r * h, "step_missing", "밑면 하나만 더했다."), W(2 * r * r, "step_missing", "두 밑면만 답했다."), W(r * r * h, "formula_misuse", "부피를 답했다."), W(c + r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ k }, f, `${SO_JS}if (K!=='cylinder'||D.height!=='h') throw new Error('원기둥·h 라벨 필요'); const r=d('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); const h=P.k*r; return 2*r*r+2*r*h;`),
          trace: [[`그림에서 반지름 ${r} 을 읽고 지문에서 높이 = ${k} × 반지름 이다.`, "Read the label; the text gives the ratio."], [`높이 h = ${k} × ${r} = ${h} 이다.`, "Translate the ratio."], [`두 밑면의 넓이 = 2 × π × ${r}² = ${2 * r * r}π 이다.`, "Two bases."], [`옆면의 넓이 = 2π × ${r} × ${h} = ${2 * r * h}π 이다.`, "Lateral surface."], [`따라서 ${2 * r * r}π + ${2 * r * h}π = ${c}π 이다.`, "Add."]], variant: "cylinder_surface_area_from_ratio",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "직육면체의 길이·너비가 그림에 있고 높이가 x 이며 겉넓이가 지문에 주어질 때 x = (S/2 − lw) ÷ (l + w) 로 거꾸로 구함", extra: "겉넓이를 2 로 나누고 밑면의 넓이를 뺀 뒤 (l + w) 로 나눠야 함(2 로 나누지 않거나 l 로만 나누면 오답) — medium 은 겉넓이",
      concepts: ["직육면체의 겉넓이", "역산", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const S = 2 * (l * w + l * h + w * h); const f = soFig("rectangular_prism", { length: String(l), width: String(w), height: "x" });
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, ` The total surface area of the prism is ${S} square units.`), question: QX(rng), correct: h,
          wrongs: pos([W((S - l * w) / (l + w), "step_missing", "2 로 나누지 않았다."), W((S / 2 - l * w) / l, "formula_misuse", "길이로만 나누었다."), W(S / 2 / (l + w), "step_missing", "밑면의 넓이를 빼지 않았다."), W(h + 1, "other", "계산 중 어긋났다."), W(S / (2 * l * w), "formula_misuse", "밑면의 넓이로 나누었다.")]).filter((x) => x.v !== h),
          verificationJs: figJs({ S }, f, `${SO_JS}const l=d('length'), w=d('width'); if (!(l>0&&w>0)||D.height!=='x') throw new Error('라벨 오류'); const x=(P.S/2-l*w)/(l+w); if (Math.abs(x-Math.round(x))>1e-9) throw new Error('정수 아님'); return Math.round(x);`),
          trace: [[`그림에서 길이 ${l}, 너비 ${w}, 높이 x 를 읽고 겉넓이 ${S} 는 지문에서 안다.`, "Read the labels; the area is in the text."], [`겉넓이 식: 2(${l * w} + ${l}x + ${w}x) = ${S} 이다.`, "Surface area equation."], [`${l * w} + ${l + w}x = ${S / 2} 이다.`, "Divide by 2."], [`${l + w}x = ${S / 2 - l * w} 이다.`, "Subtract the base term."], [`따라서 x = ${h} 이다.`, "State x."]], variant: "prism_height_from_surface_area",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "cube_surface", structure: "정육면체의 모서리가 그림에 있을 때 겉넓이 6e² 을 구함", extra: "easy: 한 면의 넓이 × 6", concepts: ["정육면체의 겉넓이", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const e = rng.int(2, 14); const f = soFig("cube", { edge: String(e) }); const c = 6 * e * e;
        return geoInst(rng, { stimulus: soIntro(rng, CUBE_SCENES), question: QS(rng), correct: c, wrongs: pos([W(e * e, "step_missing", "한 면의 넓이만 답했다."), W(e * e * e, "formula_misuse", "부피를 답했다."), W(4 * e * e, "step_missing", "옆면 네 개만 더했다."), W(c + e, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c), verificationJs: figJs({}, f, `${SO_JS}const e=d('edge'); if (!(e>0)) throw new Error('모서리 라벨 없음'); return 6*e*e;`), trace: [[`그림에서 모서리 ${e} 를 읽는다.`, "Read the label."], [`한 면의 넓이 = ${e}² = ${e * e} 이고 면은 6 개이다.`, "Six equal faces."], [`따라서 ${c} 이다.`, "State the area."]], variant: "cube_surface_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "prism_surface", structure: "직육면체의 세 치수가 그림에 있을 때 겉넓이를 구함", extra: "medium: 세 쌍의 면의 합 × 2", concepts: ["직육면체의 겉넓이", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const f = soFig("rectangular_prism", { length: String(l), width: String(w), height: String(h) }); const c = 2 * (l * w + l * h + w * h);
        return geoInst(rng, { stimulus: soIntro(rng, PRISM_SCENES), question: QS(rng), correct: c, wrongs: pos([W(l * w * h, "formula_misuse", "부피를 답했다."), W(l * w + l * h + w * h, "step_missing", "2 를 곱하지 않았다."), W(2 * (l * w + l * h), "step_missing", "한 쌍의 면을 빠뜨렸다."), W(c + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c), verificationJs: figJs({}, f, `${SO_JS}const l=d('length'), w=d('width'), h=d('height'); if (!(l>0&&w>0&&h>0)) throw new Error('라벨 오류'); return 2*(l*w+l*h+w*h);`), trace: [[`그림에서 길이 ${l}, 너비 ${w}, 높이 ${h} 를 읽는다.`, "Read the labels."], [`겉넓이 = 2(${l}×${w} + ${l}×${h} + ${w}×${h}) 이다.`, "Surface area formula."], [`따라서 ${c} 이다.`, "State the area."]], variant: "prism_surface_medium" }, f);
      }); },
    },
  ],
});
