// two_variable_data.model_choice_linear_quadratic_exponential.FN.P — 일차·이차·지수 곡선 그래프(축 제목 x·y)의 표시점에서 모형을 가려 설명을 고르거나 그림 밖의 값을 예측·역산한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { MDL_JS, makeMdl, mdlIntro, mdlRead, type Mdl } from "../mdl-kit";

const isI = Number.isInteger;
const CONT = () => ""; void CONT;
const BACKS = ["", " Assume the same function describes values to the left of the marked points.", " The function keeps the same form for smaller values of $x$.", " Assume the pattern also holds before the first marked point."];
const CONTS = [" Assume the function continues in the same way beyond the part of the graph shown.", " Assume the same function describes values beyond the part of the graph shown.", " The function keeps the same form beyond the part of the graph that is shown.", " Assume the pattern of the function continues past the portion of the graph shown."];
/** 서로 다른 세 모형이 표시점에서 내놓는 steps 칸 뒤(음수면 앞)의 값. */
const predict = (m: Mdl, steps: number) => {
  const [y0, y1, y2] = m.ys; const lin = (k: number) => (k > 0 ? y2 + (y2 - y1) * k : y0 - (y1 - y0) * -k);
  const geo = (k: number) => Math.round(k > 0 ? y2 * (y2 / y1) ** k : y0 / (y1 / y0) ** -k);
  const quad = (k: number) => { const s = y2 - 2 * y1 + y0; const g = (n: number) => y0 + (y1 - y0) * n + (s * n * (n - 1)) / 2; return Math.round(g(2 + k)); };
  return { lin: lin(steps), geo: geo(steps), quad: quad(steps) };
};
const TPL = { linear: "Linear, because $y$ increases by # each time $x$ increases by 1.", exponential: "Exponential, because $y$ is multiplied by # each time $x$ increases by 1.", quadratic: "Quadratic, because the increase in $y$ itself grows by # each time $x$ increases by 1." };
const typeFeat = (m: Mdl) => (m.type === "linear" ? m.ys[1] - m.ys[0] : m.type === "exponential" ? m.ys[1] / m.ys[0] : m.ys[2] - 2 * m.ys[1] + m.ys[0]);
const typeVariant = (m: Mdl, stem: string) => `${stem}_${m.type}`;

