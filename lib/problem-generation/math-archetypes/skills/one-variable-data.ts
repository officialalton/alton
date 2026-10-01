// one_variable_data — hard 원형 16개(세부 패턴 4 × 연산자 4) + easy 2 + medium 3 원형. 자료는 그림 없이 지문에 나열(표는 문장으로 서술).
import { GenFail, type Archetype } from "../types";
import { facts, spin, withParams, fmtNum } from "../text";
import { asLevel, withBind, type LArch } from "../levels-d";
import { W, SCENES, DATA_CTX as DATA_CTX_ALL, listSentence, sum, rndList, medianOf, fin as finish } from "./d-kit";
import type { Rng } from "../rng";

const SKILL = "one_variable_data";
const ctx = (rng: Rng) => DATA_CTX_ALL[rng.int(0, DATA_CTX_ALL.length - 1)];
const sc = (rng: Rng) => rng.pick(SCENES);
const r2 = (x: number) => Math.round(x * 100) / 100;
const TALLY: [string, string, string, string, string][] = [["pets", "pets", "households", "household", "pet"], ["siblings", "siblings", "students", "student", "sibling"], ["books borrowed", "books", "visitors", "visitor", "book"], ["goals scored", "goals", "matches", "match", "goal"], ["cars owned", "cars", "families", "family", "car"], ["rooms booked", "rooms", "groups", "group", "room"]];

