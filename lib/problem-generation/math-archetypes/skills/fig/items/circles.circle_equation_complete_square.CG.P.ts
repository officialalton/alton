// circles.circle_equation_complete_square.CG.P — 좌표평면에 그려진 원을 전개형 x² + y² + Dx + Ey + F = 0 으로 쓸 때의 계수 D, E, F 를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, CIRC_JS, circFig, cgIntro, type P2 } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const CJ = `${CG_JS}${CIRC_JS}`;
const EQ = "$x^2 + y^2 + Dx + Ey + F = 0$";
const SC = ["The figure shows a circle graphed on a coordinate grid.", "A circle is plotted in the coordinate plane shown.", "In the figure shown, a circle is drawn on the grid.", "The coordinate grid shown contains a circle.", "The graph in the figure is a circle."];
const EXT = [` The circle can be described by the equation ${EQ}, where $D$, $E$, and $F$ are constants.`, ` An equation of the circle is ${EQ}, with constants $D$, $E$, and $F$.`, ` The circle's equation can be written as ${EQ} for some constants $D$, $E$, and $F$.`, ` For constants $D$, $E$, and $F$, the circle satisfies ${EQ}.`];
/** 중심이 3사분면(D·E 가 양수), F = h²+k²−r² > 0. */
function scene(rng: Rng) { const h = -rng.int(2, 7), k = -rng.int(2, 7), r = rng.int(2, 4); const F = h * h + k * k - r * r; if (F <= 0 || h === k) throw new GenFail("범위"); return { h, k, r, D: -2 * h, E: -2 * k, F, C: [h, k] as P2 }; }

