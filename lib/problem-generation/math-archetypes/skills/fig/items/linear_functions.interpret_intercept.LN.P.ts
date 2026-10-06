// linear_functions.interpret_intercept.LN.P — 그래프(x = 0 행 없음)로 주어진 일차 관계의 처음 값(절편)을 구하고 해석해 쓰는 문항.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { gInst, capFirst, sing, convNote, GL_JS, glIntercept, glIntro, glRead, makeLinGraph, offXg, type LinGraph } from "../graph-kit";

export const ITEM = defineItem({
  prefix: "lf", itemId: "linear_functions.interpret_intercept.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "x = 0 행이 없는 그래프에서 처음 값(절편)을 거꾸로 구하고, 그 값의 문맥상 뜻을 서술 네 개 중에서 고름", extra: "기울기로 x = 0 까지 거슬러 계산한 뒤 '입력이 0 일 때의 값' 이라는 해석을 골라야 함(첫 점 값·기울기와 혼동하는 서술이 함정) — medium 은 절편 값",
      concepts: ["그래프의 두 점", "절편(처음 값)", "절편의 문맥 해석"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const s = makeLinGraph(rng, { noZeroX: true }); if (s.b === s.ys[0] || s.b === Math.abs(s.m) || s.b <= 0) throw new GenFail("trap");
        const Y = capFirst(s.yq); const tpl = `When ${s.xq} is 0 ${s.t.xu}, ${s.yq} is # ${s.t.yu}.`;
        const correct = tpl.replace("#", fmtNum(s.b));
        const wrongs = [
          { text: tpl.replace("#", fmtNum(s.ys[0])), reason: "그래프의 첫 행 값을 처음 값으로 보았다." },
          { text: `${Y} ${s.m > 0 ? "increases" : "decreases"} by ${fmtNum(s.b)} ${s.t.yu} for each increase of 1 ${sing(s.t.xu)} in ${s.xq}.`, reason: "절편을 변화율로 해석했다." },
          { text: tpl.replace("#", fmtNum(Math.abs(s.m))), reason: "기울기를 처음 값으로 보았다." },
        ];
        return statementInst(rng, {
          stimulus: glIntro(rng, s), question: `Which statement best describes the value of ${s.yq} at the start, according to the linear relationship?`, correct, wrongs, figure: s.fig, P: { tpl },
          body: `${GL_JS}const want = P.tpl.replace('#', String(Math.round(b * 100) / 100)); const i = P.options.indexOf(want); if (i < 0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [...glRead(s), glIntercept(s), [`그래프의 첫 행 x 는 ${s.xs[0]} 이라 첫 행 값은 처음 값이 아니다.`, "The first row is not x = 0."], [`절편은 입력이 0 일 때의 값을 뜻한다.`, "Interpret the intercept."]], variant: "meaning_of_intercept",
        });
      },
    },
    {
      op: "chain2", structure: "x = 0 행이 없는 그래프에서 두 점으로 기울기를 구하고 거슬러 올라가 처음 값을 구한 뒤, 표 마지막 값과 처음 값의 차를 구함", extra: "두 점 → 기울기 → 역방향 대입으로 절편 → 다른 행과 결합하는 연쇄 — medium 은 절편만",
      concepts: ["그래프의 두 점", "절편(처음 값)", "값의 결합"],
      gen(rng) {
        const s = makeLinGraph(rng, { noZeroX: true }); const last = s.ys[s.ys.length - 1]; if (s.b <= 0) throw new GenFail("b"); const correct = Math.abs(last - s.b);
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)}`,
          question: `By how many ${s.t.yu} does ${s.yq} at the last row of the graph differ from its value when ${s.xq} is 0 ${s.t.xu}?`, correct,
          wrongs: [W(Math.abs(last - s.ys[0]), "condition_ignored", "첫 행을 x = 0 으로 보았다."), W(s.b, "step_missing", "처음 값만 답했다."), W(last, "step_missing", "마지막 값만 답했다."), W(Math.abs(s.m) * (s.xs.length - 1), "unit_error", "행 개수를 x 로 보았다."), W(last + s.b, "sign_error", "차가 아니라 합을 구했다.")],
          verificationJs: figJs({}, s.fig, `${GL_JS}return Math.abs(ys[ys.length - 1] - b);`),
          trace: [...glRead(s), glIntercept(s), [`가장 오른쪽 점의 값은 ${last} 이다.`, "Last value."], [`차 = |${last} - ${fmtNum(s.b)}| = ${correct} 이다.`, "Difference."], [`(= 기울기 × 마지막 x = ${fmtNum(Math.abs(s.m))} × ${s.xs[s.xs.length - 1]})`, "Check with slope × input."]], variant: "last_minus_initial",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "그래프의 관계와 같은 변화율이고 점 (p, q) 를 지나는 두 번째 관계를 세워 두 처음 값의 차를 구함", extra: "그래프에서 기울기를 구해 두 번째 관계의 절편을 역산하고, 두 절편을 비교해야 함 — medium 은 한 관계의 절편",
      concepts: ["그래프의 두 점", "평행한 두 일차 관계", "절편 비교"],
      gen(rng) {
        const s = makeLinGraph(rng, { noZeroX: true }); const p = s.xs[s.xs.length - 1] + rng.int(1, 6); const shift = rng.nz(-30, 30); const q = s.m * p + s.b + shift; if (q <= 0 || q > 900) throw new GenFail("q");
        const b2 = q - s.m * p; const correct = Math.abs(s.b - b2);
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)} A second linear relationship has the same rate of change, and in it ${s.yq} is ${q} ${s.t.yu} when ${s.xq} is ${p} ${s.t.xu}.`,
          question: `What is the positive difference, in ${s.t.yu}, between the values of ${s.yq} for the two relationships when ${s.xq} is 0 ${s.t.xu}?`, correct,
          wrongs: [W(Math.abs(q - s.ys[s.ys.length - 1]), "formula_misuse", "다른 입력의 값을 비교했다."), W(Math.abs(b2), "step_missing", "두 번째 관계의 처음 값만 답했다."), W(Math.abs(s.b), "step_missing", "표 관계의 처음 값만 답했다."), W(Math.abs(q - s.b), "step_missing", "두 번째 관계를 거슬러 올라가지 않았다."), W(correct + Math.abs(s.m), "other", "한 단위 어긋났다.")],
          verificationJs: figJs({ p, q }, s.fig, `${GL_JS}const b2 = P.q - m * P.p; return Math.abs(b - b2);`),
          trace: [...glRead(s), glIntercept(s), [`두 번째 관계의 처음 값 = ${q} - ${fmtNum(s.m)} × ${p} = ${fmtNum(b2)} 이다.`, "Back-solve the second intercept."], [`두 처음 값의 차 = |${fmtNum(s.b)} - ${fmtNum(b2)}| = ${correct} 이다.`, "Compare intercepts."], [`같은 기울기라 모든 x 에서 차가 같다.`, "Parallel lines keep the same gap."]], variant: "intercept_gap_parallel",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "그래프에서 기울기를 구하고, 처음 값만 B 로 바뀐 관계에서 값이 T 가 되는 x 를 역산", extra: "기울기는 그래프에서, 처음 값은 지문에서 가져와 새 식을 세운 뒤 역산해야 함(그래프의 처음 값을 쓰면 오답) — medium 은 절편 값",
      concepts: ["그래프의 두 점", "절편 변경", "역산"],
      gen(rng) {
        const s = makeLinGraph(rng, { mSign: 1, noZeroX: true }); const B = s.b + rng.nz(-20, 20); if (B < 0 || B === s.b) throw new GenFail("B"); const k = rng.int(3, 25); const T = s.m * k + B; if (T > 950) throw new GenFail("big");
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)} Suppose the starting value (the value of ${s.yq} when ${s.xq} is 0) is changed to ${B} ${s.t.yu}, while the rate of change stays the same.`,
          question: `In the changed relationship, for what value of ${s.xq}, in ${s.t.xu}, is ${s.yq} equal to ${T} ${s.t.yu}?`, correct: k,
          wrongs: [W(Math.round((T - s.b) / s.m * 10) / 10 === k ? k + 2 : Math.round((T - s.b) / s.m), "condition_ignored", "원래 처음 값을 썼다."), W(Math.round(T / s.m), "step_missing", "처음 값을 빼지 않았다."), W(Math.round((T + B) / s.m), "sign_error", "처음 값을 더했다."), W(k + 1, "other", "한 단위 어긋났다."), W(Math.round((T - B) / (s.m * s.d)), "unit_error", "두 점 사이의 변화를 1 단위당 변화로 보았다.")],
          verificationJs: figJs({ B, T }, s.fig, `${GL_JS}return (P.T - P.B) / m;`),
          trace: [...glRead(s), [`새 관계: y = ${fmtNum(s.m)}x + ${B} 이다.`, "New model keeps the slope."], [`${fmtNum(s.m)}x + ${B} = ${T} 로 놓는다.`, "Set equal to the target."], [`x = (${T} - ${B}) ÷ ${fmtNum(s.m)} 이다.`, "Solve."], [`= ${k} 이다.`, "Compute."]], variant: "new_start_same_rate",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "start_from_zero_row", structure: "x = 0 행이 있는 그래프에서 처음 값을 읽음", extra: "easy: x = 0 행 읽기", concepts: ["그래프", "처음 값"],
      gen(rng) {
        const s = makeLinGraph(rng, { x0Zero: true });
        return gInst(rng, { stimulus: glIntro(rng, s), question: `According to the graph, what is ${s.yq}, in ${s.t.yu}, when ${s.xq} is 0 ${s.t.xu}?`, correct: s.ys[0], wrongs: [W(s.ys[1], "axis_misread", "둘째 행을 읽었다."), W(Math.abs(s.m), "formula_misuse", "기울기를 답했다."), W(s.ys[s.ys.length - 1], "axis_misread", "가장 오른쪽 점을 읽었다."), W(s.ys[0] + s.d, "other", "어긋났다.")].filter((w) => w.v !== s.ys[0]), verificationJs: figJs({}, s.fig, `${GL_JS}if (xs[0] !== 0) throw new Error('x=0 행 없음'); return ys[0];`), trace: [[`x = 0 인 행을 찾는다.`, "Find the x = 0 row."], [`그 값은 ${s.ys[0]} 이다.`, "Read it."]], variant: "read_initial",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "back_solve", structure: "x = 0 행이 없는 그래프에서 처음 값을 거슬러 구함", extra: "medium: 기울기로 거슬러 계산", concepts: ["그래프", "절편"],
      gen(rng) {
        const s = makeLinGraph(rng, { noZeroX: true }); if (s.b <= 0) throw new GenFail("b");
        return gInst(rng, { stimulus: glIntro(rng, s), question: `Based on the linear relationship, what is ${s.yq}, in ${s.t.yu}, when ${s.xq} is 0 ${s.t.xu}?`, correct: s.b, wrongs: [W(s.ys[0], "condition_ignored", "첫 행 값을 답했다."), W(s.ys[0] - s.m, "unit_error", "한 단위만 거슬러 갔다."), W(s.ys[0] + s.m * s.xs[0], "sign_error", "반대 방향으로 갔다."), W(Math.abs(s.m), "formula_misuse", "기울기를 답했다.")].filter((w) => w.v !== s.b), verificationJs: figJs({}, s.fig, `${GL_JS}return b;`), trace: [...glRead(s), glIntercept(s)], variant: "back_solve_initial",
        }, s.fig);
      },
    },
  ],
});
