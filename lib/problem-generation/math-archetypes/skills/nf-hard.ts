// nonlinear_functions hard 원형 — evaluate·vertex_x·vertex_y·find_x_for_value·interpret_a·interpret_b (세부 패턴 6개 × 연산자 4종 = 24).
import { GenFail, type Archetype } from "../types";
import { M, spin, withParams, pn, shifted, lin } from "../text";
import { fracOf, quadStr, rectSem, finishA } from "./a-kit";

const SKILL = "nonlinear_functions";
const T = (ko: string, en: string): [string, string] => [ko, en];
const f2 = (a: number, b: number, c: number, name = "f") => `${name}(x) = ${quadStr(a, b, c)}`;
const GROW = ["bacteria in a culture", "cells in a sample", "followers of an online account", "visitors to a website", "members of an online club", "yeast cells in a dish"] as const;
const UNITS = [["hours", "hour", "day", 24], ["minutes", "minute", "hour", 60], ["months", "month", "year", 12]] as const;
const grow = (rng: { pick<T>(a: readonly T[]): T }) => rng.pick(GROW);

export const NF_HARD_ARCHETYPES: Archetype[] = [
  // ───────────── evaluate ─────────────
  {
    id: "nf.evaluate.chain2", skill: SKILL, kind: "evaluate", operator: "chain2",
    structure: "이차함수 f(x)와 일차함수 g(x) 에서 g(f(p)) (또는 f(f(p))) — 안쪽 값을 구해 바깥 함수의 입력으로 쓴다",
    extraThinking: "앞 단계의 함숫값이 다음 함수의 입력이 되는 연쇄 대입과 부호 처리 — medium 은 한 번의 함숫값 계산",
    concepts: ["함숫값", "합성(연쇄 대입)", "부호 처리"], mediumSteps: 2,
    generate(rng) {
      const a = rng.pick([-2, -1, 1, 2]), b = rng.int(-5, 5), c = rng.int(-6, 6), p = rng.int(-3, 4); const inner = a * p * p + b * p + c; if (Math.abs(inner) > 12) throw new GenFail("x");
      const nested = rng.chance(0.4); const m = rng.nz(-4, 5), n = rng.int(-7, 7); const outer = nested ? a * inner * inner + b * inner + c : m * inner + n; if (Math.abs(outer) > 400 || inner === p) throw new GenFail("x");
      return finishA(rng, {
        stimulus: nested ? spin(rng, `[[The function f is defined by the equation below|Let f be the function defined below|A quadratic function f is given below]]. `) + M(f2(a, b, c)) : spin(rng, `[[The functions f and g are defined by the equations below|Let f and g be the functions defined below|Two functions are given below]]. `) + M(f2(a, b, c)) + " " + M(`g(x) = ${lin(m, n)}`),
        question: nested ? spin(rng, `[[What is the value of f(f(${p}))?|What is f(f(${p}))?|Find f(f(${p})).]]`) : spin(rng, `[[What is the value of g(f(${p}))?|What is g(f(${p}))?|Find g(f(${p})).]]`), correct: outer,
        wrongs: nested
          ? [{ v: inner * inner, kind: "formula_misuse", reason: "f(f(p)) 를 (f(p))² 로 계산했다." }, { v: 2 * inner, kind: "formula_misuse", reason: "f(f(p)) 를 2f(p) 로 계산했다." }, { v: a * inner * inner + b * inner, kind: "step_missing", reason: "바깥 함수의 상수항 c 를 빠뜨렸다." }, { v: a * p * p + b * inner + c, kind: "step_missing", reason: "바깥 함수의 x² 항에 p 를 그대로 넣었다." }, { v: inner, kind: "step_missing", reason: "안쪽 함숫값 f(p) 에서 멈췄다." }, { v: -outer, kind: "sign_error", reason: "부호를 반대로 적었다." }]
          : [{ v: inner, kind: "step_missing", reason: "f(p) 에서 멈췄다." }, { v: m * p + n, kind: "step_missing", reason: "g 에 p 를 직접 넣었다(합성 순서 오류)." }, { v: a * (m * p + n) * (m * p + n) + b * (m * p + n) + c, kind: "formula_misuse", reason: "합성 순서를 f(g(p)) 로 바꿨다." }, { v: m * inner, kind: "step_missing", reason: "g 의 상수항을 빠뜨렸다." }, { v: m + inner + n, kind: "formula_misuse", reason: "g(x) 에서 곱 대신 합을 썼다." }, { v: -outer, kind: "sign_error", reason: "부호를 반대로 적었다." }],
        verificationJs: nested ? withParams({ a, b, c, p }, "const f=x=>P.a*x*x+P.b*x+P.c; return f(f(P.p));") : withParams({ a, b, c, m, n, p }, "const f=x=>P.a*x*x+P.b*x+P.c, g=x=>P.m*x+P.n; return g(f(P.p));"),
        trace: [
          T(`안쪽부터 계산한다: f(${p}) = ${a}·${pn(p)}² + ${pn(b)}·${pn(p)} + ${pn(c)}.`, "Evaluate the inner function first."),
          T(`제곱을 먼저 계산하면 ${a}·${p * p} = ${a * p * p} 이다.`, "Square before multiplying."),
          T(`f(${p}) = ${a * p * p} + ${pn(b * p)} + ${pn(c)} = ${inner} 이다.`, "Add the terms."),
          T(nested ? `이 값을 다시 f 에 넣는다: f(${inner}) = ${a}·${pn(inner)}² + ${pn(b)}·${pn(inner)} + ${pn(c)}.` : `이 값을 g 에 넣는다: g(${inner}) = ${m}·${pn(inner)} + ${pn(n)}.`, "Use the result as the next input."),
          T(`계산하면 ${outer} 이다.`, "Evaluate."),
        ],
        variant: nested ? "f_of_f" : "g_of_f",
      });
    },
  },
  {
    id: "nf.evaluate.compose_kind", skill: SKILL, kind: "evaluate", operator: "compose_kind",
    structure: "f(x) 이차, g(x) 일차 에서 f(g(p)) - g(f(p)) 를 구한다(두 합성의 차)",
    extraThinking: "합성의 순서가 결과를 바꾼다는 개념과 두 번의 합성 계산, 부호 처리 — medium 은 한 번의 함숫값",
    concepts: ["함수 합성", "함숫값", "순서의 비가환성"], mediumSteps: 2,
    generate(rng) {
      const a = rng.pick([-1, 1, 2]), b = rng.int(-4, 4), m = rng.nz(-3, 4), n = rng.int(-5, 5), p = rng.int(-2, 3); const f = (x: number) => a * x * x + b * x, g = (x: number) => m * x + n;
      const ans = f(g(p)) - g(f(p)); if (Math.abs(ans) > 300 || ans === 0 || f(g(p)) === f(p)) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[The functions f and g are defined by the equations below|Let f and g be the functions defined below|Two functions are given below]]. `) + M(`f(x) = ${quadStr(a, b, 0)}`) + " " + M(`g(x) = ${lin(m, n)}`),
        question: spin(rng, `[[What is the value of f(g(${p})) - g(f(${p}))?|What is f(g(${p})) minus g(f(${p}))?|Find f(g(${p})) - g(f(${p})).]]`), correct: ans,
        wrongs: [{ v: g(f(p)) - f(g(p)), kind: "sign_error", reason: "두 합성의 뺄셈 순서를 바꿨다." }, { v: f(g(p)), kind: "step_missing", reason: "f(g(p)) 만 구했다." }, { v: g(f(p)), kind: "step_missing", reason: "g(f(p)) 만 구했다." }, { v: f(g(p)) + g(f(p)), kind: "sign_error", reason: "차 대신 합을 구했다." }, { v: f(p) - g(p), kind: "formula_misuse", reason: "합성이 아니라 함숫값의 차를 구했다." }, { v: f(p) * g(p) - ans, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a, b, m, n, p }, "const f=x=>P.a*x*x+P.b*x, g=x=>P.m*x+P.n; return f(g(P.p))-g(f(P.p));"),
        trace: [T(`g(${p}) = ${m}·${pn(p)} + ${pn(n)} = ${g(p)} 이다.`, "Evaluate g first."), T(`f(g(${p})) = f(${g(p)}) = ${f(g(p))} 이다.`, "Feed it into f."), T(`f(${p}) = ${f(p)} 이다.`, "Evaluate f(p)."), T(`g(f(${p})) = g(${f(p)}) = ${g(f(p))} 이다.`, "Feed it into g."), T(`두 값의 차는 ${f(g(p))} - ${pn(g(f(p)))} = ${ans} 이다.`, "Subtract.")],
        variant: "difference_of_compositions",
      });
    },
  },
  {
    id: "nf.evaluate.repr_shift", skill: SKILL, kind: "evaluate", operator: "repr_shift",
    structure: "이차함수의 세 값 f(0), f(1), f(2) 를 표로 주고 식을 세워 다른 점의 값 f(p) 를 구한다",
    extraThinking: "표(값)에서 이차함수 식을 세우는 모델링(상수항, 일차·이차 계수 연립) 후 새 입력에서 계산 — medium 은 식이 주어진 함숫값",
    concepts: ["표에서 식 세우기", "이차함수 계수 결정", "함숫값"], mediumSteps: 2,
    generate(rng) {
      const a = rng.nz(-3, 3), b = rng.int(-6, 6), c = rng.int(-6, 6), p = rng.int(3, 6); const f = (x: number) => a * x * x + b * x + c; const u = f(1), v = f(2); const ans = f(p);
      if (Math.abs(ans) > 200 || c === 0 || u === c || v === u) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[A quadratic function f has the values below|The values of a quadratic function f are given below|A table lists three values of a quadratic function f]]: f(0) = ${c}, f(1) = ${u}, and f(2) = ${v}.`),
        question: spin(rng, `[[What is the value of f(${p})?|What is f(${p})?|Find f(${p}).]]`), correct: ans,
        wrongs: [{ v: 2 * v - u + 0 * c + (v - u) - (u - c) - (v - u) + (u - c), kind: "formula_misuse", reason: "값의 변화를 일정하다고 보고 일차함수처럼 외삽했다." }, { v: c + (v - c) * (p / 2), kind: "formula_misuse", reason: "f(0), f(2) 로 직선 외삽을 했다." }, { v: f(p - 1), kind: "step_missing", reason: "한 칸 앞의 값을 골랐다." }, { v: f(p + 1), kind: "step_missing", reason: "한 칸 뒤의 값을 골랐다." }, { v: a * p * p, kind: "step_missing", reason: "이차항만 계산했다." }, { v: -ans, kind: "sign_error", reason: "부호를 반대로 적었다." }],
        verificationJs: withParams({ c, u, v, p }, "const hits=[]; for(let a=-9;a<=9;a++) for(let b=-40;b<=40;b++){ const f=x=>a*x*x+b*x+P.c; if(f(1)===P.u && f(2)===P.v) hits.push(f(P.p)); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`f(0) = ${c} 이므로 상수항은 ${c} 이다.`, "f(0) is the constant term."), T(`f(x) = ax² + bx + ${c} 에서 f(1) = a + b + ${c} = ${u} 이므로 a + b = ${u - c} 이다.`, "Use f(1)."), T(`f(2) = 4a + 2b + ${c} = ${v} 이므로 2a + b = ${(v - c) / 2} 이다.`, "Use f(2)."), T(`두 식을 빼면 a = ${a}, b = ${b} 이다.`, "Solve for a and b."), T(`f(x) = ${quadStr(a, b, c)} 이므로 f(${p}) = ${ans} 이다.`, "Evaluate at the new input.")],
        variant: "table_to_formula",
      });
    },
  },
  {
    id: "nf.evaluate.compare_scenarios", skill: SKILL, kind: "evaluate", operator: "compare_scenarios",
    structure: "이차 비용 모델 A(t) 와 일차 비용 모델 B(t) 를 비교해 A 가 처음으로 B 보다 커지는 정수 t 를 찾는다",
    extraThinking: "두 모델의 값을 비교해 임계 시점을 찾는 탐색(부등식·교차점 해석) — medium 은 한 모델의 함숫값",
    concepts: ["함숫값 비교", "이차-일차 교차", "임계점 탐색"], mediumSteps: 2,
    generate(rng) {
      const a1 = rng.int(-4, 6), c1 = rng.int(0, 20), m = rng.int(2, 18), n = c1 + rng.int(5, 40); const A = (t: number) => t * t + a1 * t + c1, B = (t: number) => m * t + n;
      let ts = -1; for (let t = 0; t <= 30; t++) if (A(t) > B(t)) { ts = t; break; } if (ts < 3 || ts > 20 || A(0) >= B(0)) throw new GenFail("x");
      const ctx = rng.pick([["gym", "a gym membership", "a studio membership"], ["streaming", "a streaming bundle", "a streaming plan"], ["printing", "a print shop plan", "a copy center plan"], ["storage", "a cloud storage plan", "a drive rental plan"]] as const);
      return finishA(rng, {
        stimulus: `The total cost, in dollars, of ${ctx[1]} after t months is given by ${M(`A(t) = ${quadStr(1, a1, c1, "t")}`)}. The total cost of ${ctx[2]} after t months is given by ${M(`B(t) = ${lin(m, n, "t")}`)}.`,
        question: spin(rng, "[[What is the smallest whole number of months t for which A(t) is greater than B(t)?|After how many whole months does the first plan first cost more than the second plan?|For what is the least integer t such that A(t) > B(t)?]]"), correct: ts,
        wrongs: [{ v: ts - 1, kind: "step_missing", reason: "두 비용이 가장 가까워지는 직전 시점을 골랐다." }, { v: ts + 1, kind: "other", reason: "처음 초과하는 시점이 아니라 그 다음 시점을 골랐다." }, { v: ts - 2, kind: "other", reason: "임계 시점을 앞쪽으로 잘못 추정했다." }, { v: ts + 2, kind: "other", reason: "임계 시점을 뒤쪽으로 잘못 추정했다." }, { v: Math.round((n - c1) / Math.max(1, m - a1)), kind: "formula_misuse", reason: "이차항을 무시하고 일차식으로만 교차점을 계산했다." }],
        verificationJs: withParams({ a1, c1, m, n }, "const A=t=>t*t+P.a1*t+P.c1, B=t=>P.m*t+P.n; for(let t=0;t<=60;t++) if(A(t)>B(t)) return t; throw new Error('교차 없음');"),
        trace: [T(`A(t) = ${quadStr(1, a1, c1, "t")}, B(t) = ${lin(m, n, "t")} 이다.`, "Write both cost models."), T(`A(0) = ${c1} < B(0) = ${n} 이므로 처음에는 A 가 더 싸다.`, "Compare at t = 0."), T(`t 를 늘려 가며 두 값을 비교한다: t = ${ts - 1} 에서 A = ${A(ts - 1)}, B = ${B(ts - 1)}.`, "Compare just before the crossing."), T(`t = ${ts} 에서 A = ${A(ts)}, B = ${B(ts)} 로 A 가 처음으로 더 크다.`, "Find the first t where A exceeds B."), T(`따라서 ${ts} 개월이다.`, "State the answer.")],
        variant: "quadratic_vs_linear_threshold",
      });
    },
  },

  // ───────────── vertex_x ─────────────
  {
    id: "nf.vertex_x.inverse", skill: SKILL, kind: "vertex_x", operator: "inverse",
    structure: "최고차 계수 a, 꼭짓점의 x좌표 h, 지나는 한 점이 주어졌을 때 b 와 c 를 역산해 b + c 를 구한다",
    extraThinking: "꼭짓점 공식에서 b 를 역산하고 점의 좌표를 대입해 c 를 구하는 역방향 재구성 — medium 은 표준형에서 꼭짓점 x좌표 -b/2a 를 계산",
    concepts: ["꼭짓점 공식", "점의 대입", "계수 역산"], mediumSteps: 2,
    generate(rng) {
      const a = rng.pick([-3, -2, -1, 1, 2, 3]), h = rng.nz(-5, 6), p = rng.int(-4, 6), b = -2 * a * h; if (p === h) throw new GenFail("x"); const c0 = rng.int(-8, 8), q = a * p * p + b * p + c0; if (Math.abs(q) > 200 || Math.abs(b) > 40 || b + c0 === 0) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[In the function below|For the function f defined below|Consider the function below]], b and c are constants. The graph of the function in the xy-plane has its vertex at x = ${h} and passes through the point (${p}, ${q}).\n\n`) + M(`f(x) = ${quadStr(a, 0, 0).replace(/x\^2/, "x^2")} + bx + c`),
        question: spin(rng, "[[What is the value of b + c?|Find b + c.|What is the sum of b and c?]]"), correct: b + c0,
        wrongs: [{ v: -b + c0, kind: "sign_error", reason: "꼭짓점 공식 x = -b/(2a) 의 부호를 놓쳐 b 의 부호가 뒤집혔다." }, { v: c0, kind: "step_missing", reason: "c 만 구했다." }, { v: b, kind: "step_missing", reason: "b 만 구했다." }, { v: -a * h + c0, kind: "formula_misuse", reason: "b = -a·h 로 계산했다(2 를 빠뜨림)." }, { v: b - c0, kind: "sign_error", reason: "b - c 를 계산했다." }, { v: 2 * a * h + c0 + 0, kind: "sign_error", reason: "b 의 부호를 반대로 적용했다." }],
        verificationJs: withParams({ a, h, p, q }, "const hits=[]; for(let b=-80;b<=80;b++) for(let c=-250;c<=250;c++){ if(b!==-2*P.a*P.h) continue; if(P.a*P.p*P.p+b*P.p+c===P.q) hits.push(b+c); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`꼭짓점의 x 좌표는 -b/(2a) = ${h} 이다 (a = ${a}).`, "Use the vertex formula."), T(`-b = ${2 * a * h} 이므로 b = ${b} 이다.`, "Solve for b."), T(`점 (${p}, ${q}) 를 대입한다: ${a}·${pn(p)}² + ${pn(b)}·${pn(p)} + c = ${q}.`, "Substitute the point."), T(`${a * p * p} + ${pn(b * p)} + c = ${q} 이므로 c = ${c0} 이다.`, "Solve for c."), T(`b + c = ${b} + ${pn(c0)} = ${b + c0} 이다.`, "Add.")],
        variant: "vertex_and_point_inverse",
      });
    },
  },
  {
    id: "nf.vertex_x.compose_kind", skill: SKILL, kind: "vertex_x", operator: "compose_kind",
    structure: "f(x) = (x-p)(x-q) 의 영점으로 꼭짓점 x좌표 (p+q)/2 를 구하고 g(x) = f(x-d)+e 의 평행이동을 반영한다",
    extraThinking: "영점의 중점이 꼭짓점이라는 성질과 평행이동(수평 이동만 x좌표에 영향)을 결합 — medium 은 표준형에서 -b/2a 계산",
    concepts: ["영점과 대칭축", "그래프 평행이동", "꼭짓점"], mediumSteps: 2,
    generate(rng) {
      const p = rng.int(-7, 7), q = rng.int(-7, 7); if (p === q || (p + q) % 2 !== 0) throw new GenFail("x"); const s = rng.pick([1, -1]), d = rng.nz(-6, 6), e = rng.nz(-9, 9); const ans = (p + q) / 2 + d;
      const fx = `${s === 1 ? "" : "-"}(${shifted("x", -p)})(${shifted("x", -q)})`;
      return finishA(rng, {
        stimulus: spin(rng, `[[The function f is defined by the equation below|Let f be the function defined below|A quadratic function f is given below]]: `) + M(`f(x) = ${fx}`) + spin(rng, `. [[The function g is defined by|Let g be the function with|A second function is]] `) + M(`g(x) = f(x ${d < 0 ? "+" : "-"} ${Math.abs(d)}) ${e < 0 ? "-" : "+"} ${Math.abs(e)}`) + ".",
        question: spin(rng, `[[What is the x-coordinate of the vertex of the graph of g in the xy-plane?|What is the x-coordinate of the vertex of the graph of y = g(x)?|At what value of x does the graph of g have its vertex?]]`), correct: ans,
        wrongs: [{ v: (p + q) / 2, kind: "step_missing", reason: "f 의 꼭짓점 x 좌표에서 멈췄다(평행이동을 반영하지 않음)." }, { v: (p + q) / 2 - d, kind: "sign_error", reason: "f(x - d) 가 오른쪽 d 이동임을 놓치고 반대 방향으로 이동했다." }, { v: ans + e, kind: "other", reason: "수직 이동량 e 를 x 좌표에 더했다." }, { v: p + q, kind: "formula_misuse", reason: "영점의 합을 꼭짓점 x 좌표로 골랐다(2 로 나누지 않음)." }, { v: (p + q) / 2 + d + e, kind: "other", reason: "수직 이동량 e 를 x 좌표에 더했다." }, { v: -ans, kind: "sign_error", reason: "부호를 반대로 적었다." }],
        verificationJs: withParams({ p, q, s, d, e }, "const f=x=>P.s*(x-P.p)*(x-P.q), g=x=>f(x-P.d)+P.e; let best=null, bx=null; for(let x=-120;x<=120;x++){ const y=g(x); if(best===null || (P.s>0? y<best : y>best)){ best=y; bx=x; } } return bx;"),
        trace: [T(`f 의 영점은 x = ${p}, ${q} 이다.`, "Read the zeros of f."), T(`영점의 중점이 꼭짓점의 x 좌표이므로 (${p} + ${pn(q)})/2 = ${(p + q) / 2} 이다.`, "The vertex lies midway between the zeros."), T(`g(x) = f(x ${d < 0 ? "+" : "-"} ${Math.abs(d)}) + (상수) 이므로 그래프는 오른쪽으로 ${d} 만큼 이동한다(음수면 왼쪽).`, "Interpret the horizontal shift."), T("위·아래 이동 e 는 꼭짓점의 y 좌표만 바꾼다.", "The vertical shift does not change the x-coordinate."), T(`꼭짓점의 x 좌표는 ${(p + q) / 2} + ${pn(d)} = ${ans} 이다.`, "Add the horizontal shift.")],
        variant: "zeros_and_translation",
      });
    },
  },
  {
    id: "nf.vertex_x.repr_shift", skill: SKILL, kind: "vertex_x", operator: "repr_shift",
    structure: "F 피트의 울타리로 직사각형 우리를 만드는 문장에서 넓이 함수 A(x) 를 세워 넓이가 최대인 폭(또는 길이)을 구한다",
    extraThinking: "울타리 길이 조건을 식으로 모델링해 넓이 이차함수를 세우고 꼭짓점을 해석 — medium 은 이미 식으로 주어진 함수의 꼭짓점",
    concepts: ["문장 모델링(울타리·넓이)", "이차함수의 최댓값 위치", "꼭짓점"], mediumSteps: 2,
    generate(rng) {
      const F = rng.int(6, 24) * 4; const barn = rng.chance(0.55); const ask = rng.pick(["width", "length"] as const); const xw = F / 4; const len = barn ? F - 2 * xw : F / 2 - xw; const ans = ask === "width" ? xw : len;
      const ctx = rng.pick(["pen", "play area", "garden bed", "enclosure", "dog run"] as const);
      const Lexpr = barn ? `${F} - 2x` : `${F / 2} - x`;
      return finishA(rng, {
        stimulus: barn ? `A farmer has ${F} feet of fencing to build a rectangular ${ctx} along one side of a barn. The fencing is used on the three sides that are not the barn wall. The width of the ${ctx}, the side perpendicular to the barn, is x feet.` : `A farmer has ${F} feet of fencing to build a rectangular ${ctx}. The fencing is used on all four sides. The width of the ${ctx} is x feet.`,
        question: ask === "width" ? spin(rng, `[[The farmer wants the ${ctx} to have the greatest possible area. What should the width be, in feet?|For the greatest possible area, what is the width of the ${ctx}, in feet?|What width, in feet, gives the ${ctx} its maximum area?]]`) : spin(rng, `[[The farmer wants the ${ctx} to have the greatest possible area. What should the length be, in feet?|For the greatest possible area, what is the length of the ${ctx}, in feet?|What length, in feet, gives the ${ctx} its maximum area?]]`), correct: ans,
        wrongs: [{ v: ask === "width" ? len : xw, kind: "other", reason: "묻는 변이 아닌 다른 변을 골랐다." }, { v: F / 2, kind: "formula_misuse", reason: "울타리 길이의 절반을 폭으로 골랐다." }, { v: F / 3, kind: "formula_misuse", reason: "세 변에 같은 길이를 쓴다고 가정했다." }, { v: F / 8, kind: "formula_misuse", reason: "꼭짓점 공식에서 계수 2 를 두 번 나눴다." }, { v: F, kind: "step_missing", reason: "식을 세우지 않고 울타리 전체 길이를 골랐다." }, { v: ans + 2, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ F, barn: barn ? 1 : 0, ask: ask === "width" ? 0 : 1 }, "let best=-1, bw=0; for(let x=1;x<P.F;x++){ const L=P.barn? P.F-2*x : P.F/2-x; if(L<=0) continue; const A=x*L; if(A>best){ best=A; bw=x; } } const L=P.barn? P.F-2*bw : P.F/2-bw; return P.ask===0? bw : L;"),
        trace: [T(barn ? `울타리는 폭 2개와 길이 1개에 쓰이므로 2x + (길이) = ${F} 이고 길이는 ${F} - 2x 이다.` : `울타리는 폭 2개와 길이 2개에 쓰이므로 2x + 2(길이) = ${F} 이고 길이는 ${F / 2} - x 이다.`, "Express the length with the fencing constraint."), T(`넓이 A(x) = x(${Lexpr}) 이다.`, "Area is width times length."), T(`전개하면 A(x) = ${barn ? `-2x^2 + ${F}x` : `-x^2 + ${F / 2}x`} 로 위로 볼록한 이차함수이다.`, "Expand: a downward-opening quadratic."), T(`꼭짓점의 x 좌표 = ${barn ? `${F}/(2·2)` : `${F / 2}/(2·1)`} = ${xw} 이다.`, "The maximum occurs at the vertex."), T(`폭은 ${xw}, 길이는 ${Lexpr.replace("x", String(xw))} = ${len} 이므로 묻는 값은 ${ans} 이다.`, "Answer the question asked.")],
        variant: barn ? "three_sides_barn" : "four_sides",
        semantics: [rectSem("area", "x", Lexpr, { x: 3 })],
      });
    },
  },
  {
    id: "nf.vertex_x.chain2", skill: SKILL, kind: "vertex_x", operator: "chain2",
    structure: "f 의 꼭짓점 x좌표 h 를 구해 g(x) = a₂x² + hx + c₂ 의 계수로 쓰고 g 의 꼭짓점 x좌표 -h/(2a₂) 를 구한다",
    extraThinking: "앞 단계의 꼭짓점 좌표가 뒤 함수의 계수가 되는 2단계 연쇄 — medium 은 한 함수의 꼭짓점 x좌표",
    concepts: ["꼭짓점 공식", "연쇄 대입", "계수 해석"], mediumSteps: 2,
    generate(rng) {
      const a1 = rng.pick([1, 2, -1, -2]), h = rng.nz(-6, 6), a2 = rng.pick([1, 2, -1, -2]); if ((h % (2 * a2)) !== 0 || h === 0) throw new GenFail("x"); const b1 = -2 * a1 * h, c1 = rng.int(-6, 6), c2 = rng.int(-8, 8); const ans = -h / (2 * a2); if (ans === h || Math.abs(b1) > 40) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[Let h be the x-coordinate of the vertex of the graph of the function f|Let h represent the x-coordinate of the vertex of the graph of f|Suppose h is the x-coordinate of the vertex of the graph of f]], where `) + M(f2(a1, b1, c1)) + spin(rng, `. [[A second function g is defined using h|Then a second function g is defined with that value of h|The function g is defined below, where h is that value]]:\n\n`) + M(`g(x) = ${quadStr(a2, 0, 0)} + hx ${c2 < 0 ? "-" : "+"} ${Math.abs(c2)}`),
        question: spin(rng, "[[What is the x-coordinate of the vertex of the graph of g?|What is the x-coordinate of the vertex of the graph of y = g(x)?|At what value of x does the graph of g have its vertex?]]"), correct: ans,
        wrongs: [{ v: h, kind: "step_missing", reason: "f 의 꼭짓점 x 좌표 h 에서 멈췄다." }, { v: -h / a2, kind: "formula_misuse", reason: "g 의 꼭짓점 공식에서 분모의 2 를 빠뜨렸다." }, { v: h / (2 * a2), kind: "sign_error", reason: "꼭짓점 공식 -b/(2a) 의 부호를 놓쳤다." }, { v: -h, kind: "step_missing", reason: "g 의 최고차 계수로 나누지 않았다." }, { v: b1 / (2 * a1), kind: "sign_error", reason: "f 의 꼭짓점 공식에서 부호를 놓쳤다." }, { v: ans + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ a1, b1, c1, a2, c2 }, "const f=x=>P.a1*x*x+P.b1*x+P.c1; let bx=null, best=null; for(let x=-100;x<=100;x++){ const y=f(x); if(best===null||(P.a1>0? y<best : y>best)){ best=y; bx=x; } } const h=bx; const g=x=>P.a2*x*x+h*x+P.c2; let gx=null, gb=null; for(let x=-100;x<=100;x++){ const y=g(x); if(gb===null||(P.a2>0? y<gb : y>gb)){ gb=y; gx=x; } } return gx;"),
        trace: [T(`f 의 꼭짓점 x 좌표 h = -(${b1})/(2·${a1}) = ${h} 이다.`, "Find h with the vertex formula."), T(`g(x) 에 h = ${h} 를 대입하면 g(x) = ${quadStr(a2, h, c2)} 이다.`, "Substitute h into g."), T(`g 의 x 계수는 ${h}, x² 계수는 ${a2} 이다.`, "Read the coefficients of g."), T(`꼭짓점 공식: x = -(${h})/(2·${a2}).`, "Apply the vertex formula to g."), T(`계산하면 ${ans} 이다.`, "Evaluate.")],
        variant: "vertex_then_vertex",
      });
    },
  },

  // ───────────── vertex_y ─────────────
  {
    id: "nf.vertex_y.inverse", skill: SKILL, kind: "vertex_y", operator: "inverse",
    structure: "a, 꼭짓점의 x좌표 h, y절편 c₀ 가 주어진 함수에서 b 를 역산해 최댓값/최솟값 f(h) 를 구한다",
    extraThinking: "꼭짓점 위치 조건에서 b 를 역산하고 최대·최소 여부(a 의 부호)를 판단해 꼭짓점의 y 값을 구함 — medium 은 표준형의 최솟값 계산",
    concepts: ["꼭짓점 공식", "y절편", "최대·최소 판단"], mediumSteps: 2,
    generate(rng) {
      const a = rng.pick([-3, -2, -1, 1, 2, 3]), h = rng.nz(-5, 6), c0 = rng.int(-9, 9); const b = -2 * a * h; const ans = c0 - a * h * h; if (Math.abs(b) > 40 || Math.abs(ans) > 300 || ans === c0) throw new GenFail("x");
      const L = a > 0 ? "minimum" : "maximum";
      return finishA(rng, {
        stimulus: spin(rng, `[[In the function below|For the function f defined below|Consider the function below]], b is a constant. The graph of the function in the xy-plane has its vertex at x = ${h} and crosses the y-axis at the point (0, ${c0}).\n\n`) + M(`f(x) = ${quadStr(a, 0, 0)} + bx ${c0 < 0 ? "-" : "+"} ${Math.abs(c0)}`),
        question: spin(rng, `[[What is the ${L} value of f?|What is the ${L} value of the function f?|Find the ${L} value of f.]]`), correct: ans,
        wrongs: [{ v: c0 + a * h * h, kind: "sign_error", reason: "f(h) 에서 b 의 부호를 놓쳐 c + a h² 로 계산했다." }, { v: c0, kind: "step_missing", reason: "y절편을 최댓값/최솟값으로 골랐다." }, { v: h, kind: "axis_misread", reason: "꼭짓점의 x 좌표를 y 값으로 골랐다." }, { v: -ans, kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: c0 - a * h, kind: "formula_misuse", reason: "f(h) 에서 h 를 제곱하지 않았다." }, { v: c0 - 2 * a * h * h, kind: "formula_misuse", reason: "f(h) = a h² + b h + c 에서 b h 를 두 번 반영했다." }],
        verificationJs: withParams({ a, h, c0 }, "const hits=[]; for(let b=-80;b<=80;b++){ const f=x=>P.a*x*x+b*x+P.c0; let ex=null, best=null; for(let x=-60;x<=60;x++){ const y=f(x); if(best===null||(P.a>0? y<best : y>best)){ best=y; ex=x; } } if(ex===P.h && f(ex-1)===f(ex+1)) hits.push(best); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`최고차 계수 ${a} 가 ${a > 0 ? "양수라 아래로 볼록하므로 꼭짓점이 최솟값" : "음수라 위로 볼록하므로 꼭짓점이 최댓값"} 이다.`, "The sign of a decides minimum or maximum."), T(`꼭짓점의 x 좌표가 ${h} 이므로 -b/(2·${a}) = ${h}, 즉 b = ${b} 이다.`, "Solve for b with the vertex formula."), T(`y절편이 ${c0} 이므로 상수항은 ${c0} 이다.`, "Read the constant term."), T(`f(${h}) = ${a}·${h * h} + ${pn(b)}·${pn(h)} + ${pn(c0)}.`, "Evaluate f at the vertex."), T(`계산하면 ${ans} 이다.`, "Compute.")],
        variant: a > 0 ? "minimum_value" : "maximum_value",
      });
    },
  },
  {
    id: "nf.vertex_y.compose_kind", skill: SKILL, kind: "vertex_y", operator: "compose_kind",
    structure: "f(x) = x²+bx+c 의 최솟값을 구하고 g(x) = u·f(x)+v 로 변환해 g 의 최댓값(u<0) 또는 최솟값(u>0)을 구한다",
    extraThinking: "함수의 상수배·평행이동이 꼭짓점의 y값에 어떻게 반영되는지(부호가 바뀌면 최소→최대)를 결합 — medium 은 한 함수의 최솟값",
    concepts: ["완전제곱식(꼭짓점)", "함수의 변환", "최대·최소 판단"], mediumSteps: 2,
    generate(rng) {
      const b = rng.pick([-1, 1]) * 2 * rng.int(1, 6), c = rng.int(-9, 9), u = rng.pick([-3, -2, 2, 3]), v = rng.nz(-9, 9); const fmin = c - (b * b) / 4; const ans = u * fmin + v; if (Math.abs(ans) > 300 || fmin === 0) throw new GenFail("x");
      const L = u > 0 ? "minimum" : "maximum";
      return finishA(rng, {
        stimulus: spin(rng, `[[The function f is defined by the equation below|Let f be the function defined below|A quadratic function f is given below]]: `) + M(`f(x) = ${quadStr(1, b, c)}`) + `. The function g is defined by ` + M(`g(x) = ${u}f(x) ${v < 0 ? "-" : "+"} ${Math.abs(v)}`) + ".",
        question: spin(rng, `[[What is the ${L} value of g?|What is the ${L} value of the function g?|Find the ${L} value of g.]]`), correct: ans,
        wrongs: [{ v: fmin, kind: "step_missing", reason: "f 의 최솟값에서 멈췄다." }, { v: u * fmin, kind: "step_missing", reason: "상수 v 를 더하지 않았다." }, { v: fmin + v, kind: "step_missing", reason: "상수배 u 를 곱하지 않았다." }, { v: u * (fmin + v), kind: "formula_misuse", reason: "u 를 v 에도 곱했다." }, { v: -ans, kind: "sign_error", reason: "부호를 반대로 적었다." }, { v: u * c + v, kind: "formula_misuse", reason: "꼭짓점 y 값 대신 y절편으로 계산했다." }],
        verificationJs: withParams({ b, c, u, v }, "const g=x=>P.u*(x*x+P.b*x+P.c)+P.v; let best=null; for(let x=-100;x<=100;x++){ const y=g(x); if(best===null||(P.u>0? y<best : y>best)) best=y; } return best;"),
        trace: [T(`f(x) = ${quadStr(1, b, c)} 를 완전제곱식으로 쓰면 꼭짓점의 y 값(최솟값)은 ${c} - ${b * b}/4 = ${fmin} 이다.`, "Find the minimum of f."), T(`g(x) = ${u}f(x) ${v < 0 ? "-" : "+"} ${Math.abs(v)} 이다.`, "Write g in terms of f."), T(`u = ${u} 이므로 g 는 ${u > 0 ? "아래로 볼록해 최솟값" : "위로 볼록해 최댓값"} 을 가진다.`, "A negative multiple flips the parabola."), T(`g 의 극값은 ${u}·${pn(fmin)} ${v < 0 ? "-" : "+"} ${Math.abs(v)} 이다.`, "Apply the transformation to the vertex value."), T(`계산하면 ${ans} 이다.`, "Compute.")],
        variant: u > 0 ? "scaled_min" : "scaled_max",
      });
    },
  },
  {
    id: "nf.vertex_y.repr_shift", skill: SKILL, kind: "vertex_y", operator: "repr_shift",
    structure: "가격 p 와 판매량 D-mp 에서 매출 R(p)=p(D-mp) 를 세우고 최대 매출을 구한다",
    extraThinking: "문장(가격·판매량)에서 매출 이차함수를 모델링하고 꼭짓점의 y 값을 최대 매출로 해석 — medium 은 이미 식으로 주어진 함수의 최댓값",
    concepts: ["문장 모델링(매출=가격×판매량)", "이차함수 최댓값", "꼭짓점 y 좌표"], mediumSteps: 2,
    generate(rng) {
      const m = rng.int(1, 5), ps = rng.int(3, 14), D = 2 * m * ps; if (D > 90) throw new GenFail("x"); const ans = m * ps * ps;
      const ctx = rng.pick([["shop", "mugs", "mug"], ["bakery", "cakes", "cake"], ["theater", "tickets", "ticket"], ["school store", "hoodies", "hoodie"], ["farm stand", "baskets of fruit", "basket"]] as const);
      return finishA(rng, {
        stimulus: `A ${ctx[0]} sells ${ctx[1]} at a price of p dollars per ${ctx[2]}. At that price, it sells ${D} - ${m}p ${ctx[1]} per day.`,
        question: spin(rng, "[[What is the maximum possible revenue per day, in dollars?|Over all prices, what is the greatest possible daily revenue, in dollars?|What is the largest daily revenue it can earn, in dollars?]]"), correct: ans,
        wrongs: [{ v: ps, kind: "axis_misread", reason: "최대 매출이 아니라 매출을 최대로 하는 가격을 골랐다." }, { v: D, kind: "step_missing", reason: "가격이 0일 때의 판매량을 골랐다." }, { v: ps * D, kind: "formula_misuse", reason: "가격 × D 로 계산했다(판매량을 줄이지 않음)." }, { v: (D * D) / (2 * m), kind: "formula_misuse", reason: "꼭짓점 y 값 D²/(4m) 에서 4 대신 2 로 나눴다." }, { v: ans + m, kind: "other", reason: "계산 오류." }, { v: D / m, kind: "formula_misuse", reason: "판매량이 0 이 되는 가격을 골랐다." }],
        verificationJs: withParams({ m, D }, "let best=-1; for(let p=0;p<=P.D/P.m;p++){ const q=P.D-P.m*p; if(q<0) continue; best=Math.max(best,p*q); } return best;"),
        trace: [T(`매출 = 가격 × 판매량 이므로 R(p) = p(${D} - ${m}p) 이다.`, "Revenue is price times quantity."), T(`전개하면 R(p) = -${m}p² + ${D}p 로 위로 볼록한 이차함수이다.`, "Expand: a downward-opening quadratic."), T(`최대는 꼭짓점에서 생기고 p = ${D}/(2·${m}) = ${ps} 이다.`, "The maximum is at the vertex."), T(`R(${ps}) = ${ps}(${D} - ${m}·${ps}) 를 계산한다.`, "Evaluate the revenue at that price."), T(`최대 매출은 ${ans} 달러이다.`, "State the answer.")],
        variant: "maximize_revenue",
        semantics: [{ noun: "revenue", expr: `p(${D} - ${m}p)`, parts: ["p", `${D} - ${m}p`], vars: { p: 3 } }],
      });
    },
  },
  {
    id: "nf.vertex_y.compare_scenarios", skill: SKILL, kind: "vertex_y", operator: "compare_scenarios",
    structure: "두 이차 모델 h₁(t), h₂(t) 의 최댓값을 각각 구해 그 차이를 구한다",
    extraThinking: "두 모델 각각의 꼭짓점 y 값을 구해 비교(두 경우의 최댓값 비교) — medium 은 한 모델의 최댓값",
    concepts: ["꼭짓점 y 값", "두 모델 비교", "차 계산"], mediumSteps: 2,
    generate(rng) {
      const mk = () => { const a = rng.pick([-1, -2]), hv = rng.int(1, 6), c0 = rng.int(0, 12); return { a, hv, c0, b: -2 * a * hv, max: c0 - a * hv * hv }; };
      const A = mk(), B = mk(); if (A.max === B.max || A.hv === B.hv) throw new GenFail("x"); const hi = A.max > B.max ? A : B, lo = hi === A ? B : A; const ans = hi.max - lo.max; if (ans > 80) throw new GenFail("x");
      const ctx = rng.pick([["rocket", "A", "B"], ["fountain jet", "first", "second"], ["thrown ball", "first", "second"], ["water balloon", "first", "second"]] as const);
      const eq = (o: typeof A, n: string) => M(`${n}(t) = ${quadStr(o.a, o.b, o.c0, "t")}`);
      return finishA(rng, {
        stimulus: `The heights, in feet, of two ${ctx[0]}s t seconds after launch are modeled by the functions below.\n\n${eq(A, "h")}\n${eq(B, "k")}`,
        question: spin(rng, "[[By how many feet is the greater maximum height greater than the lesser maximum height?|What is the difference, in feet, between the two maximum heights?|How many feet higher is the greater of the two maximum heights than the lesser?]]"), correct: ans,
        wrongs: [{ v: A.max + B.max, kind: "formula_misuse", reason: "두 최대 높이의 합을 골랐다." }, { v: Math.abs(A.c0 - B.c0), kind: "step_missing", reason: "처음 높이(y절편)의 차를 골랐다." }, { v: Math.abs(A.hv - B.hv), kind: "axis_misread", reason: "최대가 되는 시각의 차를 골랐다." }, { v: ans + 1, kind: "other", reason: "계산 오류." }, { v: Math.max(1, ans - 1), kind: "other", reason: "계산 오류." }, { v: hi.max, kind: "step_missing", reason: "더 큰 최대 높이 자체를 골랐다." }],
        verificationJs: withParams({ a1: A.a, b1: A.b, c1: A.c0, a2: B.a, b2: B.b, c2: B.c0 }, "const mx=(a,b,c)=>{ let best=null; for(let t=-100;t<=100;t++){ const y=a*t*t+b*t+c; if(best===null||y>best) best=y; } return best; }; return Math.abs(mx(P.a1,P.b1,P.c1)-mx(P.a2,P.b2,P.c2));"),
        trace: [T(`첫 번째 모델의 꼭짓점: t = -${A.b}/(2·${pn(A.a)}) = ${A.hv}, 최대 높이 ${A.max} 이다.`, "Maximum of the first model."), T(`두 번째 모델의 꼭짓점: t = ${B.hv}, 최대 높이 ${B.max} 이다.`, "Maximum of the second model."), T("두 최대 높이를 비교한다.", "Compare the two maxima."), T(`더 큰 값 ${hi.max} 에서 작은 값 ${lo.max} 을 뺀다.`, "Subtract the smaller maximum from the larger."), T(`차이는 ${ans} 피트이다.`, "State the difference.")],
        variant: "compare_two_maxima",
      });
    },
  },

  // ───────────── find_x_for_value (지수) ─────────────
  {
    id: "nf.find_x_for_value.inverse", skill: SKILL, kind: "find_x_for_value", operator: "inverse",
    structure: "지수함수 f(t)=a·b^t 의 두 시점의 값으로 b 와 a 를 역산한 뒤 주어진 값 w 가 되는 시점을 구한다",
    extraThinking: "두 값의 비에서 b 를 역산하고 a 를 구한 뒤 지수 방정식을 푸는 3단 역방향 재구성 — medium 은 a, b 가 주어진 모델에서 시점을 구함",
    concepts: ["지수함수의 비", "계수 역산", "지수 방정식"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(2, 12), b = rng.pick([2, 3]), p = rng.int(0, 2), q = p + rng.int(2, 3), t0 = q + rng.int(1, 3); const u = a * b ** p, v = a * b ** q, w = a * b ** t0; if (w > 999 || v > 999 || p === 0 && false) throw new GenFail("x");
      const g = grow(rng);
      return finishA(rng, {
        stimulus: `The number of ${g} is modeled by the function ${M("N(t) = a \\cdot b^t")}, where a and b are positive constants and t is the number of days since the first measurement. The model gives N(${p}) = ${u} and N(${q}) = ${v}.`,
        question: spin(rng, `[[For what value of t is N(t) equal to ${w}?|At what time t does the model give ${w}?|Find the value of t for which N(t) = ${w}.]]`), correct: t0,
        wrongs: [{ v: q, kind: "step_missing", reason: "주어진 두 시점 중 하나를 골랐다." }, { v: t0 + 1, kind: "other", reason: "지수를 하나 크게 셌다." }, { v: t0 - 1, kind: "other", reason: "지수를 하나 작게 셌다." }, { v: Math.round(w / v) + q, kind: "formula_misuse", reason: "비를 시점에 그대로 더했다." }, { v: w / b ** 0 / a, kind: "formula_misuse", reason: "w/a 의 값(b^t)을 t 로 골랐다." }, { v: t0 - p, kind: "other", reason: "첫 시점의 기준을 잘못 적용했다." }],
        verificationJs: withParams({ p, u, q, v, w }, "const hits=new Set(); for(let a=1;a<=200;a++) for(let b=2;b<=8;b++){ if(a*b**P.p===P.u && a*b**P.q===P.v){ for(let t=0;t<=40;t++) if(a*b**t===P.w) hits.add(t); } } if(hits.size!==1) throw new Error('유일하지 않음'); return [...hits][0];"),
        trace: [T(`두 값의 비: N(${q})/N(${p}) = ${v}/${u} = b^${q - p} 이다.`, "Divide the two values."), T(`b^${q - p} = ${v / u} 이므로 b = ${b} 이다.`, "Solve for b."), T(`N(${p}) = a·${b}^${p} = ${u} 이므로 a = ${a} 이다.`, "Solve for a."), T(`${a}·${b}^t = ${w} 에서 ${b}^t = ${w / a} 이다.`, "Isolate the exponential."), T(`${b}^${t0} = ${w / a} 이므로 t = ${t0} 이다.`, "Solve the exponent.")],
        variant: "two_points_then_solve",
      });
    },
  },
  {
    id: "nf.find_x_for_value.constraint_select", skill: SKILL, kind: "find_x_for_value", operator: "constraint_select",
    structure: "b^(2x) + c·b^x - d = 0 을 u = b^x 로 치환해 얻은 두 근 중 양수(u>0)만 택해 x 를 구한다",
    extraThinking: "치환 후 나온 음수 u 는 b^x 가 될 수 없다는 제약으로 후보를 제거하고 지수 방정식을 풂 — medium 은 b^x = 상수 꼴을 한 번 풂",
    concepts: ["치환(u=b^x)", "이차방정식 인수분해", "지수의 양수 제약"], mediumSteps: 2,
    generate(rng) {
      const b = rng.pick([2, 3]), p = rng.int(1, 3), e = rng.int(1, 9); const u1 = b ** p; const c = e - u1, d = e * u1; if (c === 0 || d > 400) throw new GenFail("x");
      return finishA(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below has exactly one real solution|For the equation shown, x is a real number]]. `) + M(`${b}^{2x} ${c < 0 ? "-" : "+"} ${Math.abs(c)}(${b}^{x}) - ${d} = 0`),
        question: spin(rng, "[[What is the value of x that satisfies the equation?|What is the solution of the equation?|Find the real solution of the equation.]]"), correct: p,
        wrongs: [{ v: u1, kind: "step_missing", reason: "치환한 u = b^x 의 값을 x 로 골랐다." }, { v: -e, kind: "condition_ignored", reason: "음수 u 도 b^x 로 가능하다고 보고 그 값을 골랐다." }, { v: p + 1, kind: "other", reason: "지수를 하나 크게 셌다." }, { v: Math.max(0, p - 1), kind: "other", reason: "지수를 하나 작게 셌다." }, { v: e, kind: "step_missing", reason: "음수 근의 크기를 x 로 골랐다." }, { v: d, kind: "formula_misuse", reason: "상수항을 답으로 골랐다." }],
        verificationJs: withParams({ b, c, d }, "const sols=[]; for(let x=-6;x<=10;x++) if(Math.abs(P.b**(2*x)+P.c*P.b**x-P.d)<1e-9) sols.push(x); if(sols.length!==1) throw new Error('해가 유일하지 않음'); return sols[0];"),
        trace: [T(`u = ${b}^x 로 치환하면 ${b}^(2x) = u² 이므로 $u^2 ${c < 0 ? "-" : "+"} ${Math.abs(c)}u - ${d} = 0$ 이다.`, "Substitute u = b^x."), T(`인수분해하면 (u - ${u1})(u + ${e}) = 0 이므로 u = ${u1} 또는 u = ${-e} 이다.`, "Factor."), T(`${b}^x 는 항상 양수이므로 u = ${-e} 는 불가능하다.`, "An exponential is always positive."), T(`${b}^x = ${u1} 이다.`, "Keep the positive root."), T(`${u1} = ${b}^${p} 이므로 x = ${p} 이다.`, "Solve the exponent.")],
        variant: "substitution_positive_root",
      });
    },
  },
  {
    id: "nf.find_x_for_value.chain2", skill: SKILL, kind: "find_x_for_value", operator: "chain2",
    structure: "지수함수 P(t)=a·b^t 가 값 w 가 되는 시점 T 를 구한 뒤 일차함수 Q(t)=mt+n 에 T 를 대입한다",
    extraThinking: "지수 방정식의 해가 다른 함수의 입력이 되는 연쇄 — medium 은 지수 방정식의 해 한 번",
    concepts: ["지수 방정식", "일차함수의 값", "연쇄 대입"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(1, 9), b = rng.pick([2, 3]), T0 = rng.int(1, 6), w = a * b ** T0, m = rng.nz(-5, 8), n = rng.int(-9, 9); if (w > 999) throw new GenFail("x"); const ans = m * T0 + n; if (ans === T0 || ans === 0) throw new GenFail("x");
      const g = grow(rng);
      return finishA(rng, {
        stimulus: `The number of ${g} t hours after a measurement begins is given by ${M(`P(t) = ${a} \\cdot ${b}^t`)}. Let T be the time at which P(T) = ${w}. A second quantity is given by ${M(`Q(t) = ${lin(m, n, "t")}`)}.`,
        question: spin(rng, "[[What is the value of Q(T)?|What is Q(T)?|Find the value of Q(T).]]"), correct: ans,
        wrongs: [{ v: T0, kind: "step_missing", reason: "T 만 구했다." }, { v: m * w + n, kind: "formula_misuse", reason: "T 대신 P(T) = w 를 Q 에 넣었다." }, { v: m * (T0 + 1) + n, kind: "other", reason: "지수를 하나 크게 셌다." }, { v: m * (T0 - 1) + n, kind: "other", reason: "지수를 하나 작게 셌다." }, { v: m + n, kind: "step_missing", reason: "t = 1 을 넣었다." }, { v: -ans, kind: "sign_error", reason: "부호를 반대로 적었다." }],
        verificationJs: withParams({ a, b, w, m, n }, "let T=null; for(let t=0;t<=40;t++) if(P.a*P.b**t===P.w){ if(T!==null) throw new Error('T 유일하지 않음'); T=t; } if(T===null) throw new Error('T 없음'); return P.m*T+P.n;"),
        trace: [T(`P(T) = ${a}·${b}^T = ${w} 이므로 ${b}^T = ${w / a} 이다.`, "Isolate the exponential."), T(`${w / a} = ${b}^${T0} 이므로 T = ${T0} 이다.`, "Solve the exponent."), T(`Q(t) = ${lin(m, n, "t")} 에 t = ${T0} 를 대입한다.`, "Use T as the input of Q."), T(`Q(${T0}) = ${m}·${T0} + ${pn(n)}.`, "Substitute."), T(`계산하면 ${ans} 이다.`, "Compute.")],
        variant: "exponent_solution_then_linear",
      });
    },
  },
  {
    id: "nf.find_x_for_value.compose_kind", skill: SKILL, kind: "find_x_for_value", operator: "compose_kind",
    structure: "서로 다른 거듭제곱 밑(2,4,8 또는 3,9,27)을 가진 지수식 b1^(a1x+α) = b2^(a2x+β) 를 같은 밑으로 맞춰 일차방정식으로 푼다",
    extraThinking: "밑을 통일(지수 법칙)하고 지수의 일차방정식을 세워 푸는 개념의 결합 — medium 은 한 변이 상수인 지수 방정식",
    concepts: ["밑의 통일(지수 법칙)", "일차방정식", "지수 방정식"], mediumSteps: 2,
    generate(rng) {
      const r = rng.pick([2, 3]), i = rng.int(1, 3), j = rng.int(1, 3), a1 = rng.pick([1, 2]), a2 = rng.pick([1, 2]), al = rng.int(-4, 5), be = rng.int(-4, 5); if (i === j && a1 === a2 || i * a1 === j * a2) throw new GenFail("x");
      const num = j * be - i * al, den = i * a1 - j * a2; if (num % den !== 0) throw new GenFail("x"); const x0 = num / den; if (Math.abs(x0) > 12 || x0 === 0) throw new GenFail("x");
      const b1 = r ** i, b2 = r ** j; if (b1 === b2 && false) throw new GenFail("x");
      const ex = (a: number, k: number) => `${a === 1 ? "" : a}x ${k < 0 ? "-" : "+"} ${Math.abs(k)}`.replace(/^(\d*)x \+ 0$/, "$1x");
      return finishA(rng, {
        stimulus: spin(rng, `[[Consider the equation below|The equation below has exactly one real solution|For the equation shown, x is a real number]]. `) + M(`${b1}^{${ex(a1, al)}} = ${b2}^{${ex(a2, be)}}`),
        question: spin(rng, "[[What is the solution of the equation?|What is the value of x that satisfies the equation?|Find the value of x.]]"), correct: x0,
        wrongs: [{ v: -x0, kind: "sign_error", reason: "일차방정식을 풀 때 부호를 놓쳤다." }, { v: al - be, kind: "formula_misuse", reason: "밑이 달라도 지수를 직접 같게 놓았다(밑을 통일하지 않음)." }, { v: be - al, kind: "formula_misuse", reason: "밑을 통일하지 않고 지수 상수만 비교했다." }, { v: (j * be - i * al) / (i * a1 + j * a2), kind: "sign_error", reason: "x 계수를 정리할 때 부호를 놓쳤다." }, { v: x0 + 1, kind: "other", reason: "계산 오류." }, { v: Math.round(num), kind: "step_missing", reason: "x 계수로 나누지 않았다." }],
        verificationJs: withParams({ b1, a1, al, b2, a2, be }, "const hits=[]; for(let x=-30;x<=30;x++){ const l=Math.pow(P.b1,P.a1*x+P.al), r=Math.pow(P.b2,P.a2*x+P.be); if(Math.abs(l-r)<=1e-9*Math.max(Math.abs(l),Math.abs(r))) hits.push(x); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`${b1} = ${r}^${i}, ${b2} = ${r}^${j} 이므로 두 밑을 ${r} 로 통일한다.`, "Rewrite both bases with the same prime."), T(`좌변의 지수는 ${i}(${ex(a1, al)}), 우변의 지수는 ${j}(${ex(a2, be)}) 이다.`, "Multiply the exponents by the base powers."), T("밑이 같으므로 지수를 같게 놓는다.", "Equal bases mean equal exponents."), T(`${i * a1}x ${i * al < 0 ? "-" : "+"} ${Math.abs(i * al)} = ${j * a2}x ${j * be < 0 ? "-" : "+"} ${Math.abs(j * be)} 로 정리한다.`, "Write the linear equation."), T(`x 항을 모으면 ${i * a1 - j * a2}x = ${num} 이므로 x = ${x0} 이다.`, "Solve for x.")],
        variant: "same_base_linear",
      });
    },
  },

  // ───────────── interpret_a ─────────────
  {
    id: "nf.interpret_a.unit_ratio", skill: SKILL, kind: "interpret_a", operator: "unit_ratio",
    structure: "N(t)=a·2^(t/τ) (t 는 작은 단위)에서 큰 단위 한 개 뒤의 값 V 로부터 초기값 a 를 구한다",
    extraThinking: "시간 단위 환산(1일=24시간 등)으로 지수를 정리하고 a 가 t=0 의 값임을 해석 — medium 은 단위 환산 없이 초기값 읽기",
    concepts: ["단위 환산", "지수함수의 초기값", "배가 주기"], mediumSteps: 2,
    generate(rng) {
      const [tu, , bu, f] = rng.pick(UNITS); const taus = f === 24 ? [6, 8, 12] : f === 60 ? [15, 20, 30] : [3, 4, 6]; const tau = rng.pick(taus), k = f / tau; const a = rng.int(2, 60); const V = a * 2 ** k; if (V > 999) throw new GenFail("x");
      const g = grow(rng);
      return finishA(rng, {
        stimulus: `The number of ${g} is modeled by the function ${M(`N(t) = a \\cdot 2^{t/${tau}}`)}, where a is a positive constant and t is the number of ${tu} since the first measurement. One ${bu} after the first measurement, the model gives a value of ${V}.`,
        question: spin(rng, "[[What is the value of a, the number at the first measurement?|What does the model give for the number at t = 0?|What is the initial value of N?]]"), correct: a,
        wrongs: [{ v: V / 2, kind: "formula_misuse", reason: "한 주기(배가 한 번)만 지났다고 보고 V 를 2 로만 나눴다." }, { v: V / (f / tau + 1), kind: "formula_misuse", reason: "지수 대신 선형으로 나눴다." }, { v: V / f, kind: "unit_error", reason: "지수가 아니라 단위 환산 값으로 V 를 나눴다." }, { v: V / 2 ** (f / tau - 1), kind: "step_missing", reason: "주기 수를 하나 적게 세었다." }, { v: V / 2 ** (f / tau + 1), kind: "step_missing", reason: "주기 수를 하나 많게 세었다." }, { v: V, kind: "step_missing", reason: "V 를 그대로 초기값으로 골랐다." }],
        verificationJs: withParams({ tau, V }, `const f=${f}; const hits=[]; for(let a=1;a<=500;a++){ if(Math.abs(a*Math.pow(2,f/P.tau)-P.V)<1e-9) hits.push(a); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`),
        trace: [T(`1 ${bu} = ${f} ${tu} 이므로 t = ${f} 를 대입한다.`, "Convert one larger unit into the model's unit."), T(`N(${f}) = a·2^(${f}/${tau}) = a·2^${k} 이다.`, "Substitute into the model."), T(`2^${k} = ${2 ** k} 이므로 ${2 ** k}a = ${V} 이다.`, "Evaluate the power."), T(`a = ${V}/${2 ** k} = ${a} 이다.`, "Solve for a."), T(`a 는 t = 0 일 때의 값이므로 초기값은 ${a} 이다.`, "a is the value at t = 0.")],
        variant: "unit_conversion_initial_value",
      });
    },
  },
  {
    id: "nf.interpret_a.repr_shift", skill: SKILL, kind: "interpret_a", operator: "repr_shift",
    structure: "지수함수의 표 값 f(1), f(2), f(3) 에서 공비 b 를 구한 뒤 t = 0 의 값(초기값 a)을 구한다",
    extraThinking: "표에서 지수 모델을 세우는 모델링(연속 값의 비 → 밑, 한 칸 거슬러 올라가 초기값) — medium 은 식이 주어진 초기값 읽기",
    concepts: ["표에서 식 세우기", "공비", "초기값 해석"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(1, 12), b = rng.pick([2, 3, 4, 5]); const v1 = a * b, v2 = a * b * b, v3 = a * b ** 3; if (v3 > 999) throw new GenFail("x");
      const g = grow(rng);
      return finishA(rng, {
        stimulus: `The number of ${g} is modeled by an exponential function f(t) = a·b^t, where t is the number of weeks since the first measurement. The table gives three values: f(1) = ${v1}, f(2) = ${v2}, and f(3) = ${v3}.`,
        question: spin(rng, "[[What is the value of f(0)?|What is f(0), the number at the first measurement?|What is the initial value of f?]]"), correct: a,
        wrongs: [{ v: v1 - (v2 - v1), kind: "formula_misuse", reason: "지수함수를 일차함수처럼 보고 값의 차를 빼서 거슬러 올라갔다." }, { v: v1 / 2, kind: "formula_misuse", reason: "공비가 2 라고 가정해 f(1) 을 2 로 나눴다." }, { v: b, kind: "step_missing", reason: "공비 b 를 초기값으로 골랐다." }, { v: v1, kind: "step_missing", reason: "f(1) 을 초기값으로 골랐다." }, { v: v1 - a * (b - 1) * 2, kind: "other", reason: "계산 오류." }, { v: a + 1, kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ v1, v2, v3 }, "const hits=[]; for(let a=1;a<=200;a++) for(let b=2;b<=9;b++){ if(a*b===P.v1 && a*b*b===P.v2 && a*b*b*b===P.v3) hits.push(a); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`연속한 값의 비: ${v2}/${v1} = ${b}, ${v3}/${v2} = ${b} 이므로 공비(밑) b = ${b} 이다.`, "Consecutive values share the same ratio."), T(`f(1) = a·${b} = ${v1} 이다.`, "Use f(1)."), T(`a = ${v1}/${b} = ${a} 이다.`, "Solve for a."), T("a 는 t = 0 일 때의 값 f(0) 이다.", "a is f(0)."), T(`따라서 f(0) = ${a} 이다.`, "State the answer.")],
        variant: "table_to_initial_value",
      });
    },
  },
  {
    id: "nf.interpret_a.compare_scenarios", skill: SKILL, kind: "interpret_a", operator: "compare_scenarios",
    structure: "시작량 a₁ 에서 매 시간 b₁ 배, a₂(<a₁) 에서 매 시간 b₂ 배(b₂>b₁) 로 증가하는 두 군집에서 B 가 A 를 처음 넘는 시각을 구한다",
    extraThinking: "초기값이 서로 다른 두 지수 모델을 비교해 역전 시점을 탐색 — medium 은 한 모델의 초기값 해석",
    concepts: ["초기값 비교", "성장 배율 비교", "역전 시점"], mediumSteps: 2,
    generate(rng) {
      const b1 = rng.int(2, 3), b2 = b1 + rng.int(1, 2), a1 = rng.int(20, 90), a2 = rng.int(2, Math.floor(a1 / 2)); let ts = -1; for (let t = 0; t <= 20; t++) if (a2 * b2 ** t > a1 * b1 ** t) { ts = t; break; } if (ts < 2 || ts > 9) throw new GenFail("x");
      return finishA(rng, {
        stimulus: `Colony A starts with ${a1} cells, and the number of cells is multiplied by ${b1} every hour. Colony B starts with ${a2} cells, and the number of cells is multiplied by ${b2} every hour.`,
        question: spin(rng, "[[After how many whole hours will Colony B first have more cells than Colony A?|What is the smallest whole number of hours after which Colony B has more cells than Colony A?|How many hours must pass before Colony B first has more cells than Colony A?]]"), correct: ts,
        wrongs: [{ v: ts - 1, kind: "step_missing", reason: "역전되기 직전 시각을 골랐다." }, { v: ts + 1, kind: "other", reason: "처음 넘는 시각이 아니라 그 다음 시각을 골랐다." }, { v: Math.round(a1 / a2), kind: "formula_misuse", reason: "초기값의 비를 시각으로 골랐다." }, { v: ts - 2, kind: "other", reason: "역전 시점을 앞쪽으로 잘못 추정했다." }, { v: ts + 2, kind: "other", reason: "역전 시점을 뒤쪽으로 잘못 추정했다." }, { v: a1 - a2, kind: "formula_misuse", reason: "초기값의 차를 시각으로 골랐다." }],
        verificationJs: withParams({ a1, b1, a2, b2 }, "for(let t=0;t<=60;t++) if(P.a2*P.b2**t>P.a1*P.b1**t) return t; throw new Error('역전 없음');"),
        trace: [T(`A 의 세포 수는 ${a1}·${b1}^t, B 의 세포 수는 ${a2}·${b2}^t 이다.`, "Write both models."), T(`t = 0 에서는 A(${a1}) > B(${a2}) 이다.`, "Compare the starting values."), T(`t = ${ts - 1} 에서 A = ${a1 * b1 ** (ts - 1)}, B = ${a2 * b2 ** (ts - 1)} 로 아직 B 가 작거나 같다.`, "Check just before the crossing."), T(`t = ${ts} 에서 A = ${a1 * b1 ** ts}, B = ${a2 * b2 ** ts} 로 B 가 처음 더 크다.`, "Find the first t where B exceeds A."), T(`따라서 ${ts} 시간이다.`, "State the answer.")],
        variant: "crossover_time",
      });
    },
  },
  {
    id: "nf.interpret_a.chain2", skill: SKILL, kind: "interpret_a", operator: "chain2",
    structure: "N(t)=a·b^t 의 한 시점 값에서 a 를 구한 뒤 N(0)+N(t₂) (초기값과 나중 값의 합)을 구한다",
    extraThinking: "한 시점의 값으로 초기값 a 를 구하고(앞 단계) 그 a 로 다른 시점의 값과 합을 계산(뒤 단계) — medium 은 초기값 하나",
    concepts: ["지수함수의 초기값", "연쇄 계산", "함숫값"], mediumSteps: 2,
    generate(rng) {
      const a = rng.int(2, 15), b = rng.pick([2, 3]), t1 = rng.int(2, 4), t2 = t1 + rng.int(1, 3); const u = a * b ** t1; const ans = a + a * b ** t2; if (u > 999 || ans > 3000) throw new GenFail("x");
      const g = grow(rng);
      return finishA(rng, {
        stimulus: `The number of ${g} is modeled by the function ${M(`N(t) = a \\cdot ${b}^t`)}, where a is a positive constant and t is the number of days since the first measurement. The model gives N(${t1}) = ${u}.`,
        question: spin(rng, `[[What is the value of N(0) + N(${t2})?|Find N(0) + N(${t2}).|What is the sum of the number at the first measurement and the number ${t2} days later?]]`), correct: ans,
        wrongs: [{ v: a * b ** t2, kind: "step_missing", reason: "N(0) 을 더하지 않았다." }, { v: a, kind: "step_missing", reason: "초기값 N(0) 만 구했다." }, { v: u + u * b ** (t2 - t1), kind: "formula_misuse", reason: "N(0) 대신 N(t1) 을 더했다." }, { v: a + a * b * t2, kind: "formula_misuse", reason: "지수 b^t2 를 곱 b·t2 로 계산했다." }, { v: a + a * b ** (t2 - 1), kind: "step_missing", reason: "지수를 하나 적게 셌다." }, { v: ans + a, kind: "other", reason: "초기값을 두 번 더했다." }],
        verificationJs: withParams({ b, t1, u, t2 }, "const hits=[]; for(let a=1;a<=500;a++) if(a*P.b**P.t1===P.u) hits.push(a); if(hits.length!==1) throw new Error('유일하지 않음'); const a=hits[0]; return a+a*P.b**P.t2;"),
        trace: [T(`N(${t1}) = a·${b}^${t1} = ${u} 이므로 ${b ** t1}a = ${u} 이다.`, "Use the given value."), T(`a = ${a} 이고 a 는 N(0) 이다.`, "Solve for a, which is N(0)."), T(`N(${t2}) = ${a}·${b}^${t2} = ${a * b ** t2} 이다.`, "Evaluate N at the later time."), T("두 값을 더한다.", "Add the two values."), T(`N(0) + N(${t2}) = ${a} + ${a * b ** t2} = ${ans} 이다.`, "State the sum.")],
        variant: "initial_then_later_sum",
      });
    },
  },

  // ───────────── interpret_b ─────────────
  {
    id: "nf.interpret_b.unit_ratio", skill: SKILL, kind: "interpret_b", operator: "unit_ratio",
    structure: "매 τ 단위마다 b 배(또는 절반)가 되는 양이 큰 단위 한 개 동안 몇 배가 되는지 b^(f/τ) 로 구한다",
    extraThinking: "시간 단위 환산과 지수 법칙(주기 수 f/τ 만큼 거듭 곱함)을 결합하고 증가/감소 방향을 해석 — medium 은 한 주기 동안의 배율 읽기",
    concepts: ["단위 환산", "성장·감소 배율", "지수 법칙"], mediumSteps: 2,
    generate(rng) {
      const [tu, , bu, f] = rng.pick(UNITS); const taus = f === 24 ? [4, 6, 8, 12] : f === 60 ? [10, 12, 15, 20, 30] : [2, 3, 4, 6]; const tau = rng.pick(taus), k = f / tau; const half = rng.chance(0.3); const b = half ? 0.5 : rng.pick([2, 3, 4]); const ans = b ** k; if ((ans > 100 && !half) || (half && k > 4)) throw new GenFail("x");
      const g = grow(rng);
      return finishA(rng, {
        stimulus: half ? `The number of ${g} is cut in half every ${tau} ${tu}.` : `The number of ${g} is multiplied by ${b} every ${tau} ${tu}.`,
        question: spin(rng, `[[By what factor does the number change over ${f} ${tu} (1 ${bu})?|Over one ${bu}, the number is multiplied by what factor?|What is the factor by which the number changes in 1 ${bu}?]]`), correct: ans, fmt: fracOf,
        wrongs: [{ v: half ? 0.5 * k : b * k, kind: "formula_misuse", reason: "거듭 곱해야 하는 배율을 주기 수와 곱했다." }, { v: half ? 1 / k : b + k, kind: "formula_misuse", reason: "지수 대신 덧셈(또는 역수)으로 계산했다." }, { v: half ? 0.5 : b, kind: "step_missing", reason: "한 주기 동안의 배율에서 멈췄다." }, { v: half ? 1 / 2 ** (k + 1) : b ** (k + 1), kind: "step_missing", reason: "주기 수를 하나 많게 셌다." }, { v: half ? 1 / 2 ** (k - 1) : b ** (k - 1), kind: "step_missing", reason: "주기 수를 하나 적게 셌다." }, { v: half ? 2 ** k : 1 / b ** k, kind: "opposite", reason: "증가/감소 방향을 반대로 해석했다." }],
        verificationJs: withParams({ b, tau }, `const f=${f}; const r=Math.pow(P.b, f/P.tau); return r;`),
        trace: [T(`1 ${bu} = ${f} ${tu} 이고 ${f}/${tau} = ${k} 번의 주기가 지난다.`, "Count how many periods fit in the larger unit."), T(half ? `한 주기마다 1/2 배이므로 ${k} 번 거듭하면 (1/2)^${k} 이다.` : `한 주기마다 ${b} 배이므로 ${k} 번 거듭하면 ${b}^${k} 이다.`, "Multiply the factor once per period."), T(`${half ? `(1/2)^${k}` : `${b}^${k}`} 를 계산한다.`, "Evaluate the power."), T(half ? "감소하므로 1 보다 작은 값이다." : "증가하므로 1 보다 큰 값이다.", "Check the direction of change."), T(`배율은 ${fracOf(ans)} 이다.`, "State the factor.")],
        variant: half ? "halving_factor" : "growth_factor",
      });
    },
  },
  {
    id: "nf.interpret_b.repr_shift", skill: SKILL, kind: "interpret_b", operator: "repr_shift",
    structure: "n 기간 후 전체 변화(초기의 T%)가 주어졌을 때 같은 비율로 변했다는 문장을 b^n = T/100 으로 세워 기간당 변화율(%)을 구한다",
    extraThinking: "전체 변화율을 기간당 변화율로 바꾸는 모델링(거듭제곱근, 증가/감소 판별) — medium 은 기간당 변화율에서 배율 읽기",
    concepts: ["퍼센트 변화와 배율", "거듭제곱근", "증가·감소 해석"], mediumSteps: 2,
    generate(rng) {
      const cases: [number, number, boolean][] = [];
      for (const r of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) for (const n of [2, 3]) cases.push([r, n, true]);
      for (const r of [10, 20, 30, 40, 50, 60, 70, 80]) for (const n of [2, 3]) cases.push([r, n, false]);
      const okc = cases.filter(([r, n, up]) => { const t = (up ? 1 + r / 100 : 1 - r / 100) ** n * 100; return Math.abs(t * 10 - Math.round(t * 10)) < 1e-6 && t < 1000; });
      const [r, n, up] = rng.pick(okc); const total = (up ? 1 + r / 100 : 1 - r / 100) ** n * 100; const tot = Math.round(total * 10) / 10;
      const g = rng.pick(["value of a rare coin", "value of an investment", "value of a collectible card", "number of followers of an account", "population of a town"] as const); const dec = !up;
      const unit = rng.pick(["year", "month", "week"] as const);
      return finishA(rng, {
        stimulus: `After ${n} ${unit}s, the ${g} is ${tot}% of its starting amount. It changed by the same percent each ${unit}.`,
        question: dec ? spin(rng, `[[By what percent did it decrease each ${unit}?|What was the percent decrease each ${unit}?|Each ${unit}, it decreased by what percent?]]`) : spin(rng, `[[By what percent did it increase each ${unit}?|What was the percent increase each ${unit}?|Each ${unit}, it increased by what percent?]]`), correct: r,
        wrongs: [{ v: Math.round((Math.abs(tot - 100) / n) * 10) / 10, kind: "formula_misuse", reason: "전체 변화율을 기간 수로 나눠 평균을 냈다(복리 효과를 무시)." }, { v: Math.abs(tot - 100), kind: "step_missing", reason: "전체 변화율을 그대로 골랐다." }, { v: tot, kind: "step_missing", reason: "전체 퍼센트(초기의 몇 %)를 그대로 골랐다." }, { v: 100 - r, kind: "other", reason: "배율의 백분율 값을 변화율로 골랐다." }, { v: r + 10, kind: "other", reason: "계산 오류." }, { v: Math.max(1, r - 10), kind: "other", reason: "계산 오류." }],
        verificationJs: withParams({ total: tot, n, up: up ? 1 : 0 }, "const hits=[]; for(let r=1;r<=200;r++){ const f=P.up? 1+r/100 : 1-r/100; if(f<=0) continue; if(Math.abs(Math.pow(f,P.n)*100-P.total)<1e-6) hits.push(r); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`매 기간 배율을 b 라 하면 ${n} 기간 후 배율은 b^${n} 이다.`, "Let b be the factor per period."), T(`${tot}% = ${tot / 100} 이므로 b^${n} = ${tot / 100} 이다.`, "Convert the percent to a factor."), T(`양변의 ${n} 제곱근을 취하면 b = ${up ? 1 + r / 100 : 1 - r / 100} 이다.`, "Take the root."), T(up ? "b > 1 이므로 증가한다." : "b < 1 이므로 감소한다.", "Decide increase or decrease."), T(`변화율은 |b - 1|·100 = ${r}% 이다.`, "Convert back to a percent.")],
        variant: up ? "total_to_rate_increase" : "total_to_rate_decrease",
      });
    },
  },
  {
    id: "nf.interpret_b.compare_scenarios", skill: SKILL, kind: "interpret_b", operator: "compare_scenarios",
    structure: "A(t)=a₁·b₁^t, B(t)=a₂·b₂^t (a₁>a₂, b₂>b₁) 에서 B(t)>A(t) 가 되는 가장 작은 정수 t 를 구한다",
    extraThinking: "밑(성장 배율)이 큰 쪽이 결국 앞선다는 해석과 역전 시점 탐색 — medium 은 한 모델의 배율 해석",
    concepts: ["성장 배율 비교", "지수 모델 비교", "역전 시점"], mediumSteps: 2,
    generate(rng) {
      const b1 = rng.int(2, 3), b2 = b1 + rng.int(1, 2), a1 = rng.int(15, 80), a2 = rng.int(2, Math.floor(a1 / 2)); let ts = -1; for (let t = 0; t <= 20; t++) if (a2 * b2 ** t > a1 * b1 ** t) { ts = t; break; } if (ts < 2 || ts > 9) throw new GenFail("x");
      const ctx = rng.pick([["plan A", "plan B", "account value"], ["fund A", "fund B", "value"], ["group A", "group B", "membership"]] as const);
      return finishA(rng, {
        stimulus: `The ${ctx[2]} of ${ctx[0]} after t years is modeled by ${M(`A(t) = ${a1} \\cdot ${b1}^t`)}, and the ${ctx[2]} of ${ctx[1]} after t years is modeled by ${M(`B(t) = ${a2} \\cdot ${b2}^t`)}.`,
        question: spin(rng, "[[What is the smallest whole number t for which B(t) is greater than A(t)?|For what least integer t is B(t) > A(t)?|After how many whole years does the second model first exceed the first?]]"), correct: ts,
        wrongs: [{ v: ts - 1, kind: "step_missing", reason: "역전되기 직전 시점을 골랐다." }, { v: ts + 1, kind: "other", reason: "처음 넘는 시점이 아니라 그 다음 시점을 골랐다." }, { v: Math.round(a1 / a2), kind: "formula_misuse", reason: "초기값의 비를 시점으로 골랐다." }, { v: ts + 2, kind: "other", reason: "역전 시점을 뒤쪽으로 잘못 추정했다." }, { v: Math.max(0, ts - 2), kind: "other", reason: "역전 시점을 앞쪽으로 잘못 추정했다." }, { v: b2 - b1, kind: "formula_misuse", reason: "배율의 차를 시점으로 골랐다." }],
        verificationJs: withParams({ a1, b1, a2, b2 }, "for(let t=0;t<=60;t++) if(P.a2*P.b2**t>P.a1*P.b1**t) return t; throw new Error('역전 없음');"),
        trace: [T(`A(t) = ${a1}·${b1}^t, B(t) = ${a2}·${b2}^t 이다.`, "Write both models."), T(`t = 0 에서 A = ${a1} > B = ${a2} 이다.`, "Compare the starting values."), T(`B 의 배율 ${b2} 가 A 의 배율 ${b1} 보다 커서 B 가 결국 따라잡는다.`, "The larger growth factor eventually wins."), T(`t = ${ts - 1} 에서 A = ${a1 * b1 ** (ts - 1)}, B = ${a2 * b2 ** (ts - 1)}, t = ${ts} 에서 A = ${a1 * b1 ** ts}, B = ${a2 * b2 ** ts} 이다.`, "Compare consecutive values."), T(`B 가 처음 더 큰 t 는 ${ts} 이다.`, "State the answer.")],
        variant: "explicit_models_crossover",
      });
    },
  },
  {
    id: "nf.interpret_b.inverse", skill: SKILL, kind: "interpret_b", operator: "inverse",
    structure: "n 기간 후 K 배(또는 1/K)가 되었을 때 매 기간 같은 배율이라면 기간당 증가·감소율(%)을 역산한다",
    extraThinking: "총 변화 배율에서 기간당 배율을 거듭제곱근으로 역산하고 퍼센트 변화로 환산 — medium 은 기간당 배율에서 총 변화를 계산",
    concepts: ["거듭제곱근", "성장 배율", "퍼센트 변화"], mediumSteps: 2,
    generate(rng) {
      const decay = rng.chance(0.3); const n = rng.int(2, 6); const bb = decay ? rng.pick([2, 4, 5, 10]) : rng.int(2, 10); const K = bb ** n; if (K > 999) throw new GenFail("x");
      const ans = decay ? Math.round((1 - 1 / bb) * 100) : (bb - 1) * 100; const unit = rng.pick(["week", "year", "month"] as const); const g = grow(rng);
      return finishA(rng, {
        stimulus: decay ? `After ${n} ${unit}s, the number of ${g} is 1/${K} of the starting number. The number was multiplied by the same factor each ${unit}.` : `After ${n} ${unit}s, the number of ${g} is ${K} times the starting number. The number was multiplied by the same factor each ${unit}.`,
        question: decay ? spin(rng, `[[By what percent did the number decrease each ${unit}?|What was the percent decrease each ${unit}?|Each ${unit}, the number decreased by what percent?]]`) : spin(rng, `[[By what percent did the number increase each ${unit}?|What was the percent increase each ${unit}?|Each ${unit}, the number increased by what percent?]]`), correct: ans,
        wrongs: decay
          ? [{ v: Math.round(100 / bb), kind: "step_missing", reason: "남은 비율(%)을 감소율로 골랐다." }, { v: Math.round((1 - 1 / K) * 100), kind: "step_missing", reason: "전체 감소율을 기간당 감소율로 골랐다." }, { v: Math.round(((1 - 1 / K) * 100) / n), kind: "formula_misuse", reason: "전체 감소율을 기간 수로 나눠 평균을 냈다." }, { v: bb * 100, kind: "other", reason: "배율의 역수를 증가율로 해석했다." }, { v: ans + 10, kind: "other", reason: "계산 오류." }, { v: Math.max(1, ans - 10), kind: "other", reason: "계산 오류." }]
          : [{ v: K * 100, kind: "step_missing", reason: "전체 배율의 백분율을 기간당 증가율로 골랐다." }, { v: (K - 1) * 100, kind: "step_missing", reason: "전체 증가율을 기간당 증가율로 골랐다." }, { v: bb * 100, kind: "other", reason: "배율의 백분율을 증가율로 골랐다(1 을 빼지 않음)." }, { v: ((K - 1) * 100) / n, kind: "formula_misuse", reason: "전체 증가율을 기간 수로 나눠 평균을 냈다." }, { v: (bb - 1) * 100 + 100, kind: "other", reason: "계산 오류." }, { v: bb * 10, kind: "formula_misuse", reason: "퍼센트 환산에서 100 대신 10 을 곱했다." }],
        verificationJs: withParams({ n, K, decay: decay ? 1 : 0 }, "const hits=[]; const cand=P.decay? [2,4,5,10].map(x=>1/x) : [2,3,4,5,6,7,8,9,10]; for(const b of cand){ const t=Math.pow(b,P.n); if(Math.abs(P.decay? t-1/P.K : t-P.K)<1e-9) hits.push(Math.round(Math.abs(b-1)*100)); } if(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];"),
        trace: [T(`매 기간 배율을 b 라 하면 ${n} 기간 후 배율은 b^${n} 이다.`, "Let b be the per-period factor."), T(decay ? `b^${n} = 1/${K} 이다.` : `b^${n} = ${K} 이다.`, "Set up the equation."), T(`양변의 ${n} 제곱근을 취하면 b = ${decay ? `1/${bb}` : bb} 이다.`, "Take the root."), T(decay ? "b < 1 이므로 감소한다." : "b > 1 이므로 증가한다.", "Decide increase or decrease."), T(`변화율은 |b - 1|·100 = ${ans}% 이다.`, "Convert to a percent.")],
        variant: decay ? "total_factor_to_decrease" : "total_factor_to_increase",
      });
    },
  },
];
