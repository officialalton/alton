// coordinate_geometry.transformation_image.CG.P — 좌표평면의 삼각형에서 꼭짓점의 이동·대칭·회전의 상의 좌표를 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, cgIntro, names, planeFig, polyO, ptO, type P2, un } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const sc3 = (a: string, b: string, c: string) => [`The figure shows triangle ${a}${b}${c} on a coordinate grid.`, `Triangle ${a}${b}${c} is plotted in the coordinate plane shown.`, `In the figure shown, points ${a}, ${b}, and ${c} are the vertices of a triangle.`, `A triangle with vertices ${a}, ${b}, and ${c} is drawn on the grid shown.`, `The coordinate grid shown contains triangle ${a}${b}${c}.`];
/** 첫 사분면의 삼각형(꼭짓점 세 개가 서로 다른 격자점). */
function tri(rng: Rng, lo = 1, hi = 8): P2[] {
  for (let i = 0; i < 60; i++) { const p: P2[] = [0, 1, 2].map(() => [rng.int(lo, hi), rng.int(lo, hi)] as P2); const key = new Set(p.map((q) => q.join())); if (key.size < 3) continue; const ar = Math.abs(p[0][0] * (p[1][1] - p[2][1]) + p[1][0] * (p[2][1] - p[0][1]) + p[2][0] * (p[0][1] - p[1][1])); if (ar < 6) continue; if (new Set(p.map((q) => q[0])).size < 3 || new Set(p.map((q) => q[1])).size < 3) continue; return p; }
  throw new GenFail("삼각형");
}
const fig = (n: string[], p: P2[]) => planeFig([...n.map((id, i) => ptO(id, p[i])), polyO("T", n)], p);
const TJ = `${CG_JS}`;

