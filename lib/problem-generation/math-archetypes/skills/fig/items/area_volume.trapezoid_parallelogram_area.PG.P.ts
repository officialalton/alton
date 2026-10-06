// area_volume.trapezoid_parallelogram_area.PG.P — 사다리꼴·평행사변형 그림의 밑변·높이·다리 라벨에서 넓이·높이·미지 밑변을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { PG_JS, PG_LEAD, UNITS, parFig, quadNames, trapFig } from "../pg-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0);
const I = (rng: Rng, v: string[], k: "trap" | "par", extra = "", unit = "") => `${rng.pick(PG_LEAD)}${rng.pick(k === "trap" ? [`The figure shows trapezoid $${v.join("")}$ with $${v[0]}${v[1]}$ parallel to $${v[3]}${v[2]}$.`, `Trapezoid $${v.join("")}$ in the figure has bases $${v[0]}${v[1]}$ and $${v[3]}${v[2]}$.`, `In the figure, $${v[0]}${v[1]} \\\\parallel ${v[3]}${v[2]}$ in trapezoid $${v.join("")}$.`.replace("\\\\parallel", "is parallel to")] : [`The figure shows parallelogram $${v.join("")}$.`, `Parallelogram $${v.join("")}$ is shown in the figure.`, `In the figure shown, $${v.join("")}$ is a parallelogram.`])}${extra} ${unit}`.replace(/ {2,}/g, " ").trim();
const QA = (rng: Rng, v: string[]) => rng.pick([`What is the area of the figure?`, `What is the area of $${v.join("")}$?`, `How large is the area of the shape shown?`]);
const T3 = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [12, 16, 20]];

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.trapezoid_parallelogram_area.PG.P",
  hard: [
    {
      op: "compose_kind", structure: "사다리꼴의 두 밑변과 높이가 그림에 라벨될 때 넓이 ½(b₁ + b₂)h 를 구함", extra: "두 밑변을 더해 반으로 하고 높이를 곱해야 함(밑변 하나만 쓰거나 합을 곱하면 오답) — medium 은 평행사변형",
      concepts: ["사다리꼴의 넓이", "밑변·높이"],
      gen(rng) {
        const b1 = rng.int(10, 24), b2 = rng.int(5, b1 - 3), h = rng.int(4, 12); const S = b1 + b2; if ((S * h) % 2) throw new GenFail("홀수"); const A = (S * h) / 2; const v = quadNames(rng); const fig = trapFig(v, { ab: String(b1), dc: String(b2), h: String(h) }); const u = rng.pick(UNITS);
        return geoInst(rng, {
          stimulus: I(rng, v, "trap", "", u), question: QA(rng, v), correct: A,
          wrongs: pos([W(S * h, "step_missing", "½ 을 빠뜨렸다."), W(b1 * h, "formula_misuse", "긴 밑변만 썼다."), W(b2 * h, "formula_misuse", "짧은 밑변만 썼다."), W((b1 * b2 * h) / 2, "formula_misuse", "밑변을 곱했다."), W(A + h, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== A),
          verificationJs: figJs({}, fig, `${PG_JS}const b1=side(V[0],V[1]), b2=side(V[3],V[2]); if (!(b1>0&&b2>0&&HT>0)) throw new Error('밑변·높이 라벨 없음'); if (FIGURE.kind!=='trapezoid') throw new Error('사다리꼴 아님'); return (b1+b2)*HT/2;`),
          trace: [[`그림에서 밑변 ${b1}, ${b2} 와 높이 ${h} 를 읽는다.`, "Read the bases and the height."], [`두 밑변의 합 = ${b1} + ${b2} = ${S} 이다.`, "Add the bases."], [`넓이 = ½ × ${S} × ${h} 이다.`, "Trapezoid area = ½(b₁ + b₂)h."], [`= ${A} 이다.`, "Compute."], [`따라서 ${A} 이다.`, "State the area."]], variant: "trapezoid_area",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "이등변사다리꼴의 두 밑변과 다리가 그림에 라벨되었을 때 피타고라스로 높이를 구한 뒤 넓이를 구함", extra: "밑변의 차 ÷ 2 와 다리로 높이(피타고라스)를 구하고 넓이 공식에 넣어야 함(다리를 높이로 쓰면 오답) — medium 은 높이가 주어짐",
      concepts: ["사다리꼴의 넓이", "피타고라스 정리", "높이"],
      gen(rng) {
        const [off, h, leg] = rng.pick(T3 as number[][]); const k = rng.pick([1, 1, 2]); const o = off * k, hh = h * k, lg = leg * k; const b2 = rng.int(5, 16); const b1 = b2 + 2 * o; if (b1 > 40 || lg > 30) throw new GenFail("큼"); const S = b1 + b2; if ((S * hh) % 2) throw new GenFail("홀수"); const A = (S * hh) / 2; const v = quadNames(rng); const fig = trapFig(v, { ab: String(b1), dc: String(b2), leg: String(lg) });
        return geoInst(rng, {
          stimulus: I(rng, v, "trap", " The two legs have equal length."), question: QA(rng, v), correct: A,
          wrongs: pos([W((S * lg) / 2, "formula_misuse", "다리를 높이로 썼다."), W(S * hh, "step_missing", "½ 을 빠뜨렸다."), W((b1 * hh) / 2, "formula_misuse", "긴 밑변만 썼다."), W(A + hh, "other", "계산 중 어긋났다."), W(hh, "step_missing", "높이만 답했다.")]).filter((w) => w.v !== A),
          verificationJs: figJs({}, fig, `${PG_JS}const b1=side(V[0],V[1]), b2=side(V[3],V[2]), lg=side(V[1],V[2]); if (!(b1>b2&&b2>0&&lg>0)) throw new Error('라벨 오류'); const o=(b1-b2)/2; const h=Math.sqrt(lg*lg-o*o); if (Math.abs(h-Math.round(h))>1e-9) throw new Error('정수 높이 아님'); return (b1+b2)*Math.round(h)/2;`),
          trace: [[`그림에서 밑변 ${b1}, ${b2} 와 다리 ${lg}(양쪽 같음)를 읽는다.`, "Read the bases and the leg."], [`밑변의 차의 반 = (${b1} - ${b2}) ÷ 2 = ${o} 이다.`, "Each overhang is half the difference of the bases."], [`높이² = ${lg}² - ${o}² = ${hh * hh} 이므로 높이 = ${hh} 이다.`, "Pythagorean theorem for the height."], [`넓이 = ½ × (${b1} + ${b2}) × ${hh} 이다.`, "Trapezoid area."], [`따라서 ${A} 이다.`, "State the area."]], variant: "isosceles_trapezoid_area",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "사다리꼴의 긴 밑변과 높이가 그림에 있고 '긴 밑변이 짧은 밑변의 k 배'가 지문에 주어질 때 비를 식으로 옮겨 짧은 밑변을 구한 뒤 넓이를 구함", extra: "k 배 관계로 짧은 밑변을 구하고 넓이 공식에 넣어야 함(방향을 거꾸로 읽으면 오답) — medium 은 두 밑변이 주어짐",
      concepts: ["사다리꼴의 넓이", "비", "문장의 식 번역"],
      gen(rng) {
        const k = rng.pick([2, 3, 4]); const b2 = rng.int(3, 8), b1 = k * b2; const h = rng.int(4, 10); const S = b1 + b2; if ((S * h) % 2) throw new GenFail("홀수"); const A = (S * h) / 2; const v = quadNames(rng); const fig = trapFig(v, { ab: String(b1), h: String(h) }); const word = k === 2 ? "twice" : k === 3 ? "three times" : "four times";
        return geoInst(rng, {
          stimulus: I(rng, v, "trap", ` The base $${v[0]}${v[1]}$ is ${word} the length of base $${v[3]}${v[2]}$.`), question: QA(rng, v), correct: A,
          wrongs: pos([W(b1 * h, "formula_misuse", "긴 밑변만 썼다."), W(((b1 + b1 * k) * h) / 2, "formula_misuse", "배수 방향을 거꾸로 읽었다."), W(S * h, "step_missing", "½ 을 빠뜨렸다."), W(A + b2, "other", "계산 중 어긋났다."), W((b1 * h) / 2, "formula_misuse", "긴 밑변의 반만 썼다.")]).filter((w) => w.v !== A),
          verificationJs: figJs({ k }, fig, `${PG_JS}const b1=side(V[0],V[1]); if (!(b1>0&&HT>0)) throw new Error('라벨 없음'); return (b1+b1/P.k)*HT/2;`),
          trace: [[`그림에서 긴 밑변 ${v[0]}${v[1]} = ${b1}, 높이 ${h} 를 읽고 지문에서 긴 밑변 = ${k} × 짧은 밑변 이다.`, "Read the long base and the height; the text gives the ratio."], [`짧은 밑변 = ${b1} ÷ ${k} = ${b2} 이다.`, "Find the short base."], [`두 밑변의 합 = ${S} 이다.`, "Add the bases."], [`넓이 = ½ × ${S} × ${h} = ${A} 이다.`, "Trapezoid area."], [`따라서 ${A} 이다.`, "State the area."]], variant: "trapezoid_from_ratio",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "사다리꼴의 넓이가 지문에 주어지고 두 밑변이 그림에 있을 때 높이 h 를 거꾸로 구함", extra: "넓이 = ½(b₁ + b₂)h 에서 h = 2A ÷ (b₁ + b₂) 를 구해야 함(2 를 빠뜨리면 오답) — medium 은 넓이를 구하는 문제",
      concepts: ["사다리꼴의 넓이", "역산"],
      gen(rng) {
        const b1 = rng.int(10, 24), b2 = rng.int(5, b1 - 3), h = rng.int(4, 12); const S = b1 + b2; if ((S * h) % 2) throw new GenFail("홀수"); const A = (S * h) / 2; const v = quadNames(rng); const fig = trapFig(v, { ab: String(b1), dc: String(b2), h: "h" });
        return geoInst(rng, {
          stimulus: I(rng, v, "trap", ` The area of the trapezoid is ${A}. The height is labeled $h$.`), question: rng.pick([`What is the value of $h$?`, `What is the height $h$ of the trapezoid?`, `In the figure shown, what is $h$?`]), correct: h,
          wrongs: pos([W(A / S, "formula_misuse", "2 를 곱하지 않았다."), W(A, "step_missing", "넓이를 답했다."), W((2 * A) / b1, "formula_misuse", "긴 밑변만 썼다."), W(h + 2, "other", "계산 중 어긋났다."), W(S, "other", "밑변의 합을 답했다.")]).filter((w) => w.v !== h),
          verificationJs: figJs({ A }, fig, `${PG_JS}const b1=side(V[0],V[1]), b2=side(V[3],V[2]); if (!(b1>0&&b2>0)) throw new Error('밑변 라벨 없음'); return 2*P.A/(b1+b2);`),
          trace: [[`그림에서 밑변 ${b1}, ${b2} 를 읽고 넓이 ${A} 는 지문에서 안다.`, "Read the bases; the area is in the text."], [`두 밑변의 합 = ${S} 이다.`, "Add the bases."], [`${A} = ½ × ${S} × h 이다.`, "Set up the area equation."], [`h = 2 × ${A} ÷ ${S} = ${h} 이다.`, "Solve for h."], [`따라서 ${h} 이다.`, "State the height."]], variant: "height_from_trapezoid_area",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "parallelogram_area", structure: "평행사변형의 밑변과 높이가 그림에 라벨될 때 넓이를 곱으로 구함", extra: "easy: 밑변 × 높이", concepts: ["평행사변형의 넓이"],
      gen(rng) {
        const b = rng.int(6, 24), h = rng.int(4, 14); const A = b * h; const v = quadNames(rng); const fig = parFig(v, { ab: String(b), h: String(h) });
        return geoInst(rng, { stimulus: I(rng, v, "par"), question: QA(rng, v), correct: A, wrongs: pos([W(2 * (b + h), "formula_misuse", "둘레를 답했다."), W(b + h, "formula_misuse", "합을 답했다."), W(A / 2, "step_missing", "반으로 나누었다."), W(A + b, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== A), verificationJs: figJs({}, fig, `${PG_JS}const b=side(V[0],V[1]); if (!(b>0&&HT>0)) throw new Error('밑변·높이 라벨 없음'); return b*HT;`), trace: [[`그림에서 밑변 ${b}, 높이 ${h} 를 읽는다.`, "Read the base and the height."], [`넓이 = ${b} × ${h} = ${A} 이다.`, "Parallelogram area = base × height."]], variant: "parallelogram_area_easy" }, fig);
      },
    },
    {
      lv: "medium", name: "parallelogram_slant_side", structure: "평행사변형의 밑변·비스듬한 변·높이가 모두 그림에 있을 때 높이를 써서 넓이를 구함(비스듬한 변은 쓰지 않음)", extra: "medium: 밑변 × 높이 (비스듬한 변이 함정)", concepts: ["평행사변형의 넓이", "높이"],
      gen(rng) {
        const b = rng.int(6, 22), h = rng.int(4, 12), s = h + rng.int(2, 6); const A = b * h; const v = quadNames(rng); const fig = parFig(v, { ab: String(b), ad: String(s), h: String(h) });
        return geoInst(rng, { stimulus: I(rng, v, "par"), question: QA(rng, v), correct: A, wrongs: pos([W(b * s, "formula_misuse", "비스듬한 변을 높이로 썼다."), W(2 * (b + s), "formula_misuse", "둘레를 답했다."), W((b * h) / 2, "step_missing", "반으로 나누었다."), W(A + s, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== A), verificationJs: figJs({}, fig, `${PG_JS}const b=side(V[0],V[1]); if (!(b>0&&HT>0)) throw new Error('밑변·높이 라벨 없음'); return b*HT;`), trace: [[`그림에서 밑변 ${b}, 비스듬한 변 ${s}, 높이 ${h} 를 읽는다.`, "Read all three labels."], [`넓이는 밑변 × 높이(수직 거리) = ${b} × ${h} 이고 비스듬한 변은 쓰지 않는다.`, "Use the perpendicular height, not the slanted side."], [`따라서 ${A} 이다.`, "State the area."]], variant: "parallelogram_area_slant_trap" }, fig);
      },
    },
  ],
});
