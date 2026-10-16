// probability.conditional.VT.P — 벤 다이어그램에서 조건부확률(조건이 되는 집합·여집합을 분모로)을 구하고, x 복원·여집합 조건·두 조건부확률의 차·역산으로 확장한다.
import { GenFail } from "../../../types";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { FWr, VENN_JS, makeVenn, rat, rt, subR, vennFig, vennIntro, type VennScene } from "../vt-kit";

const nm = (s: VennScene, k: "a" | "b") => (k === "a" ? s.t.aName : s.t.bName);
const ph = (s: VennScene, k: "a" | "b") => (k === "a" ? s.t.aPh : s.t.bPh);
const given = (s: VennScene, k: "a" | "b") => `a randomly selected ${s.t.ent} ${ph(s, k)}`;
const rd = (s: VennScene): [string, string] => [`벤 다이어그램에서 영역 값을 읽는다: ${nm(s, "a")} 만 ${s.a}, 교집합 ${s.ab}, ${nm(s, "b")} 만 ${s.b}, 어느 쪽도 아님 ${s.out}.`, "Read the four regions."];
const Q1 = (s: VennScene, g: "a" | "b", w: "a" | "b") => `Given that ${given(s, g)}, what is the probability that the ${s.t.ent} ${ph(s, w)}?`;

