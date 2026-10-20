import type { ArchetypeSpec, FrqTemplateSpec, SkillRule, SubjectGuide, UnitScope } from "./types";
import microArchetypes from "./micro-archetypes.json";
import curriculum from "../../../data/ap/curriculum-2027/ap_microeconomics.json";

// AP Microeconomics(2027 시험, 6단원) 생성 가이드 설정 — 본문: docs/ap/microeconomics-groundwork.md. 수치·키·그래프 데이터는 Python 원형(scripts/ap-generation/archetypes/micro_p0_*.py)이 계산하고
// 정확 분수·규칙표 경로와 sympy·수치 시뮬레이션 경로로 이중 계산한다. 원형 목록(micro-archetypes.json)의 원천은 `registry.py guide-micro`. 단원·스킬 코드와 MC 단원 가중은 data/ap/curriculum-2027/ap_microeconomics.json(CED 전사).
// 근거: docs/ap/microeconomics-facts.md(CED V.1·AP Central 직접 대조). 달러 기호는 통화이므로 수식 구분자 규칙은 적용하지 않는다.

type Wt = { axis: string; code: string; section: string; min: number; max: number };
const weights = (curriculum as unknown as { weights: Wt[] }).weights;
const mcWeight = (u: string): [number, number] => { const w = weights.find((x) => x.axis === "unit" && x.code === u && x.section === "mc"); return w ? [w.min, w.max] : [0, 0]; };

const OUT_OF_SCOPE: Record<string, string[]> = {
  "1": ["utility functions or indifference curves (the marginal-utility-per-dollar rule is in scope)", "macroeconomic measures such as GDP or inflation"],
  "2": ["tax or subsidy incidence derived with calculus", "quotas analyzed with more than a supply-and-demand diagram"],
  "3": ["isoquant and isocost analysis", "cost functions given as calculus expressions that must be differentiated"],
  "4": ["mixed-strategy equilibria and repeated games", "kinked-demand oligopoly calculations", "Cournot or Bertrand equilibrium algebra"],
  "5": ["general-equilibrium effects across factor markets", "bilateral monopoly"],
  "6": ["Coase theorem bargaining calculations", "cost-benefit analysis with discounting"],
};
const units: UnitScope[] = (curriculum as unknown as { units: { code: string; title: string; topics: { code: string; title: string }[] }[] }).units.map((u) => ({
  unit: u.code, title: u.title, mcWeight: mcWeight(u.code), inScope: u.topics.map((t) => `${t.code} ${t.title}`), outOfScope: OUT_OF_SCOPE[u.code] ?? [],
}));

const sk = (code: string, name: string, mc: boolean, designRules: string[], banned: string[] = []): SkillRule => ({ code, name, mc, frq: true, designRules, banned });
const skills: SkillRule[] = [
  sk("1.A", "Describe economic concepts, principles, or models", true, ["fixed-sentence options: one definition or condition is correct and each wrong sentence confuses a near-miss concept"]),
  sk("1.B", "Identify a concept illustrated by an example", true, ["a short scenario or graph point maps to one named concept"]),
  sk("1.C", "Identify a concept using quantitative data or calculations", true, ["a short calculation (elasticity, opportunity cost, HHI, MRP) decides which concept applies"]),
  sk("1.D", "Describe similarities, differences, and limitations of models", true, ["compare market structures, systems, or cost concepts"]),
  sk("2.A", "Explain how an outcome occurs or what action to take", true, ["state the marginal rule or mechanism behind an outcome"]),
  sk("2.B", "Explain an outcome with multiple contributing variables", true, ["two forces (elasticity, entry, shifts) combine to give the outcome"]),
  sk("2.C", "Interpret an outcome using quantitative data or calculations", true, ["use a table or numbers to choose the optimal quantity, hire, or strategy"]),
  sk("3.A", "Determine the outcome of an economic situation", true, ["direction of price and quantity after a change; read a graph to determine the result"]),
  sk("3.B", "Determine effects of changes on other markets", true, ["a price or input change in one market shifts a related market"]),
  sk("3.C", "Determine effects of a change using quantitative data", true, ["compute the new equilibrium, surplus, tax effect, profit, or loss"], ["long arithmetic as the only difficulty"]),
  sk("4.A", "Draw an accurately labeled graph or visual", false, ["FRQ only: draw and label a market, cost, or monopoly graph on paper"]),
  sk("4.B", "Show a specific situation on a labeled graph", false, ["FRQ only: show a ceiling, a profit area, or a quantity on the graph"]),
  sk("4.C", "Show the effect of a change on a labeled graph", false, ["FRQ only: show a shift or a regulated outcome on the graph"]),
];

