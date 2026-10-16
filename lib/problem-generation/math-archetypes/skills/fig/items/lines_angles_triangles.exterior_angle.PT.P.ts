// lines_angles_triangles.exterior_angle.PT.P — 평행선 두 개와 아래에서 만나는 횡단선 두 개가 만드는 삼각형 XPQ 의 각 라벨(동위각 포함)에서 바깥각 정리(바깥각 = 나머지 두 내각의 합)로 x·각을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { CR_JS, crExpr, crFig, crIntro, crNum, crScene, type CrAng, type CrScene } from "../geo-cr-kit";
import { retry } from "../ext-kit";
import { exprLabel } from "../tri-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isInteger(w.v) && w.v > 0 && w.v < 180);
/** 바깥각의 꼭짓점 T(P 또는 Q): 연장하는 변, 바깥각·내각 쐐기, 나머지 한 밑각 쐐기(아래 평행선·위 평행선 중 하나에서 읽는다). */
function pick(rng: Rng, sc: CrScene) { return mk(sc, rng.pick(["P", "Q"] as const), rng.chance(0.5)); }
function mk(sc: CrScene, T: "P" | "Q", upper: boolean) {
  if (T === "P") return { T, name: sc.P, other: sc.Q, from: sc.Q, extAt: "np" as const, extR: "SW" as const, inAt: "np" as const, inR: "SE" as const, E: 180 - sc.al, inner: sc.al, remAt: (upper ? "mq" : "nq") as "mq" | "nq", remR: "SW" as const, rem: sc.be, upper };
  return { T, name: sc.Q, other: sc.P, from: sc.P, extAt: "nq" as const, extR: "SE" as const, inAt: "nq" as const, inR: "SW" as const, E: 180 - sc.be, inner: sc.be, remAt: (upper ? "mp" : "np") as "mp" | "np", remR: "SE" as const, rem: sc.al, upper };
}
type Pk = ReturnType<typeof pick>;
const apexAng = (sc: CrScene, label: string): CrAng => ({ at: "X", region: "N", label });
const ext = (k: Pk, label: string): CrAng => ({ at: k.extAt, region: k.extR, label });
const inn = (k: Pk, label: string): CrAng => ({ at: k.inAt, region: k.inR, label });
const rem = (k: Pk, label: string): CrAng => ({ at: k.remAt, region: k.remR, label });
const QEXT = (rng: Rng, k: Pk, sc: CrScene) => rng.pick([`What is the measure, in degrees, of the exterior angle at $${k.name}$ formed by extending side $${k.from}${k.name}$ beyond $${k.name}$?`, `Side $${k.from}${k.name}$ of triangle $${sc.X}${sc.P}${sc.Q}$ is extended past $${k.name}$. How many degrees is the exterior angle formed at $${k.name}$?`, `What is the degree measure of the exterior angle of triangle $${sc.X}${sc.P}${sc.Q}$ at $${k.name}$ when $${k.from}${k.name}$ is extended past $${k.name}$?`]);
const QIN = (rng: Rng, k: Pk, sc: CrScene) => rng.pick([`What is the measure, in degrees, of angle $${k.name}$ of triangle $${sc.X}${sc.P}${sc.Q}$?`, `What is the degree measure of the interior angle of the triangle at $${k.name}$?`, `How many degrees is the angle at vertex $${k.name}$ inside triangle $${sc.X}${sc.P}${sc.Q}$?`]);
const QX = (rng: Rng) => rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`, `What value of $x$ is shown in the figure?`]);
const EXT_NOTE = (k: Pk, sc: CrScene) => ` Side $${k.from}${k.name}$ is extended past $${k.name}$ along line $${sc.par[1]}$.`;
const corr = (k: Pk, sc: CrScene): [string, string] => k.upper ? [`위 평행선 ${sc.par[0]} 에서 읽은 각은 평행선이므로 동위각으로 삼각형의 ${k.other} 의 각과 같다.`, "The angle at the upper line is a corresponding angle: equal to the triangle's angle at the other base vertex."] : [`삼각형의 ${k.other} 의 각 라벨을 그대로 읽는다.`, "Read the angle at the other base vertex."];
const read: [string, string] = ["그림에서 각 라벨을 읽는다.", "Read the angle labels."];

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.exterior_angle.PT.P",
  hard: [
    {
      op: "compose_kind", structure: "바깥각·꼭대기 각·나머지 밑각(평행선의 동위각일 수 있음)이 x 의 일차식으로 라벨된 그림에서 바깥각 정리로 x 를 구한 뒤 삼각형 내각의 크기를 구함", extra: "동위각을 삼각형의 각으로 옮기고 바깥각 정리로 x 를 구한 뒤 다시 보각으로 내각을 구해야 함(바깥각을 답하는 함정) — medium 은 x 의 값",
      concepts: ["바깥각 정리", "동위각", "보각", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const k = pick(rng, sc); const x = rng.int(8, 26); const eE = crExpr(rng, k.E, x, 1, 5), eG = crExpr(rng, sc.ga, x), eR = crExpr(rng, k.rem, x); if (eE.a === eG.a + eR.a) throw new GenFail("퇴화");
        const fig = crFig(sc, [ext(k, eE.label), apexAng(sc, eG.label), rem(k, eR.label)]);
        return geoInst(rng, {
          stimulus: crIntro(rng, sc, EXT_NOTE(k, sc)), question: QIN(rng, k, sc), correct: k.inner,
          wrongs: pos([W(k.E, "step_missing", "바깥각을 답했다."), W(x, "step_missing", "x 를 답했다."), W(sc.ga + k.rem, "formula_misuse", "두 각의 합(바깥각)을 답했다."), W(180 - sc.ga, "formula_misuse", "꼭대기 각만 빼서 구했다."), W(k.inner + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== k.inner),
          verificationJs: figJs({ at: k.inAt, rg: k.inR }, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); const pr=P.at==='np'?[PAR[1],TR[0]]:[PAR[1],TR[1]]; return meas(pr,P.rg);`),
          trace: [read, corr(k, sc), [`바깥각 정리: ${eE.label.replace("°", "")} = ${eG.label.replace("°", "")} + ${eR.label.replace("°", "")} 에서 x = ${x} 이다.`, "The exterior angle equals the sum of the two remote interior angles."], [`바깥각 = ${k.E}° 이다.`, "Substitute x."], [`삼각형의 ${k.name} 의 각 = 180° - ${k.E}° = ${k.inner}° 이다.`, "The interior angle is supplementary to the exterior angle."], [`따라서 ${k.inner} 이다.`, "State the measure."]], variant: "interior_from_exterior_with_parallels",
        }, fig);
      }); },
    },
    {
      op: "chain2", structure: "삼각형의 두 밑각(동위각 포함)이 x 의 식, 꼭대기 각이 숫자로 라벨된 그림에서 내각의 합 180° 로 x 를 구한 뒤 한 꼭짓점의 바깥각을 구함", extra: "내각의 합으로 x → 밑각 → 바깥각(= 나머지 두 각의 합) 의 연쇄(내각을 답하는 함정) — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "동위각", "바깥각"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const k = pick(rng, sc); const x = rng.int(8, 26); const eR = crExpr(rng, k.rem, x), eI = crExpr(rng, k.inner, x); if (eR.a + eI.a === 0) throw new GenFail("퇴화");
        const fig = crFig(sc, [apexAng(sc, crNum(sc.ga)), rem(k, eR.label), inn(k, eI.label)]);
        return geoInst(rng, {
          stimulus: crIntro(rng, sc, EXT_NOTE(k, sc)), question: QEXT(rng, k, sc), correct: k.E,
          wrongs: pos([W(k.inner, "step_missing", "내각을 답했다."), W(x, "step_missing", "x 를 답했다."), W(180 - k.rem, "formula_misuse", "한 밑각만 빼서 구했다."), W(Math.abs(k.rem - sc.ga), "formula_misuse", "두 각의 차를 구했다."), W(k.E + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== k.E),
          verificationJs: figJs({ at: k.extAt, rg: k.extR }, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); const pr=P.at==='np'?[PAR[1],TR[0]]:[PAR[1],TR[1]]; return meas(pr,P.rg);`),
          trace: [read, corr(k, sc), [`내각의 합: ${crNum(sc.ga).replace("°", "")} + ${eR.label.replace("°", "")} + ${eI.label.replace("°", "")} = 180 에서 x = ${x} 이다.`, "The three interior angles add to 180°."], [`내각 ${k.name} = ${k.inner}° 이다.`, "Substitute x."], [`바깥각 = 180° - ${k.inner}° = ${k.E}° 이다.`, "Exterior = 180° minus the interior angle."], [`따라서 ${k.E} 이다.`, "State the measure."]], variant: "exterior_from_interior_sum",
        }, fig);
      }); },
    },
    {
      op: "repr_shift", structure: "꼭대기 각이 x°, 밑각(동위각일 수 있음)이 kx° 의 비로 라벨되고 바깥각이 숫자인 그림에서 바깥각 정리를 방정식으로 옮겨 큰 각의 크기를 구함", extra: "바깥각 = x + kx 로 번역해 풀고 더 큰 각을 골라야 함(x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["바깥각 정리", "비", "동위각", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const sc0 = crScene(rng); const k0 = pick(rng, sc0); const kk = rng.pick([2, 3]); const gaX = rng.pick([28, 30, 32, 35, 36, 40, 42]); const remV = kk * gaX; if (remV < 46 || remV > 84) throw new GenFail("범위");
        const E = gaX + remV; const baseAng = 180 - E; if (baseAng < 40 || baseAng > 100) throw new GenFail("범위");
        const al = k0.T === "P" ? baseAng : remV, be = k0.T === "P" ? remV : baseAng; const sc = { ...sc0, al, be, ga: gaX }; if (al + be > 144 || al < 44 || be < 44 || al > 85 || be > 85 || al === be || gaX === al || gaX === be) throw new GenFail("범위");
        const k = mk(sc, k0.T, k0.upper);
        const fig = crFig(sc, [ext(k, crNum(E)), apexAng(sc, exprLabel(1, 0)), rem(k, exprLabel(kk, 0))]); const big = Math.max(gaX, remV);
        return geoInst(rng, {
          stimulus: crIntro(rng, sc, EXT_NOTE(k, sc)), question: rng.pick([`What is the measure, in degrees, of the larger of the two angles labeled with $x$?`, `The two angles labeled with $x$ have different measures. What is the degree measure of the larger one?`, `How many degrees is the greater of the two marked remote angles?`]), correct: big,
          wrongs: pos([W(gaX, "step_missing", "x 를 답했다."), W(E, "step_missing", "바깥각을 답했다."), W(Math.round(E / kk), "formula_misuse", "바깥각을 k 로 나누었다."), W(180 - E, "formula_misuse", "내각을 답했다."), W(big + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== big),
          verificationJs: figJs({}, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); const labs=FIGURE.angles.filter(g=>/x/.test(g.label)); return Math.max(...labs.map(g=>meas(g.at,g.region)));`),
          trace: [read, corr(k, sc), [`바깥각 정리: x + ${kk}x = ${E} 에서 x = ${gaX} 이다.`, "The exterior angle is the sum of the remote angles."], [`두 각은 ${gaX}° 와 ${remV}° 이다.`, "The two angles."], [`따라서 ${big} 이다.`, "State the larger measure."]], variant: "larger_remote_from_ratio_parallel",
        }, fig);
      }); },
    },
    {
      op: "inverse", structure: "바깥각이 숫자, 꼭대기 각과 밑각(동위각일 수 있음)이 x 의 식으로 라벨된 그림에서 바깥각 정리의 식을 세워 x 를 역산한 뒤 꼭대기 각의 크기를 구함", extra: "바깥각 = 두 식의 합 에서 거꾸로 x 를 구해 꼭대기 각의 식에 되돌려야 함(바깥각이나 x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["바깥각 정리", "동위각", "일차방정식", "식의 대입"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const k = pick(rng, sc); const x = rng.int(8, 26); const eG = crExpr(rng, sc.ga, x), eR = crExpr(rng, k.rem, x);
        const fig = crFig(sc, [ext(k, crNum(k.E)), apexAng(sc, eG.label), rem(k, eR.label)]);
        return geoInst(rng, {
          stimulus: crIntro(rng, sc, EXT_NOTE(k, sc)), question: rng.pick([`What is the measure, in degrees, of angle $${sc.X}$ of triangle $${sc.X}${sc.P}${sc.Q}$?`, `What is the degree measure of the angle at vertex $${sc.X}$?`, `How many degrees is the angle formed at $${sc.X}$ by the two transversals inside the triangle?`]), correct: sc.ga,
          wrongs: pos([W(x, "step_missing", "x 를 답했다."), W(k.E, "step_missing", "바깥각을 답했다."), W(k.rem, "other", "다른 각을 답했다."), W(eG.a * x, "step_missing", "상수항을 더하지 않았다."), W(sc.ga + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== sc.ga),
          verificationJs: figJs({}, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); return GA;`),
          trace: [read, corr(k, sc), [`바깥각 정리: ${k.E} = ${eG.label.replace("°", "")} + ${eR.label.replace("°", "")} 에서 x = ${x} 이다.`, "Set the exterior angle equal to the sum of the remote angles; solve for x."], [`∠${sc.X} = ${eG.label.replace("°", "")} = ${sc.ga}° 이다.`, "Substitute x into the apex label."], [`따라서 ${sc.ga} 이다.`, "State the measure."]], variant: "apex_from_exterior_equation",
        }, fig);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "outer_from_remote", structure: "꼭대기 각과 나머지 밑각이 숫자로 주어진 그림에서 바깥각을 두 각의 합으로 구함", extra: "easy: 바깥각 정리 한 번 적용", concepts: ["바깥각 정리", "덧셈"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const k = pick(rng, sc); const fig = crFig(sc, [apexAng(sc, crNum(sc.ga)), { at: k.upper ? k.remAt : k.remAt, region: k.remR, label: crNum(k.rem) }]);
        return geoInst(rng, { stimulus: crIntro(rng, sc, EXT_NOTE(k, sc)), question: QEXT(rng, k, sc), correct: k.E, wrongs: pos([W(k.inner, "step_missing", "내각을 답했다."), W(Math.abs(k.rem - sc.ga), "formula_misuse", "두 각의 차를 구했다."), W(180 - k.rem, "formula_misuse", "한 각만 빼서 구했다."), W(k.E + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== k.E), verificationJs: figJs({ at: k.extAt, rg: k.extR }, fig, `${CR_JS}const pr=P.at==='np'?[PAR[1],TR[0]]:[PAR[1],TR[1]]; return meas(pr,P.rg);`), trace: [read, corr(k, sc), [`바깥각 = ${sc.ga}° + ${k.rem}° = ${k.E}° 이다.`, "Exterior angle = sum of the remote angles."]], variant: "outer_from_two_numbers_parallel" }, fig);
      }); },
    },
    {
      lv: "medium", name: "solve_x", structure: "꼭대기 각과 나머지 밑각이 x 의 일차식, 바깥각이 숫자인 그림에서 바깥각 정리로 x 를 구함", extra: "medium: 일차방정식 한 번", concepts: ["바깥각 정리", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const k = pick(rng, sc); const x = rng.int(8, 26); const eG = crExpr(rng, sc.ga, x), eR = crExpr(rng, k.rem, x); if (eG.a + eR.a === 0) throw new GenFail("퇴화");
        const fig = crFig(sc, [ext(k, crNum(k.E)), apexAng(sc, eG.label), rem(k, eR.label)]);
        return geoInst(rng, { stimulus: crIntro(rng, sc, EXT_NOTE(k, sc)), question: QX(rng), correct: x, wrongs: pos([W(sc.ga, "step_missing", "각의 크기를 답했다."), W(Math.round((180 - k.E - eG.b - eR.b) / (eG.a + eR.a)), "formula_misuse", "바깥각을 내각으로 보았다."), W(Math.round((k.E - eG.b) / (eG.a + eR.a)), "step_missing", "한 식의 상수항만 옮겼다."), W(x + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({}, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); return X;`), trace: [read, corr(k, sc), [`바깥각 정리: ${eG.label.replace("°", "")} + ${eR.label.replace("°", "")} = ${k.E} 이다.`, "Sum of remote angles = exterior angle."], [`x = ${x} 이다.`, "Solve."]], variant: "solve_x_exterior_parallel" }, fig);
      }); },
    },
  ],
});
