import type { ArchetypeSpec, SkillRule, SubjectGuide } from "./types";
import statsArchetypes from "./stats-archetypes.json";

// AP Statistics(2027, 5단원) 생성 가이드 설정 — 본문: docs/ap/generation-guides/stats.md. 수치·키·표·출력 블록은 Python 원형(scripts/ap-generation/archetypes/stats_*.py)이 계산하고,
// 정규·t·카이제곱 값은 scipy 와 독립 수치 경로(math.erf·직접 수치 적분)로 이중 계산한다. 원형 목록(stats-archetypes.json)의 원천은 `registry.py guide-stats`.
// 근거: docs/ap/statistics-facts.md(CED 2027 검증 사실), docs/ap/statistics-groundwork.md.

const sk = (code: string, name: string, designRules: string[], banned: string[] = []): SkillRule => ({ code, name, mc: true, frq: true, designRules, banned });

export const statsGuide: SubjectGuide = {
  subject: "ap_statistics",
  guideDoc: "docs/ap/generation-guides/stats.md",
  examStructure: "2027: MC 42 questions/90 min (36 standalone + two 3-question sets: one on probability/random variables/distributions, one on regression), four options, 50%; FRQ 4 questions/90 min, 10 points each (ten 1-point rows), 50%; Q1 Practices 1-2, Q2 Practices 3-4, Q3 inference, Q4 Practices 2-4 across units. Graphing calculator with statistics functions allowed in both sections; formula sheet and tables provided. The investigative question is a skill (1.A, topic 1.10) assessed inside FRQ 1, not a separate question.",
  units: [
    { unit: "1", title: "Exploring One-Variable Data and Collecting Data", mcWeight: [20, 30], inScope: ["categorical and quantitative graphs and summaries", "center, spread, shape, outliers (1.5 IQR rule), z-scores, boxplots", "comparing distributions", "investigative questions", "random sampling and sampling problems, experimental design, confounding, causal conclusions"], outOfScope: ["probability rules (Unit 2)", "inference procedures (Units 3-4)", "regression (Unit 5)"] },
    { unit: "2", title: "Probability, Random Variables, and Probability Distributions", mcWeight: [15, 25], inScope: ["two-way tables, conditional probability, independence, mutually exclusive events", "simulation to estimate probabilities", "discrete random variables: mean and standard deviation", "binomial distribution", "normal distribution areas and percentiles", "sampling distributions and the Central Limit Theorem"], outOfScope: ["geometric distribution", "combining random variables beyond linear transformations", "inference methods (Units 3-4)"] },
    { unit: "3", title: "Inference for Categorical Data: Proportions", mcWeight: [15, 25], inScope: ["sampling distribution of a sample proportion and its conditions", "one-proportion z interval and test", "interpreting confidence intervals and p-values", "Type I and Type II errors, power direction", "two-proportion z interval and test", "chi-square test for homogeneity or independence"], outOfScope: ["chi-square goodness-of-fit", "t procedures (Unit 4)"] },
    { unit: "4", title: "Inference for Quantitative Data: Means", mcWeight: [10, 20], inScope: ["sampling distribution of a sample mean and of a difference of means", "one-sample and matched-pairs t interval and test", "two-sample t interval and test (unpooled)", "conditions: random, 10% condition, normality via sample size or graphs"], outOfScope: ["pooled two-sample t", "inference about a slope", "ANOVA"] },
    { unit: "5", title: "Regression Analysis", mcWeight: [10, 20], inScope: ["scatterplot description, correlation and its properties", "least-squares line, slope and intercept interpretation, prediction and extrapolation", "residuals and residual plots, influential points, r-squared", "computer regression output"], outOfScope: ["inference about a slope (t test or interval for the slope)", "nonlinear models and transformations"] },
  ],
  skills: [
    sk("1.A", "Determine a valid investigative question that requires a statistical investigation", ["the item distinguishes a question answerable by data collection and analysis from a non-statistical one"]),
    sk("2.A", "Identify information to answer a question or solve a problem", ["the student decides what data, variables or design is needed"]),
    sk("2.B", "Justify an appropriate method for ethically gathering and representing data", ["a design or sampling choice must be matched to the claim that can be made"]),
    sk("2.C", "Identify appropriate statistical inference methods", ["choose the procedure from a scenario (one/two samples, proportions vs means, paired vs independent)"], ["naming the procedure in the stem"]),
    sk("2.D", "Identify types of errors and relationships among components in statistical inference methods", ["errors, power, confidence level, sample size and margin of error relationships"]),
    sk("2.E", "Identify the null and alternative hypotheses", ["hypotheses are chosen from the scenario with a parameter in context"]),
    sk("3.A", "Construct tabular and graphical representations of data and distributions", ["the student reads or selects a representation that matches stated values"]),
    sk("3.B", "Calculate summary statistics, relative positions of points within a distribution, and predicted responses", ["a short calculation whose result is then compared or interpreted; never only a plug-in"], ["long arithmetic as the only difficulty"]),
    sk("3.C", "Calculate and estimate expected counts, percentages, probabilities, and intervals", ["probabilities from tables, trees, simulation or distributions with the setup/conditions part of the decision"]),
    sk("3.D", "Calculate means, standard deviations, and parameters for probability distributions", ["parameters of sampling distributions and random variables with the conditions that make them valid"]),
    sk("3.E", "Calculate appropriate statistical inference method results", ["a test statistic, p-value or interval followed by a decision or claim"]),
    sk("4.A", "Describe and compare tabular and graphical representations of data, as well as summary statistics", ["fixed-sentence options: one correct comparison and named misreadings"]),
    sk("4.B", "Justify a claim based on statistical calculations and results", ["the key is the claim that the stated results support"]),
    sk("4.C", "Describe distributions and compare relative positions of points within a distribution", ["shape, center, spread and relative position statements"]),
    sk("4.D", "Interpret statistical calculations and results to assess meaning or a claim", ["interpretation in context with units; options are fixed sentences encoding named misconceptions"]),
    sk("4.E", "Justify the use of a chosen statistical inference method by verifying conditions", ["exactly one condition is violated or verified by the given information (random, 10%, large counts, normality)"]),
    sk("4.F", "Interpret results of statistical inference methods", ["interpretation of an interval or p-value in context; options are fixed sentences"]),
    sk("4.G", "Justify a claim based on statistical inference method results", ["a conclusion at a stated significance level with the supporting values"]),
  ],
  archetypes: statsArchetypes as ArchetypeSpec[],
  frqTemplates: [
    { id: "stfrq_q1_design", template: "q1_multifocus", topic: "1.10", extraTopics: ["1.2", "1.7", "1.13"], skill: "1.A", calculator: "allowed", parts: "A variables(2) / B summary + 1.5 IQR(2) / C random assignment(2) / D causal claim(1) / E investigative question(3)", points: 10, verifiedBy: ["the outlier boundary is recomputed with exact fractions and the decision for the stated value is checked against both the fraction and the float rule"] },
    { id: "stfrq_q2_regression", template: "q2_regression", topic: "5.4", extraTopics: ["5.3", "5.5"], skill: "4.D", calculator: "allowed", parts: "A slope(2) / B prediction and residual(2) / C model appropriateness(3) / D r squared(2) / E extrapolation(1)", points: 10, verifiedBy: ["the coefficients are recomputed with numpy lstsq, and a quadratic fit to the residuals classifies the pattern, which must match the intended pattern"] },
    { id: "stfrq_q3_prop_test", template: "q3_inference", topic: "3.7", extraTopics: ["3.5", "3.6"], skill: "3.E", calculator: "allowed", parts: "A hypotheses(2) / B conditions(2) / C statistic and P-value(3) / D conclusion in context(3)", points: 10, verifiedBy: ["z and the P-value are recomputed with math.erf and the decision at alpha 0.05 is checked for a margin of at least 0.012"] },
    { id: "stfrq_q4_integrated", template: "q4_integrated", topic: "2.6", extraTopics: ["2.7", "2.10", "3.3"], skill: "3.C", calculator: "allowed", parts: "A conditional probability(2) / B independence(2) / C binomial(2) / D interval(2) / E interpretation(2)", points: 10, verifiedBy: ["probabilities are recomputed from expanded individual records, the binomial probability from scipy and the combinations formula, and z* by bisection"] },
    // 2026-10-19 추가 라운드(연습 시험 3): 새 틀의 FRQ 4종(블록 실험 · 컴퓨터 출력 회귀 · 쌍체 t 검정 · 정규·표본평균·t 구간 통합)
    { id: "stfrq_n3_q1_block", template: "q1_multifocus", topic: "1.10", extraTopics: ["1.7", "1.9", "1.13"], skill: "1.A", calculator: "allowed", parts: "A units and response(2) / B blocking and randomization(2) / C difference of means(1) / D compare center and spread(2) / E investigative question(3)", points: 10, verifiedBy: ["the difference of the means is recomputed with exact fractions and the ratio of the standard deviations is checked to exceed 1.5"] },
    { id: "stfrq_n3_q2_output", template: "q2_regression", topic: "5.4", extraTopics: ["5.2", "5.3"], skill: "4.D", calculator: "allowed", parts: "A equation and intercept(2) / B prediction and residual(2) / C meaning of S(2) / D correlation from R-squared(2) / E residual pattern(2)", points: 10, verifiedBy: ["the prediction and the residual are recomputed from the coefficients and r is recomputed from R-squared"] },
    { id: "stfrq_n3_q3_matched", template: "q3_inference", topic: "4.5", extraTopics: ["4.2", "4.4"], skill: "3.E", calculator: "allowed", parts: "A hypotheses(2) / B conditions on the differences(2) / C statistic and P-value(3) / D conclusion in context(3)", points: 10, verifiedBy: ["t and the P-value are recomputed with scipy and numerical integration of the t density and the decision is checked for a margin of at least 0.012"] },
    { id: "stfrq_n3_q4_clt", template: "q4_integrated", topic: "2.11", extraTopics: ["2.12", "4.1", "4.2", "4.3"], skill: "3.C", calculator: "allowed", parts: "A normal probability(2) / B sampling distribution of the mean(2) / C comparison and explanation(2) / D t interval(2) / E claim about a label(2)", points: 10, verifiedBy: ["normal probabilities are recomputed with math.erf and scipy and the t critical value by numerical integration of the t density"] },
  ],
  notation: ["every number, probability, statistic and symbol is wrapped in $...$ (stem, options and explanation)", "$\\hat{p}$, $\\bar{x}$, $s$, $\\sigma$, $H_0$, $H_a$, $\\mu$, $r^2$ style notation", "currency uses \\$ escaped", "conditional probability P(A | B) written $P(A\\mid B)$"],
  calculatorRules: ["a graphing calculator with statistics functions is allowed in both sections; the formula sheet and tables are provided on the real exam", "never make the calculation the only demand: every item also needs a procedure choice, condition check, interpretation or reading of a representation", "the stem states the rounding convention whenever options are decimals (three decimal places for probabilities and test statistics unless stated)", "option values differ by at least two units in the last printed digit so rounding cannot blur the key", "an interpretation item uses four fixed sentences: one correct statement and three named misinterpretations"],
  stimulusTypes: [
    { kind: "stat_chart", howGenerated: "Python builds histogram, dot plot, boxplot (with outlier dots), two-way table, tree, scatterplot (residual plot, highlighted point), normal/t curve with shading and a second axis, and computer-output blocks from the same numbers that decide the key", howVerified: "recomputed independently (exact fractions, math.erf, direct numerical integration of the pdf); figure gate checks consistency (sum of counts, probabilities sum to 1, boxplot values in order, curve area)" },
    { kind: "table", howGenerated: "summary statistics or counts computed by code", howVerified: "recomputed from the raw simulated data and cross-checked" },
    { kind: "none", howGenerated: "scenario text with all values in the stem", howVerified: "formula and scipy/numeric double path" },
  ],
  difficultyAllowed: ["choosing among procedures", "checking one condition", "an interpretation among named misinterpretations", "reading a representation or computer output", "one additional reasoning step linking a result to a claim"],
  difficultyBanned: ["long arithmetic or unrounded intermediate values", "ambiguous wording or unstated rounding", "irrelevant context or extra reading load", "deleted topics (geometric distribution, goodness-of-fit chi-square, inference for slope, nonlinear transformations, combining random variables)", "causal claims from observational data presented as correct", "tricking with notation"],
  loadLimits: { mcSeconds: [45, 130], stemWordsMax: 100, mcOptions: 4, frqMinutes: 22, frqPoints: 10 },
  frqRubricPatterns: ["ten 1-point rows split over parts (i)(ii)", "setup, conditions, calculation and conclusion-in-context rows", "an interpretation row requires context words and the population claim"],
  frqAccepted: ["answers within rounding of the stated convention", "equivalent wording of a correct interpretation in context"],
  bannedTerms: [
    { pattern: "\\bgeometric\\s+(distribution|random variable|probability)", why: "geometric distribution is removed from the 2027 course" },
    { pattern: "goodness[- ]of[- ]fit", why: "chi-square goodness-of-fit is removed from the 2027 course" },
    { pattern: "\\b(t[- ]?(test|interval|procedure)|confidence interval|hypothesis test|inference)\\W+(for|about|on)\\W+(the\\W+)?(population\\W+|true\\W+)?(regression\\W+)?slope", why: "inference for a slope is removed from the 2027 course" },
    { pattern: "\\b(log(arithm)?ic?|exponential|power)\\s+(model|transformation|regression)\\b|transform(ed|ing)?\\s+the\\s+(data|variables?)", why: "nonlinear regression/transformations are removed from the 2027 course" },
    { pattern: "\\b(sum|difference)\\s+of\\s+(two\\s+)?(independent\\s+)?random\\s+variables\\b", why: "combining random variables is removed from the 2027 course" },
    { pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" },
  ],
  validators: [
    { item: "mc", checks: ["four unique options; key index valid", "each wrong option has a named misconception", "decimal options only with a stated rounding convention and values at least two last-digit units apart", "math wrapped in $...$ (stem, options, explanation)", "judgment_demand present and not calculation-only", "figure referenced in the stem when a stat_chart stimulus exists", "est_seconds 45-130, stem <= 100 words", "deleted topics absent"] },
  ],
  acceptExamples: [
    { title: "interpretation with fixed sentences (4.F)", text: "A 95% interval for a proportion is given; four sentences: the correct interpretation of the confidence level in terms of the method and three named misinterpretations (probability for the fixed parameter, proportion of sample values, probability for the sample proportion)." },
    { title: "condition check (4.E)", text: "A scenario in which exactly one condition (large counts) fails; options name the condition." },
  ],
  rejectExamples: [
    { title: "calculation only", text: "Compute the z statistic for the following summary values.", reason: "calculator allowed: only a calculation with no decision or interpretation" },
    { title: "causal claim from an observational study", text: "Choose the conclusion that the new tutoring caused higher scores in a survey of volunteers.", reason: "observational data cannot justify causation" },
  ],
};

/** 문장 작성 호출용 지침(칼큘러스 지침 대신 통계 지침). */
export function statsWordingRules(): string {
  const g = statsGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Calculator and style rules: ${g.calculatorRules.join("; ")}.`,
    `TeX hygiene: wrap EVERY number with a symbol, statistic, probability or formula in $...$ in the stem; never leave raw LaTeX commands or ^ outside $...$.`,
    `Never use: ${g.difficultyBanned.join("; ")}. Deleted topics (geometric distribution, chi-square goodness-of-fit, inference for slope, nonlinear transformations, combining random variables) must not appear.`,
    `Conditions wording follows the CED: random sample or random assignment, the 10% condition (independence) when sampling without replacement, large counts for proportions, normality by sample size or graphs for means.`,
  ].join("\n");
}
export function statsReviewRules(unit: string): string {
  const u = statsGuide.units.find((x) => x.unit === unit);
  return u ? `UNIT ${u.unit} SCOPE for AP Statistics — in scope: ${u.inScope.join("; ")}. OUT of scope: ${u.outOfScope.join("; ")}. Difficulty levers allowed: ${statsGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${statsGuide.difficultyBanned.join("; ")}.` : "";
}
