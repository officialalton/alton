import type { ArchetypeSpec, FrqTemplateSpec, SkillRule, SubjectGuide, UnitScope } from "./types";
import macroArchetypes from "./macro-archetypes.json";
import curriculum from "../../../data/ap/curriculum-2027/ap_macroeconomics.json";

// AP Macroeconomics(2027 시험, 6단원) 생성 가이드 설정 — 본문: docs/ap/macroeconomics-groundwork.md. 수치·키·그래프 데이터는 Python 원형(scripts/ap-generation/archetypes/macro_p0_*.py)이 계산하고
// 정확 분수·규칙표 경로와 sympy·수치 시뮬레이션 경로로 이중 계산한다. 원형 목록(macro-archetypes.json)의 원천은 `registry.py guide-macro`. 단원·스킬 코드와 MC 단원 가중은 data/ap/curriculum-2027/ap_macroeconomics.json(CED 전사).
// 근거: docs/ap/macroeconomics-facts.md(CED V.1·AP Central 직접 대조). 달러 기호는 통화이므로 수식 구분자 규칙은 적용하지 않는다.

type Wt = { axis: string; code: string; section: string; min: number; max: number };
const weights = (curriculum as unknown as { weights: Wt[] }).weights;
const mcWeight = (u: string): [number, number] => { const w = weights.find((x) => x.axis === "unit" && x.code === u && x.section === "mc"); return w ? [w.min, w.max] : [0, 0]; };

const OUT_OF_SCOPE: Record<string, string[]> = {
  "1": ["indifference curves, utility functions, or cost curves of a single firm", "market-structure analysis (monopoly, oligopoly) beyond supply and demand"],
  "2": ["methods of computing chain-weighted GDP", "calculus-based growth accounting"],
  "3": ["IS-LM or other models outside AD-AS", "Keynesian cross algebra beyond the simple spending and tax multipliers"],
  "4": ["bank balance sheets with more than reserves, loans, and deposits", "bond pricing formulas or yield-to-maturity calculations", "the reserve market graph (not drawn on the exam in this bank)"],
  "5": ["rational-expectations models", "dynamic debt-sustainability calculations", "Solow growth model algebra"],
  "6": ["purchasing-power-parity algebra", "forward and futures currency contracts", "multi-country trade models"],
};
const units: UnitScope[] = (curriculum as unknown as { units: { code: string; title: string; topics: { code: string; title: string }[] }[] }).units.map((u) => ({
  unit: u.code, title: u.title, mcWeight: mcWeight(u.code), inScope: u.topics.map((t) => `${t.code} ${t.title}`), outOfScope: OUT_OF_SCOPE[u.code] ?? [],
}));

const sk = (code: string, name: string, mc: boolean, designRules: string[], banned: string[] = []): SkillRule => ({ code, name, mc, frq: true, designRules, banned });
const skills: SkillRule[] = [
  sk("1.A", "Describe economic concepts, principles, or models", true, ["fixed-sentence options: one definition or condition is correct and each wrong sentence confuses a near-miss concept"]),
  sk("1.B", "Identify a concept illustrated by an example", true, ["a short scenario or graph point maps to one named concept"]),
  sk("1.C", "Identify a concept using quantitative data or calculations", true, ["a short calculation (GDP, unemployment rate, opportunity cost, balance of payments) decides which concept applies"]),
  sk("1.D", "Describe similarities, differences, and limitations of models", true, ["compare CPI with the GDP deflator, nominal with real values, or two markets"]),
  sk("2.A", "Explain how an outcome occurs or what action to take", true, ["state the mechanism or the policy action that produces an outcome"]),
  sk("2.B", "Explain an outcome with multiple contributing variables", true, ["two forces (fiscal and monetary policy, interest rates and exchange rates) combine to give the outcome"]),
  sk("2.C", "Interpret an outcome using quantitative data or calculations", true, ["use a table, rate, or index to interpret inflation, growth, or a real rate"]),
  sk("3.A", "Determine the outcome of an economic situation", true, ["direction of price level, real GDP, unemployment, interest rate, or exchange rate after a change; read a graph to determine the result"]),
  sk("3.B", "Determine effects of changes on other markets", true, ["a change in one market (loanable funds, currency) changes another (investment, net exports, AD)"]),
  sk("3.C", "Determine effects of a change using quantitative data", true, ["compute the multiplier effect, money creation, required reserves, or debt change"], ["long arithmetic as the only difficulty"]),
  sk("4.A", "Draw an accurately labeled graph or visual", false, ["FRQ only: draw and label an AD-AS, money market, loanable funds, foreign exchange, Phillips curve, or PPC graph on paper"]),
  sk("4.B", "Show a specific situation on a labeled graph", false, ["FRQ only: show an equilibrium, a gap, or a natural rate on the graph"]),
  sk("4.C", "Show the effect of a change on a labeled graph", false, ["FRQ only: show a shift of a curve and the new equilibrium on the graph"]),
];

