// 원기둥 부피 조합(반지름·지름 라벨 두 종류)이 함께 쓰는 생성기 — 조합 파일 두 개가 이 함수로 만든다.
import { GenFail } from "../../types";
import { W } from "../d-kit";
import { figJs } from "../../figure-kit";
import { defineItem } from "./item-kit";
import { geoInst } from "./geo-kit";
import { CYL_SCENES, Q_VOL_PI, SO_JS, SPR_NO_PI_SO, piFmt, soFig, soIntro } from "./so-kit";
import { retry } from "./ext-kit";
import type { Rng } from "../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const QH = (rng: Rng) => rng.pick(["What is the value of $h$?", "In the figure shown, what is $h$?", "Find the height $h$ of the cylinder.", "What number does $h$ represent?", "Determine $h$."]);
/** r(반지름)·h 에서 라벨 dims: dia=true 면 지름 라벨 2r. */
const dimsOf = (r: number, h: string | number, dia: boolean) => (dia ? { diameter: String(2 * r), height: String(h) } : { radius: String(r), height: String(h) });
const RJS = "const rr=()=>{ const r=d('radius'); const dm=d('diameter'); if (r>0) return r; if (dm>0) return dm/2; throw new Error('반지름·지름 라벨 없음'); };\n";

export function makeCylItem(itemId: string, dia: boolean) {
  const rn = dia ? "지름" : "반지름"; void rn;
  return defineItem({
    prefix: "av", itemId,
    hard: [
      {
        op: "compose_kind", sprNo: SPR_NO_PI_SO, structure: `원기둥의 ${dia ? "지름" : "반지름"}과 높이가 그림에 라벨되었을 때 부피 πr²h 를 π 로 구함`, extra: `${dia ? "지름을 반으로 나눠 반지름으로 바꾼 뒤" : "반지름을 제곱하고"} 높이를 곱해야 함(${dia ? "지름을 제곱하거나" : "반지름 대신 지름을 쓰거나"} 높이를 빠뜨리면 오답) — medium 은 밑면의 넓이`,
        concepts: ["원기둥의 부피", dia ? "지름과 반지름" : "원의 넓이"],
        gen(rng) { return retry(rng, () => {
          const r = rng.int(2, 12), h = rng.int(3, 20); const f = soFig("cylinder", dimsOf(r, h, dia)); const c = r * r * h;
          return geoInst(rng, {
            stimulus: soIntro(rng, CYL_SCENES), question: Q_VOL_PI(rng), correct: c, fmt: piFmt,
            wrongs: pos([W(r * r, "step_missing", "밑면의 넓이만 답했다."), W(4 * r * r * h, "formula_misuse", "지름을 반지름으로 썼다."), W(2 * r * h, "formula_misuse", "옆넓이 공식으로 계산했다."), W(c / 3, "formula_misuse", "원뿔의 공식으로 계산했다."), W(c + r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
            verificationJs: figJs({}, f, `${SO_JS}${RJS}if (K!=='cylinder') throw new Error('원기둥 필요'); const h=d('height'); if (!(h>0)) throw new Error('높이 라벨 없음'); const r=rr(); return r*r*h;`),
            trace: [[`그림에서 ${dia ? `지름 ${2 * r}` : `반지름 ${r}`} 과 높이 ${h} 를 읽는다.`, "Read the labels."], ...(dia ? [[`반지름 = ${2 * r} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."] as [string, string]] : [[`밑면은 반지름 ${r} 인 원이다.`, "The base is a circle."] as [string, string]]), [`밑면의 넓이 = π × ${r}² = ${r * r}π 이다.`, "Base area."], [`부피 = ${r * r}π × ${h} 이다.`, "Volume = base area × height."], [`따라서 ${c}π 이다.`, "State the volume."]], variant: dia ? "cylinder_volume_diameter" : "cylinder_volume_radius",
          }, f);
        }); },
      },
      {
        op: "chain2", sprNo: SPR_NO_PI_SO, structure: `원기둥의 ${dia ? "지름" : "반지름"}과 높이가 그림에 있고 지문에서 '절반까지 채운다' 고 할 때 부피를 구한 뒤 물의 부피 V/2 를 구함`, extra: "원기둥의 부피를 구하고 절반으로 줄여야 함(전체 부피를 답하면 오답) — medium 은 부피",
        concepts: ["원기둥의 부피", "비"],
        gen(rng) { return retry(rng, () => {
          const r = rng.int(2, 12), h = 2 * rng.int(2, 10); const f = soFig("cylinder", dimsOf(r, h, dia)); const c = (r * r * h) / 2;
          return geoInst(rng, {
            stimulus: soIntro(rng, CYL_SCENES, " The cylinder is filled with water exactly halfway."), question: rng.pick(["What is the volume of the water, in terms of $\\pi$?", "How much water does the cylinder contain, in terms of $\\pi$?", "Find the volume of the water in terms of $\\pi$."]), correct: c, fmt: piFmt,
            wrongs: pos([W(r * r * h, "step_missing", "전체 부피를 답했다."), W(c / 2, "formula_misuse", "다시 절반으로 줄였다."), W(4 * c, "formula_misuse", "지름을 반지름으로 썼다."), W(r * r, "step_missing", "밑면의 넓이만 답했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
            verificationJs: figJs({}, f, `${SO_JS}${RJS}const h=d('height'); if (!(h>0)) throw new Error('높이 라벨 없음'); const r=rr(); return r*r*h/2;`),
            trace: [[`그림에서 ${dia ? `지름 ${2 * r}` : `반지름 ${r}`} 과 높이 ${h} 를 읽는다.`, "Read the labels."], [`전체 부피 = π × ${r}² × ${h} = ${r * r * h}π 이다.`, "Volume of the full cylinder."], [`절반만 채운다.`, "Half full."], [`물의 부피 = ${r * r * h}π ÷ 2 이다.`, "Half of the volume."], [`따라서 ${c}π 이다.`, "State the volume."]], variant: "half_full_cylinder",
          }, f);
        }); },
      },
      {
        op: "repr_shift", sprNo: SPR_NO_PI_SO, structure: `${dia ? "지름" : "반지름"}만 그림에 있고 지문에서 '높이는 ${dia ? "지름" : "반지름"}의 k 배' 라고 할 때 비를 식으로 옮겨 높이를 구한 뒤 부피를 구함`, extra: "k 배 관계로 높이를 구하고 πr²h 에 넣어야 함(배수를 부피에 곱하거나 방향을 거꾸로 읽으면 오답) — medium 은 높이가 주어짐",
        concepts: ["원기둥의 부피", "비", "문장의 식 번역"],
        gen(rng) { return retry(rng, () => {
          const k = rng.pick([2, 3, 4]); const r = rng.int(2, 8); const baseLen = dia ? 2 * r : r; const h = k * baseLen; const f = soFig("cylinder", dia ? { diameter: String(2 * r) } : { radius: String(r) }); const c = r * r * h; if (c > 3000) throw new GenFail("큼"); const word = k === 2 ? "twice" : k === 3 ? "three times" : "four times";
          return geoInst(rng, {
            stimulus: soIntro(rng, CYL_SCENES, ` The height of the cylinder is ${word} its ${dia ? "diameter" : "radius"}.`), question: Q_VOL_PI(rng), correct: c, fmt: piFmt,
            wrongs: pos([W(c * k, "formula_misuse", "배수를 부피에 곱했다."), W(r * r * baseLen / k, "formula_misuse", "배수 방향을 거꾸로 읽었다."), W(r * r * baseLen, "step_missing", "높이를 반지름(지름)으로 썼다."), W(r * r, "step_missing", "밑면의 넓이만 답했다."), W(c + r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
            verificationJs: figJs({ k }, f, `${SO_JS}${RJS}const r=rr(); const base=d('${dia ? "diameter" : "radius"}'); return r*r*(P.k*base);`),
            trace: [[`그림에서 ${dia ? `지름 ${2 * r}` : `반지름 ${r}`} 을 읽고 지문에서 높이 = ${k} × ${dia ? "지름" : "반지름"} 이다.`, "Read the label; the text gives the ratio."], [`높이 = ${k} × ${baseLen} = ${h} 이다.`, "Translate the ratio."], [`밑면의 넓이 = π × ${r}² = ${r * r}π 이다.`, "Base area."], [`부피 = ${r * r}π × ${h} 이다.`, "Volume."], [`따라서 ${c}π 이다.`, "State the volume."]], variant: "volume_from_height_ratio",
          }, f);
        }); },
      },
      {
        op: "inverse", structure: `원기둥의 ${dia ? "지름" : "반지름"}이 그림에 있고 부피가 지문에 kπ 로 주어질 때 높이 h = k ÷ r² 을 거꾸로 구함`, extra: `부피 ÷ ${dia ? "(반지름)² = (지름/2)²" : "r²"} 으로 높이를 구해야 함(${dia ? "지름을 제곱해 나누거나 " : ""}r 로만 나누면 오답) — medium 은 부피`,
        concepts: ["원기둥의 부피", "역산", dia ? "지름과 반지름" : "원의 넓이"],
        gen(rng) { return retry(rng, () => {
          const r = rng.int(2, 9), h = rng.int(2, 18); const k = r * r * h; if (k >= 1000) throw new GenFail("큼"); const f = soFig("cylinder", dimsOf(r, "h", dia));
          return geoInst(rng, {
            stimulus: soIntro(rng, CYL_SCENES, ` The volume of the cylinder is $${k}\\pi$, and its height is labeled $h$.`), question: QH(rng), correct: h,
            wrongs: pos([W(k / r, "step_missing", "반지름으로만 나누었다."), W(k / (4 * r * r), "formula_misuse", "지름을 반지름으로 썼다."), W(k / (2 * r), "formula_misuse", "2r 로 나누었다."), W(h + 1, "other", "계산 중 어긋났다."), W(k - r * r, "formula_misuse", "빼서 구했다.")]).filter((x) => x.v !== h),
            verificationJs: figJs({ k }, f, `${SO_JS}${RJS}if (D.height!=='h') throw new Error('h 라벨 필요'); const r=rr(); const h=P.k/(r*r); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return Math.round(h);`),
            trace: [[`그림에서 ${dia ? `지름 ${2 * r}` : `반지름 ${r}`} 을 읽고 부피 ${k}π 는 지문에서 안다.`, "Read the label; the volume is in the text."], ...(dia ? [[`반지름 = ${2 * r} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."] as [string, string]] : [[`밑면은 반지름 ${r} 인 원이므로 밑면의 넓이 = ${r * r}π 이다.`, "Base area."] as [string, string]]), [`부피 = π × ${r}² × h = ${k}π 이다.`, "Volume equation."], [`${r * r}h = ${k} 이다.`, "Cancel π."], [`따라서 h = ${h} 이다.`, "State h."]], variant: "height_from_volume",
          }, f);
        }); },
      },
    ],
    em: [
      {
        lv: "easy", name: "base_area", sprNo: SPR_NO_PI_SO, structure: `원기둥의 ${dia ? "지름" : "반지름"}이 그림에 있을 때 밑면의 넓이를 π 로 구함`, extra: "easy: πr²", concepts: ["원의 넓이", "문제 조건 해석"],
        gen(rng) { return retry(rng, () => {
          const r = rng.int(2, 13); const f = soFig("cylinder", dimsOf(r, rng.int(3, 20), dia));
          return geoInst(rng, { stimulus: soIntro(rng, CYL_SCENES), question: rng.pick(["What is the area of the circular base, in terms of $\\pi$?", "Find the area of the base in terms of $\\pi$."]), correct: r * r, fmt: piFmt, wrongs: pos([W(2 * r, "formula_misuse", "둘레의 계수를 답했다."), W(4 * r * r, "formula_misuse", "지름을 반지름으로 썼다."), W(r, "step_missing", "반지름을 답했다."), W(r * r + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== r * r), verificationJs: figJs({}, f, `${SO_JS}${RJS}const r=rr(); return r*r;`), trace: [[`그림에서 ${dia ? `지름 ${2 * r}` : `반지름 ${r}`} 을 읽는다.`, "Read the label."], [`넓이 = π × ${r}² = ${r * r}π 이다.`, "Area = πr²."]], variant: "cylinder_base_area_easy" }, f);
        }); },
      },
      {
        lv: "medium", name: "volume", sprNo: SPR_NO_PI_SO, structure: `원기둥의 ${dia ? "지름" : "반지름"}과 높이가 그림에 있을 때 부피를 구함`, extra: "medium: 밑면의 넓이 × 높이", concepts: ["원기둥의 부피", "문제 조건 해석"],
        gen(rng) { return retry(rng, () => {
          const r = rng.int(2, 12), h = rng.int(3, 20); const f = soFig("cylinder", dimsOf(r, h, dia)); const c = r * r * h;
          return geoInst(rng, { stimulus: soIntro(rng, CYL_SCENES), question: Q_VOL_PI(rng), correct: c, fmt: piFmt, wrongs: pos([W(r * r, "step_missing", "밑면의 넓이만 답했다."), W(4 * r * r * h, "formula_misuse", "지름을 반지름으로 썼다."), W(2 * r * h, "formula_misuse", "옆넓이로 계산했다."), W(c + r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c), verificationJs: figJs({}, f, `${SO_JS}${RJS}const h=d('height'); if (!(h>0)) throw new Error('높이 라벨 없음'); const r=rr(); return r*r*h;`), trace: [[`그림에서 ${dia ? `지름 ${2 * r}, 반지름 ${r}` : `반지름 ${r}`} 과 높이 ${h} 를 읽는다.`, "Read the labels."], [`부피 = π × ${r}² × ${h} = ${c}π 이다.`, "Volume = πr²h."], [`따라서 ${c}π 이다.`, "State the volume."]], variant: "cylinder_volume_medium" }, f);
        }); },
      },
    ],
  });
}
