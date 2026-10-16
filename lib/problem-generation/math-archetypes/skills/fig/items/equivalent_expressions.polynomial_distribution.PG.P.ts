// equivalent_expressions.polynomial_distribution.PG.P — 직사각형 그림의 두 변이 x 의 일차식으로 라벨될 때 넓이를 분배·전개해 계수·값을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { PG_LEAD, quadNames, rectFig } from "../pg-kit";
import { retry } from "../ext-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isInteger(w.v));
/** a x + b 라벨(공백 포함): 3x + 2, x - 4. */
const lab = (a: number, b: number) => `${a === 1 ? "" : a}x${b > 0 ? ` + ${b}` : b < 0 ? ` - ${-b}` : ""}`;
const LIN_JS = "const lin=(l)=>{ const t=String(l).replace(/[\\s()]/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+)$/.exec(t); if (m) return {a:0,b:Number(m[1])}; throw new Error('변 라벨 형식 오류: '+l); }; const SLB=FIGURE.sideLabels||[]; const V=FIGURE.vertices; const sl=(a,b)=>{ const q=SLB.find(s=>s.label!==undefined&&((s.between[0]===a&&s.between[1]===b)||(s.between[0]===b&&s.between[1]===a))); if(!q) throw new Error('변 라벨 없음'); return q.label; }; const S1=lin(sl(V[0],V[1])), S2=lin(sl(V[1],V[2]));\n";
const prod = (p: { a: number; b: number }, q: { a: number; b: number }) => ({ A2: p.a * q.a, A1: p.a * q.b + p.b * q.a, A0: p.b * q.b });
const LEADS2 = [...PG_LEAD, "A carpenter is designing a tabletop. "];
const intro = (rng: Rng, v: string[], extra = "") => `${rng.pick(LEADS2)}${rng.pick([`The figure shows rectangle $${v.join("")}$ whose side lengths are given in terms of $x$.`, `Rectangle $${v.join("")}$ is shown in the figure, with its side lengths expressed using $x$.`, `In the figure, the length and width of rectangle $${v.join("")}$ are linear expressions in $x$.`, `The sides of rectangle $${v.join("")}$ in the figure are labeled with expressions that contain $x$.`])}${extra}`.replace(/ {2,}/g, " ").trim();
const FORM = (rng: Rng) => rng.pick([`The area of the rectangle can be written as $ax^2 + bx + c$, where $a$, $b$, and $c$ are constants.`, `When the area is expanded, it equals $ax^2 + bx + c$ for constants $a$, $b$, and $c$.`, `The area of the rectangle is equivalent to $ax^2 + bx + c$, where $a$, $b$, and $c$ are constants.`, `Written in standard form, the area is $ax^2 + bx + c$, with constants $a$, $b$, and $c$.`]);
function sides(rng: Rng, o: { aMax?: number } = {}): { p: { a: number; b: number }; q: { a: number; b: number } } {
  for (let t = 0; t < 60; t++) { const p = { a: rng.int(1, o.aMax ?? 4), b: rng.nz(-8, 9) }, q = { a: rng.int(1, o.aMax ?? 4), b: rng.nz(-8, 9) }; if (Math.abs(p.b) < 2 || Math.abs(q.b) < 2) continue; if (p.a === q.a && p.b === q.b) continue; return { p, q }; }
  throw new GenFail("변 표집");
}
const fig = (rng: Rng, p: { a: number; b: number }, q: { a: number; b: number }) => { const v = quadNames(rng); return { v, f: rectFig(v, lab(p.a, p.b), lab(q.a, q.b)) }; };

