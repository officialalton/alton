// circles.circumference_radius.CI.P — 원 그림의 반지름·지름 라벨과 지문의 조건에서 둘레·넓이·반지름을 π 로 나타내어 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CI_JS, CIRC_CTX, CIRC_LEAD, CIRC_UNITS, SPR_NO_PI, circNames, piFmt, type CircFig } from "../ci-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const radiusFig = (rng: Rng, r: number): { f: CircFig; A: string } => { const [A] = circNames(rng, 1); return { A, f: { type: "circle", points: [{ id: A, angle: rng.pick([20, 35, 50, 160, 200, 320]) }], radii: [{ to: A, label: String(r) }] } }; };
const diamFig = (rng: Rng, d: number): { f: CircFig; A: string; B: string } => { const [A, B] = circNames(rng, 2); const a = rng.pick([20, 35, 150, 200]); return { A, B, f: { type: "circle", points: [{ id: A, angle: a }, { id: B, angle: a + 180 }], chords: [{ between: [A, B], label: String(d), diameter: true }] } }; };
const I = (rng: Rng, extra: string, unit = "") => `${rng.pick(CIRC_LEAD)}${rng.pick(CIRC_CTX)}${rng.pick(["The circle shown has center $O$.", "The figure shows a circle with center $O$.", "In the figure, $O$ is the center of the circle.", "A circle with center $O$ is shown in the figure."])}${extra} ${unit}`.replace(/ {2,}/g, " ").trim();
const WHO = ["wheel", "table", "fountain", "plate", "rug", "stage", "garden", "pool"];