export const ITEM = defineItem({
  prefix: "prob", itemId: "probability.conditional.VT.P",
  hard: [
    {
      op: "chain2", structure: "전체가 주어지고 교집합이 x 로 가려진 벤 다이어그램에서 x 를 복원한 뒤 한 집합 조건에서 다른 집합의 조건부확률을 구함", extra: "x 를 먼저 구하고 조건 집합 전체를 분모로 써야 함(전체로 나누는 함정) — medium 은 영역 값이 모두 보이는 경우",
      concepts: ["벤 다이어그램", "조건부확률", "미지 영역 복원"],
      gen(rng) {
        const s = makeVenn(rng); const p = rat(s.ab, s.ab + s.b); const f = vennFig(s, { hide: "ab", total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s, " The total number is shown, and the overlap is marked $x$."), question: Q1(s, "b", "a"), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(s.ab, s.N), "condition_ignored", "전체로 나눴다."), FWr(rat(s.ab, s.ab + s.a), "formula_misuse", "조건을 반대로 잡았다."), FWr(rat(s.a + s.ab, s.N), "step_missing", "조건 없이 확률을 답했다."), FWr(rat(s.ab, s.a + s.ab + s.b), "formula_misuse", "합집합으로 나눴다.")],
          verificationJs: figJs({}, f, `${VENN_JS}return ab/(ab+b);`),
          trace: [[`전체 ${s.N} 에서 x = ${s.N} - (${s.a} + ${s.b} + ${s.out}) = ${s.ab} 이다.`, "Recover x from the total."], rd(s), [`조건: ${nm(s, "b")} 에 속함 → 분모는 ${s.ab} + ${s.b} = ${s.ab + s.b} 이다.`, "The condition fixes the denominator."], [`확률 = ${s.ab}/${s.ab + s.b} = ${rt(p)} 이다.`, "Divide."], [`따라서 ${rt(p)} 이다.`, "State the probability."]], variant: "conditional_missing_overlap",
        }, f);
      },
    },
    {
      op: "compose_kind", structure: "한 집합에 속하지 않는다는 조건에서 다른 집합에 속할 조건부확률을 구함", extra: "여집합(어느 쪽도 아님 + 다른 집합만)을 분모로 써야 함(조건 집합을 분모로 쓰는 함정) — medium 은 한 집합 조건",
      concepts: ["벤 다이어그램", "조건부확률", "여집합"],
      gen(rng) {
        const s = makeVenn(rng); const p = rat(s.a, s.a + s.out); const f = vennFig(s, { total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s), question: `Given that a randomly selected ${s.t.ent} does not ${ph(s, "b").replace(/^is /, "belong to the ").replace(/s\b$/, "")}, what is the probability that the ${s.t.ent} ${ph(s, "a")}?`.replace("does not belong to the", "is not in the"), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(s.a, s.N), "condition_ignored", "전체로 나눴다."), FWr(rat(s.a, s.a + s.ab), "formula_misuse", "조건을 잘못 잡았다."), FWr(rat(s.ab, s.ab + s.b), "formula_misuse", "다른 조건부확률을 답했다."), FWr(rat(s.a, s.a + s.b), "formula_misuse", "분모에 둘째 집합만 더했다.")],
          verificationJs: figJs({}, f, `${VENN_JS}return a/(a+out);`),
          trace: [rd(s), [`둘째 집합에 속하지 않는 경우는 ${s.a} + ${s.out} = ${s.a + s.out} 이다.`, "The complement is the new sample space."], [`그중 첫 집합에만 속하는 경우는 ${s.a} 이다.`, "Favorable cases."], [`확률 = ${s.a}/${s.a + s.out} = ${rt(p)} 이다.`, "Divide."], [`따라서 ${rt(p)} 이다.`, "State the probability."]], variant: "conditional_complement",
        }, f);
      },
    },
    {
      op: "compare_scenarios", structure: "서로 반대 조건의 두 조건부확률 P(A|B) 와 P(B|A) 의 차를 구함", extra: "분모가 다른 두 확률을 각각 구해 빼야 함(같은 분모로 오해하거나 순서를 바꾸는 함정) — medium 은 한 조건부확률",
      concepts: ["벤 다이어그램", "조건부확률", "두 확률 비교"],
      gen(rng) {
        const s = makeVenn(rng); const pab = rat(s.ab, s.ab + s.b), pba = rat(s.ab, s.ab + s.a); const d = subR(pab, pba); if (d[0] === 0) throw new GenFail("차 0"); const f = vennFig(s, { total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s), question: `Let $p$ be the probability that a randomly selected ${s.t.ent} ${ph(s, "a")}, given that the ${s.t.ent} ${ph(s, "b")}, and let $q$ be the probability that the ${s.t.ent} ${ph(s, "b")}, given that the ${s.t.ent} ${ph(s, "a")}. What is $p - q$?`, correctText: rt(d), range: [-1, 1],
          wrongTexts: [FWr([-d[0], d[1]], "sign_error", "빼는 순서를 바꿨다."), FWr(pab, "step_missing", "p 만 답했다."), FWr(pba, "step_missing", "q 만 답했다."), FWr(rat(0, 1), "formula_misuse", "두 확률이 같다고 보았다.")],
          verificationJs: figJs({}, f, `${VENN_JS}return ab/(ab+b)-ab/(ab+a);`),
          trace: [rd(s), [`p = ${s.ab}/(${s.ab} + ${s.b}) = ${rt(pab)} 이다.`, "Condition on the second set."], [`q = ${s.ab}/(${s.ab} + ${s.a}) = ${rt(pba)} 이다.`, "Condition on the first set."], [`p - q = ${rt(pab)} - ${rt(pba)} = ${rt(d)} 이다.`, "Subtract."], [`따라서 ${rt(d)} 이다.`, "State the difference."]], variant: "conditional_difference",
        }, f);
      },
    },
    {
      op: "inverse", structure: "P(A|B) 가 주어지고 교집합이 x 로 가려질 때 x 를 구해 반대 조건부확률을 구함", extra: "주어진 조건부확률로 x 를 거꾸로 구해야 함(주어진 확률을 그대로 답하는 함정) — medium 은 영역 값이 모두 보이는 경우",
      concepts: ["벤 다이어그램", "조건부확률", "역산"],
      gen(rng) {
        const s = makeVenn(rng); const pab = rat(s.ab, s.ab + s.b); const p = rat(s.ab, s.ab + s.a); if (pab[1] === 1) throw new GenFail("1"); const f = vennFig(s, { hide: "ab" });
        return gInst(rng, {
          stimulus: vennIntro(rng, s, ` The overlap is marked $x$. Given that ${given(s, "b")}, the probability that the ${s.t.ent} ${ph(s, "a")} is $\\frac{${pab[0]}}{${pab[1]}}$.`), question: Q1(s, "a", "b"), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(pab, "step_missing", "주어진 조건부확률을 그대로 답했다."), FWr(rat(s.ab, s.a + s.ab + s.b), "formula_misuse", "합집합으로 나눴다."), FWr(rat(s.ab, s.a), "formula_misuse", "교집합을 분모에서 뺐다."), FWr(rat(s.a, s.a + s.ab), "formula_misuse", "분자를 잘못 잡았다.")],
          verificationJs: figJs({ pn: pab[0], pd: pab[1] }, f, `if(!FIGURE||FIGURE.kind!=='venn') throw new Error('벤 필요'); const g=(id)=>{ const r=FIGURE.regions.find(q=>q.id===id); return /^\\d+$/.test(String(r.label))?Number(r.label):NaN; }; if(!Number.isNaN(g('ab'))) throw new Error('교집합이 x 여야 함'); const A=g('a'), B=g('b'); const x=P.pn*B/(P.pd-P.pn); if(!Number.isInteger(x)||x<0) throw new Error('x 해석 불가'); return x/(x+A);`),
          trace: [rd(s), [`P(A|B) = x/(x + ${s.b}) = ${rt(pab)} 이므로 x = ${s.ab} 이다.`, "Solve for x."], [`반대 조건: ${nm(s, "a")} 에 속함 → 분모 ${s.ab} + ${s.a} = ${s.ab + s.a} 이다.`, "New denominator."], [`확률 = ${s.ab}/${s.ab + s.a} = ${rt(p)} 이다.`, "Divide."], [`따라서 ${rt(p)} 이다.`, "State the probability."]], variant: "conditional_from_conditional",
        }, f);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "given_b", structure: "한 집합 조건에서 다른 집합의 조건부확률을 구함", extra: "easy: 교집합 ÷ 조건 집합", concepts: ["벤 다이어그램", "조건부확률"],
      gen(rng) {
        const s = makeVenn(rng); const p = rat(s.ab, s.ab + s.b); const f = vennFig(s, { total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s), question: Q1(s, "b", "a"), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(s.ab, s.N), "condition_ignored", "전체로 나눴다."), FWr(rat(s.ab, s.ab + s.a), "formula_misuse", "조건을 반대로 잡았다."), FWr(rat(s.ab, s.b), "formula_misuse", "교집합을 조건 집합에서 뺐다."), FWr(rat(s.a + s.ab, s.N), "step_missing", "조건 없이 확률을 답했다.")],
          verificationJs: figJs({}, f, `${VENN_JS}return ab/(ab+b);`),
          trace: [rd(s), [`조건 집합 ${nm(s, "b")} 전체 = ${s.ab} + ${s.b} = ${s.ab + s.b} 이다.`, "Denominator."], [`확률 = ${s.ab}/${s.ab + s.b} = ${rt(p)} 이다.`, "Divide."]], variant: "conditional_basic",
        }, f);
      },
    },
    {
      lv: "medium", name: "given_a", structure: "반대 집합 조건의 조건부확률을 구함", extra: "medium: 조건 집합을 바꿈", concepts: ["벤 다이어그램", "조건부확률"],
      gen(rng) {
        const s = makeVenn(rng); const p = rat(s.ab, s.ab + s.a); const f = vennFig(s, { total: true });
        return gInst(rng, {
          stimulus: vennIntro(rng, s), question: Q1(s, "a", "b"), correctText: rt(p), range: [0, 1],
          wrongTexts: [FWr(rat(s.ab, s.N), "condition_ignored", "전체로 나눴다."), FWr(rat(s.ab, s.ab + s.b), "formula_misuse", "조건을 반대로 잡았다."), FWr(rat(s.ab, s.a), "formula_misuse", "교집합을 조건 집합에서 뺐다."), FWr(rat(s.b + s.ab, s.N), "step_missing", "조건 없이 확률을 답했다.")],
          verificationJs: figJs({}, f, `${VENN_JS}return ab/(ab+a);`),
          trace: [rd(s), [`조건 집합 ${nm(s, "a")} 전체 = ${s.ab} + ${s.a} = ${s.ab + s.a} 이다.`, "Denominator."], [`확률 = ${s.ab}/${s.ab + s.a} = ${rt(p)} 이다.`, "Divide."]], variant: "conditional_reverse",
        }, f);
      },
    },
  ],
});
