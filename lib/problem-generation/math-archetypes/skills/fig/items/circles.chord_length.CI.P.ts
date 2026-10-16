// circles.chord_length.CI.P — 지름을 한 변으로 하는 원에 내접한 직각삼각형(탈레스)과 반지름·현의 라벨에서 다른 현의 길이·넓이·반지름을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CI_JS, CIRC_CTX, CIRC_LEAD, arcPts, circNames, type CircFig } from "../ci-kit";
import { TRIPLES } from "../tri-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const deg = (r: number) => (r * 180) / Math.PI;
/** 지름 AC(수평 근처)·B 는 AB = b 가 되는 자리(Δ = 2 asin(b/d)), 현 AB·BC 와 지름 AC 를 그린다. labels: ab·bc·ac(지름)·r(반지름 라벨, 선택). */
function thalesFig(rng: Rng, b: number, d: number, lab: { ab?: string; bc?: string; ac?: string; r?: string }): { f: CircFig; A: string; B: string; C: string } {
  const [A, B, C] = circNames(rng, 3); const a0 = rng.pick([20, 40, 160, 200, 250]); const delta = deg(2 * Math.asin(b / d));
  const f: CircFig = { type: "circle", points: [{ id: A, angle: a0 }, { id: B, angle: a0 + delta }, { id: C, angle: a0 + 180 }], chords: [{ between: [A, C], diameter: true, ...(lab.ac !== undefined ? { label: lab.ac } : {}) }, { between: [A, B], ...(lab.ab !== undefined ? { label: lab.ab } : {}) }, { between: [B, C], ...(lab.bc !== undefined ? { label: lab.bc } : {}) }], ...(lab.r !== undefined ? { radii: [{ to: B, label: lab.r }] } : {}) };
  return { f, A, B, C };
}
const I = (rng: Rng, A: string, B: string, C: string, extra = "") => `${rng.pick(CIRC_LEAD)}${rng.pick(CIRC_CTX)}${rng.pick([`In the circle shown, $${A}${C}$ is a diameter and $${B}$ is a point on the circle.`, `The figure shows a circle with diameter $${A}${C}$ and point $${B}$ on the circle, with chords $${A}${B}$ and $${B}${C}$ drawn.`, `Chords $${A}${B}$ and $${B}${C}$ of the circle shown are drawn from a point $${B}$ to the ends of diameter $${A}${C}$.`, `A circle with center $O$ is shown; $${A}${C}$ is a diameter, and $${B}$ lies on the circle.`])}${extra}`.replace(/ {2,}/g, " ").trim();
const trip = (rng: Rng, hypEven = false): [number, number, number] => { for (let i = 0; i < 30; i++) { const [a, b, c] = rng.pick(TRIPLES); const k = rng.pick([1, 1, 2]); const [x, y, z] = [a * k, b * k, c * k]; if (z > 50) continue; if (hypEven && z % 2) continue; return rng.chance(0.5) ? [x, y, z] : [y, x, z]; } throw new GenFail("삼각"); };

