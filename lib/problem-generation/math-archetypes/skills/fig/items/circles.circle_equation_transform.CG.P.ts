// circles.circle_equation_transform.CG.P — 좌표평면의 원을 평행이동·확대·대칭이동한 상의 원의 방정식의 값(중심·r²)을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, CIRC_JS, circFig, circScene, cgIntro, names, un } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const CJ = `${CG_JS}${CIRC_JS}`;
const EQ = "$(x - h)^2 + (y - k)^2 = r^2$";
const sc = (c: string, p: string) => [`The figure shows a circle with center ${c} on a coordinate grid; point ${p} lies on the circle.`, `A circle is graphed in the coordinate plane shown. Its center is ${c}, and ${p} is a point on the circle.`, `In the figure shown, ${c} is the center of a circle and ${p} is a point on that circle.`, `The coordinate grid shown contains a circle with center ${c} that passes through ${p}.`];
const IMG = ` The image of the circle has the equation ${EQ}.`;
const mk = (rng: Parameters<typeof circScene>[0], lo = 1, hi = 6) => circScene(rng, { hLo: lo, hHi: hi, kLo: lo, kHi: hi });

export const ITEM = defineItem({
  prefix: "av", itemId: "circles.circle_equation_transform.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "원의 중심을 그림에서 읽어 지문의 평행이동으로 옮긴 상의 원의 표준형에서 h + k 를 구함", extra: "중심의 두 좌표에 각각 이동량을 더한 뒤 합해야 함(한쪽 이동량만 더하거나 원래 중심의 합을 답하면 오답) — medium 은 한 좌표",
      concepts: ["원의 방정식", "평행이동", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = mk(rng); const dx = rng.int(1, 5), dy = rng.int(1, 5); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p }); const v = s.h + dx + s.k + dy;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(c, p), ` The circle is translated ${un(dx)} to the right and ${un(dy)} up.${IMG}`), question: rng.pick(["What is the value of $h + k$?", "Find the value of $h + k$ for the image circle.", "For the image circle, what is $h + k$?"]), correct: v,
          wrongs: pos([W(s.h + s.k, "step_missing", "이동하기 전 중심의 합을 답했다."), W(v - dy, "step_missing", "위로의 이동을 빠뜨렸다."), W(v - dx, "step_missing", "오른쪽 이동을 빠뜨렸다."), W(s.h + s.k - dx - dy, "formula_misuse", "반대로 이동했다."), W(dx + dy, "step_missing", "이동량의 합을 답했다.")]).filter((x) => x.v !== v),
          verificationJs: figJs({ c, dx, dy }, f, `${CJ}const C=PA(P.c); return ip(C[0]+P.dx+C[1]+P.dy);`),
          trace: [[`그림에서 중심 ${c} = (${s.h}, ${s.k}) 를 읽는다.`, "Read the center."], [`x 방향으로 ${dx}, y 방향으로 ${dy} 이동한다.`, "The translation."], [`상의 중심 = (${s.h + dx}, ${s.k + dy}) 이다.`, "The image center."], [`h = ${s.h + dx}, k = ${s.k + dy} 이다.`, "h and k."], [`따라서 ${v} 이다.`, "State h + k."]], variant: "circle_translate_center_sum",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "원의 중심과 원 위의 점으로 반지름을 구한 뒤 원점 중심의 확대 배율을 곱한 상의 반지름의 제곱 r² 을 구함", extra: "반지름을 구해 배율을 곱한 뒤 제곱해야 함(r² 에 배율만 곱하거나 반지름을 그대로 답하면 오답) — medium 은 반지름",
      concepts: ["원의 방정식", "닮음변환", "두 점 사이의 거리"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = mk(rng); const k2 = rng.pick([2, 3]); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p }); const v = (k2 * s.r) ** 2; if (v >= 1000) throw new GenFail("큼");
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(c, p), ` The circle is dilated by a scale factor of ${k2} with the origin as the center of dilation.${IMG}`), question: rng.pick(["What is the value of $r^2$ for the image circle?", "Find $r^2$ in the equation of the image.", "In the equation of the image circle, what is $r^2$?"]), correct: v,
          wrongs: pos([W(s.r * s.r, "step_missing", "원래 r² 을 답했다."), W(k2 * s.r * s.r, "formula_misuse", "r² 에 배율만 곱했다."), W(k2 * s.r, "step_missing", "제곱하지 않았다."), W(s.r * s.r + k2, "formula_misuse", "배율을 더했다."), W(v + s.r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== v),
          verificationJs: figJs({ c, p, k: k2 }, f, `${CJ}const C=PA(P.c), Q=PA(P.p); const r=dist(C,Q); if (Math.abs(r-CI.radius)>1e-9) throw new Error('원 위의 점 아님'); return ip((r*P.k)*(r*P.k));`),
          trace: [[`그림에서 ${c} = (${s.h}, ${s.k}), ${p} = (${s.P[0]}, ${s.P[1]}) 를 읽는다.`, "Read the center and the point."], [`원래 반지름 = √(${s.dx}² + ${s.dy}²) = ${s.r} 이다.`, "The original radius."], [`확대 배율은 ${k2} 이므로 상의 반지름 = ${k2} × ${s.r} = ${k2 * s.r} 이다.`, "The image radius."], [`r² = ${k2 * s.r}² 이다.`, "Square it."], [`따라서 ${v} 이다.`, "State r squared."]], variant: "circle_dilate_r_squared",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "직선 y = x 에 대한 대칭이동을 좌표를 맞바꾸는 규칙으로 옮겨 상의 원의 중심 x 좌표 h 를 구함", extra: "대칭이동을 좌표 맞바꿈으로 옮겨야 함(원래 h 를 답하거나 부호를 바꾸면 오답) — medium 은 평행이동",
      concepts: ["원의 방정식", "대칭이동", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = mk(rng); if (s.h === s.k) throw new GenFail("같음"); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p }); const askH = rng.pick([true, false]); const v = askH ? s.k : s.h;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(c, p), ` The circle is reflected across the line $y = x$.${IMG}`), question: askH ? "What is the value of $h$ for the image circle?" : "What is the value of $k$ for the image circle?", correct: v,
          wrongs: pos([W(askH ? s.h : s.k, "step_missing", "대칭이동을 적용하지 않았다."), W(s.h + s.k, "formula_misuse", "좌표를 더했다."), W(s.r, "step_missing", "반지름을 답했다."), W(v + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== v),
          verificationJs: figJs({ c, ax: askH ? 0 : 1 }, f, `${CJ}const C=PA(P.c); const R=[C[1],C[0]]; return ip(R[P.ax]);`),
          trace: [[`그림에서 중심 ${c} = (${s.h}, ${s.k}) 를 읽는다.`, "Read the center."], [`y = x 에 대한 대칭이동은 좌표를 맞바꾼다.`, "Swap the coordinates."], [`상의 중심 = (${s.k}, ${s.h}) 이다.`, "The image center."], [`${askH ? "h" : "k"} 는 상의 중심의 ${askH ? "x" : "y"} 좌표이다.`, "Match h or k."], [`따라서 ${v} 이다.`, "State the value."]], variant: "circle_reflect_center",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "평행이동한 상의 중심의 x 좌표가 지문에 주어질 때 원래 중심을 읽어 오른쪽으로 이동한 거리를 거꾸로 구함", extra: "상의 h 에서 원래 h 를 빼야 함(더하거나 상의 h 를 그대로 답하면 오답) — medium 은 상의 좌표",
      concepts: ["원의 방정식", "평행이동", "역산"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = mk(rng); const d = rng.int(2, 7); const img = s.h + d; const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p });
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(c, p), ` The circle is translated horizontally to the right.${IMG} In the image, $h = ${img}$.`), question: rng.pick(["By how many units was the circle translated?", "How far to the right was the circle moved?", "What is the horizontal distance of the translation?"]), correct: d,
          wrongs: pos([W(img, "step_missing", "상의 h 를 답했다."), W(img + s.h, "formula_misuse", "더했다."), W(s.h, "step_missing", "원래 h 를 답했다."), W(d + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== d),
          verificationJs: figJs({ c, img }, f, `${CJ}const C=PA(P.c); return ip(P.img-C[0]);`),
          trace: [[`그림에서 중심 ${c} = (${s.h}, ${s.k}) 를 읽는다.`, "Read the center."], [`평행이동은 중심의 x 좌표만 바꾼다.`, "A horizontal translation changes only h."], [`상의 h = ${img} 이다.`, "The image's h."], [`이동한 거리 = ${img} − ${s.h} 이다.`, "New minus old."], [`따라서 ${d} 이다.`, "State the distance."]], variant: "circle_translation_distance",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "radius_after_translation", structure: "원을 평행이동해도 반지름이 변하지 않음을 알고 원 위의 점으로 반지름을 구함", extra: "easy: 이동해도 r 은 그대로", concepts: ["원의 방정식", "평행이동"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = mk(rng); const dx = rng.int(1, 5), dy = rng.int(1, 5); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p });
        return geoInst(rng, { stimulus: cgIntro(rng, sc(c, p), ` The circle is translated ${un(dx)} to the right and ${un(dy)} up.`), question: rng.pick(["What is the radius of the image circle?", "How long is the radius of the circle after the translation?"]), correct: s.r, wrongs: pos([W(s.r + dx, "formula_misuse", "이동량을 더했다."), W(s.r * s.r, "formula_misuse", "제곱했다."), W(s.dx + s.dy, "formula_misuse", "가로·세로 차를 더했다.")]).filter((x) => x.v !== s.r), verificationJs: figJs({ c, p }, f, `${CJ}const C=PA(P.c), Q=PA(P.p); const r=dist(C,Q); if (Math.abs(r-CI.radius)>1e-9) throw new Error('원 위의 점 아님'); return ip(r);`), trace: [[`그림에서 ${c}, ${p} 의 좌표를 읽는다.`, "Read the coordinates."], [`반지름 = √(${s.dx}² + ${s.dy}²) = ${s.r} 이다.`, "The radius."], [`평행이동은 반지름을 바꾸지 않는다.`, "A translation keeps the radius."]], variant: "circle_radius_after_translation_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "translate_h", structure: "원을 오른쪽으로 평행이동한 상의 원의 h 를 구함", extra: "medium: h + 이동량", concepts: ["원의 방정식", "평행이동"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = mk(rng); const dx = rng.int(1, 5), dy = rng.int(1, 5); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p });
        return geoInst(rng, { stimulus: cgIntro(rng, sc(c, p), ` The circle is translated ${un(dx)} to the right and ${un(dy)} up.${IMG}`), question: "What is the value of $h$ for the image circle?", correct: s.h + dx, wrongs: pos([W(s.h, "step_missing", "원래 h 를 답했다."), W(s.k + dy, "formula_misuse", "k 를 답했다."), W(s.h + dx + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== s.h + dx), verificationJs: figJs({ c, dx }, f, `${CJ}const C=PA(P.c); return ip(C[0]+P.dx);`), trace: [[`그림에서 중심 ${c} = (${s.h}, ${s.k}) 를 읽는다.`, "Read the center."], [`h 에 ${dx} 를 더한다.`, "Add the shift to h."], [`따라서 ${s.h + dx} 이다.`, "State h."]], variant: "circle_translate_h_medium" }, f);
      }); },
    },
  ],
});
