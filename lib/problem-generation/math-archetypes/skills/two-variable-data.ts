// two_variable_data — hard 원형 28개(세부 패턴 7 × 연산자 4) + easy 2 + medium 3 원형.
// 이원표는 칸 값을 문장으로 서술하고, 산점도·회귀선은 '회귀선의 식과 자료점 목록'을 문장·좌표로 서술한다(그림 불필요).
import { GenFail, type Archetype } from "../types";
import { facts, spin, withParams, lin, fmtNum } from "../text";
import { gcd } from "../rng";
import { asLevel, withBind, type LArch } from "../levels-d";
import { W, DATA_CTX, fin as finish } from "./d-kit";
import type { Rng } from "../rng";

const SKILL = "two_variable_data";
const ctx = (rng: Rng) => DATA_CTX[rng.int(0, DATA_CTX.length - 1)];
type Topic = { ent: string; a: string; b: string; y: string; n: string };
const TOPICS: Topic[] = [
  { ent: "students", a: "juniors", b: "seniors", y: "joined the robotics club", n: "did not join the club" },
  { ent: "members", a: "morning members", b: "evening members", y: "use the pool", n: "do not use the pool" },
  { ent: "voters", a: "urban residents", b: "rural residents", y: "support the measure", n: "oppose the measure" },
  { ent: "customers", a: "online customers", b: "in-store customers", y: "bought a warranty", n: "did not buy a warranty" },
  { ent: "patients", a: "adult patients", b: "child patients", y: "received the vaccine", n: "did not receive the vaccine" },
  { ent: "commuters", a: "city commuters", b: "suburban commuters", y: "take the train", n: "drive to work" },
  { ent: "employees", a: "full-time employees", b: "part-time employees", y: "enrolled in the wellness program", n: "did not enroll" },
  { ent: "households", a: "households with children", b: "households without children", y: "own a pet", n: "do not own a pet" },
];
const tp = (rng: Rng) => rng.pick(TOPICS);
const pct = (a: number, b: number) => (a * 100) / b;
const isInt = Number.isInteger;
const CELLJS = "const cells=(c11,c12,c21,c22)=>({r1:c11+c12,r2:c21+c22,y:c11+c21,n:c12+c22,N:c11+c12+c21+c22});";