export const ITEM = defineItem({
  prefix: "av", itemId: "coordinate_geometry.transformation_image.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "삼각형의 꼭짓점 A 를 그림에서 읽고 지문의 평행이동으로 옮긴 점 A′ 의 두 좌표의 합을 구함", extra: "원래 좌표를 읽어 이동량을 각각 더한 뒤 두 좌표를 합해야 함(이동량을 한 방향만 더하거나 원래 좌표의 합을 답하면 오답) — medium 은 한 좌표",
      concepts: ["평행이동", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3); const p = tri(rng, 1, 7); const dx = rng.int(1, 5), dy = rng.int(1, 5); const idx = rng.int(0, 2); const v = p[idx]; const c = v[0] + dx + v[1] + dy; const f = fig(n, p);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...(n as [string, string, string])), ` The triangle is translated ${un(dx)} to the right and ${un(dy)} up.`), question: rng.pick([`What is the sum of the coordinates of ${n[idx]}′, the image of ${n[idx]}?`, `After the translation, ${n[idx]} moves to ${n[idx]}′. What is the sum of the $x$- and $y$-coordinates of ${n[idx]}′?`, `Find the sum of the coordinates of the image of ${n[idx]}.`]), correct: c,
          wrongs: pos([W(v[0] + v[1], "step_missing", "이동하기 전 좌표의 합을 답했다."), W(c - dy, "step_missing", "위로의 이동을 빠뜨렸다."), W(c - dx, "step_missing", "오른쪽 이동을 빠뜨렸다."), W(dx + dy, "step_missing", "이동량의 합을 답했다."), W(v[0] + v[1] - dx - dy, "formula_misuse", "반대로 이동했다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ p: n[idx], dx, dy }, f, `${TJ}const V=PA(P.p); return ip(V[0]+P.dx+V[1]+P.dy);`),
          trace: [[`그림에서 ${n[idx]} = (${v[0]}, ${v[1]}) 를 읽는다.`, "Read the vertex."], [`x 좌표: ${v[0]} + ${dx} = ${v[0] + dx} 이다.`, "Translate x."], [`y 좌표: ${v[1]} + ${dy} = ${v[1] + dy} 이다.`, "Translate y."], [`${n[idx]}′ = (${v[0] + dx}, ${v[1] + dy}) 이다.`, "The image point."], [`따라서 ${c} 이다.`, "Add the coordinates."]], variant: "translation_image_sum",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "삼각형의 꼭짓점을 직선 y = x 에 대해 대칭이동한 뒤 평행이동한 점의 x 좌표를 구함", extra: "대칭이동으로 x, y 를 맞바꾼 뒤 이동량을 더해야 함(맞바꾸지 않거나 이동 순서를 바꾸면 오답) — medium 은 대칭이동만",
      concepts: ["대칭이동", "평행이동", "연속 변환"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3); const p = tri(rng, 1, 7); const dx = rng.int(1, 5), dy = rng.int(1, 5); const idx = rng.int(0, 2); const v = p[idx]; const askX = rng.pick([true, false]); const c = askX ? v[1] + dx : v[0] + dy; const f = fig(n, p);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...(n as [string, string, string])), ` The triangle is reflected across the line $y = x$ and then translated ${un(dx)} to the right and ${un(dy)} up.`), question: askX ? rng.pick([`What is the $x$-coordinate of the final image of ${n[idx]}?`, `Find the $x$-coordinate of ${n[idx]} after both transformations.`, `After both transformations, ${n[idx]} ends at a point with what $x$-coordinate?`]) : rng.pick([`What is the $y$-coordinate of the final image of ${n[idx]}?`, `Find the $y$-coordinate of ${n[idx]} after both transformations.`, `After both transformations, ${n[idx]} ends at a point with what $y$-coordinate?`]), correct: c,
          wrongs: pos(askX ? [W(v[0] + dx, "step_missing", "대칭이동을 빠뜨렸다."), W(v[1], "step_missing", "이동량을 빠뜨렸다."), W(v[1] + dy, "formula_misuse", "다른 이동량을 더했다."), W(v[0] + v[1] + dx, "formula_misuse", "좌표를 더했다."), W(c + 1, "other", "계산 중 어긋났다.")] : [W(v[1] + dy, "step_missing", "대칭이동을 빠뜨렸다."), W(v[0], "step_missing", "이동량을 빠뜨렸다."), W(v[0] + dx, "formula_misuse", "다른 이동량을 더했다."), W(v[0] + v[1] + dy, "formula_misuse", "좌표를 더했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ p: n[idx], dx, dy, ax: askX ? 0 : 1 }, f, `${TJ}const V=PA(P.p); const R=[V[1],V[0]]; const T=[R[0]+P.dx,R[1]+P.dy]; return ip(T[P.ax]);`),
          trace: [[`그림에서 ${n[idx]} = (${v[0]}, ${v[1]}) 를 읽는다.`, "Read the vertex."], [`y = x 에 대해 대칭이동하면 좌표를 맞바꾼다: (${v[1]}, ${v[0]}) 이다.`, "Reflection across y = x swaps the coordinates."], [`오른쪽으로 ${dx}, 위로 ${dy} 이동한다.`, "Then translate."], [`최종 점은 (${v[1] + dx}, ${v[0] + dy}) 이다.`, "The final image point."], [`따라서 ${askX ? "x" : "y"} 좌표는 ${c} 이다.`, "State the coordinate."]], variant: "reflect_then_translate",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "시계 방향 90° 회전을 말로 주고 (x, y) → (y, −x) 규칙으로 옮겨 상의 한 좌표를 구함", extra: "회전을 좌표 규칙으로 바꿔 적용해야 함(규칙을 반대 방향으로 쓰거나 좌표를 맞바꾸지 않으면 오답) — medium 은 y = x 대칭",
      concepts: ["회전", "표현 바꾸기", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3); const p = tri(rng, 1, 7); const idx = rng.int(0, 2); const v = p[idx]; const c = v[1]; const f = fig(n, p); // 시계 방향 90°: (x,y) → (y, −x) → x 좌표는 y
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...(n as [string, string, string])), " The triangle is rotated 90 degrees clockwise about the origin."), question: rng.pick([`What is the $x$-coordinate of ${n[idx]}′, the image of ${n[idx]}?`, `After the rotation, ${n[idx]} moves to ${n[idx]}′. What is the $x$-coordinate of ${n[idx]}′?`, `Find the $x$-coordinate of the image of ${n[idx]}.`]), correct: c,
          wrongs: pos([W(v[0], "step_missing", "회전을 적용하지 않았다."), W(v[0] + v[1], "formula_misuse", "좌표를 더했다."), W(Math.abs(v[0] - v[1]) || v[0] + 1, "formula_misuse", "좌표의 차를 구했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ p: n[idx] }, f, `${TJ}const V=PA(P.p); const R=[V[1],-V[0]]; return ip(R[0]);`),
          trace: [[`그림에서 ${n[idx]} = (${v[0]}, ${v[1]}) 를 읽는다.`, "Read the vertex."], [`시계 방향 90° 회전은 (x, y) → (y, −x) 이다.`, "The rule for a clockwise quarter turn."], [`${n[idx]}′ = (${v[1]}, −${v[0]}) 이다.`, "Apply the rule."], [`상의 x 좌표는 원래 y 좌표와 같다.`, "The x-coordinate comes from the old y-coordinate."], [`따라서 ${c} 이다.`, "State the coordinate."]], variant: "rotate_clockwise_image",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "평행이동된 점 A′ 의 x 좌표가 지문에 주어지고 A 가 그림에 있을 때 오른쪽으로 이동한 거리를 거꾸로 구함", extra: "상의 좌표에서 원래 좌표를 빼야 함(더하거나 상의 좌표를 그대로 답하면 오답) — medium 은 상의 좌표",
      concepts: ["평행이동", "역산", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3); const p = tri(rng, 1, 7); const idx = rng.int(0, 2); const v = p[idx]; const d = rng.int(2, 7); const img = v[0] + d; const f = fig(n, p);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...(n as [string, string, string])), ` The triangle is translated horizontally to the right, and the $x$-coordinate of ${n[idx]}′, the image of ${n[idx]}, is ${img}.`), question: rng.pick(["By how many units was the triangle translated?", "How far to the right was the triangle moved?", "What is the horizontal distance of the translation?"]), correct: d,
          wrongs: pos([W(img, "step_missing", "상의 좌표를 답했다."), W(img + v[0], "formula_misuse", "좌표를 더했다."), W(v[0], "step_missing", "원래 좌표를 답했다."), W(d + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== d),
          verificationJs: figJs({ p: n[idx], img }, f, `${TJ}const V=PA(P.p); return ip(P.img-V[0]);`),
          trace: [[`그림에서 ${n[idx]} = (${v[0]}, ${v[1]}) 를 읽는다.`, "Read the vertex."], [`평행이동은 x 좌표만 바꾼다.`, "A horizontal translation changes only x."], [`상의 x 좌표는 ${img} 이다.`, "The image's x-coordinate."], [`이동한 거리 = ${img} − ${v[0]} 이다.`, "New minus old."], [`따라서 ${d} 이다.`, "State the distance."]], variant: "translation_distance",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "translate_x", structure: "삼각형의 한 꼭짓점을 오른쪽으로 평행이동한 점의 x 좌표를 구함", extra: "easy: x 좌표 + 이동량", concepts: ["평행이동"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3); const p = tri(rng, 1, 7); const d = rng.int(2, 6); const idx = rng.int(0, 2); const v = p[idx]; const f = fig(n, p);
        return geoInst(rng, { stimulus: cgIntro(rng, sc3(...(n as [string, string, string])), ` The triangle is translated ${un(d)} to the right.`), question: rng.pick([`What is the $x$-coordinate of ${n[idx]}′, the image of ${n[idx]}?`, `Find the $x$-coordinate of the image of ${n[idx]}.`]), correct: v[0] + d, wrongs: pos([W(v[0], "step_missing", "원래 좌표를 답했다."), W(v[1] + d, "formula_misuse", "y 좌표에 더했다."), W(v[0] + d + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== v[0] + d), verificationJs: figJs({ p: n[idx], d }, f, `${TJ}const V=PA(P.p); return ip(V[0]+P.d);`), trace: [[`그림에서 ${n[idx]} = (${v[0]}, ${v[1]}) 를 읽는다.`, "Read the vertex."], [`x 좌표에 ${d} 를 더한다.`, "Add the shift to x."], [`따라서 ${v[0] + d} 이다.`, "State the coordinate."]], variant: "translate_x_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "reflect_swap", structure: "삼각형의 한 꼭짓점을 직선 y = x 에 대해 대칭이동한 점의 x 좌표를 구함", extra: "medium: 좌표를 맞바꿈", concepts: ["대칭이동"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3); const p = tri(rng, 1, 7); const idx = rng.int(0, 2); const v = p[idx]; const f = fig(n, p);
        return geoInst(rng, { stimulus: cgIntro(rng, sc3(...(n as [string, string, string])), " The triangle is reflected across the line $y = x$."), question: rng.pick([`What is the $x$-coordinate of ${n[idx]}′, the image of ${n[idx]}?`, `Find the $x$-coordinate of the image of ${n[idx]}.`]), correct: v[1], wrongs: pos([W(v[0], "step_missing", "원래 좌표를 답했다."), W(v[0] + v[1], "formula_misuse", "좌표를 더했다."), W(v[1] + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== v[1]), verificationJs: figJs({ p: n[idx] }, f, `${TJ}const V=PA(P.p); return ip(V[1]);`), trace: [[`그림에서 ${n[idx]} = (${v[0]}, ${v[1]}) 를 읽는다.`, "Read the vertex."], [`y = x 에 대한 대칭은 좌표를 맞바꾼다.`, "Swap the coordinates."], [`따라서 ${v[1]} 이다.`, "State the coordinate."]], variant: "reflect_swap_medium" }, f);
      }); },
    },
  ],
});
