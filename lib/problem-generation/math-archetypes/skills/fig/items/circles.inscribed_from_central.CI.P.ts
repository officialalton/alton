// circles.inscribed_from_central.CI.P — 중심각이 라벨된 원 그림에서 같은 호의 원주각(= 중심각의 절반)과 큰 호 위·작은 호 위의 원주각을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CI_JS, CIRC_CTX, CIRC_LEAD, INSC_JS, inscFig } from "../ci-kit";
import { exprLabel } from "../tri-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && w.v < 360 && Number.isInteger(w.v));
const I = (rng: Rng, A: string, B: string, P: string, extra = "") => `${rng.pick(CIRC_LEAD)}${rng.pick(CIRC_CTX)}${rng.pick([`In the circle shown, $O$ is the center, and $${A}$, $${B}$, and $${P}$ are points on the circle.`, `The figure shows a circle with center $O$ and points $${A}$, $${B}$, and $${P}$ on the circle.`, `Points $${A}$, $${B}$, and $${P}$ lie on the circle with center $O$ shown in the figure.`, `A circle with center $O$ is shown, with central angle $${A}O${B}$ and the point $${P}$ marked.`])}${extra}`.replace(/ {2,}/g, " ").trim();
const ex = (a: number, b: number) => exprLabel(a, b).replace(/[()°]/g, "");
const QP = (rng: Rng, A: string, B: string, P: string) => rng.pick([`What is the measure, in degrees, of angle $${A}${P}${B}$?`, `What is the degree measure of the inscribed angle at $${P}$?`, `How many degrees is $\\angle ${A}${P}${B}$?`.replace("$\\angle ", "angle $").replace("$?", "$?")]);

