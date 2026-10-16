// area_volume.similar_solids_scale.SO.P — 그림의 입체와 닮은 입체의 치수·넓이·부피 비를 닮음비(k, k², k³)로 푼다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CONE_SCENES, CUBE_SCENES, CYL_SCENES, PRISM_SCENES, SO_JS, SPR_NO_PI_SO, piFmt, soFig, soIntro } from "../so-kit";
import { retry } from "../ext-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));

const SCALE = (rng: { pick<T>(a: T[]): T }, noun: string, k: number) => rng.pick([
  ` A larger ${noun} is similar to it, and every length of the larger one is ${k} times the matching length.`,
  ` Another ${noun}, similar to this one, has all of its lengths multiplied by ${k}.`,
  ` The ${noun} is enlarged into a similar ${noun} whose dimensions are each ${k} times as great.`,
  ` A second ${noun} has the same shape, with every dimension scaled up by a factor of ${k}.`,
  ` Each length of a similar, larger ${noun} is ${k} times its counterpart in the figure.`,
  ` Suppose the ${noun} is scaled up to a similar ${noun} using the scale factor ${k}.`,
  ` A similar ${noun} is built with a scale factor of ${k} compared with the one shown.`,
]);
const QV = (rng: { pick<T>(a: T[]): T }) => rng.pick(["What is the volume of the larger solid?", "Find the volume of the larger solid.", "How large is the volume of the larger solid?", "Determine the volume of the larger solid."]);
const dims3 = (rng: { int(a: number, b: number): number }, cap: number) => { for (let i = 0; i < 60; i++) { const l = rng.int(3, 9), w = rng.int(2, 7), h = rng.int(2, 6); if (l > w && l * w * h * 8 <= cap) return { l, w, h }; } throw new GenFail("치수"); };

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.similar_solids_scale.SO.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_PI_SO, structure: "원기둥의 반지름·높이가 그림에 있고 지문에서 닮은 더 큰 원기둥의 닮음비가 k 일 때 부피 k³ 배인 π r²h k³ 을 π 로 구함", extra: "길이가 k 배면 부피는 k³ 배임을 써야 함(k 배나 k² 배로 계산하면 오답) — medium 은 닮음비가 정해진 길이 구하기",
      concepts: ["닮음비와 부피비", "원기둥의 부피"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 4), h = rng.int(2, 8), k = rng.pick([2, 3]); const v = r * r * h; const c = v * k * k * k; if (c >= 1000) throw new GenFail("큼"); const f = soFig("cylinder", { radius: String(r), height: String(h) });
        return geoInst(rng, {
          stimulus: soIntro(rng, CYL_SCENES, SCALE(rng, "cylinder", k)), question: rng.pick(["What is the volume of the larger cylinder, in terms of $\\pi$?", "Find the volume of the larger cylinder in terms of $\\pi$.", "The larger cylinder has what volume, in terms of $\\pi$?"]), correct: c, fmt: piFmt,
          wrongs: pos([W(v * k, "formula_misuse", "닮음비를 그대로 곱했다."), W(v * k * k, "formula_misuse", "닮음비의 제곱을 곱했다."), W(v, "step_missing", "작은 원기둥의 부피만 답했다."), W(c / k * 2, "formula_misuse", "닮음비의 세제곱 대신 두 배로 곱했다."), W(c + k, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ k }, f, `${SO_JS}if (K!=='cylinder') throw new Error('원기둥 필요'); const r=d('radius'), h=d('height'); if (!(r>0&&h>0)) throw new Error('라벨 오류'); return r*r*h*Math.pow(P.k,3);`),
          trace: [[`그림에서 반지름 ${r} 과 높이 ${h} 를 읽는다.`, "Read the labels."], [`작은 원기둥의 부피 = π × ${r}² × ${h} = ${v}π 이다.`, "Volume of the shown cylinder."], [`닮음비가 ${k} 이므로 부피비는 ${k}³ = ${k * k * k} 이다.`, "Volume ratio is the cube of the scale factor."], [`큰 원기둥의 부피 = ${v}π × ${k * k * k} 이다.`, "Scale the volume."], [`따라서 ${c}π 이다.`, "State the volume."]], variant: "similar_cylinder_volume",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "직육면체의 세 치수가 그림에 있고 지문에서 닮은 더 큰 직육면체의 한 대응하는 길이가 주어질 때 닮음비 k 를 구한 뒤 부피 lwh k³ 을 구함", extra: "대응하는 길이로 닮음비를 구하고 세제곱해야 함(닮음비를 부피에 곱하거나 제곱하면 오답) — medium 은 닮음비",
      concepts: ["닮음비와 부피비", "직육면체의 부피"],
      gen(rng) { return retry(rng, () => {
        const { l, w, h } = dims3(rng, 3000); const k = rng.pick([2, 3]); const V = l * w * h; const c = V * k * k * k; if (c >= 1000) throw new GenFail("큼"); const f = soFig("rectangular_prism", { length: String(l), width: String(w), height: String(h) });
        const which = rng.pick(["length", "width", "height"] as const); const base = which === "length" ? l : which === "width" ? w : h;
        return geoInst(rng, {
          stimulus: soIntro(rng, PRISM_SCENES, ` A larger prism is similar to the one shown. Its ${which} measures ${k * base} units, which matches the ${which} labeled in the figure.`), question: QV(rng), correct: c,
          wrongs: pos([W(V * k, "formula_misuse", "닮음비를 그대로 곱했다."), W(V * k * k, "formula_misuse", "닮음비의 제곱을 곱했다."), W(V, "step_missing", "작은 직육면체의 부피만 답했다."), W(c - V, "formula_misuse", "부피의 차를 구했다."), W(c + k, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ big: k * base, which }, f, `${SO_JS}const l=d('length'), w=d('width'), h=d('height'); if (!(l>0&&w>0&&h>0)) throw new Error('라벨 오류'); const b=d(P.which); const k=P.big/b; if (Math.abs(k-Math.round(k))>1e-9) throw new Error('닮음비가 정수 아님'); return l*w*h*Math.pow(Math.round(k),3);`),
          trace: [[`그림에서 길이 ${l}, 너비 ${w}, 높이 ${h} 를 읽는다.`, "Read the labels."], [`대응하는 ${which === "length" ? "길이" : which === "width" ? "너비" : "높이"}: ${base} → ${k * base} 이므로 닮음비 = ${k} 이다.`, "Scale factor from matching edges."], [`작은 직육면체의 부피 = ${l} × ${w} × ${h} = ${V} 이다.`, "Volume of the shown prism."], [`부피비 = ${k}³ = ${k * k * k} 이다.`, "Cube of the scale factor."], [`따라서 ${V} × ${k * k * k} = ${c} 이다.`, "State the volume."]], variant: "similar_prism_volume_from_edge",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "원뿔의 반지름이 그림에 있고 지문에서 닮은 원뿔의 밑면의 넓이가 k² 배라고 할 때 넓이비를 길이비로 옮겨 큰 원뿔의 반지름을 구함", extra: "넓이비의 제곱근이 길이비임을 써야 함(넓이비를 길이에 곱하거나 세제곱근을 쓰면 오답) — medium 은 닮음비가 주어짐",
      concepts: ["닮음비와 넓이비", "문장의 식 번역"],
      gen(rng) { return retry(rng, () => {
        const k = rng.pick([2, 3, 4, 5]), r = rng.int(2, 9); const f = soFig("cone", { radius: String(r), height: String(rng.int(3, 18)) }); const c = k * r;
        return geoInst(rng, {
          stimulus: soIntro(rng, CONE_SCENES, rng.pick([` A larger cone is similar to the one shown. The area of its circular base is ${k * k} times the area of the base of the cone in the figure.`, ` A similar cone is made so that its base has ${k * k} times the area of the base in the figure.`, ` The cone is enlarged to a similar cone; the new circular base covers ${k * k} times as much area as the original base.`, ` Compared with the cone in the figure, a similar cone has a base whose area is multiplied by ${k * k}.`, ` A bigger cone of the same shape has a base area ${k * k} times that of the cone shown.`, ` The base of a similar, larger cone has an area ${k * k} times as large as the base of this cone.`])), question: rng.pick(["What is the radius of the larger cone?", "Find the radius of the larger cone.", "How long is the radius of the larger cone?", "Determine the radius of the larger cone."]), correct: c,
          wrongs: pos([W(r * k * k, "formula_misuse", "넓이비를 반지름에 곱했다."), W(r + k, "formula_misuse", "닮음비를 더했다."), W(r, "step_missing", "작은 원뿔의 반지름을 답했다."), W(r * k * k * k, "formula_misuse", "닮음비의 세제곱을 곱했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ ar: k * k }, f, `${SO_JS}if (K!=='cone') throw new Error('원뿔 필요'); const r=d('radius'); if (!(r>0)) throw new Error('반지름 라벨 없음'); const k=Math.sqrt(P.ar); if (Math.abs(k-Math.round(k))>1e-9) throw new Error('제곱수 아님'); return r*Math.round(k);`),
          trace: [[`그림에서 반지름 ${r} 을 읽는다.`, "Read the label."], [`밑면의 넓이비 = ${k * k} 이다.`, "The area ratio from the text."], [`닮음비 = √${k * k} = ${k} 이다.`, "Scale factor is the square root of the area ratio."], [`큰 원뿔의 반지름 = ${k} × ${r} 이다.`, "Scale the radius."], [`따라서 ${c} 이다.`, "State the radius."]], variant: "similar_cone_radius_from_area_ratio",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "정육면체의 모서리가 그림에 있고 지문에서 닮은 큰 정육면체의 부피가 주어질 때 부피비의 세제곱근과 닮음비 k = ∛V ÷ e 를 거꾸로 구함", extra: "큰 정육면체의 모서리 ∛V 를 구한 뒤 작은 모서리로 나눠야 함(부피비를 닮음비로 답하거나 제곱근을 쓰면 오답) — medium 은 닮음비가 주어짐",
      concepts: ["닮음비와 부피비", "역산"],
      gen(rng) { return retry(rng, () => {
        const k = rng.pick([2, 3, 4, 5]), e = rng.int(2, 7); const f = soFig("cube", { edge: String(e) }); const Vb = e * e * e * k * k * k; if (Vb >= 1000) throw new GenFail("큼"); const c = k;
        return geoInst(rng, {
          stimulus: soIntro(rng, CUBE_SCENES, rng.pick([` A larger cube is similar to the cube shown, and the volume of the larger cube is ${Vb} cubic units.`, ` A second, bigger cube of the same shape has a volume of ${Vb} cubic units.`, ` The cube is enlarged to a similar cube that holds ${Vb} cubic units.`, ` A similar cube with volume ${Vb} cubic units is compared with the one in the figure.`, ` Another cube, similar to this one, has a volume equal to ${Vb} cubic units.`])), question: rng.pick(["By what factor is each length multiplied to get the larger cube?", "What is the scale factor from the cube shown to the larger cube?", "Each edge of the larger cube is how many times as long as an edge of the cube in the figure?", "Find the ratio of an edge of the larger cube to an edge of the cube shown.", "What number gives the scale factor of the enlargement?"]), correct: c,
          wrongs: pos([W(k * k * k, "formula_misuse", "부피비를 닮음비로 답했다."), W(k * k, "formula_misuse", "닮음비를 제곱해 답했다."), W(Math.round(Vb / e), "formula_misuse", "부피를 모서리로 나누었다."), W(k * e, "step_missing", "큰 정육면체의 모서리를 답했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c && Number.isInteger(x.v)),
          verificationJs: figJs({ Vb }, f, `${SO_JS}const e=d('edge'); if (!(e>0)) throw new Error('모서리 라벨 없음'); const k=Math.cbrt(P.Vb)/e; if (Math.abs(k-Math.round(k))>1e-9) throw new Error('정수 닮음비 아님'); return Math.round(k);`),
          trace: [[`그림에서 모서리 ${e} 를 읽고 큰 정육면체의 부피 ${Vb} 는 지문에서 안다.`, "Read the label; the volume is in the text."], [`작은 정육면체의 부피 = ${e}³ = ${e * e * e} 이다.`, "Volume of the shown cube."], [`큰 정육면체의 모서리 = ∛${Vb} = ${k * e} 이다.`, "Cube root of the volume."], [`닮음비 = ${k * e} ÷ ${e} 이다.`, "Ratio of matching edges."], [`따라서 ${k} 이다.`, "State the scale factor."]], variant: "similar_cube_scale_from_volume",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "edge_scale", structure: "정육면체의 모서리가 그림에 있고 닮은 큰 정육면체의 닮음비가 k 일 때 큰 정육면체의 모서리를 구함", extra: "easy: 모서리 × k", concepts: ["닮음비", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const e = rng.int(2, 9), k = rng.pick([2, 3, 4]); const f = soFig("cube", { edge: String(e) }); const c = e * k;
        return geoInst(rng, { stimulus: soIntro(rng, CUBE_SCENES, SCALE(rng, "cube", k)), question: rng.pick(["What is the edge length of the larger cube?", "Find the edge length of the larger cube."]), correct: c, wrongs: pos([W(e + k, "formula_misuse", "닮음비를 더했다."), W(e * k * k, "formula_misuse", "닮음비의 제곱을 곱했다."), W(e, "step_missing", "작은 정육면체의 모서리를 답했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c), verificationJs: figJs({ k }, f, `${SO_JS}const e=d('edge'); if (!(e>0)) throw new Error('모서리 라벨 없음'); return e*P.k;`), trace: [[`그림에서 모서리 ${e} 를 읽는다.`, "Read the label."], [`큰 정육면체의 모서리 = ${k} × ${e} = ${c} 이다.`, "Scale the edge."]], variant: "similar_cube_edge_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "cube_volume_scale", structure: "정육면체의 모서리가 그림에 있고 닮은 큰 정육면체의 닮음비가 k 일 때 큰 정육면체의 부피를 구함", extra: "medium: (k × 모서리)³", concepts: ["닮음비와 부피비", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const e = rng.int(2, 5), k = rng.pick([2, 3]); const f = soFig("cube", { edge: String(e) }); const c = (e * k) ** 3; if (c >= 1000) throw new GenFail("큼");
        return geoInst(rng, { stimulus: soIntro(rng, CUBE_SCENES, SCALE(rng, "cube", k)), question: QV(rng), correct: c, wrongs: pos([W(e * e * e * k, "formula_misuse", "닮음비를 그대로 곱했다."), W(e * e * e * k * k, "formula_misuse", "닮음비의 제곱을 곱했다."), W(e * e * e, "step_missing", "작은 정육면체의 부피만 답했다."), W(c + k, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c), verificationJs: figJs({ k }, f, `${SO_JS}const e=d('edge'); if (!(e>0)) throw new Error('모서리 라벨 없음'); return Math.pow(e*P.k,3);`), trace: [[`그림에서 모서리 ${e} 를 읽는다.`, "Read the label."], [`큰 정육면체의 모서리 = ${k} × ${e} = ${k * e} 이다.`, "Scale the edge."], [`부피 = ${k * e}³ = ${c} 이다.`, "Cube it."]], variant: "similar_cube_volume_medium" }, f);
      }); },
    },
  ],
});
