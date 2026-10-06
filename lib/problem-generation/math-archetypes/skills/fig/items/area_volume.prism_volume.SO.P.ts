// area_volume.prism_volume.SO.P — 직육면체 그림의 길이·너비·높이 라벨에서 부피·채우는 시간·새 높이를 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { PRISM_SCENES, Q_VOL, SO_JS, soFig, soIntro } from "../so-kit";
import { retry } from "../ext-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const dims3 = (rng: import("../../../rng").Rng) => { for (let i = 0; i < 60; i++) { const l = rng.int(4, 20), w = rng.int(3, 14), h = rng.int(2, 12); if (l > w && l * w * h < 3000 && l * w * h >= 24) return { l, w, h }; } throw new GenFail("치수"); };
const f3 = (l: number | string, w: number | string, h: number | string) => soFig("rectangular_prism", { length: String(l), width: String(w), height: String(h) });

const RAW = defineItem({
  prefix: "av", itemId: "area_volume.prism_volume.SO.P",
  hard: [
    {
      op: "compose_kind", structure: "직육면체의 길이·너비·높이가 그림에 라벨되었을 때 부피 l × w × h 를 구함", extra: "세 치수를 모두 곱해야 함(밑면적만 구하거나 합을 곱하면 오답) — medium 은 밑면의 넓이",
      concepts: ["직육면체의 부피", "곱셈"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const V = l * w * h; const f = f3(l, w, h);
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES), question: Q_VOL(rng), correct: V,
          wrongs: pos([W(l * w, "step_missing", "밑면의 넓이만 답했다."), W(l + w + h, "formula_misuse", "합을 답했다."), W(2 * (l * w + l * h + w * h), "formula_misuse", "겉넓이를 답했다."), W(l * w * h + l, "other", "계산 중 어긋났다."), W((l * w * h) / 2, "formula_misuse", "절반으로 계산했다.")]).filter((x) => x.v !== V),
          verificationJs: figJs({}, f, `${SO_JS}if (K!=='rectangular_prism') throw new Error('직육면체 필요'); const l=d('length'), w=d('width'), h=d('height'); if (!(l>0&&w>0&&h>0)) throw new Error('치수 라벨 없음'); return l*w*h;`),
          trace: [[`그림에서 길이 ${l}, 너비 ${w}, 높이 ${h} 를 읽는다.`, "Read the three dimensions."], [`밑면의 넓이 = ${l} × ${w} = ${l * w} 이다.`, "Base area."], [`부피 = 밑면의 넓이 × 높이 = ${l * w} × ${h} 이다.`, "Volume = base area × height."], [`= ${V} 이다.`, "Compute."], [`따라서 ${V} 이다.`, "State the volume."]], variant: "prism_volume",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "직육면체의 치수가 그림에 있고 단위 시간당 물을 채우는 양이 지문에 있을 때 부피를 구한 뒤 가득 채우는 데 걸리는 시간을 구함", extra: "부피 → 시간 = 부피 ÷ 속도 의 연쇄(부피만 답하거나 속도를 곱하면 오답) — medium 은 부피",
      concepts: ["직육면체의 부피", "비율", "나눗셈"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const V = l * w * h; const divs = [2, 3, 4, 5, 6, 8, 10, 12].filter((d) => V % d === 0 && V / d <= 400 && V / d >= 3); if (!divs.length) throw new GenFail("속도"); const rate = rng.pick(divs); const f = f3(l, w, h); const t = V / rate;
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, rng.pick([` The tank is empty and is filled with water at a constant rate of ${rate} cubic units per minute.`, ` Water flows into the empty tank at ${rate} cubic units every minute, with no loss.`, ` A pump delivers ${rate} cubic units of water per minute into the tank, which starts out empty.`, ` The empty container is filled steadily; each minute ${rate} cubic units of liquid are added.`, ` A hose fills the empty tank at a steady ${rate} cubic units each minute.`])), question: rng.pick([`How many minutes does it take to fill the tank completely?`, `How long, in minutes, will the tank take to fill?`, `After how many minutes is the tank full?`]), correct: t,
          wrongs: pos([W(V, "step_missing", "부피를 답했다."), W(V * rate, "formula_misuse", "속도를 곱했다."), W(t + 1, "other", "계산 중 어긋났다."), W((l * w) / rate, "step_missing", "높이를 곱하지 않았다."), W(V / (rate * 2), "formula_misuse", "속도의 두 배로 나누었다.")]).filter((x) => x.v !== t),
          verificationJs: figJs({ rate }, f, `${SO_JS}const l=d('length'), w=d('width'), h=d('height'); if (!(l>0&&w>0&&h>0)) throw new Error('치수 라벨 없음'); const t=l*w*h/P.rate; if (Math.abs(t-Math.round(t))>1e-9) throw new Error('정수 아님'); return Math.round(t);`),
          trace: [[`그림에서 길이 ${l}, 너비 ${w}, 높이 ${h} 를 읽는다.`, "Read the dimensions."], [`부피 = ${l} × ${w} × ${h} = ${V} 이다.`, "Volume of the tank."], [`채우는 속도는 분당 ${rate} 이다.`, "The fill rate."], [`시간 = ${V} ÷ ${rate} 이다.`, "Time = volume ÷ rate."], [`따라서 ${t} 이다.`, "State the time."]], variant: "fill_time",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "너비와 높이가 그림에 있고 지문에서 '길이는 너비의 k 배' 라고 할 때 비를 식으로 옮겨 길이를 구한 뒤 부피를 구함", extra: "k 배 관계로 길이 = k·w 를 구해 세 치수를 곱해야 함(k 를 부피에 곱하거나 길이를 너비의 1/k 로 읽으면 오답) — medium 은 세 치수가 주어짐",
      concepts: ["직육면체의 부피", "비", "문장의 식 번역"],
      gen(rng) { return retry(rng, () => {
        const k = rng.pick([2, 3, 4]); const w = rng.int(3, 9), h = rng.int(2, 10); const l = k * w; const V = l * w * h; if (V >= 3000) throw new GenFail("큼"); const f = soFig("rectangular_prism", { width: String(w), height: String(h) }); const word = k === 2 ? "twice" : k === 3 ? "three times" : "four times";
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, ` The length of the prism is ${word} its width.`), question: Q_VOL(rng), correct: V,
          wrongs: pos([W(w * h * k, "step_missing", "길이 대신 배수만 곱했다."), W((w * w * h) / k, "formula_misuse", "배수 방향을 거꾸로 읽었다."), W(w * w * h, "step_missing", "길이를 너비로 썼다."), W(V + w, "other", "계산 중 어긋났다."), W(l * w, "step_missing", "밑면의 넓이를 답했다.")]).filter((x) => x.v !== V),
          verificationJs: figJs({ k }, f, `${SO_JS}if (K!=='rectangular_prism') throw new Error('직육면체 필요'); const w=d('width'), h=d('height'); if (!(w>0&&h>0)||D.length!==undefined) throw new Error('라벨 오류'); return (P.k*w)*w*h;`),
          trace: [[`그림에서 너비 ${w}, 높이 ${h} 를 읽고 지문에서 길이 = ${k} × 너비 이다.`, "Read the width and height; the text gives the ratio."], [`길이 = ${k} × ${w} = ${l} 이다.`, "Translate the ratio."], [`밑면의 넓이 = ${l} × ${w} = ${l * w} 이다.`, "Base area."], [`부피 = ${l * w} × ${h} 이다.`, "Volume."], [`따라서 ${V} 이다.`, "State the volume."]], variant: "volume_from_ratio",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "직육면체의 치수가 그림에 있고 지문에서 '밑면은 같고 부피가 V₂ 인 다른 직육면체' 를 줄 때 새 높이 V₂ ÷ (l w) 를 거꾸로 구함", extra: "밑면의 넓이 l·w 로 새 부피를 나눠 높이를 구해야 함(원래 높이를 답하거나 부피를 나누지 않으면 오답) — medium 은 부피",
      concepts: ["직육면체의 부피", "역산", "밑면의 넓이"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const h2 = rng.int(2, 14); if (h2 === h) throw new GenFail("같음"); const V2 = l * w * h2; if (V2 >= 1000) throw new GenFail("큼"); const f = f3(l, w, h);
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, ` A second prism has the same base but a different height, and its volume is ${V2}.`), question: rng.pick([`What is the height of the second prism?`, `How tall is the second prism?`, `Find the height of the second prism.`]), correct: h2,
          wrongs: pos([W(h, "step_missing", "원래 높이를 답했다."), W(V2 / l, "step_missing", "너비로 나누지 않았다."), W(V2 / (l + w), "formula_misuse", "밑면의 합으로 나누었다."), W(h2 + 1, "other", "계산 중 어긋났다."), W(V2 - l * w, "formula_misuse", "빼서 구했다.")]).filter((x) => x.v !== h2),
          verificationJs: figJs({ V2 }, f, `${SO_JS}const l=d('length'), w=d('width'), h=d('height'); if (!(l>0&&w>0&&h>0)) throw new Error('치수 라벨 없음'); const h2=P.V2/(l*w); if (Math.abs(h2-Math.round(h2))>1e-9) throw new Error('정수 아님'); return Math.round(h2);`),
          trace: [[`그림에서 길이 ${l}, 너비 ${w} 를 읽고 새 부피 ${V2} 는 지문에서 안다.`, "Read the base; the new volume is in the text."], [`밑면의 넓이 = ${l} × ${w} = ${l * w} 이다.`, "Base area."], [`${V2} = ${l * w} × (새 높이) 이다.`, "Volume equation."], [`새 높이 = ${V2} ÷ ${l * w} 이다.`, "Divide."], [`따라서 ${h2} 이다.`, "State the height."]], variant: "second_prism_height",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "base_area", structure: "직육면체의 길이·너비가 그림에 있을 때 밑면의 넓이를 구함", extra: "easy: 길이 × 너비", concepts: ["직사각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const f = f3(l, w, h);
        return geoInst(rng, { stimulus: soIntro(rng, PRISM_SCENES), question: rng.pick([`What is the area of the base of the prism?`, `Find the area of the rectangular base.`]), correct: l * w, wrongs: pos([W(l * w * h, "step_missing", "부피를 답했다."), W(2 * (l + w), "formula_misuse", "둘레를 답했다."), W(l + w, "formula_misuse", "합을 답했다."), W(l * w + h, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== l * w), verificationJs: figJs({}, f, `${SO_JS}const l=d('length'), w=d('width'); if (!(l>0&&w>0)) throw new Error('치수 라벨 없음'); return l*w;`), trace: [[`그림에서 길이 ${l}, 너비 ${w} 를 읽는다.`, "Read the base dimensions."], [`밑면의 넓이 = ${l} × ${w} = ${l * w} 이다.`, "Base area."]], variant: "base_area_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "volume", structure: "직육면체의 세 치수가 그림에 있을 때 부피를 구함", extra: "medium: 밑면의 넓이 × 높이", concepts: ["직육면체의 부피"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng); const V = l * w * h; const f = f3(l, w, h);
        return geoInst(rng, { stimulus: soIntro(rng, PRISM_SCENES), question: Q_VOL(rng), correct: V, wrongs: pos([W(l * w, "step_missing", "밑면의 넓이만 답했다."), W(l + w + h, "formula_misuse", "합을 답했다."), W(2 * (l * w + l * h + w * h), "formula_misuse", "겉넓이를 답했다."), W(V + l, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== V), verificationJs: figJs({}, f, `${SO_JS}const l=d('length'), w=d('width'), h=d('height'); if (!(l>0&&w>0&&h>0)) throw new Error('치수 라벨 없음'); return l*w*h;`), trace: [[`그림에서 ${l}, ${w}, ${h} 를 읽는다.`, "Read the dimensions."], [`밑면의 넓이 = ${l * w} 이다.`, "Base area."], [`부피 = ${l * w} × ${h} = ${V} 이다.`, "Volume."]], variant: "prism_volume_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
