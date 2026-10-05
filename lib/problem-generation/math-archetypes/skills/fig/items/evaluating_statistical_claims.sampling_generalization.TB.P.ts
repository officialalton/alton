// evaluating_statistical_claims.sampling_generalization.TB.P — 구역(Site 1~4 등)별 모집단 수·표본 수·'예' 수 표에서 표본이 뽑힌 구역만 일반화 범위로 잡는다.
// 표본이 0 인 구역이 있으면 그 구역에는 일반화할 근거가 없다. 표본은 뽑힌 구역마다 같은 비율(1/10 또는 1/5)로 무작위 추출해, 합친 비율로 추정할 수 있다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { lcf, surv, type Surv } from "./_t7-kit";

const plu = (u: string) => { const w = u.toLowerCase(); return /(s|x|ch|sh)$/.test(w) ? w + "es" : w + "s"; };
const UNITS = ["Site", "Branch", "Ward", "Office", "Zone", "Section"];
type Sc = { s: Surv; u: string; names: string[]; pop: number[]; samp: number[]; yes: number[]; f: number; on: number[]; fig: { type: "data"; kind: "table"; title: string; columns: string[]; rows: (string | number)[][] } };
function scene(rng: Rng, o: { nOn?: number } = {}): Sc {
  const s = surv(rng); const u = rng.pick(UNITS); const names = [1, 2, 3, 4].map((i) => `${u} ${i}`); const f = rng.pick([10, 5]);
  const nOn = o.nOn ?? rng.int(2, 3); const on = rng.shuffle([0, 1, 2, 3]).slice(0, nOn).sort((a, b) => a - b);
  const pop = names.map(() => rng.int(8, 40) * 10); const samp = pop.map((p, i) => (on.includes(i) ? p / f : 0));
  const yes = samp.map((n) => (n ? rng.int(Math.ceil(n * 0.15), Math.floor(n * 0.85)) : 0)); if (samp.some((n) => !Number.isInteger(n))) throw new GenFail("samp");
  const fig = { type: "data" as const, kind: "table" as const, title: `Survey of ${lcf(s.popLbl)} by ${u.toLowerCase()}`, columns: [u, `Number of ${s.ent}`, "Number in sample", "Number in sample who said yes"], rows: names.map((nm, i) => [nm, pop[i], samp[i], yes[i]]) };
  return { s, u, names, pop, samp, yes, f, on, fig };
}
const listNames = (a: string[]) => (a.length === 1 ? a[0] : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`);
const LIST_JS = "const listNames=(a)=>a.length===1?a[0]:a.length===2?a[0]+' and '+a[1]:a.slice(0,-1).join(', ')+', and '+a[a.length-1];\n";
/** 표를 읽고, 뽑힌 구역의 표본 비율이 같은지 확인하는 JS. */
const READ_JS = "const R=FIGURE.rows; const on=R.filter(r=>r[2]>0); if(!on.length) throw new Error('표본 없음'); for (const r of R) if (r[3]>r[2]||r[3]<0) throw new Error('응답 수 오류'); const f=on[0][1]/on[0][2]; for (const r of on) if (Math.abs(r[1]/r[2]-f)>1e-9) throw new Error('추출 비율이 다름');\n";
const intro = (rng: Rng, c: Sc) => rng.pick([
  `All ${lcf(c.s.popLbl)} belong to one of four ${plu(c.u)}. A researcher chose ${c.s.ent} at random within some of the ${plu(c.u)}, using the same sampling rate in each, and surveyed no one elsewhere. Each person sampled was asked whether they ${c.s.ev}. The table shows the results.`,
  `To study ${c.s.topic}, an organization selected ${c.s.ent} at random from only some of the four ${plu(c.u)}, sampling the same fraction of ${c.s.ent} in each one it chose. The table shown gives the number of ${c.s.ent} in each ${c.u.toLowerCase()}, the number sampled, and the number who said they ${c.s.ev}.`,
  `The table shown describes a survey about ${c.s.topic}. In every ${c.u.toLowerCase()} that was sampled, the same fraction of ${c.s.ent} was chosen at random and asked whether they ${c.s.ev}; in the remaining ${plu(c.u)}, no one was surveyed.`,
]);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isInteger(w.v));

export const ITEM = defineItem({
  prefix: "esc", itemId: "evaluating_statistical_claims.sampling_generalization.TB.P",
  hard: [
    {
      op: "constraint_select", structure: "표본 수가 0 인 구역을 찾아 일반화 범위를 표본이 뽑힌 구역의 사람들로 한정하는 서술을 고름", extra: "표의 '표본 수' 열에서 0 인 행을 찾아 표집 틀을 재구성해야 함(전체로 일반화·표본만으로 한정이 함정) — medium 은 한 구역의 비율",
      concepts: ["무작위 표집", "표집 틀과 일반화 범위", "표 읽기"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const c = scene(rng); const onN = c.on.map((i) => c.names[i]); const offN = c.names.filter((_, i) => !c.on.includes(i));
        const lead = rng.pick(["Only to the " + c.s.ent + " in ", "To the " + c.s.ent + " in "]);
        const correct = `${lead}${listNames(onN)}`; const all = `To all ${lcf(c.s.popLbl)} in all four ${plu(c.u)}`;
        const wrongs = [{ text: all, reason: "표본이 없는 구역까지 일반화했다." }, { text: `${lead}${listNames(offN)}`, reason: "표본이 0 인 구역을 골랐다." }, { text: `Only to the ${sum(c.samp)} ${c.s.ent} who were surveyed`, reason: "무작위 표본의 일반화를 부정했다." }];
        return statementInst(rng, {
          stimulus: intro(rng, c), question: rng.pick(["To which population can the survey result most appropriately be generalized?", "Based on the table, what is the broadest population to which the result can reasonably be generalized?"]), correct, wrongs, figure: c.fig, P: { lead },
          body: `${READ_JS}${LIST_JS}if (on.length===R.length) throw new Error('모든 구역 표본'); const want=P.lead+listNames(on.map(r=>r[0])); const i=P.options.indexOf(want); if (i<0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [["표의 '표본 수' 열을 읽는다.", "Read the sample column."], [`표본이 있는 구역: ${listNames(onN)} 이다.`, "Sampled units."], [`표본이 0 인 구역: ${listNames(offN)} 이다.`, "Units with no sample."], ["무작위 표본은 뽑힌 구역의 사람들만 대표한다.", "A random sample represents only what it was drawn from."], [`따라서 ${listNames(onN)} 의 ${c.s.ent} 에게만 일반화한다.`, "Scope of the conclusion."]], variant: "scope_sampled_units",
        });
      },
    },
    {
      op: "compose_kind", structure: "표본이 뽑힌 구역들의 '예' 비율(합친 표본)을 그 구역들의 전체 인원에 곱해 추정치를 구함", extra: "일반화 범위(뽑힌 구역)를 정한 뒤 합친 비율 × 그 구역 인원으로 추정 — 네 구역 전체 인원을 곱하면 함정. medium 은 한 구역의 비율",
      concepts: ["표집 틀과 일반화 범위", "표본 비율", "모집단 추정"],
      gen(rng) {
        const c = scene(rng); const S = sum(c.samp), Y = sum(c.yes), Pon = sum(c.on.map((i) => c.pop[i])), Pall = sum(c.pop); const ans = (Y * Pon) / S;
        return figInst(rng, {
          stimulus: intro(rng, c), question: rng.pick([`Based on the survey, what is the best estimate of the total number of ${c.s.ent} in the sampled ${plu(c.u)} who ${c.s.ev}?`, `Estimate how many ${c.s.ent}, in all the ${plu(c.u)} where a sample was taken, ${c.s.ev}.`]), correct: ans,
          wrongs: pos([W(Math.round((Y * Pall) / S), "scope", "표본이 없는 구역까지 곱했다."), W(Y, "step_missing", "표본의 '예' 수를 답했다."), W(Pon - ans, "opposite", "'예'가 아닌 사람 수를 구했다."), W(Math.round((Y * Pon) / Pall), "formula_misuse", "비율의 분모를 잘못 잡았다."), W(ans + c.f, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== ans),
          verificationJs: figJs({}, c.fig, `${READ_JS}const S=on.reduce((a,r)=>a+r[2],0), Y=on.reduce((a,r)=>a+r[3],0), Pon=on.reduce((a,r)=>a+r[1],0); return Y*Pon/S;`),
          trace: [[`표본이 있는 구역: ${listNames(c.on.map((i) => c.names[i]))} 이다.`, "Sampled units."], [`그 구역들의 표본 합 = ${S}, '예' 합 = ${Y} 이다.`, "Combined sample."], [`그 구역들의 인원 합 = ${Pon} 이다(표본 없는 구역 제외).`, "Population of sampled units only."], [`비율 ${Y}/${S} 를 ${Pon} 에 곱한다.`, "Apply the proportion."], [`추정치 = ${ans} 이다.`, "Estimate."]], variant: "estimate_sampled_units",
        }, c.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "표본이 뽑힌 두 구역 각각의 추정 인원을 구해 그 차를 구함", extra: "구역마다 비율 × 인원으로 따로 추정해 비교(표본 '예' 수의 차를 쓰면 함정) — medium 은 한 구역의 비율",
      concepts: ["표본 비율", "구역별 추정", "두 추정치의 비교"],
      gen(rng) {
        const c = scene(rng, { nOn: rng.int(2, 3) }); const [i, j] = rng.shuffle(c.on).slice(0, 2); const ei = (c.pop[i] * c.yes[i]) / c.samp[i], ej = (c.pop[j] * c.yes[j]) / c.samp[j]; const d = Math.abs(ei - ej); if (!d) throw new GenFail("same");
        const A = c.names[i], B = c.names[j];
        return figInst(rng, {
          stimulus: intro(rng, c), question: `Based on the survey, what is the positive difference between the estimated numbers of ${c.s.ent} who ${c.s.ev} in ${A} and in ${B}?`, correct: d,
          wrongs: pos([W(Math.abs(c.yes[i] - c.yes[j]), "scope", "표본 '예' 수의 차를 답했다."), W(Math.max(ei, ej), "step_missing", "큰 추정치만 답했다."), W(ei + ej, "sign_error", "합을 구했다."), W(Math.abs(c.pop[i] - c.pop[j]), "axis_misread", "인원 수의 차를 답했다."), W(d + c.f, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== d),
          verificationJs: figJs({ A, B }, c.fig, `${READ_JS}const ra=R.find(r=>r[0]===P.A), rb=R.find(r=>r[0]===P.B); if(!ra||!rb||!ra[2]||!rb[2]) throw new Error('표본 없는 구역'); return Math.abs(ra[1]*ra[3]/ra[2]-rb[1]*rb[3]/rb[2]);`),
          trace: [[`${A}: 표본 ${c.samp[i]} 중 '예' ${c.yes[i]}, 인원 ${c.pop[i]} 이다.`, `Read ${A}.`], [`${A} 추정 = ${c.pop[i]} × ${c.yes[i]}/${c.samp[i]} = ${ei} 이다.`, `Estimate for ${A}.`], [`${B}: 표본 ${c.samp[j]} 중 '예' ${c.yes[j]}, 인원 ${c.pop[j]} 이다.`, `Read ${B}.`], [`${B} 추정 = ${c.pop[j]} × ${c.yes[j]}/${c.samp[j]} = ${ej} 이다.`, `Estimate for ${B}.`], [`차 = |${ei} - ${ej}| = ${d} 이다.`, "Difference."]], variant: "difference_of_unit_estimates",
        }, c.fig);
      },
    },
    {
      op: "chain2", structure: "뽑힌 구역의 '예' 추정치를 구한 뒤 그 구역 인원에서 빼 '예'라고 하지 않을 사람 수를 추정", extra: "범위 판단 → 합친 비율 추정 → 여사건(인원 - 추정)의 연쇄 — medium 은 한 구역의 비율",
      concepts: ["표집 틀과 일반화 범위", "모집단 추정", "여사건"],
      gen(rng) {
        const c = scene(rng); const S = sum(c.samp), Y = sum(c.yes), Pon = sum(c.on.map((i) => c.pop[i])), Pall = sum(c.pop); const est = (Y * Pon) / S; const ans = Pon - est;
        return figInst(rng, {
          stimulus: intro(rng, c), question: `Based on the survey, about how many ${c.s.ent} in the sampled ${plu(c.u)} would not say that they ${c.s.ev}?`, correct: ans,
          wrongs: pos([W(est, "opposite", "'예' 추정치를 답했다."), W(Pall - est, "scope", "전체 인원에서 뺐다."), W(S - Y, "step_missing", "표본의 '아니오' 수를 답했다."), W(Math.round(((S - Y) * Pall) / S), "scope", "모든 구역으로 확대했다."), W(ans + c.f, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== ans),
          verificationJs: figJs({}, c.fig, `${READ_JS}const S=on.reduce((a,r)=>a+r[2],0), Y=on.reduce((a,r)=>a+r[3],0), Pon=on.reduce((a,r)=>a+r[1],0); return Pon - Y*Pon/S;`),
          trace: [[`표본이 있는 구역의 인원 합 = ${Pon} 이다.`, "Population of sampled units."], [`합친 표본 ${S} 중 '예' ${Y} 이다.`, "Combined sample."], [`'예' 추정 = ${Pon} × ${Y}/${S} = ${est} 이다.`, "Estimate yes."], [`'예'가 아닌 사람 = ${Pon} - ${est} 이다.`, "Complement."], [`답은 ${ans} 이다.`, "Answer."]], variant: "complement_estimate_sampled_units",
        }, c.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "total_sampled", structure: "표의 표본 수 열을 더해 전체 표본 크기를 구함", extra: "easy: 합", concepts: ["표 읽기", "합계"],
      gen(rng) {
        const c = scene(rng); const S = sum(c.samp);
        return figInst(rng, { stimulus: intro(rng, c), question: `How many ${c.s.ent} were in the sample in all?`, correct: S, wrongs: pos([W(sum(c.yes), "axis_misread", "'예' 열을 더했다."), W(sum(c.pop), "axis_misread", "인원 열을 더했다."), W(Math.max(...c.samp), "step_missing", "가장 큰 값만."), W(S + 10, "other", "계산 오류.")]).filter((w) => w.v !== S),
          verificationJs: figJs({}, c.fig, `${READ_JS}return R.reduce((a,r)=>a+r[2],0);`), trace: [["표본 수 열을 읽는다.", "Read the sample column."], [`합 = ${S} 이다.`, "Add."]], variant: "total_sampled" }, c.fig);
      },
    },
    {
      lv: "medium", name: "unit_percent", structure: "표본이 있는 한 구역의 '예' 백분율을 구함", extra: "medium: 행 선택 + 비율", concepts: ["표 읽기", "표본 비율"],
      gen(rng) {
        const c = scene(rng); const i = rng.pick(c.on); const p = (100 * c.yes[i]) / c.samp[i]; if (!Number.isInteger(p)) throw new GenFail("p"); const A = c.names[i];
        return figInst(rng, { stimulus: intro(rng, c), question: `In ${A}, what percent of the ${c.s.ent} in the sample said yes?`, correct: p, wrongs: pos([W(100 - p, "opposite", "'아니오' 백분율."), W(Math.round((100 * c.yes[i]) / c.pop[i]), "formula_misuse", "인원으로 나눴다."), W(c.yes[i], "unit_error", "응답 수."), W(p + 5, "other", "계산 오류.")]).filter((w) => w.v !== p),
          verificationJs: figJs({ A }, c.fig, `${READ_JS}const r=R.find(r=>r[0]===P.A); if(!r||!r[2]) throw new Error('표본 없음'); return 100*r[3]/r[2];`), trace: [[`${A} 행: 표본 ${c.samp[i]}, '예' ${c.yes[i]}.`, "Read the row."], ["'예' ÷ 표본 을 구한다.", "Divide."], [`${p}% 이다.`, "Percent."]], variant: "unit_percent" }, c.fig);
      },
    },
  ],
});