const RAW = defineItem({
  prefix: "ee", itemId: "equivalent_expressions.polynomial_distribution.PG.P",
  hard: [
    {
      op: "repr_shift", structure: "직사각형의 두 변이 (ax + b), (cx + d) 로 라벨된 그림에서 넓이를 분배·전개해 x 의 계수를 구함", extra: "넓이 = 두 변의 곱 으로 식을 세우고 x 항을 두 곳(ad·x 와 bc·x)에서 모아야 함(한 곳만 쓰면 오답) — medium 은 x² 의 계수",
      concepts: ["직사각형의 넓이", "다항식의 분배", "동류항 정리"],
      gen(rng) {
        const { p, q } = sides(rng); const { A1 } = prod(p, q); if (A1 === 0) throw new GenFail("0"); const { v, f } = fig(rng, p, q);
        return geoInst(rng, {
          stimulus: `${intro(rng, v)} ${FORM(rng)}`, question: rng.pick([`What is the value of $b$?`, `What is the coefficient of $x$ in the expanded area?`, `In the expanded form of the area, what is $b$?`]), correct: A1,
          wrongs: pos([W(p.a * q.b, "step_missing", "x 항 하나만 구했다."), W(p.b * q.a, "step_missing", "x 항 하나만 구했다."), W(p.a * q.a, "axis_misread", "x² 의 계수를 답했다."), W(p.b * q.b, "axis_misread", "상수항을 답했다."), W(p.a * q.b - p.b * q.a, "sign_error", "x 항을 빼서 구했다.")]).filter((w) => w.v !== A1),
          verificationJs: figJs({}, f, `${LIN_JS}return S1.a*S2.b+S1.b*S2.a;`),
          trace: [[`그림에서 두 변 ${lab(p.a, p.b)}, ${lab(q.a, q.b)} 를 읽는다.`, "Read the two side expressions."], [`넓이 = (${lab(p.a, p.b)})(${lab(q.a, q.b)}) 이다.`, "Area = length × width."], [`분배하면 x² 항 ${p.a * q.a}x², x 항 ${p.a * q.b}x + ${p.b * q.a}x, 상수항 ${p.b * q.b} 이다.`, "Distribute each term."], [`x 의 계수 = ${p.a * q.b} + (${p.b * q.a}) = ${A1} 이다.`, "Collect the x terms."], [`따라서 b = ${A1} 이다.`, "State b."]], variant: "x_coefficient_of_area",
        }, f);
      },
    },
    {
      op: "chain2", structure: "직사각형의 두 변이 일차식으로 라벨된 그림에서 x 의 값이 지문에 주어질 때 각 변에 대입한 뒤 넓이를 구함", extra: "각 변에 x 를 대입(음수 상수 주의)하고 곱해야 함(식을 전개한 뒤 계수만 더하면 오답) — medium 은 한 변만 대입",
      concepts: ["식의 대입", "직사각형의 넓이"],
      gen(rng) { return retry(rng, () => {
        const { p, q } = sides(rng, { aMax: 3 }); const t = rng.int(2, 9); const L = p.a * t + p.b, Wd = q.a * t + q.b; if (L <= 0 || Wd <= 0) throw new GenFail("음수 변"); const A = L * Wd; const { v, f } = fig(rng, p, q);
        return geoInst(rng, {
          stimulus: `${intro(rng, v)} The value of $x$ is ${t}.`, question: rng.pick([`What is the area of the rectangle?`, `What is the area of rectangle $${v.join("")}$ when $x = ${t}$?`, `How large is the area of the rectangle?`]), correct: A,
          wrongs: pos([W(L + Wd, "formula_misuse", "합을 답했다."), W(2 * (L + Wd), "formula_misuse", "둘레를 답했다."), W((p.a * q.a * t * t) + (p.b * q.b), "step_missing", "교차항을 빠뜨렸다."), W(L * Wd + t, "other", "계산 중 어긋났다."), W(L * q.a * t + Wd, "other", "한 변만 대입했다.")]).filter((w) => w.v !== A),
          verificationJs: figJs({ t }, f, `${LIN_JS}return (S1.a*P.t+S1.b)*(S2.a*P.t+S2.b);`),
          trace: [[`그림에서 두 변 ${lab(p.a, p.b)}, ${lab(q.a, q.b)} 를 읽는다.`, "Read the two side expressions."], [`x = ${t} 를 대입: ${lab(p.a, p.b)} = ${L}.`, "Substitute into the first side."], [`${lab(q.a, q.b)} = ${Wd}.`, "Substitute into the second side."], [`넓이 = ${L} × ${Wd} 이다.`, "Multiply."], [`따라서 ${A} 이다.`, "State the area."]], variant: "area_at_x_value",
        }, f);
      }); },
    },
    {
      op: "compose_kind", structure: "직사각형의 두 변이 일차식으로 라벨된 그림에서 넓이를 전개한 ax² + bx + c 의 계수의 합 a + b + c 를 구함", extra: "전개해 세 계수를 모두 구하고 더해야 함(x = 1 을 대입하면 빠르지만 일부만 더하면 오답) — medium 은 x 의 계수",
      concepts: ["다항식의 분배", "계수", "동류항 정리"],
      gen(rng) { return retry(rng, () => {
        const { p, q } = sides(rng); const { A2, A1, A0 } = prod(p, q); const S = A2 + A1 + A0; const { v, f } = fig(rng, p, q);
        return geoInst(rng, {
          stimulus: `${intro(rng, v)} ${FORM(rng)}`, question: rng.pick([`What is the value of $a + b + c$?`, `What is the sum of the three coefficients $a$, $b$, and $c$?`, `In the expanded area, what is $a + b + c$?`]), correct: S,
          wrongs: pos([W(A2 + A1, "step_missing", "상수항을 빠뜨렸다."), W(A2 + A0, "step_missing", "x 항을 빠뜨렸다."), W(p.a * q.b + p.b * q.a, "step_missing", "x 항만 답했다."), W(p.a * q.a + p.b * q.b + p.a * q.b, "step_missing", "x 항을 하나만 더했다."), W(S + (p.a + q.a), "other", "계산 중 어긋났다.")]).filter((w) => w.v !== S),
          verificationJs: figJs({}, f, `${LIN_JS}return (S1.a+S1.b)*(S2.a+S2.b);`),
          trace: [[`그림에서 두 변 ${lab(p.a, p.b)}, ${lab(q.a, q.b)} 를 읽는다.`, "Read the two sides."], [`넓이를 전개하면 ${A2}x² + ${A1}x + ${A0} 이다.`, "Expand the product."], [`a = ${A2}, b = ${A1}, c = ${A0} 이다.`, "Read the coefficients."], [`a + b + c = ${A2} + (${A1}) + (${A0}) 이다.`, "Add them."], [`따라서 ${S} 이다.`, "State the sum."]], variant: "sum_of_coefficients",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "직사각형의 한 변이 (ax + b), 다른 변이 (cx + k) 로 라벨되고 전개한 넓이가 지문에 주어질 때 x 의 계수 비교로 k 를 거꾸로 구함", extra: "넓이의 x 항 = a·k + b·c 로 식을 세워 k 를 역산해야 함(상수항 bk 만 보면 오답) — medium 은 x² 의 계수",
      concepts: ["다항식의 분배", "계수 비교", "일차방정식"],
      gen(rng) { return retry(rng, () => {
        const p = { a: rng.int(1, 4), b: rng.nz(-7, 8) }; const c = rng.int(1, 4); const k = rng.nz(-8, 9); if (Math.abs(p.b) < 2 || Math.abs(k) < 2) throw new GenFail("작음"); const { A2, A1, A0 } = prod(p, { a: c, b: k }); if (A1 === 0 || A0 === 0) throw new GenFail("0"); const v = quadNames(rng); const f = rectFig(v, lab(p.a, p.b), `${c === 1 ? "" : c}x + k`);
        const ex = (a: number, b: number, c2: number) => `${a}x^2 ${b >= 0 ? "+" : "-"} ${Math.abs(b)}x ${c2 >= 0 ? "+" : "-"} ${Math.abs(c2)}`;
        return geoInst(rng, {
          stimulus: `${intro(rng, v)} ${rng.pick([`The area of the rectangle is $${ex(A2, A1, A0)}$, and $k$ is a constant.`, `When the area is expanded, it equals $${ex(A2, A1, A0)}$. The constant $k$ appears in one of the side lengths.`, `The expanded area of the rectangle is $${ex(A2, A1, A0)}$, where $k$ is a constant.`, `Multiplying the side lengths gives the area $${ex(A2, A1, A0)}$, and $k$ is an unknown constant.`, `The rectangle's area, written in expanded form, is $${ex(A2, A1, A0)}$.`])}`, question: rng.pick([`What is the value of $k$?`, `In the figure shown, what is $k$?`, `Which value of $k$ is consistent with the given area?`, `Find the constant $k$ in the second side length.`, `What constant $k$ makes the area of the rectangle equal to the given expression?`]), correct: k,
          wrongs: pos([W(A0 / p.b === k ? k + 1 : Math.round(A0 / p.b), "step_missing", "상수항만 보고 구했다."), W(A1, "axis_misread", "x 의 계수를 답했다."), W(A0, "axis_misread", "상수항을 답했다."), W(-k, "sign_error", "부호를 바꿨다."), W(k + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== k),
          verificationJs: figJs({ A1, A0 }, f, `const lin=(l)=>{ const t=String(l).replace(/[\\s()]/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; throw new Error('형식 오류'); }; const SLB=FIGURE.sideLabels; const V=FIGURE.vertices; const sl=(a,b)=>SLB.find(s=>(s.between[0]===a&&s.between[1]===b)||(s.between[0]===b&&s.between[1]===a)).label; const S1=lin(sl(V[0],V[1])); const m2=/^(\\d*)x\\+k$/.exec(String(sl(V[1],V[2])).replace(/\\s/g,'')); if (!m2) throw new Error('둘째 변 형식'); const c=m2[1]===''?1:Number(m2[1]); const k=(P.A1-S1.b*c)/S1.a; if (!Number.isInteger(k)) throw new Error('k 정수 아님'); if (S1.b*k!==P.A0) throw new Error('상수항 불일치'); return k;`),
          trace: [[`그림에서 변 ${lab(p.a, p.b)} 와 ${c === 1 ? "" : c}x + k 를 읽는다.`, "Read the side expressions."], [`넓이 = (${lab(p.a, p.b)})(${c === 1 ? "" : c}x + k) 를 전개한다.`, "Expand the product."], [`x 항: ${p.a}k + ${p.b * c} = ${A1} 이다.`, "Compare the x coefficients."], [`${p.a}k = ${A1 - p.b * c} 이므로 k = ${k} 이다.`, "Solve for k."], [`상수항 ${p.b}·${k} = ${A0} 으로 확인한다.`, "Check with the constant term."]], variant: "unknown_constant_from_area",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "constant_term", structure: "직사각형의 두 변이 일차식으로 라벨된 그림에서 넓이를 전개한 상수항을 구함", extra: "easy: 두 상수항의 곱", concepts: ["다항식의 분배", "상수항"],
      gen(rng) { return retry(rng, () => {
        const { p, q } = sides(rng); const { v, f } = fig(rng, p, q); const A0 = p.b * q.b;
        return geoInst(rng, { stimulus: `${intro(rng, v)} ${FORM(rng)}`, question: rng.pick([`What is the value of $c$?`, `What is the constant term of the expanded area?`]), correct: A0, wrongs: pos([W(p.b + q.b, "formula_misuse", "상수항을 더했다."), W(p.a * q.a, "axis_misread", "x² 의 계수를 답했다."), W(p.a * q.b + p.b * q.a, "axis_misread", "x 의 계수를 답했다."), W(-A0, "sign_error", "부호를 바꿨다.")]).filter((w) => w.v !== A0), verificationJs: figJs({}, f, `${LIN_JS}return S1.b*S2.b;`), trace: [[`그림에서 두 변 ${lab(p.a, p.b)}, ${lab(q.a, q.b)} 를 읽는다.`, "Read the two sides."], [`상수항은 두 변의 상수항의 곱 (${p.b})(${q.b}) = ${A0} 이다.`, "Multiply the constant terms."]], variant: "constant_term_of_area" }, f);
      }); },
    },
    {
      lv: "medium", name: "constant_and_x", structure: "직사각형의 두 변이 (x + p), (x + q) 로 라벨된 그림에서 넓이를 전개한 x 의 계수를 구함", extra: "medium: p + q", concepts: ["다항식의 분배", "동류항 정리"],
      gen(rng) { return retry(rng, () => {
        const p = { a: 1, b: rng.nz(-9, 9) }, q = { a: 1, b: rng.nz(-9, 9) }; if (Math.abs(p.b) < 2 || Math.abs(q.b) < 2 || p.b === q.b || p.b + q.b === 0) throw new GenFail("범위"); const { v, f } = fig(rng, p, q); const B = p.b + q.b;
        return geoInst(rng, { stimulus: `${intro(rng, v)} ${FORM(rng)}`, question: rng.pick([`What is the value of $b$?`, `What is the coefficient of $x$ in the expanded area?`]), correct: B, wrongs: pos([W(p.b * q.b, "axis_misread", "상수항을 답했다."), W(p.b - q.b, "sign_error", "차를 답했다."), W(1, "axis_misread", "x² 의 계수를 답했다."), W(B + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== B), verificationJs: figJs({}, f, `${LIN_JS}return S1.a*S2.b+S1.b*S2.a;`), trace: [[`그림에서 두 변 ${lab(1, p.b)}, ${lab(1, q.b)} 를 읽는다.`, "Read the two sides."], [`전개하면 x² + (${p.b} + ${q.b})x + ${p.b * q.b} 이다.`, "Expand."], [`x 의 계수 = ${B} 이다.`, "Collect the x terms."]], variant: "x_coefficient_monic" }, f);
      }); },
    },
  ],
});
export const ITEM = RAW;
