// lines_angles_triangles.vertical_supplementary_angles.TR.P — 한 변을 연장한 삼각형 그림에서 같은 꼭짓점의 내각과 바깥각이 일직선 위의 이웃 각(보각, 합 180°)임을 써서 x·각을 구한다.
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
const QIN = (rng: Rng, sc: ExtScene) => rng.pick([`What is the measure, in degrees, of the interior angle of the triangle at vertex $${at(sc)}$?`, `What is the degree measure of the angle inside the triangle at $${at(sc)}$?`, `How many degrees is the interior angle at vertex $${at(sc)}$?`, `The angle of the triangle at $${at(sc)}$ measures how many degrees?`]);
const QOUT = (rng: Rng, sc: ExtScene) => rng.pick([`What is the measure, in degrees, of the angle formed at $${at(sc)}$ by the extension and the other side?`, `How many degrees is the exterior angle at vertex $${at(sc)}$?`, `What is the degree measure of the exterior angle at $${at(sc)}$?`]);
const QX = (rng: Rng) => rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`, `What value of $x$ is shown in the figure?`]);
const readStep = (sc: ExtScene): [string, string] => [`그림에서 ${at(sc)} 에서의 내각과 바깥각(변의 연장선과 이루는 각)의 라벨을 읽는다.`, "Read the labels of the interior angle and the exterior angle at the vertex."];

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.vertical_supplementary_angles.TR.P",
  hard: [
    {
      op: "compose_kind", structure: "연장한 꼭짓점의 내각과 바깥각이 x 의 일차식으로 라벨된 그림에서 두 각이 보각(합 180°)임을 써서 x 를 구한 뒤 내각의 크기를 구함", extra: "일직선 위의 이웃 각은 합 180° 라는 식으로 x 를 구하고 내각에 되돌려야 함(두 각이 같다고 오인하거나 바깥각을 답하는 함정) — medium 은 x 의 값",
      concepts: ["보각", "일차방정식", "바깥각"],
      gen(rng) { return retry(rng, () => {
        const sc = makeExtScene(rng); const x = rng.int(8, 30); const ei = exprFor(rng, sc.inner, x), eo = exprFor(rng, sc.outer, x, 1, 5); if (ei.a + eo.a === 0) throw new GenFail("식 퇴화");
        const fig = extFig(sc, { inner: ei.label, outer: eo.label });
        return geoInst(rng, {
          stimulus: extIntro(rng, sc), question: QIN(rng, sc), correct: sc.inner,
          wrongs: pos([W(sc.outer, "step_missing", "바깥각을 답했다."), W(x, "step_missing", "x 를 답했다."), W(Math.round((ei.b - eo.b) / (eo.a - ei.a || 1)) * ei.a + ei.b, "formula_misuse", "두 각이 같다고 놓고 풀었다."), W(sc.inner + 10, "other", "계산 중 어긋났다."), W(180 - sc.r[0], "other", "나머지 각 하나를 뺐다.")]).filter((w) => w.v !== sc.inner),
          verificationJs: figJs({}, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return IN;`),
          trace: [readStep(sc), [`일직선 위의 이웃 각이므로 ${ei.label.replace("°", "")} + ${eo.label.replace("°", "")} = 180 에서 x = ${x} 이다.`, "The interior and exterior angles at a vertex are supplementary."], [`내각 = ${ei.label.replace("°", "")} = ${sc.inner}° 이다.`, "Substitute x."], [`바깥각은 ${sc.outer}° 이고 합은 180° 이다.`, "Check: the two angles add to 180°."], [`따라서 ${sc.inner} 이다.`, "State the measure."]], variant: "interior_from_supplementary_expressions",
        }, fig);
      }); },
    },
    {
      op: "chain2", structure: "연장한 꼭짓점의 내각·바깥각이 x 의 식, 나머지 한 내각이 숫자일 때 보각으로 x 를 구한 뒤 바깥각 정리로 라벨이 없는 다른 내각을 구함", extra: "x → 바깥각 → 바깥각 − 숫자 내각 으로 이어지는 연쇄(바깥각이나 x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["보각", "바깥각 정리", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const sc = makeExtScene(rng); const x = rng.int(8, 30); const ei = exprFor(rng, sc.inner, x), eo = exprFor(rng, sc.outer, x, 1, 5); if (ei.a + eo.a === 0) throw new GenFail("식 퇴화");
        const k = rng.int(0, 1); const fig = extFig(sc, k === 0 ? { r0: numLab(sc.r[0]), inner: ei.label, outer: eo.label } : { r1: numLab(sc.r[1]), inner: ei.label, outer: eo.label }); const target = sc.r[1 - k]; const given = sc.r[k]; const nm = vname(sc, sc.rem[1 - k]);
        return geoInst(rng, {
          stimulus: extIntro(rng, sc), question: rng.pick([`What is the measure, in degrees, of the interior angle at vertex $${nm}$?`, `How many degrees is the angle of the triangle at $${nm}$?`, `The unlabeled interior angle at $${nm}$ measures how many degrees?`]), correct: target,
          wrongs: pos([W(sc.outer, "step_missing", "바깥각을 답했다."), W(sc.inner, "step_missing", "연장한 꼭짓점의 내각을 답했다."), W(given, "other", "숫자로 주어진 각을 답했다."), W(x, "step_missing", "x 를 답했다."), W(target + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== target),
          verificationJs: figJs({ nm }, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); const i=ot.indexOf(P.nm); if (i<0) throw new Error('꼭짓점 오류'); return i===0?R0:R1;`),
          trace: [readStep(sc), [`보각: ${ei.label.replace("°", "")} + ${eo.label.replace("°", "")} = 180 에서 x = ${x} 이다.`, "Interior + exterior = 180°."], [`바깥각 = ${sc.outer}° 이다.`, "Substitute x."], [`바깥각 정리: ${nm} 의 각 = ${sc.outer}° - ${given}° = ${target}° 이다.`, "Exterior angle = sum of the remote angles."], [`따라서 ${target} 이다.`, "State the measure."]], variant: "other_remote_from_supplementary",
        }, fig);
      }); },
    },
    {
      op: "repr_shift", structure: "연장한 꼭짓점의 내각이 x°, 바깥각이 kx° 의 비로 라벨된 그림에서 보각을 방정식으로 옮겨 바깥각의 크기를 구함", extra: "x + kx = 180 으로 번역해 풀고 바깥각을 골라야 함(x 나 내각을 답하는 함정) — medium 은 x 의 값",
      concepts: ["보각", "비", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const k = rng.pick([2, 3, 4]); const x = 180 / (1 + k); const inner = x, outer = k * x; const sc0 = makeExtScene(rng);
        const rs: [number, number][] = []; for (let a = 36; a <= 80; a++) { const b = outer - a; if (b >= 36 && b <= 80 && a !== b) rs.push([a, b]); } if (!rs.length) throw new GenFail("범위");
        const sc: ExtScene = { ...sc0, r: rng.pick(rs), inner, outer }; const fig = extFig(sc, { inner: exprLabel(1, 0), outer: exprLabel(k, 0) });
        return geoInst(rng, {
          stimulus: extIntro(rng, sc), question: QOUT(rng, sc), correct: outer,
          wrongs: pos([W(inner, "step_missing", "내각(x)을 답했다."), W(180 - inner * 2 + inner, "other", "계산 중 어긋났다."), W(Math.round(180 / k), "formula_misuse", "180 을 k 로만 나누었다."), W(outer - 10, "other", "계산 중 어긋났다."), W(outer + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== outer),
          verificationJs: figJs({}, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return OUT;`),
          trace: [readStep(sc), [`보각: x + ${k}x = 180 에서 x = ${x} 이다.`, "The two angles are supplementary."], [`바깥각 = ${k}x = ${outer}° 이다.`, "Substitute x."], [`내각은 ${inner}° 로 합이 180° 이다.`, "Check the sum."], [`따라서 ${outer} 이다.`, "State the measure."]], variant: "exterior_from_ratio",
        }, fig);
      }); },
    },
    {
      op: "inverse", structure: "내각이 숫자, 바깥각과 나머지 한 내각이 x 의 식일 때 보각으로 x 를 역산한 뒤 식으로 라벨된 내각의 크기를 구함", extra: "180° − 숫자 내각 = 바깥각 식으로 x 를 거꾸로 구해 다른 식에 되돌려야 함(숫자 내각이나 x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["보각", "일차방정식", "식의 대입"],
      gen(rng) { return retry(rng, () => {
        const sc = makeExtScene(rng); const x = rng.int(8, 30); const eo = exprFor(rng, sc.outer, x, 1, 5); const k = rng.int(0, 1); const eu = exprFor(rng, sc.r[k], x);
        const fig = extFig(sc, k === 0 ? { r0: eu.label, inner: numLab(sc.inner), outer: eo.label } : { r1: eu.label, inner: numLab(sc.inner), outer: eo.label }); const nm = vname(sc, sc.rem[k]); const target = sc.r[k];
        return geoInst(rng, {
          stimulus: extIntro(rng, sc), question: rng.pick([`What is the measure, in degrees, of the interior angle at vertex $${nm}$?`, `How many degrees is the angle of the triangle at $${nm}$?`, `The interior angle at $${nm}$ measures how many degrees?`]), correct: target,
          wrongs: pos([W(x, "step_missing", "x 를 답했다."), W(sc.inner, "other", "숫자로 주어진 각을 답했다."), W(sc.outer, "step_missing", "바깥각을 답했다."), W(eu.a * x, "step_missing", "상수항을 더하지 않았다."), W(target + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== target),
          verificationJs: figJs({ nm }, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); const i=ot.indexOf(P.nm); if (i<0) throw new Error('꼭짓점 오류'); return i===0?R0:R1;`),
          trace: [readStep(sc), [`보각: ${sc.inner} + ${eo.label.replace("°", "")} = 180 에서 x = ${x} 이다.`, "Interior + exterior = 180°; solve for x."], [`바깥각 = ${sc.outer}° 이다.`, "Substitute x."], [`∠${nm} = ${eu.label.replace("°", "")} = ${target}° 이다.`, "Substitute x into the other label."], [`따라서 ${target} 이다.`, "State the measure."]], variant: "remote_from_supplementary_inverse",
        }, fig);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "outer_from_inner", structure: "연장한 꼭짓점의 내각이 숫자인 그림에서 바깥각을 180°에서 빼서 구함", extra: "easy: 보각 한 번 적용", concepts: ["보각", "뺄셈"],
      gen(rng) { return retry(rng, () => {
        const sc = makeExtScene(rng); const fig = extFig(sc, { inner: numLab(sc.inner) });
        return geoInst(rng, { stimulus: extIntro(rng, sc), question: QOUT(rng, sc), correct: sc.outer, wrongs: pos([W(sc.inner, "step_missing", "내각을 답했다."), W(90 - sc.inner + 90 - 0, "other", "계산 중 어긋났다."), W(sc.outer + 10, "other", "계산 중 어긋났다."), W(Math.abs(90 - sc.inner), "formula_misuse", "90°에서 뺐다.")]).filter((w) => w.v !== sc.outer), verificationJs: figJs({}, fig, `${EXT_JS}return OUT;`), trace: [readStep(sc), [`내각은 ${sc.inner}° 이다.`, "The interior angle."], [`바깥각 = 180° - ${sc.inner}° = ${sc.outer}° 이다.`, "Supplementary angles add to 180°."]], variant: "outer_from_inner_number" }, fig);
      }); },
    },
    {
      lv: "medium", name: "solve_x", structure: "연장한 꼭짓점의 내각이 x 의 일차식이고 바깥각이 숫자인 그림에서 보각으로 x 를 구함", extra: "medium: 일차방정식 한 번", concepts: ["보각", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const sc = makeExtScene(rng); const x = rng.int(8, 30); const ei = exprFor(rng, sc.inner, x); const fig = extFig(sc, { inner: ei.label, outer: numLab(sc.outer) });
        return geoInst(rng, { stimulus: extIntro(rng, sc), question: QX(rng), correct: x, wrongs: pos([W(sc.inner, "step_missing", "각의 크기를 답했다."), W(Math.round((sc.outer - ei.b) / ei.a), "formula_misuse", "두 각이 같다고 놓았다."), W(Math.round((180 - ei.b) / ei.a), "step_missing", "바깥각을 빼지 않았다."), W(x + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({}, fig, `${EXT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`), trace: [readStep(sc), [`보각: ${ei.label.replace("°", "")} + ${sc.outer} = 180 이다.`, "Interior + exterior = 180°."], [`x = ${x} 이다.`, "Solve."]], variant: "solve_x_supplementary" }, fig);
      }); },
    },
  ],
});
