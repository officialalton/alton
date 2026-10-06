// probability.simple.VT.P — 두 집합 벤 다이어그램의 영역 개수에서 확률(없는 영역·정확히 하나·두 집합 차·역산)을 구한다.
import { GenFail } from "../../../types";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { FWr, INV_JS, VENN_JS, makeVenn, rat, rt, subR, vennFig, vennIntro, type Rat, type VennScene } from "../vt-kit";

const nm = (s: VennScene, k: "a" | "b") => (k === "a" ? s.t.aName : s.t.bName);
const who = (s: VennScene) => `a randomly selected ${s.t.ent}`;
const rd = (s: VennScene): [string, string] => [`벤 다이어그램에서 영역 값을 읽는다: ${nm(s, "a")} 만 ${s.a}, 교집합 ${s.ab}, ${nm(s, "b")} 만 ${s.b}, 어느 쪽도 아님 ${s.out}.`, "Read the four regions."];
const Pq = (rng: import("../../../rng").Rng, s: VennScene, what: string) => rng.pick([`What is the probability that ${who(s)} ${what}?`, `If ${who(s)} is chosen at random, what is the probability that the ${s.t.ent} ${what}?`]);

export const ITEM = defineItem({
  prefix: "prob", itemId: "probability.simple.VT.P",
  hard: [
    {
      op: "chain2", structure: "전체 개수가 주어지고 한 영역이 x 로 가려진 벤 다이어그램에서 x 를 복원한 뒤 어느 집합에도 속하지 않을 확률을 구함", extra: "전체에서 나머지 영역을 빼 x 를 구한 뒤 전체로 나눠야 함(x 를 확률로 답하거나 합집합 확률을 답하는 함정) — medium 은 합집합 확률",
      concepts: ["벤 다이어그램", "확률", "여집합"],
      gen(rng) {
        const s = makeVenn(rng); const p = rat(s.out, s.N); const f = vennFig(s, { hide: "out", total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s, " The total number is shown, and one region is marked $x$."), question: Pq(rng, s, "is in neither group"), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(s.a + s.ab + s.b, s.N), "opposite", "여집합이 아니라 합집합의 확률을 답했다."), FWr(rat(s.out, s.a + s.ab + s.b), "formula_misuse", "전체가 아닌 합집합으로 나눴다."), FWr(rat(s.ab, s.N), "step_missing", "교집합의 확률을 답했다."), FWr(rat(s.out + s.ab, s.N), "formula_misuse", "교집합을 여집합에 더했다.")],
          verificationJs: figJs({}, f, `${VENN_JS}return out/N;`),
          trace: [[`전체 ${s.N} 이고 보이는 영역의 합은 ${s.a + s.ab + s.b} 이다.`, "Read the total and the visible regions."], [`x = ${s.N} - ${s.a + s.ab + s.b} = ${s.out} 이다.`, "Recover x."], [`어느 쪽도 아닌 경우의 수는 ${s.out} 이다.`, "The neither region."], [`확률 = ${s.out}/${s.N} = ${rt(p)} 이다.`, "Divide by the total."], [`따라서 ${rt(p)} 이다.`, "State the probability."]], variant: "neither_missing_region",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "정확히 한 집합에만 속할 확률(교집합 제외)을 구함", extra: "교집합을 빼고 두 영역만 더해야 함(합집합 확률이나 한 집합의 확률을 답하는 함정) — medium 은 합집합 확률",
      concepts: ["벤 다이어그램", "확률", "배타적 사건"],
      gen(rng) {
        const s = makeVenn(rng); const p = rat(s.a + s.b, s.N); const f = vennFig(s, { total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s), question: Pq(rng, s, `is in exactly one of the two groups`), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(s.a + s.ab + s.b, s.N), "condition_ignored", "교집합까지 포함한 합집합 확률을 답했다."), FWr(rat(s.a + s.ab, s.N), "step_missing", "첫 집합 전체의 확률을 답했다."), FWr(rat(s.a + s.b, s.a + s.ab + s.b), "formula_misuse", "합집합으로 나눴다."), FWr(rat(s.a, s.N), "step_missing", "한 영역만 답했다.")],
          verificationJs: figJs({}, f, `${VENN_JS}return (a+b)/N;`),
          trace: [rd(s), [`정확히 하나는 ${nm(s, "a")} 만 ${s.a} 와 ${nm(s, "b")} 만 ${s.b} 의 합 ${s.a + s.b} 이다.`, "Exclude the overlap."], [`전체는 ${s.N} 이다.`, "The total."], [`확률 = ${s.a + s.b}/${s.N} = ${rt(p)} 이다.`, "Divide."], [`따라서 ${rt(p)} 이다.`, "State the probability."]], variant: "exactly_one_group",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "두 집합 각각에 속할 확률을 구해 큰 쪽에서 작은 쪽을 뺀 차를 구함", extra: "각 집합의 교집합 포함 확률을 따로 구해 빼야 함(영역 값끼리 빼거나 순서를 바꾸는 함정) — medium 은 한 집합의 확률",
      concepts: ["벤 다이어그램", "확률", "두 사건 비교"],
      gen(rng) {
        const s = makeVenn(rng); const big = s.a >= s.b ? "a" : "b", sm = big === "a" ? "b" : "a"; const d = subR(rat(s[big] + s.ab, s.N), rat(s[sm] + s.ab, s.N)); if (d[0] === 0) throw new GenFail("차 0");
        const f = vennFig(s, { total: true }); const ph = (k: "a" | "b") => (k === "a" ? s.t.aPh : s.t.bPh);
        return gInst(rng, {
          stimulus: vennIntro(rng, s), question: `By how much does the probability that ${who(s)} ${ph(big)} exceed the probability that ${who(s)} ${ph(sm)}?`, correctText: rt(d), range: [0, 1],
          wrongTexts: [FWr(rat(Math.abs(s.a - s.b), s.N), "step_missing", "교집합을 빼고 영역 값만 비교했다."), FWr(rat(s[big] + s.ab, s.N), "step_missing", "큰 쪽의 확률만 답했다."), FWr(rat(s[big] - s[sm], s[big] + s[sm]), "formula_misuse", "분모를 잘못 잡았다."), FWr(rat(s.a + s.ab + s.b, s.N), "formula_misuse", "합집합 확률을 답했다.")],
          verificationJs: figJs({ big }, f, `${VENN_JS}const pa=(a+ab)/N, pb=(b+ab)/N; return P.big==='a'?pa-pb:pb-pa;`),
          trace: [rd(s), [`P(${nm(s, big)}) = (${s[big]} + ${s.ab})/${s.N}, P(${nm(s, sm)}) = (${s[sm]} + ${s.ab})/${s.N} 이다.`, "Each set includes the overlap."], [`차 = ${s[big] - s[sm]}/${s.N} 이다.`, "Subtract."], [`기약분수로 ${rt(d)} 이다.`, "Simplify."], [`따라서 ${rt(d)} 이다.`, "State the difference."]], variant: "difference_two_sets",
        }, f);
      },
    },
    {
      op: "inverse", structure: "한 집합의 확률이 주어지고 교집합이 x 로 가려질 때 x 를 거꾸로 구해 두 집합에 모두 속할 확률을 구함", extra: "확률에 전체를 곱해 x 를 구해야 함(주어진 확률을 그대로 답하는 함정) — medium 은 영역 값이 모두 보이는 경우",
      concepts: ["벤 다이어그램", "확률", "역산"],
      gen(rng) {
        const s = makeVenn(rng, { abLo: 3 }); const pa = rat(s.a + s.ab, s.N); const f = vennFig(s, { hide: "ab", total: true }); const p = rat(s.ab, s.N);
        if (pa[1] === s.N && false) throw new GenFail("x");
        return gInst(rng, {
          stimulus: vennIntro(rng, s, ` The total number is shown, and the overlap is marked $x$. The probability that ${who(s)} ${s.t.aPh} is $\\frac{${pa[0]}}{${pa[1]}}$.`), question: Pq(rng, s, "is in both groups"), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(pa, "step_missing", "주어진 확률을 그대로 답했다."), FWr(rat(s.ab, s.a + s.ab), "formula_misuse", "첫 집합을 기준으로 나눴다."), FWr(rat(s.a, s.N), "step_missing", "첫 집합에만 속할 확률을 답했다."), FWr(rat(s.ab + s.b, s.N), "formula_misuse", "둘째 집합의 확률을 답했다.")],
          verificationJs: figJs({ pn: pa[0], pd: pa[1] }, f, `${INV_JS}return x/TOT;`),
          trace: [rd(s), [`P(${nm(s, "a")}) = ${rt(pa)} 이므로 ${nm(s, "a")} 의 총 인원 = ${rt(pa)} × ${s.N} = ${s.a + s.ab} 이다.`, "Total in the first set from the probability."], [`x = ${s.a + s.ab} - ${s.a} = ${s.ab} 이다.`, "Solve for the overlap."], [`확률 = ${s.ab}/${s.N} = ${rt(p)} 이다.`, "Divide by the total."], [`따라서 ${rt(p)} 이다.`, "State the probability."]], variant: "both_from_probability",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "one_set", structure: "한 집합 전체(교집합 포함)의 확률을 구함", extra: "easy: (한 집합만 + 교집합) ÷ 전체", concepts: ["벤 다이어그램", "확률"],
      gen(rng) {
        const s = makeVenn(rng); const k = rng.pick(["a", "b"] as const); const p = rat(s[k] + s.ab, s.N); const f = vennFig(s, { total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s), question: Pq(rng, s, k === "a" ? s.t.aPh : s.t.bPh), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(s[k], s.N), "step_missing", "교집합을 빠뜨렸다."), FWr(rat(s[k] + s.ab, s[k] + s.ab + (k === "a" ? s.b : s.a)), "formula_misuse", "합집합으로 나눴다."), FWr(rat(s.ab, s.N), "step_missing", "교집합만 답했다."), FWr(rat(s[k === "a" ? "b" : "a"] + s.ab, s.N), "axis_misread", "다른 집합의 확률을 답했다.")],
          verificationJs: figJs({ k }, f, `${VENN_JS}return (P.k==='a'?a+ab:b+ab)/N;`),
          trace: [rd(s), [`${nm(s, k)} 전체 = ${s[k]} + ${s.ab} = ${s[k] + s.ab} 이다.`, "Include the overlap."], [`확률 = ${s[k] + s.ab}/${s.N} = ${rt(p)} 이다.`, "Divide."]], variant: "one_set_probability",
        }, f);
      },
    },
    {
      lv: "medium", name: "union", structure: "두 집합 중 적어도 하나에 속할 확률을 구함", extra: "medium: 어느 쪽도 아님을 제외", concepts: ["벤 다이어그램", "확률", "합집합"],
      gen(rng) {
        const s = makeVenn(rng); const p = rat(s.a + s.ab + s.b, s.N); const f = vennFig(s, { total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s), question: Pq(rng, s, "is in at least one of the two groups"), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(s.a + s.b, s.N), "condition_ignored", "교집합을 빠뜨렸다."), FWr(rat(s.out, s.N), "opposite", "여집합을 답했다."), FWr(rat(s.a + s.ab + s.b, s.a + s.ab + s.b + 1 + s.out), "other", "분모를 잘못 잡았다."), FWr(rat(s.ab, s.N), "step_missing", "교집합만 답했다.")],
          verificationJs: figJs({}, f, `${VENN_JS}return (a+ab+b)/N;`),
          trace: [rd(s), [`적어도 하나 = ${s.a} + ${s.ab} + ${s.b} = ${s.a + s.ab + s.b} 이다.`, "Add the three regions."], [`확률 = ${s.a + s.ab + s.b}/${s.N} = ${rt(p)} 이다.`, "Divide."]], variant: "union_probability",
        }, f);
      },
    },
  ],
});
void ({} as Rat);
