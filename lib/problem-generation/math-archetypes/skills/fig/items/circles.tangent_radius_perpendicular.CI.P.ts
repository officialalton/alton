// circles.tangent_radius_perpendicular.CI.P — 접선과 반지름이 직각임을 써서(직각삼각형 OAP) 그림의 반지름·접선 길이·지름 라벨에서 OP·접선 길이·넓이를 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CI_JS, CIRC_CTX, CIRC_LEAD, circNames, type CircFig } from "../ci-kit";
import { TRIPLES } from "../tri-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const TAN_JS = "const TG=TAN[0]; if (!TG||!TG.external) throw new Error('접선 없음'); const tl=num(TG.label);\n";
function tanFig(rng: Rng, o: { r?: number; t?: number; d?: number }): { f: CircFig; A: string; B: string; P: string } {
  const [A, B, P] = circNames(rng, 3); const a = rng.pick([20, 35, 50, 150, 200, 320]);
  const f: CircFig = { type: "circle", points: [{ id: A, angle: a }, ...(o.d !== undefined ? [{ id: B, angle: a + 180 }] : [])], ...(o.r !== undefined ? { radii: [{ to: A, label: String(o.r) }] } : {}), ...(o.d !== undefined ? { chords: [{ between: [A, B] as [string, string], label: String(o.d), diameter: true }] } : {}), tangents: [{ at: A, external: P, ...(o.t !== undefined ? { label: String(o.t) } : {}) }], notToScale: true };
  return { f, A, B, P };
}
const I = (rng: Rng, A: string, P: string, extra = "") => `${rng.pick(CIRC_LEAD)}${rng.pick(CIRC_CTX)}${rng.pick([`In the figure, $O$ is the center of the circle, and line $${A}${P}$ is tangent to the circle at $${A}$.`, `The figure shows a circle with center $O$ and tangent $${A}${P}$ touching the circle at $${A}$.`, `Line $${A}${P}$ touches the circle with center $O$ at exactly one point, $${A}$, as shown in the figure.`, `A circle with center $O$ is shown, and $${P}$ lies on the tangent line at $${A}$.`])}${extra}`.replace(/ {2,}/g, " ").trim();
const trip = (rng: Rng, scale = [1, 1, 2]): [number, number, number] => { const [a, b, c] = rng.pick(TRIPLES); const k = rng.pick(scale); return [a * k, b * k, c * k]; };