export const microGuide: SubjectGuide = {
  subject: "ap_microeconomics",
  guideDoc: "docs/ap/microeconomics-groundwork.md",
  examStructure: "2027: MC 60 questions/70 min with FIVE options (A-E), 66.65%; FRQ 3 questions/60 min including a 10-minute reading period, 33.35%: one long question (10 points) and two short questions (5 points each), 20 points. FRQ tasks: make assertions, explain, perform numerical analysis, and create graphs (graphs are 30-50 percent of FRQ points). Hybrid digital exam: questions in Bluebook, FRQ answers (including graphs) handwritten on paper. A four-function calculator is allowed on both sections; no official formula sheet is mentioned in the CED.",
  units,
  skills,
  archetypes: microArchetypes as ArchetypeSpec[],
  frqTemplates: [
    { id: "mif_long_pc_firm", template: "long_pc_firm", topic: "3.7", extraTopics: ["3.5", "3.6", "2.7"], skill: "4.A", calculator: "allowed", parts: "A side-by-side long-run graphs(3) / B profit-maximizing quantity and profit(2) / C short-run effect on graphs(2) / D long-run entry(2) / E long-run quantity(1)", points: 10, verifiedBy: ["table scan of profit by quantity versus the MC-at-most-price rule"] },
    { id: "mif_long_market_policy", template: "long_market_policy", topic: "2.8", extraTopics: ["2.6"], skill: "4.A", calculator: "allowed", parts: "A market graph(2) / B equilibrium quantity(1) / C price ceiling on graph(2) / D shortage calculation(2) / E welfare effects(2) / F nonbinding ceiling(1)", points: 10, verifiedBy: ["table intersection scan versus sympy solution"] },
    { id: "mif_long_monopoly", template: "long_monopoly", topic: "4.2", extraTopics: ["6.4"], skill: "4.A", calculator: "allowed", parts: "A D/MR/MC graph(2) / B quantity and price(2) / C profit(1) / D price cap on graph(2) / E inefficiency(2) / F loss under cap(1)", points: 10, verifiedBy: ["sympy derivative of profit versus grid search"] },
    { id: "mif_short_externality", template: "short_externality", topic: "6.2", extraTopics: [], skill: "4.A", calculator: "allowed", parts: "A graph with MSC(2) / B overproduction(1) / C corrective tax(1) / D subsidy effect(1)", points: 5, verifiedBy: ["analytic quantities versus a social-surplus search"] },
    { id: "mif_short_shutdown", template: "short_shutdown", topic: "3.6", extraTopics: ["3.4", "3.7"], skill: "2.C", calculator: "allowed", parts: "A profit-maximizing quantity(1) / B economic loss(1) / C produce or shut down(1) / D why operate with a loss(1) / E long-run exit(1)", points: 5, verifiedBy: ["profit argmax versus marginal cost at most price"] },
    { id: "mif_short_labor", template: "short_labor", topic: "5.3", extraTopics: ["5.2", "5.4"], skill: "2.C", calculator: "allowed", parts: "A MRP(1) / B workers hired(1) / C why not hire more(1) / D labor demand shift(1) / E monopsony(1)", points: 5, verifiedBy: ["MRP count versus profit argmax"] },
    { id: "mif_short_trade", template: "short_trade", topic: "1.4", extraTopics: ["1.3"], skill: "1.C", calculator: "allowed", parts: "A opportunity costs(2) / B comparative advantage(1) / C gains from trade(1) / D PPC(1)", points: 5, verifiedBy: ["output ratios versus reciprocal opportunity cost"] },
    { id: "mif_short_elasticity", template: "short_elasticity", topic: "2.3", extraTopics: ["2.5"], skill: "1.C", calculator: "allowed", parts: "A midpoint elasticity(2) / B classification(1) / C revenue effect(1) / D cross-price elasticity(1)", points: 5, verifiedBy: ["Fraction midpoint ratio versus sympy"] },
    { id: "mif_short_mc", template: "short_monopolistic_competition", topic: "4.4", extraTopics: [], skill: "4.A", calculator: "na", parts: "A short-run graph(2) / B profit shaded(1) / C long-run demand(1) / D price versus marginal cost(1)", points: 5, verifiedBy: ["sympy derivative of profit versus grid search"] },
  ] as FrqTemplateSpec[],
  notation: ["dollar amounts are written $12 or $12.50 as plain text (the dollar sign is currency, not a math delimiter)", "prices in dollars, quantities in units; percentages written as 5 percent or 5%", "graphs label the horizontal axis Quantity and the vertical axis Price (dollars) unless the stimulus says otherwise"],
  calculatorRules: ["a four-function calculator is enough; never make arithmetic the only demand", "numeric option values differ by at least 8 percent", "an interpretation or outcome item uses five fixed sentences: one correct and each wrong sentence encodes a distinct named misconception", "FIVE options per MC item"],
  stimulusTypes: [
    { kind: "graph", howGenerated: "Python builds supply and demand lines, cost curves (marginal and average), price lines, monopoly MR/MC, and externality curves from closed forms and labels key points with single letters", howVerified: "key values recomputed from the generating parameters by a second path; the figure gate checks curve labels and marker positions" },
    { kind: "table", howGenerated: "data tables computed by code (cost, product, marginal benefit and cost, schedules, shares)", howVerified: "exact-fraction recomputation of the answer and a brute-force search where an optimum is asked" },
    { kind: "payoff_matrix", howGenerated: "Python builds the 2x2 game from payoff patterns with a unique Nash equilibrium", howVerified: "an independent best-response enumeration (micro_checks.nash)" },
    { kind: "none", howGenerated: "scenario text with all values in the stem", howVerified: "rule table versus numeric simulation of a linear market" },
  ],
  difficultyAllowed: ["identify the governing model before computing", "read a graph or table before computing", "one comparative-statics step", "one calculation (midpoint, triangle area, MR = MC)", "combine two effects (for example demand and supply shifts)"],
  difficultyBanned: ["long or unrounded arithmetic", "ambiguous wording or unstated model assumptions", "macroeconomic content", "calculus derivations", "irrelevant context or extra reading load", "reproducing a College Board sample item scenario"],
  loadLimits: { mcSeconds: [40, 130], stemWordsMax: 120, mcOptions: 5, frqMinutes: 25, frqPoints: 10 },
  frqRubricPatterns: ["analytic rows worth one point each", "graph rows use checklists (labeled axes, curves, key points, directions of shifts)", "a numeric row carries the answer; setup earns credit only when a row says so", "explanation rows require a named mechanism and a link to the outcome"],
  frqAccepted: ["equivalent labels (P and Q or price and quantity)", "answers within rounding", "a different valid explanation using the same economic principle"],
  bannedTerms: [{ pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" }],
  validators: [
    { item: "mc", checks: ["five unique options; key index valid", "each wrong option has a named misconception", "numeric options at least 8 percent apart", "skill is one of 1.A-1.D 2.A-2.C 3.A-3.C (never 4.x)", "est_seconds 30-150"] },
    { item: "frq", checks: ["total points equal the type weight (long 10, short 5)", "rubric rows sum to each part's points", "dependent rows require an earlier row", "graph rows are checklists on paper"] },
  ],
  acceptExamples: [
    { title: "comparative statics with two shifts (3.A)", text: "Demand and supply both shift; the price effect is determinate and the quantity effect is not, and the key says so." },
    { title: "numeric optimum from a table (2.C)", text: "Marginal benefit and marginal cost per hour are tabulated and the key is the last hour whose benefit exceeds its cost." },
  ],
  rejectExamples: [
    { title: "plug-in only", text: "Calculate profit when price is $10, ATC is $8, and output is 5.", reason: "a one-step product with no model choice, table or graph reading" },
    { title: "macro content", text: "What happens to GDP when the price level rises?", reason: "macroeconomics is not in AP Microeconomics" },
  ],
};

export function microWordingRules(): string {
  const g = microGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Calculator and style rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}.`,
  ].join("\n");
}
