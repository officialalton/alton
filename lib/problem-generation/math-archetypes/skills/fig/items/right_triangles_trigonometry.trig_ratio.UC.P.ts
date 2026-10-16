// right_triangles_trigonometry.trig_ratio.UC.P — 단위원 위 점 P 의 좌표 라벨에서 표준위치 각 θ 의 사인·코사인·탄젠트를 구하고, 빠진 좌표 복원·두 값의 합·두 각 비교·역산으로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { UC_JS, UC_LEADS, addR, divR, makeRatPoint, mulR, ratLabel, ratTxt, subR, ucCtx, type Fn, type Rat, type UcCtx, type UcRat } from "../uc-kit";

const FW = (r: Rat, kind: DistractorKind, reason: string) => ({ text: ratTxt(r), kind, reason });
const fn3 = (p: UcRat, f: Fn): Rat => (f === "sin" ? p.y : f === "cos" ? p.x : divR(p.y, p.x));
const neg = (r: Rat): Rat => [-r[0], r[1]];
const inv = (r: Rat): Rat => (r[0] < 0 ? [-r[1], -r[0]] : [r[1], r[0]]);
const abs = (r: Rat): Rat => [Math.abs(r[0]), r[1]];
const NAME: Record<Fn, string> = { sin: "sine", cos: "cosine", tan: "tangent" };
const SPR_FRAC = "정답이 분수(또는 소수)로 쓰이는 하나의 수라 선택지 없이 낼 수 있다";
void SPR_FRAC;

const fig1 = (cx: UcCtx, p: UcRat, mask?: "x" | "y" | "both") => ({ type: "unit_circle" as const, points: [{ name: cx.p, angle: p.angle, label: ratLabel(p, mask) }], arcs: [{ to: 0, label: cx.a.ch }] });
const fig2 = (cx: UcCtx, p: UcRat, q: UcRat) => ({ type: "unit_circle" as const, points: [{ name: cx.p, angle: p.angle, label: ratLabel(p) }, { name: cx.q, angle: q.angle, label: ratLabel(q) }], arcs: [{ to: 0, label: cx.a.ch }, { to: 1, label: cx.b.ch }] });

