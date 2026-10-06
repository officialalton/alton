// circles.sector_area.CI.P — 음영 부채꼴 그림의 중심각(도·라디안)·반지름·지름 라벨에서 부채꼴의 넓이를 π 로 구하거나 중심각을 거꾸로 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { ANG_LABEL_JS, CI_JS, CIRC_CTX, CIRC_LEAD, SECTOR_COMBOS, SPR_NO_PI, arcPts, circNames, piFmt, type CircFig } from "../ci-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const secFig = (rng: Rng, theta: number, o: { r?: number; label?: string; a0?: number } = {}): { f: CircFig; A: string; B: string } => {
  const [A, B] = circNames(rng, 2); const a0 = o.a0 ?? rng.pick([10, 25, 40, 100, 150, 200, 250]);
  return { A, B, f: { type: "circle", points: arcPts(A, B, a0, theta), ...(o.r !== undefined ? { radii: [{ to: A, label: String(o.r) }] } : {}), sector: { from: A, to: B }, centralAngles: [{ between: [A, B], label: o.label ?? `${theta}°` }] } };
};
const withDiam = (rng: Rng, f: CircFig, d: number): CircFig => { const [C, D] = circNames(rng, 4).filter((n) => !f.points.some((p) => p.id === n)).slice(0, 2); return { ...f, points: [...f.points, { id: C, angle: 0 }, { id: D, angle: 180 }], chords: [{ between: [C, D], label: String(d), diameter: true }] }; };
const I = (rng: Rng, A: string, B: string, extra = "") => `${rng.pick(CIRC_LEAD)}${rng.pick(CIRC_CTX)}${rng.pick([`In the circle shown, $O$ is the center, and the shaded region is sector $${A}O${B}$.`, `The figure shows a circle with center $O$ and the shaded sector $${A}O${B}$.`, `Sector $${A}O${B}$ of the circle with center $O$ is shaded in the figure.`, `A circle with center $O$ is shown, and the sector bounded by $O${A}$ and $O${B}$ is shaded.`])}${extra}`.replace(/ {2,}/g, " ").trim();
const QA = (rng: Rng) => rng.pick([`What is the area of the shaded sector, in terms of $\\pi$?`, `Find the area of the shaded region in terms of $\\pi$.`, `How large is the shaded sector's area, in terms of $\\pi$?`]);
const rad = (n: number, m: number) => (n === 1 ? `π/${m}` : `${n}π/${m}`);

