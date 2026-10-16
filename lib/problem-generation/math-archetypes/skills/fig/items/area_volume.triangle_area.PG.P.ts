// area_volume.triangle_area.PG.P — 사각형(직사각형·평행사변형) 그림에 대각선으로 생긴 삼각형 ABC 의 넓이를 변·높이·대각선 라벨에서 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { PG_JS, PG_LEAD, UNITS, parFig, quadNames, rectFig } from "../pg-kit";
import { TRIPLES } from "../tri-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const kindWord = (k: "rect" | "par") => (k === "rect" ? "rectangle" : "parallelogram");
const intro = (rng: Rng, v: string[], k: "rect" | "par", extra = "", unit = "") => `${rng.pick(PG_LEAD)}${rng.pick([`The figure shows ${kindWord(k)} $${v.join("")}$ with diagonal $${v[0]}${v[2]}$ drawn, which forms triangle $${v[0]}${v[1]}${v[2]}$.`, `In the figure, diagonal $${v[0]}${v[2]}$ of ${kindWord(k)} $${v.join("")}$ divides it into two triangles.`, `${kindWord(k)[0].toUpperCase()}${kindWord(k).slice(1)} $${v.join("")}$ is shown with its diagonal $${v[0]}${v[2]}$.`, `The ${kindWord(k)} $${v.join("")}$ in the figure is split by diagonal $${v[0]}${v[2]}$ into triangles $${v[0]}${v[1]}${v[2]}$ and $${v[0]}${v[2]}${v[3]}$.`])}${extra} ${unit}`.replace(/ {2,}/g, " ").trim();
const QT = (rng: Rng, v: string[]) => rng.pick([`What is the area of triangle $${v[0]}${v[1]}${v[2]}$?`, `What is the area of triangle $${v[0]}${v[1]}${v[2]}$ formed by the diagonal?`, `How large is the area of triangle $${v[0]}${v[1]}${v[2]}$?`]);
const diagOf = (v: string[], label?: string) => ({ between: [v[0], v[2]] as [string, string], ...(label ? { label } : {}) });
const half = (n: number) => n / 2;

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.triangle_area.PG.P",
  hard: [
    {
      op: "compose_kind", structure: "평행사변형의 밑변과 높이가 그림에 라벨되고 대각선이 그려졌을 때 대각선이 만드는 삼각형 ABC 의 넓이를 구함", extra: "삼각형의 밑변·높이가 평행사변형과 같다는 것을 알아 반으로 나눠야 함(평행사변형의 넓이를 답하거나 비스듬한 변을 쓰면 오답) — medium 은 직사각형",
      concepts: ["평행사변형의 넓이", "삼각형의 넓이", "대각선"],
      gen(rng) {
        const b = rng.int(6, 24), h = rng.int(4, 14); const T = (b * h) / 2; if (!Number.isInteger(T) && (b * h) % 2) throw new GenFail("홀수"); const v = quadNames(rng); const fig = parFig(v, { ab: String(b), h: String(h), diag: diagOf(v) }); const u = rng.pick(UNITS);
        return geoInst(rng, {
          stimulus: intro(rng, v, "par", "", u), question: QT(rng, v), correct: T,
          wrongs: pos([W(b * h, "step_missing", "평행사변형의 넓이를 답했다."), W(b + h, "formula_misuse", "합을 답했다."), W(half(b * h) + h, "other", "계산 중 어긋났다."), W((b * h) / 3, "formula_misuse", "3 으로 나누었다."), W(T + b, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== T),
          verificationJs: figJs({}, fig, `${PG_JS}const b=side(V[0],V[1]); if (!(b>0&&HT>0)) throw new Error('밑변·높이 라벨 없음'); if (FIGURE.kind!=='parallelogram') throw new Error('평행사변형 아님'); return b*HT/2;`),
          trace: [[`그림에서 밑변 ${v[0]}${v[1]} = ${b}, 높이 = ${h} 를 읽는다.`, "Read the base and the height."], [`평행사변형의 넓이 = ${b} × ${h} = ${b * h} 이다.`, "Parallelogram area = base × height."], [`대각선 ${v[0]}${v[2]} 는 평행사변형을 합동인 두 삼각형으로 나눈다.`, "A diagonal splits a parallelogram into two congruent triangles."], [`삼각형 ${v[0]}${v[1]}${v[2]} 의 넓이 = ${b * h} ÷ 2 = ${T} 이다.`, "Triangle area is half."], [`따라서 ${T} 이다.`, "State the area."]], variant: "triangle_from_parallelogram",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "직사각형의 한 변과 대각선이 그림에 라벨되었을 때 피타고라스로 다른 변을 구한 뒤 대각선이 만드는 직각삼각형 ABC 의 넓이를 구함", extra: "대각선 → 다른 변(피타고라스) → ½ × 두 변 의 연쇄(대각선을 변으로 쓰면 오답) — medium 은 평행사변형",
      concepts: ["피타고라스 정리", "직각삼각형의 넓이", "대각선"],
      gen(rng) {
        const [x, y, z] = rng.pick(TRIPLES); const k = rng.pick([1, 1, 2]); const a = x * k, c = y * k, d = z * k; if (d > 50) throw new GenFail("큼"); const [L, Wd] = rng.chance(0.5) ? [a, c] : [c, a]; const T = (L * Wd) / 2; if ((L * Wd) % 2) throw new GenFail("홀수"); const v = quadNames(rng);
        const fig = rectFig(v, String(L), undefined); (fig as unknown as { diagonals: unknown[] }).diagonals = [diagOf(v, String(d))]; const u = rng.pick(UNITS);
        return geoInst(rng, {
          stimulus: intro(rng, v, "rect", "", u), question: QT(rng, v), correct: T,
          wrongs: pos([W(L * Wd, "step_missing", "직사각형의 넓이를 답했다."), W((L * d) / 2, "formula_misuse", "대각선을 변으로 썼다."), W(Wd, "step_missing", "다른 변만 답했다."), W((L + Wd) / 2, "formula_misuse", "합의 반을 답했다."), W(T + L, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== T),
          verificationJs: figJs({}, fig, `${PG_JS}const L=side(V[0],V[1]), D=dg(V[0],V[2]); if (!(L>0&&D>L)) throw new Error('라벨 오류'); const o=Math.sqrt(D*D-L*L); if (Math.abs(o-Math.round(o))>1e-9) throw new Error('정수 변 아님'); return L*Math.round(o)/2;`),
          trace: [[`그림에서 ${v[0]}${v[1]} = ${L}, 대각선 ${v[0]}${v[2]} = ${d} 를 읽는다.`, "Read the side and the diagonal."], [`삼각형 ${v[0]}${v[1]}${v[2]} 는 ${v[1]} 에서 직각이다.`, "Triangle ABC has a right angle at B."], [`${v[1]}${v[2]}² = ${d}² - ${L}² = ${Wd * Wd} 이므로 ${v[1]}${v[2]} = ${Wd} 이다.`, "Find the other leg with the Pythagorean theorem."], [`넓이 = ½ × ${L} × ${Wd} 이다.`, "Area of a right triangle."], [`따라서 ${T} 이다.`, "State the area."]], variant: "right_triangle_from_diagonal",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "직사각형의 한 변이 그림에 있고 'AB 가 BC 의 k 배'가 지문에 주어질 때 비를 식으로 옮겨 다른 변을 구한 뒤 삼각형 ABC 의 넓이를 구함", extra: "k 배 관계로 다른 변을 구하고 ½ × 두 변 을 해야 함(배수 방향을 거꾸로 읽으면 오답) — medium 은 두 변이 주어짐",
      concepts: ["직사각형", "비", "삼각형의 넓이"],
      gen(rng) {
        const k = rng.pick([2, 3, 4]); const Wd = rng.int(3, 10), L = k * Wd; if (L > 36) throw new GenFail("큼"); if ((L * Wd) % 2) throw new GenFail("홀수"); const T = (L * Wd) / 2; const v = quadNames(rng); const fig = rectFig(v, String(L)); (fig as unknown as { diagonals: unknown[] }).diagonals = [diagOf(v)]; const word = k === 2 ? "twice" : k === 3 ? "three times" : "four times";
        return geoInst(rng, {
          stimulus: intro(rng, v, "rect", ` The length $${v[0]}${v[1]}$ is ${word} the width $${v[1]}${v[2]}$.`), question: QT(rng, v), correct: T,
          wrongs: pos([W(L * Wd, "step_missing", "직사각형의 넓이를 답했다."), W((L * L * k) / 2, "formula_misuse", "배수 방향을 거꾸로 읽었다."), W((L * L) / 2, "step_missing", "한 변만 썼다."), W(T + Wd, "other", "계산 중 어긋났다."), W((L + Wd) / 2, "formula_misuse", "합의 반을 답했다.")]).filter((w) => w.v !== T),
          verificationJs: figJs({ k }, fig, `${PG_JS}const L=side(V[0],V[1]); if (!(L>0)) throw new Error('변 라벨 없음'); return L*(L/P.k)/2;`),
          trace: [[`그림에서 ${v[0]}${v[1]} = ${L} 를 읽고 지문에서 길이 = ${k} × 너비 이다.`, "Read the length; the text gives the ratio."], [`너비 ${v[1]}${v[2]} = ${L} ÷ ${k} = ${Wd} 이다.`, "Find the width."], [`삼각형 ${v[0]}${v[1]}${v[2]} 는 두 변이 ${L}, ${Wd} 인 직각삼각형이다.`, "A right triangle with those legs."], [`넓이 = ½ × ${L} × ${Wd} = ${T} 이다.`, "Area = ½ × leg × leg."], [`따라서 ${T} 이다.`, "State the area."]], variant: "triangle_from_ratio",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "삼각형 ABC 의 넓이가 지문에 주어지고 평행사변형의 밑변이 그림에 있을 때 높이를 거꾸로 구함", extra: "삼각형 넓이 = ½ × 밑변 × 높이 에서 높이 = 2 × 넓이 ÷ 밑변 을 구해야 함(2 를 빠뜨리면 오답) — medium 은 넓이를 구하는 문제",
      concepts: ["삼각형의 넓이", "평행사변형", "역산"],
      gen(rng) {
        const b = rng.int(6, 20), h = rng.int(4, 14); const T = (b * h) / 2; if ((b * h) % 2) throw new GenFail("홀수"); const v = quadNames(rng); const fig = parFig(v, { ab: String(b), h: "h", diag: diagOf(v) });
        return geoInst(rng, {
          stimulus: intro(rng, v, "par", ` The area of triangle $${v[0]}${v[1]}${v[2]}$ is ${T}. The height from $${v[3]}$ to $${v[0]}${v[1]}$ is labeled $h$.`), question: rng.pick([`What is the value of $h$?`, `What is the height $h$?`, `In the figure shown, what is $h$?`]), correct: h,
          wrongs: pos([W(T / b, "formula_misuse", "2 를 곱하지 않았다."), W(T, "step_missing", "넓이를 답했다."), W(2 * T, "formula_misuse", "넓이의 두 배를 답했다."), W(h + 2, "other", "계산 중 어긋났다."), W(b, "other", "밑변을 답했다.")]).filter((w) => w.v !== h),
          verificationJs: figJs({ T }, fig, `${PG_JS}const b=side(V[0],V[1]); if (!(b>0)) throw new Error('밑변 라벨 없음'); return 2*P.T/b;`),
          trace: [[`그림에서 밑변 ${v[0]}${v[1]} = ${b} 이고 삼각형 넓이 ${T} 는 지문에서 안다.`, "Read the base; the triangle's area is in the text."], [`삼각형의 밑변·높이는 평행사변형과 같다: ½ × ${b} × h = ${T} 이다.`, "The triangle shares the base and height of the parallelogram."], [`h = 2 × ${T} ÷ ${b} 이다.`, "Solve for h."], [`h = ${h} 이다.`, "Compute."], [`따라서 ${h} 이다.`, "State the height."]], variant: "height_from_triangle_area",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "rectangle_half", structure: "직사각형의 두 변이 그림에 있을 때 대각선이 만드는 삼각형 ABC 의 넓이를 반으로 구함", extra: "easy: ½ × 두 변", concepts: ["삼각형의 넓이", "직사각형"],
      gen(rng) {
        const L = rng.int(4, 20), Wd = rng.int(3, 14); if ((L * Wd) % 2 || L === Wd) throw new GenFail("범위"); const T = (L * Wd) / 2; const v = quadNames(rng); const fig = rectFig(v, String(L), String(Wd)); (fig as unknown as { diagonals: unknown[] }).diagonals = [diagOf(v)];
        return geoInst(rng, { stimulus: intro(rng, v, "rect"), question: QT(rng, v), correct: T, wrongs: pos([W(L * Wd, "step_missing", "직사각형의 넓이를 답했다."), W(L + Wd, "formula_misuse", "합을 답했다."), W((L + Wd) / 2, "formula_misuse", "합의 반을 답했다."), W(T + L, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== T), verificationJs: figJs({}, fig, `${PG_JS}const a=side(V[0],V[1]), b=side(V[1],V[2]); if (!(a>0&&b>0)) throw new Error('변 라벨 없음'); return a*b/2;`), trace: [[`그림에서 ${v[0]}${v[1]} = ${L}, ${v[1]}${v[2]} = ${Wd} 를 읽는다.`, "Read the two sides."], [`삼각형 ${v[0]}${v[1]}${v[2]} 의 넓이 = ½ × ${L} × ${Wd} = ${T} 이다.`, "Right triangle: half of the rectangle."]], variant: "triangle_half_rectangle" }, fig);
      },
    },
    {
      lv: "medium", name: "parallelogram_half", structure: "평행사변형의 밑변·높이가 그림에 있을 때 대각선이 만드는 삼각형 ABC 의 넓이를 구함", extra: "medium: 평행사변형 넓이의 반", concepts: ["삼각형의 넓이", "평행사변형"],
      gen(rng) {
        const b = rng.int(6, 22), h = rng.int(4, 14); if ((b * h) % 2) throw new GenFail("홀수"); const T = (b * h) / 2; const v = quadNames(rng); const fig = parFig(v, { ab: String(b), h: String(h), diag: diagOf(v) });
        return geoInst(rng, { stimulus: intro(rng, v, "par"), question: QT(rng, v), correct: T, wrongs: pos([W(b * h, "step_missing", "평행사변형의 넓이를 답했다."), W(b + h, "formula_misuse", "합을 답했다."), W(T + h, "other", "계산 중 어긋났다."), W(b * h / 3, "formula_misuse", "3 으로 나누었다.")]).filter((w) => w.v !== T), verificationJs: figJs({}, fig, `${PG_JS}const b=side(V[0],V[1]); if (!(b>0&&HT>0)) throw new Error('밑변·높이 라벨 없음'); return b*HT/2;`), trace: [[`그림에서 밑변 ${b}, 높이 ${h} 를 읽는다.`, "Read the base and the height."], [`평행사변형의 넓이 = ${b} × ${h} = ${b * h} 이다.`, "Parallelogram area."], [`삼각형의 넓이 = ${b * h} ÷ 2 = ${T} 이다.`, "Half of it."]], variant: "triangle_half_parallelogram" }, fig);
      },
    },
  ],
});
