import type { SubjectGuide } from "./types";

// AP Calculus AB 생성 가이드 설정 — 본문: docs/ap/generation-guides/calc-ab.md. 수치·키·표·루브릭 구조는 Python 원형(scripts/ap-generation/archetypes/calc_ab_*.py)이 계산한다.
export const calcAbGuide: SubjectGuide = {
  subject: "ap_calculus_ab",
  guideDoc: "docs/ap/generation-guides/calc-ab.md",
  examStructure: "2027: MC 42 questions/100 min (Part A 29 q/62 min no calculator; Part B 13 q/38 min graphing calculator required), four options; FRQ 6 questions/90 min (Part A 2 q/30 min calculator; Part B 4 q/60 min none), 9 points each; MC skills assessed: P1 50-70%, P2 15-30%, P3 10-20% (Practice 4 only in FRQ).",
  units: [
    { unit: "1", title: "Limits and Continuity", mcWeight: [10, 15], inScope: ["limits from graphs, tables, algebra (factoring, conjugates)", "one-sided limits, infinite limits, limits at infinity", "continuity and types of discontinuity", "Squeeze Theorem", "Intermediate Value Theorem"], outOfScope: ["epsilon-delta proofs", "limits of sequences", "L'Hopital (Unit 4 in AB)"] },
    { unit: "2", title: "Differentiation: Definition and Fundamental Properties", mcWeight: [10, 15], inScope: ["average vs instantaneous rate", "derivative definition, estimating from tables", "differentiability and continuity", "power, constant multiple, sum, product, quotient rules", "derivatives of sin, cos, tan, e^x, ln x"], outOfScope: ["chain rule (Unit 3)", "implicit differentiation (Unit 3)", "inverse trig derivatives are Unit 3"] },
    { unit: "3", title: "Differentiation: Composite, Implicit, and Inverse Functions", mcWeight: [5, 10], inScope: ["chain rule", "implicit differentiation, first derivative only for MC", "derivatives of inverse and inverse trig functions", "higher-order derivatives"], outOfScope: ["related rates (Unit 4)", "second derivative of implicit relations in MC"] },
    { unit: "4", title: "Contextual Applications of Differentiation", mcWeight: [10, 15], inScope: ["interpreting derivatives with units", "straight-line motion: velocity, speed, acceleration", "related rates", "local linearity and linearization", "L'Hopital's Rule"], outOfScope: ["parametric/vector motion (BC)", "differentials notation dy=f'(x)dx beyond linearization"] },
    { unit: "5", title: "Analytical Applications of Differentiation", mcWeight: [15, 20], inScope: ["Mean Value Theorem, Extreme Value Theorem", "critical points, first and second derivative tests", "concavity and inflection points", "connecting f, f', f''", "optimization", "implicit differentiation use in tangent/normal lines"], outOfScope: ["Rolle's Theorem as a separate named theorem (use MVT)", "Newton's method"] },
    { unit: "6", title: "Integration and Accumulation of Change", mcWeight: [15, 20], inScope: ["Riemann sums (left, right, midpoint, trapezoidal) from tables/functions", "definite integral properties", "Fundamental Theorem of Calculus both parts", "accumulation functions", "basic antiderivatives, u-substitution, long division/completing the square for AB-level forms"], outOfScope: ["integration by parts (BC)", "partial fractions (BC)", "improper integrals (BC)", "Simpson's rule"] },
    { unit: "7", title: "Differential Equations", mcWeight: [5, 10], inScope: ["modeling with differential equations", "slope fields: sketching, matching, reasoning", "separation of variables, particular solutions", "exponential growth/decay models dy/dt=ky"], outOfScope: ["Euler's method (BC)", "logistic models (BC)", "linear first-order solution methods"] },
    { unit: "8", title: "Applications of Integration", mcWeight: [10, 15], inScope: ["average value of a function", "motion: displacement and total distance", "net change in context", "area between curves (in x or y)", "volumes by cross sections (squares, rectangles, triangles, semicircles), disc and washer"], outOfScope: ["shell method (not required)", "arc length (BC)", "polar/parametric area (BC)"] },
  ],
  skills: [
    { code: "1.C", name: "Identify a rule/procedure from the classification of an expression", mc: true, frq: true, designRules: ["the student must choose a rule by looking at the form of the expression (product vs quotient vs chain)", "distractors apply a different rule that looks plausible"], banned: ["giving the rule name in the stem"] },
    { code: "1.D", name: "Identify a procedure from relationships between concepts or processes", mc: true, frq: true, designRules: ["the choice depends on a concept (rate vs accumulation, setup of area/volume integrals, related rates)", "options are setups or values that expose a conceptual slip"], banned: ["pure arithmetic differences between options"] },
    { code: "1.E", name: "Apply procedures, with or without technology", mc: true, frq: true, designRules: ["one clean multi-step computation, hand-doable in Part A", "options come from named procedural slips computed by code"], banned: ["repeated plug-in of the same formula with new numbers", "needless long arithmetic"] },
    { code: "1.F", name: "Explain how an approximation relates to the true value", mc: true, frq: true, designRules: ["approximation (tangent line, Riemann sum, difference quotient) with a value or an over/under claim"], banned: ["claims that require unstated monotonicity or concavity"] },
    { code: "2.B", name: "Identify mathematical information from graphical, numerical, analytical or verbal representations", mc: true, frq: true, designRules: ["the information must be read from a table or graph given as data (not recomputed from a formula)"], banned: ["tables that are redundant with the stem"] },
    { code: "2.C", name: "Identify a re-expression of mathematical information", mc: true, frq: true, designRules: ["move between forms: limit/derivative notation, Riemann sum/integral, DE/slope field"], banned: ["re-expressions that need a hidden assumption"] },
    { code: "2.D", name: "Identify how mathematical characteristics of functions are related in different representations", mc: true, frq: true, designRules: ["connect f, f', f'' behavior with sign/monotonic data given for one of them"], banned: ["data for f' alone when the question needs f values"] },
    { code: "2.E", name: "Describe relationships among representations of functions and derivatives", mc: true, frq: true, designRules: ["state and justify how one representation implies a property of another (concavity from f')"], banned: [] },
    { code: "3.B", name: "Identify an appropriate definition, theorem or test", mc: true, frq: true, designRules: ["choose the theorem whose hypotheses are met (IVT, MVT, EVT, FTC)"], banned: [] },
    { code: "3.C", name: "Confirm that hypotheses or conditions of a definition, theorem or test are satisfied", mc: true, frq: true, designRules: ["one hypothesis is explicitly present or absent and decides the answer"], banned: ["hypotheses left implicit"] },
    { code: "3.D", name: "Apply a definition, theorem or test", mc: true, frq: true, designRules: ["the theorem's conclusion is applied to a value, interval or existence claim"], banned: [] },
    { code: "3.E", name: "Provide reasons or rationales for solutions and conclusions", mc: true, frq: true, designRules: ["MC: the key is the conclusion that follows from the stated reasoning; FRQ: justification rows"], banned: ["options that embed 'because ...' narration"] },
    { code: "3.F", name: "Explain the meaning of mathematical solutions in context", mc: true, frq: true, designRules: ["interpretation with units in a real context"], banned: ["contexts that change the mathematics"] },
    { code: "3.G", name: "Confirm that solutions are accurate and appropriate", mc: false, frq: true, designRules: ["FRQ only in AB; reasonableness/units checks"], banned: [] },
    { code: "4.A", name: "Use precise mathematical language", mc: false, frq: true, designRules: ["FRQ rubric rows only"], banned: [] },
    { code: "4.B", name: "Use appropriate units of measure", mc: false, frq: true, designRules: ["separate units row; units never gate the computation point"], banned: [] },
    { code: "4.C", name: "Use appropriate mathematical symbols and notation", mc: false, frq: true, designRules: ["setup rows (limits, differential, equal sign)"], banned: [] },
    { code: "4.E", name: "Apply appropriate rounding procedures", mc: false, frq: true, designRules: ["three decimal places; at most one point lost per question for rounding"], banned: [] },
  ],
  archetypes: [
    { id: "lim_table", topic: "1.3", skill: "2.B", calculator: "not_allowed", stimulus: "table of values near a point (computed from the function, 4 decimals)", verifiedBy: ["sympy limit", "table-average vs limit"], misconceptions: ["limit equals f(a)", "0/0 means 0 or DNE", "dropping the 1/2 of the sqrt derivative"] },
    { id: "lim_alg", topic: "1.7", skill: "1.C", calculator: "not_allowed", stimulus: "none", verifiedBy: ["sympy limit"], misconceptions: ["0/0 read as 0 or DNE", "cancelling a factor of 2", "substituting into one factor only"] },
    { id: "cont_piece", topic: "1.11", skill: "3.D", calculator: "not_allowed", stimulus: "piecewise definition", verifiedBy: ["sympy solve"], misconceptions: ["sign slip matching the pieces", "forgetting the constant", "matching derivatives instead of values"] },
    { id: "ivt", topic: "1.15", skill: "3.D", calculator: "not_allowed", stimulus: "endpoint values with stated continuity", verifiedBy: ["interval arithmetic"], misconceptions: ["endpoint value guaranteed inside the open interval", "value outside the range"] },
    { id: "deriv_est_table", topic: "2.3", skill: "2.B", calculator: "not_allowed", stimulus: "table of f", verifiedBy: ["exact quadratic derivative"], misconceptions: ["one-sided interval", "wrong divisor", "no division"] },
    { id: "diff_cont", topic: "2.4", skill: "3.E", calculator: "not_allowed", stimulus: "piecewise definition", verifiedBy: ["sympy one-sided limits and derivatives"], misconceptions: ["equal values imply equal slopes", "differentiable but not continuous"] },
    { id: "product_table", topic: "2.8", skill: "1.E", calculator: "not_allowed", stimulus: "table of values and derivatives at a point", verifiedBy: ["product rule recompute"], misconceptions: ["f'g'", "constant multiple not differentiated", "missing term"] },
    { id: "quotient_rule_eval", topic: "2.9", skill: "1.E", calculator: "not_allowed", stimulus: "table of values and derivatives", verifiedBy: ["quotient rule recompute"], misconceptions: ["reversed numerator", "g not squared", "f'/g'"] },
    { id: "chain_table", topic: "3.1", skill: "1.E", calculator: "not_allowed", stimulus: "table of f, f', g, g'", verifiedBy: ["chain rule recompute"], misconceptions: ["f' at x instead of g(x)", "missing inner derivative"] },
    { id: "implicit_slope", topic: "3.2", skill: "1.E", calculator: "not_allowed", stimulus: "implicit curve", verifiedBy: ["sympy idiff"], misconceptions: ["product rule missing x y'", "y^2 without dy/dx", "sign error"] },
    { id: "motion_calc", topic: "4.1", skill: "1.E", calculator: "required", stimulus: "velocity function", verifiedBy: ["sympy diff", "central difference"], misconceptions: ["product rule term missing", "velocity used as acceleration"] },
    { id: "related_rates", topic: "4.4", skill: "1.D", calculator: "not_allowed", stimulus: "geometric formula", verifiedBy: ["sympy diff"], misconceptions: ["formula not differentiated", "missing r or dr/dt factor"] },
    { id: "linearization", topic: "4.6", skill: "1.F", calculator: "not_allowed", stimulus: "function and point", verifiedBy: ["exact rational tangent value"], misconceptions: ["forgot 1/2", "slope 1", "squared denominator"] },
    { id: "lhopital", topic: "4.7", skill: "3.D", calculator: "not_allowed", stimulus: "indeterminate quotient", verifiedBy: ["sympy limit"], misconceptions: ["inverted ratio", "numerator only"] },
    { id: "mvt_calc", topic: "5.1", skill: "3.D", calculator: "required", stimulus: "differentiable function on an interval", verifiedBy: ["brentq/solve and range check"], misconceptions: ["midpoint", "rate instead of c", "log base"] },
    { id: "extrema_classification", topic: "5.4", skill: "3.E", calculator: "not_allowed", stimulus: "factored derivative", verifiedBy: ["sign chart in sympy"], misconceptions: ["double root as extremum", "minimum vs maximum"] },
    { id: "fprime_graph_statements", topic: "5.9", skill: "2.D", calculator: "not_allowed", stimulus: "sign/monotonic data for f'", verifiedBy: ["interval logic"], misconceptions: ["swap max/min", "f' increasing read as f concave down", "extremum of f' as extremum of f"] },
    { id: "inflection_count", topic: "5.6", skill: "2.E", calculator: "not_allowed", stimulus: "factored second derivative", verifiedBy: ["sign chart in sympy"], misconceptions: ["counting every zero", "double zero"] },
    { id: "optimization", topic: "5.11", skill: "1.E", calculator: "not_allowed", stimulus: "region under a parabola", verifiedBy: ["numeric maximization"], misconceptions: ["x instead of area", "base x instead of 2x"] },
    { id: "riemann_table", topic: "6.2", skill: "2.B", calculator: "not_allowed", stimulus: "table of v(t)", verifiedBy: ["arithmetic recompute"], misconceptions: ["right sum", "trapezoid", "missing width"] },
    { id: "ftc_accum", topic: "6.4", skill: "1.D", calculator: "not_allowed", stimulus: "table of f", verifiedBy: ["FTC with chain rule recompute"], misconceptions: ["missing 2x", "f at x not x^2"] },
    { id: "prop_integrals", topic: "6.6", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["linearity recompute"], misconceptions: ["constant integral ignored/sign", "dropped factor"] },
    { id: "ftc_eval_calc", topic: "6.7", skill: "1.E", calculator: "required", stimulus: "non-elementary integrand", verifiedBy: ["scipy quad and Simpson"], misconceptions: ["rectangle", "integrand value", "u-substitution misuse"] },
    { id: "usub_integral", topic: "6.9", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["sympy integrate"], misconceptions: ["missing 1/2", "missing n+1", "limits not converted"] },
    { id: "slope_field_match", topic: "7.3", skill: "2.C", calculator: "not_allowed", stimulus: "table of slopes at grid points", verifiedBy: ["each option evaluated at every point"], misconceptions: ["fails at a listed point"] },
    { id: "separable_particular", topic: "7.7", skill: "1.E", calculator: "not_allowed", stimulus: "none", verifiedBy: ["sympy dsolve"], misconceptions: ["dropped initial condition", "linear solution", "antiderivative of x as x"] },
    { id: "avg_value_calc", topic: "8.1", skill: "1.E", calculator: "required", stimulus: "function and interval", verifiedBy: ["scipy quad"], misconceptions: ["no division", "endpoint average", "midpoint value"] },
    { id: "area_setup", topic: "8.4", skill: "1.D", calculator: "not_allowed", stimulus: "two curves", verifiedBy: ["each option integral evaluated numerically"], misconceptions: ["reversed order", "added functions", "wrong limit"] },
    { id: "volume_calc", topic: "8.7", skill: "1.D", calculator: "required", stimulus: "two curves, square cross sections", verifiedBy: ["scipy quad, intersection by brentq"], misconceptions: ["side not squared", "disks", "difference of squares"] },
    { id: "accum_context_calc", topic: "8.3", skill: "3.D", calculator: "required", stimulus: "rate function in context", verifiedBy: ["scipy quad"], misconceptions: ["initial amount forgotten", "rate times time", "sine term ignored"] },
  ],
  frqTemplates: [
    { id: "frq_table_rate", template: "table_rate_context_calc", topic: "6.2", extraTopics: ["2.3", "8.1"], skill: "2.B", calculator: "required", parts: "a difference quotient with units (2) / b trapezoidal sum + interpretation (3) / c average value of a model (2) / d IVT justification with continuity (2)", points: 9, verifiedBy: ["arithmetic recompute", "scipy quad vs Simpson"] },
    { id: "frq_fprime_graph", template: "fprime_graph_justify", topic: "5.9", extraTopics: ["5.6", "5.4"], skill: "3.E", calculator: "not_allowed", parts: "a concavity with reason (2) / b absolute minimum candidates (3) / c integral of f' by areas (2) / d product-rule derivative (2)", points: 9, verifiedBy: ["exact rational areas", "numeric quad"] },
    { id: "frq_diffeq", template: "differential_equation", topic: "7.7", extraTopics: ["7.3", "7.4"], skill: "1.E", calculator: "not_allowed", parts: "a slope-field inconsistency (1) / b slope at a point (1) / c tangent approximation and concavity (2) / d separation of variables chain (5)", points: 9, verifiedBy: ["sympy dsolve", "second-derivative sign"] },
    { id: "frq_area_volume", template: "area_volume_setup_calc", topic: "8.4", extraTopics: ["8.7", "8.8"], skill: "1.D", calculator: "required", parts: "a area (2) / b volume squares (2) / c washer setup about a horizontal line (3) / d parallel tangents (2)", points: 9, verifiedBy: ["brentq intersections", "sympy-parsed setup integral vs scipy"] },
  ],
  notation: ["Math in $...$ LaTeX; derivatives f'(x), dy/dx; integrals with differential dx", "decimals to three places for calculator answers; exact values for non-calculator", "use 'ln' for natural log; angles in radians", "units written in words (feet per second)", "functions named f, g, h, R, v, etc.; no calculator syntax (fnInt)"],
  calculatorRules: ["Part A style (no calculator): every value hand-computable; exact answers (fractions, multiples of pi, e powers kept symbolic)", "Part B style (calculator required): the problem is not solvable by hand in reasonable time (numerical integral, solving transcendental equation, derivative of an unfriendly function at a point)", "never mark calculator required for hand-trivial items", "calculator is used only for four things: graph, solve equation, numerical derivative, numerical integral — setup must be shown in FRQ"],
  stimulusTypes: [
    { kind: "table", howGenerated: "values computed by code from a function or chosen integers; rounded to the stated digits", howVerified: "recompute every cell; check the key from the table values only" },
    { kind: "graph", howGenerated: "data spec: vertices/intervals/signs of f' or f; figure rendered later from the spec", howVerified: "areas, zeros and signs recomputed from the vertices exactly (rationals); numeric quad cross-check" },
    { kind: "function", howGenerated: "closed forms with small integer parameters", howVerified: "sympy symbolic result vs numeric (central difference / Simpson / scipy)" },
    { kind: "slope_field", howGenerated: "slope values at grid points computed from the hidden differential equation", howVerified: "every option equation evaluated at every listed point; only the key matches all" },
  ],
  difficultyAllowed: ["more representation changes (table -> graph -> expression)", "an additional reasoning step", "a theorem hypothesis that must be checked", "choosing among procedures", "a misconception-rich option set"],
  difficultyBanned: ["long arithmetic or ugly numbers", "ambiguous wording or unstated assumptions", "extra reading load or irrelevant context", "BC or later-unit knowledge (series, parametric, Euler, parts)", "tricking with notation"],
  loadLimits: { mcSeconds: [45, 130], stemWordsMax: 100, mcOptions: 4, frqMinutes: 15, frqPoints: 9 },
  frqRubricPatterns: ["split every part into setup / answer / justification / units-interpretation rows", "a justification row names the condition to verify (continuous, differentiable, sign of f'/f'')", "a dependent row lists requires_row_id (e.g. antiderivative row requires the separation row)", "answer rows require supporting work; numeric rows carry tolerance (3 decimals, at most one rounding point lost)", "units rows never gate the computation row", "an interpretation row requires context words and units"],
  frqAccepted: ["equivalent integral forms (limits reversed with sign, shell/washer when equivalent)", "answers within 0.001 of the key; truncation or rounding to three decimals", "reasons stated as sign of f' or f'' on an interval, equivalent wording", "follow-through from an earlier incorrect part is allowed where the later logic is correct"],
  bannedTerms: [
    { pattern: "\\b(series|converge[sd]?|divergent|diverge[sd]?|Taylor|Maclaurin|parametric|polar|vector[- ]valued|Euler'?s method|logistic|integration by parts|partial fractions|arc length|improper integral|Lagrange error)\\b", why: "BC-only content" },
    { pattern: "\\b(epsilon|delta-proof|Rolle|Newton'?s method|Simpson)\\b", why: "outside AB course framework" },
    { pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" },
  ],
  validators: [
    { item: "mc", checks: ["four unique options; key index valid", "option values from code differ from the key value", "each wrong option has a named misconception", "no narrated errors, no length giveaway, parallel options", "table referenced in stem when a table stimulus exists", "skill assessed in MC (no 4.x/3.A/1.A/1.B)", "est_seconds 45-130, stem <= 100 words", "banned BC terms absent; calculator flag matches archetype", "wording preserved every number and $...$ block of the code-written stem"] },
    { item: "frq", checks: ["rows sum to part points; total = 9", "dependency references exist; skill codes official", "calculation parts have an answer row; justification parts have a reason row", "numeric rows carry values from code facts", "prompts preserve every number and math block", "est <= 18 minutes; stimulus present"] },
    { item: "set", checks: ["near-duplicate gate across adopted items (3-gram Jaccard > 0.8, exact duplicate)", "no more than two items per archetype adopted per set (diversity)"] },
  ],
  acceptExamples: [
    { title: "f' sign data (2.D)", text: "f' is positive on (0,2), negative on (2,5), positive on (5,9) and increasing on (3.5,6.5): f has a local maximum at 2, a local minimum at 5, and is concave up on (3.5,6.5). Distractors swap max/min, read f' increasing as concave down, and treat the minimum of f' as an extremum of f." },
    { title: "product rule from a table (1.E)", text: "Table gives f, f', g, g' at a point; h = f g + c f. Key from the product rule plus constant multiple; distractors f'g', missing f g', c f instead of c f'." },
  ],
  rejectExamples: [
    { title: "formula plug repetition", text: "Evaluate the integral of (a x^2 + b x) from 0 to 1 for five different (a,b).", reason: "same skill and structure repeated; no representation change (1.E)" },
    { title: "BC drift", text: "Determine whether sum of (-1)^n n/(n^2+3) converges.", reason: "series are BC-only" },
    { title: "needless computation", text: "f(x)=(x^2+1)^7 e^{3x} sin 2x, find f''(0.37).", reason: "difficulty from arithmetic, not concepts" },
  ],
};

export const unitOfTopic = (topic: string) => topic.split(".")[0];
export const archetypeById = (id: string) => calcAbGuide.archetypes.find((a) => a.id === id);

/** 파이프라인 프롬프트: 가이드에서 생성한 문장 작성 시스템 지침(문장 다듬기 호출). */
export function guideWordingRules(): string {
  const g = calcAbGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Calculator rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}. Out-of-scope for AB (BC content) such as ${g.bannedTerms[0].pattern.replace(/\\b|\(|\)|\?/g, "").split("|").slice(0, 8).join(", ")} must not appear.`,
  ].join("\n");
}
export function guideReviewRules(unit: string): string {
  const u = calcAbGuide.units.find((x) => x.unit === unit);
  return u ? `UNIT ${u.unit} SCOPE for AB — in scope: ${u.inScope.join("; ")}. OUT of scope for AB: ${u.outOfScope.join("; ")}. Difficulty levers allowed: ${calcAbGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${calcAbGuide.difficultyBanned.join("; ")}.` : "";
}
