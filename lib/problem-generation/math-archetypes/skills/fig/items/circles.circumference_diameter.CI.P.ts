// circles.circumference_diameter.CI.P — 지름이 라벨된 원 그림과 지문의 조건에서 둘레(πd)·반원 호·넓이를 π 로 구한다.
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CI_JS, CIRC_CTX, CIRC_LEAD, SPR_NO_PI, circNames, piFmt, type CircFig } from "../ci-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const diamFig = (rng: Rng, d: number | string): { f: CircFig; A: string; B: string } => { const [A, B] = circNames(rng, 2); const a = rng.pick([20, 35, 150, 200, 330]); return { A, B, f: { type: "circle", points: [{ id: A, angle: a }, { id: B, angle: a + 180 }], chords: [{ between: [A, B], label: String(d), diameter: true }] } }; };
const I = (rng: Rng, A: string, B: string, extra = "") => `${rng.pick(CIRC_LEAD)}${rng.pick(CIRC_CTX)}${rng.pick([`In the circle shown, $${A}${B}$ is a diameter and $O$ is the center.`, `The figure shows a circle with center $O$ and diameter $${A}${B}$.`, `Chord $${A}${B}$ of the circle shown passes through the center $O$.`, `A circle with center $O$ is shown in the figure, and $${A}${B}$ is one of its diameters.`])}${extra}`.replace(/ {2,}/g, " ").trim();
const NOUN = ["wheel", "pool", "fountain", "pizza", "drum", "table"];

