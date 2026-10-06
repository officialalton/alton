// lines_angles_triangles.triangle_inequality.TR.P — 삼각형 그림의 두 변 라벨(숫자 또는 x 의 식)과 미지의 변 x 에서 삼각형 부등식으로 x·둘레의 범위를 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { NUM_JS, geoInst, lead, pickN } from "../geo-kit";
import type { Rng } from "../../../rng";

const PARSE_LIN_JS = "const lin=(l)=>{ const t=String(l).replace(/\\s/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+(?:\\.\\d+)?)$/.exec(t); if (m) return {a:0,b:Number(m[1])}; throw new Error('변 라벨 형식 오류: '+l); };\n";
/** FIGURE 의 세 변 라벨을 L[0..2](변 v0v1, v1v2, v0v2 순)로 읽는다. */
const TI_JS = `${NUM_JS}${PARSE_LIN_JS}const V=FIGURE.vertices; const sl=(a,b)=>{ const s=(FIGURE.sides||[]).find(q=>(q.between[0]===a&&q.between[1]===b)||(q.between[0]===b&&q.between[1]===a)); if(!s) throw new Error('변 라벨 없음'); return s.label; }; const L=[sl(V[0],V[1]),sl(V[1],V[2]),sl(V[0],V[2])];\n`;
const PAIRS: [number, number][] = [[0, 1], [1, 2], [0, 2]];
type Ti = { v: string[]; labels: string[]; pos: number };
/** 세 변 라벨(길이순서 [v0v1, v1v2, v0v2])로 그림 데이터를 만든다. 그림은 축척을 따르지 않는다(notToScale). */
function tiFig(v: string[], labels: string[]) {
  return { type: "triangle", vertices: v, kind: "scalene", notToScale: true, sides: PAIRS.map(([i, j], k) => ({ between: [v[i], v[j]] as [string, string], label: labels[k] })) };
}
const S1 = (v: string[]) => [`The figure shows triangle $${v.join("")}$.`, `Triangle $${v.join("")}$ is drawn in the figure shown.`, `Consider triangle $${v.join("")}$ in the figure shown.`, `A sketch of triangle $${v.join("")}$ is shown.`, `The diagram shown gives the side lengths of triangle $${v.join("")}$.`, `In the figure shown, $${v.join("")}$ is a triangle.`, `Triangle $${v.join("")}$ appears in the figure below.`];
const S2 = ["Two of its side lengths are labeled, and the third side has length $x$.", "The lengths of two sides are given, and $x$ is the length of the remaining side.", "All lengths are in the same unit, and one side is unknown; its length is $x$.", "Two sides are labeled with their lengths, while the third side is labeled $x$.", "The labels give two side lengths in the same unit, and $x$ stands for the third."];
const S3 = [" The value of $x$ is an integer.", " Assume that $x$ is a whole number.", " Also, $x$ must be an integer.", " The number $x$ is a positive integer."];
const intro = (rng: Rng, v: string[], extra = "") => `${lead(rng)}${rng.pick(S1(v))} ${rng.pick(S2)}${extra}`;
const S2E = ["Each side length is labeled in the same unit, in terms of $x$.", "The three side lengths are marked in the figure, and some of them involve $x$.", "The lengths of the sides are given in the same unit; two of the labels contain $x$.", "Its sides are labeled with lengths, and $x$ appears in two of the labels."];
const intro2 = (rng: Rng, v: string[]) => `${lead(rng)}${rng.pick(S1(v))} ${rng.pick(S2E)}${rng.pick(S3)}`;
const ints = " The value of $x$ is an integer.";
function pick2(rng: Rng): { a: number; b: number } {
  for (let tr = 0; tr < 100; tr++) { const a = rng.int(3, 20), b = rng.int(3, 20); if (Math.abs(a - b) >= 2 && a !== b) return { a, b }; }
  throw new GenFail("두 변 표집 실패");
}
function xFig(rng: Rng, a: number, b: number) { const v = pickN(rng, 3); const k = rng.int(0, 2); const labels = [0, 1, 2].map((m) => (m === k ? "x" : String(m === (k + 1) % 3 ? a : b))); return { v, fig: tiFig(v, labels) }; }
const rd = (a: number, b: number): [string, string] => [`그림에서 두 변의 길이 ${a}, ${b} 와 미지의 변 x 를 읽는다.`, "Read the two known sides and the unknown side x."];
const bound: [string, string] = ["삼각형 부등식: 두 변의 합 > 나머지 한 변, 즉 |a − b| < x < a + b 이다.", "Triangle inequality: |a − b| < x < a + b."];

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.triangle_inequality.TR.P",
  hard: [
    {
      op: "constraint_select", structure: "삼각형의 두 변 길이가 라벨이고 셋째 변 x 가 정수일 때 삼각형 부등식으로 가능한 x 의 개수를 셈", extra: "|a - b| < x < a + b 의 양 끝 경계를 모두 제외하고 정수 개수를 세야 함(끝값 포함·제외 함정) — medium 은 가능한 가장 작은 x",
      concepts: ["삼각형 부등식", "정수 개수 세기"],
      gen(rng) {
        const { a, b } = pick2(rng); const { v, fig } = xFig(rng, a, b); const lo = Math.abs(a - b) + 1, hi = a + b - 1; const n = hi - lo + 1;
        return geoInst(rng, {
          stimulus: intro(rng, v, rng.pick(S3)), question: rng.pick([`How many different integer values of $x$ are possible?`, `For how many integer values of $x$ can the triangle exist?`, `How many integers can $x$ equal?`]), correct: n,
          wrongs: [W(n + 2, "condition_ignored", "양 끝값을 포함해 셌다."), W(n + 1, "condition_ignored", "한쪽 끝값을 포함해 셌다."), W(a + b - Math.abs(a - b), "formula_misuse", "경계 값의 차를 개수로 착각했다."), W(hi, "partial", "가장 큰 x 를 답했다."), W(n - 1, "condition_ignored", "한쪽 끝값을 더 제외했다.")],
          verificationJs: figJs({}, fig, `${TI_JS}const nums=L.filter(l=>l!=='x').map(Number); if (nums.length!==2||L.filter(l=>l==='x').length!==1||nums.some(n=>!Number.isFinite(n))) throw new Error('라벨 형식'); const lo=Math.abs(nums[0]-nums[1])+1, hi=nums[0]+nums[1]-1; return hi-lo+1;`),
          trace: [rd(a, b), bound, [`${Math.abs(a - b)} < x < ${a + b} 이고 x 가 정수이므로 ${lo} ≤ x ≤ ${hi} 이다.`, "Strict inequalities, integer x."], [`개수 = ${hi} - ${lo} + 1 = ${n} 이다.`, "Count the integers."], [`따라서 ${n} 이다.`, "State the count."]], variant: "count_integer_third_sides",
        }, fig);
      },
    },
    {
      op: "compose_kind", structure: "삼각형의 두 변 길이가 라벨이고 셋째 변 x 가 정수일 때 삼각형 부등식으로 x 의 최댓값을 구해 가능한 가장 큰 둘레를 구함", extra: "부등식의 열린 경계에서 정수 최댓값 a + b - 1 을 구한 뒤 둘레(세 변의 합)로 합성 — x 를 답하거나 a + b 를 쓰는 함정, medium 은 x 의 최댓값",
      concepts: ["삼각형 부등식", "둘레"],
      gen(rng) {
        const { a, b } = pick2(rng); const { v, fig } = xFig(rng, a, b); const xm = a + b - 1; const per = a + b + xm;
        return geoInst(rng, {
          stimulus: intro(rng, v, rng.pick(S3)), question: rng.pick([`What is the greatest possible perimeter of the triangle?`, `What is the greatest possible integer value of the perimeter of triangle $${v.join("")}$?`, `Over all possible integer values of $x$, what is the largest perimeter the triangle can have?`]), correct: per,
          wrongs: [W(a + b + (a + b), "condition_ignored", "x 가 a + b 와 같을 수 있다고 보았다."), W(xm, "partial", "x 의 최댓값만 답했다."), W(a + b, "partial", "두 변의 합만 답했다."), W(per - 2, "other", "계산 중 어긋났다."), W(per + 1, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, fig, `${TI_JS}const nums=L.filter(l=>l!=='x').map(Number); if (nums.length!==2||L.filter(l=>l==='x').length!==1||nums.some(n=>!Number.isFinite(n))) throw new Error('라벨 형식'); const s=nums[0]+nums[1]; return s+(s-1);`),
          trace: [rd(a, b), bound, [`x 는 정수이고 x < ${a + b} 이므로 가장 큰 x = ${xm} 이다.`, "The greatest integer below a + b."], [`둘레 = ${a} + ${b} + ${xm} = ${per} 이다.`, "Add the three sides."], [`따라서 ${per} 이다.`, "State the perimeter."]], variant: "greatest_perimeter",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "삼각형의 두 변 길이가 라벨이고 셋째 변 x 가 정수일 때 삼각형 부등식으로 x 의 최솟값을 구해 가능한 가장 작은 둘레를 구함", extra: "|a - b| < x 의 열린 경계에서 정수 최솟값 |a - b| + 1 을 구한 뒤 둘레로 이어지는 2단계 — x = |a - b| 를 쓰는 함정, medium 은 x 의 최솟값",
      concepts: ["삼각형 부등식", "둘레"],
      gen(rng) {
        const { a, b } = pick2(rng); const { v, fig } = xFig(rng, a, b); const xm = Math.abs(a - b) + 1; const per = a + b + xm;
        return geoInst(rng, {
          stimulus: intro(rng, v, rng.pick(S3)), question: rng.pick([`What is the least possible perimeter of the triangle?`, `What is the smallest possible integer value of the perimeter of triangle $${v.join("")}$?`, `Over all possible integer values of $x$, what is the smallest perimeter the triangle can have?`]), correct: per,
          wrongs: [W(a + b + Math.abs(a - b), "condition_ignored", "x 가 |a - b| 와 같을 수 있다고 보았다."), W(xm, "partial", "x 의 최솟값만 답했다."), W(a + b, "partial", "두 변의 합만 답했다."), W(per + 2, "other", "계산 중 어긋났다."), W(a + b + 1, "formula_misuse", "x = 1 로 두었다.")],
          verificationJs: figJs({}, fig, `${TI_JS}const nums=L.filter(l=>l!=='x').map(Number); if (nums.length!==2||L.filter(l=>l==='x').length!==1||nums.some(n=>!Number.isFinite(n))) throw new Error('라벨 형식'); return nums[0]+nums[1]+Math.abs(nums[0]-nums[1])+1;`),
          trace: [rd(a, b), bound, [`x 는 정수이고 x > ${Math.abs(a - b)} 이므로 가장 작은 x = ${xm} 이다.`, "The least integer above |a − b|."], [`둘레 = ${a} + ${b} + ${xm} = ${per} 이다.`, "Add the three sides."], [`따라서 ${per} 이다.`, "State the perimeter."]], variant: "least_perimeter",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "삼각형의 세 변이 x, x + k, c 로 라벨될 때 부등식 x + (x + k) > c 를 세워 x 의 가장 작은 정수값을 구함", extra: "변 라벨(식)을 삼각형 부등식으로 번역해 일차부등식을 풀고 부등호 경계의 다음 정수를 골라야 함(c - k 의 절반 올림 함정) — medium 은 숫자 변의 최솟값",
      concepts: ["삼각형 부등식", "일차부등식", "식의 번역"],
      gen(rng) {
        const k = rng.int(2, 8), c = rng.int(k + 3, 28); const v = pickN(rng, 3); const labels = ["", "", ""]; const bottom = rng.pick(["x", String(c)]); const rest = rng.shuffle(bottom === "x" ? [`x + ${k}`, String(c)] : ["x", `x + ${k}`]); labels[1] = bottom; labels[0] = rest[0]; labels[2] = rest[1]; // 긴 식 라벨은 밑변(아래 'Note' 문구와 가까움)에 두지 않는다
        const fig = tiFig(v, labels); const min = Math.floor((c - k) / 2) + 1;
        return geoInst(rng, {
          stimulus: intro2(rng, v), question: rng.pick([`What is the least possible value of $x$?`, `What is the smallest integer value of $x$ for which this triangle can exist?`, `The triangle can exist for integer values of $x$ greater than or equal to what number?`]), correct: min,
          wrongs: [W(Math.floor((c - k) / 2), "condition_ignored", "부등호 경계 값 자체를 답했다."), W(Math.floor((c - k) / 2) + 2, "other", "올림을 잘못 처리했다."), W(c - k, "formula_misuse", "x + k + x 대신 x + k 만 비교했다."), W(Math.floor((c + k) / 2) + 1, "sign_error", "k 의 부호를 반대로 처리했다."), W(1, "condition_ignored", "x > 0 만 고려했다.")],
          verificationJs: figJs({}, fig, `${TI_JS}const E=L.map(lin); const xs=E.filter(e=>e.a===1&&e.b===0), ys=E.filter(e=>e.a===1&&e.b!==0), cs=E.filter(e=>e.a===0); if (xs.length!==1||ys.length!==1||cs.length!==1) throw new Error('라벨 형식'); const k=ys[0].b, c=cs[0].b; if (!(c>k)) throw new Error('c > k 필요'); return Math.floor((c-k)/2)+1;`),
          trace: [[`그림에서 세 변이 x, x + ${k}, ${c} 이다.`, "Read the three side labels."], [`삼각형 부등식: 가장 짧은 두 변의 합 > 가장 긴 변. x + (x + ${k}) > ${c}.`, "The two shorter sides must add to more than the longest side."], [`2x > ${c - k}, 즉 x > ${(c - k) / 2} 이다.`, "Solve the linear inequality."], [`다른 두 부등식(${c} - ${k} < x 쪽)은 x > 0 이면 성립한다.`, "The other inequalities hold automatically."], [`x 가 정수이므로 가장 작은 값은 ${min} 이다.`, "The least integer exceeding the bound."]], variant: "least_x_from_expressions",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "greatest_x", structure: "삼각형의 두 변 길이가 라벨일 때 셋째 변 x 가 가질 수 있는 가장 큰 정수를 구함", extra: "easy: x < a + b 한 번 적용", concepts: ["삼각형 부등식"],
      gen(rng) {
        const { a, b } = pick2(rng); const { v, fig } = xFig(rng, a, b); const xm = a + b - 1;
        return geoInst(rng, { stimulus: intro(rng, v, rng.pick(S3)), question: rng.pick([`What is the greatest possible value of $x$?`, `What is the largest integer that $x$ can equal?`]), correct: xm, wrongs: [W(a + b, "condition_ignored", "끝값을 포함했다."), W(Math.abs(a - b), "other", "두 변의 차를 답했다."), W(xm - 1, "other", "계산 중 어긋났다."), W(a * b > 99 ? a + b + 2 : a + b - 2, "other", "계산 중 어긋났다.")], verificationJs: figJs({}, fig, `${TI_JS}const nums=L.filter(l=>l!=='x').map(Number); if (nums.length!==2||nums.some(n=>!Number.isFinite(n))) throw new Error('라벨 형식'); return nums[0]+nums[1]-1;`), trace: [rd(a, b), bound, [`x < ${a + b} 이고 x 가 정수이므로 가장 큰 값은 ${xm} 이다.`, "The greatest integer below a + b."]], variant: "greatest_third_side",
        }, fig);
      },
    },
    {
      lv: "medium", name: "least_x", structure: "삼각형의 두 변 길이가 라벨일 때 셋째 변 x 가 가질 수 있는 가장 작은 정수를 구함", extra: "medium: 두 변의 차를 구하고 열린 경계의 다음 정수 선택", concepts: ["삼각형 부등식", "절댓값 차"],
      gen(rng) {
        const { a, b } = pick2(rng); const { v, fig } = xFig(rng, a, b); const xm = Math.abs(a - b) + 1;
        return geoInst(rng, { stimulus: intro(rng, v, rng.pick(S3)), question: rng.pick([`What is the least possible value of $x$?`, `What is the smallest integer that $x$ can equal?`]), correct: xm, wrongs: [W(Math.abs(a - b), "condition_ignored", "끝값을 포함했다."), W(a + b, "formula_misuse", "두 변의 합을 답했다."), W(Math.abs(a - b) + 2, "other", "계산 중 어긋났다."), W(1, "condition_ignored", "x > 0 만 고려했다.")], verificationJs: figJs({}, fig, `${TI_JS}const nums=L.filter(l=>l!=='x').map(Number); if (nums.length!==2||nums.some(n=>!Number.isFinite(n))) throw new Error('라벨 형식'); return Math.abs(nums[0]-nums[1])+1;`), trace: [rd(a, b), bound, [`x > |${a} - ${b}| = ${Math.abs(a - b)} 이다.`, "The lower bound is the difference of the two sides."], [`x 가 정수이므로 가장 작은 값은 ${xm} 이다.`, "The next integer above the bound."]], variant: "least_third_side",
        }, fig);
      },
    },
  ],
});
