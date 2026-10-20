import type { ArchetypeSpec, FrqTemplateSpec, SkillRule, SubjectGuide, UnitScope } from "./types";
import chemArchetypes from "./chem-archetypes.json";
import curriculum from "../../../data/ap/curriculum-2027/ap_chemistry.json";

// AP Chemistry(2027 시험, 9단원) 생성 가이드 설정 — 본문: docs/ap/chemistry-groundwork.md. 수치·키·그림 장면 모델은 Python 원형(scripts/ap-generation/archetypes/chem_p0_*.py)이 계산하고
// sympy/정확 분수 풀이와 numpy·이분법·ODE 수치 경로로 이중 계산한다. 원형 목록(chem-archetypes.json)의 원천은 `registry.py guide-chem`. 단원·스킬 코드와 MC 단원 가중은 data/ap/curriculum-2027/ap_chemistry.json(CED 전사).
// 근거: docs/ap/chemistry-facts.md(CED·AP Central 직접 대조). 공식 식 시트 본문과 상수는 CED 부록 값(R, F, h, c, N_A, Kw)을 chem_common.CONSTS 한 곳에서 쓴다.

type Wt = { axis: string; code: string; section: string; min: number; max: number };
const weights = (curriculum as unknown as { weights: Wt[] }).weights;
const mcWeight = (u: string): [number, number] => { const w = weights.find((x) => x.axis === "unit" && x.code === u && x.section === "mc"); return w ? [w.min, w.max] : [0, 0]; };

const OUT_OF_SCOPE: Record<string, string[]> = {
  "1": ["quantum numbers beyond subshell labels", "relativistic or spin-orbit effects in photoelectron spectra"],
  "2": ["molecular orbital diagrams", "band theory of solids beyond metallic bonding as delocalized electrons"],
  "3": ["van der Waals constants as inputs to calculations", "colligative-property calculations (not a named learning objective)"],
  "4": ["organic reaction mechanisms", "balancing redox equations in acidic or basic solution by half-reaction method as a long multistep task"],
  "5": ["calculus-based rate derivations", "Arrhenius-equation calculations (the equation is not on the reference sheet)"],
  "6": ["calculus of heat capacity", "statistical derivation of entropy"],
  "7": ["activity coefficients", "equilibria involving more than two simultaneous coupled equilibria in one item"],
  "8": ["polyprotic titration curves with more than one equivalence point as a calculation", "activity corrections"],
  "9": ["Gibbs-Helmholtz derivations", "concentration cells with non-ideal solutions"],
};
const units: UnitScope[] = (curriculum as unknown as { units: { code: string; title: string; topics: { code: string; title: string }[] }[] }).units.map((u) => ({
  unit: u.code, title: u.title, mcWeight: mcWeight(u.code), inScope: u.topics.map((t) => `${t.code} ${t.title}`), outOfScope: OUT_OF_SCOPE[u.code] ?? [],
}));