const intro = (rng: Rng, cx: UcCtx, extra = "") => rng.pick(UC_LEADS) + rng.pick([
  `The unit circle is shown in the $xy$-plane. Point $${cx.p}$ lies on the circle, and $${cx.a.tex}$ is the angle in standard position whose terminal side passes through $${cx.p}$.${extra}`,
  `In the figure, point $${cx.p}$ is on the unit circle, and the terminal side of angle $${cx.a.tex}$ in standard position passes through $${cx.p}$.${extra}`,
  `The figure shows the unit circle and an angle $${cx.a.tex}$ in standard position. Its terminal side meets the circle at point $${cx.p}$.${extra}`,
  `Angle $${cx.a.tex}$ is drawn in standard position on the unit circle shown. The terminal side of $${cx.a.tex}$ passes through point $${cx.p}$ on the circle.${extra}`,
  `For the unit circle in the figure, the terminal side of angle $${cx.a.tex}$ (in standard position) passes through point $${cx.p}$.${extra}`,
  `Point $${cx.p}$ is marked on the unit circle in the figure. Angle $${cx.a.tex}$ is measured counterclockwise from the positive $x$-axis to the ray from the origin through $${cx.p}$.${extra}`,
  `The diagram shows a unit circle centered at the origin of the $xy$-plane. A ray from the origin passes through point $${cx.p}$ on the circle and forms angle $${cx.a.tex}$ with the positive $x$-axis.${extra}`,
  `On the unit circle shown, $${cx.p}$ is a point and $${cx.a.tex}$ is the angle, in standard position, that has $${cx.p}$ on its terminal side.${extra}`,
]);
const intro2 = (rng: Rng, cx: UcCtx) => rng.pick(UC_LEADS) + rng.pick([
  `The unit circle shown has points $${cx.p}$ and $${cx.q}$ on it. Angle $${cx.a.tex}$ and angle $${cx.b.tex}$ are in standard position, with terminal sides through $${cx.p}$ and $${cx.q}$, respectively.`,
  `In the figure, $${cx.p}$ and $${cx.q}$ are points on the unit circle. The terminal side of $${cx.a.tex}$ (in standard position) passes through $${cx.p}$, and the terminal side of $${cx.b.tex}$ passes through $${cx.q}$.`,
  `Two angles in standard position are shown on the unit circle: $${cx.a.tex}$ with terminal side through $${cx.p}$ and $${cx.b.tex}$ with terminal side through $${cx.q}$.`,
  `The diagram shows the unit circle with two marked points, $${cx.p}$ and $${cx.q}$. The ray from the origin through $${cx.p}$ forms angle $${cx.a.tex}$ with the positive $x$-axis, and the ray through $${cx.q}$ forms angle $${cx.b.tex}$.`,
  `Points $${cx.p}$ and $${cx.q}$ lie on the unit circle in the figure. Angles $${cx.a.tex}$ and $${cx.b.tex}$ are in standard position and have their terminal sides through $${cx.p}$ and $${cx.q}$, respectively.`,
]);
const read = (cx: UcCtx, p: UcRat): [string, string] => [`그림에서 점 ${cx.p} 의 좌표 라벨을 읽는다: ${ratLabel(p).replace("−", "-")}.`, "Read the labeled coordinates of the point."];
const askFn = (rng: Rng, cx: UcCtx, f: Fn) => rng.pick([`What is the value of $\\${f}${cx.a.tex}$?`, `What is $\\${f}${cx.a.tex}$?`, `What is the value of $\\${f}$ of angle $${cx.a.tex}$?`, `Find $\\${f}${cx.a.tex}$.`]);
const qWord = (p: UcRat) => ["", "I", "II", "III", "IV"][p.q];
const JS_COORD = "const P0=pt(0); const X=P0.x, Y=P0.y;\n";

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.trig_ratio.UC.P",
  hard: [
    {
      op: "chain2", structure: "한 좌표가 문자(a)로 가려진 단위원 위 점에서 x²+y²=1 로 빠진 좌표를 구하고 사분면의 부호를 적용해 탄젠트를 구함", extra: "빠진 좌표를 먼저 복원(부호는 그림의 사분면)한 뒤 y ÷ x 를 계산해야 함(부호를 놓치거나 역수를 취하는 함정) — medium 은 사인",
      concepts: ["단위원", "피타고라스 항등식", "탄젠트", "사분면 부호"],
      gen(rng) {
        const cx = ucCtx(rng); const p = makeRatPoint(rng); const mask = rng.pick(["x", "y"] as const); const t = fn3(p, "tan");
        return gInst(rng, {
          stimulus: intro(rng, cx), question: askFn(rng, cx, "tan"), correctText: ratTxt(t), range: [-1000, 1000],
          wrongTexts: [FW(abs(t), "sign_error", "사분면의 부호를 적용하지 않았다."), FW(inv(t), "formula_misuse", "탄젠트를 역수(x ÷ y)로 구했다."), FW(p.y, "formula_misuse", "사인 값을 답했다."), FW(p.x, "formula_misuse", "코사인 값을 답했다."), FW(neg(t), "sign_error", "부호를 반대로 정했다.")],
          verificationJs: figJs({}, fig1(cx, p, mask), `${UC_JS}${JS_COORD}return Y/X;`),
          trace: [[`그림에서 점 P 의 좌표 라벨 ${ratLabel(p, mask).replace("−", "-")} 을 읽는다. 한 좌표는 문자로 가려져 있다.`, "Read the labeled coordinates; one is a letter."], [`x² + y² = 1 이므로 가려진 좌표의 크기는 ${ratTxt(mask === "x" ? abs(p.x) : abs(p.y))} 이다.`, "Use x² + y² = 1."], [`P 는 ${qWord(p)}사분면에 있으므로 부호를 정하면 (x, y) = (${ratTxt(p.x)}, ${ratTxt(p.y)}) 이다.`, "The quadrant fixes the sign."], [`tan θ = y ÷ x = ${ratTxt(t)} 이다.`, "Tangent is y over x."], [`따라서 ${ratTxt(t)} 이다.`, "State the value."]], variant: "tan_missing_coordinate",
        }, fig1(cx, p, mask));
      },
    },
    {
      op: "compose_kind", structure: "단위원 위 점의 좌표에서 사인과 코사인을 각각 읽어 합을 구함", extra: "두 좌표의 부호를 지켜 더해야 함(크기만 더하거나 한 값만 답하는 함정) — medium 은 사인",
      concepts: ["단위원", "사인과 코사인", "분수의 합"],
      gen(rng) {
        const cx = ucCtx(rng); const p = makeRatPoint(rng); const s = addR(p.y, p.x);
        if (s[0] === 0 || s[0] === p.y[0] || s[0] === p.x[0]) throw new GenFail("합이 단순");
        return gInst(rng, {
          stimulus: intro(rng, cx), question: rng.pick([`What is the value of $\\sin${cx.a.tex} + \\cos${cx.a.tex}$?`, `What is $\\sin${cx.a.tex}$ plus $\\cos${cx.a.tex}$?`]), correctText: ratTxt(s), range: [-1000, 1000],
          wrongTexts: [FW(p.y, "step_missing", "사인만 답했다."), FW(p.x, "step_missing", "코사인만 답했다."), FW(addR(abs(p.y), abs(p.x)), "sign_error", "좌표의 크기만 더했다."), FW(subR(p.y, p.x), "sign_error", "합 대신 차를 구했다."), FW(mulR(p.y, p.x), "formula_misuse", "곱을 구했다.")],
          verificationJs: figJs({}, fig1(cx, p), `${UC_JS}${JS_COORD}return Y+X;`),
          trace: [read(cx, p), [`sin θ = y = ${ratTxt(p.y)}, cos θ = x = ${ratTxt(p.x)} 이다.`, "Sine is y; cosine is x."], [`합 = ${ratTxt(p.y)} + (${ratTxt(p.x)}) 이다.`, "Add with signs."], [`= ${ratTxt(s)} 이다.`, "Simplify."], [`따라서 ${ratTxt(s)} 이다.`, "State the value."]], variant: "sine_plus_cosine_unit_circle",
        }, fig1(cx, p));
      },
    },
    {
      op: "compare_scenarios", structure: "단위원 위의 두 점 P·Q 에서 같은 삼각비를 각각 읽어 차를 구함", extra: "두 점의 좌표를 따로 읽어 부호를 지켜 빼야 함(순서를 바꾸거나 합을 구하는 함정) — medium 은 한 점의 사인",
      concepts: ["단위원", "사인·코사인", "두 각 비교"],
      gen(rng) {
        const cx = ucCtx(rng); const p = makeRatPoint(rng), q = makeRatPoint(rng, { not: p }); const f = rng.pick(["sin", "cos"] as const); const a = fn3(p, f), b = fn3(q, f); const d = subR(a, b);
        if (d[0] === 0) throw new GenFail("차가 0");
        return gInst(rng, {
          stimulus: intro2(rng, cx), question: rng.pick([`What is the value of $\\${f}${cx.a.tex} - \\${f}${cx.b.tex}$?`, `What is $\\${f}${cx.a.tex}$ minus $\\${f}${cx.b.tex}$?`]), correctText: ratTxt(d), range: [-1000, 1000],
          wrongTexts: [FW(neg(d), "sign_error", "빼는 순서를 바꿨다."), FW(addR(a, b), "sign_error", "합을 구했다."), FW(a, "step_missing", "첫 값만 답했다."), FW(b, "step_missing", "둘째 값만 답했다."), FW(subR(fn3(p, f === "sin" ? "cos" : "sin"), fn3(q, f === "sin" ? "cos" : "sin")), "formula_misuse", "다른 삼각비의 차를 구했다.")],
          verificationJs: figJs({ f }, fig2(cx, p, q), `${UC_JS}const A=pt(0), B=pt(1); const g=(o)=>P.f==='sin'?o.y:o.x; return g(A)-g(B);`),
          trace: [[`그림에서 두 점의 좌표 라벨을 읽는다: P ${ratLabel(p).replace("−", "-")}, Q ${ratLabel(q).replace("−", "-")}.`, "Read both labeled points."], [`${f} θ = ${ratTxt(a)}, ${f} φ = ${ratTxt(b)} 이다.`, "Read the two values."], [`차 = ${ratTxt(a)} - (${ratTxt(b)}) 이다.`, "Subtract with signs."], [`= ${ratTxt(d)} 이다.`, "Simplify."], [`따라서 ${ratTxt(d)} 이다.`, "State the difference."]], variant: `${f}_difference_two_points`,
        }, fig2(cx, p, q));
      },
    },
    {
      op: "inverse", structure: "탄젠트 값이 주어지고 두 좌표가 모두 문자로 가려질 때 그림의 사분면으로 부호를 정해 코사인(또는 사인)을 구함", extra: "tan 값에서 크기(피타고라스 수)를 거꾸로 복원하고 부호는 그림의 사분면으로 정해야 함(부호를 놓치는 함정) — medium 은 좌표 하나가 가려진 점의 코사인",
      concepts: ["단위원", "탄젠트", "역산", "사분면 부호"],
      gen(rng) {
        const cx = ucCtx(rng); const p = makeRatPoint(rng); const t = fn3(p, "tan"); const f = rng.pick(["sin", "cos"] as const); const want = fn3(p, f);
        const tTex = `${t[0] < 0 ? "-" : ""}\\frac{${Math.abs(t[0])}}{${t[1]}}`;
        if (t[1] === 1) throw new GenFail("tan 정수");
        return gInst(rng, {
          stimulus: intro(rng, cx, ` It is known that $\\tan${cx.a.tex} = ${tTex}$.`), question: askFn(rng, cx, f), correctText: ratTxt(want), range: [-1000, 1000],
          wrongTexts: [FW(abs(want), "sign_error", "사분면의 부호를 적용하지 않았다."), FW(fn3(p, f === "sin" ? "cos" : "sin"), "formula_misuse", "다른 삼각비를 구했다."), FW(inv(want), "formula_misuse", "역수를 답했다."), FW(neg(want), "sign_error", "부호를 반대로 정했다."), FW(t, "step_missing", "tan 값을 그대로 답했다.")],
          verificationJs: figJs({ tn: t[0], td: t[1], f }, fig1(cx, p, "both"), `${UC_JS}const q=PT[0]; const a=RADN(q.angle); const sx=Math.cos(a)<0?-1:1, sy=Math.sin(a)<0?-1:1; const tv=P.tn/P.td; if (Math.sign(tv)!==sx*sy) throw new Error('tan 부호가 그림의 사분면과 다름'); const x=sx/Math.sqrt(1+tv*tv); const y=x*tv; return P.f==='sin'?y:x;`),
          trace: [[`그림에서 P 의 좌표는 문자이고 tan θ = ${ratTxt(t)} 이다.`, "The coordinates are letters; tan θ is given."], [`tan θ = y ÷ x 이므로 크기는 y : x = ${Math.abs(t[0])} : ${t[1]} 이고 x² + y² = 1 에서 (x, y) 의 크기는 ${ratTxt(abs(p.x))}, ${ratTxt(abs(p.y))} 이다.`, "Recover the magnitudes from tan and x² + y² = 1."], [`P 는 ${qWord(p)}사분면이므로 부호를 붙이면 (x, y) = (${ratTxt(p.x)}, ${ratTxt(p.y)}) 이다.`, "The quadrant fixes the signs."], [`${f} θ = ${f === "sin" ? "y" : "x"} = ${ratTxt(want)} 이다.`, "Read the requested ratio."], [`따라서 ${ratTxt(want)} 이다.`, "State the value."]], variant: `${f}_from_tangent_unit_circle`,
        }, fig1(cx, p, "both"));
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "sine", structure: "좌표가 모두 주어진 단위원 위 점에서 사인(y)을 읽음", extra: "easy: 사인 = y 좌표", concepts: ["단위원", "사인"],
      gen(rng) {
        const cx = ucCtx(rng); const p = makeRatPoint(rng); const f = rng.pick(["sin", "cos"] as const); const v = fn3(p, f);
        return gInst(rng, {
          stimulus: intro(rng, cx), question: askFn(rng, cx, f), correctText: ratTxt(v), range: [-1000, 1000],
          wrongTexts: [FW(fn3(p, f === "sin" ? "cos" : "sin"), "formula_misuse", f === "sin" ? "코사인 값을 답했다." : "사인 값을 답했다."), FW(fn3(p, "tan"), "formula_misuse", "탄젠트를 구했다."), FW(abs(v), "sign_error", "부호를 놓쳤다."), FW(inv(v), "formula_misuse", "역수를 답했다.")],
          verificationJs: figJs({ f }, fig1(cx, p), `${UC_JS}${JS_COORD}return P.f==='sin'?Y:X;`),
          trace: [read(cx, p), [`${NAME[f]} = ${f === "sin" ? "y" : "x"} 좌표이다.`, "On the unit circle sine is y and cosine is x."], [`따라서 ${ratTxt(v)} 이다.`, "State the value."]], variant: `${f}_from_coordinates`,
        }, fig1(cx, p));
      },
    },
    {
      lv: "medium", name: "sine_missing", structure: "한 좌표가 문자로 가려진 점에서 x²+y²=1 로 빠진 좌표를 복원해 사인 또는 코사인을 구함", extra: "medium: 빠진 좌표 복원 + 부호", concepts: ["단위원", "피타고라스 항등식", "사분면 부호"],
      gen(rng) {
        const cx = ucCtx(rng); const p = makeRatPoint(rng); const f = rng.pick(["sin", "cos"] as const); const v = fn3(p, f); const mask = f === "sin" ? "y" : "x";
        return gInst(rng, {
          stimulus: intro(rng, cx), question: askFn(rng, cx, f), correctText: ratTxt(v), range: [-1000, 1000],
          wrongTexts: [FW(abs(v), "sign_error", "사분면의 부호를 적용하지 않았다."), FW(fn3(p, f === "sin" ? "cos" : "sin"), "formula_misuse", f === "sin" ? "보이는 좌표(코사인)를 답했다." : "보이는 좌표(사인)를 답했다."), FW(neg(v), "sign_error", "부호를 반대로 정했다."), FW(inv(v), "formula_misuse", "역수를 답했다.")],
          verificationJs: figJs({ f }, fig1(cx, p, mask), `${UC_JS}${JS_COORD}return P.f==='sin'?Y:X;`),
          trace: [[`그림에서 P 의 좌표 라벨 ${ratLabel(p, mask).replace("−", "-")} 을 읽는다.`, "Read the labeled coordinates."], [`x² + y² = 1 에서 가려진 좌표의 크기는 ${ratTxt(abs(f === "sin" ? p.y : p.x))} 이다.`, "Use x² + y² = 1."], [`P 는 ${qWord(p)}사분면이므로 ${f} θ = ${ratTxt(v)} 이다.`, "Apply the quadrant sign."]], variant: `${f}_missing_coordinate`,
        }, fig1(cx, p, mask));
      },
    },
  ],
});