export const ITEM = defineItem({
  prefix: "mcfp", itemId: "two_variable_data.model_choice_linear_quadratic_exponential.FN.P",
  hard: [
    {
      op: "repr_shift", structure: "연속한 x 의 표시점에서 값의 차·비·차의 차를 비교해 모형(일차·이차·지수)과 그 근거를 서술 네 개 중에서 고름", extra: "차가 일정한지, 비가 일정한지, 차가 일정하게 늘어나는지 구별해야 함(모형은 맞지만 근거가 틀린 서술과 다른 모형 서술이 함정) — medium 은 모형 이름만",
      concepts: ["일차·이차·지수 모형 구별", "연속한 값의 차와 비"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) { const m = makeMdl(rng); const feat = typeFeat(m); const want = TPL[m.type].replace("#", fmtNum(feat));
        const others = (["linear", "exponential", "quadratic"] as const).filter((t) => t !== m.type);
        const fake = (t: (typeof others)[number]) => TPL[t].replace("#", fmtNum(t === "linear" ? m.ys[1] - m.ys[0] : t === "exponential" ? Math.round((m.ys[1] / m.ys[0]) * 2) / 2 + (t === "exponential" && m.type === "linear" ? 0 : 0) : Math.abs(m.ys[2] - 2 * m.ys[1] + m.ys[0]) + 1));
        const swapped = m.type === "linear" ? TPL.linear.replace("#", fmtNum(m.ys[2] - m.ys[0])) : m.type === "exponential" ? TPL.exponential.replace("#", fmtNum(m.ys[1] - m.ys[0])) : TPL.quadratic.replace("#", fmtNum(m.ys[1] - m.ys[0]));
        const wrongs = [{ text: fake(others[0]), reason: "다른 모형으로 판단했다." }, { text: fake(others[1]), reason: "다른 모형으로 판단했다." }, { text: swapped, reason: "모형은 맞지만 근거의 수가 틀렸다." }];
        return statementInst(rng, { stimulus: mdlIntro(rng), question: rng.pick(["Which of the following best describes a function that models the graph shown?", "Which statement correctly identifies the type of function shown in the graph and explains why?", "Which type of function is shown, and what supports that choice?", "Which statement identifies the function type shown in the graph and gives a correct reason?", "A function type is chosen to match the graph shown. Which statement gives the type and its supporting pattern?"]), correct: want, wrongs, figure: m.fig, P: { tl: TPL.linear, te: TPL.exponential, tq: TPL.quadratic },
          body: `${MDL_JS}let tpl, v; if (MF.fn==='linear') { tpl=P.tl; v=my[1]-my[0]; } else if (MF.fn==='exponential') { tpl=P.te; v=my[1]/my[0]; } else { tpl=P.tq; v=my[2]-2*my[1]+my[0]; } const want=tpl.replace('#', String(Math.round(v*100)/100)); const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [...mdlRead(m), [`그 값은 ${fmtNum(feat)} 이다.`, "Compute the characteristic number."], [`따라서 '${m.type === "linear" ? "일차" : m.type === "exponential" ? "지수" : "이차"}함수' 서술이 맞다.`, "Choose the matching statement."]], variant: typeVariant(m, "type_with_reason") }); },
    },
    {
      op: "chain2", structure: "표시점으로 모형을 가린 뒤 그림 밖(다음 x)의 값을 예측함", extra: "모형에 따라 더하거나 곱하거나 차를 늘려 가야 함(일정한 차로 늘리는 선형 예측이 함정) — medium 은 모형이 주어짐",
      concepts: ["일차·이차·지수 모형 구별", "값의 예측"],
      gen(rng) { const m = makeMdl(rng); const k = rng.int(1, 2); const x = m.xs[2] + k; const v = m.f(x); if (v > 999 || !isI(v)) throw new GenFail("v"); const p = predict(m, k);
        return figInst(rng, { stimulus: `${mdlIntro(rng)}${rng.pick(CONTS)}`, question: rng.pick([`What is the value of $y$ when $x = ${x}$?`, `According to the function, what is $y$ when $x = ${x}$?`, `What is the function's value at $x = ${x}$?`, `When $x = ${x}$, what is the value of $y$ on this function?`, `Find the value of $y$ for $x = ${x}$.`]), correct: v,
          wrongs: [W(p.lin, "formula_misuse", "일정한 차로 늘려 예측했다."), W(p.geo, "formula_misuse", "일정한 비로 늘려 예측했다."), W(p.quad, "formula_misuse", "차가 일정하게 늘어난다고 예측했다."), W(m.ys[2], "step_missing", "마지막 표시점의 값을 답했다."), W(v + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== v && isI(w.v) && w.v > 0),
          verificationJs: figJs({ x }, m.fig, `${MDL_JS}return ev(P.x);`), trace: [...mdlRead(m), [`${m.type === "linear" ? `매번 ${m.d} 씩 늘므로` : m.type === "exponential" ? `매번 ${m.r} 배가 되므로` : `차가 ${m.s} 씩 늘어나므로`} x = ${x} 에서 y = ${v} 이다.`, "Extend the pattern with the identified model."], [`따라서 ${v} 이다.`, "State the answer."]], variant: typeVariant(m, "predict_next") }, m.fig); },
    },
    {
      op: "compose_kind", structure: "표시점으로 모형을 가린 뒤 첫 표시점 이전(거꾸로 한 칸)의 값을 구함", extra: "모형에 따라 빼거나 나누거나 차를 줄여 가야 함(일정한 차로 거슬러 가는 것이 함정) — medium 은 한 칸 앞",
      concepts: ["일차·이차·지수 모형 구별", "거꾸로 예측"],
      gen(rng) { const m = makeMdl(rng); if (m.xs[0] < 2) throw new GenFail("x"); const x = m.xs[0] - 1; const v = m.f(x); if (!isI(v) || v < 1) throw new GenFail("v"); const p = predict(m, -1);
        return figInst(rng, { stimulus: `${mdlIntro(rng)}${rng.pick(BACKS)}`, question: rng.pick([`What is the value of $y$ when $x = ${x}$?`, `What is the function's value at $x = ${x}$?`, `According to the function, what is $y$ when $x = ${x}$?`]), correct: v,
          wrongs: [W(p.lin, "formula_misuse", "일정한 차로 거슬러 갔다."), W(p.geo, "formula_misuse", "일정한 비로 거슬러 갔다."), W(p.quad, "formula_misuse", "이차로 거슬러 갔다."), W(m.ys[0], "step_missing", "첫 표시점의 값을 답했다."), W(v + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== v && isI(w.v) && w.v > 0),
          verificationJs: figJs({ x }, m.fig, `${MDL_JS}return ev(P.x);`), trace: [...mdlRead(m), [`${m.type === "linear" ? `매번 ${m.d} 씩 늘므로 거꾸로는 ${m.d} 씩 뺀다` : m.type === "exponential" ? `매번 ${m.r} 배가 되므로 거꾸로는 ${m.r} 로 나눈다` : `차가 ${m.s} 씩 늘어나므로 거꾸로는 앞의 차를 ${m.s} 줄여 뺀다`}.`, "Work backward with the identified model."], [`x = ${x} 에서 y = ${v} 이다.`, "State the answer."]], variant: typeVariant(m, "predict_back") }, m.fig); },
    },
    {
      op: "inverse", structure: "표시점으로 모형을 가린 뒤 다음 칸의 값이 주어질 때 그 x 를 거꾸로 구함", extra: "모형으로 다음 값들을 이어 가며 같은 값이 나오는 x 를 찾아야 함(다른 모형의 값에서 x 를 찾는 것이 함정) — medium 은 한 칸",
      concepts: ["일차·이차·지수 모형 구별", "역산"],
      gen(rng) { const m = makeMdl(rng); const k = rng.int(1, 2); const x = m.xs[2] + k; const Y = m.f(x); if (!isI(Y) || Y > 999) throw new GenFail("Y"); const p = predict(m, 1);
        const xFor = (v: number, other: number) => other; void xFor;
        return figInst(rng, { stimulus: `${mdlIntro(rng)}${rng.pick(CONTS)}`, question: rng.pick([`For what value of $x$ is $y = ${Y}$?`, `The function's value is ${Y} at what value of $x$?`, `At what value of $x$ does the function equal ${Y}?`, `Which value of $x$ gives $y = ${Y}$?`, `For which $x$ does the function take the value ${Y}?`]), correct: x,
          wrongs: [W(x - 1, "other", "한 칸 덜 갔다."), W(x + 1, "other", "한 칸 더 갔다."), W(m.xs[2] + (p.lin === Y ? 0 : 1), "formula_misuse", "다음 칸이라고 답했다."), W(Math.round(Y / (m.ys[2] / m.xs[2])), "formula_misuse", "비례한다고 계산했다.")].filter((w) => w.v !== x && isI(w.v) && w.v > 0),
          verificationJs: figJs({ Y }, m.fig, `${MDL_JS}for (let x=0;x<=60;x++) if (Math.abs(ev(x)-P.Y)<1e-9) return x; throw new Error('해 없음');`), trace: [...mdlRead(m), [`${m.type === "linear" ? `매번 ${m.d} 씩 늘려` : m.type === "exponential" ? `매번 ${m.r} 배 하여` : `차를 ${m.s} 씩 늘려`} 값이 ${Y} 이 되는 x 를 찾는다.`, "Extend the pattern until the value matches."], [`x = ${x} 이다.`, "State the answer."]], variant: typeVariant(m, "solve_for_x") }, m.fig); },
    },
  ],
  em: [
    {
      lv: "easy", name: "linear_next", structure: "일차 곡선의 표시점에서 다음 x 의 값을 구함", extra: "easy: 일정한 차", concepts: ["일차 모형", "값의 예측"],
      gen(rng) { const m = makeMdl(rng, "linear"); const x = m.xs[2] + 1; const v = m.f(x); return figInst(rng, { stimulus: `${mdlIntro(rng)}${rng.pick(CONTS)}`, question: `What is the value of $y$ when $x = ${x}$?`, correct: v, wrongs: [W(m.ys[2], "step_missing", "마지막 표시점의 값을 답했다."), W(v + m.d, "other", "한 칸 더 갔다."), W(v - 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== v && isI(w.v) && w.v > 0), verificationJs: figJs({ x }, m.fig, `${MDL_JS}return ev(P.x);`), trace: [[`연속한 값의 차는 ${m.d} 로 일정하다.`, "The differences are constant."], [`y = ${m.ys[2]} + ${m.d} = ${v} 이다.`, "Add the constant difference."]], variant: "linear_next" }, m.fig); },
    },
    {
      lv: "medium", name: "exp_next", structure: "지수 곡선의 표시점에서 비를 구해 다음 x 의 값을 구함", extra: "medium: 일정한 비", concepts: ["지수 모형", "값의 예측"],
      gen(rng) { const m = makeMdl(rng, "exponential"); const x = m.xs[2] + 1; const v = m.f(x); if (v > 999) throw new GenFail("v"); const p = predict(m, 1); return figInst(rng, { stimulus: `${mdlIntro(rng)}${rng.pick(CONTS)}`, question: `What is the value of $y$ when $x = ${x}$?`, correct: v, wrongs: [W(p.lin, "formula_misuse", "일정한 차로 늘렸다."), W(m.ys[2], "step_missing", "마지막 표시점의 값을 답했다."), W(v + 1, "other", "한 칸 어긋났다.")].filter((w) => w.v !== v && isI(w.v) && w.v > 0), verificationJs: figJs({ x }, m.fig, `${MDL_JS}return ev(P.x);`), trace: [[`연속한 값의 비는 ${m.r} 로 일정하다.`, "The ratios are constant."], [`y = ${m.ys[2]} × ${m.r} = ${v} 이다.`, "Multiply by the constant ratio."], [`따라서 ${v} 이다.`, "State the answer."]], variant: "exp_next" }, m.fig); },
    },
  ],
});