export const TVD_HARD: Archetype[] = [
  // ───────── cell ─────────
  {
    id: "tvd.cell.inverse", skill: SKILL, kind: "cell", operator: "inverse",
    structure: "전체·한 행의 합·한 열의 합·한 칸이 서술로 주어졌을 때 이원표의 나머지 칸을 역산해 지정한 칸의 값을 구함",
    extraThinking: "표가 아니라 합과 일부 칸만으로 나머지 칸을 거꾸로 복원하는 역산(행·열 합의 두 제약 결합) — medium 은 완성된 표에서 칸 읽기",
    concepts: ["이원표", "행·열 합 관계", "빠진 칸 복원"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const c11 = rng.int(8, 40), c12 = rng.int(8, 40), c21 = rng.int(8, 40), c22 = rng.int(8, 40); const N = c11 + c12 + c21 + c22; const r1 = c11 + c12, cy = c11 + c21; const ask = rng.int(0, 2); const vals = [c12, c21, c22]; const correct = vals[ask];
      const nm = [`${t.a} who ${t.n.replace(/^did not /, "did not ").replace(/^do not /, "do not ")}`, `${t.b} who ${t.y}`, `${t.b} who ${t.n}`][ask];
      const askText = [`How many ${t.a} ${t.n}?`, `How many ${t.b} ${t.y}?`, `How many ${t.b} ${t.n}?`][ask];
      void nm;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A survey of ${N} ${t.ent} found that ${r1} were ${t.a} and the rest were ${t.b}.`, `Among ${N} ${t.ent}, ${r1} are ${t.a}; all of the others are ${t.b}.`], [`In all, ${cy} of the ${N} ${t.ent} ${t.y}.`, `Altogether, ${cy} ${t.ent} ${t.y}.`], [`Of the ${t.a}, ${c11} ${t.y}.`, `${c11} of the ${t.a} ${t.y}.`]]),
        question: askText.replace(/^How many/, rng.pick(["How many", "What is the number of", "Find the number of"]) === "How many" ? "How many" : "How many"), correct,
        wrongs: [W(c11 + (ask === 0 ? c12 : 0) + 0 === correct ? correct + 3 : cy - c11 + (ask === 1 ? 0 : 0), "axis_misread", "행·열 합을 헷갈려 다른 칸의 값을 답했다."), W(N - r1, "other", "다른 행의 합계를 답했다."), W(N - cy, "other", "다른 열의 합계를 답했다."), W(vals[(ask + 1) % 3], "axis_misread", "다른 칸의 값을 답했다."), W(vals[(ask + 2) % 3], "axis_misread", "다른 칸의 값을 답했다."), W(correct + 5, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ N, r1, cy, c11, ask }, "const sols=[];\nfor(let c12=0;c12<=P.N;c12++) for(let c21=0;c21<=P.N;c21++){ const c22=P.N-P.c11-c12-c21; if(c22<0) continue; if(P.c11+c12===P.r1 && P.c11+c21===P.cy) sols.push([c12,c21,c22]); }\nif(sols.length!==1) throw new Error('유일하지 않음');\nreturn sols[0][P.ask];"),
        trace: [[`${t.a} 중 ${t.y} 가 ${c11} 이고 ${t.a} 는 모두 ${r1} 이므로 ${t.a} 중 ${t.n} = ${r1} - ${c11} = ${c12} 이다.`, "Fill the row of the first group."], [`${t.y} 인 전체는 ${cy} 이므로 ${t.b} 중 ${t.y} = ${cy} - ${c11} = ${c21} 이다.`, "Fill the column cell."], [`${t.b} 의 합 = ${N} - ${r1} = ${N - r1} 이다.`, "Second row total."], [`${t.b} 중 ${t.n} = ${N - r1} - ${c21} = ${c22} 이다.`, "Last cell."], [`묻는 칸의 값은 ${correct} 이다.`, "Answer."]], variant: "fill_from_totals" }), [{ noun: t.a, value: r1 }, { noun: t.ent, value: N }]);
    },
  },
  {
    id: "tvd.cell.chain2", skill: SKILL, kind: "cell", operator: "chain2",
    structure: "전체 인원의 비율로 행 합을 구하고 각 행 안의 비율로 칸을 구한 뒤 열 합계(두 칸의 합)를 구함",
    extraThinking: "전체 → 행(퍼센트) → 칸(조건부 퍼센트) → 열 합계의 3단 연쇄(기준이 바뀌는 퍼센트) — medium 은 완성된 표에서 칸 읽기",
    concepts: ["이원표", "조건부 비율", "열 합계"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const N = rng.pick([100, 120, 150, 160, 200, 240, 250, 300, 400]); const p = rng.pick([20, 25, 30, 40, 50, 60, 70, 75, 80]); const q = rng.pick([10, 20, 25, 30, 40, 50, 60, 75]); const s = rng.pick([10, 20, 25, 30, 40, 50, 60, 75]); if (q === s) throw new GenFail("x");
      const r1 = (N * p) / 100, r2 = N - r1; const c11 = (r1 * q) / 100, c21 = (r2 * s) / 100; if (![r1, r2, c11, c21].every(isInt)) throw new GenFail("x"); const correct = c11 + c21;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A survey included ${N} ${t.ent}, and ${p}% of them were ${t.a}; the rest were ${t.b}.`, `Of ${N} ${t.ent}, ${p}% are ${t.a} and the remaining ${t.ent} are ${t.b}.`], [`Among the ${t.a}, ${q}% ${t.y}.`, `${q}% of the ${t.a} ${t.y}.`], [`Among the ${t.b}, ${s}% ${t.y}.`, `${s}% of the ${t.b} ${t.y}.`]]),
        question: spin(rng, `[[How many of the ${N} ${t.ent} ${t.y}?|What is the total number of ${t.ent} who ${t.y.replace(/^(\w+)s /, "$1 ")}?|In all, how many ${t.ent} ${t.y}?]]`).replace(/who (joined|bought|received|enrolled)/, "who $1"), correct,
        wrongs: [W(c11, "step_missing", "첫 행의 칸만 구했다."), W(c21, "step_missing", "둘째 행의 칸만 구했다."), W((N * (q + s)) / 100, "formula_misuse", "두 비율을 전체 인원에 그대로 적용했다."), W((N * q) / 100 + c21, "formula_misuse", "첫 행에도 전체 인원을 기준으로 비율을 적용했다."), W(r1 + r2 - correct, "opposite", "여집합(해당하지 않는 인원)을 답했다."), W(correct + 5, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ N, p, q, s }, "let y=0; for(let i=0;i<P.N;i++){ const inA=i<P.N*P.p/100; const rowSize=inA?P.N*P.p/100:P.N-P.N*P.p/100; const share=inA?P.q:P.s; const idx=inA?i:i-P.N*P.p/100; if(idx<rowSize*share/100) y++; }\nreturn y;"),
        trace: [[`${t.a} = ${N} × ${p}% = ${r1} 이고 ${t.b} = ${N} - ${r1} = ${r2} 이다.`, "Row totals."], [`${t.a} 중 ${t.y} = ${r1} × ${q}% = ${c11} 이다.`, "First cell."], [`${t.b} 중 ${t.y} = ${r2} × ${s}% = ${c21} 이다.`, "Second cell."], [`비율의 기준이 각각 ${t.a}, ${t.b} 의 인원임을 확인한다.`, "Check the percent bases."], [`합계 = ${c11} + ${c21} = ${correct} 이다.`, "Add the two cells."]], variant: "percent_chain_total" }), [{ noun: t.a, value: `${p}%` }, { noun: t.ent, value: N }]);
    },
  },
  {
    id: "tvd.cell.repr_shift", skill: SKILL, kind: "cell", operator: "repr_shift",
    structure: "'전체의 p%', '~보다 d 명 많다', '나머지 중 q%' 같은 서로 다른 서술을 이원표의 칸 방정식으로 번역해 마지막 칸을 구함",
    extraThinking: "퍼센트·차이·조건부 비율 문장을 각각 칸의 식으로 번역해 연립으로 푸는 표현 변환 — medium 은 완성된 표에서 칸 읽기",
    concepts: ["이원표", "문장→칸 방정식", "조건부 비율"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const N = rng.pick([100, 120, 150, 200, 250, 300, 400]); const p = rng.pick([10, 20, 25, 30, 40]); const c11 = (N * p) / 100; const d = rng.int(5, 40); const c12 = c11 + d; const rest = N - c11 - c12; const q = rng.pick([10, 20, 25, 40, 50, 60, 75]); if (rest < 20) throw new GenFail("x"); const c21 = (rest * q) / 100; if (!isInt(c11) || !isInt(c21)) throw new GenFail("x"); const c22 = rest - c21; const correct = c22;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A group of ${N} ${t.ent} is split into ${t.a} and ${t.b}.`, `There are ${N} ${t.ent}, each of whom is either one of the ${t.a} or one of the ${t.b}.`], [`${p}% of all ${t.ent} are ${t.a} who ${t.y}.`, `The ${t.a} who ${t.y} make up ${p}% of the ${N} ${t.ent}.`], [`There are ${d} more ${t.a} who ${t.n} than ${t.a} who ${t.y}.`, `The number of ${t.a} who ${t.n} exceeds the number of ${t.a} who ${t.y} by ${d}.`], [`Of the ${t.b}, ${q}% ${t.y}.`, `${q}% of the ${t.b} ${t.y}.`]]),
        question: spin(rng, `[[How many ${t.b} ${t.n}?|What is the number of ${t.b} who ${t.n.replace(/^did not /, "did not ").replace(/^do not /, "do not ")}?|Find the number of ${t.b} who ${t.n}.]]`), correct,
        wrongs: [W(c21, "axis_misread", "다른 칸(해당 행의 반대 열)을 답했다."), W(rest, "step_missing", "둘째 행 합계를 답했다."), W(N - c11 - c12 - c21 + d, "formula_misuse", "차이 d 를 한 번 더 반영했다."), W((N * (100 - q)) / 100, "formula_misuse", "전체 인원에 비율을 적용했다."), W(c12, "axis_misread", "다른 칸을 답했다."), W(correct + 5, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ N, p, d, q }, "const out=[];\nfor(let c11=0;c11<=P.N;c11++){ if(c11*100!==P.p*P.N) continue; const c12=c11+P.d; for(let c21=0;c21<=P.N;c21++){ const c22=P.N-c11-c12-c21; if(c22<0) continue; if(c21*100===P.q*(c21+c22)) out.push(c22); } }\nif(out.length!==1) throw new Error('유일하지 않음');\nreturn out[0];"),
        trace: [[`${t.a} 중 ${t.y} = ${N} × ${p}% = ${c11} 이다.`, "Translate the percent-of-total statement."], [`${t.a} 중 ${t.n} = ${c11} + ${d} = ${c12} 이다.`, "Translate the difference statement."], [`${t.b} 의 합 = ${N} - ${c11} - ${c12} = ${rest} 이다.`, "Second row total."], [`${t.b} 중 ${t.y} = ${rest} × ${q}% = ${c21} 이다.`, "Conditional percent of the second row."], [`${t.b} 중 ${t.n} = ${rest} - ${c21} = ${c22} 이다.`, "Last cell."]], variant: "statements_to_cells" }), [{ noun: t.ent, value: N }]);
    },
  },
  {
    id: "tvd.cell.constraint_select", skill: SKILL, kind: "cell", operator: "constraint_select",
    structure: "행 합·열 합·전체가 주어진 이원표에서 '둘 다 해당' 칸의 가능한 최솟값(또는 최댓값)을 다른 칸의 하한 제약으로 구함",
    extraThinking: "모든 칸이 0 이상이라는 제약과 '적어도 k 명' 조건을 부등식으로 번역해 한 칸의 범위를 좁힘 — medium 은 완성된 표에서 칸 읽기",
    concepts: ["이원표", "행·열 합 제약", "칸 범위(부등식)"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const N = rng.int(60, 200), r1 = rng.int(Math.floor(N * 0.4), Math.floor(N * 0.75)), cy = rng.int(Math.floor(N * 0.4), Math.floor(N * 0.75)); const k = rng.int(3, 25); const mode = rng.int(0, 1);
      const feas = (c11: number) => { const c12 = r1 - c11, c21 = cy - c11, c22 = N - r1 - cy + c11; if (c12 < 0 || c21 < 0 || c22 < 0) return false; return mode === 0 ? c22 >= k : c12 >= k; };
      let best = -1; if (mode === 0) { for (let c = 0; c <= N; c++) if (feas(c)) { best = c; break; } } else { for (let c = N; c >= 0; c--) if (feas(c)) { best = c; break; } }
      const nok = (() => { let c = -1; for (let x = 0; x <= N; x++) { const c12 = r1 - x, c21 = cy - x, c22 = N - r1 - cy + x; if (c12 >= 0 && c21 >= 0 && c22 >= 0) { if (mode === 0) { c = x; break; } c = x; } } return c; })();
      if (best < 1 || best === nok) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`Of ${N} ${t.ent}, ${r1} are ${t.a} and the rest are ${t.b}.`, `${N} ${t.ent} are classified as ${t.a} (${r1} of them) or ${t.b}.`], [`In all, ${cy} of the ${N} ${t.ent} ${t.y}.`, `A total of ${cy} ${t.ent} ${t.y}.`], [mode === 0 ? `At least ${k} of the ${t.b} ${t.n}.` : `At least ${k} of the ${t.a} ${t.n}.`, mode === 0 ? `The number of ${t.b} who ${t.n} is ${k} or more.` : `${k} or more of the ${t.a} ${t.n}.`]]),
        question: spin(rng, mode === 0 ? `[[What is the least possible number of ${t.a} who ${t.y.replace(/s /, " ")}?|What is the smallest number of ${t.a} that could ${t.y.replace(/^joined /, "have joined ").replace(/^bought /, "have bought ").replace(/^received /, "have received ").replace(/^enrolled /, "have enrolled ")}?]]`.replace(/who (use|support|take|own)/, "who $1") : `[[What is the greatest possible number of ${t.a} who ${t.y}?|What is the largest number of ${t.a} that could be among those who ${t.y}?]]`), correct: best,
        wrongs: [W(nok, "condition_ignored", "'적어도 k' 조건을 무시하고 합 조건만으로 극값을 구했다."), W(best + k, "formula_misuse", "하한(상한)에 k 를 한 번 더 더했다."), W(Math.abs(best - k), "formula_misuse", "극값에서 k 를 뺐다."), W(Math.min(r1, cy), "condition_ignored", "한 행·열의 합 중 작은 쪽을 답했다."), W(Math.max(0, r1 + cy - N), "condition_ignored", "k 조건을 무시하고 겹침의 최솟값을 답했다.")],
        verificationJs: withParams({ N, r1, cy, k, mode }, "let best=-1;\nfor(let c=0;c<=P.N;c++){ const c12=P.r1-c, c21=P.cy-c, c22=P.N-P.r1-P.cy+c; if(c12<0||c21<0||c22<0) continue; const ok=P.mode===0?c22>=P.k:c12>=P.k; if(ok){ if(P.mode===0){ return c; } best=c; } }\nif(best<0) throw new Error('해 없음');\nreturn best;"),
        trace: [[`두 조건을 가진 칸을 c 라 하면 ${t.a} 중 ${t.n} = ${r1} - c, ${t.b} 중 ${t.y} = ${cy} - c 이다.`, "Express the other cells in c."], [`${t.b} 중 ${t.n} = ${N} - ${r1} - ${cy} + c 이다.`, "Last cell."], [`모든 칸은 0 이상이므로 c ≤ ${Math.min(r1, cy)}, c ≥ ${Math.max(0, r1 + cy - N)} 이다.`, "Non-negativity bounds."], [mode === 0 ? `'적어도 ${k}' 조건: ${N - r1 - cy} + c ≥ ${k} 이다.` : `'적어도 ${k}' 조건: ${r1} - c ≥ ${k}, 즉 c ≤ ${r1 - k} 이다.`, "Translate the extra condition."], [`${mode === 0 ? "최솟값" : "최댓값"}은 ${best} 이다.`, "State the extreme."]], variant: mode === 0 ? "least_both" : "greatest_both" }), [{ noun: t.ent, value: N }, { noun: t.a, value: r1 }]);
    },
  },
  // ───────── row_total ─────────
  {
    id: "tvd.row_total.inverse", skill: SKILL, kind: "row_total", operator: "inverse",
    structure: "열 합·한 칸·'다른 행에서의 비율'이 주어질 때 비율에서 그 행의 합계를 역산",
    extraThinking: "열 합계에서 칸을 빼 남은 칸을 구하고 그 칸이 행의 q% 라는 조건에서 행 합계를 거꾸로 구함 — medium 은 두 칸의 합",
    concepts: ["이원표", "열 합계 관계", "퍼센트 역산"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const q = rng.pick([20, 25, 30, 40, 50, 60, 75]); const r2 = rng.pick([40, 50, 60, 80, 100, 120, 160]); const c21 = (r2 * q) / 100; if (!isInt(c21)) throw new GenFail("x"); const c11 = rng.int(10, 80); const cy = c11 + c21; const ask = rng.int(0, 1); const correct = ask === 0 ? r2 : r2 - c21;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`In all, ${cy} ${t.ent} ${t.y}.`, `A total of ${cy} ${t.ent} ${t.y}.`], [`${c11} of them are ${t.a}.`, `Of those, ${c11} are ${t.a}.`], [`Among all ${t.b}, ${q}% ${t.y}; these are the others who ${t.y}.`, `The remaining ones who ${t.y} are ${t.b}, and they make up ${q}% of all ${t.b}.`]]),
        question: spin(rng, ask === 0 ? `[[How many ${t.b} are there in all?|What is the total number of ${t.b}?]]` : `[[How many ${t.b} ${t.n}?|What is the number of ${t.b} who ${t.n}?]]`), correct,
        wrongs: [W(c21, "step_missing", "행 합계가 아니라 그 행의 칸만 답했다."), W(Math.round((cy * 100) / q), "formula_misuse", "열 합계에 비율을 바로 적용했다."), W(cy - c11 + 0 === correct ? correct + 10 : cy, "other", "열 합계를 답했다."), W(Math.round((c11 * 100) / q), "formula_misuse", "다른 행의 칸에 비율을 적용했다."), W(ask === 0 ? r2 - c21 : r2, "other", "묻지 않은 값을 답했다."), W(correct + 10, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ cy, c11, q, ask }, "let out=null;\nfor(let r2=1;r2<=1000;r2++){ const c21=P.cy-P.c11; if(c21*100===P.q*r2){ out=P.ask===0?r2:r2-c21; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`열 합계 ${cy} 에서 ${t.a} 의 ${c11} 을 빼면 ${t.b} 중 ${t.y} = ${c21} 이다.`, "Subtract to get the missing cell."], [`그 칸이 ${t.b} 전체의 ${q}% 이므로 ${t.b} 의 합계를 R 로 두면 ${q}% × R = ${c21} 이다.`, "Translate the percent condition."], [`R = ${c21} ÷ ${q / 100} = ${r2} 이다.`, "Solve for the row total."], [ask === 0 ? `답은 ${r2} 이다.` : `${t.b} 중 ${t.n} = ${r2} - ${c21} = ${r2 - c21} 이다.`, "Answer."]].concat([["단위(%)를 소수로 바꿔 계산했는지 확인한다.", "Check the percent conversion."]]) as [string, string][], variant: "percent_to_row_total" }), [{ noun: t.ent, value: cy }]);
    },
  },
  {
    id: "tvd.row_total.chain2", skill: SKILL, kind: "row_total", operator: "chain2",
    structure: "한 행의 합계가 전체의 p% 임을 이용해 전체를 구하고, 다른 행의 합계를 차로 구한 뒤 그 행의 비율을 적용",
    extraThinking: "행 합계 → 전체 → 다른 행 합계 → 그 행의 일부로 이어지는 연쇄(퍼센트 기준이 전체/행으로 바뀜) — medium 은 두 칸의 합",
    concepts: ["이원표", "행 합계와 전체", "퍼센트 기준 전환"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const N = rng.pick([100, 120, 150, 160, 200, 240, 250, 300, 400]); const p = rng.pick([20, 25, 30, 40, 60, 75, 80]); const r1 = (N * p) / 100; if (!isInt(r1)) throw new GenFail("x"); const r2 = N - r1; const q = rng.pick([10, 20, 25, 40, 50, 60]); const c = (r2 * q) / 100; if (!isInt(c)) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`There are ${r1} ${t.a} in a group of ${t.ent}, and they make up ${p}% of all the ${t.ent}.`, `The ${r1} ${t.a} represent ${p}% of the ${t.ent} in the group.`], [`Everyone else in the group is one of the ${t.b}, and ${q}% of the ${t.b} ${t.y}.`, `All remaining ${t.ent} are ${t.b}; ${q}% of them ${t.y}.`]]),
        question: spin(rng, `[[How many ${t.b} ${t.y}?|What is the number of ${t.b} who ${t.y.replace(/s$/, "")}?]]`).replace(/who (joined|bought|received|enrolled|use|support|take|own)\b/, "who $1"), correct: c,
        wrongs: [W(r2, "step_missing", "행 합계에서 멈췄다."), W((r1 * q) / 100, "formula_misuse", "다른 행의 합계에 비율을 적용했다."), W((N * q) / 100, "formula_misuse", "전체 인원에 비율을 적용했다."), W(N, "other", "전체 인원을 답했다."), W(c + 5, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ r1, p, q }, "let out=null;\nfor(let N=1;N<=2000;N++){ if(N*P.p===P.r1*100){ const r2=N-P.r1; out=r2*P.q/100; } }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`${t.a} ${r1} 명이 전체의 ${p}% 이므로 전체 = ${r1} ÷ ${p / 100} = ${N} 이다.`, "Recover the grand total."], [`${t.b} = ${N} - ${r1} = ${r2} 이다.`, "Other row total."], [`${t.b} 중 ${t.y} = ${r2} × ${q}% 이다.`, "Apply the row-based percent."], [`계산하면 ${c} 이다.`, "Compute."], [`기준이 전체가 아니라 ${t.b} 의 합계임을 확인한다.`, "Check the percent base."]], variant: "total_then_row_percent" }), [{ noun: t.a, value: r1 }]);
    },
  },
  {
    id: "tvd.row_total.repr_shift", skill: SKILL, kind: "row_total", operator: "repr_shift",
    structure: "'둘째 행 합계는 첫째 행의 k 배보다 j 많다'는 문장과 전체 인원을 식으로 번역해 행 합계를 구함",
    extraThinking: "배수·차 관계를 하나의 변수식으로 번역해 전체 합과 연립 — medium 은 두 칸의 합",
    concepts: ["이원표", "문장→일차방정식", "행 합계"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const k = rng.pick([2, 3, 4]); const j = rng.nz(-20, 30); const r1 = rng.int(15, 70); const r2 = k * r1 + j; const N = r1 + r2; if (r2 < 10 || N > 400 || N % 5 !== 0 && rng.chance(0.3)) throw new GenFail("x"); const ask = rng.int(0, 1); const correct = ask === 0 ? r2 : r1; const jj = Math.abs(j);
      const kw = k === 2 ? "twice" : k === 3 ? "three times" : "four times";
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A study of ${N} ${t.ent} separated them into ${t.a} and ${t.b}.`, `${N} ${t.ent} took part, and each was either one of the ${t.a} or one of the ${t.b}.`], [`The number of ${t.b} is ${jj} ${j > 0 ? "more" : "fewer"} than ${kw} the number of ${t.a}.`, `There are ${jj} ${j > 0 ? "more" : "fewer"} ${t.b} than ${kw} the number of ${t.a}.`]]).replace("fewer ", j < 0 ? "fewer " : "fewer "),
        question: spin(rng, ask === 0 ? `[[How many ${t.b} are there?|What is the number of ${t.b}?]]` : `[[How many ${t.a} are there?|What is the number of ${t.a}?]]`), correct,
        wrongs: [W(ask === 0 ? r1 : r2, "other", "다른 행의 합계를 답했다."), W(ask === 0 ? k * r1 : r1 + j, "step_missing", "관계식의 상수 j 를 빠뜨렸다."), W(ask === 0 ? k * r1 - j : r1 - j, "sign_error", "'많다/적다'의 부호를 거꾸로 적용했다."), W(Math.round(N / (k + 1)), "formula_misuse", "상수 j 를 무시하고 비로만 나눴다."), W(N - correct + 0 === (ask === 0 ? r1 : r2) ? correct + 7 : N - correct, "other", "전체에서 뺐다."), W(correct + 5, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ N, k, j, ask }, "let out=null;\nfor(let r1=1;r1<P.N;r1++){ const r2=P.N-r1; if(r2===P.k*r1+P.j) out=P.ask===0?r2:r1; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`${t.a} 의 수를 x 라 하면 ${t.b} 의 수는 ${k}x ${j >= 0 ? "+" : "-"} ${jj} 이다.`, "Translate the relation."], [`전체가 ${N} 이므로 x + (${k}x ${j >= 0 ? "+" : "-"} ${jj}) = ${N} 이다.`, "Set up the total."], [`${k + 1}x = ${N - j} 이므로 x = ${r1} 이다.`, "Solve for x."], [`${t.b} = ${k}·${r1} ${j >= 0 ? "+" : "-"} ${jj} = ${r2} 이다.`, "Evaluate the other row."], [`답은 ${correct} 이다.`, "Answer."]], variant: "relation_to_row_total" }), [{ noun: t.ent, value: N }]);
    },
  },
  {
    id: "tvd.row_total.compare_scenarios", skill: SKILL, kind: "row_total", operator: "compare_scenarios",
    structure: "두 표본(학교·도시)의 전체 인원과 첫 행 비율이 주어질 때 각 행 합계를 구해 차를 비교",
    extraThinking: "서로 다른 전체와 비율을 가진 두 이원표의 행 합계를 각각 구해 크기를 비교(비율이 큰 쪽이 인원도 많은 것은 아님) — medium 은 두 칸의 합",
    concepts: ["이원표", "행 합계", "두 표본 비교"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const nA = rng.pick([100, 120, 150, 200, 250, 300]), nB = rng.pick([80, 100, 160, 200, 240, 400]); const pA = rng.pick([20, 25, 30, 40, 50, 60]), pB = rng.pick([20, 25, 30, 40, 50, 60]); const a = (nA * pA) / 100, b = (nB * pB) / 100; if (!isInt(a) || !isInt(b) || a === b || nA === nB) throw new GenFail("x");
      const [sA, sB] = rng.pick([["School A", "School B"], ["Survey 1", "Survey 2"], ["Town X", "Town Y"], ["Site 1", "Site 2"]]); const correct = Math.abs(a - b);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`In ${sA}, ${nA} ${t.ent} were surveyed, and ${pA}% of them were ${t.a}.`, `${sA} surveyed ${nA} ${t.ent}; ${pA}% were ${t.a}.`], [`In ${sB}, ${nB} ${t.ent} were surveyed, and ${pB}% of them were ${t.a}.`, `${sB} surveyed ${nB} ${t.ent}; ${pB}% were ${t.a}.`]]),
        question: spin(rng, `[[What is the positive difference between the numbers of ${t.a} in the two surveys?|How many more ${t.a} are in the survey with more ${t.a} than in the other survey?]]`), correct,
        wrongs: [W(Math.abs(pA - pB), "other", "비율(%)의 차를 답했다."), W(Math.abs(nA - nB), "other", "전체 인원의 차를 답했다."), W(a + b, "formula_misuse", "차가 아니라 합을 답했다."), W(Math.abs((nA - a) - (nB - b)), "axis_misread", "다른 행(${t.b})의 차를 답했다.".replace("${t.b}", "반대 행")), W(correct + 5, "other", "계산 중 어긋났다."), W(Math.abs(a - b) + 10, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ nA, pA, nB, pB }, "return Math.abs(P.nA*P.pA/100-P.nB*P.pB/100);"),
        trace: [[`${sA} 의 ${t.a} = ${nA} × ${pA}% = ${a} 이다.`, "First row total."], [`${sB} 의 ${t.a} = ${nB} × ${pB}% = ${b} 이다.`, "Second row total."], [`두 값을 비교한다: ${a} 와 ${b} 이다.`, "Compare."], [`차 = |${a} - ${b}| = ${correct} 이다.`, "Difference."], [`비율(%)이 큰 쪽이 항상 인원이 많은 것은 아님을 확인한다.`, "Check the intuition."]], variant: "two_surveys_row_total" }), [{ noun: sA, value: nA }, { noun: sB, value: nB }]);
    },
  },
  // ───────── conditional_share ─────────
  {
    id: "tvd.conditional_share.inverse", skill: SKILL, kind: "conditional_share", operator: "inverse",
    structure: "한 행에서 어떤 반응을 보인 칸과 그 비율이 주어질 때 비율에서 행 합계를 역산해 반대 반응의 인원을 구함",
    extraThinking: "조건부 비율(칸 ÷ 행 합계)을 거꾸로 풀어 기준 모집단(행 합계)을 구하고 반대 칸까지 계산 — medium 은 칸/행 합계의 비율 계산",
    concepts: ["이원표", "조건부 비율", "퍼센트 역산"], mediumSteps: 2,
    generate(rng) {
      const t = tp(rng); const q = rng.pick([20, 25, 30, 40, 50, 60, 75, 80]); const r1 = rng.pick([40, 50, 60, 80, 100, 120, 150, 200]); const c = (r1 * q) / 100; if (!isInt(c)) throw new GenFail("x"); const ask = rng.int(0, 1); const correct = ask === 0 ? r1 - c : r1;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`Among the ${t.a}, ${c} ${t.y}, which is ${q}% of all the ${t.a}.`, `${c} of the ${t.a} ${t.y}; these ${c} are ${q}% of the ${t.a}.`, `The ${t.a} who ${t.y} number ${c}, and they make up ${q}% of the ${t.a}.`], [`The other ${t.ent} are ${t.b}, and there are no other categories.`, `Every other ${t.ent.replace(/s$/, "")} counted is one of the ${t.b}.`]]),
        question: spin(rng, ask === 0 ? `[[How many of the ${t.a} ${t.n}?|What is the number of ${t.a} who ${t.n}?]]` : `[[How many ${t.a} are there in all?|What is the total number of ${t.a}?]]`), correct,
        wrongs: [W(ask === 0 ? c : r1 - c, "axis_misread", "반대 칸을 답했다."), W(Math.round((c * (100 - q)) / q) === correct ? correct + 3 : Math.round((c * (100 - q)) / q), "formula_misuse", "비율 계산을 거꾸로 적용했다."), W(Math.round(c / (q / 100)) === correct ? correct + 2 : c * 2, "other", "계산 중 어긋났다."), W(Math.round((c * q) / 100), "formula_misuse", "칸에 다시 비율을 곱했다."), W(100 - q, "other", "퍼센트 값을 답했다."), W(correct + 10, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ c, q, ask }, "let out=null;\nfor(let r=1;r<=2000;r++){ if(P.c*100===P.q*r) out=P.ask===0?r-P.c:r; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
        trace: [[`${t.y} 인 ${t.a} ${c} 명이 ${t.a} 전체의 ${q}% 이다.`, "Read the conditional percent."], [`${t.a} 의 합계 = ${c} ÷ ${q / 100} = ${r1} 이다.`, "Solve for the row total."], [`${t.n} 인 ${t.a} = ${r1} - ${c} = ${r1 - c} 이다.`, "Compute the opposite cell."], [`기준이 전체 ${t.ent} 가 아니라 ${t.a} 임을 확인한다.`, "Check the percent base."], [`묻는 값은 ${correct} 이다.`, "Answer."]], variant: "conditional_percent_to_row" }), [{ noun: t.a, value: c }]);
    },
  },
  {
    id: "tvd.conditional_share.chain2", skill: SKILL, kind: "conditional_share", operator: "chain2",
    structure: "전체의 p% 가 한 집단, 각 집단의 반응 비율(q%, s%)이 주어질 때 전체에서 그 반응의 비율(%)을 두 단계로 구함",
    extraThinking: "집단별 조건부 비율을 가중합해 전체 비율(기준이 집단 → 전체로 바뀜)을 구하는 2단계 연쇄 — medium 은 칸/행 합계의 비율",
    concepts: ["이원표", "조건부 비율", "가중 합산"], mediumSteps: 2,
    generate(rng) {
      const t = tp(rng); const N = rng.pick([100, 200, 250, 400, 500]); const p = rng.pick([20, 25, 40, 50, 60, 75, 80]); const q = rng.pick([10, 20, 30, 40, 50, 60, 70, 80]), s = rng.pick([10, 20, 30, 40, 50, 60, 70, 80]); if (q === s) throw new GenFail("x");
      const r1 = (N * p) / 100, r2 = N - r1; const y = (r1 * q) / 100 + (r2 * s) / 100; if (!isInt(r1) || !isInt((r1 * q) / 100) || !isInt((r2 * s) / 100) || !isInt((y * 100) / N)) throw new GenFail("x"); const correct = (y * 100) / N;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${p}% of the ${N} ${t.ent} in a sample are ${t.a}, and the rest are ${t.b}.`, `A sample of ${N} ${t.ent} is ${p}% ${t.a}; the others are ${t.b}.`], [`${q}% of the ${t.a} ${t.y}, and ${s}% of the ${t.b} ${t.y}.`, `Among ${t.a}, ${q}% ${t.y}; among ${t.b}, ${s}% ${t.y}.`]]),
        question: spin(rng, `[[What percent of all ${N} ${t.ent} ${t.y}?|Of the whole sample, what percent ${t.y}?|Overall, what percent of the ${t.ent} ${t.y}?]]`), correct, fmt: (v) => `${fmtNum(v)}%`,
        wrongs: [W((q + s) / 2, "formula_misuse", "두 비율을 단순 평균했다(집단 크기로 가중하지 않았다)."), W(q + s, "formula_misuse", "두 비율을 더했다."), W(q, "step_missing", "한 집단의 비율만 답했다."), W(s, "step_missing", "한 집단의 비율만 답했다."), W(Math.abs(q - s), "formula_misuse", "비율의 차를 답했다."), W(correct + 5, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ N, p, q, s }, "const r1=P.N*P.p/100, r2=P.N-r1; const y=r1*P.q/100+r2*P.s/100;\nreturn y*100/P.N;"),
        trace: [[`${t.a} = ${N} × ${p}% = ${r1}, ${t.b} = ${r2} 이다.`, "Group sizes."], [`${t.a} 중 해당 = ${r1} × ${q}% = ${(r1 * q) / 100} 이다.`, "First group count."], [`${t.b} 중 해당 = ${r2} × ${s}% = ${(r2 * s) / 100} 이다.`, "Second group count."], [`전체 해당 = ${y} 이다.`, "Total count."], [`전체 비율 = ${y} ÷ ${N} × 100 = ${correct}% 이다.`, "Overall percent."]], variant: "weighted_overall_percent" }), [{ noun: t.a, value: `${q}%` }]);
    },
  },
  {
    id: "tvd.conditional_share.compose_kind", skill: SKILL, kind: "conditional_share", operator: "compose_kind",
    structure: "네 칸이 서술로 주어진 이원표에서 '한 반응을 보인 사람 중 한 집단의 비율'(열 기준 조건부 비율)을 구함",
    extraThinking: "행 기준이 아니라 열(반응) 기준 조건부 비율을 세우기 위해 열 합계를 먼저 구하는 기준 전환 — medium 은 행 기준 비율",
    concepts: ["이원표", "열 기준 조건부 비율", "퍼센트 계산"], mediumSteps: 2,
    generate(rng) {
      const t = tp(rng); const c11 = rng.int(10, 60), c21 = rng.int(10, 60), c12 = rng.int(10, 60), c22 = rng.int(10, 60); const col = c11 + c21; if ((c11 * 100) % col !== 0) throw new GenFail("x"); const correct = (c11 * 100) / col; const r1 = c11 + c12, r2 = c21 + c22; if (col === r1 || c11 === c21) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${c11} ${t.a} and ${c21} ${t.b} ${t.y}.`, `Of those who ${t.y}, ${c11} are ${t.a} and ${c21} are ${t.b}.`.replace(/Of those who (\w+),/, "Of the people who $1,")], [`${c12} ${t.a} and ${c22} ${t.b} ${t.n}.`, `On the other side, ${c12} of the ${t.a} and ${c22} of the ${t.b} ${t.n}.`]]),
        question: spin(rng, `[[Of all the ${t.ent} who ${t.y.replace(/^(\w+)s\b/, "$1")}, what percent are ${t.a}?|What percent of the ${t.ent} who ${t.y.replace(/^(\w+)s\b/, "$1")} are ${t.a}?]]`).replace(/who (joined|bought|received|enrolled|use|support|take|own)\b/g, "who $1"), correct, fmt: (v) => `${fmtNum(v)}%`,
        wrongs: [W((c11 * 100) / r1, "axis_misread", "행(집단) 기준 비율을 답했다(열 기준이 아니다)."), W((c11 * 100) / (c11 + c12 + c21 + c22), "condition_ignored", "전체를 기준으로 비율을 계산했다."), W((c21 * 100) / col, "axis_misread", "반대 집단의 비율을 답했다."), W((c11 * 100) / c12, "formula_misuse", "다른 칸을 분모로 썼다."), W(correct + 5, "other", "계산 중 어긋났다."), W(Math.max(1, correct - 5), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ c11, c21, c12, c22 }, "const y=P.c11+P.c21;\nreturn P.c11*100/y;"),
        trace: [[`반응한 사람의 합계(열 합계) = ${c11} + ${c21} = ${col} 이다.`, "Column total."], [`묻는 집단의 칸은 ${c11} 이다.`, "Identify the cell."], [`열 기준 비율 = ${c11} ÷ ${col} 이다.`, "Form the conditional share."], [`퍼센트로 바꾸면 ${correct}% 이다.`, "Convert to percent."], [`행 기준 비율(${(c11 * 100) / r1}%)과 구분한다.`, "Distinguish from the row-based share."]], variant: "column_conditional_share" }), [{ noun: t.a, value: c11 }, { noun: t.b, value: c21 }]);
    },
  },
  {
    id: "tvd.conditional_share.compare_scenarios", skill: SKILL, kind: "conditional_share", operator: "compare_scenarios",
    structure: "두 집단에서 같은 반응을 보인 비율(%)을 각각 구해 퍼센트포인트 차이를 비교",
    extraThinking: "서로 다른 행 합계를 기준으로 두 조건부 비율을 따로 구해 차(퍼센트포인트)를 계산 — medium 은 한 집단의 비율",
    concepts: ["이원표", "조건부 비율", "퍼센트포인트 차이"], mediumSteps: 2,
    generate(rng) {
      const t = tp(rng); const r1 = rng.pick([40, 50, 60, 80, 100, 120, 200]), r2 = rng.pick([40, 50, 60, 80, 100, 120, 200]); const p = rng.pick([10, 20, 25, 30, 40, 50, 60, 75]), q = rng.pick([10, 20, 25, 30, 40, 50, 60, 75]); const c1 = (r1 * p) / 100, c2 = (r2 * q) / 100; if (!isInt(c1) || !isInt(c2) || p === q || r1 === r2) throw new GenFail("x"); const correct = Math.abs(p - q);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`Of the ${r1} ${t.a}, ${c1} ${t.y}.`, `${c1} of the ${r1} ${t.a} ${t.y}.`, `The data include ${r1} ${t.a}; ${c1} of them ${t.y}.`, `In a sample of ${r1} ${t.a}, ${c1} ${t.y}.`], [`Of the ${r2} ${t.b}, ${c2} ${t.y}.`, `${c2} of the ${r2} ${t.b} ${t.y}.`, `The data also include ${r2} ${t.b}; ${c2} of them ${t.y}.`, `In a sample of ${r2} ${t.b}, ${c2} ${t.y}.`]]),
        question: spin(rng, `[[By how many percentage points does the percent of ${t.a} who ${t.y.replace(/^(\w+)s\b/, "$1")} differ from the percent of ${t.b} who ${t.y.replace(/^(\w+)s\b/, "$1")}?|What is the positive difference, in percentage points, between the two percents?|Compare the two groups: by how many percentage points do the shares differ?|The two groups differ by how many percentage points in the share that ${t.y.replace(/^(\w+)s\b/, "$1")}?]]`).replace(/who (joined|bought|received|enrolled|use|support|take|own)\b/g, "who $1"), correct,
        wrongs: [W(Math.abs(c1 - c2), "unit_error", "비율이 아니라 인원수의 차를 답했다."), W(Math.abs((c1 * 100) / (r1 + r2) - (c2 * 100) / (r1 + r2)), "formula_misuse", "두 행의 합을 공통 분모로 썼다."), W(p + q, "formula_misuse", "두 비율을 더했다."), W(Math.abs(r1 - r2), "other", "행 합계의 차를 답했다."), W(correct + 5, "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ r1, c1, r2, c2 }, "return Math.abs(P.c1*100/P.r1-P.c2*100/P.r2);"),
        trace: [[`${t.a} 의 비율 = ${c1} ÷ ${r1} × 100 = ${p}% 이다.`, "First conditional percent."], [`${t.b} 의 비율 = ${c2} ÷ ${r2} × 100 = ${q}% 이다.`, "Second conditional percent."], [`기준이 각각 ${r1} 과 ${r2} 로 다름을 확인한다.`, "Different bases."], [`차 = |${p} - ${q}| = ${correct} 퍼센트포인트이다.`, "Difference in percentage points."], [`인원수의 차(${Math.abs(c1 - c2)})와 구분한다.`, "Distinguish from the count difference."]], variant: "two_group_percentage_points" }), [{ noun: t.a, value: r1 }, { noun: t.b, value: r2 }]);
    },
  },
  // ───────── scatter(회귀선·자료점은 문장·좌표로 서술) ─────────
  ...scatterHard(),
];