const sk = (code: string, name: string, mc: boolean, designRules: string[], banned: string[] = []): SkillRule => ({ code, name, mc, frq: true, designRules, banned });
const skills: SkillRule[] = [
  sk("1.A", "Describe components of particulate-level models", true, ["read a particulate diagram, a photoelectron spectrum, a unit cell description or a Lewis-diagram count"]),
  sk("1.B", "Describe models showing particulate and macroscopic properties", true, ["link a particle arrangement to a macroscopic property"]),
  sk("2.A", "Identify a testable scientific question", true, ["fixed-sentence options: one question names a manipulated variable and a measurable outcome"]),
  sk("2.B", "Formulate a hypothesis or predict experiment results", true, ["predict a numerical factor or direction from a stated relationship"]),
  sk("2.C", "Identify procedures aligned to a scientific question", true, ["options list full procedures; exactly one measures every quantity the calculation needs"]),
  sk("2.D", "Make observations or collect data from lab representations", true, ["read buret readings, chromatography distances, or similar lab data"]),
  sk("2.E", "Identify sources of experimental error", true, ["error direction determined by recomputing the result with the altered value"]),
  sk("2.F", "Explain how changing a procedure alters results", true, ["compute the factor by which a measured quantity changes"]),
  sk("3.A", "Represent phenomena with graphs, scale and units", false, ["FRQ only: sketch or describe a graph"]),
  sk("3.B", "Represent substances or phenomena with diagrams or models", false, ["FRQ only: Lewis diagrams, cell diagrams"]),
  sk("3.C", "Relate structures and interactions across scales visually", false, ["FRQ only"]),
  sk("4.A", "Predict or explain properties using given models", true, ["periodic trends, VSEPR, bond polarity, Le Chatelier, entropy sign, acid strength"]),
  sk("4.B", "Explain whether a model is consistent with chemical theory", true, ["a mechanism, a Lewis diagram or a gas model is checked against data or counts"]),
  sk("4.C", "Connect particulate-level and macroscopic properties", true, ["conductivity, vapor pressure and viscosity linked to particles and forces"]),
  sk("4.D", "Explain how well a model links particulate and macroscopic properties", true, ["compare what a model predicts with measured data"]),
  sk("5.A", "Identify quantities needed to solve a problem", true, ["the measurement set is derived from the working equation"]),
  sk("5.B", "Choose a theory or relationship to solve a problem", true, ["choose which relationship to use before computing"]),
  sk("5.C", "Explain how variables relate in an equation", true, ["scaling prediction from a stated relationship"]),
  sk("5.D", "Use information presented graphically", true, ["read a graph, a table, or a spectrum before computing"]),
  sk("5.E", "Determine a balanced chemical equation", true, ["balance atoms and charge"]),
  sk("5.F", "Calculate an unknown from known quantities", true, ["a short calculation whose route requires choosing the right relationship or converting units; never only a plug-in"], ["long arithmetic as the only difficulty"]),
  sk("6.A", "Make a scientific claim", true, ["claim from a table of properties"]),
  sk("6.B", "Support a claim with experimental data", true, ["cite the sign and size of measured changes"]),
  sk("6.C", "Support a claim with particulate-level representations", true, ["name the type of intermolecular force"]),
  sk("6.D", "Justify a claim with chemical principles or math", true, ["fixed-sentence options with named misconceptions"]),
  sk("6.E", "Justify a claim connecting particulate and macroscopic scales", true, ["collision frequency and force explain macroscopic gas trends"]),
  sk("6.F", "Connect experimental results to chemical concepts", true, ["pH data connected to acid strength"]),
  sk("6.G", "Explain how experimental error affects results", true, ["direction of the effect on the calculated result"]),
];

