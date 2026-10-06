// nonlinear_functions.interpret_a.FN.P — 순수 포물선 그래프로 y = ax² + bx + c 의 이차항 계수 a(폭·열린 방향)를 구하거나 해석한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { pickFn } from "./_t5-kit";
import { makeQuadVertex, QX_JS, quadMarkedIntro, quadXRead, quadVertexIntro } from "../pure-fn-kit";

const FORM = (fn: string) => `$${fn}(x) = ax² + bx + c$, where $a$, $b$, and $c$ are constants`;
const vertexIntro = (rng: Rng, fn: string) => quadVertexIntro(rng, fn);
const AQ = (rng: Rng) => rng.pick(["What is the value of $a$?", "What is $a$?", "What is the value of the constant $a$?"]);

export const ITEM = defineItem({
  prefix: "ifag", itemId: "nonlinear_functions.interpret_a.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "꼭짓점이 표시되지 않은 포물선 그래프에서 표시점 세 개로 식을 세워 이차항 계수 a 를 구함", extra: "열린 방향·폭만 보는 것으로는 부족하고 세 점으로 a, b, c 를 연립해야 함(마지막 점의 y 나 기울기를 a 로 읽는 것이 함정) — medium 은 꼭짓점이 표시됨",
      concepts: ["포물선 그래프", "이차식 세우기", "이차항 계수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" });
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The function is defined by ${FORM(fn)}.`, question: AQ(rng), correct: q.A,
          wrongs: [W(-q.A, "sign_error", "열린 방향을 반대로 보았다."), W(q.B, "formula_misuse", "일차항 계수를 답했다."), W(q.C, "axis_misread", "상수항을 답했다."), W(q.A * 2, "formula_misuse", "계수를 두 배로 계산했다."), W(q.A + 1, "other", "어긋났다.")].filter((w) => w.v !== q.A),
          verificationJs: figJs({}, q.fig, `${QX_JS}return A;`),
          trace: [...quadXRead(q), [`따라서 a = ${fmtNum(q.A)} 이다 (포물선은 ${q.A > 0 ? "위" : "아래"}로 열린다).`, "Read off the leading coefficient."]], variant: "a_from_marked_points",
        }, q.fig);
      },
    },
    {
      op: "compose_kind", structure: "그래프에서 f 의 이차항 계수를 구하고, g(x) = k f(x) 로 전개한 식의 이차항 계수를 구함", extra: "f 의 a 를 구한 뒤 k 배(상수배가 모든 계수에 곱해짐)를 반영해야 함 — medium 은 f 의 a",
      concepts: ["포물선 그래프", "이차식 세우기", "함수의 상수배"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const k = rng.pick([-3, -2, 2, 3, 4]); const ans = k * q.A;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The expression $${k} ${fn}(x)$ can be rewritten as $ax² + bx + c$, where $a$, $b$, and $c$ are constants; $a$ is the leading coefficient.`, question: AQ(rng), correct: ans,
          wrongs: [W(q.A, "step_missing", `${fn} 의 a 를 그대로 답했다.`), W(q.A + k, "formula_misuse", "상수배 대신 더했다."), W(-ans, "sign_error", "부호를 바꿨다."), W(k * q.B, "formula_misuse", "일차항 계수의 상수배를 답했다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ k }, q.fig, `${QX_JS}return P.k * A;`),
          trace: [...quadXRead(q), [`${k}(${fmtNum(q.A)}x² + ${fmtNum(q.B)}x + ${fmtNum(q.C)}) 이므로 이차항 계수는 ${k} × ${fmtNum(q.A)} = ${fmtNum(ans)} 이다.`, "Multiply every coefficient by k."]], variant: "a_after_scaling",
        }, q.fig);
      },
    },
    {
      op: "chain2", structure: "그래프에서 식을 세워 a 를 구하고, 꼭짓점형 a(x - h)² + k 의 a + k 를 구함", extra: "a 와 꼭짓점 높이 k 를 모두 구해 더하는 2단 연쇄(a 만 답하는 것이 함정) — medium 은 a",
      concepts: ["포물선 그래프", "이차식 세우기", "꼭짓점형"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const ans = q.A + q.K; if (ans === q.A || ans === q.K) throw new GenFail("tie");
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The function can be written in the form $${fn}(x) = a(x - h)² + k$, where $a$, $h$, and $k$ are constants.`, question: rng.pick([`What is the value of $a + k$?`, `What is the sum of $a$ and $k$?`]), correct: ans,
          wrongs: [W(q.A, "step_missing", "a 만 답했다."), W(q.K, "step_missing", "k 만 답했다."), W(q.A + q.H, "formula_misuse", "a + h 를 답했다."), W(q.A - q.K, "sign_error", "k 의 부호를 바꿨다."), W(ans + 1, "other", "어긋났다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, q.fig, `${QX_JS}return A + K;`),
          trace: [...quadXRead(q), [`꼭짓점은 (${fmtNum(q.H)}, ${fmtNum(q.K)}) 이므로 h = ${fmtNum(q.H)}, k = ${fmtNum(q.K)} 이다.`, "Find the vertex."], [`a + k = ${fmtNum(q.A)} + (${fmtNum(q.K)}) = ${fmtNum(ans)} 이다.`, "Add a and k."]], variant: "a_plus_k",
        }, q.fig);
      },
    },
    {
      op: "constraint_select", structure: "그래프에서 f 의 a 를 구하고, 평행이동한 g(x) = f(x - s) + t 를 전개했을 때의 이차항 계수를 구함(이동은 a 를 바꾸지 않음)", extra: "평행이동이 이차항 계수를 바꾸지 않음을 알아야 함(이동량을 더하는 것이 함정) — medium 은 f 의 a",
      concepts: ["포물선 그래프", "함수의 평행이동", "이차항 계수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any" }); const s = rng.nz(-5, 5), t = rng.nz(-6, 6); const se = s > 0 ? `x - ${s}` : `x + ${-s}`; const te = t > 0 ? `+ ${t}` : `- ${-t}`;
        return figInst(rng, {
          stimulus: `${quadMarkedIntro(rng, fn)} The expression $${fn}(${se}) ${te}$ can be rewritten as $ax² + bx + c$, where $a$, $b$, and $c$ are constants; $a$ is the leading coefficient.`, question: AQ(rng), correct: q.A,
          wrongs: [W(q.A + s, "formula_misuse", "수평 이동량을 더했다."), W(q.A + t, "formula_misuse", "수직 이동량을 더했다."), W(-q.A, "sign_error", "부호를 바꿨다."), W(q.A * 2, "formula_misuse", "두 배로 계산했다."), W(q.A + s + t, "formula_misuse", "이동량을 모두 더했다.")].filter((w) => w.v !== q.A),
          verificationJs: figJs({ s, t }, q.fig, `${QX_JS}return A;`),
          trace: [...quadXRead(q), [`${fn}(${se}) ${te} 를 전개하면 x² 의 계수는 ${fn} 의 a 와 같다.`, "Shifting does not change the x² coefficient."], [`a = ${fmtNum(q.A)} 이다.`, "The leading coefficient is unchanged."]], variant: "a_after_shift",
        }, q.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "unit_a_vertex", structure: "꼭짓점이 표시된 포물선(a = ±1)에서 열린 방향과 폭으로 a 를 읽음", extra: "easy: 꼭짓점에서 한 칸 옆의 높이", concepts: ["포물선 그래프", "꼭짓점형", "이차항 계수"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", vertex: true, aPool: [-1, 1] });
        return figInst(rng, { stimulus: `${vertexIntro(rng, fn)} The function is defined by $${fn}(x) = a(x - h)² + k$, where $a$, $h$, and $k$ are constants.`, question: AQ(rng), correct: q.A, wrongs: [W(-q.A, "sign_error", "열린 방향을 반대로 보았다."), W(q.A * 2, "formula_misuse", "두 배로 계산했다."), W(q.H, "axis_misread", "꼭짓점 x 를 답했다."), W(q.K, "axis_misread", "꼭짓점 y 를 답했다.")].filter((w) => w.v !== q.A), verificationJs: figJs({}, q.fig, `${QX_JS}return A;`), trace: [[`표시된 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "Read the vertex."], [`꼭짓점에서 한 칸 옆의 점의 높이 차가 ${fmtNum(q.A)} 이므로 a = ${fmtNum(q.A)} 이다.`, "One unit from the vertex the graph changes by a."]], variant: "a_unit_vertex",
        }, q.fig);
      },
    },
    {
      lv: "medium", name: "vertex_form_point", structure: "꼭짓점과 한 점이 표시된 포물선에서 꼭짓점형에 점을 대입해 a 를 구함", extra: "medium: (y - k) ÷ (x - h)²", concepts: ["포물선 그래프", "꼭짓점형", "대입"],
      gen(rng) {
        const fn = pickFn(rng); const q = makeQuadVertex(rng, fn, { disc: "any", vertex: true });
        return figInst(rng, { stimulus: `${vertexIntro(rng, fn)} The function is defined by $${fn}(x) = a(x - h)² + k$, where $a$, $h$, and $k$ are constants.`, question: AQ(rng), correct: q.A, wrongs: [W(-q.A, "sign_error", "부호를 바꿨다."), W(q.A * 2, "formula_misuse", "두 배로 계산했다."), W(q.A * 4, "formula_misuse", "(x - h) 를 제곱하지 않았다."), W(q.H, "axis_misread", "꼭짓점 x 를 답했다.")].filter((w) => w.v !== q.A), verificationJs: figJs({}, q.fig, `${QX_JS}return A;`), trace: [[`표시된 꼭짓점은 (${q.H}, ${q.K}) 이다.`, "Read the vertex."], [`다른 표시점 (${q.xs.find((x) => x !== q.H)}, ${q.ys[q.xs.findIndex((x) => x !== q.H)]}) 을 y = a(x - ${q.H})² + (${q.K}) 에 대입한다.`, "Substitute another marked point."], [`a = ${fmtNum(q.A)} 이다.`, "Solve for a."]], variant: "a_vertex_form_point",
        }, q.fig);
      },
    },
  ],
});
