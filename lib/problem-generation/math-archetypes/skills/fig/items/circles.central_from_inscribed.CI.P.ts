// circles.central_from_inscribed.CI.P — 원주각이 라벨된 원 그림에서 호·중심각(= 원주각의 두 배)과 큰 호를 구한다.
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CI_JS, CIRC_CTX, CIRC_LEAD, INSC_JS, inscFig } from "../ci-kit";
import { exprLabel } from "../tri-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";
import { GenFail } from "../../../types";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && w.v < 360 && Number.isInteger(w.v));
const I = (rng: Rng, A: string, B: string, P: string, extra = "") => `${rng.pick(CIRC_LEAD)}${rng.pick(CIRC_CTX)}${rng.pick([`In the circle shown, $O$ is the center, and $${A}$, $${B}$, and $${P}$ are points on the circle.`, `The figure shows a circle with center $O$ and points $${A}$, $${B}$, and $${P}$ on the circle.`, `Points $${A}$, $${B}$, and $${P}$ lie on the circle with center $O$ shown in the figure.`, `A circle with center $O$ is shown, with the inscribed angle at $${P}$ marked.`])}${extra}`.replace(/ {2,}/g, " ").trim();
const ex = (a: number, b: number) => exprLabel(a, b).replace(/[()°]/g, "");