export const ITEM = defineItem({
  prefix: "av", itemId: "circles.circle_equation_complete_square.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "원의 중심을 그림에서 읽어 (x − h)² + (y − k)² = r² 을 전개했을 때 x 의 계수 D = −2h 를 구함", extra: "중심의 x 좌표에 −2 를 곱해야 함(h 를 그대로 답하거나 −h 를 쓰면 오답) — medium 은 반지름",
      concepts: ["원의 방정식", "식의 전개", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = circFig(s.C, s.r);
        return geoInst(rng, {
          stimulus: cgIntro(rng, SC, rng.pick(EXT)), question: rng.pick(["What is the value of $D$?", "Find the value of $D$.", "In the equation, what is the constant $D$?"]), correct: s.D,
          wrongs: pos([W(-s.h, "formula_misuse", "−h 를 답했다."), W(-s.h * 2 + 2, "other", "계산 중 어긋났다."), W(-s.k * 2, "step_missing", "E 를 답했다."), W(-s.h, "formula_misuse", "2 를 곱하지 않았다."), W(s.h * s.h, "formula_misuse", "제곱했다.")]).filter((x) => x.v !== s.D),
          verificationJs: figJs({}, f, `${CJ}const C=cen(); return ip(-2*C[0]);`),
          trace: [[`그림에서 중심 (${s.h}, ${s.k}), 반지름 ${s.r} 을 읽는다.`, "Read the center and the radius."], [`표준형: (x − (${s.h}))² + (y − (${s.k}))² = ${s.r * s.r} 이다.`, "Standard form."], [`(x + ${-s.h})² 를 전개하면 x² + ${2 * -s.h}x + ${s.h * s.h} 이다.`, "Expand the x-part."], [`x 의 계수는 −2h 이다.`, "The coefficient of x."], [`따라서 D = ${s.D} 이다.`, "State D."]], variant: "circle_expand_D",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "원의 중심을 읽어 전개형의 두 계수 D 와 E 를 각각 구한 뒤 D + E 를 구함", extra: "각 계수를 −2h, −2k 로 구해 더해야 함(h + k 의 −2 배가 아닌 중심의 합을 답하거나 한 계수만 답하면 오답) — medium 은 D",
      concepts: ["원의 방정식", "식의 전개", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = circFig(s.C, s.r); const v = s.D + s.E;
        return geoInst(rng, {
          stimulus: cgIntro(rng, SC, rng.pick(EXT)), question: rng.pick(["What is the value of $D + E$?", "Find the sum $D + E$.", "In the equation, what is $D + E$?"]), correct: v,
          wrongs: pos([W(-s.h - s.k, "formula_misuse", "2 를 곱하지 않았다."), W(s.D, "step_missing", "D 만 답했다."), W(s.E, "step_missing", "E 만 답했다."), W(Math.abs(s.D - s.E) || v + 1, "formula_misuse", "차를 구했다."), W(v + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== v),
          verificationJs: figJs({}, f, `${CJ}const C=cen(); return ip(-2*C[0]-2*C[1]);`),
          trace: [[`그림에서 중심 (${s.h}, ${s.k}), 반지름 ${s.r} 을 읽는다.`, "Read the center and the radius."], [`D = −2h = ${s.D} 이다.`, "The coefficient D."], [`E = −2k = ${s.E} 이다.`, "The coefficient E."], [`D + E = ${s.D} + ${s.E} 이다.`, "Add."], [`따라서 ${v} 이다.`, "State the sum."]], variant: "circle_expand_D_plus_E",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "원의 중심과 반지름을 읽어 표준형을 전개했을 때 상수항 F = h² + k² − r² 을 구함", extra: "중심 좌표의 제곱의 합에서 r² 을 빼야 함(r² 만 답하거나 h² + k² + r² 으로 더하면 오답) — medium 은 반지름",
      concepts: ["원의 방정식", "식의 전개", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = circFig(s.C, s.r);
        return geoInst(rng, {
          stimulus: cgIntro(rng, SC, rng.pick(EXT)), question: rng.pick(["What is the value of $F$?", "Find the value of $F$.", "In the equation, what is the constant $F$?"]), correct: s.F,
          wrongs: pos([W(s.r * s.r, "step_missing", "r² 만 답했다."), W(s.h * s.h + s.k * s.k + s.r * s.r, "formula_misuse", "r² 을 더했다."), W(s.h * s.h + s.k * s.k, "step_missing", "r² 을 빼지 않았다."), W(s.F + 2, "other", "계산 중 어긋났다."), W(Math.abs(s.h + s.k) ** 2 - s.r * s.r || s.F + 1, "formula_misuse", "합을 제곱했다.")]).filter((x) => x.v !== s.F),
          verificationJs: figJs({}, f, `${CJ}const C=cen(); const r=rad(); return ip(C[0]*C[0]+C[1]*C[1]-r*r);`),
          trace: [[`그림에서 중심 (${s.h}, ${s.k}), 반지름 ${s.r} 을 읽는다.`, "Read the center and the radius."], [`표준형: (x + ${-s.h})² + (y + ${-s.k})² = ${s.r * s.r} 이다.`, "Standard form."], [`전개하면 x² + y² + ${s.D}x + ${s.E}y + ${s.h * s.h} + ${s.k * s.k} = ${s.r * s.r} 이다.`, "Expand."], [`상수항을 한쪽으로 모으면 F = ${s.h * s.h} + ${s.k * s.k} − ${s.r * s.r} 이다.`, "Collect the constant."], [`따라서 ${s.F} 이다.`, "State F."]], variant: "circle_expand_F",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "지문의 전개형에서 D 와 E 로 중심을 거꾸로 구하고 그림의 반지름으로 상수항 F = (D/2)² + (E/2)² − r² 을 구함", extra: "D, E 의 절반을 제곱해 더하고 그림에서 읽은 반지름의 제곱을 빼야 함(D, E 를 절반 하지 않으면 오답) — medium 은 D",
      concepts: ["원의 방정식", "완전제곱식", "역산"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = circFig(s.C, s.r);
        return geoInst(rng, {
          stimulus: cgIntro(rng, SC, ` The circle can be described by the equation $x^2 + y^2 + ${s.D}x + ${s.E}y + F = 0$, where $F$ is a constant.`), question: rng.pick(["What is the value of $F$?", "Find the value of $F$.", "In the equation, what is the constant $F$?"]), correct: s.F,
          wrongs: pos([W(s.D * s.D + s.E * s.E - s.r * s.r, "formula_misuse", "D, E 를 절반 하지 않고 제곱했다."), W(s.h * s.h + s.k * s.k, "step_missing", "r² 을 빼지 않았다."), W(s.r * s.r, "step_missing", "r² 만 답했다."), W(s.F + 2, "other", "계산 중 어긋났다."), W((s.D + s.E) ** 2 / 4 - s.r * s.r || s.F + 1, "formula_misuse", "합을 제곱했다.")]).filter((x) => x.v !== s.F),
          verificationJs: figJs({ D: s.D, E: s.E }, f, `${CJ}const C=cen(); if (Math.abs(C[0]+P.D/2)>1e-9||Math.abs(C[1]+P.E/2)>1e-9) throw new Error('중심이 식과 다름'); const r=rad(); return ip(P.D*P.D/4+P.E*P.E/4-r*r);`),
          trace: [[`그림에서 반지름 ${s.r} 을 읽는다.`, "Read the radius."], [`중심의 좌표는 −D/2 = ${s.h}, −E/2 = ${s.k} 이다.`, "The center from D and E."], [`F = (D/2)² + (E/2)² − r² 이다.`, "The constant term."], [`F = ${s.h * s.h} + ${s.k * s.k} − ${s.r * s.r} 이다.`, "Substitute."], [`따라서 ${s.F} 이다.`, "State F."]], variant: "circle_complete_square_F",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "radius", structure: "그림에 그려진 원의 반지름을 격자에서 읽음", extra: "easy: 반지름 읽기", concepts: ["원의 방정식", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = circFig(s.C, s.r);
        return geoInst(rng, { stimulus: cgIntro(rng, SC), question: rng.pick(["What is the radius of the circle?", "How long is the radius of the circle shown?"]), correct: s.r, wrongs: pos([W(2 * s.r, "formula_misuse", "지름을 답했다."), W(s.r * s.r, "formula_misuse", "제곱했다."), W(s.r + 1, "other", "눈금을 잘못 셌다.")]).filter((x) => x.v !== s.r), verificationJs: figJs({}, f, `${CJ}return ip(rad());`), trace: [[`그림에서 중심에서 원까지 격자를 센다.`, "Count grid squares from the center."], [`반지름 = ${s.r} 이다.`, "Read the radius."]], variant: "circle_radius_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "coefficient_D", structure: "원의 중심에서 전개형의 계수 D 를 구함", extra: "medium: −2h", concepts: ["원의 방정식", "식의 전개"],
      gen(rng) { return retry(rng, () => {
        const s = scene(rng); const f = circFig(s.C, s.r);
        return geoInst(rng, { stimulus: cgIntro(rng, SC, rng.pick(EXT)), question: rng.pick(["What is the value of $D$?", "Find the value of $D$."]), correct: s.D, wrongs: pos([W(-s.h, "formula_misuse", "2 를 곱하지 않았다."), W(s.h * s.h, "formula_misuse", "제곱했다."), W(s.D + 2, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== s.D), verificationJs: figJs({}, f, `${CJ}const C=cen(); return ip(-2*C[0]);`), trace: [[`그림에서 중심 (${s.h}, ${s.k}) 를 읽는다.`, "Read the center."], [`D = −2h 이다.`, "The coefficient formula."], [`따라서 ${s.D} 이다.`, "State D."]], variant: "circle_expand_D_medium" }, f);
      }); },
    },
  ],
});
