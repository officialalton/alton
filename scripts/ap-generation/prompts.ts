// AP 샘플 생성 프롬프트·도구 스키마. 품질 기준은 docs/ap/subject-quality-standards.md · acceptance-criteria-and-review-pipeline.md 요약이다.
import type { Cell } from "./cells";

export const MODELS = {
  gen: "claude-sonnet-5-5",
  solve: "claude-opus-5-5",
  review: "claude-sonnet-5-5",
  difficulty: "claude-sonnet-5-5",
  spot: "claude-fable-5-1",
} as const;

export const think = (model: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "low" } });

const COMMON = `You write ORIGINAL AP-style practice content for a premium 1:1 tutoring platform (student-facing text is US English). Never reproduce or paraphrase any real College Board / AP exam question, passage, figure or scoring text; invent new scenarios and numbers.
ACCEPTANCE CRITERIA (all five must pass; an item that violates any "instant reject" rule is thrown away):
1. Scope/skill fit: tests exactly the given official unit topic and the given official skill; needs no knowledge outside the AP course framework.
2. Key and scoring correctness: exactly ONE defensible key; every number/unit/code is verified by your verification_code (compute the key independently from the stimulus numbers, never hard-code it); FRQ rubric rows are consistent (points add up, alternative valid solutions listed).
3. Stimulus completeness: stimulus.data is the machine-readable specification from which the figure/table will be RENDERED later (description is only its alt text): it must fully specify axes with ranges and units, every curve/point/label/legend entry and every number the question uses, so nothing else is needed to draw or read it; wording is unambiguous US English. The stem must never say 'as described'.
4. Distractor/explanation quality: each wrong option encodes a specific named student misconception (write it in option_rationale); options are parallel in length, form and specificity (the key must not be longest, most hedged or most detailed); no "all/none of the above"; explanation says why the key is right AND why each distractor is wrong, referring to options by their content, NEVER by letter or position (options will be reshuffled).
4b. Math notation: write every mathematical expression in stem, options AND explanation_en inside $...$ (e.g. $\\frac{500\\pi}{3}$, $e^{-0.25t}$, $3\\pi/4$) — never bare TeX, never plain-text math like "pi" or "x^2" outside $...$, and never JSON unicode escapes like \\u221a (write the character or $\\sqrt{x}$).
5. Exam suitability: time, reading load and calculator/reference-sheet assumptions fit the real exam section; no needless long arithmetic.
INSTANT REJECT: wrong key; more than one correct option; missing condition needed to decide the answer; stimulus that contradicts the stem; required out-of-scope knowledge.
DIFFICULTY RULE: never make an item harder by long arithmetic, vagueness, extra reading load or out-of-scope knowledge; difficulty comes only from concept depth, number of representation changes, reasoning steps and condition-checking. Target "exam-prep" level.
Never label items as "AP 3/4/5 level". Do not claim to reproduce full-exam difficulty.
SETS: every item must depend on the shared stimulus (no item answerable without it), cover different skills/ideas, and every statistic or range cited by any item must appear in stimulus.data. FREE RESPONSE: keep every part tied to the listed topics and the primary skill (no drift into unrelated units); every statement in model answers and alt_solutions must be mathematically/scientifically valid (avoid overstated generalizations such as 'only if'); justification rubric rows must name the conditions to be verified; no-calculator parts must not need decimals beyond hand computation; points per part must match real exam grain (one point per distinct required element).
VERIFICATION CONTRACT: verification_code is a self-contained Python 3 script (sympy, numpy, scipy available) that recomputes the answer from the numbers given in the stimulus/stem and prints exactly ONE JSON line. For multiple-choice: {"computed_key_index": <0-based index of the option your computation supports>, "conceptual_only": false, "details": "..."} — set conceptual_only true and computed_key_index null ONLY if nothing numeric/logical can be recomputed (then say why in details). For a set: {"items":[<that object per item in order>]}. For FRQ: {"checks":[{"part":"a","pass":true,"detail":"..."}...], "conceptual_parts":["c","d"]} where each numeric/graph-data part is recomputed and compared with your model answer.`;