const RAW = defineItem({
  prefix: "ci", itemId: "circles.circumference_radius.CI.P",
  hard: [
    {
      op: "inverse", sprNo: SPR_NO_PI, structure: "원의 둘레가 지문에 π 의 배수로 주어지고 그림에 반지름 라벨이 있을 때 반지름을 거꾸로 확인해 넓이를 구함", extra: "둘레 2πr 에서 r 을 구하거나 그림의 r 과 맞는지 확인해 πr² 을 계산해야 함(둘레나 반지름만 답하면 오답) — medium 은 둘레",
      concepts: ["원의 둘레", "원의 넓이", "역산"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(3, 18); const { A, f } = radiusFig(rng, r); const u = rng.pick(CIRC_UNITS);
        return geoInst(rng, {
          stimulus: I(rng, ` Its circumference is $${2 * r}\\pi$.`, u), question: rng.pick([`What is the area of the circle, in terms of $\\pi$?`, `The area of the circle is how many square units, in terms of $\\pi$?`, `Find the area of the circle in terms of $\\pi$.`]), correct: r * r, fmt: piFmt,
          wrongs: pos([W(2 * r, "step_missing", "둘레의 계수를 답했다."), W(r, "step_missing", "반지름을 답했다."), W(2 * r * r, "formula_misuse", "넓이를 2πr² 로 계산했다."), W(r * r * r, "formula_misuse", "r³ 을 답했다."), W(4 * r * r, "formula_misuse", "지름으로 넓이를 구했다.")]).filter((w) => w.v !== r * r),
          verificationJs: figJs({ C: 2 * r }, f, `${CI_JS}const r=radiusLabel(); if (P.C!==2*r) throw new Error('둘레와 반지름 불일치'); return r*r;`),
          trace: [[`그림에서 반지름 ${r} 을 읽는다(둘레 ${2 * r}π 와 일치).`, "Read the radius from the figure."], [`둘레 2πr = ${2 * r}π 이므로 r = ${r} 이다.`, "The circumference gives the same radius."], [`넓이 = πr² 이다.`, "Area formula."], [`π × ${r}² = ${r * r}π 이다.`, "Compute."], [`따라서 ${r * r}π 이다.`, "State the area."]], variant: "area_from_circumference_and_radius",
        }, f);
      }); },
    },
    {
      op: "compose_kind", sprNo: SPR_NO_PI, structure: "그림에 반지름 라벨이 있는 원을 지문의 '원 둘레를 n 바퀴 돈다' 와 결합해 이동 거리를 π 로 구함", extra: "둘레 2πr 에 바퀴 수 n 을 곱해야 함(한 바퀴만 답하거나 반지름으로 곱하면 오답) — medium 은 둘레",
      concepts: ["원의 둘레", "곱셈", "문장 번역"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(3, 15), n = rng.int(2, 7); const { f } = radiusFig(rng, r); const noun = rng.pick(WHO);
        return geoInst(rng, {
          stimulus: I(rng, ` A cyclist rides ${n} times around the edge of the circular ${noun}.`), question: rng.pick([`How far does the cyclist ride, in terms of $\\pi$?`, `What total distance is traveled, in terms of $\\pi$?`, `Find the total distance in terms of $\\pi$.`]), correct: 2 * r * n, fmt: piFmt,
          wrongs: pos([W(2 * r, "step_missing", "한 바퀴만 답했다."), W(r * n, "formula_misuse", "πr 로 계산했다."), W(r * r * n, "formula_misuse", "넓이로 계산했다."), W(4 * r * n, "formula_misuse", "지름을 반지름으로 착각했다."), W(2 * r * n + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== 2 * r * n),
          verificationJs: figJs({ n }, f, `${CI_JS}return 2*radiusLabel()*P.n;`),
          trace: [[`그림에서 반지름 ${r} 을 읽는다.`, "Read the radius."], [`한 바퀴 = 2π × ${r} = ${2 * r}π 이다.`, "One lap is the circumference."], [`${n} 바퀴를 돈다.`, "The number of laps."], [`${2 * r}π × ${n} = ${2 * r * n}π 이다.`, "Multiply."], [`따라서 ${2 * r * n}π 이다.`, "State the distance."]], variant: "distance_n_laps",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_PI, structure: "그림에 지름 라벨이 있는 원의 둘레를 반지름 d ÷ 2 로 바꿔 π d 로 구함", extra: "지름을 반지름으로 바꿔 2πr 에 넣어야 함(지름을 그대로 반지름으로 쓰면 오답) — medium 은 반지름으로 둘레",
      concepts: ["원의 둘레", "지름과 반지름", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(3, 15), d = 2 * r; const { f } = diamFig(rng, d);
        return geoInst(rng, {
          stimulus: I(rng, " Segment $AB$ passes through the center.".replace("AB", (f.chords![0].between as string[]).join("")) ), question: rng.pick([`What is the circumference of the circle, in terms of $\\pi$?`, `Find the circumference of the circle in terms of $\\pi$.`, `The circle's circumference is how many units, in terms of $\\pi$?`]), correct: d, fmt: piFmt,
          wrongs: pos([W(2 * d, "formula_misuse", "지름을 반지름으로 썼다."), W(r, "step_missing", "반지름만 답했다."), W(r * r, "formula_misuse", "넓이를 답했다."), W(d * d, "formula_misuse", "지름의 제곱을 답했다."), W(d + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== d),
          verificationJs: figJs({}, f, `${CI_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); return num(dm.label);`),
          trace: [[`그림에서 지름 ${d} 를 읽는다.`, "Read the diameter."], [`반지름 = ${d} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."], [`둘레 = 2π × ${r} 이다.`, "Circumference formula."], [`= ${d}π 이다.`, "Compute."], [`따라서 ${d}π 이다.`, "State the circumference."]], variant: "circumference_from_diameter",
        }, f);
      }); },
    },
    {
      op: "unit_ratio", sprNo: SPR_NO_PI, structure: "그림에 센티미터 단위의 반지름 라벨이 있는 원의 둘레를 미터 단위로 환산해 π 로 구함", extra: "둘레 2πr 을 구하고 cm → m 로 100 으로 나눠야 함(환산을 빠뜨리면 오답) — medium 은 둘레",
      concepts: ["원의 둘레", "단위 환산"],
      gen(rng) { return retry(rng, () => {
        const r = rng.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]); const coef = (2 * r) / 100; if (!Number.isInteger(coef * 100) || coef <= 0) throw new GenFail("x"); const { f } = radiusFig(rng, r);
        return geoInst(rng, {
          stimulus: I(rng, " The radius is given in centimeters."), question: rng.pick([`What is the circumference of the circle, in meters, in terms of $\\pi$?`, `Find the circumference in meters in terms of $\\pi$.`]), correct: coef, fmt: piFmt,
          wrongs: pos([W(2 * r, "unit_error", "cm 를 m 로 환산하지 않았다."), W(r / 100, "formula_misuse", "πr 로 계산했다."), W(coef * 2, "formula_misuse", "지름을 반지름으로 썼다."), W(r / 10, "unit_error", "10 으로 나누었다."), W(coef + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== coef),
          verificationJs: figJs({}, f, `${CI_JS}return 2*radiusLabel()/100;`),
          trace: [[`그림에서 반지름 ${r} cm 를 읽는다.`, "Read the radius in cm."], [`둘레 = 2π × ${r} = ${2 * r}π cm 이다.`, "Circumference in cm."], [`1 m = 100 cm 이므로 ${2 * r}π ÷ 100 이다.`, "Convert to meters."], [`= ${coef}π m 이다.`, "Compute."], [`따라서 ${coef}π 이다.`, "State the circumference."]], variant: "circumference_unit_conversion",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "circumference_from_radius", sprNo: SPR_NO_PI, structure: "그림에 반지름 라벨이 있는 원의 둘레를 π 로 구함", extra: "easy: 2πr", concepts: ["원의 둘레", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(3, 20); const { f } = radiusFig(rng, r);
        return geoInst(rng, { stimulus: I(rng, ""), question: rng.pick([`What is the circumference of the circle, in terms of $\\pi$?`, `Find the circumference in terms of $\\pi$.`]), correct: 2 * r, fmt: piFmt, wrongs: pos([W(r, "formula_misuse", "πr 로 계산했다."), W(r * r, "formula_misuse", "넓이를 답했다."), W(4 * r, "formula_misuse", "지름으로 곱했다."), W(2 * r + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== 2 * r), verificationJs: figJs({}, f, `${CI_JS}return 2*radiusLabel();`), trace: [[`그림에서 반지름 ${r} 을 읽는다.`, "Read the radius."], [`둘레 = 2π × ${r} = ${2 * r}π 이다.`, "Circumference = 2πr."]], variant: "circumference_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "area_from_radius", sprNo: SPR_NO_PI, structure: "그림에 반지름 라벨이 있는 원의 넓이를 π 로 구함", extra: "medium: 반지름 제곱", concepts: ["원의 넓이", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(3, 16); const { f } = radiusFig(rng, r);
        return geoInst(rng, { stimulus: I(rng, ""), question: rng.pick([`What is the area of the circle, in terms of $\\pi$?`, `Find the area in terms of $\\pi$.`]), correct: r * r, fmt: piFmt, wrongs: pos([W(2 * r, "formula_misuse", "둘레의 계수를 답했다."), W(r, "step_missing", "반지름을 답했다."), W(2 * r * r, "formula_misuse", "2πr² 으로 계산했다."), W(r * r + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== r * r), verificationJs: figJs({}, f, `${CI_JS}const r=radiusLabel(); return r*r;`), trace: [[`그림에서 반지름 ${r} 을 읽는다.`, "Read the radius."], [`넓이 = π × ${r}² = ${r * r}π 이다.`, "Area = πr²."], [`따라서 ${r * r}π 이다.`, "State the area."]], variant: "area_easy_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
