// area_volume.cone_pyramid_sphere_volume.SO.P — 원뿔·정사각뿔·구 그림의 라벨에서 부피를 구한다(원뿔·구는 π 로).
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CONE_SCENES, PYR_SCENES, SPH_SCENES, Q_VOL, Q_VOL_PI, SO_JS, SPR_NO_PI_SO, piFmt, soFig, soIntro } from "../so-kit";
import { retry } from "../ext-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const QH = (rng: { pick<T>(a: T[]): T }) => rng.pick(["What is the value of $h$?", "In the figure shown, what is $h$?", "Find the height $h$ of the cone.", "What number does $h$ represent?", "Determine $h$."]);
const RJS = "const rr=()=>{ const r=d('radius'); const dm=d('diameter'); if (r>0) return r; if (dm>0) return dm/2; throw new Error('반지름·지름 라벨 없음'); };\n";

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.cone_pyramid_sphere_volume.SO.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_PI_SO, structure: "원뿔의 반지름과 높이가 그림에 라벨되었을 때 부피 πr²h/3 을 π 로 구함", extra: "밑면의 넓이에 높이를 곱한 뒤 3 으로 나눠야 함(3 으로 나누지 않거나 원기둥 공식을 쓰면 오답) — medium 은 공식 적용",
      concepts: ["원뿔의 부피", "원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 9), h = 3 * rng.int(1, 6); const f = soFig("cone", { radius: String(r), height: String(h) }); const c = (r * r * h) / 3;
        return geoInst(rng, {
          stimulus: soIntro(rng, CONE_SCENES), question: Q_VOL_PI(rng), correct: c, fmt: piFmt,
          wrongs: pos([W(r * r * h, "formula_misuse", "3 으로 나누지 않았다."), W((4 * r * r * h) / 3, "formula_misuse", "반지름 대신 지름을 썼다."), W(r * r, "step_missing", "밑면의 넓이만 답했다."), W((r * h) / 3, "formula_misuse", "반지름을 제곱하지 않았다."), W(c + r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({}, f, `${SO_JS}${RJS}if (K!=='cone') throw new Error('원뿔 필요'); const h=d('height'); if (!(h>0)) throw new Error('높이 라벨 없음'); const r=rr(); return r*r*h/3;`),
          trace: [[`그림에서 반지름 ${r} 과 높이 ${h} 를 읽는다.`, "Read the labels."], [`밑면의 넓이 = π × ${r}² = ${r * r}π 이다.`, "Base area."], [`기둥의 부피 = ${r * r}π × ${h} = ${r * r * h}π 이다.`, "A cylinder of the same base and height."], [`원뿔은 그 3 분의 1 이다.`, "A cone is one third of it."], [`따라서 ${c}π 이다.`, "State the volume."]], variant: "cone_volume",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_PI_SO, structure: "구의 반지름(또는 지름)이 그림에 있고 구에 물이 정확히 절반 차 있을 때 구의 부피 4πr³/3 을 구한 뒤 절반을 구함", extra: "부피를 구하고 절반으로 줄여야 함(전체 부피를 답하거나 지름을 반지름으로 쓰면 오답) — medium 은 구의 부피",
      concepts: ["구의 부피", "비", "지름과 반지름"],
      gen(rng) { return retry(rng, () => {
        const r = rng.pick([3, 6, 9]); const dia = rng.pick([true, false]); const f = soFig("sphere", dia ? { diameter: String(2 * r) } : { radius: String(r) }); const c = (2 * r * r * r) / 3;
        return geoInst(rng, {
          stimulus: soIntro(rng, SPH_SCENES, " The sphere is hollow and filled with water exactly halfway."), question: rng.pick(["What is the volume of the water, in terms of $\\pi$?", "How much water does the sphere contain, in terms of $\\pi$?", "Find the volume of the water in terms of $\\pi$."]), correct: c, fmt: piFmt,
          wrongs: pos([W((4 * r * r * r) / 3, "step_missing", "전체 부피를 답했다."), W((2 * r * r * r) / 3 / 2, "formula_misuse", "다시 절반으로 줄였다."), W(dia ? (16 * r * r * r) / 3 : c * 8, "formula_misuse", "지름을 반지름으로 썼다."), W(2 * r * r * r, "formula_misuse", "3 으로 나누지 않았다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({}, f, `${SO_JS}${RJS}if (K!=='sphere') throw new Error('구 필요'); const r=rr(); return 2*r*r*r/3;`),
          trace: [[`그림에서 ${dia ? `지름 ${2 * r}` : `반지름 ${r}`} 을 읽는다.`, "Read the label."], ...(dia ? [[`반지름 = ${2 * r} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."] as [string, string]] : []), [`구의 부피 = 4/3 × π × ${r}³ = ${(4 * r * r * r) / 3}π 이다.`, "Volume of the full sphere."], [`물은 절반만 찼다.`, "Half full."], [`물의 부피 = ${(4 * r * r * r) / 3}π ÷ 2 이다.`, "Half of the volume."], [`따라서 ${c}π 이다.`, "State the volume."]], variant: "half_full_sphere",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "정사각뿔의 밑면 모서리가 그림에 있고 지문에서 '높이는 모서리의 k 배' 라고 할 때 비를 식으로 옮겨 높이를 구한 뒤 부피 e²h/3 을 구함", extra: "k 배 관계로 높이를 구하고 3 으로 나눠야 함(3 으로 나누지 않거나 높이를 모서리로 쓰면 오답) — medium 은 높이가 주어짐",
      concepts: ["정사각뿔의 부피", "비", "문장의 식 번역"],
      gen(rng) { return retry(rng, () => {
        const k = rng.pick([2, 3, 4, 6]), e = rng.int(2, 9); const V3 = k * e * e * e; if (V3 % 3 !== 0 || V3 / 3 >= 1000) throw new GenFail("정수 아님"); const h = k * e; const c = V3 / 3; const f = soFig("square_pyramid", { edge: String(e), height: "h" });
        const word = k === 2 ? "twice" : k === 3 ? "three times" : k === 4 ? "four times" : "six times";
        return geoInst(rng, {
          stimulus: soIntro(rng, PYR_SCENES, ` The height, labeled $h$, is ${word} the length of a base edge.`), question: Q_VOL(rng), correct: c,
          wrongs: pos([W(V3, "step_missing", "3 으로 나누지 않았다."), W(e * e * e / 3, "formula_misuse", "높이를 모서리로 썼다."), W(e * e * h / 3 * k, "formula_misuse", "배수를 한 번 더 곱했다."), W(e * e, "step_missing", "밑면의 넓이만 답했다."), W(c + e, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ k }, f, `${SO_JS}if (K!=='square_pyramid'||D.height!=='h') throw new Error('정사각뿔·h 라벨 필요'); const e=d('edge'); if (!(e>0)) throw new Error('모서리 라벨 없음'); const v=e*e*(P.k*e)/3; if (Math.abs(v-Math.round(v))>1e-9) throw new Error('정수 아님'); return Math.round(v);`),
          trace: [[`그림에서 밑면의 모서리 ${e} 를 읽고 지문에서 높이 = ${k} × 모서리 이다.`, "Read the label; the text gives the ratio."], [`높이 = ${k} × ${e} = ${h} 이다.`, "Translate the ratio."], [`밑면의 넓이 = ${e}² = ${e * e} 이다.`, "Base area."], [`부피 = ${e * e} × ${h} ÷ 3 이다.`, "Pyramid volume formula."], [`따라서 ${c} 이다.`, "State the volume."]], variant: "pyramid_volume_from_ratio",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "원뿔의 반지름이 그림에 있고 부피가 지문에 kπ 로 주어질 때 높이 h = 3k ÷ r² 을 거꾸로 구함", extra: "부피에 3 을 곱한 뒤 r² 으로 나눠야 함(3 을 곱하지 않거나 r 로만 나누면 오답) — medium 은 부피",
      concepts: ["원뿔의 부피", "역산", "원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 8), h = 3 * rng.int(1, 6); const k = (r * r * h) / 3; if (k >= 1000) throw new GenFail("큼"); const f = soFig("cone", { radius: String(r), height: "h" });
        return geoInst(rng, {
          stimulus: soIntro(rng, CONE_SCENES, ` The volume of the cone is $${k}\\pi$, and its height is labeled $h$.`), question: QH(rng), correct: h,
          wrongs: pos([W(k / (r * r), "step_missing", "3 을 곱하지 않았다."), W((3 * k) / r, "formula_misuse", "반지름을 제곱하지 않았다."), W((3 * k) / (4 * r * r), "formula_misuse", "지름을 반지름으로 썼다."), W(h + 3, "other", "계산 중 어긋났다."), W(3 * k - r * r, "formula_misuse", "빼서 구했다.")]).filter((x) => x.v !== h),
          verificationJs: figJs({ k }, f, `${SO_JS}if (D.height!=='h') throw new Error('h 라벨 필요'); const r=d('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); const h=3*P.k/(r*r); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return Math.round(h);`),
          trace: [[`그림에서 반지름 ${r} 을 읽고 부피 ${k}π 는 지문에서 안다.`, "Read the label; the volume is in the text."], [`밑면의 넓이 = π × ${r}² = ${r * r}π 이다.`, "Base area."], [`부피 = ${r * r}π × h ÷ 3 = ${k}π 이다.`, "Volume equation."], [`${r * r}h = ${3 * k} 이다.`, "Clear the fraction and cancel π."], [`따라서 h = ${h} 이다.`, "State h."]], variant: "cone_height_from_volume",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "base_area", sprNo: SPR_NO_PI_SO, structure: "원뿔의 반지름이 그림에 있을 때 밑면의 넓이를 π 로 구함", extra: "easy: πr²", concepts: ["원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 12); const f = soFig("cone", { radius: String(r), height: String(rng.int(3, 18)) });
        return geoInst(rng, { stimulus: soIntro(rng, CONE_SCENES), question: rng.pick(["What is the area of the circular base, in terms of $\\pi$?", "Find the area of the base in terms of $\\pi$."]), correct: r * r, fmt: piFmt, wrongs: pos([W(2 * r, "formula_misuse", "둘레의 계수를 답했다."), W(4 * r * r, "formula_misuse", "지름을 반지름으로 썼다."), W(r, "step_missing", "반지름을 답했다."), W(r * r + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== r * r), verificationJs: figJs({}, f, `${SO_JS}${RJS}const r=rr(); return r*r;`), trace: [[`그림에서 반지름 ${r} 을 읽는다.`, "Read the label."], [`넓이 = π × ${r}² = ${r * r}π 이다.`, "Area = πr²."]], variant: "cone_base_area_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "volume", sprNo: SPR_NO_PI_SO, structure: "원뿔의 반지름과 높이가 그림에 있을 때 부피를 구함", extra: "medium: 밑면의 넓이 × 높이 ÷ 3", concepts: ["원뿔의 부피"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 9), h = 3 * rng.int(1, 6); const f = soFig("cone", { radius: String(r), height: String(h) }); const c = (r * r * h) / 3;
        return geoInst(rng, { stimulus: soIntro(rng, CONE_SCENES), question: Q_VOL_PI(rng), correct: c, fmt: piFmt, wrongs: pos([W(r * r * h, "formula_misuse", "3 으로 나누지 않았다."), W(r * r, "step_missing", "밑면의 넓이만 답했다."), W((4 * r * r * h) / 3, "formula_misuse", "지름을 반지름으로 썼다."), W(c + r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c), verificationJs: figJs({}, f, `${SO_JS}${RJS}const h=d('height'); if (!(h>0)) throw new Error('높이 라벨 없음'); const r=rr(); return r*r*h/3;`), trace: [[`그림에서 반지름 ${r} 과 높이 ${h} 를 읽는다.`, "Read the labels."], [`부피 = π × ${r}² × ${h} ÷ 3 이다.`, "Cone volume = (1/3)πr²h."], [`따라서 ${c}π 이다.`, "State the volume."]], variant: "cone_volume_medium" }, f);
      }); },
    },
  ],
});