const RAW = defineItem({
  prefix: "ci", itemId: "circles.tangent_radius_perpendicular.CI.P",
  hard: [
    {
      op: "compose_kind", structure: "접선이 반지름에 수직임을 써서 반지름 OA 와 접선의 길이 AP 가 그림에 라벨되었을 때 OP 의 길이를 피타고라스로 구함", extra: "접점에서 반지름과 접선이 직각이므로 OP 가 빗변임을 알아야 함(두 변을 더하거나 OP 를 직각변으로 보면 오답) — medium 은 접선의 길이",
      concepts: ["접선과 반지름의 수직", "피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const [r0, t0, h] = trip(rng); const [r, t] = rng.chance(0.5) ? [r0, t0] : [t0, r0]; if (h > 50) throw new GenFail("큼"); const { f, A, P } = tanFig(rng, { r, t });
        return geoInst(rng, {
          stimulus: I(rng, A, P), question: rng.pick([`What is the length of $O${P}$?`, `How far is $${P}$ from the center $O$?`, `Find the distance from $O$ to $${P}$.`]), correct: h,
          wrongs: pos([W(r + t, "formula_misuse", "두 변의 합을 답했다."), W(Math.abs(t * t - r * r) ** 0.5, "formula_misuse", "빗변을 직각변으로 보았다."), W(r * t, "formula_misuse", "곱을 답했다."), W(h + 1, "other", "계산 중 어긋났다."), W(r * r + t * t, "formula_misuse", "제곱근을 취하지 않았다.")]).filter((w) => w.v !== h && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}${TAN_JS}if (!(tl>0)) throw new Error('접선 라벨 없음'); const r=radiusLabel(); const h=Math.sqrt(r*r+tl*tl); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return Math.round(h);`),
          trace: [[`그림에서 반지름 ${r}, 접선 ${A}${P} = ${t} 를 읽는다.`, "Read the radius and the tangent length."], [`접선과 반지름은 접점 ${A} 에서 수직이다.`, "A tangent is perpendicular to the radius at the point of tangency."], [`삼각형 O${A}${P} 는 ${A} 에서 직각이고 O${P} 가 빗변이다.`, "Triangle OAP is right-angled at A."], [`O${P}² = ${r}² + ${t}² = ${r * r + t * t} 이므로 O${P} = ${h} 이다.`, "Pythagorean theorem."], [`따라서 ${h} 이다.`, "State the length."]], variant: "op_from_radius_and_tangent",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "반지름이 그림에 라벨되고 O 에서 P 까지의 거리가 지문에 주어질 때 접선의 길이 AP 를 거꾸로 구함", extra: "OP 가 빗변이므로 AP = √(OP² − r²) 으로 구해야 함(OP 와 r 의 차를 답하면 오답) — medium 은 OP",
      concepts: ["접선과 반지름의 수직", "피타고라스 정리", "역산"],
      gen(rng) { return retry(rng, () => {
        const [r0, t0, h] = trip(rng); const [r, t] = rng.chance(0.5) ? [r0, t0] : [t0, r0]; if (h > 50) throw new GenFail("큼"); const { f, A, P } = tanFig(rng, { r });
        return geoInst(rng, {
          stimulus: I(rng, A, P, ` The distance from $O$ to $${P}$ is ${h}.`), question: rng.pick([`What is the length of $${A}${P}$?`, `How long is the tangent segment from $${A}$ to $${P}$?`, `Find the length of tangent segment $${A}${P}$.`]), correct: t,
          wrongs: pos([W(h - r, "formula_misuse", "차를 답했다."), W(h, "step_missing", "OP 를 답했다."), W(h + r, "formula_misuse", "합을 답했다."), W(h * h - r * r, "step_missing", "제곱근을 취하지 않았다."), W(t + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== t && Number.isInteger(w.v)),
          verificationJs: figJs({ h }, f, `${CI_JS}const r=radiusLabel(); if (!(P.h>r)) throw new Error('OP 가 반지름보다 커야 함'); const t=Math.sqrt(P.h*P.h-r*r); if (Math.abs(t-Math.round(t))>1e-9) throw new Error('정수 아님'); return Math.round(t);`),
          trace: [[`그림에서 반지름 ${r} 을 읽고 O${P} = ${h} 는 지문에서 안다.`, "Read the radius; OP is in the text."], [`${A} 에서 접선과 반지름이 수직이므로 삼각형 O${A}${P} 는 직각삼각형이다.`, "Right angle at the point of tangency."], [`${A}${P}² = O${P}² - ${r}² = ${h * h} - ${r * r} 이다.`, "Pythagorean theorem."], [`= ${t * t} 이므로 ${A}${P} = ${t} 이다.`, "Take the square root."], [`따라서 ${t} 이다.`, "State the length."]], variant: "tangent_length_from_op",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "반지름 OA 와 접선의 길이 AP 가 그림에 라벨되었을 때 직각삼각형 OAP 의 넓이를 구함", extra: "접선과 반지름이 직각임을 알아 ½ × OA × AP 로 계산해야 함(빗변을 쓰거나 ½ 를 빠뜨리면 오답) — medium 은 OP",
      concepts: ["접선과 반지름의 수직", "직각삼각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const r = rng.int(3, 15), t = rng.int(4, 20); if ((r * t) % 2) throw new GenFail("홀수"); const T = (r * t) / 2; const { f, A, P } = tanFig(rng, { r, t });
        return geoInst(rng, {
          stimulus: I(rng, A, P), question: rng.pick([`What is the area of triangle $O${A}${P}$?`, `Find the area of the right triangle with vertices $O$, $${A}$, and $${P}$.`]), correct: T,
          wrongs: pos([W(r * t, "step_missing", "½ 를 빠뜨렸다."), W(r + t, "formula_misuse", "합을 답했다."), W((Math.sqrt(r * r + t * t) * r) / 2, "formula_misuse", "빗변을 밑변으로 썼다."), W(T + r, "other", "계산 중 어긋났다."), W((r * r + t * t) / 2, "formula_misuse", "제곱의 합의 반을 답했다.")]).filter((w) => w.v !== T && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}${TAN_JS}if (!(tl>0)) throw new Error('접선 라벨 없음'); return radiusLabel()*tl/2;`),
          trace: [[`그림에서 반지름 ${r}, 접선 ${A}${P} = ${t} 를 읽는다.`, "Read the radius and the tangent length."], [`${A} 에서 접선과 반지름이 수직이므로 삼각형 O${A}${P} 는 ${A} 에서 직각이다.`, "Right angle at A."], [`두 직각변은 ${r} 과 ${t} 이다.`, "The legs."], [`넓이 = ½ × ${r} × ${t} 이다.`, "Right triangle area."], [`따라서 ${T} 이다.`, "State the area."]], variant: "triangle_area_from_tangent",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "지름 AB 가 그림에 라벨되고 접선의 길이가 있을 때 반지름 d ÷ 2 로 바꿔 OP 의 길이를 피타고라스로 구함", extra: "지름을 반으로 나눠 반지름으로 쓰고 OP 를 구해야 함(지름을 반지름으로 쓰면 오답) — medium 은 반지름이 주어짐",
      concepts: ["접선과 반지름의 수직", "지름과 반지름", "피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const [r0, t0, h] = trip(rng, [1, 2]); const r = r0, t = t0; if (h > 50 || r < 3) throw new GenFail("범위"); const d = 2 * r; const { f, A, B, P } = tanFig(rng, { d, t });
        return geoInst(rng, {
          stimulus: I(rng, A, P, ` Segment $${A}${B}$ is a diameter.`), question: rng.pick([`What is the length of $O${P}$?`, `How far is $${P}$ from the center $O$?`, `Find the distance from $O$ to $${P}$.`]), correct: h,
          wrongs: pos([W(Math.sqrt(d * d + t * t), "formula_misuse", "지름을 반지름으로 썼다."), W(r + t, "formula_misuse", "합을 답했다."), W(d + t, "formula_misuse", "지름과 접선을 더했다."), W(h + 1, "other", "계산 중 어긋났다."), W(r * r + t * t, "formula_misuse", "제곱근을 취하지 않았다.")]).filter((w) => w.v !== h && Number.isInteger(w.v)),
          verificationJs: figJs({}, f, `${CI_JS}${TAN_JS}const dm=CHD.find(c=>c.diameter&&num(c.label)>0); if (!dm||!(tl>0)) throw new Error('라벨 없음'); const r=num(dm.label)/2; const h=Math.sqrt(r*r+tl*tl); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return Math.round(h);`),
          trace: [[`그림에서 지름 ${d} 와 접선 ${A}${P} = ${t} 를 읽는다.`, "Read the diameter and the tangent length."], [`반지름 = ${d} ÷ 2 = ${r} 이다.`, "The radius is half the diameter."], [`${A} 에서 접선과 반지름이 수직이므로 O${P}² = ${r}² + ${t}² 이다.`, "Right angle at A; OP is the hypotenuse."], [`= ${r * r + t * t} 이므로 O${P} = ${h} 이다.`, "Take the square root."], [`따라서 ${h} 이다.`, "State the length."]], variant: "op_from_diameter_and_tangent",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "op_length", structure: "반지름과 접선의 길이가 그림에 있을 때 OP 의 길이를 구함", extra: "easy: 직각삼각형의 빗변", concepts: ["접선과 반지름의 수직", "피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const [r, t, h] = trip(rng, [1]); const { f, A, P } = tanFig(rng, { r, t });
        return geoInst(rng, { stimulus: I(rng, A, P), question: rng.pick([`What is the length of $O${P}$?`, `Find the distance from $O$ to $${P}$.`]), correct: h, wrongs: pos([W(r + t, "formula_misuse", "합을 답했다."), W(r * t, "formula_misuse", "곱을 답했다."), W(t * t + r * r, "formula_misuse", "제곱근을 취하지 않았다."), W(h + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== h), verificationJs: figJs({}, f, `${CI_JS}${TAN_JS}const r=radiusLabel(); const h=Math.sqrt(r*r+tl*tl); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 아님'); return Math.round(h);`), trace: [[`그림에서 반지름 ${r}, 접선 ${t} 를 읽는다.`, "Read the radius and the tangent."], [`O${P}² = ${r}² + ${t}² = ${h * h} 이므로 O${P} = ${h} 이다.`, "Pythagorean theorem."]], variant: "op_length_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "tangent_length", structure: "반지름이 그림에 있고 OP 가 지문에 있을 때 접선의 길이를 구함", extra: "medium: 피타고라스의 직각변", concepts: ["접선과 반지름의 수직", "피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const [r, t, h] = trip(rng, [1]); const { f, A, P } = tanFig(rng, { r });
        return geoInst(rng, { stimulus: I(rng, A, P, ` The distance from $O$ to $${P}$ is ${h}.`), question: rng.pick([`What is the length of $${A}${P}$?`, `Find the length of the tangent segment $${A}${P}$.`]), correct: t, wrongs: pos([W(h - r, "formula_misuse", "차를 답했다."), W(h, "step_missing", "OP 를 답했다."), W(h + r, "formula_misuse", "합을 답했다."), W(t + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== t), verificationJs: figJs({ h }, f, `${CI_JS}const r=radiusLabel(); const t=Math.sqrt(P.h*P.h-r*r); if (Math.abs(t-Math.round(t))>1e-9) throw new Error('정수 아님'); return Math.round(t);`), trace: [[`그림에서 반지름 ${r} 을 읽고 O${P} = ${h} 는 지문에서 안다.`, "Read the radius; OP is given."], [`${A} 에서 접선과 반지름이 수직이므로 삼각형 O${A}${P} 는 직각삼각형이다.`, "Right angle at the point of tangency."], [`${A}${P}² = ${h}² - ${r}² = ${t * t} 이므로 ${A}${P} = ${t} 이다.`, "Pythagorean theorem."]], variant: "tangent_length_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
