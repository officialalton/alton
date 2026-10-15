import type { ArchetypeSpec, FrqTemplateSpec, SkillRule, SubjectGuide, UnitScope } from "./types";
import psychArchetypes from "./psych-archetypes.json";
import curriculum from "../../../data/ap/curriculum-2027/ap_psychology.json";

// AP Psychology(CED effective Fall 2025, 5단원) 생성 가이드 설정 — 본문: docs/ap/psychology-groundwork.md. 개념 문항은 CED 필수 내용(EK)에서 사람이 쓴 고정 문장 변형이라 코드가 정답을 계산하지 못한다:
// 정답 보증은 결정적 게이트 + 키를 숨긴 독립 풀이(Opus) + 5기준 검토(Sonnet) + 두 번째 독립 모델 패널(Fable·Sonnet 맹검 풀이)이다. 연구 방법·기술통계(`ps_stat_*`)는 코드가 계산하고 이중 경로로 검증한다.
// 원형 목록(psych-archetypes.json)의 원천은 `registry.py guide-psych`. 단원·스킬 코드와 MC 단원 가중은 data/ap/curriculum-2027/ap_psychology.json(CED 전사). 근거: docs/ap/psychology-facts.md.

type Wt = { axis: string; code: string; section: string; min: number; max: number };
const weights = (curriculum as unknown as { weights: Wt[] }).weights;
const mcWeight = (u: string): [number, number] => { const w = weights.find((x) => x.axis === "unit" && x.code === u && x.section === "mc"); return w ? [w.min, w.max] : [0, 0]; };

/** CED 의 '제외 진술(Exclusion Statement)'과 5.4 의 범주 목록 밖 내용. 학생 문항은 이 밖에서만 묻는다. */
const OUT_OF_SCOPE: Record<string, string[]> = {
  "1": ["genotype, phenotype, DNA, chromosomes, dominant and recessive gene expression", "the sodium-potassium pump", "neurotransmitters other than dopamine, serotonin, norepinephrine, glutamate, GABA, endorphins, substance P, acetylcholine", "hormones other than adrenaline, leptin, ghrelin, melatonin, oxytocin", "glands of the endocrine system other than the pituitary gland", "the psychoanalytic theory of dreams", "sleep disorders other than insomnia, narcolepsy, REM sleep behavior disorder, sleep apnea, somnambulism"],
  "2": ["monocular depth cues other than relative clarity, relative size, texture gradient, linear perspective, interposition", "labeling or describing cognitive abilities and disabilities", "named theories of intelligence beyond the general-ability (g) versus multiple-abilities debate"],
  "3": ["stages of prenatal development (zygote, embryo, fetus)", "pragmatics of language", "the psychosexual stage theory of development", "delayed, trace, simultaneous, and backward conditioning", "expectancy theory"],
  "4": ["Maslow's hierarchy of needs", "the psychosexual stage theory", "specific names of theories of emotion", "unqualified claims from contested studies (Zimbardo-style prison findings, ego depletion, power posing)"],
  "5": ["disorders not listed in Topic 5.4 (the exam addresses only the listed disorder categories and examples)", "diagnosing real people: students identify concepts from symptom descriptions, never diagnose"],
};
const units: UnitScope[] = (curriculum as unknown as { units: { code: string; title: string; topics: { code: string; title: string }[] }[] }).units.map((u) => ({
  unit: u.code, title: u.title, mcWeight: mcWeight(u.code), inScope: u.topics.map((t) => `${t.code} ${t.title}`), outOfScope: OUT_OF_SCOPE[u.code] ?? [],
}));

