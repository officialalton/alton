// area_volume.rectangle_area.PG.P — 직사각형 그림의 변·대각선 라벨과 지문의 조건(넓이·비·증가량)에서 넓이·둘레·변을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst, pickN } from "../geo-kit";
import { PG_JS, PG_LEAD, UNITS, quadNames, rectFig } from "../pg-kit";
import { TRIPLES } from "../tri-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isInteger(w.v) && w.v > 0);
const intro = (rng: Rng, v: string[], extra = "", unit = "") => `${rng.pick(PG_LEAD)}${rng.pick([`The figure shows rectangle $${v.join("")}$.`, `Rectangle $${v.join("")}$ is shown in the figure.`, `In the figure shown, $${v.join("")}$ is a rectangle.`, `The rectangle $${v.join("")}$ in the figure has the labeled measurements.`])}${extra} ${unit}`.replace(/ {2,}/g, " ").trim();
const rd = (v: string[], a: string, b: string): [string, string] => [`그림에서 ${v[0]}${v[1]} = ${a}, ${v[1]}${v[2]} = ${b} 를 읽는다.`, "Read the side lengths from the figure."];
function dims(rng: Rng, lo = 4, hi = 24): [number, number] { for (let i = 0; i < 80; i++) { const a = rng.int(lo, hi), b = rng.int(lo, hi); if (a !== b && Math.max(a, b) / Math.min(a, b) <= 3 && a >= b) return [a, b]; } throw new GenFail("직사각형 변"); }

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.rectangle_area.PG.P",
  hard: [
    {
      op: "inverse", structure: "직사각형의 한 변이 그림에 있고 넓이가 지문에 주어질 때 다른 변을 거꾸로 구한 뒤 둘레를 구함", extra: "넓이 ÷ 한 변 으로 다른 변을 구하고 둘레 공식에 넣어야 함(넓이를 둘레로 착각하거나 한 변만 두 배하면 오답) — medium 은 둘레에서 한 변",
      concepts: ["직사각형의 넓이", "둘레", "역산"],
      gen(rng) {
        const [L, Wd] = dims(rng); const A = L * Wd; const v = quadNames(rng); const fig = rectFig(v, String(L)); const u = rng.pick(UNITS); const per = 2 * (L + Wd);
        return geoInst(rng, {
          stimulus: intro(rng, v, ` The area of the rectangle is ${A}.`, u), question: rng.pick([`What is the perimeter of the rectangle?`, `What is the perimeter, in units, of rectangle $${v.join("")}$?`, `The rectangle's perimeter is how long?`]), correct: per,
          wrongs: pos([W(A, "step_missing", "넓이를 답했다."), W(Wd, "step_missing", "다른 변을 답했다."), W(2 * L + Wd, "formula_misuse", "다른 변을 한 번만 더했다."), W(L + Wd, "formula_misuse", "반둘레를 답했다."), W(per + 4, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== per),
          verificationJs: figJs({ A }, fig, `${PG_JS}const L=side(V[0],V[1]); if (!(L>0)) throw new Error('변 라벨 없음'); const o=P.A/L; if (!(o>0)) throw new Error('변 오류'); return 2*(L+o);`),
          trace: [[`그림에서 ${v[0]}${v[1]} = ${L} 를 읽고 넓이 ${A} 는 지문에서 안다.`, "Read one side from the figure; the area is in the text."], [`다른 변 = ${A} ÷ ${L} = ${Wd} 이다.`, "Divide the area by the known side."], [`두 변은 ${L} 과 ${Wd} 이다.`, "Both side lengths."], [`둘레 = 2 × (${L} + ${Wd}) = ${per} 이다.`, "Perimeter = 2(l + w)."], [`따라서 ${per} 이다.`, "State the perimeter."]], variant: "perimeter_from_area_and_side",
        }, fig);
      },
    },
    {
      op: "compose_kind", structure: "직사각형의 한 변과 대각선이 그림에 라벨될 때 피타고라스로 다른 변을 구한 뒤 넓이를 구함", extra: "대각선과 한 변으로 다른 변(피타고라스)을 구하고 곱해야 함(대각선을 변으로 쓰면 오답) — medium 은 두 변이 주어짐",
      concepts: ["직사각형의 넓이", "피타고라스 정리", "대각선"],
      gen(rng) {
        const [x, y, z] = rng.pick(TRIPLES); const k = rng.pick([1, 1, 2]); const a = x * k, b = y * k, d = z * k; if (d > 50) throw new GenFail("큼"); const [L, Wd] = rng.chance(0.5) ? [a, b] : [b, a]; const v = quadNames(rng);
        const fig = rectFig(v, String(L), undefined, { between: [v[0], v[2]], label: String(d) }); const A = L * Wd; const u = rng.pick(UNITS);
        return geoInst(rng, {
          stimulus: intro(rng, v, "", u), question: rng.pick([`What is the area of the rectangle?`, `What is the area of rectangle $${v.join("")}$?`, `How large is the area of the rectangle?`]), correct: A,
          wrongs: pos([W(L * d, "formula_misuse", "대각선을 변으로 곱했다."), W(Math.round(d * d / 2), "formula_misuse", "대각선으로 넓이를 구했다."), W(L + Wd, "formula_misuse", "합을 답했다."), W(Wd, "step_missing", "다른 변만 답했다."), W(A + L, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== A),
          verificationJs: figJs({}, fig, `${PG_JS}const L=side(V[0],V[1]), D=dg(V[0],V[2]); if (!(L>0&&D>L)) throw new Error('라벨 오류'); const o=Math.sqrt(D*D-L*L); if (Math.abs(o-Math.round(o))>1e-9) throw new Error('정수 변 아님'); return L*Math.round(o);`),
          trace: [[`그림에서 ${v[0]}${v[1]} = ${L}, 대각선 ${v[0]}${v[2]} = ${d} 를 읽는다.`, "Read the side and the diagonal."], [`대각선은 직각삼각형의 빗변: ${L}² + x² = ${d}² 이다.`, "The diagonal is the hypotenuse of a right triangle."], [`x² = ${d * d} - ${L * L} = ${Wd * Wd} 이므로 다른 변은 ${Wd} 이다.`, "Solve for the other side."], [`넓이 = ${L} × ${Wd} = ${A} 이다.`, "Area = length × width."], [`따라서 ${A} 이다.`, "State the area."]], variant: "area_from_side_and_diagonal",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "직사각형의 한 변이 그림에 있고 '가로가 세로의 k 배'가 지문에 주어질 때 비를 식으로 옮겨 다른 변을 구한 뒤 넓이를 구함", extra: "k 배 관계로 다른 변(나누기 또는 곱하기)을 정해야 함(배수 방향을 거꾸로 읽으면 오답) — medium 은 두 변이 주어짐",
      concepts: ["직사각형의 넓이", "비", "문장의 식 번역"],
      gen(rng) {
        const k = rng.pick([2, 3, 4]); const Wd = rng.int(3, 12); const L = k * Wd; if (L > 40) throw new GenFail("큼"); const showLong = rng.chance(0.6); const v = quadNames(rng);
        const fig = showLong ? rectFig(v, String(L)) : rectFig(v, undefined, String(Wd)); const A = L * Wd; const u = rng.pick(UNITS); const word = k === 2 ? "twice" : k === 3 ? "three times" : "four times";
        return geoInst(rng, {
          stimulus: intro(rng, v, ` The length ${v[0]}${v[1]} is ${word} the width ${v[1]}${v[2]}.`, u), question: rng.pick([`What is the area of the rectangle?`, `What is the area of rectangle $${v.join("")}$?`]), correct: A,
          wrongs: pos([W(showLong ? L * L : Wd * Wd, "step_missing", "한 변을 제곱했다."), W(showLong ? L * (L * k) : Wd * Wd * k * k, "formula_misuse", "배수 방향을 거꾸로 읽었다."), W(2 * (L + Wd), "formula_misuse", "둘레를 답했다."), W(L + Wd, "formula_misuse", "합을 답했다."), W(A + (showLong ? Wd : L), "other", "계산 중 어긋났다.")]).filter((w) => w.v !== A),
          verificationJs: figJs({ k, showLong: showLong ? 1 : 0 }, fig, `${PG_JS}const a=side(V[0],V[1]), b=side(V[1],V[2]); const known=P.showLong?a:b; if (!(known>0)) throw new Error('변 라벨 없음'); const l=P.showLong?known:known*P.k, w=P.showLong?known/P.k:known; return l*w;`),
          trace: [[`그림에서 ${showLong ? `${v[0]}${v[1]} = ${L}` : `${v[1]}${v[2]} = ${Wd}`} 를 읽고 지문에서 길이 = ${k} × 너비 이다.`, "Read one side; the text gives the ratio."], [`${showLong ? `너비 = ${L} ÷ ${k} = ${Wd}` : `길이 = ${k} × ${Wd} = ${L}`} 이다.`, "Find the other side from the ratio."], [`두 변은 ${L} 과 ${Wd} 이다.`, "Both side lengths."], [`넓이 = ${L} × ${Wd} = ${A} 이다.`, "Area = length × width."], [`따라서 ${A} 이다.`, "State the area."]], variant: "area_from_ratio",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "직사각형의 두 변이 그림에 있고 지문에서 '두 변을 각각 t 씩 늘린다'고 할 때 늘어난 넓이를 구함", extra: "새 넓이 (a+t)(b+t) 에서 원래 넓이를 빼야 함(t 곱하기·한 변만 늘리기 같은 오답) — medium 은 새 넓이만",
      concepts: ["직사각형의 넓이", "변화량 비교"],
      gen(rng) {
        const [L, Wd] = dims(rng, 4, 16); const t = rng.int(2, 6); const v = quadNames(rng); const fig = rectFig(v, String(L), String(Wd)); const inc = (L + t) * (Wd + t) - L * Wd; const u = rng.pick(UNITS);
        return geoInst(rng, {
          stimulus: intro(rng, v, ` Each side length is increased by ${t} to make a larger rectangle.`, u), question: rng.pick([`By how much does the area increase?`, `How much larger is the area of the larger rectangle than the area of the original rectangle?`, `What is the increase in area?`]), correct: inc,
          wrongs: pos([W((L + t) * (Wd + t), "step_missing", "새 넓이를 답했다."), W(t * t, "formula_misuse", "t² 만 답했다."), W(t * (L + Wd), "step_missing", "t² 항을 빠뜨렸다."), W(L * t + Wd * t + 2 * t, "other", "계산 중 어긋났다."), W(inc + t, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== inc),
          verificationJs: figJs({ t }, fig, `${PG_JS}const a=side(V[0],V[1]), b=side(V[1],V[2]); if (!(a>0&&b>0)) throw new Error('변 라벨 없음'); return (a+P.t)*(b+P.t)-a*b;`),
          trace: [rd(v, String(L), String(Wd)), [`원래 넓이 = ${L} × ${Wd} = ${L * Wd} 이다.`, "The original area."], [`새 변은 ${L + t} 와 ${Wd + t} 이다.`, "Each side increases by t."], [`새 넓이 = ${(L + t) * (Wd + t)} 이다.`, "The larger area."], [`증가량 = ${(L + t) * (Wd + t)} - ${L * Wd} = ${inc} 이다.`, "Subtract."]], variant: "area_increase",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "area_from_sides", structure: "직사각형 두 변이 그림에 라벨될 때 넓이를 곱으로 구함", extra: "easy: 가로 × 세로", concepts: ["직사각형의 넓이", "문제 조건 해석"],
      gen(rng) {
        const [L, Wd] = dims(rng); const v = quadNames(rng); const fig = rectFig(v, String(L), String(Wd)); const A = L * Wd; const u = rng.pick(UNITS);
        return geoInst(rng, { stimulus: intro(rng, v, "", u), question: rng.pick([`What is the area of the rectangle?`, `What is the area of rectangle $${v.join("")}$?`]), correct: A, wrongs: pos([W(2 * (L + Wd), "formula_misuse", "둘레를 답했다."), W(L + Wd, "formula_misuse", "합을 답했다."), W(L * L, "step_missing", "한 변을 제곱했다."), W(A + L, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== A), verificationJs: figJs({}, fig, `${PG_JS}const a=side(V[0],V[1]), b=side(V[1],V[2]); if (!(a>0&&b>0)) throw new Error('변 라벨 없음'); return a*b;`), trace: [rd(v, String(L), String(Wd)), [`넓이 = ${L} × ${Wd} = ${A} 이다.`, "Area = length × width."]], variant: "area_two_sides" }, fig);
      },
    },
    {
      lv: "medium", name: "side_from_perimeter", structure: "직사각형의 한 변이 그림에 있고 둘레가 지문에 주어질 때 다른 변을 구함", extra: "medium: 둘레의 반에서 한 변을 뺌", concepts: ["둘레", "직사각형"],
      gen(rng) {
        const [L, Wd] = dims(rng); const v = quadNames(rng); const fig = rectFig(v, String(L)); const P2 = 2 * (L + Wd); const u = rng.pick(UNITS);
        return geoInst(rng, { stimulus: intro(rng, v, ` The perimeter of the rectangle is ${P2}.`, u), question: rng.pick([`What is the length of side $${v[1]}${v[2]}$?`, `What is the width of the rectangle?`]), correct: Wd, wrongs: pos([W(P2 - L, "step_missing", "한 변만 뺐다."), W(P2 / 2, "step_missing", "반둘레를 답했다."), W(P2 - 2 * L, "formula_misuse", "두 변만 뺐다."), W(Wd + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== Wd), verificationJs: figJs({ P2 }, fig, `${PG_JS}const a=side(V[0],V[1]); if (!(a>0)) throw new Error('변 라벨 없음'); return P.P2/2-a;`), trace: [[`그림에서 ${v[0]}${v[1]} = ${L} 이고 둘레 ${P2} 는 지문에서 안다.`, "Read one side; the perimeter is in the text."], [`둘레의 반 = ${P2} ÷ 2 = ${P2 / 2} 이다.`, "A rectangle's perimeter is twice the sum of two sides."], [`${v[1]}${v[2]} = ${P2 / 2} - ${L} = ${Wd} 이다.`, "Half the perimeter minus the known side."]], variant: "side_from_perimeter" }, fig);
      },
    },
  ],
});
void pickN;