export const macroGuide: SubjectGuide = {
  subject: "ap_macroeconomics",
  guideDoc: "docs/ap/macroeconomics-groundwork.md",
  examStructure: "2027: MC 60 questions/70 min with FIVE options (A-E), 66.65%; FRQ 3 questions/60 min including a 10-minute reading period, 33.35%: one long question (10 points) and two short questions (5 points each), 20 points. FRQ tasks: make assertions, explain, perform numerical analysis, and create graphs (graphs are 30-50 percent of FRQ points). Hybrid digital exam: questions in Bluebook, FRQ answers (including graphs) handwritten on paper. A four-function calculator is allowed on both sections; no official formula sheet is mentioned in the CED. Monetary policy is taught for economies with limited reserves (money supply and multiplier) and ample reserves (administered interest rates such as interest on reserves).",
  units,
  skills,
  archetypes: macroArchetypes as ArchetypeSpec[],
  frqTemplates: [
    { id: "maf_long_adas_policy", template: "long_adas_policy", topic: "3.5", extraTopics: ["3.7", "3.8", "3.2", "5.5"], skill: "4.A", calculator: "allowed", parts: "A AD-AS graph with Y1, PL1, YF(3) / B long-run adjustment(1) / C fiscal action(1) / D required spending change(1) / E AD2 and PL2 on the graph(2) / F real interest rate and crowding out(2)", points: 10, verifiedBy: ["exact fraction of the required spending change versus sympy; the gap recovered by multiplying by the multiplier"] },
    { id: "maf_long_open_economy", template: "long_open_economy", topic: "6.4", extraTopics: ["6.3", "6.5", "6.6", "4.6"], skill: "4.A", calculator: "allowed", parts: "A currency market graph(2) / B capital inflows(1) / C demand shift and ER2(2) / D exports(1) / E net exports in two years(2) / F real GDP(2)", points: 10, verifiedBy: ["net exports by exact subtraction versus sympy; exchange-rate direction from a linear currency-market simulation"] },
    { id: "maf_long_money_market", template: "long_money_market", topic: "4.6", extraTopics: ["4.5", "4.4", "4.1", "5.2", "3.6"], skill: "4.A", calculator: "allowed", parts: "A money market graph(2) / B open-market purchase on the graph(2) / C bond prices(1) / D real GDP(2) / E multiplier and maximum money supply change(2) / F Phillips curve movement(1)", points: 10, verifiedBy: ["exact fraction multiplier versus sympy; interest-rate direction from a vertical-supply money market simulation"] },
    { id: "maf_short_gdp_data", template: "short_gdp_data", topic: "2.6", extraTopics: ["2.4", "2.2", "2.5"], skill: "2.C", calculator: "allowed", parts: "A real GDP(1) / B inflation(1) / C per capita(1) / D lender(1) / E why real GDP(1)", points: 5, verifiedBy: ["exact fractions for real GDP and inflation versus sympy rationals"] },
    { id: "maf_short_ppc_trade", template: "short_ppc_trade", topic: "1.3", extraTopics: ["1.2"], skill: "1.C", calculator: "allowed", parts: "A opportunity cost(1) / B comparative advantage(1) / C PPC and shift(2) / D gains from trade(1)", points: 5, verifiedBy: ["exact ratios versus the reciprocal opportunity cost of the other good"] },
    { id: "maf_short_lf_crowding", template: "short_lf_crowding", topic: "5.5", extraTopics: ["4.7", "5.6"], skill: "4.C", calculator: "na", parts: "A loanable funds graph(1) / B demand shift(1) / C private investment(1) / D why(1) / E long-run growth(1)", points: 5, verifiedBy: ["loanable funds simulation: a demand shift raises the rate and lowers private funds"] },
    { id: "maf_short_money_banking", template: "short_money_banking", topic: "4.4", extraTopics: ["4.6"], skill: "3.C", calculator: "allowed", parts: "A required reserves(1) / B excess reserves(1) / C maximum money creation(1) / D why smaller(1) / E open-market action(1)", points: 5, verifiedBy: ["exact fractions versus sympy rationals"] },
    { id: "maf_short_phillips", template: "short_phillips", topic: "5.2", extraTopics: [], skill: "4.A", calculator: "na", parts: "A SRPC and LRPC graph(2) / B shift for higher expected inflation(1) / C long-run unemployment(1) / D why the SRPC shifts(1)", points: 5, verifiedBy: ["fixed Phillips-curve rule table consistent with the AD-AS rule table"] },
    { id: "maf_short_fiscal_multiplier", template: "short_fiscal_multiplier", topic: "3.2", extraTopics: ["3.8", "3.9"], skill: "3.C", calculator: "allowed", parts: "A spending multiplier(1) / B change in real GDP(1) / C tax cut versus purchases(1) / D why(1) / E automatic stabilizers(1)", points: 5, verifiedBy: ["exact fractions versus sympy rationals"] },
    { id: "maf_short_fx_trade", template: "short_fx_trade", topic: "6.4", extraTopics: ["6.3", "6.5", "6.6"], skill: "4.C", calculator: "na", parts: "A currency market graph(1) / B shift and ER2(1) / C depreciation(1) / D capital flows(1) / E net exports and real GDP(1)", points: 5, verifiedBy: ["exchange-rate direction from a linear currency-market simulation; net exports opposite to currency value"] },
  ] as FrqTemplateSpec[],
  notation: ["dollar amounts are written $12 or $12 billion as plain text (the dollar sign is currency, not a math delimiter)", "percentages written as 5 percent or 5%", "graphs label the horizontal axis Real GDP and the vertical axis Price level for AD-AS, and name the axes of every other market (nominal or real interest rate, exchange rate, inflation and unemployment rates)", "the effect of a monetary action on the money supply is stated only for an economy with limited reserves"],
  calculatorRules: ["a four-function calculator is enough; never make arithmetic the only demand", "numeric option values differ by at least 8 percent", "an interpretation or outcome item uses five fixed sentences or direction combinations: one correct and each wrong option encodes a distinct named misconception", "FIVE options per MC item"],
  stimulusTypes: [
    { kind: "graph", howGenerated: "Python builds AD, SRAS, LRAS, money market, loanable funds, foreign exchange, Phillips-curve, PPC, and time-series lines from closed forms and labels key points with single letters", howVerified: "equilibria recomputed from the generating parameters by exact fractions and sympy; the figure gate checks curve labels and marker positions" },
    { kind: "table", howGenerated: "data tables computed by code (national accounts, price indexes, bank balance sheets, trade data, opportunity-cost tables)", howVerified: "exact-fraction recomputation of the answer and a second algebraic path" },
    { kind: "none", howGenerated: "scenario text with all values in the stem", howVerified: "rule table versus numeric sign simulation of a linear two-curve model" },
  ],
  difficultyAllowed: ["identify the governing model before computing", "read a graph or table before computing", "one comparative-statics step", "one calculation (multiplier, inflation rate, money creation, exchange conversion)", "combine two effects (for example fiscal and monetary policy, or demand and supply shifts)"],
  difficultyBanned: ["long or unrounded arithmetic", "ambiguous wording or unstated model assumptions", "microeconomic content on firm cost curves and market structures", "calculus derivations", "irrelevant context or extra reading load", "reproducing a College Board sample item scenario"],
  loadLimits: { mcSeconds: [40, 130], stemWordsMax: 120, mcOptions: 5, frqMinutes: 25, frqPoints: 10 },
  frqRubricPatterns: ["analytic rows worth one point each", "graph rows use checklists (labeled axes, curves, key points, directions of shifts)", "a numeric row carries the answer; setup earns credit only when a row says so", "explanation rows require a named mechanism and a link to the outcome"],
  frqAccepted: ["equivalent labels (PL and price level, Y and real GDP)", "answers within rounding", "a different valid explanation using the same economic principle"],
  bannedTerms: [{ pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" }],
  validators: [
    { item: "mc", checks: ["five unique options; key index valid", "each wrong option has a named misconception", "numeric options at least 8 percent apart", "skill is one of 1.A-1.D 2.A-2.C 3.A-3.C (never 4.x)", "est_seconds 30-150"] },
    { item: "frq", checks: ["total points equal the type weight (long 10, short 5)", "rubric rows sum to each part's points", "dependent rows require an earlier row", "graph rows are checklists on paper"] },
  ],
  acceptExamples: [
    { title: "comparative statics with two policies (2.B)", text: "Fiscal and monetary policy both change; the output effect is determinate when both are expansionary and the interest-rate effect is indeterminate, and the key says so." },
    { title: "multiplier from a table (1.C, 3.C)", text: "The MPC is read from consumption and income data and the maximum change in real GDP follows from 1/(1 - MPC)." },
  ],
  rejectExamples: [
    { title: "plug-in only", text: "Calculate inflation when the CPI rises from 100 to 105.", reason: "a one-step quotient with no model choice, table or graph reading" },
    { title: "micro content", text: "What is the profit-maximizing quantity for a monopolist?", reason: "firm and market-structure analysis is not in AP Macroeconomics" },
  ],
};

export function macroWordingRules(): string {
  const g = macroGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Calculator and style rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}.`,
  ].join("\n");
}
