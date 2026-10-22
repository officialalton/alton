import type { ArchetypeSpec, FrqTemplateSpec, SkillRule, SubjectGuide, UnitScope } from "./types";
import csaArchetypes from "./csa-archetypes.json";
import curriculum from "../../../data/ap/curriculum-2027/ap_computer_science_a.json";

// AP Computer Science A(2027 시험, 4단원) 생성 가이드 설정 — 본문: docs/ap/csa-groundwork.md. 정답은 Python 원형(scripts/ap-generation/archetypes/csa_p0_*.py)이 만들고
// 실제 javac/java 실행(csa_java.py)으로 확정하며, 독립 Python 참조가 정답을 다시 계산한다. 원형 목록(csa-archetypes.json)의 원천은 `registry.py guide-csa`.
// 단원·스킬 코드와 MC 단원 가중은 data/ap/curriculum-2027/ap_computer_science_a.json(CED 전사). 근거: docs/ap/csa-facts.md.

type Wt = { axis: string; code: string; section: string; min: number; max: number };
const weights = (curriculum as unknown as { weights: Wt[] }).weights;
const mcWeight = (u: string): [number, number] => { const w = weights.find((x) => x.axis === "unit" && x.code === u && x.section === "mc"); return w ? [w.min, w.max] : [0, 0]; };

// 범위 밖 항목은 CED 토픽 목록에 해당 학습 목표가 없다는 근거(상속·다형성은 2027 토픽 목록에 없다 — csa-facts.md §3).
const OUT_OF_SCOPE: Record<string, string[]> = {
  "1": ["console input with Scanner", "printf and String.format", "the Character and Integer wrapper helper methods beyond those on the Java Quick Reference"],
  "2": ["switch statements", "labeled break and continue", "do-while loops as a required construct"],
  "3": ["inheritance, polymorphism, abstract classes and interfaces (no topic in the 2027 topic list)", "inner classes and generics written by students"],
  "4": ["collections other than ArrayList (HashMap, LinkedList, Set)", "the Arrays and Collections utility classes inside student-written code", "lambda expressions and streams"],
};
const units: UnitScope[] = (curriculum as unknown as { units: { code: string; title: string; topics: { code: string; title: string }[] }[] }).units.map((u) => ({
  unit: u.code, title: u.title, mcWeight: mcWeight(u.code), inScope: u.topics.map((t) => `${t.code} ${t.title}`), outOfScope: OUT_OF_SCOPE[u.code] ?? [],
}));

const sk = (code: string, name: string, mc: boolean, frq: boolean, designRules: string[], banned: string[] = []): SkillRule => ({ code, name, mc, frq, designRules, banned });
const skills: SkillRule[] = [
  sk("1.A", "Determine an appropriate program design", true, false, ["not code-verifiable; not part of the pilot library"]),
  sk("1.B", "Determine what knowledge can be extracted from data", true, false, ["not code-verifiable; not part of the pilot library"]),
  sk("2.A", "Write program code to implement an algorithm", true, true, ["code completion: every candidate is compiled and run against boundary tests; exactly one passes all", "FRQ: write a method with loops and conditionals"]),
  sk("2.B", "Write program code involving data abstractions", true, true, ["complete or write a constructor, instance variables or a method of a class"]),
  sk("2.C", "Write program code involving procedural abstractions", true, true, ["use a helper method correctly (argument, return value, reuse)"]),
  sk("3.A", "Determine result or output from statement execution order", true, false, ["trace statements; options are the outputs of mutated code that embodies a named misconception"]),
  sk("3.B", "Determine result or output from code with data abstractions", true, false, ["trace object, array, ArrayList or 2D array state"]),
  sk("3.C", "Determine result or output from code with procedural abstractions", true, false, ["trace method calls, parameter passing and recursion"]),
  sk("3.D", "Explain why code will not compile or work as intended and correct it", true, false, ["compile-time error: candidates are compiled; logic error: candidate fixes are run against tests"]),
  sk("4.A", "Describe the behavior of a code segment or program", true, false, ["each English description has a Python predicate; the key holds on every test input and each distractor fails on one"]),
  sk("4.B", "Describe initial conditions needed for code to work as intended", true, false, ["each option call is run; exactly one violates the method's hidden assumption"]),
  sk("5.A", "Explain how computing impacts society, economy and culture", true, false, ["not code-verifiable; not part of the pilot library"]),
];

