// probability.sequential_without_replacement.VT.P — 비복원 두 번 추출 수형도의 가지 확률(모르는 가지는 x)에서 결합확률·전확률·같은 색 대 다른 색의 차·처음 개수 역산을 구한다.
import { GenFail } from "../../../types";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { FWr, TREE_JS, addR, bagIntro, bagTree, makeBag, mulR, rat, rt, subR, type BagScene } from "../vt-kit";

const cn = (s: BagScene, i: 0 | 1) => (i === 0 ? s.t.c1 : s.t.c2).toLowerCase();
const cnt = (s: BagScene) => [s.r, s.b];
const joint = (s: BagScene, i: 0 | 1, j: 0 | 1) => mulR(rat(cnt(s)[i], s.N), rat(cnt(s)[j] - (i === j ? 1 : 0), s.N - 1));
const rd = (s: BagScene): [string, string] => [`수형도의 가지 확률을 읽는다: 첫 단계 ${s.t.c1} ${s.r}/${s.N}, ${s.t.c2} ${s.b}/${s.N}; 둘째 단계의 분모는 ${s.N - 1} 이다.`, "Read the branch probabilities."];
const ZERO: ReturnType<typeof rat> = [0, 1];

export const ITEM = defineItem({
  prefix: "prob", itemId: "probability.sequential_without_replacement.VT.P",
  hard: [
    {
      op: "chain2", structure: "둘째 단계 한 가지가 x 로 가려진 수형도에서 형제 가지의 합 1 로 x 를 구한 뒤 두 가지의 곱(결합확률)을 구함", extra: "x = 1 − 형제 가지로 복원한 뒤 첫 단계와 곱해야 함(x 를 그대로 답하거나 첫 단계 확률만 답하는 함정) — medium 은 가지가 모두 보이는 경우",
      concepts: ["수형도", "비복원 추출", "결합확률", "여사건"],
      gen(rng) {
        const s = makeBag(rng); const i = rng.pick([0, 1] as const), j = rng.pick([0, 1] as const); const o = (1 - j) as 0 | 1; const p = joint(s, i, j); const t = bagTree(s, { l2: [i, j] });
        return gInst(rng, {
          stimulus: bagIntro(rng, s, " One branch probability is marked $x$."), question: `What is the probability that the first ${s.t.item} is ${cn(s, i)} and the second ${s.t.item} is ${cn(s, j)}?`, correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(cnt(s)[i], s.N), "step_missing", "첫 단계 확률만 답했다."), FWr(rat(cnt(s)[j] - (i === j ? 1 : 0), s.N - 1), "step_missing", "둘째 단계 확률(x)만 답했다."), FWr(mulR(rat(cnt(s)[i], s.N), rat(cnt(s)[j], s.N)), "formula_misuse", "복원 추출처럼 곱했다."), FWr(addR(rat(cnt(s)[i], s.N), rat(cnt(s)[j] - (i === j ? 1 : 0), s.N - 1)), "formula_misuse", "곱 대신 더했다.")],
          verificationJs: figJs({ i, j }, t, `${TREE_JS}return P1[P.i]*P2[P.i][P.j];`),
          trace: [rd(s), [`x 는 같은 가지에서 나온 다른 확률의 여사건이므로 x = ${rt(rat(cnt(s)[j] - (i === j ? 1 : 0), s.N - 1))} 이다.`, "Sibling branches sum to 1."], [`첫 단계 ${cn(s, i)} = ${rt(rat(cnt(s)[i], s.N))} 이다.`, "First draw."], [`곱 = ${rt(rat(cnt(s)[i], s.N))} × ${rt(rat(cnt(s)[j] - (i === j ? 1 : 0), s.N - 1))} = ${rt(p)} 이다.`, "Multiply along the path."], [`따라서 ${rt(p)} 이다.`, "State the probability."]], variant: `joint_missing_branch_${i}${j}${o}`,
        }, t);
      },
    },
    {
      op: "compose_kind", structure: "두 경로(첫 번째가 같은 색·다른 색)의 결합확률을 더해 둘째가 특정 색일 확률(전확률)을 구함", extra: "두 경로를 모두 구해 더해야 함(한 경로만 답하는 함정) — medium 은 한 경로",
      concepts: ["수형도", "전확률", "비복원 추출"],
      gen(rng) {
        const s = makeBag(rng); const j = rng.pick([0, 1] as const); const p = addR(joint(s, 0, j), joint(s, 1, j)); const t = bagTree(s);
        return gInst(rng, {
          stimulus: bagIntro(rng, s), question: `What is the probability that the second ${s.t.item} is ${cn(s, j)}?`, correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(joint(s, j, j), "step_missing", "한 경로만 답했다."), FWr(joint(s, (1 - j) as 0 | 1, j), "step_missing", "다른 한 경로만 답했다."), FWr(rat(cnt(s)[j] - 1, s.N - 1), "step_missing", "둘째 단계 한 가지 확률만 답했다."), FWr(mulR(rat(cnt(s)[j], s.N), rat(cnt(s)[j], s.N)), "formula_misuse", "복원 추출처럼 구했다.")],
          verificationJs: figJs({ j }, t, `${TREE_JS}return P1[0]*P2[0][P.j]+P1[1]*P2[1][P.j];`),
          trace: [rd(s), [`첫째가 ${cn(s, 0)} 인 경로: ${rt(joint(s, 0, j))} 이다.`, "First path."], [`첫째가 ${cn(s, 1)} 인 경로: ${rt(joint(s, 1, j))} 이다.`, "Second path."], [`합 = ${rt(joint(s, 0, j))} + ${rt(joint(s, 1, j))} = ${rt(p)} 이다.`, "Add the paths."], [`따라서 ${rt(p)} 이다.`, "State the probability."]], variant: `total_probability_second_${j}`,
        }, t);
      },
    },
    {
      op: "compare_scenarios", structure: "같은 색 두 개일 확률과 서로 다른 색일 확률을 각각 구해 차를 구함", extra: "네 경로를 두 묶음으로 나눠 각각 합한 뒤 빼야 함(한 묶음만 답하거나 순서를 바꾸는 함정) — medium 은 한 경로",
      concepts: ["수형도", "결합확률", "두 사건 비교"],
      gen(rng) {
        const s = makeBag(rng); const same = addR(joint(s, 0, 0), joint(s, 1, 1)), diff = addR(joint(s, 0, 1), joint(s, 1, 0)); const d = subR(same, diff); if (d[0] === 0) throw new GenFail("차 0"); const t = bagTree(s);
        return gInst(rng, {
          stimulus: bagIntro(rng, s), question: `How much greater is the probability that the two ${s.t.items} are the same color than the probability that they are different colors?`.replace("greater", "greater (or, if negative, how much less)"), correctText: rt(d), range: [-1, 1],
          wrongTexts: [FWr([-d[0], d[1]], "sign_error", "빼는 순서를 바꿨다."), FWr(same, "step_missing", "같은 색의 확률만 답했다."), FWr(diff, "step_missing", "다른 색의 확률만 답했다."), FWr(subR(joint(s, 0, 0), joint(s, 0, 1)), "formula_misuse", "경로 둘만 비교했다.")],
          verificationJs: figJs({}, t, `${TREE_JS}return (P1[0]*P2[0][0]+P1[1]*P2[1][1])-(P1[0]*P2[0][1]+P1[1]*P2[1][0]);`),
          trace: [rd(s), [`같은 색 = ${rt(joint(s, 0, 0))} + ${rt(joint(s, 1, 1))} = ${rt(same)} 이다.`, "Same-color paths."], [`다른 색 = ${rt(joint(s, 0, 1))} + ${rt(joint(s, 1, 0))} = ${rt(diff)} 이다.`, "Different-color paths."], [`차 = ${rt(same)} - ${rt(diff)} = ${rt(d)} 이다.`, "Subtract."], [`따라서 ${rt(d)} 이다.`, "State the difference."]], variant: "same_minus_different",
        }, t);
      },
    },
    {
      op: "inverse", structure: "첫 단계 한 가지가 x 로 가려지고 둘째 단계 분수에서 처음 개수를 거꾸로 구함", extra: "둘째 단계 분모에서 전체 개수를, 분자에서 첫 색의 개수를 거꾸로 구해야 함(분자를 그대로 답하는 함정) — medium 은 확률",
      concepts: ["수형도", "비복원 추출", "역산"],
      gen(rng) {
        const s = makeBag(rng); const t = bagTree(s, { l1: 0 });
        return gInst(rng, {
          stimulus: bagIntro(rng, s, " One first-draw probability is marked $x$."), question: `How many ${cn(s, 0)} ${s.t.items} were in the ${s.t.bag} before the first ${s.t.item} was ${s.t.drawn}?`, correct: s.r,
          wrongs: [{ v: s.r - 1, kind: "step_missing", reason: "둘째 단계 분자를 그대로 답했다." }, { v: s.b, kind: "axis_misread", reason: "다른 색의 개수를 답했다." }, { v: s.N, kind: "step_missing", reason: "전체 개수를 답했다." }, { v: s.r + 1, kind: "other", reason: "1 을 더 더했다." }],
          verificationJs: figJs({}, t, `if(!FIGURE||FIGURE.kind!=='tree') throw new Error('수형도 필요'); const m=String(FIGURE.branches[0].next[0].label).match(/^(\\d+)\\/(\\d+)$/); if(!m) throw new Error('둘째 단계 분수 필요'); const m2=String(FIGURE.branches[1].label).match(/^(\\d+)\\/(\\d+)$/); if(!m2||Number(m2[2])!==Number(m[2])+1) throw new Error('분모 관계 오류'); return Number(m[1])+1;`),
          trace: [rd(s).map((x) => x) as [string, string], [`둘째 단계 분모 ${s.N - 1} 은 남은 개수이므로 처음 전체는 ${s.N} 이다.`, "The denominator after one draw is N - 1."], [`첫째가 ${cn(s, 0)} 일 때 둘째 단계 ${cn(s, 0)} 확률의 분자는 ${s.r - 1} 이다.`, "One fewer of that color."], [`처음 ${cn(s, 0)} 개수 = ${s.r - 1} + 1 = ${s.r} 이다.`, "Add back the first draw."], [`따라서 ${s.r} 이다.`, "State the count."]], variant: "original_count_from_tree",
        }, t);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "both_same", structure: "두 번 모두 같은 색일 확률을 두 가지 확률의 곱으로 구함", extra: "easy: 가지 곱", concepts: ["수형도", "비복원 추출", "결합확률"],
      gen(rng) {
        const s = makeBag(rng); const i = rng.pick([0, 1] as const); const p = joint(s, i, i); const t = bagTree(s);
        return gInst(rng, {
          stimulus: bagIntro(rng, s), question: `What is the probability that both ${s.t.items} are ${cn(s, i)}?`, correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(cnt(s)[i], s.N), "step_missing", "첫 단계 확률만 답했다."), FWr(mulR(rat(cnt(s)[i], s.N), rat(cnt(s)[i], s.N)), "formula_misuse", "복원 추출처럼 곱했다."), FWr(addR(rat(cnt(s)[i], s.N), rat(cnt(s)[i] - 1, s.N - 1)), "formula_misuse", "곱 대신 더했다."), FWr(joint(s, (1 - i) as 0 | 1, (1 - i) as 0 | 1), "axis_misread", "다른 색의 확률을 답했다.")],
          verificationJs: figJs({ i }, t, `${TREE_JS}return P1[P.i]*P2[P.i][P.i];`),
          trace: [rd(s), [`경로 확률 = ${rt(rat(cnt(s)[i], s.N))} × ${rt(rat(cnt(s)[i] - 1, s.N - 1))} = ${rt(p)} 이다.`, "Multiply along the path."]], variant: "both_same_color",
        }, t);
      },
    },
    {
      lv: "medium", name: "first_then_other", structure: "첫째와 둘째가 서로 다른 지정 색일 확률(한 경로)을 구함", extra: "medium: 다른 색으로 이어지는 경로", concepts: ["수형도", "비복원 추출", "결합확률"],
      gen(rng) {
        const s = makeBag(rng); const i = rng.pick([0, 1] as const); const j = (1 - i) as 0 | 1; const p = joint(s, i, j); const t = bagTree(s);
        return gInst(rng, {
          stimulus: bagIntro(rng, s), question: `What is the probability that the first ${s.t.item} is ${cn(s, i)} and the second is ${cn(s, j)}?`, correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(cnt(s)[i], s.N), "step_missing", "첫 단계 확률만 답했다."), FWr(joint(s, j, i), "axis_misread", "순서를 바꾼 경로를 답했다."), FWr(addR(joint(s, i, j), joint(s, j, i)), "condition_ignored", "두 순서를 모두 더했다."), FWr(mulR(rat(cnt(s)[i], s.N), rat(cnt(s)[j], s.N)), "formula_misuse", "복원 추출처럼 곱했다.")],
          verificationJs: figJs({ i, j }, t, `${TREE_JS}return P1[P.i]*P2[P.i][P.j];`),
          trace: [rd(s), [`첫 단계 ${cn(s, i)} = ${rt(rat(cnt(s)[i], s.N))} 이다.`, "First branch."], [`경로 확률 = ${rt(rat(cnt(s)[i], s.N))} × ${rt(rat(cnt(s)[j], s.N - 1))} = ${rt(p)} 이다.`, "Multiply along the path."]], variant: "first_then_other_color",
        }, t);
      },
    },
  ],
});
void ZERO;
