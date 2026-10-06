// right_triangles_trigonometry.trig_ratio.TC.P — 사인(또는 코사인) 곡선 위 표시점 (a, y) 의 y 라벨에서 같은 각 a 의 다른 삼각비를 구한다(피타고라스 항등식 + 곡선 위 위치로 부호). 탄젠트·두 점 비교·역산으로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { TCP_JS, absR, addR, divR, invR, makeTcPoint, mulR, negR, ratLab, ratTxt, subR, trigFig, type Rat, type TcPoint } from "../tc-kit";

type Fn = "sin" | "cos";
const FW = (r: Rat, kind: DistractorKind, reason: string) => ({ text: ratTxt(r), kind, reason });
const oth = (f: Fn): Fn => (f === "sin" ? "cos" : "sin");
const own = (p: TcPoint, f: Fn): Rat => (f === "sin" ? p.y : p.x);
const otherV = (p: TcPoint, f: Fn): Rat => (f === "sin" ? p.x : p.y);
const NAMES = ["a", "b", "c", "h", "k", "s", "t", "u"];
const LEAD = ["", "", "A student plots a trigonometric function for homework. ", "A teacher posts a graph on the board. ", "A tutor sketches a curve to review trigonometric values. ", "A graphing exercise shows the curve below. ", "In a review packet, the following graph appears. ", "A textbook figure shows a point on a familiar curve. ", "A study guide includes the graph shown below. "];
const Q = ["", "I", "II", "III", "IV"];
const quad = (deg: number) => (deg < 90 ? 1 : deg < 180 ? 2 : deg < 270 ? 3 : 4);
const FNAME: Record<Fn, string> = { sin: "사인", cos: "코사인" };
const intro = (rng: Rng, f: Fn, v: string, extra = "") => rng.pick(LEAD) + rng.pick([
  `The graph of $y = \\${f} x$ for $0 \\le x \\le 2\\pi$ is shown in the $xy$-plane. Point $P$ is on the graph, and its coordinates are labeled, with $x = ${v}$.${extra}`,
  `In the $xy$-plane, the figure shows the graph of $y = \\${f} x$ on the interval from $0$ to $2\\pi$. The labeled point $P$ lies on the graph and has $x$-coordinate $${v}$.${extra}`,
  `The curve $y = \\${f} x$, $0 \\le x \\le 2\\pi$, is graphed in the figure. Point $P$ on the curve is marked with its coordinates, where $${v}$ is its $x$-coordinate.${extra}`,
  `Shown is the graph of $y = \\${f} x$ for $0 \\le x \\le 2\\pi$. Point $P$ is on the graph with $x$-coordinate $${v}$, and the coordinates of $P$ are labeled.${extra}`,
]);
const intro2 = (rng: Rng, f: Fn, v: string, w: string) => rng.pick(LEAD) + rng.pick([
  `The graph of $y = \\${f} x$ for $0 \\le x \\le 2\\pi$ is shown. Points $P$ and $Q$ are on the graph; their coordinates are labeled, with $x$-coordinates $${v}$ and $${w}$, respectively.`,
  `In the figure, points $P$ and $Q$ lie on the curve $y = \\${f} x$, $0 \\le x \\le 2\\pi$. The $x$-coordinate of $P$ is $${v}$ and the $x$-coordinate of $Q$ is $${w}$; both points are labeled.`,
]);
const ask = (rng: Rng, fn: string, v: string) => rng.pick([`What is the value of $\\${fn} ${v}$?`, `What is $\\${fn} ${v}$?`, `Find $\\${fn} ${v}$.`]);
const fig1 = (f: Fn, p: TcPoint, v: string, mask: "y" | "both") => trigFig(f, [{ p, name: "P", label: mask === "both" ? `(${v}, b)` : `(${v}, ${ratLab(own(p, f))})` }]);
const rd = (f: Fn, p: TcPoint): [string, string] => [`그림에서 점 P 의 라벨을 읽는다: y 좌표 ${f} a = ${ratTxt(own(p, f))}.`, "Read the y-coordinate from the label."];
const posStep = (p: TcPoint, f: Fn): [string, string] => [`점 P 의 x 위치가 ${Q[quad(p.deg)]}사분면에 해당하므로 ${FNAME[oth(f)]}의 부호는 ${otherV(p, f)[0] > 0 ? "양" : "음"}이다.`, "The position of P on the axis fixes the sign."];

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.trig_ratio.TC.P",
  hard: [
    {
      op: "chain2", structure: "곡선 위 점의 y 라벨에서 x²+y²=1 로 다른 삼각비의 크기를 구하고 점의 x 위치(사분면)로 부호를 정함", extra: "피타고라스 항등식으로 크기를 구한 뒤 그림에서 점이 놓인 구간으로 부호를 정해야 함(부호를 놓치는 함정) — medium 은 점이 제1사분면에 있는 경우",
      concepts: ["삼각함수 그래프", "피타고라스 항등식", "사분면 부호"],
      gen(rng) {
        const f = rng.pick(["sin", "cos"] as const); const p = makeTcPoint(rng); const v = rng.pick(NAMES); const want = otherV(p, f); const g = oth(f);
        return gInst(rng, {
          stimulus: intro(rng, f, v), question: ask(rng, g, v), correctText: ratTxt(want), range: [-1000, 1000],
          wrongTexts: [FW(absR(want), "sign_error", "그래프에서 부호를 확인하지 않았다."), FW(negR(want), "sign_error", "부호를 반대로 정했다."), FW(own(p, f), "formula_misuse", `주어진 ${f} 값을 그대로 답했다.`), FW(invR(want), "formula_misuse", "역수를 답했다."), FW(divR(own(p, f), want), "formula_misuse", "탄젠트를 구했다.")],
          verificationJs: figJs({ f }, fig1(f, p, v, "y"), `${TCP_JS}const pr=pairAt(0); return P.f==='sin'?pr.c:pr.s;`),
          trace: [rd(f, p), [`${f}² + ${g}² = 1 에서 ${g} a 의 크기는 ${ratTxt(absR(want))} 이다.`, "Use the Pythagorean identity."], posStep(p, f), [`${g} a = ${ratTxt(want)} 이다.`, "Combine magnitude and sign."], [`따라서 ${ratTxt(want)} 이다.`, "State the value."]], variant: `${g}_from_${f}_curve_${Q[quad(p.deg)]}`,
        }, fig1(f, p, v, "y"));
      },
    },
    {
      op: "compose_kind", structure: "곡선 위 점의 y 라벨에서 사인과 코사인을 모두 구해 탄젠트(사인 ÷ 코사인)를 구함", extra: "다른 삼각비를 먼저 구해(부호 포함) 나누어야 함(한 값만 답하거나 부호·역수를 놓치는 함정) — medium 은 한 삼각비",
      concepts: ["삼각함수 그래프", "탄젠트", "사분면 부호"],
      gen(rng) {
        const f = rng.pick(["sin", "cos"] as const); const p = makeTcPoint(rng); const v = rng.pick(NAMES); const t = divR(p.y, p.x);
        return gInst(rng, {
          stimulus: intro(rng, f, v), question: ask(rng, "tan", v), correctText: ratTxt(t), range: [-1000, 1000],
          wrongTexts: [FW(absR(t), "sign_error", "부호를 놓쳤다."), FW(invR(t), "formula_misuse", "탄젠트를 역수로 구했다."), FW(own(p, f), "step_missing", `${f} 값만 답했다.`), FW(otherV(p, f), "step_missing", `${oth(f)} 값만 답했다.`), FW(negR(t), "sign_error", "부호를 반대로 정했다.")],
          verificationJs: figJs({ f }, fig1(f, p, v, "y"), `${TCP_JS}const pr=pairAt(0); return pr.s/pr.c;`),
          trace: [rd(f, p), [`x² + y² = 1 에서 ${oth(f)} a 의 크기는 ${ratTxt(absR(otherV(p, f)))} 이다.`, "Magnitude from the identity."], posStep(p, f), [`tan a = sin a ÷ cos a = ${ratTxt(p.y)} ÷ (${ratTxt(p.x)}) = ${ratTxt(t)} 이다.`, "Divide sine by cosine."], [`따라서 ${ratTxt(t)} 이다.`, "State the value."]], variant: `tan_from_${f}_curve`,
        }, fig1(f, p, v, "y"));
      },
    },
    {
      op: "compare_scenarios", structure: "같은 곡선 위 두 점의 y 라벨에서 두 각의 다른 삼각비를 각각 구해 차를 구함", extra: "두 점의 위치로 각각 부호를 정해 빼야 함(합을 구하거나 부호를 놓치는 함정) — medium 은 한 점",
      concepts: ["삼각함수 그래프", "피타고라스 항등식", "두 각 비교"],
      gen(rng) {
        const f = rng.pick(["sin", "cos"] as const); const p = makeTcPoint(rng), q = makeTcPoint(rng, { not: p }); const [v, w] = rng.shuffle(NAMES).slice(0, 2); const g = oth(f);
        const a = otherV(p, f), b = otherV(q, f); const d = subR(a, b); if (d[0] === 0) throw new GenFail("차가 0");
        const fg = trigFig(f, [{ p, name: "P", label: `(${v}, ${ratLab(own(p, f))})` }, { p: q, name: "Q", label: `(${w}, ${ratLab(own(q, f))})` }]);
        return gInst(rng, {
          stimulus: intro2(rng, f, v, w), question: rng.pick([`What is the value of $\\${g} ${v} - \\${g} ${w}$?`, `What is $\\${g} ${v}$ minus $\\${g} ${w}$?`]), correctText: ratTxt(d), range: [-1000, 1000],
          wrongTexts: [FW(negR(d), "sign_error", "빼는 순서를 바꿨다."), FW(addR(a, b), "sign_error", "합을 구했다."), FW(a, "step_missing", "첫 값만 답했다."), FW(b, "step_missing", "둘째 값만 답했다."), FW(subR(absR(a), absR(b)), "sign_error", "크기만으로 뺐다.")],
          verificationJs: figJs({ f }, fg, `${TCP_JS}const A=pairAt(0), B=pairAt(1); return P.f==='sin'?(A.c-B.c):(A.s-B.s);`),
          trace: [[`그림에서 두 점의 라벨을 읽는다: P ${f} = ${ratTxt(own(p, f))}, Q ${f} = ${ratTxt(own(q, f))}.`, "Read both labeled points."], [`두 점 모두 x²+y²=1 에서 ${g} 의 크기를 구한다.`, "Magnitudes from the identity."], [`위치로 부호를 정하면 ${g} ${v} = ${ratTxt(a)}, ${g} ${w} = ${ratTxt(b)} 이다.`, "Signs from the positions."], [`차 = ${ratTxt(a)} - (${ratTxt(b)}) = ${ratTxt(d)} 이다.`, "Subtract."], [`따라서 ${ratTxt(d)} 이다.`, "State the difference."]], variant: `${g}_difference_two_points_${f}_curve`,
        }, fg);
      },
    },
    {
      op: "inverse", structure: "곡선 위 점의 y 좌표가 문자로 가려지고 다른 삼각비의 값이 주어질 때 피타고라스 항등식과 그림의 점 높이로 y 좌표를 구함", extra: "주어진 값에서 크기를 거꾸로 구하고 부호는 그림에서 점이 축 위·아래 어디에 있는지로 정해야 함(부호를 놓치는 함정) — medium 은 y 라벨이 보이는 점",
      concepts: ["삼각함수 그래프", "피타고라스 항등식", "역산", "부호"],
      gen(rng) {
        const f = rng.pick(["sin", "cos"] as const); const p = makeTcPoint(rng); const v = rng.pick(NAMES); const g = oth(f); const given = otherV(p, f); const want = own(p, f);
        const gTex = `${given[0] < 0 ? "-" : ""}\\frac{${Math.abs(given[0])}}{${given[1]}}`;
        if (given[1] === 1) throw new GenFail("정수");
        return gInst(rng, {
          stimulus: intro(rng, f, v, ` It is known that $\\${g} ${v} = ${gTex}$.`), question: rng.pick(["What is the $y$-coordinate of point $P$?", "What is the $y$-coordinate of $P$?"]), correctText: ratTxt(want), range: [-1000, 1000],
          wrongTexts: [FW(absR(want), "sign_error", "그래프에서 부호를 확인하지 않았다."), FW(negR(want), "sign_error", "부호를 반대로 정했다."), FW(given, "formula_misuse", "주어진 값을 그대로 답했다."), FW(invR(want), "formula_misuse", "역수를 답했다.")],
          verificationJs: figJs({ f, gn: given[0], gd: given[1] }, fig1(f, p, v, "both"), `${TCP_JS}const q=PTS[0]; const a=ang(0); const gv=P.gn/P.gd; const mag=Math.sqrt(Math.max(0,1-gv*gv)); const s=P.f==='sin'?sgn(Math.sin(a)):sgn(Math.cos(a)); return s*mag;`),
          trace: [[`그림에서 점 P 의 라벨은 (${v}, b) 이고 ${g} ${v} = ${ratTxt(given)} 이다.`, "The y-coordinate is hidden; the other ratio is given."], [`${f}² + ${g}² = 1 에서 ${f} ${v} 의 크기는 ${ratTxt(absR(want))} 이다.`, "Magnitude from the identity."], [`그림에서 점 P 는 x축 ${want[0] > 0 ? "위" : "아래"}에 있으므로 y 좌표의 부호는 ${want[0] > 0 ? "양" : "음"}이다.`, "The drawn height gives the sign."], [`y 좌표 = ${ratTxt(want)} 이다.`, "Combine magnitude and sign."], [`따라서 ${ratTxt(want)} 이다.`, "State the value."]], variant: `${f}_y_from_${g}`,
        }, fig1(f, p, v, "both"));
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_y", structure: "곡선 위 점의 y 라벨을 읽어 그 각의 사인(또는 코사인)을 답함", extra: "easy: 라벨의 y 좌표가 곧 곡선의 값", concepts: ["삼각함수 그래프", "사인·코사인의 뜻"],
      gen(rng) {
        const f = rng.pick(["sin", "cos"] as const); const p = makeTcPoint(rng); const v = rng.pick(NAMES); const y = own(p, f);
        return gInst(rng, {
          stimulus: intro(rng, f, v), question: ask(rng, f, v), correctText: ratTxt(y), range: [-1000, 1000],
          wrongTexts: [FW(otherV(p, f), "formula_misuse", `${oth(f)} 값을 답했다.`), FW(negR(y), "sign_error", "부호를 반대로 정했다."), FW(invR(y), "formula_misuse", "역수를 답했다."), FW(divR(p.y, p.x), "formula_misuse", "탄젠트를 구했다.")],
          verificationJs: figJs({ f }, fig1(f, p, v, "y"), `${TCP_JS}return yv(0);`),
          trace: [rd(f, p), [`곡선 y = ${f} x 위의 점이므로 ${f} a 는 점의 y 좌표이다.`, "On y = f(x), the y-coordinate is f(a)."], [`따라서 ${ratTxt(y)} 이다.`, "State the value."]], variant: `${f}_read_label`,
        }, fig1(f, p, v, "y"));
      },
    },
    {
      lv: "medium", name: "first_quadrant", structure: "곡선 위 점이 0 < a < π/2 에 있을 때 y 라벨에서 다른 삼각비를 구함", extra: "medium: 부호가 양수인 구간에서 항등식 적용", concepts: ["삼각함수 그래프", "피타고라스 항등식"],
      gen(rng) {
        const f = rng.pick(["sin", "cos"] as const); const p = makeTcPoint(rng); if (!(p.x[0] > 0 && p.y[0] > 0)) throw new GenFail("1사분면만"); const v = rng.pick(NAMES); const g = oth(f); const want = otherV(p, f);
        return gInst(rng, {
          stimulus: intro(rng, f, v), question: ask(rng, g, v), correctText: ratTxt(want), range: [-1000, 1000],
          wrongTexts: [FW(own(p, f), "formula_misuse", `주어진 ${f} 값을 그대로 답했다.`), FW(invR(want), "formula_misuse", "역수를 답했다."), FW(divR(own(p, f), want), "formula_misuse", "탄젠트를 구했다."), FW(negR(want), "sign_error", "부호를 반대로 정했다.")],
          verificationJs: figJs({ f }, fig1(f, p, v, "y"), `${TCP_JS}const pr=pairAt(0); return P.f==='sin'?pr.c:pr.s;`),
          trace: [rd(f, p), [`${f}² + ${g}² = 1 에서 ${g} a = ${ratTxt(want)} 이다.`, "Use the Pythagorean identity."], [`점이 첫 구간에 있으므로 부호는 양이다.`, "The first quadrant is positive."]], variant: `${g}_first_quadrant`,
        }, fig1(f, p, v, "y"));
      },
    },
  ],
});
void mulR;