const RAW = defineItem({
  prefix: "ci", itemId: "circles.circumference_diameter.CI.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_PI, structure: "그림에 지름 라벨이 있는 원의 둘레 πd 를 구한 뒤 지문의 '끈을 n 바퀴 감는다' 와 결합해 끈의 길이를 π 로 구함", extra: "둘레 πd 에 감은 횟수를 곱해야 함(한 바퀴만 답하거나 지름으로 곱하면 오답) — medium 은 둘레",
      concepts: ["원의 둘레", "곱셈", "지름"],
      gen(rng) { return retry(rng, () => {
        const d = rng.int(4, 24), n = rng.int(2, 6); const { A, B, f } = diamFig(rng, d); const noun = rng.pick(NOUN);
        return geoInst(rng, {
          stimulus: I(rng, A, B, ` A rope is wrapped exactly ${n} times around the edge of the circular ${noun}.`), question: rng.pick([`How long is the rope, in terms of $\\pi$?`, `What length of rope is used, in terms of $\\pi$?`, `Find the length of the rope in terms of $\\pi$.`]), correct: d * n, fmt: piFmt,
          wrongs: pos([W(d, "step_missing", "한 바퀴만 답했다."), W(2 * d * n, "formula_misuse", "지름을 반지름으로 썼다."), W((d * d * n) / 4, "formula_misuse", "넓이로 계산했다."), W((d * n) / 2, "formula_misuse", "πr 로 계산했다."), W(d * n + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== d * n && Number.isInteger(w.v)),
          verificationJs: figJs({ n }, f, `${CI_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); return num(dm.label)*P.n;`),
          trace: [[`그림에서 지름 ${d} 를 읽는다.`, "Read the diameter."], [`둘레 = π × ${d} = ${d}π 이다.`, "Circumference = πd."], [`끈을 ${n} 바퀴 감는다.`, "The number of wraps."], [`길이 = ${n} × ${d}π = ${d * n}π 이다.`, "Multiply."], [`따라서 ${d * n}π 이다.`, "State the length."]], variant: "rope_n_wraps",
        }, f);
      }); },
    },
    {
      op: "inverse", sprNo: SPR_NO_PI, structure: "원의 둘레가 지문에 π 의 배수로 주어지고 그림에 지름 라벨이 있을 때 반지름 d ÷ 2 로 넓이를 구함", extra: "지름을 반으로 나눠 πr² 을 계산해야 함(지름을 제곱하면 오답) — medium 은 둘레",
      concepts: ["원의 넓이", "지름과 반지름", "역산"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 14), d = 2 * r; const { A, B, f } = diamFig(rng, d);
        return geoInst(rng, {
          stimulus: I(rng, A, B, ` The circumference of the circle is $${d}\\pi$.`), question: rng.pick([`What is the area of the circle, in terms of $\\pi$?`, `Find the area of the circle in terms of $\\pi$.`, `The circle's area is how many square units, in terms of $\\pi$?`]), correct: r * r, fmt: piFmt,
          wrongs: pos([W(d * d, "formula_misuse", "지름을 제곱했다."), W(d, "step_missing", "둘레의 계수를 답했다."), W(2 * r * r, "formula_misuse", "2πr² 으로 계산했다."), W(r, "step_missing", "반지름을 답했다."), W(r * r + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== r * r),
          verificationJs: figJs({ C: d }, f, `${CI_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); const d=num(dm.label); if (P.C!==d) throw new Error('둘레와 지름 불일치'); return (d/2)*(d/2);`),
          trace: [[`그림에서 지름 ${d} 를 읽는다(둘레 ${d}π 와 일치).`, "Read the diameter."], [`반지름 = ${d} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."], [`넓이 = πr² 이다.`, "Area formula."], [`π × ${r}² = ${r * r}π 이다.`, "Compute."], [`따라서 ${r * r}π 이다.`, "State the area."]], variant: "area_from_diameter_and_circumference",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_PI, structure: "둘째 원의 지름이 그림의 원 지름의 k 배라는 문장을 식으로 옮겨 둘째 원의 둘레를 π 로 구함", extra: "둘째 지름 = k·d 로 번역하고 π × (k d) 를 계산해야 함(k 배를 둘레에 곱하지 않으면 오답) — medium 은 둘레",
      concepts: ["원의 둘레", "비", "문장의 식 번역"],
      gen(rng) { return retry(rng, () => {
        const d = rng.int(3, 14), k = rng.pick([2, 3, 4]); const { A, B, f } = diamFig(rng, d); const word = k === 2 ? "twice" : k === 3 ? "three times" : "four times";
        return geoInst(rng, {
          stimulus: I(rng, A, B, ` A second circle has a diameter that is ${word} the diameter of the circle shown.`), question: rng.pick([`What is the circumference of the second circle, in terms of $\\pi$?`, `Find the circumference of the second circle in terms of $\\pi$.`]), correct: d * k, fmt: piFmt,
          wrongs: pos([W(d, "step_missing", "첫째 원의 둘레를 답했다."), W(d * k * k, "formula_misuse", "배수를 제곱했다."), W(2 * d * k, "formula_misuse", "지름을 반지름으로 썼다."), W((d * k) / 2, "formula_misuse", "πr 로 계산했다."), W(d * k + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== d * k && Number.isInteger(w.v)),
          verificationJs: figJs({ k }, f, `${CI_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); return num(dm.label)*P.k;`),
          trace: [[`그림에서 첫 원의 지름 ${d} 를 읽는다.`, "Read the first diameter."], [`둘째 원의 지름 = ${k} × ${d} = ${k * d} 이다.`, "Translate the ratio."], [`둘레 = π × ${k * d} 이다.`, "Circumference = πd."], [`= ${k * d}π 이다.`, "Compute."], [`따라서 ${k * d}π 이다.`, "State the circumference."]], variant: "second_circle_circumference",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_PI, structure: "그림에 지름 라벨이 있는 원의 둘레를 구한 뒤 반원 호의 길이(둘레의 절반)를 π 로 구함", extra: "πd 를 구하고 반으로 나눠야 함(둘레를 그대로 답하거나 d 를 더하면 오답) — medium 은 둘레",
      concepts: ["원의 둘레", "반원", "비"],
      gen(rng) { return retry(rng, () => {
        const d = 2 * rng.int(2, 12); const { A, B, f } = diamFig(rng, d);
        return geoInst(rng, {
          stimulus: I(rng, A, B, ` The diameter divides the circle into two semicircles.`), question: rng.pick([`What is the length of one semicircular arc $${A}${B}$, in terms of $\\pi$?`, `How long is one of the two semicircular arcs, in terms of $\\pi$?`, `Find the length of one semicircle's curved edge in terms of $\\pi$.`]), correct: d / 2, fmt: piFmt,
          wrongs: pos([W(d, "step_missing", "둘레 전체를 답했다."), W(d / 4, "formula_misuse", "4 로 나누었다."), W(2 * d, "formula_misuse", "지름을 반지름으로 썼다."), W(d / 2 + 1, "other", "계산 중 어긋났다."), W(d * d / 4, "formula_misuse", "넓이로 계산했다.")]).filter((w) => w.v !== d / 2),
          verificationJs: figJs({}, f, `${CI_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); return num(dm.label)/2;`),
          trace: [[`그림에서 지름 ${d} 를 읽는다.`, "Read the diameter."], [`원의 둘레 = ${d}π 이다.`, "Circumference."], [`지름이 원을 두 반원으로 나눈다.`, "The diameter splits the circle in half."], [`반원의 호 = ${d}π ÷ 2 = ${d / 2}π 이다.`, "Half of the circumference."], [`따라서 ${d / 2}π 이다.`, "State the length."]], variant: "semicircle_arc_length",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "circumference", sprNo: SPR_NO_PI, structure: "그림에 지름 라벨이 있는 원의 둘레를 π 로 구함", extra: "easy: πd", concepts: ["원의 둘레"],
      gen(rng) { return retry(rng, () => {
        const d = rng.int(3, 24); const { A, B, f } = diamFig(rng, d);
        return geoInst(rng, { stimulus: I(rng, A, B), question: rng.pick([`What is the circumference of the circle, in terms of $\\pi$?`, `Find the circumference in terms of $\\pi$.`]), correct: d, fmt: piFmt, wrongs: pos([W(2 * d, "formula_misuse", "지름을 반지름으로 썼다."), W(d / 2, "formula_misuse", "반지름을 곱했다."), W(d * d, "formula_misuse", "제곱을 답했다."), W(d + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== d && Number.isInteger(w.v)), verificationJs: figJs({}, f, `${CI_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); return num(dm.label);`), trace: [[`그림에서 지름 ${d} 를 읽는다.`, "Read the diameter."], [`둘레 = πd = ${d}π 이다.`, "Circumference = πd."]], variant: "circumference_diameter_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "area", sprNo: SPR_NO_PI, structure: "그림에 지름 라벨이 있는 원의 넓이를 반지름으로 바꿔 π 로 구함", extra: "medium: 지름 → 반지름 → πr²", concepts: ["원의 넓이", "지름과 반지름"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(2, 13), d = 2 * r; const { A, B, f } = diamFig(rng, d);
        return geoInst(rng, { stimulus: I(rng, A, B), question: rng.pick([`What is the area of the circle, in terms of $\\pi$?`, `Find the area in terms of $\\pi$.`]), correct: r * r, fmt: piFmt, wrongs: pos([W(d * d, "formula_misuse", "지름을 제곱했다."), W(d, "formula_misuse", "둘레의 계수를 답했다."), W(r, "step_missing", "반지름을 답했다."), W(r * r + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== r * r), verificationJs: figJs({}, f, `${CI_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); const d=num(dm.label); return (d/2)*(d/2);`), trace: [[`그림에서 지름 ${d} 를 읽는다.`, "Read the diameter."], [`반지름 = ${r} 이다.`, "Radius is half."], [`넓이 = π × ${r}² = ${r * r}π 이다.`, "Area = πr²."]], variant: "area_from_diameter" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