const RAW = defineItem({
  prefix: "ci", itemId: "circles.inscribed_from_central.CI.P",
  hard: [
    {
      op: "compose_kind", structure: "중심각 AOB 가 그림에 라벨되었을 때 큰 호 위의 점 P 에서의 원주각 APB(= 중심각의 절반)를 구함", extra: "같은 호를 향한 원주각이 중심각의 절반임을 써야 함(중심각을 그대로 답하거나 두 배 하면 오답) — medium 은 호의 크기",
      concepts: ["원주각", "중심각"],
      gen(rng) { return retry(rng, () => {
        const th = 2 * rng.int(38, 85); const v = th / 2; const { A, B, P, f } = inscFig(rng, { theta: th, onMajor: true, centLabel: `${th}°`, inscLabel: "x°" });
        return geoInst(rng, {
          stimulus: I(rng, A, B, P), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is $x$?`, `What is the measure, in degrees, of inscribed angle $x°$?`]), correct: v,
          wrongs: pos([W(th, "step_missing", "중심각을 그대로 답했다."), W(2 * th, "formula_misuse", "두 배로 계산했다."), W(180 - v, "formula_misuse", "보각을 답했다."), W(360 - th, "formula_misuse", "큰 호를 답했다."), W(v + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== v),
          verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const c=CAN[0]; if (!c||num(c.label)<=0) throw new Error('중심각 라벨 없음'); const g=INS[0]; if (!g||!/^x/.test(String(g.label))) throw new Error('x 라벨 없음'); const arc=subtended(g); if (Math.abs(arc-num(c.label))>1e-6) throw new Error('중심각과 호가 맞지 않음'); return num(c.label)/2;`),
          trace: [[`그림에서 중심각 ${th}° 를 읽는다.`, "Read the central angle."], [`원주각은 같은 호의 중심각의 절반이다.`, "An inscribed angle is half of the central angle on the same arc."], [`x = ${th}° ÷ 2 이다.`, "Halve it."], [`= ${v}° 이다.`, "Compute."], [`따라서 ${v} 이다.`, "State x."]], variant: "inscribed_from_central_basic",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "중심각 AOB 가 그림에 라벨되고 점 P 가 작은 호 위에 있을 때 큰 호를 구한 뒤 원주각 APB = 180° − 중심각/2 를 구함", extra: "작은 호 위의 원주각은 큰 호의 절반 = 180° − θ/2 임을 써야 함(θ/2 로 답하면 오답) — medium 은 큰 호 위",
      concepts: ["원주각", "큰 호와 작은 호", "중심각"],
      gen(rng) { return retry(rng, () => {
        const th = 2 * rng.int(25, 65); const v = 180 - th / 2; const { A, B, P, f } = inscFig(rng, { theta: th, onMajor: false, centLabel: `${th}°`, inscLabel: "x°" });
        return geoInst(rng, {
          stimulus: I(rng, A, B, P), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is $x$?`, `What is the measure, in degrees, of inscribed angle $x°$?`]), correct: v,
          wrongs: pos([W(th / 2, "formula_misuse", "큰 호 위의 원주각으로 계산했다."), W(th, "step_missing", "중심각을 답했다."), W(360 - th, "formula_misuse", "큰 호를 답했다."), W(180 - th, "formula_misuse", "보각을 답했다."), W(v + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== v),
          verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const c=CAN[0]; if (!c||num(c.label)<=0) throw new Error('중심각 라벨 없음'); const g=INS[0]; if (!g||!/^x/.test(String(g.label))) throw new Error('x 라벨 없음'); const arc=subtended(g); const cen=num(c.label); if (Math.abs(Math.min(arc,360-arc)-cen)>1e-6) throw new Error('중심각과 호가 맞지 않음'); return arc/2;`),
          trace: [[`그림에서 중심각 ${th}° 를 읽고, 점 ${P} 가 작은 호 ${A}${B} 위에 있음을 본다.`, "Read the central angle; the vertex is on the minor arc."], [`${P} 의 원주각은 큰 호 ${A}${B} 를 향한다: 큰 호 = 360° - ${th}° = ${360 - th}° 이다.`, "The inscribed angle subtends the major arc."], [`원주각 = ${360 - th}° ÷ 2 이다.`, "Half of the arc."], [`= ${v}° 이다.`, "Compute."], [`따라서 ${v} 이다.`, "State x."]], variant: "inscribed_on_minor_arc",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "같은 호의 중심각이 (cx + d)°, 원주각이 (ax + b)° 로 라벨된 그림에서 중심각 = 2 × 원주각 을 방정식으로 옮겨 x 를 구한 뒤 중심각의 크기를 구함", extra: "중심각 = 2 × 원주각 으로 식을 세워 x 를 구하고 중심각에 되돌려야 함(원주각을 답하면 오답) — medium 은 x 의 값",
      concepts: ["원주각", "중심각", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const x = rng.int(6, 22); const a = rng.int(1, 3), c = rng.int(2, 6); const insc = a * x + rng.nz(-12, 24); const cent = 2 * insc; const b = insc - a * x, d = cent - c * x; if (insc < 58 || insc > 85 || Math.abs(b) > 40 || Math.abs(d) > 70 || c === 2 * a) throw new GenFail("범위");
        const { A, B, P, f } = inscFig(rng, { theta: cent, onMajor: true, inscLabel: exprLabel(a, b), centLabel: exprLabel(c, d) });
        return geoInst(rng, {
          stimulus: I(rng, A, B, P), question: rng.pick([`What is the measure, in degrees, of central angle $${A}O${B}$?`, `What is the degree measure of the central angle?`, `How many degrees is the central angle marked at $O$?`]), correct: cent,
          wrongs: pos([W(insc, "step_missing", "원주각을 답했다."), W(x, "step_missing", "x 를 답했다."), W(insc * 4, "formula_misuse", "네 배로 계산했다."), W(Math.round((d - b) / (a - c || 1)), "formula_misuse", "두 식을 같게 놓았다."), W(cent + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== cent),
          verificationJs: figJs({}, f, `${CI_JS}const parse=(l)=>{ const t=String(l).replace(/[°\\s()]/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+)$/.exec(t); if (m) return {a:0,b:Number(m[1])}; throw new Error('형식 오류'); }; if (!INS.length||!CAN.length) throw new Error('라벨 없음'); const I=parse(INS[0].label), C=parse(CAN[0].label); const den=C.a-2*I.a; if (den===0) throw new Error('방정식 퇴화'); const x=(2*I.b-C.b)/den; if (!Number.isInteger(x)) throw new Error('x 정수 아님'); return C.a*x+C.b;`),
          trace: [[`그림에서 중심각 ${ex(c, d)} 와 원주각 ${ex(a, b)} 를 읽는다.`, "Read both labels."], [`중심각 = 2 × 원주각: ${ex(c, d)} = 2(${ex(a, b)}) 이다.`, "The central angle is twice the inscribed angle."], [`x = ${x} 이다.`, "Solve for x."], [`중심각 = ${ex(c, d)} = ${cent}° 이다.`, "Substitute."], [`따라서 ${cent} 이다.`, "State the angle."]], variant: "central_from_expression_labels",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "호 AB 의 크기가 지문에 주어지고 원주각이 그림에 x° 로 라벨되었을 때 호의 절반으로 x 를 거꾸로 구함", extra: "원주각 = 호의 절반 을 써서 거꾸로 구해야 함(호를 그대로 답하거나 두 배 하면 오답) — medium 은 중심각",
      concepts: ["원주각", "호"],
      gen(rng) { return retry(rng, () => {
        const th = 2 * rng.int(38, 85); const v = th / 2; const { A, B, P, f } = inscFig(rng, { theta: th, onMajor: true, inscLabel: "x°", arc: `${th}°` });
        return geoInst(rng, {
          stimulus: I(rng, A, B, P, ` Arc $${A}${B}$ is highlighted and labeled with its measure.`), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is $x$?`, `What is the measure, in degrees, of inscribed angle $x°$?`]), correct: v,
          wrongs: pos([W(th, "step_missing", "호를 그대로 답했다."), W(2 * th, "formula_misuse", "두 배로 계산했다."), W(180 - v, "formula_misuse", "보각을 답했다."), W(360 - th, "formula_misuse", "큰 호를 답했다."), W(v + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== v),
          verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const g=INS[0]; if (!g||!/^x/.test(String(g.label))) throw new Error('x 라벨 없음'); const a=ARC[0]; if (!a||num(a.label)<=0) throw new Error('호 라벨 없음'); const arc=subtended(g); if (Math.abs(arc-num(a.label))>1e-6) throw new Error('호가 맞지 않음'); return num(a.label)/2;`),
          trace: [[`그림에서 호 ${A}${B} 의 크기 ${th}° 를 읽는다.`, "Read the arc measure from the figure."], [`원주각은 같은 호의 절반이다.`, "An inscribed angle is half of its arc."], [`x = ${th}° ÷ 2 이다.`, "Halve it."], [`= ${v}° 이다.`, "Compute."], [`따라서 ${v} 이다.`, "State x."]], variant: "inscribed_from_arc",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "half_central", structure: "중심각이 그림에 라벨되었을 때 같은 호의 원주각을 구함", extra: "easy: 중심각의 절반", concepts: ["원주각", "중심각"],
      gen(rng) { return retry(rng, () => {
        const th = 2 * rng.int(38, 85); const { A, B, P, f } = inscFig(rng, { theta: th, onMajor: true, centLabel: `${th}°`, inscLabel: "x°" });
        return geoInst(rng, { stimulus: I(rng, A, B, P), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is $x$?`]), correct: th / 2, wrongs: pos([W(th, "step_missing", "중심각을 답했다."), W(2 * th, "formula_misuse", "두 배로 계산했다."), W(180 - th / 2, "formula_misuse", "보각을 답했다."), W(th / 2 + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== th / 2), verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const c=CAN[0]; if (!c||num(c.label)<=0) throw new Error('라벨 없음'); const g=INS[0]; const arc=subtended(g); if (Math.abs(arc-num(c.label))>1e-6) throw new Error('불일치'); return num(c.label)/2;`), trace: [[`그림에서 중심각 ${th}° 를 읽는다.`, "Read the central angle."], [`원주각 x = ${th}° ÷ 2 = ${th / 2}° 이다.`, "Half of the central angle."]], variant: "half_central_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "arc_from_central", structure: "중심각이 그림에 라벨되었을 때 큰 호 위의 원주각을 구함(호 강조)", extra: "medium: 호 = 중심각, 원주각 = 호의 절반", concepts: ["원주각", "호", "중심각"],
      gen(rng) { return retry(rng, () => {
        const th = 2 * rng.int(38, 85); const { A, B, P, f } = inscFig(rng, { theta: th, onMajor: true, centLabel: `${th}°`, inscLabel: "x°", arc: true });
        return geoInst(rng, { stimulus: I(rng, A, B, P, ` Arc $${A}${B}$ is highlighted.`), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is $x$?`]), correct: th / 2, wrongs: pos([W(th, "step_missing", "중심각을 답했다."), W(360 - th, "formula_misuse", "큰 호를 답했다."), W(180 - th / 2, "formula_misuse", "보각을 답했다."), W(th / 2 + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== th / 2), verificationJs: figJs({}, f, `${CI_JS}${INSC_JS}const c=CAN[0]; if (!c||num(c.label)<=0) throw new Error('라벨 없음'); const g=INS[0]; const arc=subtended(g); if (Math.abs(arc-num(c.label))>1e-6) throw new Error('불일치'); return num(c.label)/2;`), trace: [[`그림에서 중심각 ${th}° 는 호 ${A}${B} 의 크기와 같다.`, "The central angle equals the arc."], [`원주각 = 호 ÷ 2 = ${th / 2}° 이다.`, "Half of the arc."], [`따라서 ${th / 2} 이다.`, "State x."]], variant: "inscribed_from_arc_medium" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
