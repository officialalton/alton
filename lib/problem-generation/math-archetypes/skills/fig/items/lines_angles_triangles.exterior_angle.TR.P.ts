// lines_angles_triangles.exterior_angle.TR.P — 한 변을 연장한 삼각형 그림의 각 라벨(숫자·x 의 식)에서 바깥각 정리(바깥각 = 나머지 두 내각의 합)와 보각(바깥각 + 내각 = 180°)으로 x 와 각을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { EXT_JS, exprFor, extFig, extIntro, makeExtScene, numLab, retry, vname, type ExtScene } from "../ext-kit";
import { exprLabel } from "../tri-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isInteger(w.v) && w.v > 0 && w.v < 180);
const at = (sc: ExtScene) => vname(sc, sc.at);
const QOUT = (rng: Rng, sc: ExtScene) => rng.pick([`What is the measure, in degrees, of the exterior angle at vertex $${at(sc)}$?`, `What is the degree measure of the exterior angle formed at $${at(sc)}$ by the extension?`, `How many degrees is the exterior angle at $${at(sc)}$ in the figure shown?`, `The exterior angle at $${at(sc)}$ measures how many degrees?`, `In the figure shown, what is the measure, in degrees, of the angle between the extension and the other side at $${at(sc)}$?`]);
const QIN = (rng: Rng, sc: ExtScene) => rng.pick([`What is the measure, in degrees, of angle $${at(sc)}$ of the triangle?`, `What is the degree measure of the interior angle at vertex $${at(sc)}$?`, `How many degrees is the angle at vertex $${at(sc)}$ inside the triangle?`, `The interior angle of the triangle at $${at(sc)}$ measures how many degrees?`]);
const QX = (rng: Rng) => rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`, `What value of $x$ is shown in the figure?`]);
const readStep = (sc: ExtScene): [string, string] => [`그림에서 변 ${vname(sc, sc.from)}${at(sc)} 가 ${at(sc)} 너머로 연장되어 있고 각의 라벨을 읽는다.`, "Read the labels; the side is extended past the vertex."];

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.exterior_angle.TR.P",
  hard: [
    {
      op: "compose_kind", structure: "나머지 두 내각과 바깥각이 x 의 일차식으로 라벨된 그림에서 바깥각 정리로 x 를 구한 뒤 연장한 꼭짓점의 내각을 구함", extra: "바깥각 = 나머지 두 내각의 합 으로 x 를 구하고 다시 보각(180° − 바깥각)으로 내각을 구해야 함(바깥각을 그대로 답하는 함정) — medium 은 x 의 값",
      concepts: ["바깥각 정리", "보각", "일차방정식"],
      gen(rng) { return retry(rng, () => gen1(rng)); function gen1(rng: Rng) {
        const sc = makeExtScene(rng); const x = rng.int(8, 30); const e0 = exprFor(rng, sc.r[0], x), e1 = exprFor(rng, sc.r[1], x); const eo = exprFor(rng, sc.outer, x, 1, 5);
        if (eo.a === e0.a + e1.a) throw new GenFail("식 퇴화"); const fig = extFig(sc, { r0: e0.label, r1: e1.label, outer: eo.label });
        return geoInst(rng, {
          stimulus: extIntro(rng, sc), question: QIN(rng, sc), correct: sc.inner,
          wrongs: pos([W(sc.outer, "step_missing", "바깥각을 답했다."), W(x, "step_missing", "x 를 답했다."), W(sc.r[0] + sc.r[1] + 0, "formula_misuse", "나머지 두 각의 합을 답했다."), W(180 - sc.r[0], "formula_misuse", "한 각만 빼서 구했다."), W(sc.inner + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== sc.inner),
          verificationJs: figJs({}, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return IN;`),
          trace: [readStep(sc), [`바깥각 정리: ${eo.label.replace("°", "")} = ${e0.label.replace("°", "")} + ${e1.label.replace("°", "")} 에서 x = ${x} 이다.`, "The exterior angle equals the sum of the two remote interior angles."], [`바깥각 = ${sc.outer}° 이다.`, "Substitute x."], [`내각 ∠${at(sc)} = 180° - ${sc.outer}° = ${sc.inner}° 이다.`, "The interior angle is supplementary to the exterior angle."], [`따라서 ${sc.inner} 이다.`, "State the measure."]], variant: "interior_from_exterior_theorem",
        }, fig);
      } },
    },
    {
      op: "chain2", structure: "세 내각이 x 의 일차식으로 라벨된 그림에서 내각의 합 180° 로 x 를 구한 뒤 연장한 꼭짓점의 바깥각을 구함", extra: "내각의 합으로 x → 내각 → 바깥각(= 180° − 내각) 의 연쇄(내각을 그대로 답하는 함정) — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "바깥각", "일차방정식"],
      gen(rng) { return retry(rng, () => gen1(rng)); function gen1(rng: Rng) {
        const sc = makeExtScene(rng); const x = rng.int(8, 30); const e0 = exprFor(rng, sc.r[0], x), e1 = exprFor(rng, sc.r[1], x), ei = exprFor(rng, sc.inner, x);
        if (e0.a + e1.a + ei.a === 0) throw new GenFail("식 퇴화"); const fig = extFig(sc, { r0: e0.label, r1: e1.label, inner: ei.label });
        return geoInst(rng, {
          stimulus: extIntro(rng, sc), question: QOUT(rng, sc), correct: sc.outer,
          wrongs: pos([W(sc.inner, "step_missing", "내각을 답했다."), W(x, "step_missing", "x 를 답했다."), W(180 - sc.r[0], "formula_misuse", "한 각만 빼서 구했다."), W(Math.abs(sc.r[0] - sc.r[1]), "formula_misuse", "두 각의 차를 구했다."), W(sc.outer + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== sc.outer),
          verificationJs: figJs({}, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return OUT;`),
          trace: [readStep(sc), [`세 내각의 합 180° 에서 x = ${x} 이다.`, "The interior angles add to 180°."], [`내각 ∠${at(sc)} = ${ei.label.replace("°", "")} = ${sc.inner}° 이다.`, "Substitute x."], [`바깥각 = 180° - ${sc.inner}° = ${sc.outer}° 이다.`, "Exterior = 180° minus the interior angle."], [`따라서 ${sc.outer} 이다.`, "State the measure."]], variant: "exterior_from_three_interior",
        }, fig);
      } },
    },
    {
      op: "repr_shift", structure: "나머지 두 내각이 x°, kx° 의 비로 라벨되고 바깥각이 숫자인 그림에서 바깥각 정리를 방정식으로 옮겨 큰 내각의 크기를 구함", extra: "바깥각 = x + kx 로 번역해 풀고 더 큰 각을 골라야 함(x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["바깥각 정리", "비", "일차방정식"],
      gen(rng) { return retry(rng, () => gen1(rng)); function gen1(rng: Rng) {
        const sc0 = makeExtScene(rng); const k = rng.pick([2, 3, 4]); const outer = rng.pick([60, 72, 75, 80, 90, 100, 105, 108, 120, 125, 130, 135, 140, 150].filter((o) => o % (k + 1) === 0));
        const x = outer / (k + 1); if (x < 15 || x * k > 120) throw new GenFail("범위");
        const sc: ExtScene = { ...sc0, r: [x, x * k], outer, inner: 180 - outer }; if (sc.inner < 20 || sc.inner > 100) throw new GenFail("범위");
        const swap = rng.chance(0.5); const lab0 = swap ? exprLabel(k, 0) : exprLabel(1, 0), lab1 = swap ? exprLabel(1, 0) : exprLabel(k, 0);
        const sc2: ExtScene = swap ? { ...sc, r: [x * k, x] } : sc; const fig = extFig(sc2, { r0: lab0, r1: lab1, outer: numLab(outer) }); const big = x * k;
        return geoInst(rng, {
          stimulus: extIntro(rng, sc2), question: rng.pick([`What is the measure, in degrees, of the larger of the two angles labeled with $x$?`, `The two interior angles labeled with $x$ are not equal. What is the degree measure of the larger one?`, `How many degrees is the greater of the two marked interior angles?`, `What is the degree measure of the larger of the two remote interior angles?`]), correct: big,
          wrongs: pos([W(x, "step_missing", "x 를 답했다."), W(outer, "step_missing", "바깥각을 답했다."), W(Math.round(outer / k), "formula_misuse", "바깥각을 k 로 나누었다."), W(180 - outer, "formula_misuse", "내각을 답했다."), W(big + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== big),
          verificationJs: figJs({}, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return Math.max(R0, R1);`),
          trace: [readStep(sc2), [`바깥각 정리: x + ${k}x = ${outer} 에서 x = ${x} 이다.`, "The exterior angle is the sum of the remote angles."], [`두 각은 ${x}° 와 ${big}° 이다.`, "The two remote angles."], [`더 큰 각은 ${big}° 이다.`, "Pick the larger."], [`따라서 ${big} 이다.`, "State the measure."]], variant: "larger_remote_from_ratio",
        }, fig);
      } },
    },
    {
      op: "inverse", structure: "바깥각과 나머지 한 내각이 x 의 식으로, 다른 한 내각이 숫자로 라벨된 그림에서 바깥각 정리의 식을 세워 x 를 역산한 뒤 식으로 라벨된 내각의 크기를 구함", extra: "숫자 내각을 옮겨 x 를 거꾸로 구하고 라벨 식에 되돌려야 함(숫자 각이나 x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["바깥각 정리", "일차방정식", "식의 대입"],
      gen(rng) { return retry(rng, () => gen1(rng)); function gen1(rng: Rng) {
        const sc = makeExtScene(rng); const x = rng.int(8, 30); const k = rng.int(0, 1); const eU = exprFor(rng, sc.r[k], x), eo = exprFor(rng, sc.outer, x, 1, 5); if (eo.a === eU.a) throw new GenFail("식 퇴화");
        const num = sc.r[1 - k]; const fig = extFig(sc, k === 0 ? { r0: eU.label, r1: numLab(num), outer: eo.label } : { r0: numLab(num), r1: eU.label, outer: eo.label }); const target = sc.r[k];
        const nm = vname(sc, sc.rem[k]);
        return geoInst(rng, {
          stimulus: extIntro(rng, sc), question: rng.pick([`What is the measure, in degrees, of angle $${nm}$?`, `What is the degree measure of the triangle's angle at $${nm}$?`, `How many degrees is the interior angle at vertex $${nm}$?`]), correct: target,
          wrongs: pos([W(x, "step_missing", "x 를 답했다."), W(num, "other", "숫자로 주어진 각을 답했다."), W(sc.outer, "step_missing", "바깥각을 답했다."), W(eU.a * x, "step_missing", "상수항을 더하지 않았다."), W(target + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== target),
          verificationJs: figJs({ nm }, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); const i=ot.indexOf(P.nm); if (i<0) throw new Error('꼭짓점 오류'); return i===0?R0:R1;`),
          trace: [readStep(sc), [`바깥각 정리: ${eo.label.replace("°", "")} = ${num} + ${eU.label.replace("°", "")} 에서 x = ${x} 이다.`, "Set the exterior angle equal to the sum of the remote angles; solve for x."], [`나머지 한 내각 ${num}° 는 그대로이다.`, "The other remote angle is the given number."], [`∠${nm} = ${eU.label.replace("°", "")} = ${target}° 이다.`, "Substitute x."], [`따라서 ${target} 이다.`, "State the measure."]], variant: "remote_from_exterior_equation",
        }, fig);
      } },
    },
  ],
  em: [
    {
      lv: "easy", name: "outer_from_remote", structure: "나머지 두 내각이 숫자로 주어진 그림에서 바깥각을 두 각의 합으로 구함", extra: "easy: 바깥각 정리 한 번 적용", concepts: ["바깥각 정리", "덧셈"],
      gen(rng) { return retry(rng, () => gen1(rng)); function gen1(rng: Rng) {
        const sc = makeExtScene(rng); const fig = extFig(sc, { r0: numLab(sc.r[0]), r1: numLab(sc.r[1]) });
        return geoInst(rng, { stimulus: extIntro(rng, sc), question: QOUT(rng, sc), correct: sc.outer, wrongs: pos([W(sc.inner, "step_missing", "내각을 답했다."), W(Math.abs(sc.r[0] - sc.r[1]), "formula_misuse", "두 각의 차를 구했다."), W(180 - sc.r[0], "formula_misuse", "한 각만 빼서 구했다."), W(sc.outer + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== sc.outer), verificationJs: figJs({}, fig, `${EXT_JS}return OUT;`), trace: [readStep(sc), [`나머지 두 내각은 ${sc.r[0]}° 와 ${sc.r[1]}° 이다.`, "The two remote interior angles."], [`바깥각 = ${sc.r[0]}° + ${sc.r[1]}° = ${sc.outer}° 이다.`, "Exterior angle = sum of the remote angles."]], variant: "outer_from_two_numbers" }, fig);
      } },
    },
    {
      lv: "medium", name: "solve_x", structure: "나머지 두 내각이 x 의 일차식이고 바깥각이 숫자인 그림에서 바깥각 정리로 x 를 구함", extra: "medium: 일차방정식 한 번", concepts: ["바깥각 정리", "일차방정식"],
      gen(rng) { return retry(rng, () => gen1(rng)); function gen1(rng: Rng) {
        const sc = makeExtScene(rng); const x = rng.int(8, 30); const e0 = exprFor(rng, sc.r[0], x), e1 = exprFor(rng, sc.r[1], x); if (e0.a + e1.a === 0) throw new GenFail("식");
        const fig = extFig(sc, { r0: e0.label, r1: e1.label, outer: numLab(sc.outer) });
        return geoInst(rng, { stimulus: extIntro(rng, sc), question: QX(rng), correct: x, wrongs: pos([W(sc.r[0], "step_missing", "각의 크기를 답했다."), W(Math.round((180 - sc.outer - e0.b - e1.b) / (e0.a + e1.a)), "formula_misuse", "바깥각을 내각으로 보았다."), W(Math.round((sc.outer - e0.b) / (e0.a + e1.a)), "step_missing", "한 식의 상수항만 옮겼다."), W(x + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({}, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`), trace: [readStep(sc), [`바깥각 정리: ${e0.label.replace("°", "")} + ${e1.label.replace("°", "")} = ${sc.outer} 이다.`, "Sum of remote angles = exterior angle."], [`x = ${x} 이다.`, "Solve."]], variant: "solve_x_exterior" }, fig);
      } },
    },
  ],
});
