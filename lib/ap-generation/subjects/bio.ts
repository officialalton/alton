import type { ArchetypeSpec, FrqTemplateSpec, SkillRule, SubjectGuide, UnitScope } from "./types";
import bioArchetypes from "./bio-archetypes.json";
import bioFrqTemplates from "./bio-frq-templates.json";
import curriculum from "../../../data/ap/curriculum-2027/ap_biology.json";

// AP Biology(2027 시험, 8단원) 생성 가이드 설정 — 본문: docs/ap/biology-groundwork.md, 공식 사실: docs/ap/biology-facts.md(CED V.1 ©2025 Exam Information p.197–203·Appendix p.229–231 직접 대조).
// 수치·표·그림·정답은 Python 원형(scripts/ap-generation/archetypes/bio_p0_*.py)이 계산하고 두 독립 경로로 확인한다. 원형 목록(bio-archetypes.json, bio-frq-templates.json)의 원천은 `registry.py guide-bio`·`guide-bio-frq`.
// 단원·스킬 코드와 MC 단원 가중은 data/ap/curriculum-2027/ap_biology.json(CED 전사). Practice MC 가중(P1 25–33, P2 16–24, P3 8–14, P4 8–14, P5 8–14, P6 20–26 %)은 CED p.201 에서 가져와 bio_coverage.py·full-set-rules.ts 에 둔다.

type Wt = { axis: string; code: string; section: string; min: number; max: number };
const weights = (curriculum as unknown as { weights: Wt[] }).weights;
const mcWeight = (u: string): [number, number] => { const w = weights.find((x) => x.axis === "unit" && x.code === u && x.section === "mc"); return w ? [w.min, w.max] : [0, 0]; };

const OUT_OF_SCOPE: Record<string, string[]> = {
  "1": ["naming of organic functional groups beyond what the learning objectives need", "detailed biochemical structures of individual amino acids or sugars that must be memorized"],
  "2": ["detailed structures of membrane proteins", "calculating membrane potentials"],
  "3": ["reaction mechanisms of individual enzymes", "memorizing every intermediate of glycolysis or the Krebs cycle", "Michaelis-Menten equations (qualitative saturation and inhibition only)"],
  "4": ["names of individual kinases and second messengers beyond examples", "detailed cell-cycle checkpoint proteins beyond cyclin, CDK, and p53 examples"],
  "5": ["multiple-gene epistasis ratios as calculations", "quantitative linkage mapping with three genes", "dihydrid linkage beyond recombination frequency"],
  "6": ["recombinant DNA vector maps", "sequence alignment algorithms", "detailed splicing mechanisms"],
  "7": ["population genetics models beyond Hardy-Weinberg and simple selection", "cladistic algorithms beyond reading a tree or character table"],
  "8": ["biome classification by name", "detailed life histories of specific species", "Lotka-Volterra equations (qualitative predator-prey cycles only)"],
};
const units: UnitScope[] = (curriculum as unknown as { units: { code: string; title: string; topics: { code: string; title: string }[] }[] }).units.map((u) => ({
  unit: u.code, title: u.title, mcWeight: mcWeight(u.code), inScope: u.topics.map((t) => `${t.code} ${t.title}`), outOfScope: OUT_OF_SCOPE[u.code] ?? [],
}));