const SUBJECT: Record<string, string> = {
  ap_calculus_ab: `SUBJECT AP Calculus AB (exam 2027: 42 MC/100 min — Part A 29 q no calculator, Part B 13 q graphing calculator required; 6 FRQ, 9 points each). Four options (A-D). Use LaTeX with $...$. Values must be hand-computable in Part A. Good items link two or more representations (expression/table/graph) and ask for interpretation or justification with conditions (IVT/MVT/EVT checks); bad items repeat formula-plugging or require needless computation. Represent graphs as data (key points, intervals, signs of f'/f'') in stimulus.data so a figure can be drawn later. FRQ rubric rows must separate setup / answer / justification (conditions verified) / units-interpretation, mark dependency chains (requires_row_id), and list accepted equivalent forms; rounding: at most one point lost per question for rounding to 3 decimals.`,
  ap_biology: `SUBJECT AP Biology (exam 2027: 60 MC/90 min, 6 FRQ/90 min: 2 long 9-point + 4 short 4-point; calculators allowed; formulas such as Hardy-Weinberg and chi-square tables are provided on the exam). Four options. Items test data/experiment interpretation and explain/predict/argue; reject rote recall and conclusions the data do not support. Give tables/graphs as data (numbers, error bars as ±2SE where used). A claim-evidence item must be decidable from the provided data only. Short FRQ = four 1-point parts ordered describe/explain -> read data -> predict -> justify; long FRQ = experiment with controls, graph construction (rubric split into: appropriate graph type, accurately plotted data with error bars, labeled axes/legend), a calculation with an accepted numeric range, and a prediction with justification. Rubric rows list required_elements and optional_phrases separately.`,
  ap_microeconomics: `SUBJECT AP Microeconomics (exam 2027: 60 MC/70 min with FIVE options (A-E); 3 FRQ/60 min: one long 10-point + two short 5-point; calculators allowed). Items apply models: graphs, calculations (elasticity, surplus, profit, MR=MC, game theory payoff matrices), explanations. Describe every graph as data (curve equations or labeled points, quantities and prices) in stimulus.data so areas/equilibria can be recomputed. Reject unclear shifts (a shift vs movement along a curve must be unambiguous), model-conclusion mismatches, and options that are simultaneously correct. FRQ rubric: one point per part; a "state AND explain" part needs both (requires_both); graph parts list element-by-element rows (curve shapes, labeled equilibrium, MR=MC point, ATC tangency/min-point conditions, shaded area); 'explain using numbers' parts require numbers (requires_numbers).`,
};
export const subjectPrompt = (code: string) => `${COMMON}\n${SUBJECT[code] ?? ""}`;

const stimulusSchema = { type: "object", properties: { kind: { type: "string", enum: ["none", "table", "graph", "text", "diagram", "payoff_matrix"] }, description: { type: "string" }, data: { type: "object" } }, required: ["kind", "description"] };
const mcItemProps = {
  stem: { type: "string" },
  options: { type: "array", items: { type: "string" } },
  key_index: { type: "integer" },
  option_rationale: { type: "array", items: { type: "string" }, description: "one per option: for the key why correct; for each distractor the specific student misconception" },
  explanation_en: { type: "string" },
  skill_primary: { type: "string" },
  skill_secondary: { type: "array", items: { type: "string" } },
  keyword_codes: { type: "array", items: { type: "string" } },
  est_seconds: { type: "integer" },
  verification_code: { type: "string" },
};
const mcReq = ["stem", "options", "key_index", "option_rationale", "explanation_en", "skill_primary", "keyword_codes", "est_seconds", "verification_code"];