export const csaGuide: SubjectGuide = {
  subject: "ap_computer_science_a",
  guideDoc: "docs/ap/csa-groundwork.md",
  examStructure: "2027: fully digital in Bluebook. MC 42 questions/90 min (single-answer, four options, mostly discrete questions with occasional two-question sets), 55%; FRQ 4 questions/90 min, 45%, 7/7/5/6 points (25 points): Methods and Control Structures, Class Design, Data Analysis with ArrayList, 2D Array. All FRQs assess Practice 2 (Develop Code). The Java Quick Reference is provided; calculators are not part of the exam. MC unit weights: Unit 1 15-25%, Unit 2 25-35%, Unit 3 10-18%, Unit 4 30-40%.",
  units,
  skills,
  archetypes: csaArchetypes as ArchetypeSpec[],
  frqTemplates: [
    { id: "csf_methods_pass", template: "q1", topic: "2.10", extraTopics: ["1.15", "2.9"], skill: "2.A", calculator: "not_allowed", parts: "A count characters with a loop(3) / B call part A inside conditional logic(4)", points: 7, verifiedBy: ["reference, alternative and three wrong solutions per part compiled and run on shared tests; expected values from Python"] },
    { id: "csf_methods_runs", template: "q1", topic: "2.8", extraTopics: ["1.15", "2.10"], skill: "2.A", calculator: "not_allowed", parts: "A count adjacent equal characters(3) / B squeeze runs into one character(4)", points: 7, verifiedBy: ["reference, alternative and wrong solutions run on shared tests; expected values from Python"] },
    { id: "csf_class_steps", template: "q2", topic: "3.3", extraTopics: ["3.4", "3.5"], skill: "2.B", calculator: "not_allowed", parts: "A write the whole class: header, private state, constructor, update, accessor, guarded average(7)", points: 7, verifiedBy: ["reference and a different internal representation pass a call-sequence test suite; expected from a Python simulation"] },
    { id: "csf_class_counter", template: "q2", topic: "3.3", extraTopics: ["3.4", "3.5"], skill: "2.B", calculator: "not_allowed", parts: "A write the whole class: limit, guarded increment returning boolean, reset, remaining(7)", points: 7, verifiedBy: ["reference and a count-down alternative pass a call-sequence test suite; expected from a Python simulation"] },
    { id: "csf_list_above", template: "q3", topic: "4.10", extraTopics: ["4.8", "4.9"], skill: "2.A", calculator: "not_allowed", parts: "A return the values above the average of an ArrayList without changing it(5)", points: 5, verifiedBy: ["reference and an alternative pass list tests including input immutability; expected from Python"] },
    { id: "csf_list_reviews", template: "q3", topic: "4.10", extraTopics: ["4.9", "1.15"], skill: "2.A", calculator: "not_allowed", parts: "A average stars of reviews whose text contains a word(5)", points: 5, verifiedBy: ["reference and a manual-scan alternative pass tests; expected from Python"] },
    { id: "csf_2d_best_row", template: "q4", topic: "4.13", extraTopics: ["4.12"], skill: "2.A", calculator: "not_allowed", parts: "A index of the row with the largest sum, ties to the smaller index(6)", points: 6, verifiedBy: ["reference and a separate-sums alternative pass grid tests including negatives and ties; expected from Python"] },
    { id: "csf_2d_shift", template: "q4", topic: "4.13", extraTopics: ["4.12", "4.11"], skill: "2.A", calculator: "not_allowed", parts: "A new array with every row shifted right with wrap-around(6)", points: 6, verifiedBy: ["reference and an explicit-first-column alternative pass grid tests; expected from Python list rotation"] },
    // 2026-10-13: 두 번째 풀 모의고사(겹침 0)·보충용 새 시나리오 8개(유형마다 2개) — csa_p0_frq2.py
    { id: "csf_methods_leap", template: "q1", topic: "2.9", extraTopics: ["2.5", "2.3"], skill: "2.A", calculator: "not_allowed", parts: "A leap-year test with a compound condition(3) / B days in a month calling part A(4)", points: 7, verifiedBy: ["reference, table-lookup alternative and six wrong solutions compiled and run on shared tests; expected values from Python"] },
    { id: "csf_methods_digits", template: "q1", topic: "2.7", extraTopics: ["2.9", "1.10"], skill: "2.A", calculator: "not_allowed", parts: "A sum of the digits of n with a while loop(3) / B digital root calling part A(4)", points: 7, verifiedBy: ["reference, String/recursion alternative and six wrong solutions compiled and run on shared tests; expected values from Python"] },
    { id: "csf_class_scoreboard", template: "q2", topic: "3.3", extraTopics: ["3.4", "3.5"], skill: "2.B", calculator: "not_allowed", parts: "A write the whole class: target, two scores, mutators, three-way leader, isOver(7)", points: 7, verifiedBy: ["reference and a score-array alternative pass a call-sequence test suite; expected from a Python simulation"] },
    { id: "csf_class_stock", template: "q2", topic: "3.3", extraTopics: ["3.4", "3.5"], skill: "2.B", calculator: "not_allowed", parts: "A write the whole class: name, quantity, accessors, restock, guarded sell returning boolean(7)", points: 7, verifiedBy: ["reference and a received/sold alternative pass a call-sequence test suite; expected from a Python simulation"] },
    { id: "csf_list_runs", template: "q3", topic: "4.10", extraTopics: ["4.8", "4.9"], skill: "2.A", calculator: "not_allowed", parts: "A length of the longest run of equal neighbors in an ArrayList(5)", points: 5, verifiedBy: ["reference and a nested-scan alternative pass list tests including values above 127; expected from Python"] },
    { id: "csf_list_remove_short", template: "q3", topic: "4.10", extraTopics: ["4.8", "4.9"], skill: "2.A", calculator: "not_allowed", parts: "A remove Strings shorter than a minimum from an ArrayList in place(5)", points: 5, verifiedBy: ["reference and an index-advancing alternative pass list tests; wrong solutions include the forward-removal skip; expected from Python"] },
    { id: "csf_2d_border", template: "q4", topic: "4.13", extraTopics: ["4.12"], skill: "2.A", calculator: "not_allowed", parts: "A sum of the border elements of a 2D array, each counted once(6)", points: 6, verifiedBy: ["reference and a total-minus-interior alternative pass grid tests including one-row and one-column arrays; expected from Python"] },
    { id: "csf_2d_transpose", template: "q4", topic: "4.13", extraTopics: ["4.12", "4.11"], skill: "2.A", calculator: "not_allowed", parts: "A new array that is the transpose of a rectangular 2D array(6)", points: 6, verifiedBy: ["reference and a column-first alternative pass non-square grid tests; expected from Python zip"] },
    // 2026-10-21: CS4·CS5 5세트 채우기용 새 시나리오 7개 — csa_p0_t5f.py
    { id: "csf_methods_harshad", template: "q1", topic: "2.10", extraTopics: ["1.9", "2.9"], skill: "2.A", calculator: "not_allowed", parts: "A sum of the digits with a while loop(3) / B first integer divisible by its digit sum calling part A(4)", points: 7, verifiedBy: ["reference, String alternative and six wrong solutions compiled and run on shared tests; expected values from Python"] },
    { id: "csf_methods_words", template: "q1", topic: "2.10", extraTopics: ["1.15", "2.9"], skill: "2.A", calculator: "not_allowed", parts: "A count the words of a String(3) / B longest word with indexOf and substring(4)", points: 7, verifiedBy: ["reference, scan alternative and six wrong solutions compiled and run on shared tests; expected values from Python"] },
    { id: "csf_class_battery", template: "q2", topic: "3.5", extraTopics: ["3.4", "3.6"], skill: "2.B", calculator: "not_allowed", parts: "A write the whole class: level, recharge count, limited use returning the amount used, recharge, isLow(7)", points: 7, verifiedBy: ["reference and an alternative representation pass a call-sequence test suite; expected from a Python simulation"] },
    { id: "csf_list_avg_positive", template: "q3", topic: "4.10", extraTopics: ["4.8", "4.9"], skill: "2.A", calculator: "not_allowed", parts: "A average of the positive Integer values of an ArrayList as a double, 0.0 if none(5)", points: 5, verifiedBy: ["reference and an enhanced-for alternative pass list tests including empty and all-negative lists; expected from Python"] },
    { id: "csf_list_keep_first", template: "q3", topic: "4.10", extraTopics: ["4.8", "4.9"], skill: "2.A", calculator: "not_allowed", parts: "A remove later duplicates of Strings from an ArrayList in place(5)", points: 5, verifiedBy: ["reference and a nested-scan alternative pass list tests; wrong solutions include the forward-removal skip; expected from Python"] },
    { id: "csf_2d_flip_rows", template: "q4", topic: "4.12", extraTopics: ["4.13"], skill: "2.A", calculator: "not_allowed", parts: "A new array in which every row is reversed, grid unchanged(6)", points: 6, verifiedBy: ["reference and a column-first alternative pass non-square grid tests including input immutability; expected from Python"] },
    { id: "csf_2d_column_min", template: "q4", topic: "4.12", extraTopics: ["4.13", "4.5"], skill: "2.A", calculator: "not_allowed", parts: "A one-dimensional array of the smallest value in each column(6)", points: 6, verifiedBy: ["reference and a Math.min alternative pass grid tests including negatives and single rows or columns; expected from Python"] },
  ] as FrqTemplateSpec[],
  notation: ["Java code is shown in a fenced code block and rendered monospaced with line numbers; short code in options and prose uses single backticks", "no dollar signs, double underscores or backslashes in code text (they collide with the math and underline syntax of the renderer)", "output prediction options show exactly what the program prints; an exception option names the exception class", "identifiers follow Java conventions; class names are nouns, methods are verbs"],
  calculatorRules: ["no calculator is part of the exam; never make arithmetic the only demand", "numeric options: non-integer values at least 8 percent apart; integers must differ exactly and values above 12 must be at least 8 percent apart", "every wrong option is the result of executing mutated code that embodies a named misconception (off-by-one, integer division, aliasing, short-circuit, shadowing, shifting while removing, and similar)", "code completion and bug-fix options are compiled and run against boundary tests; exactly one passes all tests"],
  stimulusTypes: [
    { kind: "text", howGenerated: "Java source in a fenced code block (stimulus.description holds the fence; data.variant is java_code)", howVerified: "the displayed code is re-executed by the test suite and its output must equal the key" },
    { kind: "none", howGenerated: "short questions whose options are calls, expressions or statements", howVerified: "every option is compiled or run with the JDK" },
  ],
  difficultyAllowed: ["tracing a loop with a changed bound or step", "an alias, a copy or a shadowed variable", "an off-by-one at a boundary that the code makes plausible", "an integer-division or casting subtlety", "choosing the correct completion among near-miss candidates"],
  difficultyBanned: ["long mechanical traces beyond 12 steps", "ambiguous or version-dependent Java behavior", "unspecified preconditions", "irrelevant context or extra reading load", "reproducing a College Board sample item", "inheritance and polymorphism (not in the 2027 topic list)"],
  loadLimits: { mcSeconds: [45, 130], stemWordsMax: 100, mcOptions: 4, frqMinutes: 22, frqPoints: 7 },
  frqRubricPatterns: ["analytic rows worth one point each, one behavior per row (loop bounds, condition, accumulation, return, guard, header)", "a later row can depend on an earlier row (requires_row_id)", "equivalent code is accepted; a different valid algorithm earns the same rows"],
  frqAccepted: ["any compiling implementation with the same observable behavior", "different but equivalent loop forms", "different internal representation of class state"],
  bannedTerms: [
    { pattern: "AP\\s*[345]|level 5|score of [345]", why: "never label items by AP score level" },
    { pattern: "\\b(extends|super\\(|polymorphi\\w*|abstract class)\\b", why: "inheritance and polymorphism are not in the 2027 topic list" },
  ],
  validators: [
    { item: "mc", checks: ["four unique options; key index valid", "each wrong option has a named misconception", "non-integer numeric options at least 8 percent apart", "no dollar signs or double underscores in code or options", "skill is one of 2.A-2.C 3.A-3.D 4.A 4.B in the pilot library", "est_seconds within 45 to 130"] },
    { item: "frq", checks: ["total points equal the official question value (Q1 7, Q2 7, Q3 5, Q4 6)", "rubric rows sum to each part's points", "reference and alternative solutions pass every self-check test", "each wrong solution fails at least one test of its part"] },
  ],
  acceptExamples: [
    { title: "trace with a named misconception", text: "A loop removes elements from an ArrayList while moving forward; the distractors are the results of the loop that revisits shifted elements, stops at the original size, or removes only the first match." },
    { title: "completion verified by tests", text: "Four candidate bodies for a method are each compiled in place and run on boundary arrays; exactly one passes every test." },
  ],
  rejectExamples: [
    { title: "unverified answer", text: "A hand-written output prediction whose key was not produced by running the code.", reason: "every key must come from javac/java" },
    { title: "out-of-scope content", text: "Which subclass method is called when the reference has the superclass type?", reason: "inheritance and polymorphism are not in the 2027 topic list" },
  ],
};

export function csaWordingRules(): string {
  const g = csaGuide;
  return [
    `SUBJECT GUIDE (${g.guideDoc}). Exam structure: ${g.examStructure}`,
    `Notation: ${g.notation.join("; ")}.`,
    `Style rules: ${g.calculatorRules.join("; ")}.`,
    `Never use: ${g.difficultyBanned.join("; ")}.`,
  ].join("\n");
}