const sk = (code: string, name: string, mc: boolean, designRules: string[], banned: string[] = []): SkillRule => ({ code, name, mc, frq: true, designRules, banned });
const skills: SkillRule[] = [
  sk("1.A", "Describe biological concepts and processes", true, ["fixed-sentence options: one correct description of a structure, process or concept and three named misconceptions"]),
  sk("1.B", "Explain biological concepts and processes", true, ["explain how or why a process works; options are parallel explanations"]),
  sk("1.C", "Explain biological concepts and processes in applied contexts", true, ["apply the concept to a specific organism, population or situation"]),
  sk("2.A", "Describe characteristics of visual representations", true, ["read a graph, bar chart, table-based diagram or sequence diagram and describe what it shows"]),
  sk("2.B", "Explain relationships between model characteristics", true, ["relate two features of a model or a graph to each other"]),
  sk("2.C", "Explain how models relate to larger principles or theories", true, ["connect a model to a principle such as common ancestry or energy flow"]),
  sk("2.D", "Represent relationships within biological models", true, ["choose the representation (sequence, strand, codon pairing) that correctly encodes a relationship"]),
  sk("3.A", "Identify or pose a testable question", true, ["fixed-sentence options: one question names a manipulated variable and a measurable response"]),
  sk("3.B", "State the null hypothesis or predict experimental results", true, ["null hypothesis states no effect or no difference; prediction names a direction and the reason"]),
  sk("3.C", "Identify experimental procedures (variables, controls)", true, ["identify independent, dependent and controlled variables, or the control group that isolates a variable"]),
  sk("3.D", "Propose a new investigation from evaluating design or evidence", true, ["choose the follow-up experiment that tests the hypothesis rather than repeating the data"]),
  sk("4.A", "Construct a graph to represent data", false, ["FRQ only (paper graph construction)"]),
  sk("4.B", "Describe data from a table or graph", true, ["describe the whole pattern, not one pair of points"]),
  sk("5.A", "Perform mathematical calculations", true, ["calculate with the formula-sheet equations; never make arithmetic the only demand — choose the quantity, apply the formula, interpret"], ["long or unrounded arithmetic as the only difficulty"]),
  sk("5.B", "Use confidence intervals and error bars", true, ["compare mean ± 2SE ranges and state whether a difference is supported"]),
  sk("5.C", "Perform chi-square hypothesis testing", true, ["chi-square with df = outcomes - 1 and the table on the formula sheet"]),
  sk("5.D", "Use data to evaluate a hypothesis or prediction", true, ["decide whether data support a claim"]),
  sk("6.A", "Make a scientific claim", true, ["claim from a described observation"]),
  sk("6.B", "Support a claim with evidence", true, ["choose the evidence in the stimulus that supports the claim"]),
  sk("6.C", "Provide reasoning connecting evidence to theory", true, ["connect data to the principle that explains it"]),
  sk("6.D", "Explain how results relate to larger concepts", true, ["relate an experimental result to a larger biological concept"]),
  sk("6.E", "Predict causes or effects of a change in a biological system", true, ["predict the effect of a disruption, mutation or changed condition and reject named misconceptions"]),
];

