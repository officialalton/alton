// lines_angles_triangles.isosceles_base_angle.TR.P — 이등변삼각형 그림(AB = AC 눈금)의 꼭지각·밑각 라벨에서 밑각이 같다는 사실과 내각의 합 180°로 x 와 각을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { ISO_JS, exprLabel, isoIntro, isoRead, makeIso } from "../tri-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && w.v < 180);

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.isosceles_base_angle.TR.P",
  hard: [
    {
      op: "chain2", structure: "꼭지각·밑각의 일차식 라벨에서 합 180° 로 x 를 구한 뒤 꼭지각의 크기를 구함", extra: "밑각이 둘이라는 사실을 써서 식을 세워 x 를 구하고 꼭지각에 되돌려야 함(밑각 한 번만 세는 함정) — medium 은 x 의 값",
      concepts: ["이등변삼각형", "밑각", "일차방정식"],
      gen(rng) {
        const t = makeIso(rng); const correct = t.apexDeg;
        return gInst(rng, {
          stimulus: isoIntro(rng, t.v),
          question: rng.pick([`What is the measure, in degrees, of angle $${t.v[0]}$?`, `What is the degree measure of the vertex angle at $${t.v[0]}$?`, `How many degrees is the angle formed by the two equal sides?`]), correct,
          wrongs: pos([W(t.x, "step_missing", "x 를 답했다."), W(t.baseDeg, "other", "밑각을 답했다."), W(180 - t.baseDeg, "formula_misuse", "밑각 한 개만 빼서 구했다."), W(t.apex.a * t.x, "step_missing", "상수항을 더하지 않았다."), W(correct + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${ISO_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return apexD;`),
          trace: [isoRead(t, exprLabel(t.apex.a, t.apex.b), exprLabel(t.base.a, t.base.b)), [`꼭지각 + 밑각 × 2 = 180° 이므로 (${exprLabel(t.apex.a, t.apex.b).replace("°", "")}) + 2(${exprLabel(t.base.a, t.base.b).replace("°", "")}) = 180 이다.`, "Apex angle plus two base angles is 180°."], [`x = ${t.x} 이다.`, "Solve for x."], [`꼭지각 = ${t.apexDeg}° 이다.`, "Substitute."], [`따라서 ${correct} 이다.`, "State the measure."]], variant: "apex_angle_from_expressions",
        }, t.fig);
      },
    },
    {
      op: "compose_kind", structure: "꼭지각·밑각 라벨에서 x 를 구한 뒤 밑각의 크기를 구함", extra: "x 를 구하고 밑각 식에 대입하는 합성(꼭지각을 답하는 함정) — medium 은 x 의 값",
      concepts: ["이등변삼각형", "밑각", "식의 대입"],
      gen(rng) {
        const t = makeIso(rng); const correct = t.baseDeg;
        return gInst(rng, {
          stimulus: isoIntro(rng, t.v),
          question: rng.pick([`What is the measure, in degrees, of angle $${t.v[2]}$?`, `What is the degree measure of one of the base angles?`, `How many degrees does each base angle measure?`]), correct,
          wrongs: pos([W(t.x, "step_missing", "x 를 답했다."), W(t.apexDeg, "other", "꼭지각을 답했다."), W(t.base.a * t.x, "step_missing", "상수항을 더하지 않았다."), W(180 - t.apexDeg, "formula_misuse", "두 밑각의 합을 답했다."), W(correct + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${ISO_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return baseD;`),
          trace: [isoRead(t, exprLabel(t.apex.a, t.apex.b), exprLabel(t.base.a, t.base.b)), [`${t.apex.a + 2 * t.base.a}x ${t.apex.b + 2 * t.base.b < 0 ? "-" : "+"} ${Math.abs(t.apex.b + 2 * t.base.b)} = 180 에서 x = ${t.x} 이다.`, "Solve for x."], [`밑각 = ${exprLabel(t.base.a, t.base.b)} = ${t.baseDeg}° 이다.`, "Substitute into the base angle."], [`두 밑각은 같다.`, "Base angles are equal."], [`따라서 ${correct} 이다.`, "State the measure."]], variant: "base_angle_from_expressions",
        }, t.fig);
      },
    },
    {
      op: "repr_shift", structure: "꼭지각이 x°, 밑각이 k x° (비 라벨)인 이등변삼각형에서 비를 식으로 번역해 합 180° 로 꼭지각을 구함", extra: "밑각이 둘이어서 x + 2·kx = 180 임을 번역해야 함(밑각 한 번만 세는 함정) — medium 은 x 의 값",
      concepts: ["이등변삼각형", "비", "일차방정식"],
      gen(rng) {
        const t = makeIso(rng, { ratio: true });
        return gInst(rng, {
          stimulus: isoIntro(rng, t.v),
          question: rng.pick([`What is the measure, in degrees, of the vertex angle at $${t.v[0]}$?`, `What is the degree measure of the angle formed by the two equal sides?`]), correct: t.apexDeg,
          wrongs: pos([W(t.baseDeg, "other", "밑각을 답했다."), W(Math.round(180 / (1 + t.base.a)), "formula_misuse", "밑각을 한 번만 세었다."), W(60, "formula_misuse", "정삼각형으로 보았다."), W(t.apexDeg * 2, "other", "계산 중 어긋났다."), W(180 - t.apexDeg, "formula_misuse", "두 밑각의 합을 답했다.")]).filter((w) => w.v !== t.apexDeg),
          verificationJs: figJs({}, t.fig, `${ISO_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return apexD;`),
          trace: [isoRead(t, "x°", `${t.base.a}x°`), [`x + 2(${t.base.a}x) = ${1 + 2 * t.base.a}x = 180 이므로 x = ${t.x} 이다.`, "Translate the ratio into an equation."], [`꼭지각 = x = ${t.apexDeg}° 이다.`, "The vertex angle is x."], [`밑각은 ${t.baseDeg}° 이다.`, "Each base angle is k·x."], [`따라서 ${t.apexDeg} 이다.`, "State the measure."]], variant: "apex_angle_from_ratio_labels",
        }, t.fig);
      },
    },
    {
      op: "inverse", structure: "꼭지각이 숫자로 라벨되고 밑각이 x 의 일차식일 때, 밑각 = (180° − 꼭지각) ÷ 2 로 x 를 역산해 x 의 값을 구함", extra: "꼭지각에서 밑각을 먼저 구하고(÷2) 밑각 식을 풀어 x 를 거꾸로 구해야 함 — medium 은 밑각",
      concepts: ["이등변삼각형", "밑각", "역산"],
      gen(rng) {
        const t = makeIso(rng); const fig = { ...t.fig, angles: [{ at: t.v[0], label: `${t.apexDeg}°`, value: t.apexDeg }, { at: t.v[1], label: exprLabel(t.base.a, t.base.b), value: t.baseDeg }] };
        return gInst(rng, {
          stimulus: isoIntro(rng, t.v),
          question: rng.pick([`What is the value of $x$?`, `What is the value of $x$ in the figure shown?`]), correct: t.x,
          wrongs: pos([W(t.baseDeg, "step_missing", "밑각의 크기를 답했다."), W(Math.round((180 - t.apexDeg - t.base.b) / t.base.a), "formula_misuse", "밑각을 둘로 나누지 않았다."), W(Math.round((t.apexDeg - t.base.b) / t.base.a), "formula_misuse", "꼭지각을 밑각에 넣었다."), W(t.x + 1, "other", "계산 중 어긋났다."), W(180 - t.apexDeg, "formula_misuse", "밑각의 합을 답했다.")]).filter((w) => w.v !== t.x),
          verificationJs: figJs({}, fig, `${ISO_JS}if (PA.a!==0) throw new Error('꼭지각이 숫자가 아님'); const bd=(180-PA.b)/2; if (PB.a===0) throw new Error('밑각 식 필요'); return (bd-PB.b)/PB.a;`),
          trace: [[`꼭지각 = ${t.apexDeg}° 이고 밑각은 ${exprLabel(t.base.a, t.base.b)} 이다.`, "Read the labels."], [`밑각 = (180 - ${t.apexDeg}) ÷ 2 = ${t.baseDeg}° 이다.`, "Two equal base angles."], [`${exprLabel(t.base.a, t.base.b).replace("°", "")} = ${t.baseDeg} 에서 x = ${t.x} 이다.`, "Solve for x."], [`확인: 꼭지각 + 밑각 × 2 = ${t.apexDeg} + ${2 * t.baseDeg} = 180 이다.`, "Check the sum."], [`따라서 ${t.x} 이다.`, "State x."]], variant: "x_from_numeric_apex",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "base_from_apex", structure: "꼭지각이 숫자로 라벨된 이등변삼각형에서 밑각(x°)을 구함", extra: "easy: (180 - 꼭지각) ÷ 2", concepts: ["이등변삼각형", "밑각"],
      gen(rng) {
        const t = makeIso(rng); const fig = { ...t.fig, angles: [{ at: t.v[0], label: `${t.apexDeg}°`, value: t.apexDeg }, { at: t.v[1], label: "x°", value: t.baseDeg }] };
        return gInst(rng, { stimulus: isoIntro(rng, t.v), question: rng.pick([`What is the value of $x$?`, `What is the measure, in degrees, of each base angle?`]), correct: t.baseDeg, wrongs: pos([W(180 - t.apexDeg, "formula_misuse", "두 밑각의 합을 답했다."), W(t.apexDeg, "other", "꼭지각을 답했다."), W(90 - t.apexDeg, "formula_misuse", "90°에서 뺐다."), W(t.baseDeg + 5, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== t.baseDeg), verificationJs: figJs({}, fig, `${ANG_X_JS}`), trace: [[`꼭지각 ${t.apexDeg}° 이다. 두 밑각은 같다.`, "Equal base angles."], [`x = (180 - ${t.apexDeg}) ÷ 2 = ${t.baseDeg} 이다.`, "Split the rest evenly."]], variant: "base_angle_numeric",
        }, fig);
      },
    },
    {
      lv: "medium", name: "solve_x", structure: "꼭지각·밑각이 x 의 일차식인 이등변삼각형에서 x 를 구함", extra: "medium: 밑각이 둘 + 일차방정식", concepts: ["이등변삼각형", "일차방정식"],
      gen(rng) {
        const t = makeIso(rng);
        return gInst(rng, { stimulus: isoIntro(rng, t.v), question: rng.pick([`What is the value of $x$?`, `What is the value of $x$ in the figure shown?`]), correct: t.x, wrongs: pos([W(t.apexDeg, "step_missing", "꼭지각을 답했다."), W(Math.round((180 - t.apex.b - t.base.b) / (t.apex.a + t.base.a)), "formula_misuse", "밑각을 한 번만 세었다."), W(t.x + 1, "other", "계산 중 어긋났다."), W(t.baseDeg, "step_missing", "밑각을 답했다.")]).filter((w) => w.v !== t.x), verificationJs: figJs({}, t.fig, `${ISO_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`), trace: [isoRead(t, exprLabel(t.apex.a, t.apex.b), exprLabel(t.base.a, t.base.b)), [`${t.apex.a + 2 * t.base.a}x ${t.apex.b + 2 * t.base.b < 0 ? "-" : "+"} ${Math.abs(t.apex.b + 2 * t.base.b)} = 180 이다.`, "Sum of the three angles."], [`x = ${t.x} 이다.`, "Solve."]], variant: "solve_x_isosceles",
        }, t.fig);
      },
    },
  ],
});
const ANG_X_JS = "const AN=FIGURE.angles||[]; const ap=AN.find(q=>q.at===FIGURE.vertices[0]); const n=Number(String(ap.label).replace(/[^0-9.]/g,'')); if (!(n>0&&n<180)) throw new Error('꼭지각 숫자 필요'); const xl=AN.find(q=>q.at!==FIGURE.vertices[0]); if (String(xl.label)!=='x°') throw new Error('x 라벨 필요'); return (180-n)/2;";
