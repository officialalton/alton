// evaluating_statistical_claims(카탈로그 밖 세부 패턴 3개 제안) — 정성 판단형. 선지가 서술문이라 수치 선지 검증을 쓰지 않고 verification_js 가 '인쇄된 지문'을 읽어 정답 선지를 고른다.
// hard 원형은 세부 패턴당 3개(4개 아님): 구조가 (무작위 표집 × 무작위 배정 × 표집 틀 × 자료 크기) 판단 트리라 서로 다른 풀이 구조가 3가지를 넘으면
// 기존 2×2 조합 매핑(easy/medium)으로 환원된다 — 4번째를 채우면 기준 완화가 되므로 만들지 않는다(보고서 근거 참고).
import { GenFail, type Archetype } from "../types";
import { spin, sentenceCase } from "../text";
import { asLevel, withBind, type BInstance, type LArch } from "../levels-d";
import type { DistractorKind } from "../../review";
import type { Rng } from "../rng";
import { DATA_CTX } from "./d-kit";

const SKILL = "evaluating_statistical_claims";
const ctx = (rng: Rng) => DATA_CTX[rng.int(0, DATA_CTX.length - 1)];
type Cx = { ent: string; T: string; F: string; topic: string; tr: string; out: string; conf: string[] };
const CX: Cx[] = [
  { ent: "adults", T: "adults in the town of Brookfield", F: "members of the Brookfield Public Library", topic: "weekly reading time", tr: "a new reading app", out: "weekly reading time", conf: ["already read more books", "have more free time", "visit the library more often"] },
  { ent: "students", T: "students at Lincoln High School", F: "students enrolled in the school's honors program", topic: "the number of hours students sleep", tr: "a new study technique", out: "test scores", conf: ["start with higher grades", "spend more hours studying", "be more motivated"] },
  { ent: "employees", T: "employees of a large company", F: "employees at the company's headquarters office", topic: "how energetic employees feel at work", tr: "a standing desk", out: "reported energy level", conf: ["exercise more often", "get more sleep", "have shorter commutes"] },
  { ent: "patients", T: "patients in a regional hospital system", F: "patients of one downtown clinic", topic: "the level of back pain patients report", tr: "a new stretching routine", out: "back pain score", conf: ["be younger", "be healthier to begin with", "follow medical advice more closely"] },
  { ent: "voters", T: "registered voters in a county", F: "registered voters on a party's email list", topic: "support for a proposed park", tr: "a door-to-door information campaign", out: "support for the park", conf: ["already be interested in local issues", "live closer to the proposed site", "be more politically active"] },
  { ent: "customers", T: "customers of a grocery chain", F: "customers who hold loyalty cards", topic: "how much customers spend per visit", tr: "a redesigned coupon booklet", out: "amount spent per visit", conf: ["shop more often", "have larger households", "already be big spenders"] },
  { ent: "gym members", T: "members of a national gym chain", F: "members of one gym location", topic: "members' resting heart rates", tr: "a new workout plan", out: "resting heart rate", conf: ["start in better shape", "visit the gym more often", "eat healthier meals"] },
  { ent: "drivers", T: "licensed drivers in a state", F: "drivers who renewed their licenses at one office", topic: "the number of traffic tickets per driver", tr: "an online safety video", out: "number of tickets", conf: ["drive fewer miles", "be older", "already be cautious drivers"] },
  { ent: "households", T: "households in a city", F: "households in one neighborhood", topic: "pounds of recycling per household", tr: "a weekly recycling reminder", out: "pounds of recycling", conf: ["be larger", "already recycle regularly", "own their homes"] },
  { ent: "runners", T: "runners in a regional league", F: "runners who joined the club's training group", topic: "race finishing times", tr: "a new warm-up routine", out: "race time", conf: ["train more miles each week", "be more experienced", "be younger"] },
  { ent: "teachers", T: "teachers in a school district", F: "teachers at one middle school", topic: "teachers' hours of weekly planning", tr: "a lesson-planning tool", out: "weekly planning time", conf: ["have more years of experience", "teach fewer classes", "already be organized planners"] },
  { ent: "residents", T: "residents of a city", F: "residents living in one apartment complex", topic: "daily minutes spent walking", tr: "a free walking-club membership", out: "daily walking time", conf: ["be younger", "live closer to parks", "already be active"] },
];
const cx = (rng: Rng) => rng.pick(CX);
const LET = ["A", "B"] as const;

type QWrong = { text: string; kind: DistractorKind; reason: string };
type QDraft = { stimulus: string; question: string; correct: string; wrongs: QWrong[]; jsBody: string; trace: [string, string][]; variant: string };
/** 정성형 문항 조립: 선지 4개를 섞고, verification_js 는 const P = {stimulus, options}; 와 지문만 읽는 판정 본문을 합친다. */
function finishQ(rng: Rng, d: QDraft): BInstance {
  const stim = sentenceCase(d.stimulus); const question = sentenceCase(d.question);
  const seen = new Set<string>([d.correct]); const picked: QWrong[] = [];
  for (const w of d.wrongs) { if (picked.length >= 3) break; if (seen.has(w.text)) continue; seen.add(w.text); picked.push(w); }
  if (picked.length < 3) throw new GenFail("오답 후보 부족");
  const all = [{ text: d.correct, right: true, kind: "other" as DistractorKind, reason: "" }, ...picked.map((p) => ({ text: p.text, right: false, kind: p.kind, reason: p.reason }))];
  const order = rng.shuffle(all); const options = order.map((o) => o.text); const correctIndex = order.findIndex((o) => o.right);
  const explanation = `${d.trace.map(([ko], i) => `(${i + 1}) ${ko}`).join(" ")} 따라서 정답은 ${correctIndex + 1}번이다.`;
  const explanationEn = `${d.trace.map(([, en], i) => `(${i + 1}) ${en}`).join(" ")} So the answer is option ${correctIndex + 1}.`;
  const verificationJs = `const P = ${JSON.stringify({ stimulus: stim, options })};\n${d.jsBody}`;
  return { stimulus: stim, question, options, correctIndex, explanation, explanationEn, verificationJs, trace: d.trace.map(([ko]) => ko), variant: d.variant, distractors: order.map((o, i) => ({ o, i })).filter(({ o }) => !o.right).map(({ o, i }) => ({ index: i, kind: o.kind, reason: o.reason })), bindings: [] };
}
const W2 = (text: string, kind: DistractorKind, reason: string): QWrong => ({ text, kind, reason });
const RAND_ASSIGN = "randomly assigned|random assignment|coin|random number|drawn from a hat|drew names|lottery|randomly divided";
const ASSIGN_JS = `const rndAssign=/${RAND_ASSIGN}/i.test(P.stimulus);`;