// ───────── scatter 계열 ─────────
const SC_TOPICS: { x: string; y: string; xu: string; yu: string }[] = [
  { x: "the number of hours a student studies", y: "that student's exam score", xu: "hours", yu: "points" },
  { x: "the age of a tree", y: "that tree's height", xu: "years", yu: "feet" },
  { x: "the outdoor temperature", y: "the number of cold drinks sold", xu: "degrees", yu: "drinks" },
  { x: "the number of years since a town was founded", y: "the town's population", xu: "years", yu: "hundreds of residents" },
  { x: "the price of a ticket", y: "the number of tickets sold", xu: "dollars", yu: "tickets" },
  { x: "the number of workers on a shift", y: "the number of items packed", xu: "workers", yu: "items" },
  { x: "the weight of a package", y: "the package's shipping cost", xu: "pounds", yu: "dollars" },
  { x: "the number of weeks a plant has grown", y: "the plant's height", xu: "weeks", yu: "centimeters" },
  { x: "the number of hours of sunlight a plant receives each day", y: "the plant's daily growth", xu: "hours", yu: "millimeters" },
  { x: "the number of employees at a company", y: "the company's monthly revenue", xu: "employees", yu: "thousands of dollars" },
  { x: "the speed of a car", y: "the car's stopping distance", xu: "miles per hour", yu: "feet" },
  { x: "the number of pages in a book", y: "the book's price", xu: "pages", yu: "dollars" },
];
const TS: { y: string; yu: string }[] = [
  { y: "the population of a town", yu: "hundreds of residents" }, { y: "a company's annual revenue", yu: "thousands of dollars" }, { y: "the number of students enrolled in a school", yu: "students" },
  { y: "the number of visitors to a park", yu: "hundreds of visitors" }, { y: "the average price of a movie ticket", yu: "dollars" }, { y: "the number of members of a hiking club", yu: "members" },
];
const stc = (rng: Rng) => rng.pick(SC_TOPICS);
const eqs = (m: number, b: number) => `$y = ${lin(m, b, "x")}$`;
function pts(list: [number, number][]) { return list.map(([x, y]) => `(${x}, ${y})`).join(", "); }
function scatterHard(): Archetype[] {
  return [
    {
      id: "tvd.scatter_equation.inverse", skill: SKILL, kind: "scatter_equation", operator: "inverse",
      structure: "회귀선의 기울기와 한 점의 예측값이 주어질 때 x 절편(예측값이 0 이 되는 x)을 역산",
      extraThinking: "기울기·한 점에서 식을 세운 뒤 y = 0 이 되는 x 를 거꾸로 푸는 역산 — medium 은 식에 x 를 대입",
      concepts: ["회귀선(일차함수)", "기울기와 한 점", "x 절편"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 9) * (rng.chance(0.4) ? -1 : 1); const x0 = rng.int(2, 15); const xi = rng.int(3, 40); const b = -m * xi; const y0 = m * x0 + b; if (y0 <= 0 || Math.abs(b) > 300 || xi === x0) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A scatterplot shows ${t.x} (${t.xu}) and ${t.y} (${t.yu}), and a line of best fit is drawn.`, `A line of best fit models the relationship between ${t.x} (${t.xu}) and ${t.y} (${t.yu}).`], [`The line has a slope of ${m}.`, `The slope of the line of best fit is ${m}.`], [`When ${t.x.replace(/^the /, "").replace(/^number of /, "the number of ")} is ${x0}, the line predicts ${y0}.`.replace(/^When (.*)$/, `The line predicts a value of ${y0} when the horizontal value is ${x0}.`), `At a horizontal value of ${x0}, the predicted vertical value is ${y0}.`]]),
          question: spin(rng, `[[For what horizontal value does the line predict 0?|At what value of $x$ does the line of best fit cross the $x$-axis?|What is the $x$-intercept of the line of best fit?]]`), correct: xi,
          wrongs: [W(Math.abs(b), "other", "y 절편을 답했다."), W(y0, "other", "주어진 예측값을 답했다."), W(x0 - Math.round(y0 / m) === xi ? xi + 2 : x0 + Math.round(y0 / m), "sign_error", "x 절편 계산에서 부호를 틀렸다."), W(Math.round(-y0 / m), "step_missing", "x0 를 더하지 않고 -y0/m 만 답했다."), W(xi + 1, "other", "계산 중 1 어긋났다.")],
          verificationJs: withParams({ m, x0, y0 }, "const b=P.y0-P.m*P.x0; let out=null;\nfor(let x=-500;x<=500;x++){ if(P.m*x+b===0) out=x; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
          trace: [[`식을 y = ${m}x + b 로 두고 점 (${x0}, ${y0}) 를 대입한다.`, "Write the line with unknown intercept."], [`${y0} = ${m}·${x0} + b 이므로 b = ${b} 이다.`, "Solve for b."], [`식은 y = ${m}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} 이다.`, "State the equation."], [`y = 0 으로 놓으면 ${m}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)} = 0 이다.`, "Set y = 0."], [`x = ${xi} 이다.`, "Solve for x."]], variant: "x_intercept_from_slope_point" }), [{ noun: "slope", value: m }]);
      },
    },
    {
      id: "tvd.scatter_equation.repr_shift", skill: SKILL, kind: "scatter_equation", operator: "repr_shift",
      structure: "'x 가 1 늘 때마다 예측값이 m 증가·감소하고 x = 0 일 때 예측값이 b' 를 식 y = mx + b 로 번역해 상수항·기울기를 읽음",
      extraThinking: "증가·감소 문장을 부호가 있는 기울기로 번역하고 x 의 단위(주·년 등)에 맞춰 식을 세우는 표현 변환 — medium 은 식이 주어진 상태에서 대입",
      concepts: ["회귀선", "문장→식", "기울기의 부호·단위"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 12); const neg = rng.chance(0.4); const b = rng.int(5, 90); const per = rng.pick([1, 2, 5, 10]); const x1 = rng.int(3, 20); const delta = (neg ? -m : m); const y1 = delta * x1 + b; if (y1 <= 0) throw new GenFail("x");
        const ms = delta * per; const ask = rng.int(0, 1); const correct = ask === 0 ? y1 : delta;
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit models ${t.y} (${t.yu}) as a function of ${t.x} (${t.xu}).`, `For ${t.x} (${t.xu}) and ${t.y} (${t.yu}), a line of best fit is used.`], [per === 1 ? `For each additional ${t.xu.replace(/s$/, "")}, the predicted value ${neg ? "decreases" : "increases"} by ${m}.` : `For every ${per} additional ${t.xu}, the predicted value ${neg ? "decreases" : "increases"} by ${m * per}.`, per === 1 ? `Each ${t.xu.replace(/s$/, "")} added to the horizontal value ${neg ? "lowers" : "raises"} the prediction by ${m}.` : `Adding ${per} ${t.xu} to the horizontal value ${neg ? "lowers" : "raises"} the prediction by ${m * per}.`], [`When the horizontal value is 0, the predicted value is ${b}.`, `The predicted value at a horizontal value of 0 is ${b}.`]]),
          question: ask === 0 ? spin(rng, `[[What is the predicted value when the horizontal value is ${x1}?|According to the line, what is the prediction at a horizontal value of ${x1}?]]`) : spin(rng, `[[In the equation $y = mx + b$ of the line, what is the value of $m$?|What is the slope of the line of best fit?]]`), correct,
          wrongs: ask === 0 ? [W(b + m * x1 * (neg ? -1 : 1) * -1, "sign_error", "증가/감소의 부호를 거꾸로 적용했다."), W(b + m * x1 * per * (neg ? -1 : 1), "formula_misuse", "단위(per)를 곱해 기울기를 잘못 구했다."), W(m * x1, "step_missing", "x=0 일 때의 값 b 를 더하지 않았다."), W(b, "step_missing", "x=0 일 때의 값을 답했다."), W(y1 + m, "other", "계산 중 어긋났다.")] : [W(-delta, "sign_error", "증가/감소의 부호를 거꾸로 적용했다."), W(ms === delta ? delta + 1 : ms, "formula_misuse", "묶음 단위 증가량을 그대로 기울기로 썼다."), W(b, "other", "상수항을 답했다."), W(Math.abs(delta), "sign_error", "부호를 빠뜨렸다."), W(delta + 2, "other", "계산 중 어긋났다.")],
          verificationJs: withParams({ delta: ms, per, b, ...(ask === 0 ? { x1 } : {}), ask }, "const m=P.delta/P.per;\nreturn P.ask===0?m*P.x1+P.b:m;"),
          trace: [[per === 1 ? `x 가 1 늘 때 예측값이 ${neg ? "감소" : "증가"}하므로 기울기 m = ${delta} 이다.` : `x 가 ${per} 늘 때 ${ms} 변하므로 x 가 1 늘 때는 ${ms} ÷ ${per} = ${delta} 이다.`, "Translate the change statement into a slope."], [`x = 0 일 때 ${b} 이므로 b = ${b} 이다.`, "Read the intercept."], [`식은 y = ${delta}x ${b >= 0 ? "+" : "-"} ${b} 이다.`.replace("- " + b, "+ " + b), "Write the equation."], [ask === 0 ? `x = ${x1} 을 대입하면 y = ${delta}·${x1} + ${b} 이다.` : "묻는 값은 기울기이다.", "Use the equation."], [`답은 ${correct} 이다.`, "Answer."]], variant: ask === 0 ? "statement_to_prediction" : "statement_to_slope" }), [{ noun: ["horizontal value is 0", "horizontal value of 0"], value: b }]);
      },
    },
    {
      id: "tvd.scatter_equation.chain2", skill: SKILL, kind: "scatter_equation", operator: "chain2",
      structure: "회귀선이 지나는 두 점의 좌표로 기울기, 절편을 차례로 구하고 새 x 에서의 예측값을 구함",
      extraThinking: "두 점 → 기울기 → 절편 → 예측값으로 이어지는 3단계 연쇄(앞 단계 결과가 다음 단계 조건) — medium 은 식에 x 를 바로 대입",
      concepts: ["회귀선", "두 점의 기울기", "절편과 예측값"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 9) * (rng.chance(0.3) ? -1 : 1); const b = rng.int(5, 60); const x1 = rng.int(1, 8), x2 = x1 + rng.int(2, 8), x3 = rng.int(x2 + 2, x2 + 14); const y1 = m * x1 + b, y2 = m * x2 + b; const correct = m * x3 + b; if (y1 <= 0 || y2 <= 0 || correct <= 0) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) passes through the points (${x1}, ${y1}) and (${x2}, ${y2}).`, `The line of best fit relating ${t.x} (${t.xu}) to ${t.y} (${t.yu}) contains the points (${x1}, ${y1}) and (${x2}, ${y2}).`]]),
          question: spin(rng, `[[According to the line, what is the predicted value when the horizontal value is ${x3}?|What does the line of best fit predict at a horizontal value of ${x3}?]]`), correct,
          wrongs: [W(y2 + (y2 - y1), "step_missing", "한 구간만큼만 이어 예측했다(비례 확장을 잘못 계산했다)."), W(m * x3, "step_missing", "절편을 더하지 않았다."), W(y2 + m, "step_missing", "x3 - x2 구간을 한 칸으로만 계산했다."), W(b + m, "other", "절편에 기울기만 더했다."), W(correct + m, "other", "한 단위를 더 계산했다."), W(correct - 5, "other", "계산 중 어긋났다.")],
          verificationJs: withParams({ x1, y1, x2, y2, x3 }, "const m=(P.y2-P.y1)/(P.x2-P.x1); const b=P.y1-m*P.x1;\nreturn m*P.x3+b;"),
          trace: [[`기울기 m = (${y2} - ${y1}) ÷ (${x2} - ${x1}) = ${m} 이다.`, "Slope from two points."], [`점 (${x1}, ${y1}) 을 y = ${m}x + b 에 대입한다.`, "Substitute a point."], [`b = ${y1} - ${m}·${x1} = ${b} 이다.`, "Solve for the intercept."], [`x = ${x3} 을 대입하면 y = ${m}·${x3} + ${b} 이다.`, "Evaluate at the new x."], [`예측값은 ${correct} 이다.`, "Answer."]], variant: "two_points_then_predict" }), [{ noun: "points", value: x1 }]);
      },
    },
    {
      id: "tvd.scatter_equation.constraint_select", skill: SKILL, kind: "scatter_equation", operator: "constraint_select",
      structure: "기울기가 분수 p/q 인 회귀선에서 0 ≤ x ≤ N 의 정수 x 중 예측값이 정수가 되는 x 의 개수를 셈",
      extraThinking: "분수 기울기의 분모 q 와 정수 조건을 결합해 x 가 q 의 배수여야 함을 추론하고 경계 포함 개수를 셈 — medium 은 식에 x 를 대입",
      concepts: ["회귀선", "분수 기울기", "배수 개수 세기"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const q = rng.pick([2, 3, 4, 5, 6]); const p = rng.pick([1, 2, 3, 5, 7].filter((v) => gcd(v, q) === 1)); const b = rng.int(1, 30); const N = rng.int(20, 60); const sign = rng.chance(0.3) ? -1 : 1; const pp = sign * p;
        let correct = 0; for (let x = 0; x <= N; x++) if ((pp * x) % q === 0) correct++; if (correct < 4) throw new GenFail("x");
        const eq = `$y = \\frac{${p}}{${q}}x ${b >= 0 ? "+" : "-"} ${Math.abs(b)}$`.replace("y = \\frac{" + p + "}{" + q + "}x", sign === -1 ? `y = -\\frac{${p}}{${q}}x` : `y = \\frac{${p}}{${q}}x`);
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) is ${eq}.`, `The equation of a line of best fit relating ${t.x} (${t.xu}) to ${t.y} (${t.yu}) is ${eq}.`], [`Only whole-number values of $x$ from 0 to ${N}, inclusive, are considered.`, `Consider the whole numbers $x$ from 0 through ${N}.`]]),
          question: spin(rng, `[[For how many of these values of $x$ is the predicted value of $y$ a whole number?|How many of these values of $x$ give a whole-number prediction for $y$?]]`), correct,
          wrongs: [W(Math.floor(N / q), "step_missing", "x = 0 을 빠뜨렸다(0 도 q 의 배수)."), W(Math.floor(N / q) + 2, "other", "경계를 잘못 셌다."), W(N + 1, "condition_ignored", "정수 조건을 무시하고 모든 x 를 셌다."), W(Math.floor(N / p) + 1, "formula_misuse", "분자 p 로 나눠 개수를 셌다."), W(correct + 1, "other", "계산 중 1 어긋났다."), W(correct - 1, "other", "경계를 하나 뺐다.")],
          verificationJs: withParams({ p: pp, q, N }, "let c=0;\nfor(let x=0;x<=P.N;x++){ if(Number.isInteger(P.p*x/P.q)) c++; }\nreturn c;"),
          trace: [[`예측값 y = (${pp}/${q})x + ${b} 가 정수가 되려면 (${pp}/${q})x 가 정수여야 한다.`, "The constant is an integer, so the slope term must be."], [`${p} 와 ${q} 는 서로소이므로 x 가 ${q} 의 배수여야 한다.`, "Coprime numerator forces x to be a multiple of the denominator."], [`0 부터 ${N} 까지 ${q} 의 배수: 0, ${q}, ${2 * q}, …, ${Math.floor(N / q) * q} 이다.`, "List the multiples."], [`개수 = ${Math.floor(N / q)} + 1 (x = 0 포함) = ${correct} 이다.`, "Count including 0."], [`경계값(0 과 ${N})을 다시 확인한다.`, "Check the boundaries."]], variant: "integer_predictions_count" }), [{ noun: "equation", value: `\\frac{${p}}{${q}}` }].filter(() => false));
      },
    },
    {
      id: "tvd.scatter_predict.chain2", skill: SKILL, kind: "scatter_predict", operator: "chain2",
      structure: "x 가 기준 연차 이후의 연수이고 y 가 십·백 단위인 회귀선으로 특정 연차의 예측값을 구한 뒤 실제 단위로 환산",
      extraThinking: "연차 → x(경과 연수) 변환, 예측값 계산, 단위(백·십 단위 → 실제 개수) 환산의 3단 연쇄 — medium 은 식에 x 를 바로 대입",
      concepts: ["회귀선 예측", "변수 정의(연차→경과 연수)", "단위 환산"], mediumSteps: 2,
      generate(rng) {
        const base = rng.pick([5, 10, 15, 20, 25]); const m = rng.int(2, 9), b = rng.int(10, 60); const yr = base + rng.int(4, 20); const x = yr - base; const val = m * x + b; const unit = rng.pick([["the number of residents of a town (in hundreds of residents)", 100, "residents"], ["the number of visitors to a museum (in tens of visitors)", 10, "visitors"], ["the number of units a factory produced (in tens of units)", 10, "units"], ["the number of members of a club (in hundreds of members)", 100, "members"]] as const);
        const correct = val * unit[1]; if (correct >= 9000 || val > 99) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit models ${unit[0]} as $y = ${lin(m, b, "x")}$, where $x$ is the number of years after Year ${base} of a program.`, `The equation $y = ${lin(m, b, "x")}$ models ${unit[0]}, with $x$ equal to the number of years since Year ${base} of a program.`, `Using data from a program, researchers model ${unit[0]} by $y = ${lin(m, b, "x")}$, where $x$ counts the years elapsed after Year ${base}.`, `A program tracks ${unit[0]}. A line of best fit, $y = ${lin(m, b, "x")}$, is used, and $x$ is the number of years since Year ${base}.`]]),
          question: spin(rng, `[[According to the model, how many ${unit[2]} are predicted for Year ${yr}?|What number of ${unit[2]} does the model predict for Year ${yr}?|How many ${unit[2]} does the model predict in Year ${yr}?|Use the model to estimate the number of ${unit[2]} in Year ${yr}.]]`), correct,
          wrongs: [W(val, "unit_error", "단위(곱할 배수)를 환산하지 않았다."), W((m * yr + b) * unit[1], "step_missing", "연차를 그대로 x 로 넣었다(기준 연차를 빼지 않았다)."), W((m * (x + 1) + b) * unit[1], "other", "경과 연수를 하나 더해 계산했다."), W(val * (unit[1] === 100 ? 10 : 100), "unit_error", "단위 배수를 잘못 적용했다."), W(val * unit[1] + unit[1], "other", "단위 하나를 더 더했다.")],
          verificationJs: withParams({ base, m, b, yr }, `const mult=${unit[1]};\nconst x=P.yr-P.base; const y=P.m*x+P.b;\nreturn y*mult;`),
          trace: [[`x 는 Year ${base} 이후의 경과 연수이므로 x = ${yr} - ${base} = ${x} 이다.`, "Convert the year to x."], [`y = ${m}·${x} + ${b} = ${val} 이다.`, "Evaluate the model."], [`y 의 단위는 ${unit[1] === 100 ? "백" : "십"} 단위이므로 실제 값 = ${val} × ${unit[1]} 이다.`, "Convert units."], [`실제 값은 ${correct} 이다.`, "Compute."], [`연차를 그대로 넣지 않았는지 확인한다.`, "Check the variable definition."]], variant: "year_to_x_to_units" }), [{ noun: "year", value: base }]);
      },
    },
    {
      id: "tvd.scatter_predict.inverse", skill: SKILL, kind: "scatter_predict", operator: "inverse",
      structure: "회귀선에서 예측값이 목표값에 도달하는 연차(또는 x)를 역산",
      extraThinking: "예측값에서 x 를 거꾸로 풀고 x 를 연차로 되돌리는 역산(변수 정의 반영) — medium 은 식에 x 를 대입",
      concepts: ["회귀선 예측", "일차방정식 역산", "변수 정의"], mediumSteps: 2,
      generate(rng) {
        const t = rng.pick(TS); const base = rng.pick([5, 10, 15, 20]); const m = rng.int(3, 15), b = rng.int(5, 80); const x = rng.int(5, 30); const target = m * x + b; const correct = base + x; if (target > 900) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit models ${t.y} (${t.yu}) as $y = ${lin(m, b, "x")}$, where $x$ is the number of years after Year ${base} of a study.`, `The model $y = ${lin(m, b, "x")}$ describes ${t.y} (${t.yu}), where $x$ counts the years since Year ${base} of a study.`, `Researchers fit the line $y = ${lin(m, b, "x")}$ to measurements of ${t.y} (${t.yu}); in this equation, $x$ is the number of years that have passed since Year ${base} of the study.`, `In a long-term study, ${t.y} (${t.yu}) is predicted by $y = ${lin(m, b, "x")}$, where $x = 0$ corresponds to Year ${base}.`]]),
          question: spin(rng, `[[In which year of the study does the model first predict a value of ${target}?|According to the model, in what year of the study will the predicted value reach ${target}?|Which year of the study is the first in which the model predicts ${target}?|The model predicts a value of ${target} in which year of the study?]]`), correct,
          wrongs: [W(x, "step_missing", "연차가 아니라 x(경과 연수)를 답했다."), W(Math.max(1, base - x), "sign_error", "기준 연차에서 x 를 뺐다."), W(base + Math.round(target / m), "formula_misuse", "절편을 빼지 않고 나눴다."), W(base + x + 1, "other", "계산 중 1 어긋났다."), W(base + x - 1, "other", "계산 중 1 어긋났다.")],
          verificationJs: withParams({ base, m, b, target }, "let out=null;\nfor(let x=0;x<=200;x++){ if(P.m*x+P.b===P.target) out=P.base+x; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
          trace: [[`${target} = ${m}x + ${b} 로 놓는다.`, "Set the prediction equal to the target."], [`${m}x = ${target - b} 이다.`, "Subtract the intercept."], [`x = ${x} 이다.`, "Divide by the slope."], [`x 는 Year ${base} 이후의 경과 연수이므로 연차 = ${base} + ${x} 이다.`, "Convert x back to a year of the study."], [`답은 Year ${correct} 이다.`, "Answer."]], variant: "target_year" }), [{ noun: "year", value: base }]);
      },
    },
    {
      id: "tvd.scatter_predict.compare_scenarios", skill: SKILL, kind: "scatter_predict", operator: "compare_scenarios",
      structure: "서로 다른 두 회귀선(모델 A·B)의 예측값이 같아지는 x 를 구함",
      extraThinking: "두 일차식을 같게 놓고 기울기·절편 차이로 교점을 구한 뒤 그 x 에서의 값이 같음을 확인하는 두 모델 비교 — medium 은 한 식에 x 를 대입",
      concepts: ["회귀선 예측", "두 일차식 비교", "일차방정식"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const a1 = rng.int(2, 12), a2 = rng.int(2, 12); if (a1 === a2) throw new GenFail("x"); const x = rng.int(3, 25); const b1 = rng.int(5, 80); const b2 = b1 + (a1 - a2) * x; if (b2 < 1 || b2 > 150) throw new GenFail("x"); const ask = rng.int(0, 1); const val = a1 * x + b1; const correct = ask === 0 ? x : val;
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`Two models predict ${t.y} (${t.yu}) from ${t.x} (${t.xu}).`, `Model A and Model B both estimate ${t.y} (${t.yu}) from ${t.x} (${t.xu}).`], [`Model A is $y = ${lin(a1, b1, "x")}$ and Model B is $y = ${lin(a2, b2, "x")}$.`, `The equation of Model A is $y = ${lin(a1, b1, "x")}$; the equation of Model B is $y = ${lin(a2, b2, "x")}$.`]]),
          question: spin(rng, ask === 0 ? `[[For what value of $x$ do the two models give the same prediction?|At what value of $x$ are the predictions of Model A and Model B equal?]]` : `[[What is the common predicted value when the two models agree?|When the two models give the same prediction, what is that predicted value?]]`), correct,
          wrongs: ask === 0 ? [W(Math.round(Math.abs(b1 - b2) / (a1 + a2)), "sign_error", "기울기를 더해 나눴다."), W(Math.abs(b1 - b2), "step_missing", "절편의 차만 답했다."), W(val, "other", "공통 예측값을 답했다."), W(x + 1, "other", "계산 중 1 어긋났다."), W(Math.abs(a1 - a2), "other", "기울기의 차를 답했다.")] : [W(x, "other", "공통 x 를 답했다."), W(a2 * x + b1, "formula_misuse", "다른 모델의 기울기에 절편을 섞었다."), W(val + 5, "other", "계산 중 어긋났다."), W(b1 + b2, "formula_misuse", "두 절편을 더했다."), W(a1 * x, "step_missing", "절편을 더하지 않았다.")],
          verificationJs: withParams({ a1, b1, a2, b2, ask }, "let out=null;\nfor(let x=0;x<=500;x++){ if(P.a1*x+P.b1===P.a2*x+P.b2) out=P.ask===0?x:P.a1*x+P.b1; }\nif(out===null) throw new Error('해 없음');\nreturn out;"),
          trace: [[`두 예측값을 같게 놓는다: ${a1}x + ${b1} = ${a2}x + ${b2} 이다.`, "Equate the two models."], [`x 항을 모으면 ${a1 - a2}x = ${b2 - b1} 이다.`, "Collect x terms."], [`x = ${x} 이다.`, "Solve for x."], [`Model A 에 대입하면 y = ${a1}·${x} + ${b1} = ${val} 이다.`, "Evaluate."], [`Model B 에 대입해도 ${a2}·${x} + ${b2} = ${val} 임을 확인한다.`, "Verify with the other model."]], variant: ask === 0 ? "equal_prediction_x" : "equal_prediction_value" }), [{ noun: "Model A", value: lin(a1, b1, "x") }]);
      },
    },
    {
      id: "tvd.scatter_predict.repr_shift", skill: SKILL, kind: "scatter_predict", operator: "repr_shift",
      structure: "회귀선의 예측값과 실제 관측값이 주어질 때 잔차(관측 - 예측)를 문장에서 식으로 번역해 구함",
      extraThinking: "잔차의 정의(관측값 - 예측값)와 부호를 문장에서 식으로 번역하고 예측값을 먼저 계산 — medium 은 예측값만 계산",
      concepts: ["회귀선 예측", "잔차의 정의", "부호 해석"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 12), b = rng.int(5, 70); const x = rng.int(3, 20); const pred = m * x + b; const diff = rng.nz(-15, 15); const actual = pred + diff; if (actual <= 0 || Math.abs(diff) < 2) throw new GenFail("x"); const above = diff > 0;
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) is $y = ${lin(m, b, "x")}$.`, `The line of best fit relating ${t.x} (${t.xu}) to ${t.y} (${t.yu}) is $y = ${lin(m, b, "x")}$.`], [`One observation has a horizontal value of ${x} and an actual vertical value of ${actual}.`, `A data point is observed at a horizontal value of ${x}, where the actual vertical value is ${actual}.`]]),
          question: spin(rng, `[[The residual is the actual value minus the predicted value. What is the residual for this observation?|What is the difference between the actual value and the value predicted by the line (actual minus predicted)?]]`), correct: diff,
          wrongs: [W(-diff, "sign_error", "잔차를 예측값 - 실제값 으로 계산했다(부호 반대)."), W(pred, "step_missing", "예측값만 구하고 잔차를 구하지 않았다."), W(actual, "other", "실제값을 답했다."), W(Math.abs(diff) + 1, "sign_error", "부호를 빠뜨리고 어긋났다."), W(diff + 2, "other", "계산 중 어긋났다.")],
          verificationJs: withParams({ m, b, x, actual }, "return P.actual-(P.m*P.x+P.b);"),
          trace: [[`예측값 = ${m}·${x} + ${b} = ${pred} 이다.`, "Compute the prediction."], [`잔차 = 실제값 - 예측값 이다.`, "State the residual definition."], [`잔차 = ${actual} - ${pred} 이다.`, "Substitute."], [`잔차 = ${diff} 이다.`, "Compute."], [`${above ? "실제값이 선보다 위" : "실제값이 선보다 아래"}에 있으므로 부호가 ${above ? "양수" : "음수"}임을 확인한다.`, "Check the sign."]], variant: "residual_from_observation" }), [{ noun: "horizontal value", value: x }]);
      },
    },
    {
      id: "tvd.scatter_slope_context.unit_ratio", skill: SKILL, kind: "scatter_slope_context", operator: "unit_ratio",
      structure: "x 가 월(또는 주) 단위인 회귀선의 기울기를 연(또는 분) 단위 변화량으로 환산",
      extraThinking: "기울기의 분모 단위(월/연)와 묻는 기간의 단위가 다름을 인식해 단위 환산 후 곱하는 단위·비율 결합 — medium 은 기울기 값 읽기",
      concepts: ["기울기의 의미(단위)", "단위 환산", "예측 변화량"], mediumSteps: 2,
      generate(rng) {
        const m = rng.int(2, 12); const [small, big, f] = rng.pick([["month", "year", 12], ["week", "year", 52], ["day", "week", 7], ["minute", "hour", 60], ["hour", "day", 24]] as const); const k = rng.int(2, 6); const topic = rng.pick([["a savings account balance (in dollars)", "grows"], ["the number of visitors to a website", "increases"], ["the height of a plant (in millimeters)", "increases"], ["the distance driven (in miles)", "increases"]] as const); const correct = m * f * k; if (correct > 999 || f * k > 400) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit models ${topic[0]} as $y = ${lin(m, rng.int(10, 90), "x")}$, where $x$ is the number of ${small}s.`, `The equation $y = ${lin(m, rng.int(10, 90), "x")}$ models ${topic[0]}, where $x$ is measured in ${small}s.`]].map((g, i) => (i === 0 ? g.map((s, j) => s) : g))),
          question: spin(rng, `[[According to the model, by how much is the predicted value expected to ${topic[1] === "grows" ? "grow" : "increase"} over ${k} ${big}${k === 1 ? "" : "s"}?|What change in the predicted value does the model give for ${k} ${big}${k === 1 ? "" : "s"}?]]`), correct,
          wrongs: [W(m * k, "unit_error", "단위를 환산하지 않고 기울기에 기간만 곱했다."), W(m, "step_missing", "기울기를 그대로 답했다."), W(Math.round((m * k) / f * 100) / 100 === correct ? correct + 1 : Math.round(((m * k) / f) * 100) / 100, "unit_error", "환산 방향(곱/나눔)을 거꾸로 적용했다."), W(m * f, "step_missing", "기간 k 를 곱하지 않았다."), W(correct + f, "other", "계산 중 어긋났다.")],
          verificationJs: withParams({ m, k }, `const F=${f};\nreturn P.m*F*P.k;`),
          trace: [[`기울기 ${m} 은 x(${small}) 가 1 늘 때의 변화량이다.`, "Interpret the slope."], [`묻는 기간 ${k} ${big} = ${k * f} ${small} 이다.`, "Convert the period to the model's unit."], [`변화량 = ${m} × ${k * f} 이다.`, "Multiply."], [`계산하면 ${correct} 이다.`, "Compute."], [`${big} 당 변화량 ${m * f} 과 비교해 확인한다.`, "Cross-check with the per-period change."]], variant: "slope_unit_conversion" }), []);
      },
    },
    {
      id: "tvd.scatter_slope_context.repr_shift", skill: SKILL, kind: "scatter_slope_context", operator: "repr_shift",
      structure: "서로 다른 두 x 에서의 예측값이 문장으로 주어질 때 x 의 변화량으로 나눠 기울기(1 단위 변화량)를 구하고 해석",
      extraThinking: "두 예측값의 차를 x 변화량으로 나누어 '한 단위당 변화'로 번역하는 표현 변환 — medium 은 식이 주어진 상태에서 기울기 읽기",
      concepts: ["회귀선의 기울기", "문장→변화율", "단위당 해석"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 11) * (rng.chance(0.3) ? -1 : 1); const b = rng.int(20, 100); const x1 = rng.int(1, 10), dx = rng.pick([2, 3, 4, 5, 6, 8, 10]); const x2 = x1 + dx; const y1 = m * x1 + b, y2 = m * x2 + b; if (y1 <= 0 || y2 <= 0) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit relates ${t.x} (${t.xu}) to ${t.y} (${t.yu}).`, `For ${t.x} (${t.xu}) and ${t.y} (${t.yu}), a line of best fit is drawn.`], [`The line predicts ${y1} at a horizontal value of ${x1} and ${y2} at a horizontal value of ${x2}.`, `At ${x1} the predicted value is ${y1}, and at ${x2} the predicted value is ${y2}.`]]),
          question: spin(rng, `[[By how much does the predicted value change for each 1-unit increase in the horizontal value?|What is the slope of the line of best fit?]]`), correct: m,
          wrongs: [W(y2 - y1, "step_missing", "x 변화량으로 나누지 않고 예측값의 차를 답했다."), W(-m, "sign_error", "증가/감소의 부호를 거꾸로 답했다."), W(Math.round((y2 - y1) * dx * 100) / 100, "formula_misuse", "나누지 않고 곱했다."), W(Math.round((y1 / x1) * 100) / 100 === m ? m + 1 : Math.round((y1 / x1) * 100) / 100, "formula_misuse", "예측값을 x 로 나눠 기울기로 착각했다."), W(m + 1, "other", "계산 중 1 어긋났다.")],
          verificationJs: withParams({ x1, y1, x2, y2 }, "return (P.y2-P.y1)/(P.x2-P.x1);"),
          trace: [[`예측값의 변화량 = ${y2} - ${y1} = ${y2 - y1} 이다.`, "Change in the prediction."], [`x 의 변화량 = ${x2} - ${x1} = ${dx} 이다.`, "Change in x."], [`1 단위당 변화량 = ${y2 - y1} ÷ ${dx} 이다.`, "Divide."], [`기울기는 ${m} 이다.`, "Compute."], [`부호가 ${m > 0 ? "양수(증가)" : "음수(감소)"}임을 해석한다.`, "Interpret the sign."]], variant: "slope_from_two_predictions" }), [{ noun: "predict", value: y1 }]);
      },
    },
    {
      id: "tvd.scatter_slope_context.compare_scenarios", skill: SKILL, kind: "scatter_slope_context", operator: "compare_scenarios",
      structure: "두 회귀선(두 집단)의 기울기가 주어질 때 같은 구간에서의 예측 변화량의 차를 비교",
      extraThinking: "두 집단의 기울기를 각각 구간 길이에 곱해 변화량을 구한 뒤 비교(절편은 변화량과 무관함을 구분) — medium 은 기울기 값 읽기",
      concepts: ["회귀선의 기울기", "두 모델 비교", "변화량"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m1 = rng.int(2, 14), m2 = rng.int(2, 14); if (m1 === m2) throw new GenFail("x"); const k = rng.int(3, 12); const b1 = rng.int(5, 90), b2 = rng.int(5, 90); const correct = Math.abs(m1 - m2) * k; const [g1, g2] = rng.pick([["Group A", "Group B"], ["Region 1", "Region 2"], ["Model P", "Model Q"]]);
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`For ${t.x} (${t.xu}) and ${t.y} (${t.yu}), the line of best fit for ${g1} is $y = ${lin(m1, b1, "x")}$.`, `${g1} has the line of best fit $y = ${lin(m1, b1, "x")}$ for ${t.x} (${t.xu}) and ${t.y} (${t.yu}).`], [`The line of best fit for ${g2} is $y = ${lin(m2, b2, "x")}$.`, `For ${g2}, the line of best fit is $y = ${lin(m2, b2, "x")}$.`]]),
          question: spin(rng, `[[When the horizontal value increases by ${k}, how much greater is the predicted change for the group with the larger slope than for the other group?|For an increase of ${k} in the horizontal value, what is the difference between the two predicted changes?]]`), correct,
          wrongs: [W(Math.abs(b1 - b2), "other", "절편의 차를 답했다."), W(Math.abs(m1 - m2), "step_missing", "기울기의 차에 구간 길이를 곱하지 않았다."), W(Math.abs(m1 * k + b1 - (m2 * k + b2)), "formula_misuse", "변화량이 아니라 예측값 자체의 차를 구했다."), W((m1 + m2) * k, "formula_misuse", "차가 아니라 합을 구했다."), W(correct + k, "other", "계산 중 어긋났다.")],
          verificationJs: withParams({ m1, m2, k }, "return Math.abs(P.m1*P.k-P.m2*P.k);"),
          trace: [[`${g1} 의 변화량 = ${m1} × ${k} = ${m1 * k} 이다.`, "First predicted change."], [`${g2} 의 변화량 = ${m2} × ${k} = ${m2 * k} 이다.`, "Second predicted change."], [`절편은 변화량에 영향을 주지 않는다.`, "The intercepts cancel out."], [`차 = |${m1 * k} - ${m2 * k}| = ${correct} 이다.`, "Difference."], [`예측값의 차(절편 포함)와 구분한다.`, "Distinguish from the difference of predictions."]], variant: "compare_predicted_changes" }), [{ noun: g1, value: lin(m1, b1, "x") }, { noun: g2, value: lin(m2, b2, "x") }]);
      },
    },
    {
      id: "tvd.scatter_slope_context.inverse", skill: SKILL, kind: "scatter_slope_context", operator: "inverse",
      structure: "x 가 k 늘 때 예측값이 D 변한다는 정보와 x0 에서의 예측값으로 기울기를 역산한 뒤 다른 x 에서의 예측값을 구함",
      extraThinking: "변화량 D 와 구간 k 에서 기울기를 거꾸로 구하고 한 점에서 새 x 의 값을 예측 — medium 은 식이 주어진 상태에서 기울기 읽기",
      concepts: ["회귀선의 기울기", "변화율 역산", "예측"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 11); const k = rng.pick([2, 3, 4, 5, 10]); const D = m * k; const x0 = rng.int(2, 12), y0 = rng.int(20, 120); const x1 = x0 + rng.int(3, 15); const correct = y0 + m * (x1 - x0);
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit relates ${t.x} (${t.xu}) to ${t.y} (${t.yu}).`, `For ${t.x} (${t.xu}) and ${t.y} (${t.yu}), a line of best fit is used.`], [`Each time the horizontal value increases by ${k}, the predicted value increases by ${D}.`, `For every ${k} units added to the horizontal value, the prediction rises by ${D}.`], [`At a horizontal value of ${x0}, the predicted value is ${y0}.`, `The line predicts ${y0} when the horizontal value is ${x0}.`]]),
          question: spin(rng, `[[What is the predicted value at a horizontal value of ${x1}?|According to the line, what is the prediction when the horizontal value is ${x1}?]]`), correct,
          wrongs: [W(y0 + D, "step_missing", "한 묶음의 변화량만 더했다."), W(y0 + (x1 - x0) * D, "formula_misuse", "묶음당 변화량을 1 단위당 변화량으로 착각했다."), W(y0 + m * x1, "formula_misuse", "x 변화량이 아니라 x 전체에 기울기를 곱했다."), W(y0 - m * (x1 - x0), "sign_error", "증가를 감소로 계산했다."), W(correct + m, "other", "한 단위 더 계산했다.")],
          verificationJs: withParams({ k, D, x0, y0, x1 }, "const m=P.D/P.k;\nreturn P.y0+m*(P.x1-P.x0);"),
          trace: [[`${k} 늘 때 ${D} 증가하므로 기울기 m = ${D} ÷ ${k} = ${m} 이다.`, "Recover the slope."], [`x 의 변화량 = ${x1} - ${x0} = ${x1 - x0} 이다.`, "Change in x."], [`예측값의 변화량 = ${m} × ${x1 - x0} = ${m * (x1 - x0)} 이다.`, "Change in the prediction."], [`${y0} + ${m * (x1 - x0)} = ${correct} 이다.`, "Add to the known prediction."], [`답은 ${correct} 이다.`, "Answer."]], variant: "slope_from_change_then_predict" }), [{ noun: ["predicted", "prediction"], value: D }]);
      },
    },
    {
      id: "tvd.scatter_count_above.constraint_select", skill: SKILL, kind: "scatter_count_above", operator: "constraint_select",
      structure: "자료점 좌표 목록과 회귀선이 주어질 때 x 범위 제약을 만족하면서 선 위에 있는 점의 개수를 셈",
      extraThinking: "각 점의 예측값과 비교해 선 위(엄격히 위)인지 판정하고 x 범위 제약으로 대상을 먼저 걸러 개수를 셈 — medium 은 그림에서 선 위 점 세기",
      concepts: ["회귀선", "점과 선의 위치 비교", "제약 조건 개수 세기"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 7), b = rng.int(5, 40); const n = rng.int(8, 10); const xs = Array.from({ length: n }, (_, i) => i + 1); const list: [number, number][] = xs.map((x) => [x, m * x + b + rng.int(-9, 9)] as [number, number]); const k = rng.int(3, 6);
        const above = (p: [number, number]) => p[1] > m * p[0] + b; const correct = list.filter((p) => p[0] >= k && above(p)).length; if (correct < 2 || list.some((p) => p[1] === m * p[0] + b)) throw new GenFail("x"); const all = list.filter(above).length; if (all === correct) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A scatterplot of ${t.x} (${t.xu}) and ${t.y} (${t.yu}) has the data points ${pts(list)}.`, `The data points for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) are ${pts(list)}.`], [`A line of best fit is $y = ${lin(m, b, "x")}$.`, `The line of best fit is given by $y = ${lin(m, b, "x")}$.`]]),
          question: spin(rng, `[[Among the points whose $x$-coordinate is at least ${k}, how many lie above the line of best fit?|How many data points with $x \\ge ${k}$ are above the line?]]`), correct,
          wrongs: [W(all, "condition_ignored", "x 범위 제약을 무시하고 선 위의 점을 모두 셌다."), W(list.filter((p) => p[0] >= k).length - correct, "opposite", "선 아래의 점 개수를 답했다."), W(list.filter((p) => p[0] >= k).length, "step_missing", "선과 비교하지 않고 범위 안의 점을 모두 셌다."), W(correct + 1, "other", "경계 점을 하나 더 셌다."), W(Math.max(0, correct - 1), "other", "경계 점을 하나 뺐다.")],
          verificationJs: withParams({ pts: list as unknown as number[], m, b, k }, "let c=0; for(const [x,y] of P.pts){ if(x>=P.k && y>P.m*x+P.b) c++; }\nreturn c;"),
          trace: [[`${k} 이상인 x 를 가진 점만 대상으로 한다.`, "Filter by the x-range."], [`각 점의 예측값 ${m}x + ${b} 를 계산한다.`, "Compute each predicted value."], [`실제 y 가 예측값보다 크면(엄격히) 선 위의 점이다.`, "Compare the actual value to the prediction."], [`조건에 맞는 점을 센다.`, "Count them."], [`선 위의 점은 ${correct} 개이다.`, "State the count."]], variant: "above_line_in_range" }), [{ noun: "line of best fit", value: lin(m, b, "x") }]);
      },
    },
    {
      id: "tvd.scatter_count_above.repr_shift", skill: SKILL, kind: "scatter_count_above", operator: "repr_shift",
      structure: "자료점(x: y 표)을 문장으로 서술하고 회귀선과 비교해 '선 위 또는 선 위에 놓인' 점의 개수를 셈",
      extraThinking: "표 서술을 (x, 예측값, 잔차) 비교로 번역하고 '위 또는 위에 놓임'의 경계(잔차 ≥ 0) 포함 여부를 구분 — medium 은 그림에서 선 위 점 세기",
      concepts: ["회귀선", "잔차의 부호", "경계 포함 개수 세기"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 7), b = rng.int(5, 40); const n = rng.int(7, 9); const list: [number, number][] = Array.from({ length: n }, (_, i) => [i + 1, m * (i + 1) + b + rng.int(-6, 6)] as [number, number]); const on = list.filter((p) => p[1] === m * p[0] + b).length; const above = list.filter((p) => p[1] > m * p[0] + b).length; if (on < 1 || above < 2) throw new GenFail("x"); const correct = above + on;
        const rows = list.map(([x, y]) => `${x}: ${y}`).join("; ");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`The data for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) are listed as horizontal value: vertical value — ${rows}.`, `A table lists horizontal value: vertical value for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) — ${rows}.`], [`A line of best fit is $y = ${lin(m, b, "x")}$.`, `The line of best fit has the equation $y = ${lin(m, b, "x")}$.`]]),
          question: spin(rng, `[[How many data points lie on or above the line of best fit?|How many of the points are on the line or above it?]]`), correct,
          wrongs: [W(above, "condition_ignored", "선 위에 정확히 놓인 점을 빼고 셌다."), W(list.length - above, "opposite", "선 아래(또는 위)의 반대편을 셌다."), W(list.length - correct, "opposite", "선 아래의 점 개수를 답했다."), W(on, "step_missing", "선 위에 정확히 놓인 점만 셌다."), W(correct + 1, "other", "경계를 하나 더 셌다.")],
          verificationJs: withParams({ pts: list as unknown as number[], m, b }, "let c=0; for(const [x,y] of P.pts){ if(y>=P.m*x+P.b) c++; }\nreturn c;"),
          trace: [[`각 x 에서 예측값 ${m}x + ${b} 를 계산한다.`, "Compute predictions."], [`잔차(실제 - 예측)를 구한다.`, "Compute residuals."], [`잔차가 0 이상이면 '선 위 또는 선 위에 놓인' 점이다.`, "Residual ≥ 0 means on or above."], [`선 위 ${above} 개와 선 위에 놓인 ${on} 개를 더한다.`, "Add the strict and boundary cases."], [`답은 ${correct} 이다.`, "Answer."]], variant: "on_or_above_line" }), [{ noun: "line of best fit", value: lin(m, b, "x") }]);
      },
    },
    {
      id: "tvd.scatter_count_above.compare_scenarios", skill: SKILL, kind: "scatter_count_above", operator: "compare_scenarios",
      structure: "두 회귀선 사이(한 선 위·다른 선 아래)에 놓인 점의 개수를 셈",
      extraThinking: "점마다 두 선의 예측값 사이에 있는지 이중 비교(두 부등식)로 판정해 개수를 셈 — medium 은 한 선 위의 점 세기",
      concepts: ["회귀선", "두 선 사이 판정", "개수 세기"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 6), b = rng.int(5, 30); const m2 = m, b2 = b + rng.int(8, 18); const n = rng.int(8, 10); const list: [number, number][] = Array.from({ length: n }, (_, i) => [i + 1, m * (i + 1) + b + rng.int(-6, 22)] as [number, number]);
        const between = (p: [number, number]) => p[1] > m * p[0] + b && p[1] < m2 * p[0] + b2; const correct = list.filter(between).length; if (correct < 2 || list.some((p) => p[1] === m * p[0] + b || p[1] === m2 * p[0] + b2)) throw new GenFail("x"); const aboveLow = list.filter((p) => p[1] > m * p[0] + b).length; if (aboveLow === correct) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`The data points for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) are ${pts(list)}.`, `A scatterplot of ${t.x} (${t.xu}) and ${t.y} (${t.yu}) has the points ${pts(list)}.`], [`Line L is $y = ${lin(m, b, "x")}$ and line M is $y = ${lin(m2, b2, "x")}$.`, `Two lines are drawn: line L, $y = ${lin(m, b, "x")}$, and line M, $y = ${lin(m2, b2, "x")}$.`]]),
          question: spin(rng, `[[How many data points lie above line L and below line M?|How many points are between the two lines (above L and below M)?]]`), correct,
          wrongs: [W(aboveLow, "condition_ignored", "선 M 과 비교하지 않고 선 L 위의 점을 모두 셌다."), W(list.filter((p) => p[1] < m2 * p[0] + b2).length, "condition_ignored", "선 L 과 비교하지 않고 선 M 아래의 점을 모두 셌다."), W(list.length - correct, "opposite", "두 선 사이가 아닌 점의 개수를 답했다."), W(correct + 1, "other", "경계 점을 하나 더 셌다."), W(Math.max(0, correct - 1), "other", "경계 점을 하나 뺐다.")],
          verificationJs: withParams({ pts: list as unknown as number[], m, b, m2, b2 }, "let c=0; for(const [x,y] of P.pts){ if(y>P.m*x+P.b && y<P.m2*x+P.b2) c++; }\nreturn c;"),
          trace: [[`각 점에서 선 L 의 값 ${m}x + ${b} 를 구한다.`, "Evaluate line L."], [`각 점에서 선 M 의 값 ${m2}x + ${b2} 를 구한다.`, "Evaluate line M."], [`L 의 값 < y < M 의 값 이면 두 선 사이의 점이다.`, "Double inequality."], [`조건에 맞는 점을 센다.`, "Count."], [`답은 ${correct} 이다.`, "Answer."]], variant: "between_two_lines" }), [{ noun: "line L", value: lin(m, b, "x") }]);
      },
    },
    {
      id: "tvd.scatter_count_above.compose_kind", skill: SKILL, kind: "scatter_count_above", operator: "compose_kind",
      structure: "회귀선과 잔차 기준값 r 이 주어질 때 잔차가 r 보다 큰 점의 개수를 셈(잔차 정의와 개수 세기 결합)",
      extraThinking: "잔차(실제 - 예측)를 각 점에서 계산해 기준값과 비교하는 두 개념(잔차·부등식 판정)의 결합 — medium 은 그림에서 선 위 점 세기",
      concepts: ["회귀선", "잔차의 정의", "부등식 판정과 개수"], mediumSteps: 2,
      generate(rng) {
        const t = stc(rng); const m = rng.int(2, 7), b = rng.int(5, 40); const n = rng.int(8, 10); const r = rng.int(2, 6); const list: [number, number][] = Array.from({ length: n }, (_, i) => [i + 1, m * (i + 1) + b + rng.int(-9, 12)] as [number, number]);
        const correct = list.filter((p) => p[1] - (m * p[0] + b) > r).length; const plain = list.filter((p) => p[1] - (m * p[0] + b) > 0).length; if (correct < 2 || plain === correct || list.some((p) => p[1] - (m * p[0] + b) === r)) throw new GenFail("x");
        return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`The data points for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) are ${pts(list)}.`, `A scatterplot of ${t.x} (${t.xu}) and ${t.y} (${t.yu}) has the points ${pts(list)}.`], [`A line of best fit is $y = ${lin(m, b, "x")}$.`, `The line of best fit is given by $y = ${lin(m, b, "x")}$.`], [`The residual of a point is its actual $y$-value minus the $y$-value predicted by the line.`, `A point's residual is the actual value minus the predicted value.`]]),
          question: spin(rng, `[[How many points have a residual greater than ${r}?|For how many points is the residual more than ${r}?]]`), correct,
          wrongs: [W(plain, "condition_ignored", "기준값 r 을 무시하고 잔차가 양수인 점을 셌다."), W(list.filter((p) => p[1] - (m * p[0] + b) < -r).length, "sign_error", "잔차의 부호를 거꾸로 적용했다."), W(list.filter((p) => Math.abs(p[1] - (m * p[0] + b)) > r).length, "formula_misuse", "잔차의 절댓값으로 판정했다."), W(correct + 1, "other", "경계 점을 하나 더 셌다."), W(Math.max(0, correct - 1), "other", "경계 점을 하나 뺐다.")],
          verificationJs: withParams({ pts: list as unknown as number[], m, b, r }, "let c=0; for(const [x,y] of P.pts){ if(y-(P.m*x+P.b)>P.r) c++; }\nreturn c;"),
          trace: [[`각 점의 예측값 ${m}x + ${b} 를 구한다.`, "Predicted values."], [`잔차 = 실제 y - 예측값 을 구한다.`, "Residuals."], [`잔차가 ${r} 보다 큰 점만 고른다.`, "Compare with the threshold."], [`부호와 절댓값을 혼동하지 않았는지 확인한다.`, "Check sign vs absolute value."], [`개수는 ${correct} 이다.`, "Count."]], variant: "residual_threshold_count" }), [{ noun: "line of best fit", value: lin(m, b, "x") }]);
      },
    },
  ];
}