export const biologyGuide: SubjectGuide = {
  subject: "ap_biology",
  guideDoc: "docs/ap/biology-groundwork.md",
  examStructure: "2027: MC 60 questions/90 min (individual questions and shared-stimulus sets of typically 4-5 questions; exact set counts are not published), 50%; FRQ 6 questions/90 min, 50%: two long questions (9 points each: interpreting and evaluating experimental results; the same with graphing) and four short questions (4 points each, four 1-point parts: scientific investigation, conceptual analysis, analysis of a model or visual representation, data analysis), 34 points. Hybrid digital exam: questions in Bluebook, FRQ answers handwritten on paper. A four-function, scientific, or graphing calculator is allowed on both sections. The AP Biology Equations and Formulas sheet is provided.",
  units,
  skills,
  archetypes: bioArchetypes as ArchetypeSpec[],
  frqTemplates: bioFrqTemplates as FrqTemplateSpec[],
  notation: ["numbers with units are written plainly (12.5 µmol per minute) or inside $...$ with \\text{ unit} in value options", "chemical and genetic symbols are written plainly (Aa, 5'-AUG-3', NaCl); equations on the sheet are quoted by name (dN/dt = r_max N)", "use US English; 5' and 3' ends are written with a prime; allele symbols are italic by convention but plain text is accepted"],
  calculatorRules: ["four-function, scientific or graphing calculators are allowed; never make arithmetic the only demand", "numeric option values differ by at least 8 percent (pH-like, percent and count options use fixed absolute gaps)", "an interpretation or claim item uses four fixed sentences: one correct statement and three named misconceptions of similar length", "every equation used comes from the AP Biology Equations and Formulas sheet"],
  stimulusTypes: [
    { kind: "table", howGenerated: "Python builds experiment tables (mean ± 2SE with n, counts, rates, genotype counts, character matrices) from generating parameters", howVerified: "key values recomputed from the displayed table; overlap, percent change and interpolation re-derived by a separate path" },
    { kind: "graph", howGenerated: "Python builds line graphs (growth, rates, energy diagrams, allele-frequency simulations, time courses) from closed forms or seeded simulations", howVerified: "peaks, plateaus, slopes and trends read back numerically from the plotted vertices" },
    { kind: "stat_chart", howGenerated: "bar graphs of expression levels and energy at trophic levels", howVerified: "argmax / ratios recomputed from the plotted values" },
    { kind: "diagram", howGenerated: "complementary DNA strands with 5' and 3' ends (strand_pair)", howVerified: "base pairing, hydrogen-bond counts and polarity computed from the same strings" },
    { kind: "none", howGenerated: "scenario text with all values in the stem", howVerified: "formula-sheet equations evaluated by two independent paths" },
  ],
  difficultyAllowed: ["choosing the governing biological relationship", "reading a table, graph or diagram before reasoning", "one proportional or probability calculation using a formula-sheet equation", "comparing mean ± 2SE ranges", "predicting the effect of a disruption and rejecting named misconceptions"],
  difficultyBanned: ["pure vocabulary or definition matching with no situation (multiple choice; concept-explanation items for practice 1 may use a concrete biological situation without data; the describe and explain parts of a short free-response question name a concept from the scenario)", "long or unrounded arithmetic", "ambiguous wording or unstated experimental conditions", "topics outside the CED (for example detailed organic chemistry, biome classification by name)", "irrelevant context or extra reading load", "reproducing a College Board sample item scenario"],
  loadLimits: { mcSeconds: [45, 130], stemWordsMax: 100, mcOptions: 4, frqMinutes: 24, frqPoints: 9 },
  frqRubricPatterns: ["one point per row; a long question has A 1 point, B 3 or 4 points, C 2 or 3 points, D 2 points; a short question has four 1-point parts", "rows are judged on meaning: required elements are concept statements, accepted alternatives are examples and not an exhaustive list", "graph rows are a checklist: axis labels with units, even scale, plotted points, graph type", "numeric rows carry a tolerance and units where relevant"],
  frqAccepted: ["equivalent wording that conveys the required meaning", "answers within the stated tolerance", "a different valid biological justification"],
  bannedTerms: [
    { pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" },
    { pattern: "\\b(Michaelis[- ]Menten|Km|Vmax|Lotka)\\b", why: "quantitative enzyme-kinetics and population-cycle models are not on the Biology formula sheet" },
  ],
  validators: [
    { item: "mc", checks: ["four unique options; key index valid", "each wrong option has a named misconception", "numeric options at least 8 percent apart or a stated absolute gap", "skill is one of the official skill codes and never 4.A in MC", "est_seconds within 45 to 130"] },
    { item: "frq", checks: ["total points equal the type weight (long 9, short 4)", "rubric rows sum to each part's points", "short questions have exactly four 1-point parts", "dependent rows require an earlier row"] },
  ],
  acceptExamples: [
    { title: "data with a control (3.C)", text: "A table of rates at three temperatures asks which factor must be held constant and why; the key names one controlled factor and links it to isolating the independent variable." },
    { title: "model-based prediction (6.E)", text: "A blocked step of a signaling pathway is given and the item asks which later step is no longer activated; each wrong option encodes a named misconception." },
  ],
  rejectExamples: [
    { title: "rote recall", text: "Which organelle is the powerhouse of the cell?", reason: "recall with no data, situation or reasoning" },
    { title: "out of scope", text: "Write the Michaelis-Menten equation for competitive inhibition.", reason: "quantitative kinetics models are not in the CED" },
  ],
};

export function biologyWordingRules(): string {
  const g = biologyGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Calculator and style rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}.`,
  ].join("\n");
}
