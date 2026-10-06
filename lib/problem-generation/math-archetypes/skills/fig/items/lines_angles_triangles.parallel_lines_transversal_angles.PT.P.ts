// lines_angles_triangles.parallel_lines_transversal_angles.PT.P — 평행선과 횡단선 그림의 각 라벨(숫자·x 의 식·y°)에서 같은 각·보각 관계로 x·각을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { REGIONS, exprFor, measure, numLabel, ptFig, ptIntro, ptScene, relText, sOf, PT_JS, type AngDef, type PtScene, type Region } from "../geo-pt-kit";
import type { Rng } from "../../../rng";

const rpick = (rng: Rng): Region => rng.pick(REGIONS);
const readStep = (sc: PtScene): [string, string] => [`그림에서 평행선 ${sc.par[0]}, ${sc.par[1]} 과 횡단선 ${sc.tr.join(", ")} 의 각 라벨을 읽는다.`, "Read the angle labels at the intersections."];
const QX = (rng: Rng) => rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`, `What value of $x$ is shown in the figure?`, `For the angles marked in the figure, what is $x$?`]);
const sol = (a1: number, b1: number, a2: number, b2: number, x: number): [string, string] => [`두 식 ${a1}x + ${b1} 과 ${a2}x + ${b2} 를 관계식에 넣어 x = ${x} 를 얻는다.`, "Solve the equation for x."];

/** x 정수·두 식 라벨이 일관된 (θ, x, 두 영역) 를 뽑아 AngDef 두 개를 만든다. */
function twoExpr(rng: Rng, sc: PtScene, o: { sameTrans?: boolean; num?: "first" | "second" | null } = {}) {
  for (let tr = 0; tr < 60; tr++) {
    const x = rng.int(6, 24); const R1 = rpick(rng), R2 = rpick(rng); const t1 = 0, t2 = o.sameTrans === false ? 1 : 0;
    const m1 = measure(sc, t1, R1), m2 = measure(sc, t2, R2); if (R1 === R2 && t1 === t2) continue;
    const s1 = sOf(sc, t1, R1), s2 = sOf(sc, t2, R2);
    const e1 = exprFor(rng, m1, x), e2 = exprFor(rng, m2, x); if (e2.a * s1 - e1.a * s2 === 0) continue;
    if (Math.min(m1, m2) < 40 || Math.max(m1, m2) > 140) continue;
    const a1: AngDef = { line: 0, ti: t1, region: R1, label: e1.label }, a2: AngDef = { line: 1, ti: t2, region: R2, label: e2.label };
    return { x, a1, a2, e1, e2, m1, m2, R1, R2, t1, t2 };
  }
  throw new GenFail("두 식 각 표집 실패");
}

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.parallel_lines_transversal_angles.PT.P",
  hard: [
    {
      op: "repr_shift", structure: "평행선과 횡단선의 두 교점에서 각이 x 의 일차식 라벨일 때 두 각의 관계(같다/합 180°)를 위치로 판단해 방정식을 세워 x 를 구함", extra: "두 각이 서로 같은지 보각인지(위치로) 판단해야 방정식이 달라지고, 잘못 판단하면 다른 x 가 나옴 — medium 은 숫자 각과 x° 의 관계",
      concepts: ["평행선의 각", "일차방정식", "보각"],
      gen(rng) {
        const sc = ptScene(rng, 1); const { x, a1, a2, e1, e2, R1, R2, m1 } = twoExpr(rng, sc);
        const fig = ptFig(sc, [a1, a2]);
        return geoInst(rng, {
          stimulus: ptIntro(rng, sc), question: QX(rng), correct: x,
          wrongs: [W(m1, "step_missing", "각의 크기를 답했다."), W(x + 1, "other", "계산 중 어긋났다."), W(Math.abs(Math.round((e2.b - e1.b + (sOf(sc, 0, R1) === sOf(sc, 0, R2) ? 0 : 180)) / (e1.a + e2.a))), "formula_misuse", "같은 각과 보각 관계를 바꿔 풀었다."), W(Math.round(180 - x), "formula_misuse", "180° 에서 x 를 뺐다."), W(Math.abs(x - 3), "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`),
          trace: [readStep(sc), [`두 각의 라벨: (${e1.label.replace("°", "")}), (${e2.label.replace("°", "")}).`, "The two expressions."], relText(sc, { ti: 0, region: R1 }, { ti: 0, region: R2 }), sol(e1.a, e1.b, e2.a, e2.b, x), [`따라서 ${x} 이다.`, "State x."]], variant: "x_from_two_expression_angles",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "한 각은 숫자, 다른 교점의 각은 x 의 일차식일 때 두 각의 관계를 위치로 판단해 x 를 역산", extra: "숫자 각이 예각·둔각 중 어느 쐐기인지와 식 각의 쐐기를 비교해 같다/합 180° 를 골라 거꾸로 x 를 풀어야 함 — medium 은 같은 위치(동위각)",
      concepts: ["평행선의 각", "일차방정식", "보각"],
      gen(rng) {
        const sc = ptScene(rng, 1);
        for (let tr = 0; tr < 60; tr++) {
          const x = rng.int(6, 24); const R1 = rpick(rng), R2 = rpick(rng); const m1 = measure(sc, 0, R1), m2 = measure(sc, 0, R2); const e = exprFor(rng, m2, x); if (Math.min(m1, m2) < 40 || Math.max(m1, m2) > 140) continue;
          const a1: AngDef = { line: 0, ti: 0, region: R1, label: numLabel(m1) }, a2: AngDef = { line: 1, ti: 0, region: R2, label: e.label }; const fig = ptFig(sc, [a1, a2]); const same = sOf(sc, 0, R1) === sOf(sc, 0, R2);
          return geoInst(rng, {
            stimulus: ptIntro(rng, sc), question: QX(rng), correct: x,
            wrongs: [W(m2, "step_missing", "x 가 아니라 각의 크기를 답했다."), W(Math.round(((same ? 180 - m1 : m1) - e.b) / e.a), "formula_misuse", "같은 각과 보각 관계를 바꿔 풀었다."), W(Math.round(m1 / e.a), "step_missing", "상수항을 무시했다."), W(x + 2, "other", "계산 중 어긋났다.")].filter((w) => Number.isInteger(w.v) && w.v > 0),
            verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`),
            trace: [readStep(sc), [`숫자 각 ${m1}° 와 식 각 (${e.label.replace("°", "")}) 를 읽는다.`, "One numeric angle and one expression."], relText(sc, { ti: 0, region: R1 }, { ti: 0, region: R2 }), [`${same ? `${e.a}x + ${e.b} = ${m1}` : `${e.a}x + ${e.b} + ${m1} = 180`} 에서 x = ${x} 이다.`, "Solve for x."], [`따라서 ${x} 이다.`, "State x."]], variant: "x_from_numeric_and_expression",
          }, fig);
        }
        throw new GenFail("숫자·식 각 표집 실패");
      },
    },
    {
      op: "chain2", structure: "평행선과 횡단선의 두 교점의 식 라벨 각에서 x 를 구한 뒤 y° 로 표시된 다른 쐐기 각의 크기를 구함", extra: "x 를 풀어 각의 크기를 구하고 다시 y° 쐐기와의 관계(같다/보각)를 적용하는 2단계 — x 를 답하거나 식 각을 답하는 함정, medium 은 숫자 각과 x°",
      concepts: ["평행선의 각", "일차방정식", "맞꼭지각", "보각"],
      gen(rng) {
        const sc = ptScene(rng, 1);
        for (let tr = 0; tr < 80; tr++) {
          const { x, a1, a2, e1, e2, m1, m2, R1, R2 } = twoExpr(rng, sc); const used = new Set<string>([`0|${R1}`, `1|${R2}`]); const free = ([0, 1] as const).flatMap((l) => REGIONS.map((r) => ({ l, r }))).filter((c) => !used.has(`${c.l}|${c.r}`));
          const yc = rng.pick(free); const my = measure(sc, 0, yc.r); const a3: AngDef = { line: yc.l, ti: 0, region: yc.r, label: "y°" };
          if (my === m1 || my === m2) continue;
          const fig = ptFig(sc, [a1, a2, a3]);
          return geoInst(rng, {
            stimulus: ptIntro(rng, sc), question: rng.pick([`What is the value of $y$?`, `What is the measure, in degrees, of the angle marked $y°$?`, `In the figure shown, what is the value of $y$?`]), correct: my,
            wrongs: [W(x, "step_missing", "x 를 답했다."), W(m1, "other", "식 각 하나를 답했다."), W(m2, "other", "다른 식 각을 답했다."), W(180 - my, "formula_misuse", "같은 각과 보각 관계를 바꿨다."), W(my + 10, "other", "계산 중 어긋났다.")].filter((w) => w.v > 0 && w.v < 180),
            verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return angleOf('y°');`),
            trace: [readStep(sc), [`두 식 각 (${e1.label.replace("°", "")}), (${e2.label.replace("°", "")}) 사이의 관계로 x 를 구한다.`, "Find x from the two expression angles."], [`x = ${x} 이므로 식 각은 ${m1}°, ${m2}° 이다.`, "Substitute to get the angle measures."], [`y° 쐐기와 이 각들의 관계(같다/보각)를 따진다.`, "Relate the y° wedge to a known angle."], [`y = ${my} 이다.`, "State y."]], variant: "y_after_solving_x",
          }, fig);
        }
        throw new GenFail("y 각 표집 실패");
      },
    },
    {
      op: "compose_kind", structure: "서로 나란한 두 평행선쌍(평행선 둘, 횡단선 둘)에서 서로 다른 횡단선 위 두 교점의 각이 x 의 일차식일 때 평행 관계를 연쇄해 x 를 구함", extra: "횡단선이 둘이어도 모두 같은 θ 를 공유한다는 연쇄(평행선→횡단선→평행선)를 인식하고 같다/보각을 판단해 방정식 — medium 은 한 횡단선 위 숫자 각과 x°",
      concepts: ["평행선의 각", "일차방정식", "평행 관계의 연쇄"],
      gen(rng) {
        const sc = ptScene(rng, 2);
        const { x, a1, a2, e1, e2, R1, R2 } = twoExpr(rng, sc, { sameTrans: false }); const fig = ptFig(sc, [a1, a2]);
        return geoInst(rng, {
          stimulus: ptIntro(rng, sc), question: QX(rng), correct: x,
          wrongs: [W(measure(sc, 0, R1), "step_missing", "각의 크기를 답했다."), W(x + 1, "other", "계산 중 어긋났다."), W(Math.abs(x - 2), "other", "계산 중 어긋났다."), W(Math.round(180 - x), "formula_misuse", "180° 에서 x 를 뺐다."), W(Math.round(Math.abs(e1.b - e2.b) / Math.abs(e1.a - e2.a || 1)), "formula_misuse", "같은 각과 보각 관계를 바꿔 풀었다.")],
          verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`),
          trace: [readStep(sc), [`두 평행선과 두 횡단선 모두 나란하므로 각의 크기는 θ 와 180° - θ 두 가지뿐이다.`, "All wedges are θ or 180° − θ."], relText(sc, { ti: 0, region: R1 }, { ti: 1, region: R2 }), sol(e1.a, e1.b, e2.a, e2.b, x), [`따라서 ${x} 이다.`, "State x."]], variant: "x_from_two_transversals",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "x_from_numeric", structure: "평행선과 횡단선에서 한 각이 숫자, 다른 교점의 각이 x° 일 때 같은 쐐기 종류면 같고 아니면 합이 180° 임을 써서 x 를 구함", extra: "easy: 관계 한 번 적용", concepts: ["평행선의 각", "보각"],
      gen(rng) {
        const sc = ptScene(rng, 1); const R1 = rpick(rng), R2 = rpick(rng); const m1 = measure(sc, 0, R1), m2 = measure(sc, 0, R2); if (R1 === R2) throw new GenFail("같은 쐐기");
        const a1: AngDef = { line: 0, ti: 0, region: R1, label: numLabel(m1) }, a2: AngDef = { line: 1, ti: 0, region: R2, label: "x°" }; const fig = ptFig(sc, [a1, a2]);
        return geoInst(rng, { stimulus: ptIntro(rng, sc), question: QX(rng), correct: m2, wrongs: [W(m1, "other", "주어진 각을 그대로 답했다."), W(180 - m2, "formula_misuse", "같은 각과 보각 관계를 바꿨다."), W(m2 + 10, "other", "계산 중 어긋났다."), W(90 - Math.min(m1, m2) > 0 ? 90 - Math.min(m1, m2) : 20, "formula_misuse", "90° 에서 뺐다.")], verificationJs: figJs({}, fig, `${PT_JS}return angleOf('x°');`), trace: [readStep(sc), relText(sc, { ti: 0, region: R1 }, { ti: 0, region: R2 }), [`x = ${m2} 이다.`, "Apply the relation."]], variant: "x_from_one_angle",
        }, fig);
      },
    },
    {
      lv: "medium", name: "x_corresponding", structure: "평행선과 횡단선에서 같은 쐐기 위치의 두 각이 숫자와 x 의 식일 때 같음으로 방정식을 세워 x 를 구함", extra: "medium: 동위각이 같다는 식을 세워 일차방정식 풀이", concepts: ["평행선의 각", "일차방정식"],
      gen(rng) {
        const sc = ptScene(rng, 1); const R = rpick(rng); const x = rng.int(6, 24); const m = measure(sc, 0, R); const e = exprFor(rng, m, x); if (m < 30 || m > 150) throw new GenFail("각 범위");
        const a1: AngDef = { line: 0, ti: 0, region: R, label: numLabel(m) }, a2: AngDef = { line: 1, ti: 0, region: R, label: e.label }; const fig = ptFig(sc, [a1, a2]);
        return geoInst(rng, { stimulus: ptIntro(rng, sc), question: QX(rng), correct: x, wrongs: [W(m, "step_missing", "각의 크기를 답했다."), W(Math.round((180 - m - e.b) / e.a), "formula_misuse", "같은 각을 보각으로 풀었다."), W(x + 1, "other", "계산 중 어긋났다."), W(Math.round(m / e.a), "step_missing", "상수항을 무시했다.")].filter((w) => Number.isInteger(w.v) && w.v > 0), verificationJs: figJs({}, fig, `${PT_JS}if (!Number.isFinite(x)) throw new Error('x 없음'); return x;`), trace: [readStep(sc), [`두 각은 같은 위치(동위각)라 크기가 같다: ${e.a}x + ${e.b} = ${m}.`, "Corresponding angles are equal."], [`x = ${x} 이다.`, "Solve for x."]], variant: "x_corresponding_angles",
        }, fig);
      },
    },
  ],
});
