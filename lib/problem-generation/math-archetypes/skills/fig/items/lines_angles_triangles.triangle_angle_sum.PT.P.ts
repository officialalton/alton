// lines_angles_triangles.triangle_angle_sum.PT.P — 평행선 두 개와 아래에서 만나는 횡단선 두 개가 만드는 삼각형 XPQ 의 세 각 라벨(위 평행선의 동위각 포함)에서 내각의 합 180° 로 x 와 각을 구한다.
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
/** 삼각형 세 각을 읽는 자리: al(P 의 각)·be(Q 의 각)는 아래 평행선(삼각형의 각 그대로) 또는 위 평행선(동위각)에서, ga 는 꼭대기 X. */
function spots(rng: Rng) { return { upA: rng.chance(0.5), upB: rng.chance(0.5) }; }
type Sp = ReturnType<typeof spots>;
const angAl = (s: Sp, label: string): CrAng => ({ at: s.upA ? "mp" : "np", region: "SE", label });
const angBe = (s: Sp, label: string): CrAng => ({ at: s.upB ? "mq" : "nq", region: "SW", label });
const angGa = (label: string): CrAng => ({ at: "X", region: "N", label });
const read: [string, string] = ["그림에서 세 각의 라벨을 읽는다.", "Read the three angle labels."];
const corr = (s: Sp, sc: CrScene): [string, string] => (s.upA || s.upB) ? [`위 평행선 ${sc.par[0]} 에서 읽은 각은 동위각이므로 삼각형 ${sc.X}${sc.P}${sc.Q} 의 각과 같다.`, "Angles read at the upper line are corresponding angles: equal to the triangle's angles."] : [`세 각은 모두 삼각형 ${sc.X}${sc.P}${sc.Q} 의 내각이다.`, "All three are interior angles of the triangle."];
const nm = (sc: CrScene) => `${sc.X}${sc.P}${sc.Q}`;
const QX = (rng: Rng) => rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`, `What value of $x$ is shown in the figure?`]);
const trig = (sc: CrScene, s: Sp, labels: [string, string, string]): [string, string] => [`삼각형 ${nm(sc)} 의 세 각 ${labels.join(", ")} 의 합이 180° 이다.`, "The interior angles add to 180°."]; void trig;

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.triangle_angle_sum.PT.P",
  hard: [
    {
      op: "compose_kind", structure: "삼각형의 세 각이 x 의 일차식으로 라벨된 그림(두 각은 위 평행선의 동위각일 수 있음)에서 내각의 합 180° 로 x 를 구한 뒤 가장 큰 각의 크기를 구함", extra: "동위각을 삼각형의 각으로 옮겨 합 180° 의 방정식을 세우고 각각에 되돌려 가장 큰 각을 골라야 함(x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "동위각", "일차방정식", "각의 크기 비교"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const s = spots(rng); const x = rng.int(8, 26); const eA = crExpr(rng, sc.al, x), eB = crExpr(rng, sc.be, x), eG = crExpr(rng, sc.ga, x); if (eA.a + eB.a + eG.a === 0) throw new GenFail("퇴화"); const big = Math.max(sc.al, sc.be, sc.ga);
        const fig = crFig(sc, [angAl(s, eA.label), angBe(s, eB.label), angGa(eG.label)]);
        return geoInst(rng, {
          stimulus: crIntro(rng, sc), question: rng.pick([`What is the measure, in degrees, of the largest angle of triangle $${nm(sc)}$?`, `What is the degree measure of the largest interior angle of the triangle?`, `The greatest angle of triangle $${nm(sc)}$ measures how many degrees?`]), correct: big,
          wrongs: pos([W(x, "step_missing", "x 를 답했다."), W(Math.min(sc.al, sc.be, sc.ga), "opposite", "가장 작은 각을 답했다."), W(180 - big, "formula_misuse", "나머지 두 각의 합을 답했다."), W(sc.al + sc.be, "formula_misuse", "두 밑각의 합을 답했다."), W(big + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== big),
          verificationJs: figJs({}, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); return Math.max(AL,BE,GA);`),
          trace: [read, corr(s, sc), [`내각의 합: ${eA.label.replace("°", "")} + ${eB.label.replace("°", "")} + ${eG.label.replace("°", "")} = 180 에서 x = ${x} 이다.`, "The three angles add to 180°; solve for x."], [`세 각은 ${sc.al}°, ${sc.be}°, ${sc.ga}° 이다.`, "Substitute x."], [`가장 큰 각은 ${big}° 이다.`, "Pick the largest."], [`따라서 ${big} 이다.`, "State the measure."]], variant: "largest_angle_parallel_triangle",
        }, fig);
      }); },
    },
    {
      op: "chain2", structure: "삼각형의 두 각이 x 의 식(동위각일 수 있음), 꼭대기 각이 숫자로 라벨된 그림에서 내각의 합으로 x 를 구한 뒤 한 밑각의 크기를 구함", extra: "합 180° → x → 식에 되돌려 밑각 의 연쇄(꼭대기 각이나 x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "동위각", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const s = spots(rng); const x = rng.int(8, 26); const eA = crExpr(rng, sc.al, x), eB = crExpr(rng, sc.be, x); if (eA.a + eB.a === 0) throw new GenFail("퇴화"); const askP = rng.chance(0.5); const tgt = askP ? sc.al : sc.be; const who = askP ? sc.P : sc.Q;
        const fig = crFig(sc, [angAl(s, eA.label), angBe(s, eB.label), angGa(crNum(sc.ga))]);
        return geoInst(rng, {
          stimulus: crIntro(rng, sc), question: rng.pick([`What is the measure, in degrees, of angle $${who}$ of triangle $${nm(sc)}$?`, `What is the degree measure of the interior angle at vertex $${who}$?`, `How many degrees is the angle of the triangle at $${who}$?`]), correct: tgt,
          wrongs: pos([W(x, "step_missing", "x 를 답했다."), W(sc.ga, "other", "꼭대기 각을 답했다."), W(askP ? sc.be : sc.al, "other", "다른 밑각을 답했다."), W((askP ? eA : eB).a * x, "step_missing", "상수항을 더하지 않았다."), W(tgt + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== tgt),
          verificationJs: figJs({ who: askP ? "P" : "Q" }, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); return P.who==='P'?AL:BE;`),
          trace: [read, corr(s, sc), [`내각의 합: ${eA.label.replace("°", "")} + ${eB.label.replace("°", "")} + ${sc.ga} = 180 에서 x = ${x} 이다.`, "The three angles add to 180°."], [`∠${who} = ${(askP ? eA : eB).label.replace("°", "")} = ${tgt}° 이다.`, "Substitute x into the label of the asked angle."], [`꼭대기 각은 ${sc.ga}° 로 합이 180° 이다.`, "Check the sum."], [`따라서 ${tgt} 이다.`, "State the measure."]], variant: "base_angle_from_sum_parallel",
        }, fig);
      }); },
    },
    {
      op: "repr_shift", structure: "삼각형의 세 각이 ax°, bx°, cx° 의 비로 라벨된 그림(두 각은 동위각일 수 있음)에서 비를 식으로 옮겨 합 180° 로 지정한 각의 크기를 구함", extra: "비 라벨의 계수 합 = 180° 로 x 를 구해 가장 작은(또는 큰) 각을 골라야 함 — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "비", "동위각"],
      gen(rng) { return retry(rng, () => {
        const sets: [number, number, number][] = [[2, 3, 4], [3, 4, 5], [2, 3, 5], [4, 5, 6], [3, 5, 7], [2, 4, 5]]; const set = rng.pick(sets); const sum = set[0] + set[1] + set[2]; if (180 % sum) throw new GenFail("비"); const k = 180 / sum;
        const p = rng.shuffle([...set]) as [number, number, number]; const [a, b, g] = p.map((q) => q * k) as [number, number, number]; if (a < 46 || a > 85 || b < 46 || b > 85 || g < 30 || a === b || g === a || g === b) throw new GenFail("범위");
        const sc: CrScene = { ...crScene(rng), al: a, be: b, ga: g }; const s = spots(rng); const askSmall = rng.chance(0.5); const vals = [a, b, g]; const correct = askSmall ? Math.min(...vals) : Math.max(...vals);
        const fig = crFig(sc, [angAl(s, exprLabel(p[0], 0)), angBe(s, exprLabel(p[1], 0)), angGa(exprLabel(p[2], 0))]);
        return geoInst(rng, {
          stimulus: crIntro(rng, sc, " The angles are in the ratio shown."), question: askSmall ? rng.pick([`What is the measure, in degrees, of the smallest angle of triangle $${nm(sc)}$?`, `The smallest interior angle of the triangle measures how many degrees?`]) : rng.pick([`What is the measure, in degrees, of the largest angle of triangle $${nm(sc)}$?`, `The largest interior angle of the triangle measures how many degrees?`]), correct,
          wrongs: pos([W(k, "step_missing", "x 를 답했다."), W(askSmall ? Math.max(...vals) : Math.min(...vals), "opposite", "반대 각을 답했다."), W(60, "formula_misuse", "세 각이 같다고 보았다."), W(180 - correct, "formula_misuse", "나머지 두 각의 합을 답했다."), W(correct + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ small: askSmall ? 1 : 0 }, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); return P.small?Math.min(AL,BE,GA):Math.max(AL,BE,GA);`),
          trace: [read, corr(s, sc), [`합: ${p.join("x + ")}x = ${sum}x = 180 에서 x = ${k} 이다.`, "The ratio parts add to 180°."], [`세 각은 ${a}°, ${b}°, ${g}° 이다.`, "Multiply."], [`${askSmall ? "가장 작은" : "가장 큰"} 각은 ${correct}° 이다.`, "Pick the requested angle."], [`따라서 ${correct} 이다.`, "State the measure."]], variant: askSmall ? "smallest_angle_ratio_parallel" : "largest_angle_ratio_parallel",
        }, fig);
      }); },
    },
    {
      op: "inverse", structure: "삼각형의 한 각이 숫자, 나머지 두 각이 x 의 식으로 라벨된 그림(동위각일 수 있음)에서 180° 에서 숫자 각을 뺀 뒤 x 를 역산해 지정한 각의 크기를 구함", extra: "180° − 숫자 각 = 나머지 두 식의 합 으로 x 를 거꾸로 구해 식에 되돌려야 함(숫자 각을 답하는 함정) — medium 은 x 의 값",
      concepts: ["삼각형 내각의 합", "동위각", "일차방정식", "식의 대입"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const s = spots(rng); const x = rng.int(8, 26); const numAt = rng.pick(["al", "be", "ga"] as const); const vals = { al: sc.al, be: sc.be, ga: sc.ga }; const others = (["al", "be", "ga"] as const).filter((q) => q !== numAt); const e1 = crExpr(rng, vals[others[0]], x), e2 = crExpr(rng, vals[others[1]], x); if (e1.a + e2.a === 0) throw new GenFail("퇴화");
        const lab = { al: "", be: "", ga: "" }; lab[numAt] = crNum(vals[numAt]); lab[others[0]] = e1.label; lab[others[1]] = e2.label; const tgt = others[rng.int(0, 1)]; const who = tgt === "al" ? sc.P : tgt === "be" ? sc.Q : sc.X; const e = tgt === others[0] ? e1 : e2;
        const fig = crFig(sc, [angAl(s, lab.al), angBe(s, lab.be), angGa(lab.ga)]);
        return geoInst(rng, {
          stimulus: crIntro(rng, sc), question: rng.pick([`What is the measure, in degrees, of angle $${who}$ of triangle $${nm(sc)}$?`, `What is the degree measure of the interior angle at vertex $${who}$?`]), correct: vals[tgt],
          wrongs: pos([W(x, "step_missing", "x 를 답했다."), W(vals[numAt], "other", "숫자로 주어진 각을 답했다."), W(180 - vals[numAt], "formula_misuse", "나머지 두 각의 합을 답했다."), W(e.a * x, "step_missing", "상수항을 더하지 않았다."), W(vals[tgt] + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== vals[tgt]),
          verificationJs: figJs({ t: tgt }, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); return P.t==='al'?AL:P.t==='be'?BE:GA;`),
          trace: [read, corr(s, sc), [`나머지 두 각의 합 = 180° - ${vals[numAt]}° = ${180 - vals[numAt]}° 이다.`, "The other two angles add to 180° minus the given angle."], [`두 식의 합을 ${180 - vals[numAt]} 와 같게 놓아 x = ${x} 를 얻는다.`, "Solve for x."], [`∠${who} = ${e.label.replace("°", "")} = ${vals[tgt]}° 이다.`, "Substitute x."], [`따라서 ${vals[tgt]} 이다.`, "State the measure."]], variant: "angle_from_one_numeric_angle_parallel",
        }, fig);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "third_angle", structure: "두 각이 숫자로 주어진 그림에서 셋째 각(x°)을 180° 에서 빼서 구함", extra: "easy: 내각의 합 180° 한 번 적용", concepts: ["삼각형 내각의 합", "뺄셈"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const s = spots(rng); const k = rng.pick(["al", "be", "ga"] as const); const vals = { al: sc.al, be: sc.be, ga: sc.ga }; const lab = { al: crNum(sc.al), be: crNum(sc.be), ga: crNum(sc.ga) }; lab[k] = "x°";
        const fig = crFig(sc, [angAl(s, lab.al), angBe(s, lab.be), angGa(lab.ga)]); const o = (["al", "be", "ga"] as const).filter((q) => q !== k);
        return geoInst(rng, { stimulus: crIntro(rng, sc), question: QX(rng), correct: vals[k], wrongs: pos([W(vals[o[0]] + vals[o[1]], "formula_misuse", "두 각의 합을 답했다."), W(90 - vals[o[0]], "formula_misuse", "90°에서 뺐다."), W(vals[o[0]], "other", "다른 각을 답했다."), W(vals[k] + 10, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== vals[k]), verificationJs: figJs({}, fig, `${CR_JS}const x=FIGURE.angles.find(g=>/^x/.test(g.label)); if(!x) throw new Error('x 라벨 없음'); return meas(x.at,x.region);`), trace: [read, corr(s, sc), [`x = 180 - ${vals[o[0]]} - ${vals[o[1]]} = ${vals[k]} 이다.`, "Subtract the two known angles from 180°."]], variant: "third_angle_numbers_parallel" }, fig);
      }); },
    },
    {
      lv: "medium", name: "solve_x", structure: "세 각이 x 의 일차식인 그림에서 합 180° 로 x 를 구함", extra: "medium: 일차방정식 한 번", concepts: ["삼각형 내각의 합", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const sc = crScene(rng); const s = spots(rng); const x = rng.int(8, 26); const eA = crExpr(rng, sc.al, x), eB = crExpr(rng, sc.be, x), eG = crExpr(rng, sc.ga, x); if (eA.a + eB.a + eG.a === 0) throw new GenFail("퇴화");
        const fig = crFig(sc, [angAl(s, eA.label), angBe(s, eB.label), angGa(eG.label)]);
        return geoInst(rng, { stimulus: crIntro(rng, sc), question: QX(rng), correct: x, wrongs: pos([W(sc.al, "formula_misuse", "첫 각을 답했다."), W(Math.round((180 - eA.b - eB.b - eG.b) / (eA.a + eB.a + eG.a + 1)), "formula_misuse", "계수 합을 잘못 셌다."), W(Math.round(180 / (eA.a + eB.a + eG.a)), "step_missing", "상수항을 무시했다."), W(x + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({}, fig, `${CR_JS}if (!Number.isFinite(X)) throw new Error('x 없음'); return X;`), trace: [read, corr(s, sc), [`내각의 합: ${eA.label.replace("°", "")} + ${eB.label.replace("°", "")} + ${eG.label.replace("°", "")} = 180 이다.`, "The angles add to 180°."], [`x = ${x} 이다.`, "Solve."]], variant: "solve_x_parallel_triangle" }, fig);
      }); },
    },
  ],
});
