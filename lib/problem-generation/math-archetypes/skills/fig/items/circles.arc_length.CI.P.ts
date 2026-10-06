// circles.arc_length.CI.P — 원 그림의 중심각(도·라디안)·반지름·지름 라벨에서 호의 길이를 π 로 구하거나 중심각을 거꾸로 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { ANG_LABEL_JS, ARC_COMBOS, CI_JS, CIRC_CTX, CIRC_LEAD, SPR_NO_PI, arcPts, circNames, piFmt, type CircFig } from "../ci-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const arcFig = (rng: Rng, theta: number, o: { r?: number; d?: number; label?: string; a0?: number } = {}): { f: CircFig; A: string; B: string } => {
  const [A, B] = circNames(rng, 2); const a0 = o.a0 ?? rng.pick([10, 25, 40, 100, 150, 200, 250]); const lab = o.label ?? `${theta}°`;
  return { A, B, f: { type: "circle", points: arcPts(A, B, a0, theta), ...(o.r !== undefined ? { radii: [{ to: A, label: String(o.r) }] } : {}), ...(o.d !== undefined ? { chords: [{ between: [A, A] as [string, string], label: "" }].slice(0, 0) } : {}), arcs: [{ from: A, to: B }], centralAngles: [{ between: [A, B], label: lab }] } };
};
// 지름은 수평 — 라벨이 중심 바로 위에 놓이므로 중심각을 아래 반원(205°~335°)에 둔다.
const withDiam = (rng: Rng, f: CircFig, d: number): CircFig => { const [C, D] = circNames(rng, 4).filter((n) => !f.points.some((p) => p.id === n)).slice(0, 2); const a = 0; return { ...f, points: [...f.points, { id: C, angle: a }, { id: D, angle: a + 180 }], chords: [{ between: [C, D], label: String(d), diameter: true }] }; };
const I = (rng: Rng, A: string, B: string, extra = "") => `${rng.pick(CIRC_LEAD)}${rng.pick(CIRC_CTX)}${rng.pick([`In the circle shown, $O$ is the center, and arc $${A}${B}$ is highlighted.`, `The figure shows a circle with center $O$ and the highlighted arc $${A}${B}$.`, `Arc $${A}${B}$ of the circle with center $O$ is marked in the figure.`, `A circle with center $O$ is shown, and the arc from $${A}$ to $${B}$ is highlighted.`])}${extra}`.replace(/ {2,}/g, " ").trim();
const QARC = (rng: Rng, A: string, B: string) => rng.pick([`What is the length of arc $${A}${B}$, in terms of $\\pi$?`, `Find the length of arc $${A}${B}$ in terms of $\\pi$.`, `How long is the highlighted arc, in terms of $\\pi$?`]);
const rad = (n: number, m: number) => (n === 1 ? `π/${m}` : `${n}π/${m}`);

