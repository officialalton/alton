// one_variable_data.range.BX.P — 상자그림의 최솟값·최댓값에서 범위를 구하고, 값 추가·두 집단 비교·사분범위와의 결합으로 확장한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { BX_JS, bxIntro, bxIntro2, bxRead, makeBox, gInst } from "../data-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.range.BX.P",
  hard: [
    {
      op: "compare_scenarios", structure: "두 집단의 상자그림에서 각 범위(최댓값 − 최솟값)를 읽어 차를 구함", extra: "두 상자의 꼬리 끝(최솟값·최댓값)을 같은 눈금에서 읽고 범위를 비교해야 함(상자의 폭=사분범위와 혼동하는 함정) — medium 은 한 집단의 범위",
      concepts: ["상자그림", "범위", "두 집단 비교"],
      gen(rng) {
        const s = makeBox(rng, { groups: 2 }); const [a, b] = s.boxes; const ra = a.max - a.min, rb = b.max - b.min; if (ra === rb) throw new GenFail("same"); const correct = Math.abs(ra - rb);
        return gInst(rng, {
          stimulus: bxIntro2(rng, s),
          question: rng.pick([`What is the positive difference between the range of the ${s.names[0]} data and the range of the ${s.names[1]} data, in ${s.t.unit}?`, `By how many ${s.t.unit} do the ranges of the two groups differ?`]), correct,
          wrongs: pos([W(Math.abs((a.q3 - a.q1) - (b.q3 - b.q1)), "formula_misuse", "사분범위의 차를 구했다."), W(Math.abs(a.max - b.max), "formula_misuse", "최댓값의 차를 구했다."), W(Math.abs(a.min - b.min), "formula_misuse", "최솟값의 차를 구했다."), W(ra + rb, "sign_error", "범위의 합을 구했다."), W(Math.abs(a.median - b.median), "formula_misuse", "중앙값의 차를 구했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${BX_JS}if (B.length!==2) throw new Error('상자 둘 아님'); return Math.abs((B[0].max-B[0].min)-(B[1].max-B[1].min));`),
          trace: [bxRead(s, 0), bxRead(s, 1), [`범위: ${s.names[0]} ${a.max} - ${a.min} = ${ra}, ${s.names[1]} ${b.max} - ${b.min} = ${rb} 이다.`, "Compute each range."], [`차 = |${ra} - ${rb}| = ${correct} 이다.`, "Take the positive difference."], [`따라서 두 범위는 ${correct} ${s.t.unit} 만큼 다르다.`, "State the difference."]], variant: "range_gap_between_groups",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "상자그림에서 범위와 사분범위를 각각 읽어 범위가 사분범위보다 얼마나 큰지 구함", extra: "꼬리 끝에서 범위, 상자 양끝에서 사분범위를 읽어 결합해야 함 — medium 은 범위",
      concepts: ["상자그림", "범위", "사분범위"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const r = b.max - b.min, q = b.q3 - b.q1; const correct = r - q; if (correct <= 0) throw new GenFail("neg");
        return gInst(rng, {
          stimulus: bxIntro(rng, s),
          question: rng.pick([`By how many ${s.t.unit} is the range of the data greater than its interquartile range?`, `What is the range minus the interquartile range, in ${s.t.unit}?`]), correct,
          wrongs: pos([W(r, "step_missing", "범위만 답했다."), W(q, "step_missing", "사분범위만 답했다."), W(r + q, "sign_error", "합을 구했다."), W((b.min - 0) + (b.max - b.q3), "formula_misuse", "꼬리 길이를 잘못 합쳤다."), W(correct + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${BX_JS}const b=B[0]; return (b.max-b.min)-(b.q3-b.q1);`),
          trace: [bxRead(s), [`범위 = ${b.max} - ${b.min} = ${r} 이다.`, "Compute the range."], [`사분범위 = ${b.q3} - ${b.q1} = ${q} 이다.`, "Compute the IQR."], [`차 = ${r} - ${q} = ${correct} 이다.`, "Subtract."], [`따라서 범위가 사분범위보다 ${correct} ${s.t.unit} 더 크다.`, "State the difference."]], variant: "range_minus_iqr",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "상자그림의 최솟값을 읽고, 최댓값보다 큰 새 값이 더해진 뒤 범위가 R 이 될 때 그 새 값을 역산", extra: "새 범위 = 새 값 − 최솟값 을 거꾸로 써야 함(원래 최댓값을 쓰는 함정) — medium 은 범위",
      concepts: ["상자그림", "범위", "역산"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const x = b.max + s.s * rng.int(1, 8); const R = x - b.min;
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(["One more value is then recorded, and it is greater than the maximum shown.", "A new value larger than every value summarized by the plot is added to the data.", "Later, one additional value that exceeds the maximum in the plot is recorded."])} The range of the new data set is ${R} ${s.t.unit}.`,
          question: rng.pick([`What is the new value, in ${s.t.unit}?`, `What value, in ${s.t.unit}, was added?`]), correct: x,
          wrongs: pos([W(b.max + R, "formula_misuse", "최댓값에 범위를 더했다."), W(R, "step_missing", "범위를 그대로 답했다."), W(R - (b.max - b.min), "step_missing", "범위의 증가량만 답했다."), W(x - s.s, "other", "눈금 한 칸 어긋났다."), W(x + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== x),
          verificationJs: figJs({ R }, s.fig, `${BX_JS}const b=B[0]; const x=b.min+P.R; if (x<=b.max) throw new Error('새 값이 최댓값 이하'); return x;`),
          trace: [bxRead(s), [`원래 범위 = ${b.max} - ${b.min} = ${b.max - b.min} 이다.`, "Original range."], [`새 값이 가장 크므로 새 범위 = 새 값 - ${b.min} 이다.`, "The new value becomes the maximum."], [`새 값 = ${b.min} + ${R} = ${x} 이다.`, "Solve for the new value."], [`따라서 더해진 값은 ${x} ${s.t.unit} 이다.`, "State the added value."]], variant: "new_max_from_range",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "최댓값보다 큰 새 값 x(정수)가 더해진 뒤 범위가 T 이상이 되는 가장 작은 x 를 구함", extra: "새 범위 = x − 최솟값 ≥ T 를 부등식으로 세워 경계(이상, 정수)까지 따져야 함 — medium 은 범위",
      concepts: ["상자그림", "범위", "부등식과 정수 조건"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const T = (b.max - b.min) + s.s * rng.int(2, 9) + rng.int(0, s.s - 1); const x = b.min + T; if (x <= b.max) throw new GenFail("x");
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(["A new value that is greater than the maximum shown in the plot is added to the data.", "One more whole-number value, larger than every value summarized by the plot, is recorded."])}`,
          question: rng.pick([`What is the least whole-number value, in ${s.t.unit}, the new value could have so that the range of the new data is at least ${T} ${s.t.unit}?`, `For the range of the new data set to be at least ${T} ${s.t.unit}, what is the smallest possible whole-number value of the added value, in ${s.t.unit}?`]), correct: x,
          wrongs: pos([W(x - 1, "condition_ignored", "경계를 놓쳤다."), W(x + 1, "other", "하나 더 올렸다."), W(T, "step_missing", "범위 T 를 그대로 답했다."), W(b.max + T, "formula_misuse", "최댓값에 T 를 더했다."), W(b.min + T - (b.max - b.min), "other", "원래 범위를 두 번 뺐다.")]).filter((w) => w.v !== x),
          verificationJs: figJs({ T }, s.fig, `${BX_JS}const b=B[0]; for (let x=Math.floor(b.max)+1; x<=b.max+100000; x++) if (x-b.min>=P.T) return x; throw new Error('해 없음');`),
          trace: [bxRead(s), [`새 값 x 가 새 최댓값이므로 새 범위 = x - ${b.min} 이다.`, "The new value is the new maximum."], [`x - ${b.min} ≥ ${T} 에서 x ≥ ${x} 이다.`, "Solve the inequality."], [`${x} 는 원래 최댓값 ${b.max} 보다 크므로 조건에 맞는다.`, "It exceeds the old maximum."], [`따라서 가장 작은 정수는 ${x} 이다.`, "Least whole number."]], variant: "least_new_value_for_range",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_max", structure: "상자그림에서 최댓값(오른쪽 꼬리 끝)을 읽음", extra: "easy: 최댓값 읽기", concepts: ["상자그림", "최댓값"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0];
        return gInst(rng, { stimulus: bxIntro(rng, s), question: rng.pick([`What is the greatest value in the data, in ${s.t.unit}?`, `According to the plot, what is the maximum ${s.t.col.toLowerCase()}, in ${s.t.unit}?`]), correct: b.max, wrongs: pos([W(b.q3, "axis_misread", "Q3 를 읽었다."), W(b.median, "axis_misread", "중앙값을 읽었다."), W(b.min, "axis_misread", "최솟값을 읽었다."), W(b.max - s.s, "axis_misread", "눈금 한 칸 어긋나게 읽었다.")]).filter((w) => w.v !== b.max), verificationJs: figJs({}, s.fig, `${BX_JS}return B[0].max;`), trace: [bxRead(s), [`오른쪽 꼬리 끝이 최댓값 ${b.max} 이다.`, "The right whisker ends at the maximum."]], variant: "read_max_whisker",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "range", structure: "상자그림에서 최댓값과 최솟값을 읽어 범위를 구함", extra: "medium: 최댓값 - 최솟값", concepts: ["상자그림", "범위"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const r = b.max - b.min;
        return gInst(rng, { stimulus: bxIntro(rng, s), question: rng.pick([`What is the range of the data, in ${s.t.unit}?`, `What is the difference between the greatest and least values, in ${s.t.unit}?`]), correct: r, wrongs: pos([W(b.q3 - b.q1, "formula_misuse", "사분범위를 구했다."), W(b.max, "step_missing", "최댓값을 답했다."), W(b.max - b.median, "formula_misuse", "오른쪽 절반만 구했다."), W(r + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== r), verificationJs: figJs({}, s.fig, `${BX_JS}return B[0].max - B[0].min;`), trace: [bxRead(s), [`범위 = ${b.max} - ${b.min} = ${r} 이다.`, "Range = max - min."], [`꼬리 끝에서 끝까지의 길이이다.`, "The distance between the whisker ends."]], variant: "range_from_whiskers",
        }, s.fig);
      },
    },
  ],
});
