// 결과 화면 "Results by Domain"에서 영역·스킬 이름을 누르면 보여주는 짧은 영어 설명(2026-10-02 오너 UAT B4).
// ALTON 자체 문장이다(College Board 문구를 옮기지 않는다). 키는 lib/problem-taxonomy 의 도메인·스킬 코드.

export const SAT_DOMAIN_DESCRIPTIONS: Record<string, string> = {
  algebra:
    "Building and solving linear equations, inequalities, and systems, and reading what their slopes, intercepts, and solutions mean in a real situation.",
  advanced_math:
    "Working with nonlinear relationships: rewriting expressions, solving quadratic and other nonlinear equations, and interpreting their graphs.",
  problem_solving_data:
    "Using ratios, rates, percentages, and data displays to reason about quantities, compare groups, and judge how far a conclusion can go.",
  geometry_trig:
    "Measuring shapes and solids, using angle and triangle relationships, applying right-triangle trigonometry, and working with circles.",
  rw_information_ideas:
    "Understanding what a text says: finding its main point, drawing logical conclusions, and choosing the evidence that best supports a claim.",
  rw_craft_structure:
    "Reading like a writer: figuring out word meaning from context, why a passage is organized the way it is, and how two texts relate.",
  rw_expression_ideas:
    "Revising for clear communication: choosing the transition that fits the logic and combining notes into a sentence that meets a stated goal.",
  rw_standard_english:
    "Editing for standard written English: punctuation between clauses and phrases, plus agreement, verb forms, and other grammar rules.",
};

export const SAT_SKILL_DESCRIPTIONS: Record<string, string> = {
  // Algebra
  linear_equations_one_var:
    "Set up and solve an equation with a single unknown, and decide what the solution (or the lack of one) tells you about the situation.",
  linear_functions:
    "Connect a linear function's equation, table, and graph, and explain what its rate of change and starting value represent.",
  linear_equations_two_var:
    "Write and interpret an equation that relates two quantities changing at a constant rate, including the equation of a line.",
  systems_linear:
    "Solve two linear equations together, and recognize when a system has one solution, no solution, or infinitely many.",
  linear_inequalities:
    "Model limits such as budgets or minimums with inequalities and identify which values or regions satisfy them.",
  // Advanced Math
  equivalent_expressions:
    "Rewrite expressions by factoring, expanding, or combining terms so that a useful form or hidden structure becomes visible.",
  nonlinear_equations_systems:
    "Solve quadratic, radical, rational, and other nonlinear equations, including systems that mix a line with a curve.",
  nonlinear_functions:
    "Interpret quadratic, exponential, and polynomial functions: their vertices, intercepts, growth or decay, and graphs.",
  // Problem-Solving and Data Analysis
  ratios_rates_units:
    "Reason with ratios, rates, and proportions, and convert between units without losing track of what each number measures.",
  percentages:
    "Find percents of quantities and calculate percent increase, decrease, and repeated percent change.",
  one_variable_data:
    "Describe a single data set with mean, median, range, and spread, and read histograms, box plots, and dot plots.",
  two_variable_data:
    "Read scatterplots and tables of paired data, and use a line or curve of fit to describe and predict a relationship.",
  probability:
    "Compute the chance of an event from counts or a two-way table, including probabilities limited to one group.",
  inference_margin_error:
    "Use a random sample's results to estimate a population value and explain what a margin of error does and does not say.",
  evaluating_statistical_claims:
    "Judge whether a study's design supports its conclusion, such as whether it can show cause and effect or be generalized.",
  // Geometry and Trigonometry
  area_volume:
    "Calculate perimeter, area, surface area, and volume, and see how they change when a figure is scaled.",
  lines_angles_triangles:
    "Use parallel lines, angle sums, and congruent or similar triangles to find unknown angles and lengths.",
  right_triangles_trigonometry:
    "Apply the Pythagorean theorem, special right triangles, and sine, cosine, and tangent to find missing sides and angles.",
  circles:
    "Work with radius, arcs, sectors, chords, tangents, and the equation of a circle in the coordinate plane.",
  // Information and Ideas
  central_ideas_details:
    "Identify the main point of a passage and the details that develop it, without being distracted by true but minor facts.",
  inferences:
    "Choose the conclusion that follows most logically from the information given, going no further than the text allows.",
  command_of_evidence_text:
    "Pick the quotation or finding that best supports, weakens, or illustrates a specific claim about a text.",
  command_of_evidence_quant:
    "Use data from a table or graph to complete or support a claim, reading exactly what the numbers show.",
  // Craft and Structure
  words_in_context:
    "Choose the word or phrase that fits the precise meaning and tone a sentence needs, using clues from the surrounding text.",
  text_structure_purpose:
    "Explain why the author wrote a passage or a sentence and how its parts are arranged to serve that purpose.",
  cross_text_connections:
    "Compare two short texts on a related topic and predict how one author would respond to the other's view.",
  // Expression of Ideas
  rhetorical_synthesis:
    "Turn a list of notes into a sentence that accomplishes a stated goal, such as emphasizing a contrast or introducing a study.",
  transitions:
    "Select the connecting word or phrase that shows the right logical link between ideas, such as contrast, cause, or example.",
  // Standard English Conventions
  boundaries:
    "Punctuate correctly where sentences, clauses, and phrases meet, using periods, commas, semicolons, colons, and dashes.",
  form_structure_sense:
    "Apply grammar rules for subject-verb agreement, pronouns, verb tense, plurals and possessives, and modifier placement.",
};

export const satDomainDescription = (code: string | null | undefined) => (code ? SAT_DOMAIN_DESCRIPTIONS[code] ?? null : null);
export const satSkillDescription = (code: string | null | undefined) => (code ? SAT_SKILL_DESCRIPTIONS[code] ?? null : null);
