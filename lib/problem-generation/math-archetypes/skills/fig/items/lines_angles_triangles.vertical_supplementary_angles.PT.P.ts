// lines_angles_triangles.vertical_supplementary_angles.PT.P — 평행선·횡단선 그림의 한 교점 둘레 각(맞꼭지각·보각) 라벨에서 x·각을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { REGIONS, exprFor, measure, numLabel, ptFig, ptIntro, ptScene, relText, sOf, PT_JS, type AngDef, type PtScene, type Region } from "../geo-pt-kit";
import type { Rng } from "../../../rng";

const OPP: Record<Region, Region> = { NE: "SW", SW: "NE", NW: "SE", SE: "NW" };
const ADJ: Record<Region, Region[]> = { NE: ["NW", "SE"], SW: ["NW", "SE"], NW: ["NE", "SW"], SE: ["NE", "SW"] };
const readStep = (sc: PtScene, line: 0 | 1): [string, string] => [`그림에서 선 ${sc.par[line]} 와 ${sc.tr[0]} 의 교점 둘레 각의 라벨을 읽는다.`, "Read the labels of the angles around one intersection."];
const QX = (rng: Rng) => rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`, `What value of $x$ is shown in the figure?`]);
/** 같은 교점의 두 쐐기: vertical(맞꼭지) 또는 adjacent(이웃, 보각). */
function pair(rng: Rng, kind: "vertical" | "adjacent"): { r1: Region; r2: Region } {
  const r1 = rng.pick(REGIONS); return { r1, r2: kind === "vertical" ? OPP[r1] : rng.pick(ADJ[r1]) };
}

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.vertical_supplementary_angles.PT.P",
  hard: [
    {
      op: "repr_shift", structure: "한 교점에서 서로 마주 보는(맞꼭지) 두 각이 x 의 일차식 라벨일 때 맞꼭지각은 같다는 사실을 방정식으로 옮겨 x 를 구함", extra: "맞꼭지각이 같다는 식을 세워 푸는 번역(이웃 각으로 오인하면 합 180° 로 풀어 틀림) — medium 은 숫자 각과 x°",
      concepts: ["맞꼭지각", "일차방정식"],
      gen(rng) {
        const sc = ptScene(rng, 1); const line = rng.pick([0, 1] as const); const { r1, r2 } = pair(rng, "vertical"); const x = rng.int(6, 24); const m = measure(sc, 0, r1);
        const e1 = exprFor(rng, m, x), e2 = exprFor(rng, m, x); if (e1.a === e2.a || m < 40 || m > 140) throw new GenFail("식");
        const a1: AngDef = { line, ti: 0, region: r1, label: e1.label }, a2: AngDef = { line, ti: 0, region: r2, label: e2.label }; const fig = ptFig(sc, [a1, a2]);
        return geoInst(rng, {
          stimulus: ptIntro(rng, sc), question: QX(rng), correct: x,
          wrongs: [W(m, "step_missing", "각의 크기를 답했다."), W(Math.max(1, Math.round((180 - e1.b - e2.b) / (e1.a + e2.a))), "formula_misuse", "맞꼭지각을 보각으로 풀었다."), W(x + 1, "other", "계산 중 어긋났다."), W(Math.abs(x - 3), "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v) && w.v > 0),
          verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`),
          trace: [readStep(sc, line), [`마주 보는 두 각이다: (${e1.label.replace("°", "")}) 와 (${e2.label.replace("°", "")}).`, "The two angles are vertical angles."], [`맞꼭지각은 같으므로 ${e1.a}x + ${e1.b} = ${e2.a}x + ${e2.b} 이다.`, "Vertical angles are equal."], [`x = ${x} 이다.`, "Solve for x."], [`따라서 ${x} 이다.`, "State x."]], variant: "x_from_vertical_angles",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "한 교점에서 이웃한 두 각 중 하나는 숫자, 하나는 x 의 일차식일 때 보각(합 180°)임을 써서 x 를 역산", extra: "이웃 각의 합이 180° 임을 식으로 세워 거꾸로 x 를 풀어야 함(같다고 오인하는 함정) — medium 은 맞꼭지각",
      concepts: ["보각", "일차방정식"],
      gen(rng) {
        const sc = ptScene(rng, 1); const line = rng.pick([0, 1] as const); const { r1, r2 } = pair(rng, "adjacent"); const x = rng.int(6, 24); const m2 = measure(sc, 0, r2); const m1 = measure(sc, 0, r1); const e = exprFor(rng, m2, x);
        const a1: AngDef = { line, ti: 0, region: r1, label: numLabel(m1) }, a2: AngDef = { line, ti: 0, region: r2, label: e.label }; const fig = ptFig(sc, [a1, a2]);
        return geoInst(rng, {
          stimulus: ptIntro(rng, sc), question: QX(rng), correct: x,
          wrongs: [W(m2, "step_missing", "각의 크기를 답했다."), W(Math.round((m1 - e.b) / e.a), "formula_misuse", "보각을 같은 각으로 풀었다."), W(Math.round(m1 / e.a), "step_missing", "상수항을 무시했다."), W(x + 2, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v) && w.v > 0),
          verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`),
          trace: [readStep(sc, line), [`이웃한 두 각: ${m1}° 와 (${e.label.replace("°", "")}).`, "Two adjacent angles on a line."], [`일직선 위의 이웃 각은 합이 180° 이므로 ${m1} + ${e.a}x + ${e.b} = 180 이다.`, "Adjacent angles on a line add to 180°."], [`x = ${x} 이다.`, "Solve for x."], [`따라서 ${x} 이다.`, "State x."]], variant: "x_from_adjacent_angles",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "한 교점에서 이웃한 두 각이 x 의 일차식일 때 합 180° 로 x 를 구한 뒤 맞꼭지 위치의 y° 각의 크기를 구함", extra: "이웃(보각)으로 x 를 풀고 다시 맞꼭지각으로 y 를 옮기는 2단계 — x 나 이웃 각을 답하는 함정, medium 은 맞꼭지각",
      concepts: ["보각", "맞꼭지각", "일차방정식"],
      gen(rng) {
        const sc = ptScene(rng, 1); const line = rng.pick([0, 1] as const); const r1 = rng.pick(REGIONS); const r2 = rng.pick(ADJ[r1]); const ry = OPP[r1]; const x = rng.int(6, 24);
        const m1 = measure(sc, 0, r1), m2 = measure(sc, 0, r2); const e1 = exprFor(rng, m1, x), e2 = exprFor(rng, m2, x); if (e1.a === -e2.a || m1 < 40 || m1 > 140) throw new GenFail("식");
        const a1: AngDef = { line, ti: 0, region: r1, label: e1.label }, a2: AngDef = { line, ti: 0, region: r2, label: e2.label }, a3: AngDef = { line, ti: 0, region: ry, label: "y°" }; const fig = ptFig(sc, [a1, a2, a3]);
        return geoInst(rng, {
          stimulus: ptIntro(rng, sc), question: rng.pick([`What is the value of $y$?`, `What is the measure, in degrees, of the angle marked $y°$?`, `In the figure shown, what is the value of $y$?`]), correct: m1,
          wrongs: [W(x, "step_missing", "x 를 답했다."), W(m2, "other", "이웃 각을 답했다."), W(180 - m1 + 10, "other", "계산 중 어긋났다."), W(e1.a * x, "step_missing", "상수항을 더하지 않았다.")].filter((w) => w.v > 0 && w.v < 180),
          verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return angleOf('y°');`),
          trace: [readStep(sc, line), [`이웃한 두 각 (${e1.label.replace("°", "")}), (${e2.label.replace("°", "")}) 는 합이 180° 이다.`, "Adjacent angles add to 180°."], [`방정식에서 x = ${x} 이므로 두 각은 ${m1}°, ${m2}° 이다.`, "Solve for x and substitute."], [`y° 는 (${e1.label.replace("°", "")}) 의 맞꼭지각이다.`, "y is vertical to the first angle."], [`y = ${m1} 이다.`, "State y."]], variant: "y_vertical_after_adjacent",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "평행선의 위·아래 두 교점에서 한 각은 맞꼭지 위치로, 다른 각은 보각 위치로 식 라벨일 때 위치 관계를 판단해 x 를 구한 뒤 식 각의 크기를 구함", extra: "위 교점과 아래 교점의 쐐기 종류를 비교해 같다/합 180° 를 판단하고 x 를 푼 뒤 지정한 각의 크기까지 구함 — medium 은 한 교점 안의 맞꼭지각",
      concepts: ["맞꼭지각", "보각", "평행선의 각", "일차방정식"],
      gen(rng) {
        const sc = ptScene(rng, 1);
        for (let tr = 0; tr < 60; tr++) {
          const x = rng.int(6, 24); const R1 = rng.pick(REGIONS), R2 = rng.pick(REGIONS); const m1 = measure(sc, 0, R1), m2 = measure(sc, 0, R2); const e1 = exprFor(rng, m1, x), e2 = exprFor(rng, m2, x);
          if (Math.min(m1, m2) < 40 || Math.max(m1, m2) > 140 || e2.a * sOf(sc, 0, R1) - e1.a * sOf(sc, 0, R2) === 0) continue;
          const a1: AngDef = { line: 0, ti: 0, region: R1, label: e1.label }, a2: AngDef = { line: 1, ti: 0, region: R2, label: e2.label }; const fig = ptFig(sc, [a1, a2]); const ask = rng.pick([a1, a2]); const ans = ask === a1 ? m1 : m2;
          return geoInst(rng, {
            stimulus: ptIntro(rng, sc), question: rng.pick([`What is the measure, in degrees, of the angle marked ${ask.label}?`, `What is the degree measure of the angle labeled ${ask.label}?`]), correct: ans,
            wrongs: [W(x, "step_missing", "x 를 답했다."), W(ask === a1 ? m2 : m1, "other", "다른 식 각을 답했다."), W(180 - ans, "formula_misuse", "같은 각과 보각 관계를 바꿨다."), W(ans + 10, "other", "계산 중 어긋났다.")].filter((w) => w.v > 0 && w.v < 180),
            verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return angleOf(${JSON.stringify(ask.label)});`),
            trace: [readStep(sc, 0), [`두 교점의 각: (${e1.label.replace("°", "")}), (${e2.label.replace("°", "")}).`, "Angles at the two intersections."], relText(sc, { ti: 0, region: R1 }, { ti: 0, region: R2 }), [`방정식을 풀어 x = ${x} 이다.`, "Solve for x."], [`묻는 각 = ${ans}° 이다.`, "Substitute into the asked angle."]], variant: "angle_measure_two_intersections",
          }, fig);
        }
        throw new GenFail("두 교점 각 표집 실패");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "vertical_numeric", structure: "한 교점에서 마주 보는 두 각 중 하나가 숫자, 다른 하나가 x° 일 때 맞꼭지각이 같음을 써서 x 를 구함", extra: "easy: 맞꼭지각이 같다", concepts: ["맞꼭지각"],
      gen(rng) {
        const sc = ptScene(rng, 1); const line = rng.pick([0, 1] as const); const { r1, r2 } = pair(rng, "vertical"); const m = measure(sc, 0, r1);
        const fig = ptFig(sc, [{ line, ti: 0, region: r1, label: numLabel(m) }, { line, ti: 0, region: r2, label: "x°" }]);
        return geoInst(rng, { stimulus: ptIntro(rng, sc), question: QX(rng), correct: m, wrongs: [W(180 - m, "formula_misuse", "맞꼭지각을 보각으로 보았다."), W(m + 10, "other", "계산 중 어긋났다."), W(90 - (m > 90 ? 180 - m : m) > 0 ? 90 - (m > 90 ? 180 - m : m) : 20, "formula_misuse", "90° 에서 뺐다."), W(m - 10, "other", "계산 중 어긋났다.")], verificationJs: figJs({}, fig, `${PT_JS}return angleOf('x°');`), trace: [readStep(sc, line), [`마주 보는 두 각이다.`, "The angles are vertical."], [`맞꼭지각은 같으므로 x = ${m} 이다.`, "Vertical angles are equal."]], variant: "x_vertical_numeric",
        }, fig);
      },
    },
    {
      lv: "medium", name: "adjacent_x", structure: "한 교점에서 이웃한 두 각이 숫자와 x 의 식 라벨일 때 합 180° 로 x 를 구함", extra: "medium: 보각의 합 180° 로 일차방정식 풀이", concepts: ["보각", "일차방정식"],
      gen(rng) {
        const sc = ptScene(rng, 1); const line = rng.pick([0, 1] as const); const { r1, r2 } = pair(rng, "adjacent"); const x = rng.int(6, 24); const m1 = measure(sc, 0, r1), m2 = measure(sc, 0, r2); const e = exprFor(rng, m2, x);
        const fig = ptFig(sc, [{ line, ti: 0, region: r1, label: numLabel(m1) }, { line, ti: 0, region: r2, label: e.label }]);
        return geoInst(rng, { stimulus: ptIntro(rng, sc), question: QX(rng), correct: x, wrongs: [W(m2, "step_missing", "각의 크기를 답했다."), W(Math.round((m1 - e.b) / e.a), "formula_misuse", "보각을 같은 각으로 풀었다."), W(x + 1, "other", "계산 중 어긋났다."), W(Math.round((180 - e.b) / e.a), "step_missing", "숫자 각을 빼지 않았다.")].filter((w) => Number.isInteger(w.v) && w.v > 0), verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`), trace: [readStep(sc, line), [`이웃한 두 각의 합은 180° 이다: ${m1} + ${e.a}x + ${e.b} = 180.`, "Adjacent angles on a line add to 180°."], [`x = ${x} 이다.`, "Solve for x."]], variant: "x_adjacent_numeric",
        }, fig);
      },
    },
  ],
});