export const chemistryGuide: SubjectGuide = {
  subject: "ap_chemistry",
  guideDoc: "docs/ap/chemistry-groundwork.md",
  examStructure: "2027: MC 60 questions/90 min (single-answer, four options, discrete questions and shared-stimulus sets; exact set counts are not published), 50%; FRQ 7 questions/105 min, 50%: three long questions (10 points each) and four short questions (4 points each), 46 points. Hybrid digital exam: questions in Bluebook, FRQ answers handwritten on paper. Scientific or graphing calculators are recommended on both sections; the periodic table and an equation sheet are provided. MC unit weights: Unit 3 18-22%, Unit 8 11-15%, all others 7-9%.",
  units,
  skills,
  archetypes: chemArchetypes as ArchetypeSpec[],
  frqTemplates: [
    { id: "chf_long_titration", template: "long", topic: "8.5", extraTopics: ["8.3", "8.9", "4.6"], skill: "5.F", calculator: "allowed", parts: "A weak-acid pH(3) / B equivalence volume(2) / C half-equivalence pH and justification(2) / D indicator choice(2) / E concentration change(1)", points: 10, verifiedBy: ["sympy quadratic and charge-balance bisection for pH; the equivalence-point pH selects the unique indicator"] },
    { id: "chf_long_thermo", template: "long", topic: "9.3", extraTopics: ["9.5", "9.9"], skill: "5.F", calculator: "allowed", parts: "A delta G(2) / B crossover temperature and justification(3) / C equilibrium constant(2) / D cell diagram and potential(2) / E delta G of the cell(1)", points: 10, verifiedBy: ["sympy exact delta G, K and nFE; bisection on delta G(T)"] },
    { id: "chf_long_kinetics", template: "long", topic: "5.3", extraTopics: ["5.2", "5.5"], skill: "5.F", calculator: "allowed", parts: "A order and the graph that supports it(3) / B rate constant from the graph with units(3) / C half-life(2) / D temperature and collision model(2)", points: 10, verifiedBy: ["R^2 of three linearizations by polyfit selects the order; the slope gives k; the half-life uses the order-specific relation"] },
    { id: "chf_short_pes", template: "short", topic: "1.6", extraTopics: ["1.5", "1.7"], skill: "1.A", calculator: "allowed", parts: "A identify element(1) / B Coulomb's law justification(1) / C valence peak of the next element, claim and justification(2)", points: 4, verifiedBy: ["electron configuration from two independent filling orders; peak electron total equals Z"] },
    { id: "chf_short_stoich", template: "short", topic: "4.5", extraTopics: ["4.3", "3.4"], skill: "5.F", calculator: "allowed", parts: "A balanced equation(1) / B moles of fuel and of product(2) / C gas volume(1)", points: 4, verifiedBy: ["sympy balance by linear system; the gas volume recomputed by bisection on PV - nRT"] },
    { id: "chf_short_bonding", template: "short", topic: "2.7", extraTopics: ["2.5", "3.1"], skill: "4.A", calculator: "allowed", parts: "A Lewis diagram(1) / B geometry and angle(1) / C polarity(1) / D boiling-point comparison(1)", points: 4, verifiedBy: ["geometry from two independent rules; boiling points from a tabulated pair"] },
    { id: "chf_short_equilibrium", template: "short", topic: "7.3", extraTopics: ["7.2", "7.9", "7.10"], skill: "6.D", calculator: "allowed", parts: "A K expression(1) / B Q and direction(1) / C volume change(1) / D temperature and K(1)", points: 4, verifiedBy: ["Q computed exactly and compared with K by the sign of ln(Q/K); the volume-change direction from recomputing Q"] },
    { id: "chf_long_buffer", template: "long", topic: "8.9", extraTopics: ["8.5", "8.10"], skill: "5.F", calculator: "allowed", parts: "A Henderson-Hasselbalch pH(2) / B pH after strong acid(3) / C moles of base for a target pH(2) / D explanation of buffer action(2) / E dilution(1)", points: 10, verifiedBy: ["exact-fraction ratio and logs for pH; bisection on the log ratio for the moles of base"] },
    { id: "chf_long_ksp", template: "long", topic: "7.11", extraTopics: ["7.9", "7.12"], skill: "5.F", calculator: "allowed", parts: "A Ksp expression and molar solubility(2) / B Q after mixing and precipitation(3) / C common-ion solubility(2) / D comparison justification(2) / E Ksp constancy(1)", points: 10, verifiedBy: ["bisection on the Ksp equation for the solubilities; Q from exact halved concentrations"] },
    { id: "chf_long_calorimetry", template: "long", topic: "6.4", extraTopics: ["6.3", "6.9"], skill: "5.F", calculator: "allowed", parts: "A heat of the solution(2) / B molar enthalpy with sign(2) / C Hess's law with a scaled step(3) / D heat-loss error(2) / E doubled volumes(1)", points: 10, verifiedBy: ["exact decimal products for q and delta H; Hess sum from exact integers"] },
    { id: "chf_short_massspec", template: "short", topic: "1.2", extraTopics: ["1.1"], skill: "1.A", calculator: "allowed", parts: "A average atomic mass(1) / B neutrons(1) / C abundance prediction(2)", points: 4, verifiedBy: ["exact fractions for the weighted mean"] },
    { id: "chf_short_gas_mix", template: "short", topic: "3.5", extraTopics: ["3.4", "3.6"], skill: "5.F", calculator: "allowed", parts: "A total pressure(1) / B partial pressure(1) / C molecular speed justification(2)", points: 4, verifiedBy: ["bisection on PV - nRT; partial pressure from the mole fraction"] },
    { id: "chf_short_solution", template: "short", topic: "3.7", extraTopics: ["3.8", "3.13"], skill: "5.F", calculator: "allowed", parts: "A molarity(1) / B dilution(1) / C ion concentration(1) / D conductivity(1)", points: 4, verifiedBy: ["exact fractions for molarity; dilution recomputed through moles"] },
    { id: "chf_short_neutral", template: "short", topic: "8.2", extraTopics: ["8.1", "4.3"], skill: "5.F", calculator: "allowed", parts: "A pH of a strong acid(1) / B pH of a strong base(1) / C neutralization volume(1) / D equivalence-point pH(1)", points: 4, verifiedBy: ["exact logs for pH; root solving for the equivalence volume"] },
  ] as FrqTemplateSpec[],
  notation: ["every number with a unit is written $12.3\\text{ g}$; symbols and chemical formulas are inside $...$ with \\mathrm{}", "SI-based units with common chemical units (mol, L, atm, M, kJ/mol); constants R = 8.314 J/(mol K) = 0.08206 L atm/(mol K), F = 96,485 C/mol, Kw = 1.0e-14 at 25 C (reference sheet values stated once in the exam header)", "three significant figures in options unless the data have fewer; pH values to two decimal places; K values in scientific notation", "temperatures in Kelvin inside gas and equilibrium equations; Celsius values are converted explicitly"],
  calculatorRules: ["scientific or graphing calculators are expected; never make arithmetic the only demand", "numeric option values differ by at least 8 percent (pH, atomic mass and cell potential options use fixed absolute gaps)", "an interpretation or claim item uses four fixed sentences: one correct statement and three named misconceptions", "25 degC and ideal behavior are the default model assumptions unless stated"],
  stimulusTypes: [
    { kind: "graph", howGenerated: "Python builds titration curves, concentration-time data, speed distributions, heating curves, energy diagrams, potential-energy curves and vapor-pressure curves from closed forms or exact charge-balance solves", howVerified: "key values recomputed from the generating constants and, for curves, read back numerically (steepest point, peak position, extremum)" },
    { kind: "diagram", howGenerated: "Python scene models (photoelectron spectrum, particle box) rendered deterministically; text numbers come from the same variables", howVerified: "scene checks: energies strictly decrease, relative electron counts sum to Z, particle counts and packing fraction in range, valid SVG" },
    { kind: "table", howGenerated: "data tables computed by code (isotope data, initial rates, calibration data, buret readings, ionization energies)", howVerified: "least-squares and exact-fraction recomputation of the answer" },
    { kind: "none", howGenerated: "scenario text with all values in the stem", howVerified: "sympy closed form versus numeric or root-finding path" },
  ],
  difficultyAllowed: ["choosing the governing relationship", "a graph, table or spectrum read before computing", "one proportional-reasoning prediction", "a unit conversion (Celsius to kelvins, mL to L, kJ to J)", "one additional reasoning step linking a result to a claim"],
  difficultyBanned: ["long or unrounded arithmetic", "ambiguous wording or unstated model assumptions", "organic chemistry nomenclature or mechanisms", "calculus derivations", "irrelevant context or extra reading load", "reproducing a College Board sample item scenario"],
  loadLimits: { mcSeconds: [45, 130], stemWordsMax: 100, mcOptions: 4, frqMinutes: 28, frqPoints: 10 },
  frqRubricPatterns: ["analytic rows worth one point each", "diagram and graph rows use checklists (labels, directions, relative positions, axes)", "a numeric row carries units; an expression row accepts equivalent algebra", "justification rows require a named principle and a link to the claim"],
  frqAccepted: ["equivalent algebraic forms", "answers within rounding of the stated significant figures", "a different valid justification using the same chemical principle"],
  bannedTerms: [
    { pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" },
    { pattern: "\\b(Arrhenius equation|activation energy from two rate constants)\\b", why: "Arrhenius-equation calculations are not on the reference sheet" },
  ],
  validators: [
    { item: "mc", checks: ["four unique options; key index valid", "each wrong option has a named misconception", "numeric options at least 8 percent apart (absolute gaps for pH-like values)", "math wrapped in $...$", "skill is one of 1.A 1.B 2.A-2.F 4.A-4.D 5.A-5.F 6.A-6.G (never 3.x)", "est_seconds within 45 to 130"] },
    { item: "frq", checks: ["total points equal the type weight (long 10, short 4)", "rubric rows sum to each part's points", "row kinds limited to expression, numeric, diagram, graph, claim, justification, design", "dependent rows require an earlier row"] },
  ],
  acceptExamples: [
    { title: "error direction (6.G)", text: "A titration error changes the recorded base volume; the item asks whether the calculated acid concentration is too high, too low, or unaffected, and the key is recomputed from the altered value." },
    { title: "model against data (4.D)", text: "Measured equal bond lengths between the single and double values are compared with a one-double-bond Lewis model." },
  ],
  rejectExamples: [
    { title: "plug-in only", text: "Calculate the pH of a 0.010 M solution of HCl.", reason: "a one-step logarithm with no relationship choice or representation reading" },
    { title: "out-of-scope content", text: "Name the product of the reaction of 2-butanol with acidified dichromate.", reason: "organic chemistry is not in the course" },
  ],
};

export function chemistryWordingRules(): string {
  const g = chemistryGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Calculator and style rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}.`,
  ].join("\n");
}