const RAW = defineItem({
  prefix: "ci", itemId: "circles.sector_area.CI.P",
  hard: [
    {
      op: "compose_kind", sprNo: SPR_NO_PI, structure: "중심각(도)과 반지름이 그림에 라벨된 음영 부채꼴의 넓이 θ/360 · πr² 을 구함", extra: "중심각이 원 전체의 몇 분의 몇인지 구해 원의 넓이에 곱해야 함(둘레 공식이나 호의 길이를 쓰면 오답) — medium 은 반원",
      concepts: ["부채꼴의 넓이", "중심각", "원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const [th, r] = rng.pick(SECTOR_COMBOS()); const c = (th * r * r) / 360; const { A, B, f } = secFig(rng, th, { r });
        return geoInst(rng, {
          stimulus: I(rng, A, B), question: QA(rng), correct: c, fmt: piFmt,
          wrongs: pos([W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W((th * r) / 180, "formula_misuse", "호의 길이로 계산했다."), W(c * 2, "formula_misuse", "배로 계산했다."), W((th * r * r) / 180, "formula_misuse", "θ/180 으로 계산했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const r=radiusLabel(); if (!CAN.length) throw new Error('중심각 라벨 없음'); return degOf(CAN[0].label)*r*r/360;`),
          trace: [[`그림에서 중심각 ${th}° 와 반지름 ${r} 을 읽는다.`, "Read the central angle and the radius."], [`원의 넓이 = π × ${r}² = ${r * r}π 이다.`, "Area of the whole circle."], [`부채꼴은 원의 ${th}/360 이다.`, "The sector is a fraction of the circle."], [`넓이 = ${th}/360 × ${r * r}π 이다.`, "Multiply."], [`따라서 ${c}π 이다.`, "State the area."]], variant: "sector_from_degree_and_radius",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "부채꼴의 넓이가 지문에 kπ 로 주어지고 반지름이 그림에 라벨될 때 중심각(도)을 거꾸로 구함", extra: "θ = 넓이 ÷ 원의 넓이 × 360 으로 거꾸로 구해야 함(호의 길이 공식으로 풀면 오답) — medium 은 반원",
      concepts: ["부채꼴의 넓이", "중심각", "역산"],
      gen(rng) { return retry(rng, () => {
        const [th, r] = rng.pick(SECTOR_COMBOS().filter(([t]) => t !== 180)); const c = (th * r * r) / 360; const { A, B, f } = secFig(rng, th, { r, label: "x°" });
        return geoInst(rng, {
          stimulus: I(rng, A, B, ` The area of the shaded sector is $${c}\\pi$.`), question: rng.pick([`What is the value of $x$?`, `What is the measure, in degrees, of the central angle $x°$?`, `In the figure shown, what is $x$?`]), correct: th,
          wrongs: pos([W(th * 2, "formula_misuse", "호의 길이 공식으로 풀었다."), W(th / 2, "formula_misuse", "2 로 나누었다."), W(c, "step_missing", "넓이 계수를 답했다."), W(360 - th, "formula_misuse", "여각을 답했다."), W(th + 15, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== th && Number.isInteger(w.v)),
          verificationJs: figJs({ c }, f, `${CI_JS}const r=radiusLabel(); if (!CAN.length||!/^x/.test(String(CAN[0].label))) throw new Error('x 라벨 없음'); return P.c*360/(r*r);`),
          trace: [[`그림에서 반지름 ${r} 을 읽고 부채꼴의 넓이 ${c}π 는 지문에서 안다.`, "Read the radius; the area is in the text."], [`원의 넓이 = ${r * r}π 이다.`, "Area of the whole circle."], [`x/360 × ${r * r}π = ${c}π 이다.`, "Set up the proportion."], [`x = ${c} × 360 ÷ ${r * r} = ${th} 이다.`, "Solve for x."], [`따라서 ${th} 이다.`, "State x."]], variant: "central_angle_from_sector_area",
        }, f);
      }); },
    },
    {
      op: "repr_shift", sprNo: SPR_NO_PI, structure: "중심각이 라디안(π/m 꼴)으로 그림에 라벨되고 반지름이 있을 때 부채꼴의 넓이 ½r²θ 를 π 로 구함", extra: "라디안은 넓이 = ½ r² θ 로 곧바로 계산해야 함(도로 바꾸는 과정을 틀리거나 ½ 를 빠뜨리면 오답) — medium 은 도",
      concepts: ["부채꼴의 넓이", "라디안", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const [n, m] = rng.pick([[1, 2], [1, 3], [1, 4], [1, 6], [2, 3], [3, 4], [5, 6]] as [number, number][]); const th = (n * 180) / m; const r = rng.pick([4, 6, 8, 10, 12, 14, 16, 18, 20]); if ((n * r * r) % (2 * m)) throw new GenFail("x"); const c = (n * r * r) / (2 * m); const { A, B, f } = secFig(rng, th, { r, label: rad(n, m) });
        return geoInst(rng, {
          stimulus: I(rng, A, B, " The central angle is given in radians."), question: QA(rng), correct: c, fmt: piFmt,
          wrongs: pos([W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W(c * 2, "formula_misuse", "½ 를 빠뜨렸다."), W((n * r) / m, "formula_misuse", "호의 길이를 답했다."), W(c + 1, "other", "계산 중 어긋났다."), W(r * r * n / (4 * m), "formula_misuse", "계산을 잘못했다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const r=radiusLabel(); if (!CAN.length) throw new Error('중심각 라벨 없음'); return degOf(CAN[0].label)*r*r/360;`),
          trace: [[`그림에서 중심각 ${rad(n, m)} 라디안과 반지름 ${r} 을 읽는다.`, "Read the angle in radians and the radius."], [`부채꼴의 넓이 = ½ r² θ 이다(θ 는 라디안).`, "Sector area = ½r²θ."], [`= ½ × ${r * r} × ${rad(n, m)} 이다.`, "Substitute."], [`= ${c}π 이다.`, "Compute."], [`따라서 ${c}π 이다.`, "State the area."]], variant: "sector_from_radians",
        }, f);
      }); },
    },
    {
      op: "chain2", sprNo: SPR_NO_PI, structure: "지름과 중심각(도)이 그림에 라벨된 원에서 반지름 d ÷ 2 를 구한 뒤 부채꼴의 넓이를 π 로 구함", extra: "지름 → 반지름 → 부채꼴의 넓이 의 연쇄(지름을 반지름으로 쓰면 네 배가 되어 오답) — medium 은 반지름이 주어짐",
      concepts: ["부채꼴의 넓이", "지름과 반지름", "중심각"],
      gen(rng) { return retry(rng, () => {
        const [th, r] = rng.pick(SECTOR_COMBOS().filter(([t]) => t <= 135)); const d = 2 * r; const c = (th * r * r) / 360; const a = secFig(rng, th, { a0: rng.int(205, 335 - th) }); const f = withDiam(rng, a.f, d);
        return geoInst(rng, {
          stimulus: I(rng, a.A, a.B, " The labeled diameter of the circle is shown."), question: QA(rng), correct: c, fmt: piFmt,
          wrongs: pos([W(c * 4, "formula_misuse", "지름을 반지름으로 썼다."), W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W(c / 2, "formula_misuse", "2 로 나누었다."), W(c + 1, "other", "계산 중 어긋났다."), W((th * r) / 180, "formula_misuse", "호의 길이로 계산했다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm) throw new Error('지름 라벨 없음'); if (!CAN.length) throw new Error('중심각 라벨 없음'); const r=num(dm.label)/2; return degOf(CAN[0].label)*r*r/360;`),
          trace: [[`그림에서 지름 ${d} 와 중심각 ${th}° 를 읽는다.`, "Read the diameter and the central angle."], [`반지름 = ${d} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."], [`원의 넓이 = ${r * r}π 이다.`, "Area of the circle."], [`부채꼴 = ${th}/360 × ${r * r}π 이다.`, "Fraction of the circle."], [`따라서 ${c}π 이다.`, "State the area."]], variant: "sector_from_diameter",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "quarter_sector", sprNo: SPR_NO_PI, structure: "중심각 90° 와 반지름이 그림에 있을 때 부채꼴의 넓이(원의 4분의 1)를 π 로 구함", extra: "easy: 원의 넓이의 1/4", concepts: ["부채꼴의 넓이", "원의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = 2 * rng.int(2, 10); const c = (r * r) / 4; const { A, B, f } = secFig(rng, 90, { r });
        return geoInst(rng, { stimulus: I(rng, A, B), question: QA(rng), correct: c, fmt: piFmt, wrongs: pos([W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W(r / 2, "formula_misuse", "호의 길이를 답했다."), W(c * 2, "formula_misuse", "반원의 넓이를 답했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)), verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const r=radiusLabel(); return degOf(CAN[0].label)*r*r/360;`), trace: [[`그림에서 중심각 90° 와 반지름 ${r} 을 읽는다.`, "Read the angle and the radius."], [`부채꼴은 원의 1/4 이므로 ${r * r}π ÷ 4 = ${c}π 이다.`, "A quarter of the circle."]], variant: "quarter_sector_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "degree_sector", sprNo: SPR_NO_PI, structure: "중심각(도)과 반지름이 그림에 있을 때 부채꼴의 넓이를 구함", extra: "medium: θ/360 곱하기 원의 넓이", concepts: ["부채꼴의 넓이", "중심각"],
      gen(rng) { return retry(rng, () => {
        const [th, r] = rng.pick(SECTOR_COMBOS().filter(([t]) => [60, 120, 90].includes(t))); const c = (th * r * r) / 360; const { A, B, f } = secFig(rng, th, { r });
        return geoInst(rng, { stimulus: I(rng, A, B), question: QA(rng), correct: c, fmt: piFmt, wrongs: pos([W(r * r, "step_missing", "원 전체의 넓이를 답했다."), W(c * 2, "formula_misuse", "배로 계산했다."), W((th * r) / 180, "formula_misuse", "호의 길이로 계산했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)), verificationJs: figJs({}, f, `${CI_JS}${ANG_LABEL_JS}const r=radiusLabel(); return degOf(CAN[0].label)*r*r/360;`), trace: [[`그림에서 중심각 ${th}° 와 반지름 ${r} 을 읽는다.`, "Read the angle and the radius."], [`원의 넓이 ${r * r}π 의 ${th}/360 = ${c}π 이다.`, "Fraction of the circle."], [`따라서 ${c}π 이다.`, "State the area."]], variant: "degree_sector_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