const RAW = defineItem({
  prefix: "ci", itemId: "circles.arc_length.CI.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_PI, structure: "중심각(도)과 반지름이 그림에 라벨된 원에서 호의 길이 θ/360 · 2πr 을 구함", extra: "중심각이 원 전체의 몇 분의 몇인지 구해 둘레에 곱해야 함(θ 를 그대로 곱하거나 반지름으로만 계산하면 오답) — medium 은 반원",
      concepts: ["호의 길이", "중심각", "원의 둘레"],
      gen(rng) { return retry(rng, () => {
        const [th, r] = rng.pick(ARC_COMBOS()); const c = (th * r) / 180; const { A, B, f } = arcFig(rng, th, { r });
        return geoInst(rng, {
          stimulus: I(rng, A, B), question: QARC(rng, A, B), correct: c, fmt: piFmt,
          wrongs: pos([W(2 * r, "step_missing", "원 전체의 둘레를 답했다."), W(th * r / 360, "formula_misuse", "πr 에 θ/360 을 곱했다."), W(c * 2, "formula_misuse", "배로 계산했다."), W((th * r * r) / 360, "formula_misuse", "부채꼴 넓이로 계산했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c),
          verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const r=radiusLabel(); if (!CAN.length) throw new Error('중심각 라벨 없음'); return degOf(CAN[0].label)*r/180;`),
          trace: [[`그림에서 중심각 ${th}° 와 반지름 ${r} 을 읽는다.`, "Read the central angle and the radius."], [`원 전체의 둘레 = 2π × ${r} = ${2 * r}π 이다.`, "Circumference."], [`호는 원의 ${th}/360 이다.`, "The arc is a fraction of the circle."], [`호의 길이 = ${th}/360 × ${2 * r}π 이다.`, "Multiply."], [`따라서 ${c}π 이다.`, "State the length."]], variant: "arc_from_degree_and_radius",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "호의 길이가 지문에 kπ 로 주어지고 반지름이 그림에 라벨될 때 중심각(도)을 거꾸로 구함", extra: "θ = 호의 길이 ÷ 둘레 × 360 으로 거꾸로 구해야 함(2 를 빠뜨려 θ 가 두 배가 되면 오답) — medium 은 반원",
      concepts: ["호의 길이", "중심각", "역산"],
      gen(rng) { return retry(rng, () => {
        const [th, r] = rng.pick(ARC_COMBOS().filter(([t]) => t !== 180)); const c = (th * r) / 180; const { A, B, f } = arcFig(rng, th, { r, label: "x°" });
        return geoInst(rng, {
          stimulus: I(rng, A, B, ` The length of arc $${A}${B}$ is $${c}\\pi$.`), question: rng.pick([`What is the value of $x$?`, `What is the measure, in degrees, of the central angle $x°$?`, `In the figure shown, what is $x$?`]), correct: th,
          wrongs: pos([W(th * 2, "formula_misuse", "πr 로 계산했다."), W(th / 2, "formula_misuse", "2 로 나누었다."), W(c, "step_missing", "호의 길이 계수를 답했다."), W(360 - th, "formula_misuse", "여각을 답했다."), W(th + 15, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== th && Number.isInteger(w.v)),
          verificationJs: figJs({ c }, f, `${CI_JS}const r=radiusLabel(); if (!CAN.length||!/^x/.test(String(CAN[0].label))) throw new Error('x 라벨 없음'); return P.c*180/r;`),
          trace: [[`그림에서 반지름 ${r} 을 읽고 호의 길이 ${c}π 는 지문에서 안다.`, "Read the radius; the arc length is in the text."], [`호의 길이 = x/360 × 2π × ${r} = ${c}π 이다.`, "Set up the arc length formula."], [`x/360 × ${2 * r} = ${c} 이다.`, "Cancel π."], [`x = ${c} × 360 ÷ ${2 * r} = ${th} 이다.`, "Solve for x."], [`따라서 ${th} 이다.`, "State x."]], variant: "central_angle_from_arc_length",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_PI, structure: "중심각이 라디안(π/m 꼴)으로 그림에 라벨되고 반지름이 있을 때 호의 길이 rθ 를 π 로 구함", extra: "라디안은 호의 길이 = r × θ 로 곧바로 계산해야 함(도로 바꿔 2πr 에 곱하는 과정을 틀리면 오답) — medium 은 도",
      concepts: ["호의 길이", "라디안", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const [n, m] = rng.pick([[1, 2], [1, 3], [1, 4], [1, 6], [2, 3], [3, 4], [5, 6]] as [number, number][]); const th = (n * 180) / m; const r = rng.pick([6, 8, 9, 10, 12, 15, 16, 18, 20, 24]); if ((n * r) % m) throw new GenFail("x"); const c = (n * r) / m; const { A, B, f } = arcFig(rng, th, { r, label: rad(n, m) });
        return geoInst(rng, {
          stimulus: I(rng, A, B, " The central angle is given in radians."), question: QARC(rng, A, B), correct: c, fmt: piFmt,
          wrongs: pos([W(2 * r, "step_missing", "원 전체의 둘레를 답했다."), W((n * r) / (2 * m), "formula_misuse", "라디안에 2π 를 곱하지 않고 나누었다."), W(c * 2, "formula_misuse", "배로 계산했다."), W(r, "step_missing", "반지름을 답했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const r=radiusLabel(); if (!CAN.length) throw new Error('중심각 라벨 없음'); return degOf(CAN[0].label)*r/180;`),
          trace: [[`그림에서 중심각 ${rad(n, m)} 라디안과 반지름 ${r} 을 읽는다.`, "Read the angle in radians and the radius."], [`호의 길이 = r × θ 이다(θ 는 라디안).`, "Arc length = rθ."], [`= ${r} × ${rad(n, m)} 이다.`, "Substitute."], [`= ${c}π 이다.`, "Compute."], [`따라서 ${c}π 이다.`, "State the length."]], variant: "arc_from_radians",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_PI, structure: "지름과 중심각(도)이 그림에 라벨된 원에서 반지름 d ÷ 2 를 구한 뒤 호의 길이를 π 로 구함", extra: "지름 → 반지름 → 호의 길이 의 연쇄(지름을 반지름으로 쓰면 두 배가 되어 오답) — medium 은 반지름이 주어짐",
      concepts: ["호의 길이", "지름과 반지름", "중심각"],
      gen(rng) { return retry(rng, () => {
        const [th, r] = rng.pick(ARC_COMBOS().filter(([t]) => t <= 135)); const d = 2 * r; const c = (th * r) / 180; const a = arcFig(rng, th, { a0: rng.int(205, 335 - th) }); const f = withDiam(rng, a.f, d);
        return geoInst(rng, {
          stimulus: I(rng, a.A, a.B, ` The labeled diameter of the circle is shown.`), question: QARC(rng, a.A, a.B), correct: c, fmt: piFmt,
          wrongs: pos([W(c * 2, "formula_misuse", "지름을 반지름으로 썼다."), W(d, "step_missing", "원 전체의 둘레를 답했다."), W(c / 2, "formula_misuse", "2 로 나누었다."), W((th * d) / 180 + 1, "other", "계산 중 어긋났다."), W(r, "step_missing", "반지름을 답했다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); if (!CAN.length) throw new Error('중심각 라벨 없음'); return degOf(CAN[0].label)*(num(dm.label)/2)/180;`),
          trace: [[`그림에서 지름 ${d} 와 중심각 ${th}° 를 읽는다.`, "Read the diameter and the central angle."], [`반지름 = ${d} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."], [`원 전체의 둘레 = ${2 * r}π 이다.`, "Circumference."], [`호의 길이 = ${th}/360 × ${2 * r}π 이다.`, "Fraction of the circumference."], [`따라서 ${c}π 이다.`, "State the length."]], variant: "arc_from_diameter",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "quarter_arc", sprNo: SPR_NO_PI, structure: "중심각 90° 와 반지름이 그림에 있을 때 호의 길이(원의 4분의 1)를 π 로 구함", extra: "easy: 둘레의 1/4", concepts: ["호의 길이", "원의 둘레"],
      gen(rng) { return retry(rng, () => {
        const r = 2 * rng.int(2, 12); const c = r / 2; const { A, B, f } = arcFig(rng, 90, { r });
        return geoInst(rng, { stimulus: I(rng, A, B), question: QARC(rng, A, B), correct: c, fmt: piFmt, wrongs: pos([W(2 * r, "step_missing", "원 전체의 둘레를 답했다."), W(r, "formula_misuse", "πr 를 답했다."), W(c / 2, "formula_misuse", "8 로 나누었다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c), verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const r=radiusLabel(); return degOf(CAN[0].label)*r/180;`), trace: [[`그림에서 중심각 90° 와 반지름 ${r} 을 읽는다.`, "Read the angle and the radius."], [`호는 원의 1/4 이므로 ${2 * r}π ÷ 4 = ${c}π 이다.`, "A quarter of the circumference."]], variant: "quarter_arc_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "degree_arc", sprNo: SPR_NO_PI, structure: "중심각(도)과 반지름이 그림에 있을 때 호의 길이를 구함", extra: "medium: θ/360 곱하기 둘레", concepts: ["호의 길이", "중심각"],
      gen(rng) { return retry(rng, () => {
        const [th, r] = rng.pick(ARC_COMBOS().filter(([t]) => [60, 120, 90].includes(t))); const c = (th * r) / 180; const { A, B, f } = arcFig(rng, th, { r });
        return geoInst(rng, { stimulus: I(rng, A, B), question: QARC(rng, A, B), correct: c, fmt: piFmt, wrongs: pos([W(2 * r, "step_missing", "원 전체의 둘레를 답했다."), W(c * 2, "formula_misuse", "배로 계산했다."), W(th * r / 360, "formula_misuse", "계산을 잘못했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c), verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const r=radiusLabel(); return degOf(CAN[0].label)*r/180;`), trace: [[`그림에서 중심각 ${th}° 와 반지름 ${r} 을 읽는다.`, "Read the angle and the radius."], [`둘레 ${2 * r}π 의 ${th}/360 = ${c}π 이다.`, "Fraction of the circumference."], [`따라서 ${c}π 이다.`, "State the length."]], variant: "degree_arc_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