const RAW = defineItem({
  prefix: "ci", itemId: "circles.chord_length.CI.P",
  hard: [
    {
      op: "compose_kind", structure: "지름 AC 와 현 AB 가 그림에 라벨되었을 때 지름에 대한 원주각이 직각임을 써서 현 BC 의 길이를 피타고라스로 구함", extra: "반원에 대한 원주각은 직각이라 지름이 빗변임을 알아야 함(지름을 직각변으로 쓰거나 합을 답하면 오답) — medium 은 반지름이 주어짐",
      concepts: ["지름과 원주각(직각)", "피타고라스 정리", "현의 길이"],
      gen(rng) { return retry(rng, () => {
        const [b, c, d] = trip(rng); const { f, A, B, C } = thalesFig(rng, b, d, { ab: String(b), ac: String(d) });
        return geoInst(rng, {
          stimulus: I(rng, A, B, C), question: rng.pick([`What is the length of chord $${B}${C}$?`, `How long is $${B}${C}$?`, `Find the length of chord $${B}${C}$.`]), correct: c,
          wrongs: pos([W(d - b, "formula_misuse", "차를 답했다."), W(Math.sqrt(d * d + b * b), "formula_misuse", "지름을 직각변으로 썼다."), W(d * d - b * b, "step_missing", "제곱근을 취하지 않았다."), W(c + 1, "other", "계산 중 어긋났다."), W(d + b, "formula_misuse", "합을 답했다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}const dm=CHD.find(x=>x.diameter&&num(x.label)>0); const ab=CHD.find(x=>!x.diameter&&num(x.label)>0); if (!dm||!ab) throw new Error('라벨 없음'); const d=num(dm.label), b=num(ab.label); if (!(d>b)) throw new Error('지름이 현보다 커야 함'); const c=Math.sqrt(d*d-b*b); if (Math.abs(c-Math.round(c))>1e-9) throw new Error('정수 아님'); return Math.round(c);`),
          trace: [[`그림에서 지름 ${A}${C} = ${d} 와 현 ${A}${B} = ${b} 를 읽는다.`, "Read the diameter and one chord."], [`지름에 대한 원주각은 직각이므로 ${B} 에서 직각이다.`, "An angle inscribed in a semicircle is a right angle."], [`${A}${C} 가 빗변: ${B}${C}² = ${d}² - ${b}² = ${d * d - b * b} 이다.`, "Pythagorean theorem."], [`${B}${C} = ${c} 이다.`, "Take the square root."], [`따라서 ${c} 이다.`, "State the length."]], variant: "chord_from_diameter_thales",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "지름 AC 와 현 AB 가 그림에 라벨되었을 때 현 BC 를 구한 뒤 직각삼각형 ABC 의 넓이를 구함", extra: "지름 → 직각 → BC(피타고라스) → ½ × AB × BC 의 연쇄(지름을 변으로 쓰면 오답) — medium 은 현의 길이",
      concepts: ["지름과 원주각(직각)", "피타고라스 정리", "직각삼각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const [b, c, d] = trip(rng); if ((b * c) % 2) throw new GenFail("홀수"); const T = (b * c) / 2; const { f, A, B, C } = thalesFig(rng, b, d, { ab: String(b), ac: String(d) });
        return geoInst(rng, {
          stimulus: I(rng, A, B, C), question: rng.pick([`What is the area of triangle $${A}${B}${C}$?`, `Find the area of triangle $${A}${B}${C}$ inscribed in the circle.`]), correct: T,
          wrongs: pos([W(b * c, "step_missing", "½ 를 빠뜨렸다."), W((b * d) / 2, "formula_misuse", "지름을 직각변으로 썼다."), W(c, "step_missing", "BC 만 답했다."), W(T + b, "other", "계산 중 어긋났다."), W((d * d) / 4, "formula_misuse", "원의 반지름으로 계산했다.")]).filter((w) => w.v !== T && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}const dm=CHD.find(x=>x.diameter&&num(x.label)>0); const ab=CHD.find(x=>!x.diameter&&num(x.label)>0); if (!dm||!ab) throw new Error('라벨 없음'); const d=num(dm.label), b=num(ab.label); if (!(d>b)) throw new Error('지름이 현보다 커야 함'); const c=Math.sqrt(d*d-b*b); if (Math.abs(c-Math.round(c))>1e-9) throw new Error('정수 아님'); return b*Math.round(c)/2;`),
          trace: [[`그림에서 지름 ${A}${C} = ${d} 와 현 ${A}${B} = ${b} 를 읽는다.`, "Read the diameter and the chord."], [`지름에 대한 원주각은 직각이다.`, "Right angle at B."], [`${B}${C}² = ${d}² - ${b}² = ${c * c} 이므로 ${B}${C} = ${c} 이다.`, "Pythagorean theorem."], [`넓이 = ½ × ${b} × ${c} 이다.`, "Right triangle area."], [`따라서 ${T} 이다.`, "State the area."]], variant: "triangle_area_in_semicircle",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "반지름이 그림에 라벨되고 현 AB 가 있을 때 지름 = 2 × 반지름 으로 바꿔 지름에 대한 직각삼각형으로 현 BC 를 구함", extra: "반지름을 지름으로 바꿔(2배) 빗변으로 써야 함(반지름을 빗변으로 쓰면 오답) — medium 은 지름이 주어짐",
      concepts: ["지름과 반지름", "지름과 원주각(직각)", "피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const [b, c, d] = trip(rng, true); const r = d / 2; const { f, A, B, C } = thalesFig(rng, b, d, { ab: String(b), r: String(r) });
        return geoInst(rng, {
          stimulus: I(rng, A, B, C), question: rng.pick([`What is the length of chord $${B}${C}$?`, `How long is $${B}${C}$?`, `Find the length of chord $${B}${C}$.`]), correct: c,
          wrongs: pos([W(Math.sqrt(Math.max(r * r - b * b, 1)), "formula_misuse", "반지름을 빗변으로 썼다."), W(d - b, "formula_misuse", "차를 답했다."), W(r + b, "formula_misuse", "합을 답했다."), W(c + 1, "other", "계산 중 어긋났다."), W(d * d - b * b, "step_missing", "제곱근을 취하지 않았다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}const r=radiusLabel(); const ab=CHD.find(x=>!x.diameter&&num(x.label)>0); if (!ab) throw new Error('현 라벨 없음'); const b=num(ab.label), d=2*r; if (!(d>b)) throw new Error('지름이 현보다 커야 함'); const c=Math.sqrt(d*d-b*b); if (Math.abs(c-Math.round(c))>1e-9) throw new Error('정수 아님'); return Math.round(c);`),
          trace: [[`그림에서 반지름 ${r} 과 현 ${A}${B} = ${b} 를 읽는다.`, "Read the radius and the chord."], [`지름 ${A}${C} = 2 × ${r} = ${d} 이다.`, "The diameter is twice the radius."], [`지름에 대한 원주각은 직각이므로 ${B}${C}² = ${d}² - ${b}² 이다.`, "Right angle at B; AC is the hypotenuse."], [`= ${c * c} 이므로 ${B}${C} = ${c} 이다.`, "Take the square root."], [`따라서 ${c} 이다.`, "State the length."]], variant: "chord_from_radius_thales",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "두 현 AB·BC 가 그림에 라벨되고 AC 가 지름일 때 지름 = 빗변으로 반지름을 거꾸로 구함", extra: "두 현이 직각삼각형의 직각변이라 지름 = √(b² + c²) 이고 반지름은 그 절반임을 써야 함(지름을 반지름으로 답하면 오답) — medium 은 현의 길이",
      concepts: ["지름과 원주각(직각)", "피타고라스 정리", "반지름"],
      gen(rng) { return retry(rng, () => {
        const [b, c, d] = trip(rng, true); const r = d / 2; const { f, A, B, C } = thalesFig(rng, b, d, { ab: String(b), bc: String(c), ac: "d" });
        return geoInst(rng, {
          stimulus: I(rng, A, B, C, ` The diameter is labeled $d$.`), question: rng.pick([`What is the radius of the circle?`, `How long is the radius of the circle?`, `Find the radius of the circle.`]), correct: r,
          wrongs: pos([W(d, "step_missing", "지름을 답했다."), W(b + c, "formula_misuse", "두 현의 합을 답했다."), W((b + c) / 2, "formula_misuse", "합의 반을 답했다."), W(r + 1, "other", "계산 중 어긋났다."), W(b * b + c * c, "step_missing", "제곱근을 취하지 않았다.")]).filter((w) => w.v !== r && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}const ls=CHD.filter(x=>!x.diameter&&num(x.label)>0).map(x=>num(x.label)); const dm=CHD.find(x=>x.diameter); if (ls.length!==2||!dm||dm.label!=='d') throw new Error('라벨 오류'); const d=Math.sqrt(ls[0]*ls[0]+ls[1]*ls[1]); if (Math.abs(d-Math.round(d))>1e-9) throw new Error('정수 아님'); if (Math.round(d)%2) throw new Error('반지름이 정수 아님'); return Math.round(d)/2;`),
          trace: [[`그림에서 현 ${A}${B} = ${b}, ${B}${C} = ${c} 를 읽는다.`, "Read the two chords."], [`${A}${C} 는 지름이므로 ${B} 에서 직각이다.`, "Right angle at B."], [`d² = ${b}² + ${c}² = ${b * b + c * c} 이므로 d = ${d} 이다.`, "Pythagorean theorem."], [`반지름 = ${d} ÷ 2 = ${r} 이다.`, "Radius is half the diameter."], [`따라서 ${r} 이다.`, "State the radius."]], variant: "radius_from_two_chords",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "equilateral_chord", structure: "반지름과 중심각 60° 가 그림에 있을 때 현의 길이(정삼각형의 한 변 = 반지름)를 구함", extra: "easy: 중심각 60° 면 현 = 반지름", concepts: ["현의 길이", "정삼각형"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(3, 20); const [A, B] = circNames(rng, 2); const a0 = rng.pick([20, 70, 150, 220]); const f: CircFig = { type: "circle", points: arcPts(A, B, a0, 60), radii: [{ to: B, label: String(r) }], chords: [{ between: [A, B] }], centralAngles: [{ between: [A, B], label: "60°" }] };
        return geoInst(rng, { stimulus: `${rng.pick(CIRC_LEAD)}${rng.pick([`In the circle shown, $O$ is the center, and chord $${A}${B}$ is drawn.`, `The figure shows a circle with center $O$ and chord $${A}${B}$.`])}`.replace(/ {2,}/g, " ").trim(), question: rng.pick([`What is the length of chord $${A}${B}$?`, `How long is chord $${A}${B}$?`, `Find the length of chord $${A}${B}$.`]), correct: r, wrongs: pos([W(2 * r, "formula_misuse", "지름을 답했다."), W(r / 2, "formula_misuse", "절반을 답했다."), W(r + 1, "other", "계산 중 어긋났다."), W(60, "step_missing", "각을 답했다.")]).filter((w) => w.v !== r && Number.isInteger(w.v)), verificationJs: figJs({}, f, `${CI_JS}const r=radiusLabel(); if (!CAN.length||num(CAN[0].label)!==60) throw new Error('60° 중심각 필요'); return r;`), trace: [[`그림에서 반지름 ${r} 과 중심각 60° 를 읽는다.`, "Read the radius and the 60° central angle."], [`삼각형 O${A}${B} 는 두 변이 반지름이고 끼인각이 60° 인 정삼각형이다.`, "An equilateral triangle."], [`현 ${A}${B} = ${r} 이다.`, "The chord equals the radius."]], variant: "chord_equilateral_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "thales_basic", structure: "지름과 한 현이 그림에 있을 때 다른 현의 길이를 피타고라스로 구함", extra: "medium: 지름에 대한 직각삼각형", concepts: ["지름과 원주각(직각)", "피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const [b, c, d] = trip(rng); const { f, A, B, C } = thalesFig(rng, b, d, { ab: String(b), ac: String(d) });
        return geoInst(rng, { stimulus: I(rng, A, B, C), question: rng.pick([`What is the length of chord $${B}${C}$?`, `Find the length of chord $${B}${C}$.`]), correct: c, wrongs: pos([W(d - b, "formula_misuse", "차를 답했다."), W(d + b, "formula_misuse", "합을 답했다."), W(d * d - b * b, "step_missing", "제곱근을 취하지 않았다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== c && Number.isInteger(w.v)), verificationJs: figJs({}, f, `${CI_JS}const dm=CHD.find(x=>x.diameter&&num(x.label)>0); const ab=CHD.find(x=>!x.diameter&&num(x.label)>0); if (!dm||!ab) throw new Error('라벨 없음'); const d=num(dm.label), b=num(ab.label); const c=Math.sqrt(d*d-b*b); if (Math.abs(c-Math.round(c))>1e-9) throw new Error('정수 아님'); return Math.round(c);`), trace: [[`그림에서 지름 ${d} 와 현 ${b} 를 읽는다.`, "Read the diameter and the chord."], [`지름에 대한 원주각은 직각이므로 ${B}${C}² = ${d}² - ${b}² = ${c * c} 이다.`, "Right angle; Pythagorean theorem."], [`따라서 ${c} 이다.`, "State the length."]], variant: "chord_thales_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