const assignRandom = (c: Cx) => (rng: Rng) => rng.pick([`Each participant was randomly assigned, using a coin flip, either to use ${c.tr} or not to use it.`, `A computer randomly assigned each participant to the group that used ${c.tr} or to the group that did not.`, `Names were drawn from a hat to decide which participants would use ${c.tr}; the rest did not.`, `The researchers used a random number generator to divide the participants into a group that used ${c.tr} and a group that did not.`]);
const assignChoice = (c: Cx) => (rng: Rng) => rng.pick([`Each participant chose whether to use ${c.tr}.`, `Participants decided for themselves whether to use ${c.tr}.`, `The researchers let participants sign up for ${c.tr} if they wanted it; the others formed the comparison group.`, `Those who wanted ${c.tr} were placed in that group, and the remaining participants served as the comparison group.`]);

export const ESC_HARD: Archetype[] = [
  // ───────── generalizability ─────────
  {
    id: "esc.generalizability.constraint_select", skill: SKILL, kind: "generalizability", operator: "constraint_select",
    structure: "무작위로 표본을 뽑았지만 표집 틀(명단)이 목표 모집단의 일부일 때 일반화 가능한 범위를 그 틀로 한정",
    extraThinking: "'무작위 표집' 이라는 단어만으로 전체 모집단에 일반화하지 않고 표집 틀이 어디까지인지 확인해 일반화 범위를 제한 — medium 은 무작위/비무작위 구분만 요구",
    concepts: ["무작위 표집", "표집 틀과 목표 모집단", "일반화 범위"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const n = rng.int(40, 300);
      const stimulus = ctx(rng) + rng.pick([`A researcher wanted to estimate ${c.topic} for all ${c.T}. She obtained a list of ${c.F} and surveyed ${n} ${c.ent} selected at random from that list.`, `To learn about ${c.topic} among ${c.T}, a team obtained a list of ${c.F} and surveyed ${n} ${c.ent} chosen at random from that list.`, `A survey about ${c.topic} was designed for all ${c.T}. The organizers obtained a list of ${c.F} and surveyed ${n} ${c.ent} picked at random from that list.`]);
      return withBind(finishQ(rng, { stimulus, question: spin(rng, `[[Which statement best describes how far the result can be generalized?|Which of the following is the most appropriate conclusion about generalizing the result?|What is the broadest group to which the result can reasonably be generalized?]]`),
        correct: `The result can be generalized to all ${c.F}, but not necessarily to all ${c.T}.`,
        wrongs: [W2(`The result can be generalized to all ${c.T}.`, "scope", "표본이 무작위여도 표집 틀 밖의 집단(전체 모집단)까지 일반화한다고 착각했다."), W2(`The result applies only to the ${n} ${c.ent} who were surveyed.`, "scope", "무작위 표집이라는 점을 무시하고 표본에만 적용된다고 했다."), W2(`No conclusion beyond the sample is possible, because the sample was drawn from a list.`, "relation_distortion", "명단에서 무작위로 뽑은 표본은 그 명단 전체로 일반화할 수 있다.")],
        jsBody: `const m=P.stimulus.match(/obtained a list of (.+?) and surveyed/); if(!m) throw new Error('표집 틀 없음'); if(!/at random/.test(P.stimulus)) throw new Error('무작위 아님');\nconst hits=P.options.map((o,i)=>o.includes('generalized to all '+m[1]+', but not necessarily')?i:-1).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["표본은 명단에서 무작위로 뽑았으므로 그 명단에 속한 모두에게는 일반화할 수 있다.", "A random sample from a list generalizes to the list."], [`그러나 명단은 ${c.F} 뿐이므로 표집 틀이 목표 모집단(${c.T})의 일부이다.`, "Compare the sampling frame with the target population."], [`표집 틀 밖의 ${c.T} 에게는 결과를 그대로 적용할 근거가 없다.`, "No basis beyond the frame."], ["따라서 일반화 범위는 표집 틀(명단)까지이다.", "The scope is the frame."], ["'무작위'라는 단어만 보고 전체로 일반화하지 않았는지 확인한다.", "Do not over-read the word 'random'."]], variant: "frame_restricted" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.generalizability.repr_shift", skill: SKILL, kind: "generalizability", operator: "repr_shift",
    structure: "표집 방법을 서술(무작위 추첨·선착순·자원자 등)로 주고 표본 크기와 무관하게 무작위 여부만으로 일반화 가능성을 판단",
    extraThinking: "표집 서술을 '무작위/비무작위'로 번역하고 표본 크기(작은 무작위 표본, 큰 비무작위 표본)에 현혹되지 않고 근거(무작위 여부)를 고름 — medium 은 크기 정보가 없는 단순 판별",
    concepts: ["표집 방법", "무작위 표집과 일반화", "표본 크기의 역할"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const rnd = rng.chance(0.5); const small = rnd ? rng.chance(0.5) : false; const n = small ? rng.int(8, 20) : rng.int(150, 800);
      const method = rnd ? rng.pick([`She selected a sample of ${n} ${c.ent} using a random number generator applied to a complete roster of all ${c.T}.`, `A sample of ${n} ${c.ent} was chosen by drawing names at random from a complete list of all ${c.T}.`, `Using a lottery on the full membership list, the team picked a sample of ${n} ${c.ent} at random.`]) : rng.pick([`She stood at one entrance and asked the first ${n} ${c.ent} who walked in; this gave a sample of ${n} ${c.ent}.`, `A flyer invited volunteers, and the sample of ${n} ${c.ent} consisted of those who chose to respond.`, `She surveyed a sample of ${n} ${c.ent} who happened to be her friends and coworkers.`, `An online poll was posted, and the sample of ${n} ${c.ent} are the ones who clicked to respond.`]);
      const stimulus = ctx(rng) + facts2(rng, `A researcher wanted to estimate ${c.topic} for all ${c.T}.`, method);
      const T = c.T;
      return withBind(finishQ(rng, { stimulus, question: spin(rng, `[[Which statement correctly says whether, and why, the result can be generalized to all ${T}?|Which of the following correctly explains whether the result can be generalized to all ${T}?]]`),
        correct: rnd ? `The result can be generalized to all ${T} because the sample was selected at random.` : `The result cannot be generalized to all ${T} because the sample was not selected at random.`,
        wrongs: rnd ? [W2(`The result cannot be generalized to all ${T} because the sample was not selected at random.`, "opposite", "무작위로 뽑은 표본을 비무작위로 읽었다."), W2(`The result can be generalized to all ${T} because the sample is large.`, "condition_ignored", "일반화의 근거를 표본 크기로 착각했다."), W2(`The result cannot be generalized to all ${T} because the sample is small.`, "condition_ignored", "작은 표본이라는 이유로 일반화할 수 없다고 했다(무작위이면 정밀도만 낮아진다).")] : [W2(`The result can be generalized to all ${T} because the sample is large.`, "condition_ignored", "큰 표본이면 일반화할 수 있다고 착각했다(편향은 표본 크기로 해결되지 않는다)."), W2(`The result can be generalized to all ${T} because the sample was selected at random.`, "opposite", "비무작위 표본을 무작위로 읽었다."), W2(`The result cannot be generalized to all ${T} because the sample is small.`, "condition_ignored", "표본이 크다는 사실을 무시하고 작다는 이유를 댔다.")],
        jsBody: `const rnd=/random number generator|at random|lottery/.test(P.stimulus); const nonrandomWord=/first \\d+|volunteers|friends and coworkers|clicked to respond/.test(P.stimulus); if(rnd===nonrandomWord) throw new Error('표집 방법 모호');\nconst hits=P.options.map((o,i)=> rnd ? (o.includes('can be generalized') && !o.includes('cannot') && o.includes('selected at random') && !o.includes('not selected') ? i : -1) : (o.includes('cannot be generalized') && o.includes('not selected at random') ? i : -1)).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["표집 방법 서술에서 무작위로 뽑았는지(추첨·난수) 아니면 편의·자원 표집인지 구분한다.", "Classify the sampling method."], [rnd ? "무작위 추출이므로 표본은 전체 모집단을 대표할 수 있다." : "선착순·자원자·지인 표집은 대표성을 보장하지 않는다(편향 가능).", "Judge representativeness."], [`표본 크기(${n})는 일반화 가능 여부를 결정하지 않는다.`, "Sample size does not decide generalizability."], [rnd ? (small ? "표본이 작으면 추정의 정밀도만 낮아질 뿐 일반화 자체는 가능하다." : "표본이 커도 무작위라는 근거가 핵심이다.") : "표본이 아무리 커도 편향은 사라지지 않는다.", "Role of the size."], ["근거(무작위 여부)가 맞는 선지를 고른다.", "Pick the option with the right justification."]], variant: rnd ? (small ? "random_small_sample" : "random_large_sample") : "nonrandom_large_sample" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.generalizability.compare_scenarios", skill: SKILL, kind: "generalizability", operator: "compare_scenarios",
    structure: "표본 크기가 다른 두 연구(작은 무작위 표본 vs 큰 자원자 표본) 중 모집단에 더 합리적으로 일반화되는 연구를 고름",
    extraThinking: "두 연구의 표집 방법을 각각 판별해 표본이 큰 쪽이 아니라 무작위인 쪽을 고르는 비교(크기의 함정) — medium 은 한 연구의 일반화 가능 여부",
    concepts: ["표집 방법 비교", "무작위 표집", "표본 크기의 함정"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const first = rng.chance(0.5) ? "A" : "B"; const second = first === "A" ? "B" : "A"; const nr = rng.int(30, 120), nv = rng.int(300, 900);
      const sRandom = rng.pick([`Study ${first} surveyed a random sample of ${nr} ${c.ent} chosen from a complete list of all ${c.T}.`, `In Study ${first}, ${nr} ${c.ent} were chosen at random from a complete list of all ${c.T}.`]);
      const sVol = rng.pick([`Study ${second} surveyed ${nv} ${c.ent} who volunteered after seeing an online post.`, `In Study ${second}, ${nv} ${c.ent} responded to a flyer and volunteered to be surveyed.`]);
      const parts = first === "A" ? [sRandom, sVol] : [sVol, sRandom];
      return withBind(finishQ(rng, { stimulus: ctx(rng) + `Two studies tried to estimate ${c.topic} for all ${c.T}. ` + parts.join(" "), question: spin(rng, `[[Which study's result can more reasonably be generalized to all ${c.T}?|Which study provides a better basis for generalizing to all ${c.T}?]]`),
        correct: `Study ${first}, because its sample was selected at random.`,
        wrongs: [W2(`Study ${second}, because its sample is larger.`, "condition_ignored", "표본이 크면 더 일반화할 수 있다고 착각했다."), W2(`Both studies equally, because each surveyed at least ${nr} ${c.ent}.`, "condition_ignored", "표집 방법의 차이를 무시했다."), W2(`Neither study, because no sample can represent all ${c.T}.`, "relation_distortion", "무작위 표본은 모집단을 대표할 수 있다.")],
        jsBody: `const ms=[...P.stimulus.matchAll(/Study ([AB])[^.]*\\./g)].map(m=>[m[1],m[0]]); const rnd=ms.filter(([l,s])=>/at random|random sample/.test(s)).map(([l])=>l); if(rnd.length!==1) throw new Error('무작위 연구가 하나가 아님');\nconst hits=P.options.map((o,i)=>o.startsWith('Study '+rnd[0]+', because its sample was selected at random')?i:-1).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [[`연구 ${first} 는 목록에서 무작위로 ${nr} 명을 뽑았다.`, "Study with random selection."], [`연구 ${second} 는 자원자 ${nv} 명이다.`, "Study with volunteers."], ["자원자는 스스로 참여를 결정하므로 대표성이 보장되지 않는다.", "Volunteers are self-selected."], ["표본 크기가 커도 표집 편향은 줄지 않는다.", "A larger sample does not remove bias."], [`따라서 무작위 표본인 연구 ${first} 가 더 합리적으로 일반화된다.`, "Pick the random study."]], variant: "random_small_vs_volunteer_large" }), [{ noun: `Study ${first}`, value: nr }]);
    },
  },
  // ───────── cause_vs_association ─────────
  {
    id: "esc.cause_vs_association.repr_shift", skill: SKILL, kind: "cause_vs_association", operator: "repr_shift",
    structure: "집단 배정 방식을 서술(동전 던지기·난수·직접 선택·코치 지정)로 주고 무작위 배정 여부로 인과 결론 가능성을 판단",
    extraThinking: "배정 서술을 '무작위 배정/비무작위 배정'으로 번역하고 집단 차이의 크기·표본 크기에 현혹되지 않고 인과 결론의 근거를 고름 — medium 은 서술이 단순한 판별",
    concepts: ["무작위 배정", "인과와 연관", "근거 판별"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const rnd = rng.chance(0.5); const assign = rnd ? assignRandom(c)(rng) : assignChoice(c)(rng); const n = rng.int(60, 400);
      const stimulus = ctx(rng) + `In a study of ${n} ${c.ent}, researchers compared the ${c.out} of those who used ${c.tr} with those who did not. ${assign} The group that used ${c.tr} had a better average ${c.out}.`;
      return withBind(finishQ(rng, { stimulus, question: spin(rng, `[[Which statement correctly says what can be concluded about ${c.tr}, and why?|Which of the following is the best-justified conclusion about ${c.tr}?]]`),
        correct: rnd ? `A cause-and-effect relationship can be concluded because participants were randomly assigned to the groups.` : `Only an association can be concluded because participants were not randomly assigned to the groups.`,
        wrongs: rnd ? [W2(`Only an association can be concluded because participants were not randomly assigned to the groups.`, "opposite", "무작위 배정을 비무작위로 읽었다."), W2(`Only an association can be concluded because the study had only ${n} participants.`, "condition_ignored", "표본 크기를 이유로 인과 결론을 막았다."), W2(`No relationship of any kind can be concluded from a single study.`, "relation_distortion", "한 번의 연구여도 연관은 말할 수 있다.")] : [W2(`A cause-and-effect relationship can be concluded because the groups were large.`, "condition_ignored", "집단이 크면 인과를 말할 수 있다고 착각했다."), W2(`A cause-and-effect relationship can be concluded because the difference between the groups was large.`, "condition_ignored", "차이가 크면 인과를 말할 수 있다고 착각했다."), W2(`No relationship of any kind can be concluded from a single study.`, "relation_distortion", "연관은 말할 수 있다.")],
        jsBody: `${ASSIGN_JS}\nconst hits=P.options.map((o,i)=> rndAssign ? (o.startsWith('A cause-and-effect') && o.includes('because participants were randomly assigned') ? i : -1) : (o.startsWith('Only an association') && o.includes('because participants were not randomly assigned') ? i : -1)).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["집단 배정 서술에서 무작위 배정인지(동전·난수·추첨) 참가자 선택·지정인지 구분한다.", "Classify the assignment mechanism."], [rnd ? "무작위 배정이면 집단이 평균적으로 같아져 차이를 처치의 효과로 볼 수 있다." : "스스로 선택하거나 지정하면 집단이 처음부터 달라 다른 요인이 섞인다.", "Judge comparability of the groups."], ["집단 간 차이의 크기나 참가자 수는 인과 결론의 근거가 아니다.", "Magnitude and size are not the criterion."], [rnd ? "따라서 인과 관계를 결론낼 수 있다." : "따라서 연관만 결론낼 수 있다.", "Draw the conclusion."], ["근거(무작위 배정 여부)가 맞는 선지를 고른다.", "Pick the option with the right justification."]], variant: rnd ? "random_assignment_causal" : "self_selected_association" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.cause_vs_association.constraint_select", skill: SKILL, kind: "cause_vs_association", operator: "constraint_select",
    structure: "참가자가 스스로 처치를 선택한 관찰 연구에서 지문이 제시한 교란 요인과 같은 요인을 대안 설명으로 고름",
    extraThinking: "지문에 제시된 특성(교란 요인)이 결과를 설명할 수 있음을 연결하고, 지문에 없는 그럴듯한 다른 요인이나 무관한 비판을 제거 — medium 은 인과 가능 여부만 판단",
    concepts: ["관찰 연구와 교란 요인", "대안 설명", "근거 대조"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const [conf, other] = rng.shuffle(c.conf); const n = rng.int(80, 500);
      const stimulus = ctx(rng) + rng.pick([`Researchers compared the ${c.out} of ${n} ${c.ent} who used ${c.tr} with those who did not, and the users had a better average ${c.out}. Each person chose whether to use ${c.tr}. Those who chose ${c.tr} also tended to ${conf}.`, `A team looked at ${n} ${c.ent} and compared ${c.out} between users and non-users of ${c.tr}; users averaged a better ${c.out}. People decided on their own whether to use ${c.tr}, and those who chose ${c.tr} also tended to ${conf}.`, `In a survey of ${n} ${c.ent}, users of ${c.tr} reported a better average ${c.out} than non-users. No one was told what to do; each person chose for themselves. Those who chose ${c.tr} also tended to ${conf}.`]);
      return withBind(finishQ(rng, { stimulus, question: spin(rng, `[[Which statement best explains why the researchers cannot conclude that ${c.tr} caused the difference?|Why can this study not show that ${c.tr} caused the better ${c.out}?]]`),
        correct: `Participants who chose ${c.tr} also tended to ${conf}, so that difference could account for the result.`,
        wrongs: [W2(`Participants who chose ${c.tr} also tended to ${other}, so that difference could account for the result.`, "evidence_off_question", "지문에 제시되지 않은 요인을 근거로 삼았다."), W2(`The sample was too small to detect any difference between the groups.`, "irrelevant", "표본 크기가 아니라 배정 방식이 문제이다."), W2(`The researchers measured ${c.out} only once, which makes any comparison impossible.`, "irrelevant", "측정 횟수는 인과 해석의 핵심 문제가 아니다.")],
        jsBody: `const m=P.stimulus.match(/also tended to (.+?)\\./); if(!m) throw new Error('교란 요인 없음');\nconst hits=P.options.map((o,i)=>o.includes('also tended to '+m[1]+', so that')?i:-1).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["참가자가 스스로 처치를 선택했으므로 무작위 배정이 아니다.", "No random assignment."], [`지문은 처치를 선택한 사람들이 '${conf}' 는 경향도 있다고 말한다.`, "Locate the confounder stated in the passage."], ["그 특성이 결과 차이를 설명할 수 있으므로 처치의 효과로 단정할 수 없다.", "The confounder offers an alternative explanation."], ["지문에 나오지 않은 요인이나 표본 크기·측정 횟수는 근거가 아니다.", "Eliminate unsupported or irrelevant criticisms."], ["지문의 요인과 일치하는 선지를 고른다.", "Pick the matching option."]], variant: "confounder_from_passage" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.cause_vs_association.compare_scenarios", skill: SKILL, kind: "cause_vs_association", operator: "compare_scenarios",
    structure: "표본이 큰 관찰 연구와 표본이 작은 무작위 배정 실험 중 인과 주장을 더 잘 뒷받침하는 연구를 고름",
    extraThinking: "두 연구의 설계(선택 vs 무작위 배정)를 비교해 참가자 수가 아니라 배정 방식으로 인과 근거의 강도를 판단 — medium 은 한 연구의 인과 가능 여부",
    concepts: ["관찰 연구와 실험", "무작위 배정", "근거 강도 비교"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const first = rng.chance(0.5) ? "A" : "B"; const second = first === "A" ? "B" : "A"; const nExp = rng.int(40, 120), nObs = rng.int(300, 900);
      const sExp = rng.pick([`In Study ${first}, ${nExp} ${c.ent} were randomly assigned, by a coin flip, to use ${c.tr} or not, and the users had a better average ${c.out}.`, `Study ${first} randomly assigned ${nExp} ${c.ent} with a random number generator to use ${c.tr} or not; the users had a better average ${c.out}.`]);
      const sObs = rng.pick([`In Study ${second}, ${nObs} ${c.ent} chose for themselves whether to use ${c.tr}, and the users had a better average ${c.out}.`, `Study ${second} surveyed ${nObs} ${c.ent} who decided on their own whether to use ${c.tr}; the users had a better average ${c.out}.`]);
      const parts = first === "A" ? [sExp, sObs] : [sObs, sExp];
      return withBind(finishQ(rng, { stimulus: ctx(rng) + `Two studies examined ${c.tr} and ${c.out}. ` + parts.join(" "), question: spin(rng, `[[Which study provides stronger evidence that ${c.tr} caused the better ${c.out}?|Which study better supports a cause-and-effect claim about ${c.tr}?]]`),
        correct: `Study ${first}, because its participants were randomly assigned.`,
        wrongs: [W2(`Study ${second}, because it included more participants.`, "condition_ignored", "참가자 수가 많으면 인과 근거가 강하다고 착각했다."), W2(`Both studies equally, because the users had a better average in both.`, "condition_ignored", "차이의 방향만 보고 설계 차이를 무시했다."), W2(`Neither study, because a cause-and-effect claim can never be supported.`, "relation_distortion", "무작위 배정 실험은 인과 근거가 된다.")],
        jsBody: `const ms=[...P.stimulus.matchAll(/Study ([AB])[^.]*\\./g)].map(m=>[m[1],m[0]]); const ra=ms.filter(([l,s])=>/randomly assigned|random number generator|coin flip/.test(s)).map(([l])=>l); if(ra.length!==1) throw new Error('무작위 배정 연구가 하나가 아님');\nconst hits=P.options.map((o,i)=>o.startsWith('Study '+ra[0]+', because its participants were randomly assigned')?i:-1).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [[`연구 ${first} 는 참가자를 무작위로 배정한 실험이다.`, "Study with random assignment."], [`연구 ${second} 는 참가자가 스스로 선택한 관찰 연구이다.`, "Observational study."], ["무작위 배정은 집단을 비슷하게 만들어 처치의 효과를 분리한다.", "Random assignment isolates the effect."], ["참가자 수가 많아도 선택에 의한 편향은 사라지지 않는다.", "Size does not remove selection bias."], [`따라서 인과 근거는 연구 ${first} 가 더 강하다.`, "Pick the experiment."]], variant: "experiment_vs_observational" }), [{ noun: `Study ${first}`, value: nExp }]);
    },
  },
  // ───────── conclusion_scope ─────────
  {
    id: "esc.conclusion_scope.repr_shift", skill: SKILL, kind: "conclusion_scope", operator: "repr_shift",
    structure: "명단에서 무작위로 표본을 뽑고 그 표본을 다시 무작위로 배정한 실험에서 인과 결론의 적용 범위를 표집 틀로 한정",
    extraThinking: "두 개의 무작위(표집·배정) 서술을 각각 번역해 인과 결론은 가능하지만 적용 범위는 표집 틀까지임을 결합 — medium 은 두 특징이 모두 있거나 모두 없는 조합",
    concepts: ["무작위 표집", "무작위 배정", "결론의 적용 범위"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const n = rng.int(60, 400);
      const stimulus = ctx(rng) + rng.pick([`Researchers obtained a list of ${c.F}, selected ${n} ${c.ent} at random from the list, and then randomly assigned each selected person to use ${c.tr} or not. The group that used ${c.tr} had a better average ${c.out}.`, `Researchers obtained a list of ${c.F}, selected ${n} ${c.ent} at random from the list, and used a coin flip to decide which of them would use ${c.tr}. Users of ${c.tr} had a better average ${c.out}.`, `A team obtained a list of ${c.F}, selected ${n} ${c.ent} at random from the list, and then randomly assigned each one either to use ${c.tr} or to skip it; the users ended up with a better average ${c.out}.`, `Researchers obtained a list of ${c.F}, selected ${n} ${c.ent} at random from the list, and drew names from a hat to choose who would use ${c.tr}. The users had a better average ${c.out} than the others.`]);
      return withBind(finishQ(rng, { stimulus, question: spin(rng, `[[Which conclusion is best supported by the design of the study?|Based on the design, which of the following is an appropriate conclusion?]]`),
        correct: `A cause-and-effect relationship can be concluded for all ${c.F}, but not necessarily for all ${c.T}.`,
        wrongs: [W2(`A cause-and-effect relationship can be concluded for all ${c.T}.`, "scope", "표집 틀 밖의 집단까지 확장했다."), W2(`A cause-and-effect relationship can be concluded only for the ${n} ${c.ent} in the study.`, "scope", "무작위 표집이라는 점을 무시하고 표본에만 한정했다."), W2(`Only an association can be concluded for all ${c.F}.`, "relation_distortion", "무작위 배정으로 인과를 말할 수 있다.")],
        jsBody: `${ASSIGN_JS}\nif(!rndAssign||!/at random from the list/.test(P.stimulus)) throw new Error('두 무작위가 아님');\nconst m=P.stimulus.match(/obtained a list of (.+?), selected/); if(!m) throw new Error('표집 틀 없음');\nconst hits=P.options.map((o,i)=>o.startsWith('A cause-and-effect relationship can be concluded for all '+m[1]+', but not necessarily')?i:-1).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["표본을 명단에서 무작위로 뽑았으므로 결과는 그 명단(표집 틀)에 일반화할 수 있다.", "Random sampling from a list generalizes to the list."], [`표본을 처치군·비교군으로 무작위 배정했으므로 인과 결론이 가능하다.`, "Random assignment supports a causal conclusion."], [`그러나 표집 틀(${c.F})이 목표 모집단(${c.T})의 일부이므로 적용 범위는 그 틀까지이다.`, "The frame limits the scope."], ["인과 결론과 적용 범위를 함께 만족하는 선지를 고른다.", "Combine cause and scope."], ["표본에만 한정하거나 전체로 확장하는 선지를 제거한다.", "Eliminate both over- and under-reaching options."]], variant: "random_sample_random_assignment_frame" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.conclusion_scope.constraint_select", skill: SKILL, kind: "conclusion_scope", operator: "constraint_select",
    structure: "명단에서 무작위로 표본을 뽑았지만 참가자가 스스로 처치를 선택한 연구에서 연관 결론의 적용 범위를 표집 틀로 한정",
    extraThinking: "무작위 표집(범위: 표집 틀)과 비무작위 배정(결론: 연관만)을 각각 판단해 '연관만, 표집 틀까지' 라는 제약 결합을 고름 — medium 은 조합 판별만",
    concepts: ["무작위 표집", "비무작위 배정", "연관의 적용 범위"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const n = rng.int(60, 400);
      const stimulus = ctx(rng) + rng.pick([`Researchers obtained a list of ${c.F}, selected ${n} ${c.ent} at random from the list, and asked each whether they used ${c.tr}. Each person had chosen for themselves whether to use it, and the users had a better average ${c.out}.`, `A team obtained a list of ${c.F}, selected ${n} ${c.ent} at random from the list, and recorded who used ${c.tr}. People had chosen for themselves whether to use it; the users reported a better average ${c.out}.`, `Researchers obtained a list of ${c.F}, selected ${n} ${c.ent} at random from the list, and compared users of ${c.tr} with non-users. Everyone had chosen on their own, and users had a better average ${c.out}.`, `Researchers obtained a list of ${c.F}, selected ${n} ${c.ent} at random from the list, and surveyed them about ${c.tr}. Each person decided for themselves whether to use it and, on average, the users had a better ${c.out}. Everyone in the sample had chosen for themselves.`]);
      return withBind(finishQ(rng, { stimulus, question: spin(rng, `[[Which conclusion is best supported by the design of the study?|Based on the design, which of the following is an appropriate conclusion?]]`),
        correct: `Only an association can be concluded, and it applies to all ${c.F} but not necessarily to all ${c.T}.`,
        wrongs: [W2(`A cause-and-effect relationship can be concluded for all ${c.F}.`, "relation_distortion", "참가자가 스스로 선택했으므로 인과를 결론낼 수 없다."), W2(`Only an association can be concluded, and it applies only to the ${n} ${c.ent} in the study.`, "scope", "무작위 표집이라는 점을 무시하고 표본에만 한정했다."), W2(`Only an association can be concluded, and it applies to all ${c.T}.`, "scope", "표집 틀 밖의 집단까지 확장했다.")],
        jsBody: `${ASSIGN_JS}\nif(rndAssign||!/chosen for themselves|chose/.test(P.stimulus)||!/at random from the list/.test(P.stimulus)) throw new Error('설계가 이 원형과 다름');\nconst m=P.stimulus.match(/obtained a list of (.+?), selected/); if(!m) throw new Error('표집 틀 없음');\nconst hits=P.options.map((o,i)=>o.startsWith('Only an association can be concluded, and it applies to all '+m[1]+' but not necessarily')?i:-1).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["표본을 명단에서 무작위로 뽑았으므로 결과는 표집 틀(명단)에 일반화할 수 있다.", "Random sampling generalizes to the frame."], ["그러나 참가자가 스스로 선택했으므로 무작위 배정이 아니다.", "No random assignment."], ["따라서 인과가 아니라 연관만 결론낼 수 있다.", "Only an association."], [`적용 범위는 ${c.F} 까지이고 ${c.T} 전체는 보장되지 않는다.`, "Scope is the frame."], ["연관만·표집 틀까지를 동시에 만족하는 선지를 고른다.", "Pick the option that satisfies both."]], variant: "random_sample_self_selected_frame" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.conclusion_scope.compare_scenarios", skill: SKILL, kind: "conclusion_scope", operator: "compare_scenarios",
    structure: "한 연구는 무작위 표집만, 다른 연구는 자원자 무작위 배정만 갖췄을 때 각 연구가 뒷받침하는 결론의 종류를 연결",
    extraThinking: "두 연구의 설계 결함이 서로 반대(표집만 vs 배정만)임을 파악해 각 연구가 뒷받침하는 결론(일반화 vs 인과)을 짝지음 — medium 은 한 연구의 조합 판별",
    concepts: ["무작위 표집", "무작위 배정", "두 연구의 결론 짝짓기"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const first = rng.chance(0.5) ? "A" : "B"; const second = first === "A" ? "B" : "A"; const n1 = rng.int(200, 700), n2 = rng.int(40, 150);
      const sS = rng.pick([`Study ${first} randomly selected ${n1} ${c.ent} from all ${c.T}; each chose for themselves whether to use ${c.tr}, and the users had a better average ${c.out}.`, `In Study ${first}, ${n1} ${c.ent} were randomly selected from all ${c.T}, and each chose for themselves whether to use ${c.tr}; the users had a better average ${c.out}.`, `Study ${first} randomly selected ${n1} ${c.ent} out of all ${c.T}; people chose for themselves whether to use ${c.tr}, and users had a better average ${c.out}.`]);
      const sV = rng.pick([`Study ${second} used ${n2} volunteer ${c.ent}, who were randomly assigned to use ${c.tr} or not, and the users had a better average ${c.out}.`, `In Study ${second}, ${n2} volunteer ${c.ent} were randomly assigned to use ${c.tr} or not; the users had a better average ${c.out}.`, `Study ${second} recruited ${n2} volunteer ${c.ent} and randomly assigned them to use ${c.tr} or not, and users had a better average ${c.out}.`]);
      const parts = first === "A" ? [sS, sV] : [sV, sS];
      return withBind(finishQ(rng, { stimulus: ctx(rng) + `Two studies examined ${c.tr} and ${c.out}. ` + parts.join(" "), question: spin(rng, `[[Which statement best matches what each study can support?|Which of the following correctly describes the conclusions that the two studies can support?]]`),
        correct: `Study ${first} supports a generalization to all ${c.T}, and Study ${second} supports a cause-and-effect conclusion for its volunteers.`,
        wrongs: [W2(`Study ${first} supports a cause-and-effect conclusion for all ${c.T}.`, "scope", "표본은 무작위지만 배정이 무작위가 아니므로 인과를 말할 수 없다."), W2(`Study ${second} supports a generalization to all ${c.T}.`, "scope", "자원자 표본은 전체 모집단으로 일반화할 수 없다."), W2(`Both studies support cause-and-effect conclusions for all ${c.T}.`, "scope", "두 연구 모두 인과와 일반화를 동시에 갖추지 못했다.")],
        jsBody: `const ms=[...P.stimulus.matchAll(/Study ([AB])[^.]*\\./g)].map(m=>[m[1],m[0]]); const sampler=ms.filter(([l,s])=>/randomly selected/.test(s)&&/chose for themselves/.test(s)).map(([l])=>l); const assigner=ms.filter(([l,s])=>/volunteer/.test(s)&&/randomly assigned/.test(s)).map(([l])=>l); if(sampler.length!==1||assigner.length!==1) throw new Error('설계가 이 원형과 다름');\nconst hits=P.options.map((o,i)=>o.startsWith('Study '+sampler[0]+' supports a generalization to all') && o.includes('Study '+assigner[0]+' supports a cause-and-effect conclusion for its volunteers')?i:-1).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [[`연구 ${first}: 무작위 표집은 있으나 참가자가 스스로 선택했다(무작위 배정 없음).`, "Study with random sampling only."], [`연구 ${second}: 자원자(무작위 표집 아님)를 무작위로 배정했다.`, "Study with random assignment only."], [`연구 ${first} 는 모집단 일반화를 뒷받침하지만 인과는 뒷받침하지 못한다.`, "Generalization but no causation."], [`연구 ${second} 는 자원자에 대한 인과를 뒷받침하지만 모집단 일반화는 못 한다.`, "Causation but no generalization."], ["두 연구의 결론을 올바르게 짝지은 선지를 고른다.", "Pick the matching pair."]], variant: "sampling_only_vs_assignment_only" }), [{ noun: `Study ${first}`, value: n1 }]);
    },
  },
];
function facts2(rng: Rng, a: string, b: string): string { void rng; return `${a} ${b}`; }

// ───────── easy / medium (정성형) ─────────
export const ESC_LEVELS: LArch[] = [
  {
    id: "esc.generalizability.easy_method", skill: SKILL, kind: "generalizability", operator: "repr_shift", level: "easy", qualitative: true,
    structure: "표본이 무작위로 뽑혔는지 자원자인지만 구분해 일반화 가능성을 판단", extraThinking: "easy: 무작위 여부 한 가지만 판단", concepts: ["무작위 표집", "일반화"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const rnd = rng.chance(0.5); const n = rng.int(30, 300);
      const m = rnd ? rng.pick([`The researchers chose ${n} ${c.ent} at random from a complete list of all ${c.T}.`, `A random sample of ${n} ${c.ent} was drawn from all ${c.T}.`, `${n} ${c.ent} were selected at random from the full list of all ${c.T}.`]) : rng.pick([`The researchers surveyed ${n} ${c.ent} who volunteered after seeing a flyer.`, `${n} ${c.ent} who chose to answer an online poll were surveyed.`, `The researchers surveyed the first ${n} ${c.ent} they met on one afternoon.`]);
      return withBind(finishQ(rng, { stimulus: ctx(rng) + `A study asked about ${c.topic} among all ${c.T}. ${m}`, question: spin(rng, `[[Can the result be generalized to all ${c.T}?|Which statement is correct about generalizing the result to all ${c.T}?]]`),
        correct: rnd ? `Yes, because the sample was selected at random.` : `No, because the sample was not selected at random.`,
        wrongs: rnd ? [W2(`No, because the sample was selected at random.`, "opposite", "무작위 표본을 비무작위로 읽었다."), W2(`No, because a sample can never represent a population.`, "relation_distortion", "무작위 표본은 대표성이 있다."), W2(`Yes, because every study can be generalized.`, "relation_distortion", "표집 방법이 일반화의 근거이다.")] : [W2(`Yes, because the sample was selected at random.`, "opposite", "비무작위 표본을 무작위로 읽었다."), W2(`Yes, because every study can be generalized.`, "relation_distortion", "표집 방법이 일반화의 근거이다."), W2(`No, because a sample can never represent a population.`, "relation_distortion", "무작위 표본은 대표성이 있다.")],
        jsBody: `const rnd=/at random|random sample/.test(P.stimulus);\nconst hits=P.options.map((o,i)=> rnd ? (o.startsWith('Yes, because the sample was selected at random')?i:-1) : (o.startsWith('No, because the sample was not selected at random')?i:-1)).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["표본을 어떻게 뽑았는지 확인한다.", "Check how the sample was chosen."], [rnd ? "무작위로 뽑았으므로 모집단을 대표한다." : "자원자·편의 표집이므로 대표성이 없다.", "Judge representativeness."], ["그 판단에 맞는 선지를 고른다.", "Pick the matching option."]], variant: rnd ? "random_yes" : "volunteer_no" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.cause_vs_association.easy_assignment", skill: SKILL, kind: "cause_vs_association", operator: "repr_shift", level: "easy", qualitative: true,
    structure: "처치 집단 배정이 무작위인지 선택인지만 구분해 인과 결론 가능성을 판단", extraThinking: "easy: 무작위 배정 여부 한 가지만 판단", concepts: ["무작위 배정", "인과"], mediumSteps: 2,
    generate(rng) {
      const c = cx(rng); const rnd = rng.chance(0.5); const assign = rnd ? assignRandom(c)(rng) : assignChoice(c)(rng); const n = rng.int(40, 300);
      return withBind(finishQ(rng, { stimulus: ctx(rng) + `A study of ${n} ${c.ent} compared ${c.out} for those who used ${c.tr} and those who did not. ${assign} The users had a better average ${c.out}.`, question: spin(rng, `[[Can the researchers conclude that ${c.tr} caused the difference?|Is a cause-and-effect conclusion about ${c.tr} appropriate?]]`),
        correct: rnd ? `Yes, because participants were randomly assigned.` : `No, because participants were not randomly assigned.`,
        wrongs: rnd ? [W2(`No, because participants were randomly assigned.`, "opposite", "무작위 배정을 비무작위로 읽었다."), W2(`No, because a study can never show cause.`, "relation_distortion", "무작위 배정 실험은 인과를 보여줄 수 있다."), W2(`Yes, because the users had a better average.`, "condition_ignored", "차이의 방향만으로 인과를 결론내렸다.")] : [W2(`Yes, because participants were not randomly assigned.`, "opposite", "비무작위 배정을 인과의 근거로 착각했다."), W2(`Yes, because the users had a better average.`, "condition_ignored", "차이의 방향만으로 인과를 결론내렸다."), W2(`No, because a study can never show cause.`, "relation_distortion", "무작위 배정 실험은 인과를 보여줄 수 있다.")],
        jsBody: `${ASSIGN_JS}\nconst hits=P.options.map((o,i)=> rndAssign ? (o.startsWith('Yes, because participants were randomly assigned')?i:-1) : (o.startsWith('No, because participants were not randomly assigned')?i:-1)).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["집단 배정 방식을 확인한다.", "Check the assignment."], [rnd ? "무작위 배정이므로 집단이 비슷하다." : "스스로 선택했으므로 집단이 처음부터 다르다.", "Judge comparability."], ["그 판단에 맞는 선지를 고른다.", "Pick the matching option."]], variant: rnd ? "random_assignment_yes" : "self_chosen_no" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.conclusion_scope.med_four_combo", skill: SKILL, kind: "conclusion_scope", operator: "compose_kind", level: "medium", qualitative: true,
    structure: "무작위 표집·무작위 배정의 네 조합에서 가능한 결론을 고른다", extraThinking: "medium: 두 특징을 각각 판별해 결론 두 가지(인과·일반화)를 결합", concepts: ["무작위 표집", "무작위 배정", "결론의 범위"], mediumSteps: 3,
    generate(rng) {
      const c = cx(rng); const rs = rng.chance(0.5), ra = rng.chance(0.5); const n = rng.int(60, 400);
      const samp = rs ? rng.pick([`The ${n} participants were randomly selected from all ${c.T}.`, `A random sample of ${n} ${c.ent} was drawn from all ${c.T}.`]) : rng.pick([`The ${n} participants were volunteers who answered a flyer.`, `The ${n} participants were ${c.ent} who happened to be nearby.`]);
      const assign = ra ? assignRandom(c)(rng) : assignChoice(c)(rng);
      const cs = (cause: boolean, gen: boolean) => `${cause ? "A cause-and-effect relationship can be concluded" : "Only an association can be concluded"}, ${gen ? `and it can be generalized to all ${c.T}.` : "but only for the participants in the study.".replace("but", "and it holds").replace("and it holds only for", "and it holds only for")}`;
      const opt = (cause: boolean, gen: boolean) => (cause ? "A cause-and-effect relationship can be concluded" : "Only an association can be concluded") + (gen ? `, and it can be generalized to all ${c.T}.` : ", and it holds only for the participants in the study.");
      void cs;
      return withBind(finishQ(rng, { stimulus: ctx(rng) + `A study examined ${c.tr} and ${c.out}. ${samp} ${assign} The group that used ${c.tr} had a better average ${c.out}.`, question: spin(rng, `[[Based on the design of the study, which conclusion is appropriate?|Which of the following is an appropriate conclusion from the design of this study?]]`),
        correct: opt(ra, rs), wrongs: ([[true, true], [true, false], [false, true], [false, false]] as [boolean, boolean][]).filter(([a, b]) => !(a === ra && b === rs)).map(([a, b]) => W2(opt(a, b), "scope", "무작위 표집·무작위 배정 조합을 잘못 판단했다.")),
        jsBody: `${ASSIGN_JS}\nconst rs=/randomly selected|random sample/.test(P.stimulus);\nconst want=(rndAssign?'A cause-and-effect relationship can be concluded':'Only an association can be concluded')+(rs?', and it can be generalized':', and it holds only');\nconst hits=P.options.map((o,i)=>o.startsWith(want)?i:-1).filter(i=>i>=0);\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["표본을 무작위로 뽑았는지 확인한다.", "Check random sampling."], ["집단을 무작위로 배정했는지 확인한다.", "Check random assignment."], [ra ? "무작위 배정이면 인과를 말할 수 있다." : "무작위 배정이 아니면 연관만 말할 수 있다.", "Cause or association."], [rs ? "무작위 표집이면 모집단에 일반화할 수 있다." : "무작위 표집이 아니면 참가자에게만 적용된다.", "Scope."]], variant: `${ra ? "ra" : "nra"}_${rs ? "rs" : "nrs"}` }), [{ noun: ["participants", c.ent], value: n }]);
    },
  },
  {
    id: "esc.cause_vs_association.med_design_fix", skill: SKILL, kind: "cause_vs_association", operator: "inverse", level: "medium", qualitative: true,
    structure: "인과 결론을 내리려면 연구 설계를 어떻게 바꿔야 하는지(무작위 배정 도입)를 고른다", extraThinking: "medium: 결론을 막는 설계 결함을 찾아 수정 방향 선택", concepts: ["무작위 배정", "연구 설계 개선"], mediumSteps: 3,
    generate(rng) {
      const c = cx(rng); const n = rng.int(60, 400);
      return withBind(finishQ(rng, { stimulus: ctx(rng) + rng.pick([`Researchers surveyed ${n} ${c.ent} and found that those who used ${c.tr} had a better average ${c.out}. Each person had chosen for themselves whether to use ${c.tr}.`, `A team compared ${n} ${c.ent}: the users of ${c.tr} had a better average ${c.out}. Everyone had chosen for themselves whether to use ${c.tr}.`, `Among ${n} ${c.ent}, users of ${c.tr} reported a better average ${c.out}, and each person had chosen for themselves whether to use ${c.tr}. The researchers want to make a causal claim.`]), question: spin(rng, `[[Which change to the study would best allow the researchers to conclude that ${c.tr} causes the difference?|To support a cause-and-effect claim about ${c.tr}, what should the researchers change?]]`),
        correct: `Randomly assign participants to use ${c.tr} or not.`,
        wrongs: [W2(`Survey more ${c.ent} who chose to use ${c.tr}.`, "condition_ignored", "더 많은 자기선택 참가자는 설계 문제를 고치지 못한다."), W2(`Ask the participants to estimate their ${c.out} more carefully.`, "irrelevant", "측정의 정확도는 배정 문제와 무관하다."), W2(`Select the participants at random from all ${c.T}.`, "scope", "무작위 표집은 일반화를 위한 것이고 인과를 위한 것이 아니다.")],
        jsBody: `const hits=P.options.map((o,i)=>/^Randomly assign participants/.test(o)?i:-1).filter(i=>i>=0); if(!/chosen for themselves/.test(P.stimulus)) throw new Error('자기선택 아님');\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["참가자가 스스로 선택했으므로 인과를 결론낼 수 없다.", "Self-selection blocks a causal conclusion."], ["인과를 말하려면 무작위 배정이 필요하다.", "Random assignment is required."], ["무작위 표집은 일반화를 위한 것이며 인과와는 별개이다.", "Random sampling is about generalization."]], variant: "fix_for_cause" }), [{ noun: c.ent, value: n }]);
    },
  },
  {
    id: "esc.generalizability.med_design_fix", skill: SKILL, kind: "generalizability", operator: "inverse", level: "medium", qualitative: true,
    structure: "결과를 모집단에 일반화하려면 표집 방법을 어떻게 바꿔야 하는지(무작위 표집 도입)를 고른다", extraThinking: "medium: 일반화를 막는 표집 결함을 찾아 수정 방향 선택", concepts: ["무작위 표집", "연구 설계 개선"], mediumSteps: 3,
    generate(rng) {
      const c = cx(rng); const n = rng.int(60, 400);
      return withBind(finishQ(rng, { stimulus: ctx(rng) + rng.pick([`A researcher surveyed ${n} ${c.ent} who volunteered after seeing a flyer about ${c.topic}. She wants to draw a conclusion about all ${c.T}.`, `For a study of ${c.topic}, ${n} ${c.ent} volunteered after reading a notice. The researcher hopes to say something about all ${c.T}.`, `A team collected answers about ${c.topic} from ${n} ${c.ent} who chose to respond to an invitation. They would like to generalize to all ${c.T}.`]), question: spin(rng, `[[Which change would best allow the researcher to generalize the result to all ${c.T}?|To generalize to all ${c.T}, what should the researcher change?]]`),
        correct: `Select the participants at random from all ${c.T}.`,
        wrongs: [W2(`Survey more volunteers who respond to the flyer.`, "condition_ignored", "자원자를 더 모아도 편향이 줄지 않는다."), W2(`Randomly assign the volunteers to two groups.`, "scope", "무작위 배정은 인과를 위한 것이고 일반화와는 별개이다."), W2(`Ask the volunteers more questions about ${c.topic}.`, "irrelevant", "질문 수는 표집 편향과 무관하다.")],
        jsBody: `const hits=P.options.map((o,i)=>/^Select the participants at random/.test(o)?i:-1).filter(i=>i>=0); if(!/volunteered|chose to respond/.test(P.stimulus)) throw new Error('자원자 아님');\nif(hits.length!==1) throw new Error('유일하지 않음'); return hits[0];`,
        trace: [["자원자 표본은 대표성이 보장되지 않아 일반화할 수 없다.", "Volunteers block generalization."], ["일반화하려면 모집단에서 무작위로 표본을 뽑아야 한다.", "Random sampling is required."], ["무작위 배정은 인과를 위한 것이며 일반화와는 별개이다.", "Random assignment is about causation."]], variant: "fix_for_generalization" }), [{ noun: c.ent, value: n }]);
    },
  },
];
export const ESC_ALL: LArch[] = [...ESC_HARD.map((a) => ({ ...asLevel(a), qualitative: true })), ...ESC_LEVELS];