const sk = (code: string, name: string, mc: boolean, frq: boolean, designRules: string[], banned: string[] = []): SkillRule => ({ code, name, mc, frq, designRules, banned });
const skills: SkillRule[] = [
  sk("1.A", "Apply psychological perspectives, theories, concepts, and research findings to a scenario", true, true, ["a short original scenario maps to exactly one named concept; each wrong option is a near-miss concept with a named confusion"]),
  sk("1.B", "Explain how cultural norms, expectations, and circumstances, as well as cognitive biases, apply to behavior and mental processes", true, true, ["the scenario shows a bias, norm, or cultural circumstance and the key names the concept or explains its effect"]),
  sk("2.A", "Determine the type of research design(s) used in a given study", true, true, ["experiment, correlational study, case study, naturalistic observation, survey, meta-analysis, cross-sectional, longitudinal: decidable from the procedure alone"]),
  sk("2.B", "Evaluate the appropriate use of research design elements in experimental methodology", true, true, ["independent, dependent, confounding variables, operational definitions, sampling, random assignment, control or placebo group, single- and double-blind procedures"]),
  sk("2.C", "Evaluate the appropriate use of research design elements in non-experimental methodologies", true, true, ["correlation versus causation (directionality and third variables), measurement type, survey wording and self-report bias, representation, replication and peer review"]),
  sk("2.D", "Evaluate whether a psychological research scenario followed appropriate ethical procedures", true, true, ["institutional review, informed consent or assent, protection from harm, confidentiality or anonymity, deception, debriefing"]),
  sk("3.A", "Identify psychology-related concepts in descriptions or representations of data", true, true, ["a table or figure shows a pattern that names a concept (variable, phase of conditioning, serial position)"]),
  sk("3.B", "Calculate and interpret measures of central tendency, variation, and percentile rank in a given data set", true, true, ["mean, median, mode, range, standard deviation comparison, percentile rank on a normal curve; hand-computable values, no calculator", "wrong options are the standard slips (mean for median, unsorted middle)"], ["long arithmetic as the only difficulty"]),
  sk("3.C", "Interpret quantitative or qualitative inferential data from a given table, graph, chart, figure, or diagram", true, true, ["correlation coefficients, effect size (small 0.2 or below, medium 0.3 to 0.7, large 0.8 or above), statistical significance, group comparisons"]),
  sk("4.A", "Propose a defensible claim", false, true, ["FRQ only: the EBQ claim part"]),
  sk("4.B", "Provide reasoning that is grounded in scientifically derived evidence to support, refute, or modify an established or provided claim, policy, or norm", false, true, ["FRQ only: generalizability, support or refutation of a hypothesis, cited evidence and its explanation"]),
];

