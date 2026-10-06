import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { DIM_JS, compFig, cylFig, ctxComp, ctxCyl, ctxPrism, makeCyl, makePrism, piT, prismFig } from "../sx-kit";
const posW = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
const rdl = (what: string): [string, string] => [`그림에서 ${what} 라벨을 읽는다.`, "Read the labels in the figure."];
const sq = (n: number) => Math.round(Math.sqrt(n) * 1000) / 1000;
const PI_OK = "정답이 π 가 든 식($k\\pi$)이라 단답(수)으로 낼 수 없다";
const piW = (k: number, kind: import("../../../../review").DistractorKind, reason: string) => ({ text: piT(Math.round(k * 100) / 100), kind, reason });
const piList = (ws: { text: string; kind: import("../../../../review").DistractorKind; reason: string }[]) => ws.filter((w) => !/NaN|Infinity|-/.test(w.text) && !/^\$0\\pi\$$/.test(w.text));



const intro = (rng: Rng, extra = "") => `${ctxComp(rng)}${extra}`;
const R3 = (rng: Rng) => rng.pick([3, 6, 9]);
export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.composite_solid.SX.P",
  hard: [
    {
      op: "chain2", structure: "원기둥과 반구의 부피를 각각 구해 합친 입체의 부피를 구함", extra: "반구는 구의 절반(⅔πr³)임을 쓰고 원기둥과 더해야 함(구 전체의 부피를 쓰거나 한 부분만 답하는 함정) — medium 은 원기둥 부분",
      sprNo: PI_OK, concepts: ["합성 입체", "원기둥의 부피", "반구의 부피"],
      gen(rng) {
        const r = R3(rng), h = rng.int(4, 14); const hemi = (2 * r * r * r) / 3; const k = r * r * h + hemi; const f = compFig({ radius: String(r), height: String(h) });
        return gInst(rng, {
          stimulus: intro(rng), question: rng.pick(["What is the total volume of the solid, in cubic units?", "What is the volume, in cubic units, of the entire solid?"]), correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(r * r * h + 2 * hemi, "formula_misuse", "구 전체의 부피를 더했다."), piW(r * r * h, "step_missing", "원기둥만 답했다."), piW(hemi, "step_missing", "반구만 답했다."), piW(r * r * h + (r * r * r) / 3, "formula_misuse", "원뿔의 부피로 계산했다."), piW(r * r * (h + r), "formula_misuse", "반구를 높이 r 의 원기둥으로 보았다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const r=D('radius'); const v=r*r*D('height')+2*r*r*r/3; return v;`),
          trace: [rdl("반지름·원기둥의 높이"), [`원기둥의 부피 = π × ${r}² × ${h} = ${r * r * h}π 이다.`, "Cylinder part."], [`반구의 부피 = ⅔ × π × ${r}³ = ${hemi}π 이다.`, "Hemisphere part."], [`합 = ${r * r * h}π + ${hemi}π = ${k}π 이다.`, "Add the two parts."], [`따라서 ${k}π 이다.`, "State the volume."]], variant: "volume_cylinder_hemisphere",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "원기둥의 옆면·아랫면과 반구의 곡면의 넓이를 모두 더한 겉넓이를 구함", extra: "윗면(원기둥과 반구가 맞닿는 면)은 제외하고 아랫면은 포함해야 함(맞닿는 면을 더하거나 아랫면을 빠뜨리는 함정) — medium 은 부피",
      sprNo: PI_OK, concepts: ["합성 입체", "겉넓이", "반구의 곡면"],
      gen(rng) {
        const r = R3(rng), h = rng.int(4, 14); const k = 2 * r * h + 3 * r * r; const f = compFig({ radius: String(r), height: String(h) });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the total outer surface area of the solid, including its flat circular bottom, in square units?`, correctText: piT(k), range: [0, 1e7],
          wrongTexts: piList([piW(2 * r * h + r * r, "step_missing", "반구의 곡면을 빠뜨렸다."), piW(2 * r * h + 2 * r * r, "step_missing", "아랫면을 빠뜨렸다."), piW(2 * r * h + 4 * r * r + r * r, "formula_misuse", "구 전체의 겉넓이를 더했다."), piW(2 * r * h + 3 * r * r + r * r, "formula_misuse", "맞닿는 면을 더했다."), piW(r * r * h + 2 * r * r, "geometry_misapplied", "부피를 섞어 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const r=D('radius'); return 2*r*D('height')+r*r+2*r*r;`),
          trace: [rdl("반지름·원기둥의 높이"), [`옆면 = 2π × ${r} × ${h} = ${2 * r * h}π, 아랫면 = π × ${r}² = ${r * r}π 이다.`, "Side and bottom of the cylinder."], [`반구의 곡면 = 2π × ${r}² = ${2 * r * r}π 이다.`, "Curved surface of the hemisphere."], [`맞닿는 면은 안쪽이므로 제외한다.`, "The joining face is not on the outside."], [`합 = ${2 * r * h}π + ${r * r}π + ${2 * r * r}π = ${k}π 이다.`, "Add."]], variant: "outer_surface_area",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "원기둥 부분과 반구 부분의 부피 차를 구함", extra: "두 부분의 부피를 따로 구해 빼야 함(합을 구하거나 구 전체를 쓰는 함정) — medium 은 한 부분",
      sprNo: PI_OK, concepts: ["합성 입체", "두 부피 비교"],
      gen(rng) {
        const r = R3(rng), h = rng.int(4, 14); const hemi = (2 * r * r * r) / 3; const cyl = r * r * h; if (cyl <= hemi) throw new GenFail("원기둥이 더 큼"); const f = compFig({ radius: String(r), height: String(h) });
        return gInst(rng, {
          stimulus: intro(rng), question: `By how many cubic units does the volume of the cylindrical part exceed the volume of the hemispherical part?`, correctText: piT(cyl - hemi), range: [0, 1e7],
          wrongTexts: piList([piW(cyl + hemi, "sign_error", "합을 구했다."), piW(cyl, "step_missing", "원기둥만 답했다."), piW(hemi, "step_missing", "반구만 답했다."), piW(cyl - 2 * hemi, "formula_misuse", "구 전체의 부피를 뺐다."), piW(cyl - (r * r * r) / 3, "formula_misuse", "원뿔의 부피를 뺐다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const r=D('radius'); return r*r*D('height')-2*r*r*r/3;`),
          trace: [rdl("반지름·원기둥의 높이"), [`원기둥 = ${cyl}π, 반구 = ⅔ × π × ${r}³ = ${hemi}π 이다.`, "Both parts."], [`차 = ${cyl}π - ${hemi}π = ${cyl - hemi}π 이다.`, "Subtract."], [`반구는 구의 절반이므로 ⅔πr³ 이다.`, "Half of a sphere."], [`따라서 ${cyl - hemi}π 이다.`, "State the difference."]], variant: "cylinder_minus_hemisphere",
        }, f);
      },
    },
    {
      op: "inverse", structure: "합친 부피가 주어질 때 반구의 부피를 빼 원기둥의 높이(x)를 거꾸로 구함", extra: "전체 부피에서 반구를 빼고 πr² 로 나눠야 함(전체를 πr² 로 나누는 함정) — medium 은 원기둥의 높이",
      sprNo: PI_OK, concepts: ["합성 입체", "역산", "부피"],
      gen(rng) {
        const r = R3(rng), h = rng.int(4, 14); const k = r * r * h + (2 * r * r * r) / 3; if (k >= 1000) throw new GenFail("V 큼"); const f = compFig({ radius: String(r), height: "x" });
        return gInst(rng, {
          stimulus: intro(rng, ` The volume of the solid is $${k}\\pi$ cubic units.`), question: `What is the value of $x$, the height of the cylindrical part?`, correct: h,
          wrongs: posW([W(Math.round((k / (r * r)) * 100) / 100, "step_missing", "반구의 부피를 빼지 않았다."), W(Math.round(((k - (4 * r * r * r) / 3) / (r * r)) * 100) / 100, "formula_misuse", "구 전체의 부피를 뺐다."), W(h + 1, "other", "계산이 어긋났다."), W(Math.round(((k - (2 * r * r * r) / 3) / r) * 100) / 100, "formula_misuse", "r 로만 나눴다."), W(k - (2 * r * r * r) / 3, "step_missing", "나누지 않았다.")]),
          verificationJs: figJs({ k }, f, `${DIM_JS}const r=D('radius'); const h=(P.k-2*r*r*r/3)/(r*r); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return h;`),
          trace: [rdl("반지름"), [`반구의 부피 = ⅔ × π × ${r}³ = ${(2 * r * r * r) / 3}π 이다.`, "Hemisphere volume."], [`원기둥의 부피 = ${k}π - ${(2 * r * r * r) / 3}π = ${r * r * h}π 이다.`, "Subtract it from the total."], [`π × ${r}² × x = ${r * r * h}π 에서 x = ${h} 이다.`, "Solve for the height."], [`따라서 ${h} 이다.`, "State x."]], variant: "height_from_total_volume",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "hemisphere", structure: "반구 부분의 부피(⅔πr³)를 구함", extra: "easy: 구의 절반", sprNo: PI_OK, concepts: ["반구의 부피"],
      gen(rng) {
        const r = R3(rng), h = rng.int(4, 14); const hemi = (2 * r * r * r) / 3; const f = compFig({ radius: String(r), height: String(h) });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the volume of the hemispherical part, in cubic units?`, correctText: piT(hemi), range: [0, 1e7],
          wrongTexts: piList([piW(2 * hemi, "formula_misuse", "구 전체의 부피를 답했다."), piW((r * r * r) / 3, "formula_misuse", "원뿔의 부피로 계산했다."), piW(r * r * h, "geometry_misapplied", "원기둥의 부피를 답했다."), piW(r * r * r, "formula_misuse", "πr³ 로 계산했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}const r=D('radius'); return 2*r*r*r/3;`),
          trace: [rdl("반지름"), [`반구의 부피 = ⅔ × π × ${r}³ = ${hemi}π 이다.`, "Half of the volume of a sphere."]], variant: "easy_hemisphere_volume",
        }, f);
      },
    },
    {
      lv: "medium", name: "cylinder_part", structure: "원기둥 부분의 부피를 구함", extra: "medium: 높이는 원기둥 부분만", sprNo: PI_OK, concepts: ["원기둥의 부피"],
      gen(rng) {
        const r = R3(rng), h = rng.int(4, 14); const f = compFig({ radius: String(r), height: String(h) });
        return gInst(rng, {
          stimulus: intro(rng), question: `What is the volume of the cylindrical part, in cubic units?`, correctText: piT(r * r * h), range: [0, 1e7],
          wrongTexts: piList([piW(r * r * (h + r), "formula_misuse", "반구를 원기둥에 더했다."), piW(r * h, "step_missing", "반지름을 제곱하지 않았다."), piW((r * r * h) / 3, "formula_misuse", "원뿔의 부피를 답했다."), piW(2 * r * h, "geometry_misapplied", "옆넓이를 답했다.")]),
          verificationJs: figJs({}, f, `${DIM_JS}return D('radius')**2*D('height');`),
          trace: [rdl("반지름·원기둥의 높이"), [`부피 = π × ${r}² × ${h} = ${r * r * h}π 이다.`, "Cylinder volume."], [`반구는 포함하지 않는다.`, "The dome is not included."]], variant: "medium_cylinder_part_volume",
        }, f);
      },
    },
  ],
});
void ctxPrism; void ctxCyl; void makePrism; void makeCyl; void prismFig; void cylFig;
