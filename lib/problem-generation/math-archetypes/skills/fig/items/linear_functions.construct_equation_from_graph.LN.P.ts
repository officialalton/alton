// linear_functions.construct_equation_from_graph.LN.P — 그래프로 주어진 일차 관계의 식을 세운다(카탈로그 부록 B 신규 패턴: 자료 → 식).
// 식 선지는 evalAt 의 그래프 밖 점에서 값으로 비교한다(정답 재계산은 FIGURE 에서 세운 식을 같은 점에서 평가).
import { GenFail } from "../../../types";
import { fmtNum, lin } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst, capFirst, sing, convNote, GL_JS, glIntercept, glIntro, glRead, makeLinGraph, offXg, type LinGraph } from "../graph-kit";

const EXPR_ONLY = "정답이 식(문자를 포함한 표현)이라 그리드 입력 숫자로 낼 수 없다";
const M = (s: string) => `$${s}$`;
const T = (e: string, kind: "formula_misuse" | "sign_error" | "unit_error" | "step_missing" | "other", reason: string) => ({ text: M(e), kind, reason });

export const ITEM = defineItem({
  prefix: "lf", itemId: "linear_functions.construct_equation_from_graph.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "y 절편이 격자점이 아닌 그래프에서 기울기와 절편을 모두 구해 y 를 x 의 식으로 나타냄", extra: "두 점으로 기울기, 거슬러 계산으로 절편을 구해 식으로 바꿔야 함(첫 점의 값을 절편으로 쓰거나 두 점 사이의 변화를 기울기로 쓰는 식이 함정) — medium 은 y 절편이 점으로 표시된 그래프",
      concepts: ["그래프의 두 점", "기울기·절편", "일차식 세우기"], sprNo: EXPR_ONLY,
      gen(rng) {
        const s = makeLinGraph(rng, { noZeroX: true }); if (s.d === 1 || s.b === s.ys[0]) throw new GenFail("trap"); const xv = 7.5;
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)} Let $x$ represent ${s.xq}, in ${s.t.xu}, and let $y$ represent ${s.yq}, in ${s.t.yu}.`,
          question: `Which equation gives $y$ in terms of $x$? $y =$`, correctText: M(lin(s.m, s.b)), evalAt: { x: xv },
          wrongTexts: [T(lin(s.m, s.ys[0]), "formula_misuse", "첫 점 값을 절편으로 썼다."), T(lin(s.m * s.d, s.b), "unit_error", "두 점 사이의 변화를 기울기로 썼다."), T(lin(s.b, s.m), "other", "기울기와 절편을 바꿨다."), T(lin(-s.m, s.b), "sign_error", "기울기 부호를 바꿨다.")],
          verificationJs: figJs({ x: xv }, s.fig, `${GL_JS}return m * P.x + b;`),
          trace: [...glRead(s), glIntercept(s), [`식: y = ${lin(s.m, s.b)} 이다.`, "Write the equation."], [`그래프의 다른 점 (${s.xs[2]}, ${s.ys[2]}) 로 확인한다.`, "Check with another marked point."]], variant: "equation_from_graph",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "그래프에서 식을 세운 뒤 x 를 y 의 식으로(역관계) 나타냄", extra: "식을 세우고 x 에 대해 풀어 역관계를 써야 함 — medium 은 y 에 대한 식",
      concepts: ["그래프의 두 점", "일차식 세우기", "식의 변형(역관계)"], sprNo: EXPR_ONLY,
      gen(rng) {
        const s = makeLinGraph(rng); const yv = 11.5; const m = s.m, b = s.b;
        const inv = (mm: number, bb: number) => `\\frac{${lin(1, -bb, "y")}}{${fmtNum(mm)}}`;
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)} Let $x$ represent ${s.xq}, in ${s.t.xu}, and let $y$ represent ${s.yq}, in ${s.t.yu}.`,
          question: `Which expression gives $x$ in terms of $y$? $x =$`, correctText: M(inv(m, b)), evalAt: { y: yv },
          wrongTexts: [T(`${fmtNum(m)}y + ${fmtNum(b)}`.replace("+ -", "- "), "formula_misuse", "x 와 y 를 바꿔 쓰기만 했다."), T(`\\frac{${lin(1, b, "y")}}{${fmtNum(m)}}`, "sign_error", "절편의 부호를 반대로 옮겼다."), T(inv(m * s.d, b), "unit_error", "두 점 사이의 변화를 기울기로 썼다."), T(`\\frac{y}{${fmtNum(m)}} - ${fmtNum(b)}`, "step_missing", "나누는 순서를 틀렸다.")],
          verificationJs: figJs({}, s.fig, `${GL_JS}const Y = ${yv}; return (Y - b) / m;`),
          trace: [...glRead(s), glIntercept(s), [`y = ${lin(m, b)} 이다.`, "Equation for y."], [`양변에서 ${fmtNum(b)} 를 빼고 ${fmtNum(m)} 로 나눈다.`, "Isolate x."], [`x = (y - ${fmtNum(b)}) ÷ ${fmtNum(m)} 이다.`, "Inverse relationship."]], variant: "inverse_equation_from_graph",
        }, s.fig);
      },
    },
    {
      op: "unit_ratio", structure: "그래프(큰 단위)에서 식을 세운 뒤, 입력을 작은 단위 t 로 쓴 식으로 바꿈", extra: "기울기를 환산 비율로 나눠 새 단위의 식을 만들어야 함(기울기를 그대로 두거나 곱하는 식이 함정) — medium 은 원래 단위의 식",
      concepts: ["그래프의 두 점", "일차식 세우기", "단위 환산"], sprNo: EXPR_ONLY,
      gen(rng) {
        const s = makeLinGraph(rng, { conv: true }); const per = s.t.conv!.per; const tv = 9.5; const fig = s.fig;
        const coef = (n: number, d: number) => { const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a)); const k = g(n, d); const nn = n / k, dd = d / k; return dd === 1 ? `${nn}t` : `${nn < 0 ? "-" : ""}\\frac{${Math.abs(nn)}}{${dd}}t`; };
        const ex = (n: number, d: number, bb: number) => `${coef(n, d)} ${bb < 0 ? "-" : "+"} ${Math.abs(bb)}`;
        if (!Number.isInteger(s.m)) throw new GenFail("half");
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)} ${convNote(s)} Let $t$ represent ${s.xq} measured in ${s.t.conv!.small}.`,
          question: `Which expression gives ${s.yq}, in ${s.t.yu}, in terms of $t$?`, correctText: M(ex(s.m, per, s.b)), evalAt: { t: tv },
          wrongTexts: [T(ex(s.m, 1, s.b), "unit_error", "단위를 바꾸지 않았다."), T(ex(s.m * per, 1, s.b), "formula_misuse", "환산 비율을 곱했다."), T(ex(s.m, per, s.ys[0]), "formula_misuse", "첫 점의 값을 절편으로 썼다."), T(ex(s.b, per, s.m), "other", "기울기와 절편을 바꿨다.")],
          verificationJs: figJs({ per }, fig, `${GL_JS}const t = ${tv}; return m * (t / P.per) + b;`),
          trace: [...glRead(s), glIntercept(s), [`원래 단위 식: y = ${lin(s.m, s.b)} 이다.`, "Equation in the graph's units."], [`x = t ÷ ${per} 를 대입한다.`, "Substitute x = t / per."], [`y = (${fmtNum(s.m)}/${per})t + ${fmtNum(s.b)} 이다.`, "Equation in t."]], variant: "equation_in_new_unit",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 식 y = ax + c 의 두 계수를 구한 뒤 c − a 를 계산", extra: "기울기와 절편을 각각 구해(절편은 거슬러 계산) 결합해야 함 — medium 은 한 계수",
      concepts: ["그래프의 두 점", "기울기·절편", "계수 결합"],
      gen(rng) {
        const s = makeLinGraph(rng, { noZeroX: true }); const correct = s.b - s.m;
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)} The relationship can be written as $y = ax + c$, where $y$ is ${s.yq}, $x$ is ${s.xq}, and $a$ and $c$ are constants.`,
          question: `What is the value of $c - a$?`, correct, fmt: fmtNum,
          wrongs: [W(s.ys[0] - s.m, "formula_misuse", "첫 점의 값을 c 로 썼다."), W(s.b - s.m * s.d, "unit_error", "두 점 사이의 변화를 a 로 썼다."), W(s.m - s.b, "sign_error", "a − c 를 구했다."), W(s.b + s.m, "sign_error", "합을 구했다."), W(s.b, "step_missing", "c 만 답했다.")],
          verificationJs: figJs({}, s.fig, `${GL_JS}return b - m;`),
          trace: [...glRead(s), glIntercept(s), [`a = ${fmtNum(s.m)}, c = ${fmtNum(s.b)} 이다.`, "Identify the constants."], [`c − a = ${fmtNum(s.b)} − ${fmtNum(s.m)} = ${fmtNum(correct)} 이다.`, "Combine."]], variant: "coefficient_combo",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "constant_from_intercept_point", structure: "y 절편이 점으로 표시된 그래프에서 식 y = ax + c 의 c 를 읽음", extra: "easy: 표시된 y 절편 = 상수항", concepts: ["그래프", "상수항"],
      gen(rng) {
        const s = makeLinGraph(rng, { x0Zero: true });
        return gInst(rng, { stimulus: `${glIntro(rng, s)} The relationship can be written as $y = ax + c$, where $a$ and $c$ are constants.`, question: `What is the value of $c$?`, correct: s.b, wrongs: [W(Math.abs(s.m), "formula_misuse", "기울기를 답했다."), W(s.ys[1], "axis_misread", "다른 점을 읽었다."), W(s.ys[s.ys.length - 1], "axis_misread", "가장 오른쪽 점을 읽었다."), W(s.b + 1, "other", "어긋났다.")].filter((w) => w.v !== s.b), verificationJs: figJs({}, s.fig, `${GL_JS}if (xs[0] !== 0) throw new Error('x=0 행 없음'); return b;`), trace: [[`x = 0 행의 값이 c 이다.`, "The x = 0 row gives c."], [`c = ${s.b} 이다.`, "Read it."]], variant: "constant_term",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "equation_with_intercept_point", structure: "y 절편이 점으로 표시된 그래프에서 식을 고름", extra: "medium: 기울기 계산 + x = 0 행", concepts: ["그래프", "일차식"], sprNo: EXPR_ONLY,
      gen(rng) {
        const s = makeLinGraph(rng, { x0Zero: true }); if (s.d === 1) throw new GenFail("d");
        return gInst(rng, { stimulus: `${glIntro(rng, s)} Let $x$ represent ${s.xq} and $y$ represent ${s.yq}.`, question: `Which equation gives $y$ in terms of $x$? $y =$`, correctText: M(lin(s.m, s.b)), evalAt: { x: 6.5 }, wrongTexts: [T(lin(s.m * s.d, s.b), "unit_error", "두 점 사이의 변화를 기울기로 썼다."), T(lin(s.b, s.m), "other", "계수를 바꿨다."), T(lin(-s.m, s.b), "sign_error", "부호를 바꿨다."), T(lin(s.m, s.ys[1]), "formula_misuse", "다른 점의 값을 상수항으로 썼다.")], verificationJs: figJs({ x: 6.5 }, s.fig, `${GL_JS}return m * P.x + b;`), trace: [...glRead(s), [`x = 0 행에서 상수항 ${s.b}, 식 y = ${lin(s.m, s.b)} 이다.`, "Constant from the x = 0 row."]], variant: "equation_with_zero_row",
        }, s.fig);
      },
    },
  ],
});