export const OVD_HARD: Archetype[] = [
  // ───────── mean ─────────
  {
    id: "ovd.mean.inverse", skill: SKILL, kind: "mean", operator: "inverse",
    structure: "n 개 자료의 평균과 값 하나를 빼거나(더해) 바뀐 평균이 주어질 때 합의 변화로 그 값을 역산",
    extraThinking: "평균에서 합을 복원하고 개수가 바뀐 새 평균에서 새 합을 구해 두 합의 차로 숨은 값을 구하는 역산 — medium 은 나열된 값의 평균 계산",
    concepts: ["평균과 합의 관계", "개수 변화", "역산"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const n = rng.int(5, 9), M = rng.int(40, 90), add = rng.chance(0.5); const S1 = n * M;
      if (!add) { const M2 = rng.int(M - 12, M + 12); const x = S1 - (n - 1) * M2; if (x < 10 || x > 150 || M2 === M) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`The mean of the ${s.measure} for ${n} ${s.ent} is ${M}.`, `For ${n} ${s.ent}, the mean of the ${s.measure} is ${M}.`, `The ${s.measure} of ${n} ${s.ent} have a mean of ${M}.`], [`When one of the values is removed, the mean of the remaining ${n - 1} values is ${M2}.`, `After one value is taken out, the other ${n - 1} values have a mean of ${M2}.`, `Removing a single value leaves ${n - 1} values with mean ${M2}.`]]),
          question: spin(rng, `[[What is the value that was removed?|Find the value that was removed.|What was the removed value?]]`), correct: x,
          wrongs: [W(Math.abs(M - M2), "step_missing", "평균의 차만 답했다."), W(x - M2 + M, "formula_misuse", "합 대신 평균끼리 계산했다."), W(n * M2 - (n - 1) * M + 0 > 0 ? n * M2 - (n - 1) * M : x + 1, "formula_misuse", "두 평균의 역할을 바꿔 합을 구했다."), W(M2 - (M - M2) * (n - 1) + 0, "formula_misuse", "개수 변화를 반영하지 않고 차에 개수를 곱했다."), W(x + (n - 1), "other", "계산 중 어긋났다.")],
          verificationJs: withParams({ n, M, M2 }, "let out=null;\nfor(let x=0;x<=400;x++){ if((P.n*P.M-x)===(P.n-1)*P.M2) out=x; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
          trace: [[`처음 합 = ${n} × ${M} = ${S1} 이다.`, "Recover the original sum."], [`남은 ${n - 1} 개의 합 = ${n - 1} × ${M2} = ${(n - 1) * M2} 이다.`, "Recover the remaining sum."], [`빠진 값 = 처음 합 - 남은 합 = ${S1} - ${(n - 1) * M2} 이다.`, "Subtract the two sums."], [`값은 ${x} 이다.`, "Evaluate."], [`개수가 ${n} 에서 ${n - 1} 로 줄었음을 확인한다.`, "Check the counts."]], variant: "removed_value" }), [{ noun: "mean", value: M }]); }
      const M2 = rng.int(M - 12, M + 12); const x = (n + 1) * M2 - S1; if (x < 10 || x > 150 || M2 === M) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`The mean of the ${s.measure} for ${n} ${s.ent} is ${M}.`, `For ${n} ${s.ent}, the mean of the ${s.measure} is ${M}.`, `The ${s.measure} of ${n} ${s.ent} have a mean of ${M}.`], [`After one more value is included, the mean of all ${n + 1} values is ${M2}.`, `When another value is added, the ${n + 1} values have a mean of ${M2}.`, `Including one additional value changes the mean of the ${n + 1} values to ${M2}.`]]),
        question: spin(rng, `[[What is the value that was added?|Find the added value.|What was the additional value?]]`), correct: x,
        wrongs: [W(Math.abs(M2 - M), "step_missing", "평균의 차만 답했다."), W(M2, "other", "새 평균을 답했다."), W(x - n, "formula_misuse", "개수를 한 번 덜 반영했다."), W(n * M2 - S1, "formula_misuse", "새 개수 n+1 대신 n 으로 곱했다."), W(x + 2, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ n, M, M2 }, "let out=null;\nfor(let x=0;x<=400;x++){ if((P.n*P.M+x)===(P.n+1)*P.M2) out=x; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`처음 합 = ${n} × ${M} = ${S1} 이다.`, "Recover the original sum."], [`새 합 = ${n + 1} × ${M2} = ${(n + 1) * M2} 이다.`, "Recover the new sum."], [`더해진 값 = 새 합 - 처음 합 = ${(n + 1) * M2} - ${S1} 이다.`, "Subtract the sums."], [`값은 ${x} 이다.`, "Evaluate."], [`개수가 ${n} 에서 ${n + 1} 로 늘었음을 확인한다.`, "Check the counts."]], variant: "added_value" }), [{ noun: "mean", value: M }]);
    },
  },
  {
    id: "ovd.mean.compare_scenarios", skill: SKILL, kind: "mean", operator: "compare_scenarios",
    structure: "크기와 평균이 다른 두 집단을 합쳤을 때의 평균(가중평균)과 한 집단 평균과의 차를 구함",
    extraThinking: "두 집단의 합을 각각 복원하고 전체 개수로 나눈 가중평균을 구해 기준 집단과 비교 — medium 은 한 자료의 평균 계산",
    concepts: ["평균과 합의 관계", "가중평균", "두 집단 비교"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const n1 = rng.int(4, 14), n2 = rng.int(4, 14), m1 = rng.int(45, 90), m2 = rng.int(45, 90); if (n1 === n2 || m1 === m2) throw new GenFail("x");
      const T = n1 * m1 + n2 * m2; if (T % (n1 + n2) !== 0) throw new GenFail("x"); const comb = T / (n1 + n2); const ask = rng.int(0, 1); const correct = ask === 0 ? comb : Math.abs(comb - m1);
      if (ask === 1 && correct === 0) throw new GenFail("x");
      const [g1, g2] = rng.pick([["Group A", "Group B"], ["Sample 1", "Sample 2"], ["Set X", "Set Y"], ["Data set 1", "Data set 2"]]);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${g1} has ${n1} ${s.ent}, and the mean of their ${s.measure} is ${m1}.`, `The ${s.measure} of the ${n1} ${s.ent} in ${g1} have a mean of ${m1}.`], [`${g2} has ${n2} ${s.ent}, and the mean of their ${s.measure} is ${m2}.`, `The ${s.measure} of the ${n2} ${s.ent} in ${g2} have a mean of ${m2}.`], [`The two groups are combined into one.`, `All of the ${s.ent} are then pooled together.`]]),
        question: spin(rng, ask === 0 ? `[[What is the mean of the ${s.measure} for the combined group?|Find the mean for all ${n1 + n2} ${s.ent} together.]]` : `[[By how much does the mean of the combined group differ from the mean of ${g1}?|What is the positive difference between the combined mean and the mean of ${g1}?]]`), correct,
        wrongs: [W((m1 + m2) / 2, "formula_misuse", "두 평균을 단순 평균했다(가중하지 않았다)."), W(ask === 0 ? Math.abs(m1 - m2) : comb, "other", "다른 값을 답했다."), W(ask === 0 ? (n1 * m1 + n2 * m2) / (n1 + n2 + 1) : Math.abs(comb - m2), "formula_misuse", "기준 집단을 바꿨거나 개수를 잘못 셌다."), W(ask === 0 ? T / 2 : Math.abs((m1 + m2) / 2 - m1), "formula_misuse", "합을 2로 나눴다(또는 단순 평균과 비교했다)."), W(correct + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ n1, m1, n2, m2, ask }, "const a=Array(P.n1).fill(P.m1).concat(Array(P.n2).fill(P.m2)); const mean=a.reduce((x,y)=>x+y,0)/a.length;\nreturn P.ask===0?mean:Math.abs(mean-P.m1);"),
        trace: [[`${g1} 의 합 = ${n1} × ${m1} = ${n1 * m1} 이다.`, "Sum of the first group."], [`${g2} 의 합 = ${n2} × ${m2} = ${n2 * m2} 이다.`, "Sum of the second group."], [`전체 합 = ${T}, 전체 개수 = ${n1 + n2} 이다.`, "Combine."], [`합친 평균 = ${T} ÷ ${n1 + n2} = ${comb} 이다.`, "Weighted mean."], [ask === 0 ? `답은 ${comb} 이다.` : `차 = |${comb} - ${m1}| = ${Math.abs(comb - m1)} 이다.`, "Answer."]], variant: ask === 0 ? "combined_mean" : "combined_vs_group" }), [{ noun: g1, value: n1 }, { noun: g2, value: n2 }]);
    },
  },
  {
    id: "ovd.mean.chain2", skill: SKILL, kind: "mean", operator: "chain2",
    structure: "자료의 평균과 개수가 주어지고 모든 값에 일차 변환(곱하고 더하기)을 한 뒤 새 값 하나를 추가한 평균을 구함",
    extraThinking: "평균은 일차 변환을 그대로 따른다는 성질로 새 합을 구하고, 이어서 값을 추가해 개수가 바뀐 평균을 구하는 2단계 연쇄 — medium 은 한 자료의 평균 계산",
    concepts: ["평균과 합의 관계", "일차 변환과 평균", "개수 변화 후 평균"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const n = rng.int(4, 10), M = rng.int(10, 60), k = rng.pick([1, 2, 3]), d = rng.nz(-9, 15); const newMean = k * M + d; const x = rng.int(5, 120);
      const S = n * newMean + x; if ((S % (n + 1)) !== 0 || newMean < 1) throw new GenFail("x"); const correct = S / (n + 1);
      const op = k === 1 ? `increased by ${d}` : `multiplied by ${k} and then ${d > 0 ? `increased by ${d}` : `decreased by ${-d}`}`; const opFix = k === 1 && d < 0 ? `decreased by ${-d}` : op;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`The mean of the ${s.measure} for ${n} ${s.ent} is ${M}.`, `For ${n} ${s.ent}, the ${s.measure} have a mean of ${M}.`], [`Every value is ${opFix}.`, `Each of the values is ${opFix}.`, `A rule changes every value: it is ${opFix}.`], [`Then one more value, ${x}, is added to the list.`, `After that, a new value of ${x} is included.`, `A final value of ${x} is then appended.`]]),
        question: spin(rng, `[[What is the mean of the final list of ${n + 1} values?|Find the mean of all ${n + 1} values at the end.]]`), correct,
        wrongs: [W(newMean, "step_missing", "변환 후 평균에서 멈췄다(값 추가를 반영하지 않았다)."), W((newMean + x) / 2, "formula_misuse", "평균과 새 값을 단순 평균했다."), W((n * M + x) / (n + 1), "step_missing", "변환을 빠뜨리고 새 값만 더했다."), W(k * ((n * M + x) / (n + 1)) + d, "formula_misuse", "새 값에도 변환을 적용했다."), W(correct + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ n, M, k, d, x }, "const a=Array(P.n).fill(P.M).map(v=>P.k*v+P.d); a.push(P.x);\nreturn a.reduce((p,q)=>p+q,0)/a.length;"),
        trace: [[`변환 후 평균 = ${k} × ${M} ${d >= 0 ? "+" : "-"} ${Math.abs(d)} = ${newMean} 이다.`, "A linear map transforms the mean the same way."], [`변환 후 합 = ${n} × ${newMean} = ${n * newMean} 이다.`, "New sum."], [`값 ${x} 를 더하면 합 = ${n * newMean + x} 이다.`, "Add the new value."], [`개수는 ${n + 1} 이다.`, "New count."], [`최종 평균 = ${n * newMean + x} ÷ ${n + 1} = ${correct} 이다.`, "Final mean."]], variant: "transform_then_add" }), [{ noun: "mean", value: M }]);
    },
  },
  {
    id: "ovd.mean.constraint_select", skill: SKILL, kind: "mean", operator: "constraint_select",
    structure: "서로 다른 양의 정수 n 개의 평균이 주어질 때 가장 큰 수의 최댓값(또는 최솟값)을 서로 다름 제약으로 찾음",
    extraThinking: "'서로 다른'이라는 제약 아래 나머지 수를 가능한 한 작게(또는 평균 주변에 모이게) 잡아 극값을 추론 — medium 은 나열된 값의 평균",
    concepts: ["평균과 합의 관계", "서로 다른 정수 제약", "극값 추론"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const n = rng.int(4, 6), m = rng.int(8, 20); const S = n * m; const ask = rng.int(0, 1); const smallest = (n * (n + 1)) / 2;
      const greatest = S - (smallest - n); const least = Math.ceil(S / n + (n - 1) / 2); if (greatest <= 0 || S < smallest + 1) throw new GenFail("x");
      const correct = ask === 0 ? greatest : least; const wordN = ["", "", "", "", "Four", "Five", "Six"][n];
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${wordN} different positive integers have a mean of ${m}.`, `The mean of ${n} distinct positive integers is ${m}.`, `A list contains ${n} positive integers, no two of which are equal, and their mean is ${m}.`, `The ${s.measure} of ${n} ${s.ent} are ${n} different positive integers with a mean of ${m}.`, `Each of ${n} ${s.ent} has a different positive whole-number value for the ${s.measure}, and the mean of these ${n} values is ${m}.`]]),
        question: spin(rng, ask === 0 ? `[[What is the greatest possible value of the largest of the integers?|What is the largest value that the biggest integer in the list can have?]]` : `[[What is the least possible value of the largest of the integers?|What is the smallest value that the biggest integer in the list can have?]]`), correct,
        wrongs: ask === 0 ? [W(S - (n - 1), "condition_ignored", "서로 다름을 무시하고 나머지를 모두 1 로 잡았다."), W(S - n * (n - 1) / 2 + 1, "step_missing", "나머지 수의 합을 잘못 구했다."), W(greatest + 1, "other", "계산 중 1 어긋났다."), W(greatest - 1, "other", "계산 중 1 어긋났다."), W(S - smallest, "step_missing", "나머지 n 개를 모두 빼 가장 큰 수를 잘못 구했다.")] : [W(m, "condition_ignored", "서로 다름을 무시하고 평균을 답했다."), W(least + 1, "other", "계산 중 1 어긋났다."), W(least - 1, "other", "계산 중 1 어긋났다."), W(m + n, "formula_misuse", "평균에 개수를 더했다."), W(Math.floor(S / n + n / 2), "formula_misuse", "평균 주변 배치를 잘못 계산했다.")],
        verificationJs: withParams({ n, m, ask }, "const S=P.n*P.m;\nconst can=(L)=>{ const k=P.n-1, T=S-L; if(T<0) return false; const dp=Array.from({length:k+1},()=>new Uint8Array(T+1)); dp[0][0]=1;\n for(let v=1;v<L&&v<=T;v++) for(let c=k-1;c>=0;c--){ const a=dp[c], b=dp[c+1]; for(let t=T-v;t>=0;t--) if(a[t]) b[t+v]=1; }\n return dp[k][T]===1; };\nif(P.ask===0){ for(let L=S;L>=1;L--) if(can(L)) return L; } else { for(let L=1;L<=S;L++) if(can(L)) return L; }\nthrow new Error('해 없음');"),
        trace: [[`합 = ${n} × ${m} = ${S} 이다.`, "Total sum."], [`서로 다른 양의 정수이므로 가장 작은 ${n - 1} 개는 ${Array.from({ length: n - 1 }, (_, i) => i + 1).join(", ")} 이다.`, "Distinct integers: the others are as small as possible."], [ask === 0 ? `나머지 합 ${(n * (n - 1)) / 2} 를 빼면 최댓값 = ${S} - ${(n * (n - 1)) / 2} = ${greatest} 이다.` : "가장 큰 수를 최소로 하려면 수들이 평균 주변에 최대한 모여야 한다.", "Reason about the extreme."], [ask === 0 ? `답은 ${greatest} 이다.` : `연속한 정수에 가깝게 배치하면 가장 큰 수의 하한은 ceil(${m} + ${(n - 1) / 2}) = ${least} 이다.`, "Compute."], [`제약(서로 다름)을 다시 확인한다.`, "Check the constraint."]], variant: ask === 0 ? "greatest_largest" : "least_largest" }), [{ noun: "mean", value: m }]);
    },
  },
  // ───────── median ─────────
  {
    id: "ovd.median.inverse", skill: SKILL, kind: "median", operator: "inverse",
    structure: "여섯 개 자료 중 하나가 미지수 x 이고 중앙값이 주어질 때 정렬 위치를 따져 x 를 역산",
    extraThinking: "미지수의 순서 위치를 가정하고 짝수 개 자료의 중앙값(가운데 두 값의 평균)에서 x 를 거꾸로 구한 뒤 위치 가정을 검증 — medium 은 나열된 값의 중앙값",
    concepts: ["중앙값(짝수 개)", "정렬 위치 가정", "역산·검증"], mediumSteps: 2,
    generate(rng) {
      const s = sc(rng); const sorted = Array.from({ length: 6 }, () => rng.int(5, 90)).sort((a, b) => a - b); if (new Set(sorted).size < 6) throw new GenFail("x"); const xi = rng.pick([2, 3]); const x = sorted[xi]; const med = (sorted[2] + sorted[3]) / 2; if (!Number.isInteger(med)) throw new GenFail("x");
      const known = sorted.filter((_, i) => i !== xi); const sols: number[] = []; for (let t = 0; t <= 200; t++) if (medianOf([...known, t]) === med) sols.push(t); if (sols.length !== 1) throw new GenFail("x");
      const order = rng.shuffle([...known.map(String), "$x$"]);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`The ${s.measure} for 6 ${s.ent} are ${order.join(", ")}, where $x$ is a whole number.`, `Six ${s.ent} have ${s.measure} of ${order.join(", ")}, and $x$ is a whole number.`], [`The median of the six values is ${med}.`, `It is known that the median of these values is ${med}.`, `The values have a median of ${med}.`]]),
        question: spin(rng, `[[What is the value of $x$?|Find $x$.|What whole number is $x$?]]`), correct: x,
        wrongs: [W(med, "step_missing", "중앙값을 그대로 x 로 답했다."), W(2 * med - x, "formula_misuse", "가운데 두 값 중 다른 쪽(알려진 값)을 답했다."), W(x + 1, "other", "계산 중 1 어긋났다."), W(x - 1, "other", "계산 중 1 어긋났다."), W(2 * med, "formula_misuse", "가운데 두 값의 합을 답했다.")],
        verificationJs: withParams({ known, med }, "const sols=[];\nfor(let t=0;t<=200;t++){ const a=[...P.known,t].sort((p,q)=>p-q); const m=(a[2]+a[3])/2; if(m===P.med) sols.push(t); }\nif(sols.length!==1) throw new Error('유일하지 않음');\nreturn sols[0];"),
        trace: [["6 개이므로 중앙값은 정렬했을 때 3번째와 4번째 값의 평균이다.", "Even count: average of the two middle values."], [`x 를 제외한 5 개를 정렬하면 ${known.join(", ")} 이다.`, "Sort the known values."], [`x 가 가운데 두 값 중 하나여야 ${med} 가 만들어진다고 가정한다.`, "Assume where x sits."], [`가운데 두 값의 평균이 ${med} 이므로 두 값의 합은 ${2 * med} 이고, 다른 쪽 값이 ${2 * med - x} 이므로 x = ${x} 이다.`, "Solve for x."], [`x = ${x} 를 넣어 정렬해 중앙값이 ${med} 인지 검증한다.`, "Verify the assumption."]], variant: "unknown_in_list" }), [{ noun: "median", value: med }]);
    },
  },
  {
    id: "ovd.median.constraint_select", skill: SKILL, kind: "median", operator: "constraint_select",
    structure: "다섯 개의 양의 정수의 중앙값과 평균이 주어질 때 정렬 순서 제약으로 가장 큰 수의 최댓값(또는 가장 작은 수의 최댓값)을 구함",
    extraThinking: "중앙값이 정렬된 가운데 값이라는 제약으로 다른 수들의 범위를 한정하고 합 조건과 결합해 극값을 구함 — medium 은 나열된 값의 중앙값",
    concepts: ["중앙값의 정렬 제약", "평균과 합의 관계", "극값 추론"], mediumSteps: 2,
    generate(rng) {
      const m = rng.int(5, 12); const ask = rng.int(0, 1); const mu = ask === 0 ? rng.int(m + 2, m + 14) : rng.int(Math.ceil((3 * m + 2) / 5), m - 1); const S = 5 * mu; const gl = S - 2 - 2 * m; const gs = Math.min(m, Math.floor((S - 3 * m) / 2));
      if (gl < m || gs < 1) throw new GenFail("x"); const correct = ask === 0 ? gl : gs; if (ask === 1 && gs >= m) throw new GenFail("x");
      const s = sc(rng);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`Five positive integers have a median of ${m} and a mean of ${mu}.`, `A list of five positive integers has median ${m} and mean ${mu}.`, `The median of five positive integers is ${m}, and their mean is ${mu}.`, `The ${s.measure} of five ${s.ent} are positive integers with a median of ${m} and a mean of ${mu}.`, `Five ${s.ent} have whole-number ${s.measure}; the median of the five values is ${m} and the mean is ${mu}.`], [`The integers are not necessarily different from one another.`, `Repeated values are allowed.`, `Some of the values may be equal.`]]),
        question: spin(rng, ask === 0 ? `[[What is the greatest possible value of the largest integer?|What is the largest value the biggest of the five integers could have?]]` : `[[What is the greatest possible value of the smallest integer?|What is the largest value the smallest of the five integers could have?]]`), correct,
        wrongs: ask === 0 ? [W(S - 4, "condition_ignored", "중앙값 제약을 무시하고 나머지 넷을 1 로 잡았다."), W(S - 2 - m, "step_missing", "넷째 수도 중앙값 이상이어야 함을 놓쳤다."), W(S - 2 * m, "formula_misuse", "작은 두 수를 0 으로 잡았다."), W(gl + 1, "other", "계산 중 1 어긋났다."), W(gl - 1, "other", "계산 중 1 어긋났다.")] : [W(m, "condition_ignored", "합 조건을 무시하고 중앙값을 답했다."), W(Math.floor((S - 2 * m) / 3), "formula_misuse", "큰 수들의 하한을 잘못 잡았다."), W(gs + 1, "other", "계산 중 1 어긋났다."), W(Math.max(1, gs - 1), "other", "계산 중 1 어긋났다."), W(Math.floor(mu / 2), "other", "평균의 절반을 답했다.")],
        verificationJs: withParams({ m, mu, ask }, "const S=5*P.mu; let best=null;\nfor(let a=1;a<=P.m;a++) for(let b=a;b<=P.m;b++) for(let d=P.m;d<=S;d++){ const e=S-a-b-P.m-d; if(e<d) continue; const v=P.ask===0?e:a; if(best===null||v>best) best=v; }\nif(best===null) throw new Error('해 없음');\nreturn best;"),
        trace: [[`합 = 5 × ${mu} = ${S} 이다.`, "Total sum."], [`정렬하면 x₁ ≤ x₂ ≤ ${m} ≤ x₄ ≤ x₅ 이다(중앙값이 가운데 값).`, "Order constraint from the median."], [ask === 0 ? `x₅ 를 최대로 하려면 x₁ = x₂ = 1, x₄ = ${m}(최소)로 둔다.` : `x₁ 을 최대로 하려면 x₁ = x₂ = a, x₄ = ${m}, x₅ 에 남는 합을 몰아준다.`, "Push the other values to their extremes."], [ask === 0 ? `x₅ = ${S} - (1 + 1 + ${m} + ${m}) = ${gl} 이다.` : `x₅ = ${S} - 2a - 2·${m} ≥ ${m} 이므로 a ≤ ${(S - 3 * m) / 2}, 그리고 a ≤ ${m} 이다.`, "Solve the inequalities."], [`답은 ${correct} 이다.`, "Answer."]], variant: ask === 0 ? "greatest_largest" : "greatest_smallest" }), [{ noun: "median", value: m }, { noun: "mean", value: mu }]);
    },
  },
  {
    id: "ovd.median.compare_scenarios", skill: SKILL, kind: "median", operator: "compare_scenarios",
    structure: "크기가 다른 두 자료 집합 각각의 중앙값과 합친 자료의 중앙값을 구해 그 차를 비교",
    extraThinking: "두 집합을 각각 정렬해 중앙값을 구하고 합친 자료를 다시 정렬해 중앙값을 구한 뒤 비교(합친 중앙값은 두 중앙값의 평균이 아님) — medium 은 한 자료의 중앙값",
    concepts: ["중앙값", "자료 합치기·재정렬", "두 값의 비교"], mediumSteps: 2,
    generate(rng) {
      const s = sc(rng); const A = rndList(rng, 5, 5, 60), B = rndList(rng, 6, 20, 90); const As = rng.shuffle(A), Bs = rng.shuffle(B); const mA = medianOf(A), mB = medianOf(B), mC = medianOf([...A, ...B]); const diff = Math.abs(mB - mC); if (diff === 0 || (diff * 2) % 1 !== 0 || mA === mB) throw new GenFail("x");
      const [n1, n2] = rng.pick([["Set A", "Set B"], ["List 1", "List 2"], ["Sample P", "Sample Q"], ["Data set 1", "Data set 2"]]);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${n1} has the ${s.measure}: ${As.join(", ")}.`, `The ${s.measure} for ${n1} are ${As.join(", ")}.`], [`${n2} has the ${s.measure}: ${Bs.join(", ")}.`, `The ${s.measure} for ${n2} are ${Bs.join(", ")}.`], [`All 11 values are then combined into one list.`, `The two lists are merged into a single list of 11 values.`]]),
        question: spin(rng, `[[What is the positive difference between the median of ${n2} and the median of the combined list?|By how much does the median of ${n2} differ from the median of the combined list?]]`), correct: diff, fmt: fmtNum,
        wrongs: [W(Math.abs(mA - mB), "step_missing", "합치지 않고 두 집합의 중앙값 차를 구했다."), W(Math.abs((mA + mB) / 2 - mB), "formula_misuse", "합친 중앙값을 두 중앙값의 평균으로 계산했다."), W(Math.abs(mC - mA), "other", "다른 집합과 비교했다."), W(diff + 0.5, "other", "계산 중 0.5 어긋났다."), W(diff + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ A, B }, "const med=(a)=>{ const s=[...a].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };\nreturn Math.abs(med(P.B)-med([...P.A,...P.B]));"),
        trace: [[`${n1} 를 정렬해 중앙값 ${mA} 를 구한다.`, "Median of the first list."], [`${n2} 를 정렬해 중앙값 ${mB} 를 구한다(짝수 개이므로 가운데 두 값의 평균).`, "Median of the second list."], [`11 개를 합쳐 다시 정렬한다.`, "Merge and re-sort."], [`합친 자료의 6번째 값이 중앙값 ${mC} 이다.`, "Median of the combined list."], [`차 = |${mB} - ${mC}| = ${diff} 이다.`, "Compare."]], variant: "merge_compare" }), [{ noun: n1, value: As[0] }, { noun: n2, value: Bs[0] }]);
    },
  },
  {
    id: "ovd.median.repr_shift", skill: SKILL, kind: "median", operator: "repr_shift",
    structure: "도수분포(값: 도수)를 문장으로 주고 전체 개수의 가운데 순서를 도수 누적으로 찾아 중앙값을 구함",
    extraThinking: "도수 서술을 정렬된 자료의 순서(누적 도수)로 번역하고 짝수 개일 때 가운데 두 위치가 같은 값인지 확인 — medium 은 정렬된 목록에서 직접 읽기",
    concepts: ["도수분포 → 순서 자료", "누적 도수", "중앙값 위치"], mediumSteps: 2,
    generate(rng) {
      const k = rng.int(4, 6); const lo = rng.int(0, 3); const vals = Array.from({ length: k }, (_, i) => lo + i); const fr = Array.from({ length: k }, () => rng.int(1, 12)); const N = sum(fr); const flat: number[] = []; vals.forEach((v, i) => { for (let j = 0; j < fr[i]; j++) flat.push(v); });
      const mid = N % 2 ? [flat[(N - 1) / 2]] : [flat[N / 2 - 1], flat[N / 2]]; if (mid.length === 2 && mid[0] !== mid[1]) throw new GenFail("x"); const med = mid[0];
      const [topic, unit, ent, entS, unitS] = rng.pick(TALLY);
      const rows = vals.map((v, i) => `${fr[i]} ${fr[i] === 1 ? entS : ent} had ${v} ${v === 1 ? unitS : unit}`); const sentence = rng.pick([`A survey recorded the number of ${topic} for each of the ${ent}: ${rows.join("; ")}.`, `The number of ${topic} per unit was tallied as follows: ${rows.join("; ")}.`, `In a tally of ${topic}, ${rows.join(", ")}.`]);
      return withBind(finish(rng, { stimulus: ctx(rng) + sentence, question: spin(rng, `[[What is the median number of ${unit}?|Find the median of the ${topic} data.|What is the median?]]`), correct: med,
        wrongs: [W(vals[k >> 1], "formula_misuse", "값의 가운데(도수 무시)를 답했다."), W(fr.indexOf(Math.max(...fr)) + lo, "formula_misuse", "최빈값을 답했다."), W(Math.round(sum(vals.map((v, i) => v * fr[i])) / N), "formula_misuse", "평균을 답했다."), W(med + 1, "other", "한 칸 어긋났다."), W(Math.max(0, med - 1), "other", "한 칸 어긋났다.")],
        verificationJs: withParams({ vals, fr }, "const a=[]; P.vals.forEach((v,i)=>{ for(let j=0;j<P.fr[i];j++) a.push(v); });\nconst m=a.length>>1; return a.length%2?a[m]:(a[m-1]+a[m])/2;"),
        trace: [[`전체 개수 = ${fr.join(" + ")} = ${N} 이다.`, "Total count."], [`중앙값의 위치: ${N % 2 ? `(${N} + 1)/2 = ${(N + 1) / 2}번째` : `${N / 2}번째와 ${N / 2 + 1}번째`} 이다.`, "Locate the middle."], [`누적 도수를 구한다: ${fr.map((_, i) => sum(fr.slice(0, i + 1))).join(", ")}.`, "Cumulative frequencies."], [`그 위치를 처음 포함하는 값은 ${med} 이다.`, "Find the value covering the middle position."], [`짝수 개이면 두 위치의 값이 같은지 확인한다.`, "Check the even case."]], variant: "frequency_tally" }), [{ noun: [ent, entS], value: fr[0] }]);
    },
  },
  // ───────── range ─────────
  {
    id: "ovd.range.inverse", skill: SKILL, kind: "range", operator: "inverse",
    structure: "다섯 개 자료 중 네 개가 나열되고 전체 범위가 주어질 때 다섯째 값이 될 수 있는 값(두 경우)을 구함",
    extraThinking: "다섯째 값이 새 최댓값일 때와 새 최솟값일 때 두 경우로 나누어 범위 조건을 풀고 가능한 값을 모두 찾음 — medium 은 나열된 값의 범위",
    concepts: ["범위(최댓값-최솟값)", "경우 나누기", "역산"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const base = rndList(rng, 4, 20, 70); const mx = Math.max(...base), mn = Math.min(...base); const lr = mx - mn; const r = lr + rng.int(3, 15); const hi = mn + r, lo = mx - r;
      if (lo < 0 || lr < 5) throw new GenFail("x"); const ask = rng.int(0, 2); const correct = ask === 0 ? hi : ask === 1 ? lo : hi + lo;
      const sols: number[] = []; for (let t = 0; t <= 400; t++) { const a = [...base, t]; if (Math.max(...a) - Math.min(...a) === r) sols.push(t); } if (sols.length !== 2) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`Four of the five ${s.measure} are ${rng.shuffle(base).join(", ")}.`, `The ${s.measure} for five ${s.ent} include ${rng.shuffle(base).join(", ")} and one unknown value.`], [`The range of all five values is ${r}.`, `Together, the five values have a range of ${r}.`]]),
        question: spin(rng, ask === 0 ? `[[What is the greatest possible value of the fifth value?|What is the largest the unknown value could be?]]` : ask === 1 ? `[[What is the least possible value of the fifth value?|What is the smallest the unknown value could be?]]` : `[[What is the sum of the two possible values of the fifth value?|If there are two possible values for the unknown value, what is their sum?]]`), correct,
        wrongs: [W(r, "other", "범위를 그대로 답했다."), W(ask === 0 ? lo : hi, "other", "다른 경우의 값을 답했다."), W(mx + r, "formula_misuse", "최댓값에 범위를 더했다."), W(mn - r, "formula_misuse", "최솟값에서 범위를 뺐다."), W(correct + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ base, r, ask }, "const sols=[];\nfor(let t=0;t<=400;t++){ const a=[...P.base,t]; if(Math.max(...a)-Math.min(...a)===P.r) sols.push(t); }\nif(sols.length!==2) throw new Error('두 경우가 아님');\nreturn P.ask===0?Math.max(...sols):P.ask===1?Math.min(...sols):sols[0]+sols[1];"),
        trace: [[`나열된 네 값의 최댓값은 ${mx}, 최솟값은 ${mn} 이다.`, "Max and min of the known values."], [`범위 ${r} 가 ${mx - mn} 보다 크므로 다섯째 값이 새 최댓값 또는 새 최솟값이어야 한다.`, "The unknown value must extend the range."], [`새 최댓값이면 x - ${mn} = ${r} 이므로 x = ${hi} 이다.`, "Case 1: x is the new maximum."], [`새 최솟값이면 ${mx} - x = ${r} 이므로 x = ${lo} 이다.`, "Case 2: x is the new minimum."], [`묻는 값은 ${correct} 이다.`, "Answer."]], variant: "fifth_value_cases" }), [{ noun: "range", value: r }]);
    },
  },
  {
    id: "ovd.range.constraint_select", skill: SKILL, kind: "range", operator: "constraint_select",
    structure: "서로 다른 양의 정수 n 개의 평균이 주어질 때 가능한 가장 작은 범위를 합 조건과 서로 다름 제약으로 찾음",
    extraThinking: "서로 다른 정수는 범위가 n-1 이상이고 합이 정해지면 연속 정수 배치가 불가능할 수 있음을 합의 성질로 추론 — medium 은 나열된 값의 범위",
    concepts: ["범위", "서로 다른 정수 제약", "합 조건과 극값"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const n = rng.int(4, 6); const S = rng.int(n * 6, n * 14); const mean = S / n; if (!Number.isInteger(mean * 10)) throw new GenFail("x");
      const exists = (a: number, r: number) => { const k = n - 2; const T = S - 2 * a - r; const dp = Array.from({ length: k + 1 }, () => new Set<number>()); dp[0].add(0); for (let v = a + 1; v < a + r; v++) for (let c = k - 1; c >= 0; c--) for (const t of [...dp[c]]) dp[c + 1].add(t + v); return dp[k].has(T); };
      let best = -1; for (let r = n - 1; r <= 30 && best < 0; r++) for (let a = 1; a <= S && best < 0; a++) if (exists(a, r)) best = r; if (best < 0) throw new GenFail("x");
      if (best === n - 1 && S % n === 0) throw new GenFail("x"); const wordN = ["", "", "", "", "Four", "Five", "Six"][n];
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${wordN} different positive integers have a mean of ${mean}.`, `A list of ${n} distinct positive integers has a mean of ${mean}.`, `The mean of ${n} positive integers, no two of them equal, is ${mean}.`, `The ${s.measure} of ${n} ${s.ent} are ${n} different positive integers whose mean is ${mean}.`, `Each of ${n} ${s.ent} has a different positive whole-number value for the ${s.measure}; the mean of the ${n} values is ${mean}.`]]),
        question: spin(rng, `[[What is the smallest possible range of the integers?|What is the least possible value of the range?|What is the minimum range that such a list can have?]]`), correct: best,
        wrongs: [W(n - 1, "condition_ignored", "합 조건을 무시하고 연속 정수의 범위를 답했다."), W(best + 1, "other", "계산 중 1 어긋났다."), W(Math.max(1, best - 1), "other", "계산 중 1 어긋났다."), W(n, "other", "개수를 범위로 답했다."), W(Math.round(mean), "other", "평균을 답했다.")],
        verificationJs: withParams({ n, mean }, "const S=Math.round(P.n*P.mean); const exists=(a,r)=>{ const k=P.n-2, T=S-2*a-r; if(T<0) return false; const dp=Array.from({length:k+1},()=>new Uint8Array(T+1)); dp[0][0]=1;\n for(let v=a+1;v<a+r&&v<=T;v++) for(let c=k-1;c>=0;c--){ const x=dp[c], y=dp[c+1]; for(let t=T-v;t>=0;t--) if(x[t]) y[t+v]=1; }\n return dp[k][T]===1; };\nfor(let r=P.n-1;r<=60;r++) for(let a=1;a<=S;a++) if(exists(a,r)) return r;\nthrow new Error('해 없음');"),
        trace: [[`합 = ${n} × ${mean} = ${S} 이다.`, "Total sum."], [`서로 다른 ${n} 개의 정수의 범위는 최소 ${n - 1} 이다.`, "Distinct integers need range at least n - 1."], [`연속한 ${n} 개 정수의 합은 ${n}a + ${(n * (n - 1)) / 2} 꼴이다.`, "Sum of consecutive integers."], [`이 합이 ${S} 와 같지 않으면 범위를 하나씩 늘려 가능한지 확인한다.`, "Try larger ranges."], [`가능한 가장 작은 범위는 ${best} 이다.`, "State the minimum."]], variant: "min_range_distinct" }), [{ noun: "mean", value: mean }]);
    },
  },
  {
    id: "ovd.range.compare_scenarios", skill: SKILL, kind: "range", operator: "compare_scenarios",
    structure: "두 자료의 범위를 각각 구하고 합친 자료의 범위(전체 최댓값 - 전체 최솟값)와 비교",
    extraThinking: "합친 자료의 범위는 두 범위의 합·평균이 아니라 전체 최대·최소로 다시 구해야 함 — medium 은 한 자료의 범위",
    concepts: ["범위", "자료 합치기", "두 값의 비교"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const A = rndList(rng, rng.int(5, 7), 10, 60), B = rndList(rng, rng.int(5, 7), 30, 95); const rA = Math.max(...A) - Math.min(...A), rB = Math.max(...B) - Math.min(...B); const rC = Math.max(...A, ...B) - Math.min(...A, ...B); const diff = rC - rA; if (diff <= 0 || rC === rA + rB || rB === rA) throw new GenFail("x");
      const [n1, n2] = rng.pick([["Set A", "Set B"], ["List 1", "List 2"], ["Sample P", "Sample Q"], ["Data set 1", "Data set 2"]]);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${n1} has the ${s.measure}: ${A.join(", ")}.`, `The ${s.measure} for ${n1} are ${A.join(", ")}.`], [`${n2} has the ${s.measure}: ${B.join(", ")}.`, `The ${s.measure} for ${n2} are ${B.join(", ")}.`], [`The two lists are combined into one.`, `All of the values are then pooled together.`]]),
        question: spin(rng, `[[By how much is the range of the combined list greater than the range of ${n1}?|What is the difference between the range of the combined list and the range of ${n1}?]]`), correct: diff,
        wrongs: [W(rB, "other", "다른 집합의 범위를 답했다."), W(rA + rB - rA, "other", "다른 집합의 범위를 답했다."), W(rC, "step_missing", "합친 범위를 그대로 답했다."), W(rB - rA, "formula_misuse", "합치지 않고 두 범위의 차를 구했다."), W(diff + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ A, B }, "const r=(a)=>Math.max(...a)-Math.min(...a);\nreturn r([...P.A,...P.B])-r(P.A);"),
        trace: [[`${n1} 의 최댓값 ${Math.max(...A)}, 최솟값 ${Math.min(...A)} 이므로 범위는 ${rA} 이다.`, "Range of the first list."], [`${n2} 의 최댓값 ${Math.max(...B)}, 최솟값 ${Math.min(...B)} 이다.`, "Max and min of the second list."], [`합친 자료의 최댓값은 ${Math.max(...A, ...B)}, 최솟값은 ${Math.min(...A, ...B)} 이다.`, "Overall max and min."], [`합친 범위 = ${Math.max(...A, ...B)} - ${Math.min(...A, ...B)} = ${rC} 이다.`, "Combined range."], [`차 = ${rC} - ${rA} = ${diff} 이다.`, "Compare."]], variant: "merge_range" }), [{ noun: n1, value: A[0] }, { noun: n2, value: B[0] }]);
    },
  },
  {
    id: "ovd.range.compose_kind", skill: SKILL, kind: "range", operator: "compose_kind",
    structure: "나열된 자료에 일차 변환(곱하고 빼기)을 적용했을 때 새 평균과 새 범위의 합을 구함(평균·범위의 변환 규칙 결합)",
    extraThinking: "평균은 변환 전체를, 범위는 곱하는 배수만 따른다는 두 성질을 구분해 결합 — medium 은 나열된 값의 범위만 계산",
    concepts: ["범위", "평균", "일차 변환의 영향"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const n = rng.int(5, 8); const A = rndList(rng, n, 6, 40); const S = sum(A); if (S % n !== 0) throw new GenFail("x"); const mean = S / n; const range = Math.max(...A) - Math.min(...A); const k = rng.pick([2, 3, 4]), d = rng.int(1, 15); const sub = rng.chance(0.5); const dd = sub ? -d : d;
      const nm = k * mean + dd, nr = k * range; const correct = nm + nr; if (new Set(A).size < 4 || range < 4) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[listSentence(rng, s, A)], [`Each value is multiplied by ${k} and then ${sub ? "decreased" : "increased"} by ${d}.`, `A new list is formed by multiplying every value by ${k} and ${sub ? "subtracting" : "adding"} ${d}.`, `Every value is converted with the rule: multiply by ${k}, then ${sub ? "subtract" : "add"} ${d}.`]]),
        question: spin(rng, `[[What is the sum of the mean and the range of the new list?|Find the mean of the new list plus its range.|What do you get by adding the new mean and the new range?]]`), correct,
        wrongs: [W(nm + range, "formula_misuse", "범위에 변환(곱하기)을 적용하지 않았다."), W(nm + k * range + d, "formula_misuse", "범위에도 더하기·빼기를 적용했다."), W(mean + range + dd, "step_missing", "평균·범위에 곱하기를 적용하지 않았다."), W(nm + nr + dd, "formula_misuse", "상수를 한 번 더 반영했다."), W(correct + 1, "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ A, k, d: dd }, "const b=P.A.map(v=>P.k*v+P.d); const mean=b.reduce((x,y)=>x+y,0)/b.length;\nreturn mean+(Math.max(...b)-Math.min(...b));"),
        trace: [[`원래 평균 = ${S} ÷ ${n} = ${mean}, 원래 범위 = ${Math.max(...A)} - ${Math.min(...A)} = ${range} 이다.`, "Original mean and range."], [`새 평균 = ${k} × ${mean} ${dd >= 0 ? "+" : "-"} ${Math.abs(dd)} = ${nm} 이다.`, "The mean follows the whole transformation."], [`범위는 더하거나 빼는 상수에는 영향이 없고 곱하는 수만 곱해진다.`, "The range ignores the shift."], [`새 범위 = ${k} × ${range} = ${nr} 이다.`, "New range."], [`합 = ${nm} + ${nr} = ${correct} 이다.`, "Add."]], variant: "linear_transform_mean_range" }), [{ noun: s.measure, value: A[0] }]);
    },
  },
  // ───────── grouped_median_interval ─────────
  ...groupedHard(),
];

// ───────── grouped_median_interval(도수분포표를 문장으로 서술) ─────────
type Tbl = { lo: number; w: number; f: number[] };
const intervalOf = (t: Tbl, rank: number) => { let c = 0; for (let i = 0; i < t.f.length; i++) { c += t.f[i]; if (rank <= c) return i; } return t.f.length - 1; };
const medianInterval = (t: Tbl): number => { const N = sum(t.f); const r1 = Math.floor((N + 1) / 2), r2 = Math.ceil((N + 1) / 2); const a = intervalOf(t, r1), b = intervalOf(t, r2); return a === b ? a : -1; };
const tblText = (rng: Rng, t: Tbl, ent: string, unit: string) => {
  const rows = t.f.map((f, i) => `${t.lo + i * t.w} to ${t.lo + (i + 1) * t.w - 1}: ${f}`);
  return rng.pick([`A frequency table groups the number of ${unit} for ${sum(t.f)} ${ent} into intervals (interval: number of ${ent}): ${rows.join("; ")}.`, `The ${unit} of ${sum(t.f)} ${ent} are grouped as follows (interval: count): ${rows.join("; ")}.`, `Data about ${unit} for ${sum(t.f)} ${ent} are summarized in intervals, with counts listed as interval: count — ${rows.join("; ")}.`]);
};
const GTOP: [string, string][] = [["minutes of exercise per week", "students"], ["points on a final exam", "students"], ["miles driven in a month", "drivers"], ["minutes waited in line", "customers"], ["words typed per minute", "typists"], ["dollars spent on lunch", "workers"]];
function groupedHard(): Archetype[] {
  const mk = (rng: Rng, k: number) => { const lo = rng.pick([0, 10, 20, 50]); const w = rng.pick([5, 10, 20]); const f = Array.from({ length: k }, () => rng.int(2, 14)); return { lo, w, f } as Tbl; };
  const los = (t: Tbl) => t.f.map((_, i) => t.lo + i * t.w);
  const rowBind = (t: Tbl, i = 0) => ({ noun: `${t.lo + i * t.w} to ${t.lo + (i + 1) * t.w - 1}`, value: t.f[i] });
  const MEDJS = "const medIdx=(f)=>{ const a=[]; f.forEach((c,i)=>{ for(let j=0;j<c;j++) a.push(i); }); const N=a.length; if(N===0) return -1; const lo=a[Math.floor((N+1)/2)-1], hi=a[Math.ceil((N+1)/2)-1]; return lo===hi?lo:-1; };";
  return [
    {
      id: "ovd.grouped_median_interval.repr_shift", skill: SKILL, kind: "grouped_median_interval", operator: "repr_shift",
      structure: "구간별 도수를 문장으로 주고 전체 개수의 가운데 순서를 누적 도수로 찾아 중앙값이 속한 구간의 시작 값을 구함",
      extraThinking: "구간 도수를 누적 순서 자료로 번역하고 짝수 개일 때 가운데 두 순서가 같은 구간인지까지 확인 — medium 은 구간이 적은 표에서 중앙값 구간 읽기",
      concepts: ["도수분포표", "누적 도수", "중앙값의 위치"], mediumSteps: 4,
      generate(rng) {
        const k = rng.int(5, 6); const t = mk(rng, k); const mi = medianInterval(t); if (mi < 0) throw new GenFail("x"); const [unit, ent] = rng.pick(GTOP); const N = sum(t.f); const correct = t.lo + mi * t.w;
        const cum = t.f.map((_, i) => sum(t.f.slice(0, i + 1)));
        return withBind(finish(rng, { stimulus: ctx(rng) + tblText(rng, t, ent, unit), question: spin(rng, `[[The median lies in one of the intervals. What is the lower endpoint of that interval?|Which interval contains the median? Give its lower endpoint.|What is the smallest value in the interval that contains the median?]]`), correct,
          wrongs: [W(t.lo + t.f.indexOf(Math.max(...t.f)) * t.w, "formula_misuse", "도수가 가장 큰 구간(최빈 구간)을 답했다."), W(t.lo + (k >> 1) * t.w, "formula_misuse", "구간의 가운데 번째를 답했다(누적 도수 무시)."), W(t.lo + Math.min(k - 1, mi + 1) * t.w, "other", "한 구간 뒤를 답했다."), W(t.lo + Math.max(0, mi - 1) * t.w, "other", "한 구간 앞을 답했다."), W(correct + t.w - 1, "formula_misuse", "구간의 끝 값을 답했다.")],
          verificationJs: withParams({ los: los(t), f: t.f }, `${MEDJS}\nconst i=medIdx(P.f); if(i<0) throw new Error('가운데 두 값이 다른 구간');\nreturn P.los[i];`),
          trace: [[`전체 도수 = ${t.f.join(" + ")} = ${N} 이다.`, "Total count."], [`중앙값의 위치: ${N % 2 ? `${(N + 1) / 2}번째` : `${N / 2}번째와 ${N / 2 + 1}번째`} 이다.`, "Locate the middle position."], [`누적 도수: ${cum.join(", ")} 이다.`, "Cumulative frequencies."], [`그 위치를 처음 포함하는 구간은 ${t.lo + mi * t.w} to ${t.lo + (mi + 1) * t.w - 1} 이다.`, "Identify the interval."], [`구간의 시작 값은 ${correct} 이다.`, "Read the lower endpoint."]], variant: "median_interval" }), [rowBind(t, 0)]);
      },
    },
    {
      id: "ovd.grouped_median_interval.inverse", skill: SKILL, kind: "grouped_median_interval", operator: "inverse",
      structure: "한 구간의 도수가 미지수 x 인 도수분포표에서 중앙값이 지정한 구간에 있도록 하는 x 의 최댓값을 역산",
      extraThinking: "미지의 도수가 전체 개수와 누적 도수를 함께 바꾼다는 점을 반영해 중앙값 위치 조건을 부등식으로 세워 x 의 상한을 구함 — medium 은 도수가 모두 주어진 표",
      concepts: ["도수분포표", "누적 도수 부등식", "역산"], mediumSteps: 4,
      generate(rng) {
        const k = 5; const t = mk(rng, k); const missing = rng.int(0, k - 1); const [unit, ent] = rng.pick(GTOP);
        const medAt = (x: number) => { const f = [...t.f]; f[missing] = x; return medianInterval({ ...t, f }); };
        const target = medAt(rng.int(2, 20)); if (target < 0 || target === missing) throw new GenFail("x");
        const sols: number[] = []; for (let x = 0; x <= 80; x++) if (medAt(x) === target) sols.push(x); if (sols.length < 2 || sols[sols.length - 1] === 80) throw new GenFail("x"); const correct = Math.max(...sols); if (correct < 3) throw new GenFail("x");
        const rows = t.f.map((f, i) => `${t.lo + i * t.w} to ${t.lo + (i + 1) * t.w - 1}: ${i === missing ? "$x$" : f}`);
        const tl = t.lo + target * t.w; const th = t.lo + (target + 1) * t.w - 1; const fp = t.f.map((f, i) => (i === missing ? null : f));
        const stimulus = ctx(rng) + facts(rng, [[`A frequency table groups the number of ${unit} for some ${ent} into intervals (interval: number of ${ent}): ${rows.join("; ")}, where $x$ is a whole number.`, `The ${unit} of some ${ent} are grouped as follows (interval: count): ${rows.join("; ")}, with $x$ a whole number.`], [`The median lies in the interval ${tl} to ${th}.`, `It is known that the median is in the interval from ${tl} to ${th}.`]]);
        const bi = (missing === 0 ? 1 : 0);
        return withBind(finish(rng, { stimulus, question: spin(rng, `[[What is the greatest possible value of $x$?|What is the largest whole number that $x$ can be?]]`), correct,
          wrongs: [W(Math.min(...sols), "other", "가능한 값 중 가장 작은 값을 답했다."), W(correct + 1, "step_missing", "경계(가운데 두 순서 모두 같은 구간)를 포함해 센다."), W(Math.max(0, correct - 1), "step_missing", "경계를 하나 덜 센다."), W(Math.abs(sum(t.f) - t.f[missing]), "formula_misuse", "다른 구간의 도수 합을 답했다."), W(correct + 2, "other", "계산 중 2 어긋났다.")],
          verificationJs: withParams({ los: los(t), f: fp as unknown as number[], targetLo: tl }, `${MEDJS}\nconst mi=P.f.indexOf(null); const target=P.los.indexOf(P.targetLo);\nlet best=null; for(let x=0;x<=80;x++){ const f=[...P.f]; f[mi]=x; if(medIdx(f)===target) best=x; }\nif(best===null||best===80) throw new Error('해 없음');\nreturn best;`),
          trace: [[`x 를 포함한 전체 도수 N = ${sum(t.f) - t.f[missing]} + x 이다.`, "Express the total with x."], [`중앙값이 속한 구간(${tl} 부터)의 누적 도수 범위를 부등식으로 쓴다.`, "Write the cumulative-range condition."], [`x 가 그 구간보다 ${missing < target ? "앞" : "뒤"}에 있으므로 x 가 커질수록 중앙값이 ${missing < target ? "앞" : "뒤"}로 밀린다.`, "Direction of the shift."], [`가운데 두 순서가 모두 구간 안에 있는 마지막 x 를 찾는다.`, "Find the boundary value."], [`가능한 x 의 최댓값은 ${correct} 이다.`, "State the maximum."]], variant: missing < target ? "missing_before_median" : "missing_after_median" }), [rowBind(t, bi)]);
      },
    },
    {
      id: "ovd.grouped_median_interval.constraint_select", skill: SKILL, kind: "grouped_median_interval", operator: "constraint_select",
      structure: "도수분포표의 가장 높은 구간에 사람을 추가할 때 중앙값이 처음 다른 구간으로 넘어가기 위한 최소 추가 인원을 구함",
      extraThinking: "추가 인원이 전체 개수와 가운데 순서를 함께 올린다는 제약을 누적 도수와 비교해 임계 인원을 구함 — medium 은 도수가 고정된 표",
      concepts: ["도수분포표", "누적 도수", "임계값 구하기"], mediumSteps: 4,
      generate(rng) {
        const k = rng.int(4, 5); const t = mk(rng, k); const mi = medianInterval(t); if (mi < 0 || mi >= k - 1) throw new GenFail("x"); const [unit, ent] = rng.pick(GTOP);
        let need = -1; for (let a = 1; a <= 200; a++) { const f = [...t.f]; f[k - 1] += a; const m2 = medianInterval({ ...t, f }); if (m2 !== mi) { need = a; break; } } if (need < 1 || need > 120) throw new GenFail("x");
        const lastLo = t.lo + (k - 1) * t.w; const miLo = t.lo + mi * t.w;
        return withBind(finish(rng, { stimulus: ctx(rng) + tblText(rng, t, ent, unit) + " " + rng.pick([`More ${ent} are added, and all of the new values fall in the interval ${lastLo} to ${lastLo + t.w - 1}.`, `Additional ${ent} join the data; every new value is in the top interval, ${lastLo} to ${lastLo + t.w - 1}.`]), question: spin(rng, `[[What is the least number of ${ent} that must be added so that the median is no longer in the interval ${miLo} to ${miLo + t.w - 1}?|How many ${ent} must be added, at minimum, for the median to leave the interval ${miLo} to ${miLo + t.w - 1}?]]`), correct: need,
          wrongs: [W(need + 1, "step_missing", "경계(두 가운데 순서가 모두 구간 밖)를 지나쳐 하나 더 센다."), W(Math.max(1, need - 1), "step_missing", "경계를 하나 덜 센다."), W(Math.max(1, sum(t.f.slice(mi + 1)) + 1), "formula_misuse", "구간 뒤쪽 도수 합만으로 계산했다."), W(Math.max(1, Math.floor(need / 2)), "formula_misuse", "추가 인원이 전체 개수도 늘린다는 점을 반영하지 않았다."), W(need * 2, "formula_misuse", "추가 인원의 영향을 두 번 반영했다.")],
          verificationJs: withParams({ los: los(t), f: t.f, miLo }, `${MEDJS}\nconst mi=P.los.indexOf(P.miLo); const k=P.f.length;\nfor(let a=1;a<=300;a++){ const f=[...P.f]; f[k-1]+=a; if(medIdx(f)!==mi) return a; }\nthrow new Error('해 없음');`),
          trace: [[`처음 전체 도수 N = ${sum(t.f)} 이고 중앙값은 ${mi + 1}번째 구간(${miLo} 부터)에 있다.`, "Original median interval."], [`그 구간까지의 누적 도수는 ${sum(t.f.slice(0, mi + 1))} 이다.`, "Cumulative count through the median interval."], [`a 명을 더하면 전체가 N + a 이고 가운데 순서가 올라간다.`, "The middle position moves up."], [`가운데 순서가 누적 도수 ${sum(t.f.slice(0, mi + 1))} 를 넘는 가장 작은 a 를 찾는다.`, "Find the threshold."], [`필요한 최소 인원은 ${need} 이다.`, "State the minimum."]], variant: "add_to_top_interval" }), [rowBind(t, 0)]);
      },
    },
    {
      id: "ovd.grouped_median_interval.compare_scenarios", skill: SKILL, kind: "grouped_median_interval", operator: "compare_scenarios",
      structure: "같은 구간으로 묶은 두 집단의 도수분포표에서 각 중앙값 구간을 구해 시작 값의 차를 비교",
      extraThinking: "두 표의 전체 개수가 달라 가운데 순서가 다르므로 각각 누적 도수로 중앙값 구간을 따로 찾아 비교 — medium 은 한 표의 중앙값 구간",
      concepts: ["도수분포표", "누적 도수", "두 집단 비교"], mediumSteps: 4,
      generate(rng) {
        const k = 5; const base = mk(rng, k); const t1 = { ...base }; const t2 = { ...base, f: Array.from({ length: k }, () => rng.int(2, 14)) }; const m1 = medianInterval(t1), m2 = medianInterval(t2); if (m1 < 0 || m2 < 0 || m1 === m2) throw new GenFail("x");
        const [unit, ent] = rng.pick(GTOP); const correct = Math.abs(m1 - m2) * base.w; const [g1, g2] = rng.pick([["Class A", "Class B"], ["Town 1", "Town 2"], ["Group X", "Group Y"]]);
        return withBind(finish(rng, { stimulus: ctx(rng) + `${g1}: ` + tblText(rng, t1, ent, unit) + ` ${g2}: ` + tblText(rng, t2, ent, unit), question: spin(rng, `[[What is the positive difference between the lower endpoints of the intervals that contain the medians of ${g1} and ${g2}?|By how much do the lower endpoints of the two median intervals differ?]]`), correct,
          wrongs: [W(base.w * Math.abs(k - 1 - Math.min(m1, m2)), "other", "다른 값을 답했다."), W(Math.abs(m1 - m2), "unit_error", "구간 번호의 차만 답했다(구간 너비를 곱하지 않았다)."), W(correct + base.w, "other", "한 구간 어긋났다."), W(Math.abs(sum(t1.f) - sum(t2.f)), "other", "전체 개수의 차를 답했다."), W(correct + base.w * 2, "other", "두 구간 어긋났다.")],
          verificationJs: withParams({ los: los(base), f1: t1.f, f2: t2.f }, `${MEDJS}\nconst a=medIdx(P.f1), b=medIdx(P.f2); if(a<0||b<0) throw new Error('모호');\nreturn Math.abs(P.los[a]-P.los[b]);`),
          trace: [[`${g1} 의 전체 도수 ${sum(t1.f)} 로 가운데 순서를 구한다.`, "Middle position of the first table."], [`누적 도수로 ${g1} 의 중앙값 구간(${m1 + 1}번째)을 찾는다.`, "First median interval."], [`${g2} 의 전체 도수 ${sum(t2.f)} 로 가운데 순서를 구한다.`, "Middle position of the second table."], [`${g2} 의 중앙값 구간(${m2 + 1}번째)을 찾는다.`, "Second median interval."], [`시작 값의 차 = |${m1} - ${m2}| × ${base.w} = ${correct} 이다.`, "Difference of lower endpoints."]], variant: "two_tables_median_interval" }), [rowBind(base, 0)]);
      },
    },
  ];
}

// ───────── easy / medium ─────────
const fmtL = (a: number[]) => a.join(", ");
export const OVD_LEVELS: LArch[] = [
  {
    id: "ovd.mean.easy_mean", skill: SKILL, kind: "mean", operator: "repr_shift", level: "easy",
    structure: "나열된 값들의 평균(정수)", extraThinking: "easy: 합을 개수로 나눔", concepts: ["평균", "나눗셈"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const n = rng.int(4, 8); const A = rndList(rng, n, 5, 60); const S = sum(A); if (S % n !== 0 || new Set(A).size < 3) throw new GenFail("x"); const mean = S / n;
      return withBind(finish(rng, { stimulus: ctx(rng) + listSentence(rng, s, A), question: spin(rng, `[[What is the mean of these values?|Find the mean of the ${s.measure}.|What is the average of these values?]]`), correct: mean,
        wrongs: [W(S, "step_missing", "개수로 나누지 않고 합을 답했다."), W(medianOf(A), "formula_misuse", "중앙값을 답했다."), W(Math.max(...A) - Math.min(...A), "formula_misuse", "범위를 답했다."), W(Math.round(S / (n + 1)), "formula_misuse", "개수를 하나 더해 나눴다."), W(mean + 2, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ A }, "return P.A.reduce((x,y)=>x+y,0)/P.A.length;"),
        trace: [[`값을 모두 더한다: 합 = ${S} 이다.`, "Add all the values."], [`개수는 ${n} 이다.`, "Count the values."], [`평균 = ${S} ÷ ${n} = ${mean} 이다.`, "Divide."]], variant: "mean_of_list" }), [{ noun: s.measure, value: A[0] }]);
    },
  },
  {
    id: "ovd.range.easy_range", skill: SKILL, kind: "range", operator: "repr_shift", level: "easy",
    structure: "나열된 값들의 범위", extraThinking: "easy: 최댓값에서 최솟값을 뺌", concepts: ["범위", "뺄셈"], mediumSteps: 1,
    generate(rng) {
      const s = sc(rng); const n = rng.int(5, 9); const A = rndList(rng, n, 5, 95); const r = Math.max(...A) - Math.min(...A); if (new Set(A).size < 4 || r < 10) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + listSentence(rng, s, A), question: spin(rng, `[[What is the range of these values?|Find the range of the ${s.measure}.|What is the difference between the largest and smallest values?]]`), correct: r,
        wrongs: [W(Math.max(...A), "step_missing", "최댓값만 답했다."), W(Math.max(...A) + Math.min(...A), "sign_error", "최댓값과 최솟값을 더했다."), W(Math.round(sum(A) / n), "formula_misuse", "평균을 답했다."), W(r + 1, "other", "계산 중 1 어긋났다."), W(Math.abs(A[0] - A[A.length - 1]), "formula_misuse", "첫 값과 마지막 값의 차를 구했다.")],
        verificationJs: withParams({ A }, "return Math.max(...P.A)-Math.min(...P.A);"),
        trace: [[`가장 큰 값은 ${Math.max(...A)} 이다.`, "Find the maximum."], [`가장 작은 값은 ${Math.min(...A)} 이다.`, "Find the minimum."], [`범위 = ${Math.max(...A)} - ${Math.min(...A)} = ${r} 이다.`, "Subtract."]], variant: "range_of_list" }), [{ noun: s.measure, value: A[0] }]);
    },
  },
  {
    id: "ovd.median.med_median_list", skill: SKILL, kind: "median", operator: "repr_shift", level: "medium",
    structure: "정렬되지 않은 자료의 중앙값(홀수·짝수 개)", extraThinking: "medium: 정렬 후 가운데 위치(또는 가운데 두 값의 평균)", concepts: ["중앙값", "정렬"], mediumSteps: 2,
    generate(rng) {
      const s = sc(rng); const n = rng.int(5, 10); const A = rndList(rng, n, 5, 95); const med = medianOf(A); if (new Set(A).size < n - 1 || (med * 2) % 1 !== 0) throw new GenFail("x");
      const mean = sum(A) / n;
      return withBind(finish(rng, { stimulus: ctx(rng) + listSentence(rng, s, A), question: spin(rng, `[[What is the median of these values?|Find the median of the ${s.measure}.|What is the median of the data?]]`), correct: med,
        wrongs: [W(A[n >> 1], "step_missing", "정렬하지 않고 나열된 순서의 가운데를 답했다."), W(Math.round(mean * 100) / 100, "formula_misuse", "평균을 답했다."), W([...A].sort((a, b) => a - b)[n >> 1], "step_missing", "가운데 값 하나만 고르고 짝수 개일 때의 평균을 구하지 않았다."), W(Math.max(...A) - Math.min(...A), "formula_misuse", "범위를 답했다."), W(med + 2, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ A }, "const s=[...P.A].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2;"),
        trace: [[`값을 작은 것부터 정렬한다: ${[...A].sort((a, b) => a - b).join(", ")}.`, "Sort the values."], [n % 2 ? `개수가 ${n} (홀수)이므로 ${(n + 1) / 2}번째 값이 중앙값이다.` : `개수가 ${n} (짝수)이므로 ${n / 2}번째와 ${n / 2 + 1}번째 값의 평균이 중앙값이다.`, "Locate the middle."], [`중앙값 = ${med} 이다.`, "Evaluate."]], variant: n % 2 ? "median_odd" : "median_even" }), [{ noun: s.measure, value: A[0] }]);
    },
  },
  {
    id: "ovd.mean.med_missing_for_mean", skill: SKILL, kind: "mean", operator: "inverse", level: "medium",
    structure: "목표 평균에 도달하기 위해 필요한 마지막 값을 구함", extraThinking: "medium: 목표 합에서 현재 합을 빼 필요한 값을 역산", concepts: ["평균과 합의 관계", "역산"], mediumSteps: 2,
    generate(rng) {
      const s = sc(rng); const n = rng.int(4, 8); const A = rndList(rng, n - 1, 40, 95); const T = rng.int(55, 90); const x = n * T - sum(A); if (x < 20 || x > 150) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`The ${s.measure} for the first ${n - 1} of ${n} ${s.ent} are ${fmtL(A)}.`, `${n - 1} of the ${n} ${s.ent} have ${s.measure} of ${fmtL(A)}.`, `So far, the ${s.measure} are ${fmtL(A)} for ${n - 1} ${s.ent}; one more of the ${n} remains.`], [`The mean of all ${n} values is to be ${T}.`, `The goal is for the ${n} values to have a mean of ${T}.`, `All ${n} values together must average ${T}.`]]), question: spin(rng, `[[What value is needed for the remaining one so that the mean is ${T}?|What must the last value be?|Find the missing value needed to reach the mean.]]`), correct: x,
        wrongs: [W(T, "other", "목표 평균을 그대로 답했다."), W(Math.round(sum(A) / (n - 1)), "formula_misuse", "현재 평균을 답했다."), W((n - 1) * T - sum(A), "formula_misuse", "개수 n 대신 n-1 로 목표 합을 계산했다."), W(x + 5, "other", "계산 중 어긋났다."), W(Math.abs(n * T - sum(A) - n), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ A, T }, "const n=P.A.length+1; return n*P.T-P.A.reduce((x,y)=>x+y,0);"),
        trace: [[`목표 합 = ${n} × ${T} = ${n * T} 이다.`, "Target sum."], [`현재 ${n - 1} 개의 합 = ${sum(A)} 이다.`, "Current sum."], [`필요한 값 = ${n * T} - ${sum(A)} = ${x} 이다.`, "Subtract."]], variant: "missing_value_for_mean" }), [{ noun: ["mean", "average"], value: T }]);
    },
  },
  {
    id: "ovd.mean.med_freq_mean", skill: SKILL, kind: "mean", operator: "repr_shift", level: "medium",
    structure: "도수(값: 도수)를 문장으로 서술한 자료의 평균(가중평균)", extraThinking: "medium: 값×도수의 합을 전체 도수로 나눔", concepts: ["평균", "도수분포 → 합"], mediumSteps: 3,
    generate(rng) {
      const k = rng.int(3, 5); const lo = rng.int(0, 5); const vals = Array.from({ length: k }, (_, i) => lo + i * rng.pick([1, 2])).sort((a, b) => a - b); if (new Set(vals).size < k) throw new GenFail("x"); const fr = Array.from({ length: k }, () => rng.int(1, 10)); const N = sum(fr); const T = vals.reduce((p, v, i) => p + v * fr[i], 0); if (T % N !== 0) throw new GenFail("x"); const mean = T / N;
      const [topic, unit, ent, entS, unitS] = rng.pick(TALLY);
      const rows = vals.map((v, i) => `${fr[i]} ${fr[i] === 1 ? entS : ent} had ${v} ${v === 1 ? unitS : unit}`);
      return withBind(finish(rng, { stimulus: ctx(rng) + rng.pick([`A survey recorded the number of ${topic} for each of the ${ent}: ${rows.join("; ")}.`, `The number of ${topic} per unit was tallied as follows: ${rows.join("; ")}.`, `In a tally of ${topic}, ${rows.join(", ")}.`]), question: spin(rng, `[[What is the mean number of ${unit}?|Find the mean of the ${topic} data.|What is the average number of ${unit} per unit surveyed?]]`), correct: mean,
        wrongs: [W(Math.round((sum(vals) / k) * 100) / 100, "formula_misuse", "도수를 무시하고 값만 평균했다."), W(T, "step_missing", "전체 도수로 나누지 않았다."), W(Math.round((T / k) * 100) / 100, "formula_misuse", "값의 개수 k 로 나눴다."), W(mean + 1, "other", "계산 중 1 어긋났다."), W(Math.max(0, mean - 1), "other", "계산 중 1 어긋났다.")],
        verificationJs: withParams({ vals, fr }, "const a=[]; P.vals.forEach((v,i)=>{ for(let j=0;j<P.fr[i];j++) a.push(v); });\nreturn a.reduce((x,y)=>x+y,0)/a.length;"),
        trace: [[`값 × 도수의 합 = ${vals.map((v, i) => `${v}×${fr[i]}`).join(" + ")} = ${T} 이다.`, "Weighted sum."], [`전체 도수 = ${N} 이다.`, "Total count."], [`평균 = ${T} ÷ ${N} = ${mean} 이다.`, "Divide."]], variant: "mean_from_frequency" }), [{ noun: [ent, entS], value: fr[0] }]);
    },
  },
];
export const OVD_ALL: LArch[] = [...OVD_HARD.map((a) => asLevel(a)), ...OVD_LEVELS];
void r2;
