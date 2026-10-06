// right_triangles_trigonometry.trig_application_elevation.TR.P — 사다리·관측·경사로 상황의 직각삼각형 그림(고도각 θ)에서 삼각비와 변의 길이를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { frac } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { RT_JS, makeRight, rtRead, type RTri } from "../tri-kit";

const FW = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
type Ctx = { name: string; intro: (t: RTri) => string; base: string; up: string; slant: string; unit: string };
const CTX: Ctx[] = [
  { name: "ladder", intro: (t) => `A ladder leans against a vertical wall, as shown in the figure. The ladder makes an angle $\\theta$ with the level ground at $${t.v[1]}$, and the wall meets the ground at a right angle at $${t.v[0]}$.`, base: "distance from the wall to the foot of the ladder", up: "height at which the ladder touches the wall", slant: "length of the ladder", unit: "feet" },
  { name: "ramp", intro: (t) => `A wheelchair ramp is shown in the figure. The ramp rises from the ground at $${t.v[1]}$ to a platform at $${t.v[2]}$ and makes an angle $\\theta$ with the ground; the right angle is at $${t.v[0]}$.`, base: "horizontal length of the ramp", up: "height of the platform", slant: "length of the ramp surface", unit: "feet" },
  { name: "kite", intro: (t) => `A kite string is held taut, as shown in the figure. The string makes an angle $\\theta$ with the level ground at $${t.v[1]}$, and the kite is directly above $${t.v[0]}$, where the right angle is.`, base: "horizontal distance from the holder to the point below the kite", up: "height of the kite", slant: "length of the string", unit: "meters" },
  { name: "tower", intro: (t) => `A surveyor looks up at the top of a tower, as shown in the figure. The angle of elevation at $${t.v[1]}$ is $\\theta$, and the tower stands at a right angle to the ground at $${t.v[0]}$.`, base: "horizontal distance from the surveyor to the tower", up: "height of the tower", slant: "distance along the line of sight", unit: "meters" },
  { name: "zip line", intro: (t) => `A zip line cable runs from a platform down to the ground, as shown in the figure. The cable makes an angle $\\theta$ with the ground at $${t.v[1]}$, and the support pole stands at a right angle to the ground at $${t.v[0]}$.`, base: "horizontal distance from the pole to the cable's lower end", up: "height of the platform", slant: "length of the cable", unit: "meters" },
  { name: "slide", intro: (t) => `A playground slide is shown in the figure. The slide makes an angle $\\theta$ with the ground at $${t.v[1]}$ and reaches a platform directly above $${t.v[0]}$, where the right angle is.`, base: "horizontal length covered by the slide", up: "height of the slide's top", slant: "length of the slide", unit: "feet" },
  { name: "roof", intro: (t) => `A support beam of a roof is shown in the figure. The beam makes an angle $\\theta$ with the horizontal ceiling at $${t.v[1]}$, and the vertical post meets the ceiling at a right angle at $${t.v[0]}$.`, base: "horizontal span of the beam", up: "height of the post", slant: "length of the beam", unit: "feet" },
  { name: "drone", intro: (t) => `A drone flies in a straight line up from point $${t.v[1]}$ to a point directly above $${t.v[0]}$, where the ground makes a right angle, as the figure shows. The flight path makes an angle $\\theta$ with the ground at $${t.v[1]}$.`, base: "horizontal distance covered", up: "altitude reached", slant: "length of the flight path", unit: "meters" },
  { name: "escalator", intro: (t) => `An escalator carries people from the lower floor at $${t.v[1]}$ to the upper floor, as shown in the figure. It makes an angle $\\theta$ with the floor at $${t.v[1]}$, and the vertical wall meets the floor at a right angle at $${t.v[0]}$.`, base: "horizontal length of the escalator", up: "height between the floors", slant: "length of the escalator", unit: "meters" },
  { name: "cable", intro: (t) => `A guy wire holds up a vertical pole, as shown in the figure. The wire makes an angle $\\theta$ with the ground at $${t.v[1]}$, and the pole meets the ground at a right angle at $${t.v[0]}$.`, base: "distance from the pole to the wire's anchor point", up: "height where the wire meets the pole", slant: "length of the wire", unit: "feet" },
];
const withTheta = (t: RTri) => ({ ...t.fig, angles: [{ at: t.v[1], label: "θ", value: Math.round(Math.atan2(t.legs[1], t.legs[0]) * 1800 / Math.PI) / 10 }] });

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.trig_application_elevation.TR.P",
  hard: [
    {
      op: "chain2", structure: "수평 거리·높이 라벨로 빗변(x)을 구한 뒤 고도각 θ 의 사인을 구함", extra: "빗변(경사 길이)을 먼저 구해야 사인(높이 ÷ 빗변)이 계산됨 — medium 은 탄젠트",
      concepts: ["고도각", "피타고라스 정리", "사인"],
      gen(rng) {
        const c = rng.pick(CTX); const t = makeRight(rng, { unknown: "hyp", angleMin: 26 }); const fig = withTheta(t); const [n, d] = [t.legs[1], t.hyp];
        return gInst(rng, {
          stimulus: `${c.intro(t)} The lengths are in ${c.unit}.`, question: rng.pick([`What is the value of $\\sin \\theta$?`, `In the figure shown, what is $\\sin\\theta$?`, `Considering the ${c.name} in the figure, what is $\\sin\\theta$?`, `For the ${c.name} shown, the ${c.slant} is the hypotenuse. What is $\\sin\\theta$?`, `Using the ${c.up} and the ${c.slant}, find $\\sin\\theta$ for the ${c.name}.`]), correctText: frac(n, d), range: [0, 100],
          wrongTexts: [FW(t.legs[1], t.legs[0], "formula_misuse", "탄젠트를 구했다."), FW(t.legs[0], t.hyp, "opposite", "코사인을 구했다."), FW(d, n, "formula_misuse", "비를 뒤집었다."), FW(t.legs[0], t.legs[1], "formula_misuse", "인접변 ÷ 대변을 구했다.")],
          verificationJs: figJs({}, fig, `${RT_JS}return H/C;`),
          trace: [rtRead(t), [`${c.slant}: x = √(${t.legs[0]}² + ${t.legs[1]}²) = ${t.hyp} 이다.`, "Find the slant length first."], [`θ 의 대변은 ${c.up} = ${t.legs[1]} 이다.`, "The side opposite θ."], [`sin θ = ${t.legs[1]}/${t.hyp} = ${frac(n, d)} 이다.`, "Opposite over hypotenuse."], [`따라서 ${frac(n, d)} 이다.`, "State the value."]], variant: "sine_of_elevation_angle",
        }, fig);
      },
    },
    {
      op: "compose_kind", structure: "고도각 θ 의 사인과 탄젠트를 각각 구해 합을 구함", extra: "두 삼각비를 같은 그림에서 따로 구해 분수로 더해야 함 — medium 은 사인",
      concepts: ["고도각", "사인과 탄젠트", "분수의 합"],
      gen(rng) {
        const c = rng.pick(CTX); const t = makeRight(rng, { unknown: "none", angleMin: 26 }); const fig = withTheta(t); const [B, H] = t.legs; const sumN = H * B + H * t.hyp, sumD = t.hyp * B;
        return gInst(rng, {
          stimulus: `${c.intro(t)} The lengths are in ${c.unit}.`, question: rng.pick([`What is the value of $\\sin\\theta + \\tan\\theta$?`, `In the figure shown, what is $\\sin\\theta$ plus $\\tan\\theta$?`, `For the ${c.name} in the figure, what is the sum of $\\sin\\theta$ and $\\tan\\theta$?`, `Add $\\sin\\theta$ and $\\tan\\theta$ for the ${c.name} shown. What is the result?`, `Based on the ${c.up} and the ${c.base}, what is $\\sin\\theta + \\tan\\theta$?`]), correctText: frac(sumN, sumD), range: [0, 100],
          wrongTexts: [FW(H, t.hyp, "step_missing", "사인만 답했다."), FW(H, B, "step_missing", "탄젠트만 답했다."), FW(H + H, t.hyp + B, "formula_misuse", "분자·분모를 각각 더했다."), FW(H * H, t.hyp * B, "formula_misuse", "곱했다.")],
          verificationJs: figJs({}, fig, `${RT_JS}return H/C+H/B;`),
          trace: [rtRead(t), [`sin θ = ${H}/${t.hyp}, tan θ = ${H}/${B} 이다.`, "Two ratios of the angle θ."], [`합 = ${H}/${t.hyp} + ${H}/${B} 이다.`, "Add the fractions."], [`= ${frac(sumN, sumD)} 이다.`, "Simplify."], [`따라서 ${frac(sumN, sumD)} 이다.`, "State the sum."]], variant: "sine_plus_tangent_of_elevation",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "tan θ 가 주어지고 수평 거리 라벨이 있을 때 높이(x)를 역산", extra: "높이 = 수평 거리 × tan θ 로 거꾸로 구해야 함(나누는 함정) — medium 은 탄젠트",
      concepts: ["고도각", "탄젠트", "역산"],
      gen(rng) {
        const c = rng.pick(CTX); const t = makeRight(rng, { unknown: "height", angleMin: 26 }); const fig = withTheta(t); const [B, H] = t.legs; const g = (a: number, b: number): number => (b ? g(b, a % b) : a); const gg = g(H, B); const tn = `${H / gg}/${B / gg}`;
        return gInst(rng, {
          stimulus: `${c.intro(t)} The lengths are in ${c.unit}, and $\\tan\\theta = ${tn}$.`, question: rng.pick([`What is the ${c.up}, in ${c.unit}?`, `What is the value of $x$, in ${c.unit}?`, `For the ${c.name}, how many ${c.unit} is the ${c.up}?`, `Find the ${c.up} of the ${c.name} shown, in ${c.unit}.`, `Using $\\tan\\theta$ and the ${c.base}, what is the ${c.up}, in ${c.unit}?`]), correct: H,
          wrongs: pos([W((B * B) / H, "formula_misuse", "탄젠트로 나눴다."), W(t.hyp, "step_missing", "빗변을 답했다."), W(B * (H / gg + B / gg), "formula_misuse", "분자·분모를 더했다."), W(H + 1, "other", "계산 중 어긋났다."), W(B, "step_missing", "수평 거리를 답했다.")]).filter((w) => w.v !== H && Number.isFinite(w.v)),
          verificationJs: figJs({ p: H / gg, q: B / gg }, fig, `const sd=FIGURE.sides; const bl=Number(sd[0].label); if (!(bl>0)) throw new Error('수평 거리 필요'); if (String(sd[1].label)!=='x') throw new Error('높이 x 필요'); return bl*P.p/P.q;`),
          trace: [[`수평 거리 ${c.base} = ${B} ${c.unit} 이다.`, "Read the horizontal distance."], [`tan θ = 높이 ÷ 수평 거리 이므로 높이 = ${B} × ${tn} 이다.`, "Height = base × tan θ."], [`= ${H} 이다.`, "Compute."], [`확인: ${H}/${B} = ${tn} 이다.`, "Check the ratio."], [`따라서 ${H} 이다.`, "State the height."]], variant: "height_from_tangent",
        }, fig);
      },
    },
    {
      op: "unit_ratio", structure: "수평 거리·높이가 미터로 라벨된 그림에서 경사 길이(빗변)를 센티미터로 구함(1 m = 100 cm)", extra: "빗변(m)을 구한 뒤 단위를 환산해야 함 — medium 은 빗변",
      concepts: ["고도각", "피타고라스 정리", "단위 환산"],
      gen(rng) {
        const c = rng.pick(CTX); const t = makeRight(rng, { unknown: "hyp", maxSide: 30, angleMin: 26 }); const fig = withTheta(t); const correct = t.hyp * 100;
        return gInst(rng, {
          stimulus: `${c.intro(t)} ${rng.pick(["The lengths in the figure are in meters.", "All lengths shown in the figure are measured in meters.", "Each length in the figure is given in meters."])}`, question: rng.pick([`What is the ${c.slant}, in centimeters? (1 meter = 100 centimeters)`, `How many centimeters long is the ${c.slant}? (1 meter = 100 centimeters)`, `Express the ${c.slant} of the ${c.name} in centimeters. (1 meter = 100 centimeters)`, `The ${c.slant} is how many centimeters? (1 meter = 100 centimeters)`, `Convert the ${c.slant} to centimeters, given that 1 meter = 100 centimeters.`]), correct,
          wrongs: pos([W(t.hyp, "unit_error", "미터로 답했다."), W((t.legs[0] + t.legs[1]) * 100, "formula_misuse", "직각변의 합을 환산했다."), W(Math.round(t.hyp * 10), "unit_error", "1 m 를 10 cm 로 보았다."), W(correct + 100, "other", "한 미터 어긋났다."), W(t.hyp / 100, "unit_error", "나누어 환산했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, fig, `${RT_JS}return C*100;`),
          trace: [rtRead(t), [`x = √(${t.legs[0]}² + ${t.legs[1]}²) = ${t.hyp} m 이다.`, "The slant length in meters."], [`${t.hyp} × 100 = ${correct} cm 이다.`, "Convert to centimeters."], [`1 m = 100 cm 이다.`, "Conversion factor."], [`따라서 ${correct} 이다.`, "State the length."]], variant: "slant_length_in_centimeters",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "tangent_theta", structure: "수평 거리와 높이가 모두 라벨된 그림에서 tan θ 를 구함", extra: "easy: 높이 ÷ 수평 거리", concepts: ["고도각", "탄젠트"],
      gen(rng) {
        const c = rng.pick(CTX); const t = makeRight(rng, { unknown: "none", angleMin: 26 }); const fig = withTheta(t); const [B, H] = t.legs;
        return gInst(rng, { stimulus: `${c.intro(t)} The lengths are in ${c.unit}.`, question: rng.pick([`What is the value of $\\tan\\theta$?`, `In the figure shown, what is $\\tan\\theta$?`, `For the ${c.name} shown, what is $\\tan\\theta$?`, `What is $\\tan\\theta$ if the ${c.up} is divided by the ${c.base}?`]), correctText: frac(H, B), range: [0, 100], wrongTexts: [FW(B, H, "formula_misuse", "비를 뒤집었다."), FW(H, t.hyp, "formula_misuse", "사인을 구했다."), FW(B, t.hyp, "formula_misuse", "코사인을 구했다."), FW(H, B + 1, "other", "계산 중 어긋났다.")], verificationJs: figJs({}, fig, `${RT_JS}return H/B;`), trace: [rtRead(t), [`tan θ = 높이 ÷ 수평 거리 = ${H}/${B} = ${frac(H, B)} 이다.`, "Opposite over adjacent."]], variant: "tangent_of_elevation_angle",
        }, fig);
      },
    },
    {
      lv: "medium", name: "slant_length", structure: "수평 거리와 높이로 경사 길이(빗변)를 구함", extra: "medium: 피타고라스 정리", concepts: ["고도각", "피타고라스 정리"],
      gen(rng) {
        const c = rng.pick(CTX); const t = makeRight(rng, { unknown: "hyp", angleMin: 26 }); const fig = withTheta(t);
        return gInst(rng, { stimulus: `${c.intro(t)} ${rng.pick([`The lengths are in ${c.unit}.`, `All lengths shown are measured in ${c.unit}.`, `Each length in the figure is given in ${c.unit}.`])}`, question: rng.pick([`What is the ${c.slant}, in ${c.unit}?`, `What is the value of $x$, in ${c.unit}?`, `How long is the ${c.slant}, in ${c.unit}?`, `Find the ${c.slant} of the ${c.name} shown, in ${c.unit}.`, `For the ${c.name}, how many ${c.unit} is the ${c.slant}?`]), correct: t.hyp, wrongs: pos([W(t.legs[0] + t.legs[1], "formula_misuse", "직각변의 합을 답했다."), W(Math.abs(t.legs[1] - t.legs[0]), "formula_misuse", "직각변의 차를 답했다."), W(t.hyp + 1, "other", "계산 중 어긋났다."), W(t.legs[0] * t.legs[0] + t.legs[1] * t.legs[1], "step_missing", "제곱근을 취하지 않았다.")]).filter((w) => w.v !== t.hyp), verificationJs: figJs({}, fig, `${RT_JS}return C;`), trace: [rtRead(t), [`x² = ${t.legs[0]}² + ${t.legs[1]}² = ${t.hyp * t.hyp} 이다.`, "Pythagorean theorem."], [`x = ${t.hyp} 이다.`, "Take the square root."]], variant: "slant_length_pythagorean",
        }, fig);
      },
    },
  ],
});
void GenFail; void ({} as Rng);