// ───────── easy / medium ─────────
export const TVD_LEVELS: LArch[] = [
  {
    id: "tvd.cell.easy_read_cell", skill: SKILL, kind: "cell", operator: "repr_shift", level: "easy",
    structure: "행 합계와 한 칸으로 같은 행의 다른 칸을 구함", extraThinking: "easy: 행 합계에서 한 칸을 뺌", concepts: ["이원표", "뺄셈"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const r1 = rng.int(30, 140), c11 = rng.int(8, r1 - 6); const c12 = r1 - c11;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`There are ${r1} ${t.a} in a survey.`, `The survey includes ${r1} ${t.a}.`, `A total of ${r1} ${t.a} responded.`], [`Of these, ${c11} ${t.y}.`, `${c11} of them ${t.y}.`, `${c11} ${t.y}.`]]), question: spin(rng, `[[How many of the ${t.a} ${t.n}?|What is the number of ${t.a} who ${t.n}?]]`), correct: c12,
        wrongs: [W(r1 + c11, "sign_error", "빼지 않고 더했다."), W(c11, "step_missing", "주어진 칸을 그대로 답했다."), W(r1, "step_missing", "행 합계를 답했다."), W(c12 + 2, "other", "계산 중 어긋났다."), W(Math.abs(c12 - 10), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ r1, c11 }, "return P.r1-P.c11;"),
        trace: [[`${t.a} 전체는 ${r1} 명이다.`, "Row total."], [`${t.y} 인 ${t.a} 는 ${c11} 명이다.`, "Given cell."], [`${t.n} 인 ${t.a} = ${r1} - ${c11} = ${c12} 이다.`, "Subtract."]], variant: "cell_from_row_total" }), [{ noun: t.a, value: r1 }]);
    },
  },
  {
    id: "tvd.row_total.easy_row_total", skill: SKILL, kind: "row_total", operator: "repr_shift", level: "easy",
    structure: "한 행의 두 칸을 더해 행 합계를 구함", extraThinking: "easy: 두 칸의 합", concepts: ["이원표", "덧셈"], mediumSteps: 1,
    generate(rng) {
      const t = tp(rng); const a = rng.int(8, 90), b = rng.int(8, 90);
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`${a} ${t.a} ${t.y}.`, `Among the ${t.a}, ${a} ${t.y}.`, `${a} of the ${t.a} ${t.y}.`], [`${b} ${t.a} ${t.n}.`, `${b} of the ${t.a} ${t.n}.`, `Another ${b} of the ${t.a} ${t.n}.`]]), question: spin(rng, `[[How many ${t.a} are there in all?|What is the total number of ${t.a}?|Find the total number of ${t.a}.]]`), correct: a + b,
        wrongs: [W(Math.abs(a - b), "sign_error", "더하지 않고 뺐다."), W(a, "step_missing", "한 칸만 답했다."), W(b, "step_missing", "한 칸만 답했다."), W(a + b + 10, "other", "계산 중 어긋났다."), W(Math.max(1, a + b - 10), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ a, b }, "return P.a+P.b;"),
        trace: [[`${t.y} 인 ${t.a} 는 ${a} 명이다.`, "First cell."], [`${t.n} 인 ${t.a} 는 ${b} 명이다.`, "Second cell."], [`행 합계 = ${a} + ${b} = ${a + b} 이다.`, "Add."]], variant: "row_total_of_two_cells" }), [{ noun: t.a, value: a }]);
    },
  },
  {
    id: "tvd.conditional_share.med_share", skill: SKILL, kind: "conditional_share", operator: "repr_shift", level: "medium",
    structure: "한 행에서 한 칸의 비율(%)을 구함", extraThinking: "medium: 칸 ÷ 행 합계 × 100", concepts: ["이원표", "퍼센트"], mediumSteps: 2,
    generate(rng) {
      const t = tp(rng); const r1 = rng.pick([20, 25, 40, 50, 60, 80, 100, 120, 200]); const p = rng.pick([10, 20, 25, 30, 40, 50, 60, 75, 80]); const c = (r1 * p) / 100; if (!isInt(c)) throw new GenFail("x"); const other = r1 - c;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`Of the ${r1} ${t.a} surveyed, ${c} ${t.y} and ${other} ${t.n}.`, `${r1} ${t.a} were surveyed: ${c} ${t.y}, and the rest ${t.n}.`, `A survey of ${r1} ${t.a} found that ${c} ${t.y} while ${other} ${t.n}.`]]), question: spin(rng, `[[What percent of the ${t.a} surveyed ${t.y.replace(/^(joined|bought|received|enrolled)/, "$1").replace(/^(use|support|take|own)/, "$1")}?|What percent of these ${t.a} ${t.y}?|Of the ${t.a} surveyed, what percent ${t.y}?]]`), correct: p, fmt: (v) => `${fmtNum(v)}%`,
        wrongs: [W(100 - p, "opposite", "반대 칸의 비율을 답했다."), W(Math.round((c * 100) / (r1 + c)), "formula_misuse", "분모를 잘못 잡았다."), W(c, "unit_error", "비율이 아니라 인원수를 답했다."), W(p + 10, "other", "계산 중 어긋났다."), W(Math.max(1, p - 10), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ c, r1 }, "return P.c*100/P.r1;"),
        trace: [[`${t.a} 전체 = ${c} + ${other} = ${r1} 이다.`, "Row total."], [`비율 = ${c} ÷ ${r1} × 100 이다.`, "Form the percent."], [`${p}% 이다.`, "Compute."]], variant: "share_in_row" }), [{ noun: t.a, value: r1 }]);
    },
  },
  {
    id: "tvd.scatter_predict.med_evaluate", skill: SKILL, kind: "scatter_predict", operator: "repr_shift", level: "medium",
    structure: "회귀선 y = mx + b 에 x 를 대입해 예측값을 구함", extraThinking: "medium: 일차식에 대입하고 단위를 읽음", concepts: ["회귀선 예측", "일차식 계산"], mediumSteps: 2,
    generate(rng) {
      const t = stc(rng); const m = rng.int(2, 12) * (rng.chance(0.25) ? -1 : 1), b = rng.int(10, 120); const x = rng.int(2, 25); const y = m * x + b; if (y <= 0) throw new GenFail("x");
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) is $y = ${lin(m, b, "x")}$.`, `The equation $y = ${lin(m, b, "x")}$ is a line of best fit that relates ${t.x} (${t.xu}) to ${t.y} (${t.yu}).`, `Researchers model ${t.y} (${t.yu}) from ${t.x} (${t.xu}) with the line $y = ${lin(m, b, "x")}$.`]]), question: spin(rng, `[[What does the line predict when the horizontal value is ${x}?|According to the line, what is the predicted value at ${x}?|What is the predicted value of $y$ when $x = ${x}$?]]`), correct: y,
        wrongs: [W(m * x, "step_missing", "상수항을 더하지 않았다."), W(b - m * x, "sign_error", "부호를 거꾸로 계산했다."), W(m + b + x, "formula_misuse", "곱하지 않고 더했다."), W(y + m, "other", "한 단위 더 계산했다."), W(Math.abs(y - 10), "other", "계산 중 어긋났다.")],
        verificationJs: withParams({ m, b, x }, "return P.m*P.x+P.b;"),
        trace: [[`x = ${x} 을 식에 대입한다.`, "Substitute."], [`y = ${m}·${x} + ${b} 이다.`, "Write the expression."], [`y = ${y} 이다.`, "Compute."]], variant: "evaluate_line" }), [{ noun: ["is y =", "equation y =", "line y ="], value: lin(m, b, "x") }]);
    },
  },
  {
    id: "tvd.scatter_slope_context.med_interpret", skill: SKILL, kind: "scatter_slope_context", operator: "repr_shift", level: "medium",
    structure: "회귀선 기울기의 의미를 이용해 x 가 k 늘 때 예측 변화량을 구함", extraThinking: "medium: 기울기 × 변화량", concepts: ["회귀선의 기울기", "변화량"], mediumSteps: 2,
    generate(rng) {
      const t = stc(rng); const m = rng.int(2, 12), b = rng.int(10, 100); const k = rng.int(2, 9); const correct = m * k;
      return withBind(finish(rng, { stimulus: ctx(rng) + facts(rng, [[`A line of best fit for ${t.x} (${t.xu}) and ${t.y} (${t.yu}) is $y = ${lin(m, b, "x")}$.`, `The equation $y = ${lin(m, b, "x")}$ models ${t.y} (${t.yu}) in terms of ${t.x} (${t.xu}).`, `For ${t.x} (${t.xu}) and ${t.y} (${t.yu}), the line of best fit is $y = ${lin(m, b, "x")}$.`]]), question: spin(rng, `[[According to the line, how much does the predicted value change when the horizontal value increases by ${k}?|By how much does the prediction increase for an increase of ${k} in the horizontal value?|What is the predicted increase in $y$ when $x$ increases by ${k}?]]`), correct,
        wrongs: [W(m, "step_missing", "기울기를 그대로 답했다."), W(m + k, "formula_misuse", "곱하지 않고 더했다."), W(b * k, "formula_misuse", "절편에 변화량을 곱했다."), W(m * k + b, "formula_misuse", "절편을 더했다."), W(k, "other", "x 의 변화량을 답했다.")],
        verificationJs: withParams({ m, k }, "return P.m*P.k;"),
        trace: [[`기울기 ${m} 은 x 가 1 늘 때의 변화량이다.`, "Interpret the slope."], [`x 가 ${k} 늘면 변화량 = ${m} × ${k} 이다.`, "Multiply by the change in x."], [`변화량은 ${correct} 이다.`, "Compute."]], variant: "slope_times_change" }), [{ noun: ["is y =", "equation y =", "line y ="], value: lin(m, b, "x") }]);
    },
  },
];
export const TVD_ALL: LArch[] = [...TVD_HARD.map((a) => asLevel(a)), ...TVD_LEVELS];