const RAW = defineItem({
  prefix: "ci", itemId: "circles.central_from_inscribed.CI.P",
  hard: [
    {
      op: "compose_kind", structure: "큰 호 위의 원주각이 그림에 라벨되었을 때 같은 호를 향한 중심각 AOB(= 원주각의 두 배)를 구함", extra: "원주각이 같은 호의 중심각의 절반임을 써서 두 배 해야 함(원주각을 그대로 답하거나 절반으로 나누면 오답) — medium 은 호의 크기",
      concepts: ["원주각", "중심각", "호"],
      gen(rng) { return retry(rng, () => {
        const a = rng.int(38, 80); const th = 2 * a; const { A, B, P, f } = inscFig(rng, { theta: th, onMajor: true, inscLabel: `${a}°`, centLabel: "x°" });
        return geoInst(rng, {
          stimulus: I(rng, A, B, P), question: rng.pick([`What is the value of $x$?`, `What is the measure, in degrees, of central angle $x°$?`, `In the figure shown, what is $x$?`]), correct: th,
          wrongs: pos([W(a, "step_missing", "원주각을 그대로 답했다."), W(a / 2, "formula_misuse", "절반으로 나누었다."), W(360 - th, "formula_misuse", "큰 호를 답했다."), W(180 - a, "formula_misuse", "보각을 답했다."), W(th + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== th),
          verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const g=INS[0]; if (!g||num(g.label)<=0) throw new Error('원주각 라벨 없음'); const arc=subtended(g); if (Math.abs(arc-2*num(g.label))>1e-6) throw new Error('원주각과 호가 맞지 않음'); const cen=Math.min(arc,360-arc); return cen;`),
          trace: [[`그림에서 원주각 ${a}° 를 읽는다.`, "Read the inscribed angle."], [`원주각은 같은 호의 중심각의 절반이다.`, "An inscribed angle is half of the central angle on the same arc."], [`중심각 x = 2 × ${a}° 이다.`, "Double it."], [`= ${th}° 이다.`, "Compute."], [`따라서 ${th} 이다.`, "State x."]], variant: "central_from_inscribed_basic",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "큰 호 위의 원주각이 그림에 라벨되었을 때 호 AB(작은 호)를 구한 뒤 반대쪽 큰 호의 크기(360° − 호)를 구함", extra: "원주각 → 작은 호(두 배) → 360° 에서 빼기 의 연쇄(작은 호를 그대로 답하면 오답) — medium 은 작은 호",
      concepts: ["원주각", "호", "원 한 바퀴 360°"],
      gen(rng) { return retry(rng, () => {
        const a = rng.int(38, 80); const th = 2 * a; const { A, B, P, f } = inscFig(rng, { theta: th, onMajor: true, inscLabel: `${a}°`, arc: true });
        return geoInst(rng, {
          stimulus: I(rng, A, B, P, ` Arc $${A}${B}$ is highlighted.`), question: rng.pick([`What is the measure, in degrees, of the arc of the circle that is not highlighted?`, `The rest of the circle, outside arc $${A}${B}$, measures how many degrees?`, `What is the measure of the arc from $${B}$ back to $${A}$ that is not highlighted, in degrees?`]), correct: 360 - th,
          wrongs: pos([W(th, "step_missing", "강조된 호를 답했다."), W(a, "step_missing", "원주각을 답했다."), W(360 - a, "formula_misuse", "원주각을 호로 착각했다."), W(180 - th, "formula_misuse", "반원에서 빼서 구했다."), W(360 - th + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== 360 - th),
          verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const g=INS[0]; if (!g||num(g.label)<=0) throw new Error('원주각 라벨 없음'); const arc=subtended(g); if (Math.abs(arc-2*num(g.label))>1e-6) throw new Error('원주각과 호가 맞지 않음'); return 360-arc;`),
          trace: [[`그림에서 원주각 ${a}° 를 읽는다.`, "Read the inscribed angle."], [`호 ${A}${B} = 2 × ${a}° = ${th}° 이다.`, "The arc is twice the inscribed angle."], [`원 한 바퀴는 360° 이다.`, "A full circle is 360°."], [`나머지 호 = 360° - ${th}° = ${360 - th}° 이다.`, "Subtract."], [`따라서 ${360 - th} 이다.`, "State the arc."]], variant: "major_arc_from_inscribed",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "같은 호의 원주각이 (ax + b)°, 중심각이 (cx + d)° 로 라벨된 그림에서 중심각 = 2 × 원주각 을 방정식으로 옮겨 x 를 구한 뒤 원주각의 크기를 구함", extra: "중심각 = 2 × 원주각 으로 식을 세워 x 를 구하고 되돌려야 함(두 식을 같게 놓으면 오답) — medium 은 x 의 값",
      concepts: ["원주각", "중심각", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const x = rng.int(6, 22); const a = rng.int(1, 3), c = rng.int(2, 6); const inV = 2 * x + rng.int(0, 0); void inV; const insc = a * x + rng.nz(-12, 24); const cent = 2 * insc; const b = insc - a * x, d = cent - c * x; if (insc < 58 || insc > 85 || Math.abs(b) > 40 || Math.abs(d) > 70 || c === 2 * a) throw new GenFail("범위");
        const { A, B, P, f } = inscFig(rng, { theta: cent, onMajor: true, inscLabel: exprLabel(a, b), centLabel: exprLabel(c, d) });
        return geoInst(rng, {
          stimulus: I(rng, A, B, P), question: rng.pick([`What is the measure, in degrees, of the inscribed angle at $${P}$?`, `How many degrees is angle $${A}${P}${B}$?`, `What is the degree measure of the angle marked at $${P}$?`]), correct: insc,
          wrongs: pos([W(x, "step_missing", "x 를 답했다."), W(cent, "step_missing", "중심각을 답했다."), W(c * x + d - 0, "other", "중심각 식을 계산했다."), W(Math.round((d - b) / (a - c || 1)), "formula_misuse", "두 식을 같게 놓았다."), W(insc + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== insc),
          verificationJs: figJs({}, f, `${CI_JS}const parse=(l)=>{ const t=String(l).replace(/[°\\s()]/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+)$/.exec(t); if (m) return {a:0,b:Number(m[1])}; throw new Error('형식 오류'); }; if (!INS.length||!CAN.length) throw new Error('라벨 없음'); const I=parse(INS[0].label), C=parse(CAN[0].label); const den=C.a-2*I.a; if (den===0) throw new Error('방정식 퇴화'); const x=(2*I.b-C.b)/den; if (!Number.isInteger(x)) throw new Error('x 정수 아님'); return I.a*x+I.b;`),
          trace: [[`그림에서 원주각 ${ex(a, b)} 와 중심각 ${ex(c, d)} 를 읽는다.`, "Read both labels."], [`중심각 = 2 × 원주각: ${ex(c, d)} = 2(${ex(a, b)}) 이다.`, "The central angle is twice the inscribed angle."], [`x = ${x} 이다.`, "Solve for x."], [`원주각 = ${ex(a, b)} = ${insc}° 이다.`, "Substitute."], [`따라서 ${insc} 이다.`, "State the angle."]], variant: "inscribed_from_expression_labels",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "작은 호 위의 원주각(둔각)이 그림에 라벨되었을 때 그 원주각이 향한 큰 호를 구한 뒤 작은 중심각 AOB 를 거꾸로 구함", extra: "둔각 원주각 → 큰 호(두 배) → 360° 에서 빼서 작은 중심각 의 연쇄(원주각의 두 배를 중심각으로 답하면 오답) — medium 은 큰 호 위의 원주각",
      concepts: ["원주각", "중심각", "큰 호와 작은 호"],
      gen(rng) { return retry(rng, () => {
        const th = rng.pick([60, 70, 80, 90, 100, 110, 120, 130]); const v = 180 - th / 2; const { A, B, P, f } = inscFig(rng, { theta: th, onMajor: false, inscLabel: `${v}°`, centLabel: "x°" });
        return geoInst(rng, {
          stimulus: I(rng, A, B, P), question: rng.pick([`What is the value of $x$?`, `What is the measure, in degrees, of central angle $x°$?`, `In the figure shown, what is $x$?`]), correct: th,
          wrongs: pos([W(2 * v, "formula_misuse", "원주각의 두 배를 답했다."), W(v, "step_missing", "원주각을 답했다."), W(360 - 2 * v + 20, "other", "계산 중 어긋났다."), W(180 - v, "formula_misuse", "보각을 답했다."), W(2 * (180 - v) + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== th),
          verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const g=INS[0]; if (!g||num(g.label)<=0) throw new Error('원주각 라벨 없음'); const arc=subtended(g); if (Math.abs(arc-2*num(g.label))>1e-6) throw new Error('원주각과 호가 맞지 않음'); return Math.min(arc,360-arc);`),
          trace: [[`그림에서 원주각 ${v}° 를 읽는다(점 ${P} 는 작은 호 ${A}${B} 위).`, "Read the inscribed angle; the vertex is on the minor arc."], [`원주각 ${v}° 는 큰 호 ${A}${B} 를 향한다: 큰 호 = 2 × ${v}° = ${2 * v}° 이다.`, "It subtends the major arc."], [`작은 호 = 360° - ${2 * v}° = ${th}° 이다.`, "The minor arc is the rest of the circle."], [`중심각 x 는 작은 호와 같다.`, "The central angle equals the minor arc."], [`따라서 ${th} 이다.`, "State x."]], variant: "central_from_obtuse_inscribed",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "double_inscribed", structure: "원주각이 그림에 라벨되었을 때 같은 호의 중심각을 구함", extra: "easy: 원주각의 두 배", concepts: ["원주각", "중심각"],
      gen(rng) { return retry(rng, () => {
        const a = rng.int(38, 80); const { A, B, P, f } = inscFig(rng, { theta: 2 * a, onMajor: true, inscLabel: `${a}°`, centLabel: "x°" });
        return geoInst(rng, { stimulus: I(rng, A, B, P), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is $x$?`]), correct: 2 * a, wrongs: pos([W(a, "step_missing", "원주각을 답했다."), W(a / 2, "formula_misuse", "절반으로 나누었다."), W(180 - a, "formula_misuse", "보각을 답했다."), W(2 * a + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== 2 * a), verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const g=INS[0]; if (!g||num(g.label)<=0) throw new Error('라벨 없음'); const arc=subtended(g); if (Math.abs(arc-2*num(g.label))>1e-6) throw new Error('불일치'); return Math.min(arc,360-arc);`), trace: [[`그림에서 원주각 ${a}° 를 읽는다.`, "Read the inscribed angle."], [`중심각 = 2 × ${a}° = ${2 * a}° 이다.`, "Central angle is twice the inscribed angle."]], variant: "double_inscribed_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "arc_measure", structure: "원주각이 그림에 라벨되었을 때 호 AB(강조)의 크기를 구함", extra: "medium: 호 = 2 × 원주각", concepts: ["원주각", "호"],
      gen(rng) { return retry(rng, () => {
        const a = rng.int(38, 80); const { A, B, P, f } = inscFig(rng, { theta: 2 * a, onMajor: true, inscLabel: `${a}°`, arc: true });
        return geoInst(rng, { stimulus: I(rng, A, B, P, ` Arc $${A}${B}$ is highlighted.`), question: rng.pick([`What is the measure, in degrees, of arc $${A}${B}$?`, `How many degrees is the highlighted arc?`]), correct: 2 * a, wrongs: pos([W(a, "step_missing", "원주각을 답했다."), W(360 - 2 * a, "formula_misuse", "큰 호를 답했다."), W(a / 2, "formula_misuse", "절반으로 나누었다."), W(2 * a + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== 2 * a), verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const g=INS[0]; if (!g||num(g.label)<=0) throw new Error('라벨 없음'); if (Math.abs(subtended(g)-2*num(g.label))>1e-6) throw new Error('원주각과 호가 맞지 않음'); return 2*num(g.label);`), trace: [[`그림에서 원주각 ${a}° 를 읽는다.`, "Read the inscribed angle."], [`원주각이 향한 호 ${A}${B} = 2 × ${a}° = ${2 * a}° 이다.`, "The arc is twice the inscribed angle."], [`따라서 ${2 * a} 이다.`, "State the arc."]], variant: "arc_from_inscribed_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