export function toolFor(cell: Cell) {
  if (cell.kind === "frq_bundle")
    return {
      name: "submit_frq",
      description: "Submit one original multi-part free-response bundle with rubric rows.",
      input_schema: { type: "object", properties: {
        title: { type: "string" }, template: { type: "string" }, stimulus: stimulusSchema,
        parts: { type: "array", items: { type: "object", properties: {
          label: { type: "string" }, prompt: { type: "string" }, points: { type: "integer" }, response_mode: { type: "string", enum: ["calculate", "explain", "graph", "select", "essay"] },
          skill_codes: { type: "array", items: { type: "string" } }, keyword_codes: { type: "array", items: { type: "string" } }, model_answer: { type: "string" },
          rubric_rows: { type: "array", items: { type: "object", properties: {
            row_id: { type: "string" }, points: { type: "integer" }, criterion: { type: "string" }, required_elements: { type: "array", items: { type: "string" } }, optional_phrases: { type: "array", items: { type: "string" } },
            alt_solutions: { type: "array", items: { type: "string" } }, common_errors: { type: "array", items: { type: "string" } }, requires_row_id: { type: ["string", "null"] }, requires_both: { type: "boolean" }, requires_numbers: { type: "boolean" },
            numeric_tolerance: { type: ["string", "null"] }, units_row: { type: "boolean" } }, required: ["row_id", "points", "criterion", "required_elements"] } } },
          required: ["label", "prompt", "points", "response_mode", "skill_codes", "model_answer", "rubric_rows"] } },
        total_points: { type: "integer" }, calculator_part: { type: "string", enum: ["required", "not_allowed", "allowed", "na"] }, est_minutes: { type: "integer" }, design_note: { type: "string" }, verification_code: { type: "string" },
      }, required: ["title", "stimulus", "parts", "total_points", "est_minutes", "design_note", "verification_code"] },
    };
  if (cell.structure === "shared_stimulus_set")
    return {
      name: "submit_set",
      description: `Submit one stimulus shared by exactly ${cell.itemsPerCandidate} multiple-choice items.`,
      input_schema: { type: "object", properties: { stimulus: stimulusSchema, items: { type: "array", items: { type: "object", properties: mcItemProps, required: mcReq } }, set_design_note: { type: "string" } }, required: ["stimulus", "items", "set_design_note"] },
    };
  return {
    name: "submit_mc",
    description: "Submit one original multiple-choice item.",
    input_schema: { type: "object", properties: { stimulus: stimulusSchema, ...mcItemProps, calculator_part: { type: "string", enum: ["required", "not_allowed", "na"] }, design_note: { type: "string" } }, required: ["stimulus", ...mcReq, "design_note"] },
  };
}

const CONTEXTS = ["a laboratory or field setting", "a business or household decision", "a purely mathematical/abstract setting", "a health, sports or technology scenario"];
export function userPrompt(cell: Cell, topicTitle: string, skillLabel: string, optionCount: number, idx: number, siblingNote: string): string {
  const lines = [
    `Candidate ${idx + 1} of ${cell.candidates} for cell ${cell.cellId}. Create ONE new item. Use ${CONTEXTS[idx % CONTEXTS.length]} (candidates for the same cell must differ in context, numbers and stimulus type).`,
    `Official unit ${cell.unitCode}; official topic ${cell.keywordCode} "${topicTitle}"${cell.extraKeywordCodes.length ? `; also draws on topics ${cell.extraKeywordCodes.join(", ")}` : ""}.`,
    `Set keyword_codes to exactly [${[cell.keywordCode, ...cell.extraKeywordCodes].map((c) => `"${c}"`).join(", ")}] (do not invent other codes). Primary official skill: ${cell.skill} — ${skillLabel}. Put this code in skill_primary (secondary skills only if truly exercised).`,
    cell.kind === "mc" ? `Use exactly ${optionCount} options.` : `Template: ${cell.frqTemplate}. Choose point values that match the subject's real exam (see subject notes).`,
    cell.calculator !== "na" ? `Calculator status: ${cell.calculator}.` : "",
    siblingNote,
    `Submit via the ${cell.kind === "frq_bundle" ? "submit_frq" : cell.structure === "shared_stimulus_set" ? "submit_set" : "submit_mc"} tool only.`,
  ];
  return lines.filter(Boolean).join("\n");
}