export const psychGuide: SubjectGuide = {
  subject: "ap_psychology",
  guideDoc: "docs/ap/psychology-groundwork.md",
  examStructure: "2027 (CED effective Fall 2025): MC 75 questions/90 min with FOUR options (A-D), 66.7%, discrete and set-based questions across five units (15-25% each) and three practices (concept application about 65%, research methods and design about 25%, data interpretation about 10%); FRQ 2 questions/70 min, 33.3%: Question 1 Article Analysis (25 min including a 10-minute reading period, 7 points: method 1, operational definition 1, statistic interpretation 1, ethical guideline 1, generalizability 1, support or refutation 2) and Question 2 Evidence-Based (45 min including a 15-minute reading period, 7 points: claim 1, evidence 1 with a concept explanation 2, a second source 1 with a different concept 2). No calculator or reference sheet is listed in the CED.",
  units,
  skills,
  archetypes: psychArchetypes as unknown as ArchetypeSpec[],
  frqTemplates: [
    { id: "psf_aaq_retrieval", template: "aaq", topic: "2.6", extraTopics: ["2.4", "2.3"], skill: "2.A", calculator: "na", parts: "A method(1) / B operational definition(1) / C difference in means(1) / D ethical guideline(1) / E generalizability(1) / F supports or refutes(2)", points: 7, verifiedBy: ["every number in the answers is read from the study table or text"] },
    { id: "psf_aaq_sleep_mood", template: "aaq", topic: "1.5", extraTopics: ["1.5"], skill: "2.A", calculator: "na", parts: "A method(1) / B operational definition(1) / C correlation(1) / D ethical guideline(1) / E generalizability(1) / F supports or refutes(2)", points: 7, verifiedBy: ["every number in the answers is read from the study table or text"] },
    { id: "psf_aaq_compliance", template: "aaq", topic: "4.3", extraTopics: ["4.3", "2.D"], skill: "2.A", calculator: "na", parts: "A method(1) / B operational definition(1) / C difference in percentages(1) / D ethical guideline(1) / E generalizability(1) / F supports or refutes(2)", points: 7, verifiedBy: ["every number in the answers is read from the study table or text"] },
    { id: "psf_aaq_mindfulness", template: "aaq", topic: "5.1", extraTopics: ["5.5", "5.1"], skill: "2.A", calculator: "na", parts: "A method(1) / B operational definition(1) / C difference in means(1) / D ethical guideline(1) / E generalizability(1) / F supports or refutes(2)", points: 7, verifiedBy: ["every number in the answers is read from the study table or text"] },
    { id: "psf_ebq_phones", template: "ebq", topic: "2.1", extraTopics: ["2.4", "3.8", "5.1"], skill: "4.B", calculator: "na", parts: "A claim(1) / B evidence(1) / C explanation and concept(2) / D second source(1) / E explanation and different concept(2)", points: 7, verifiedBy: ["every number in the answers is read from the source text"] },
    { id: "psf_ebq_service", template: "ebq", topic: "4.6", extraTopics: ["4.3", "4.5", "4.2"], skill: "4.B", calculator: "na", parts: "A claim(1) / B evidence(1) / C explanation and concept(2) / D second source(1) / E explanation and different concept(2)", points: 7, verifiedBy: ["every number in the answers is read from the source text"] },
    { id: "psf_ebq_spacing", template: "ebq", topic: "2.4", extraTopics: ["2.6", "2.7"], skill: "4.B", calculator: "na", parts: "A claim(1) / B evidence(1) / C explanation and concept(2) / D second source(1) / E explanation and different concept(2)", points: 7, verifiedBy: ["every number in the answers is read from the source text"] },
    { id: "psf_ebq_team_bonus", template: "ebq", topic: "4.3", extraTopics: ["4.6", "5.1"], skill: "4.B", calculator: "na", parts: "A claim(1) / B evidence(1) / C explanation and concept(2) / D second source(1) / E explanation and different concept(2)", points: 7, verifiedBy: ["every number in the answers is read from the source text"] },
  ] as unknown as FrqTemplateSpec[],
  notation: ["student-facing text is US English", "options are short concept names or short parallel sentences", "the dollar sign is currency only (no math delimiters are used in this subject)", "people and studies in scenarios are fictional; real research is named only in one neutral line and never as an unqualified fact when findings are contested", "no calculator: statistics values are hand-computable"],
  calculatorRules: ["no calculator and no reference sheet are assumed", "FOUR options per MC item", "each wrong option names a distinct, plausible confusion with another listed concept", "never make a calculation the only demand"],
  stimulusTypes: [
    { kind: "table", howGenerated: "small data tables (group means, trials, raw scores) written or computed by code", howVerified: "descriptive statistics recomputed with the statistics module and numpy" },
    { kind: "stat_chart", howGenerated: "bar chart or scatterplot specifications rendered by the shared chart renderer", howVerified: "values are read from the specification; the figure gate checks labels and axes" },
    { kind: "none", howGenerated: "short original scenario or definition in the stem", howVerified: "blind solver and reviewer agree with the key; a second model panel agrees" },
  ],
  difficultyAllowed: ["apply one named concept to a scenario", "discriminate between two near-miss concepts", "decide the research design from the procedure", "read a table or figure and choose the supported conclusion", "evaluate an ethical or sampling feature of a study"],
  difficultyBanned: ["obscure terminology outside the CED required content", "ambiguous scenarios with two defensible concepts", "trick wording or double negatives", "unqualified claims from contested or non-replicated findings", "reproducing a College Board sample or released item"],
  loadLimits: { mcSeconds: [40, 130], stemWordsMax: 120, mcOptions: 4, frqMinutes: 45, frqPoints: 7 },
  frqRubricPatterns: ["one point per element, analytic rows", "F and the explanation parts have two ordered rows (the second requires the first)", "a row describes the meaning to credit, not a phrase", "common errors list what does not earn the point"],
  frqAccepted: ["equivalent wording of a correct concept", "a different valid concept from the course for the explanation parts", "any specific, relevant, correctly cited evidence from the sources"],
  bannedTerms: [{ pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" }, { pattern: "\\bZimbardo\\b|\\bStanford prison\\b", why: "contested studies are not used as factual premises" }],
  validators: [
    { item: "mc", checks: ["four unique options; key index valid", "each wrong option has a named misconception", "skill is one of 1.A 1.B 2.A-2.D 3.A-3.C (never 4.x)", "est_seconds 30-150", "set: three items, same unit, no item answer in another item's question"] },
    { item: "frq", checks: ["total points 7", "AAQ has parts A-F (1/1/1/1/1/2); EBQ has parts A-E (1/1/2/1/2)", "rubric rows sum to each part's points", "second rows require the first", "every number in an answer appears in the source or table"] },
  ],
  acceptExamples: [
    { title: "research design from a procedure (2.A)", text: "Volunteers are randomly assigned to study with music or in silence and their recall is measured; the key is an experiment and each wrong option is a design that lacks manipulation or random assignment." },
    { title: "concept in a scenario (1.A)", text: "A child who sees a new breed calls it a dog without changing her idea of a dog; the key is assimilation and the near-miss option is accommodation." },
  ],
  rejectExamples: [
    { title: "definition recall only", text: "What is the definition of a schema?", reason: "no scenario, no discrimination between near-miss concepts" },
    { title: "contested claim", text: "Which study proved that people obey authority in every culture?", reason: "treats a contested classic as unqualified fact" },
  ],
};

export function psychWordingRules(): string {
  const g = psychGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Style rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}.`,
  ].join("\n");
}
