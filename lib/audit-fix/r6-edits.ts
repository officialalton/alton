// 라운드 6 패치 정의(순수): 새 AP 9과목×2회차(18세트) 외부 감사(Codex, 2026-10-15) 검증 결과.
// 규칙은 r2/r5 와 같다: old 는 항상 현재 DB 공개본 값, 편집 대상 문구가 정확히 한 번 없으면 예외. FRQ 참고답은 explanation / explanation_en 에 같은 문안으로 들어 있어 둘 다 고친다.
// 이 라운드는 statements(FRQ 소문항 지시문)도 고친다.
import type { Patch } from "./plan";
import { rep, repN } from "./r2-edits";

export type Stmt = { label: string; mode: string; points: number; prompt: string };
export type F6 = { passage: string | null; question: string | null; options: string[] | null; correct_index: number | null; explanation: string | null; explanation_en: string | null; figure: unknown; statements: unknown };
type Out6 = Partial<F6>;
export type EditDef6 = { id: string; problemId: string; csv: string; why: string; validation: string; edit: (c: F6) => Out6 };

/** explanation 과 explanation_en 에 같은 치환을 한 번씩 적용(두 필드의 본문이 같다). */
export function both(c: F6, pairs: ([string, string] | [string, string, number])[], label: string): Pick<F6, "explanation" | "explanation_en"> {
  let ko = c.explanation, en = c.explanation_en;
  pairs.forEach(([from, to, n], i) => { ko = repN(ko, from, to, n ?? 1, `${label}-ex${i}`); en = repN(en, from, to, n ?? 1, `${label}-en${i}`); });
  return { explanation: ko, explanation_en: en };
}
/** 소문항(label) 의 prompt 에 문자열 치환. */
export function stmt(c: F6, label: string, from: string, to: string, id: string): Stmt[] {
  const ss = c.statements as Stmt[]; if (!ss.some((s) => s.label === label)) throw new Error(`${id}: statement ${label} not found`);
  return ss.map((s) => (s.label === label ? { ...s, prompt: rep(s.prompt, from, to, `${id}-stmt${label}`) } : s));
}
const opts = (c: F6, map: Record<number, string>) => c.options!.map((o, i) => (i in map ? map[i] : o));

export const EDITS6: EditDef6[] = [
  // ───────── P1 ─────────
  { id: "R6-STAT2-MC28", problemId: "74b5384e-aae6-4ca7-acf7-e693ca0bbcbd", csv: "P1 Statistics 2 MC28",
    why: "Options C (independence) and D (same conditional distribution of news preference in all 3 age groups) state the same null hypothesis (both df 6) for one SRS classified on two variables, so two options are correct.",
    validation: "D replaced by the alternative hypothesis misstated as the null ('... are associated ...; df = 6'), which is not equivalent to C (it is the negation of C). Only C (independent in the population, df 6) is correct; A (df 11) and B (sample, not population) unchanged; key stays C. Explanation line for D rewritten (Korean-free, same text in explanation_en).",
    edit: (c) => ({
      options: opts(c, { 3: "$H_0$: age group and preferred way to read the news are associated in the population of adult residents of a county; $df = 6$" }),
      ...both(c, [["$H_0$: the distribution of preferred way to read the news is the same for all $3$ age groups in the population of adult residents of a county; $df = 6$ is incorrect: Describes a test of homogeneity, which is for separate samples from several populations; here one sample was classified on both variables.",
        "$H_0$: age group and preferred way to read the news are associated in the population of adult residents of a county; $df = 6$ is incorrect: States the alternative hypothesis (an association) as the null hypothesis; the null hypothesis of a chi-square test of independence says there is no association."]], "S28"),
    }) },
  { id: "R6-CSA2-FRQ4", problemId: "660364db-1156-4d7c-99d7-57ea9c6b9212", csv: "P1 Computer Science A 2 FRQ4 reference code",
    why: "The reference bestRow initialises bestSum to the fixed sentinel -1000000, so grid = {{-2000000},{-1500000}} returns row 0 instead of row 1 although the precondition allows any int elements (reproduced with JDK 21; see scripts/audit/r6-java/GridStats.java).",
    validation: "The best row is now initialised from the first row's real sum (`r == 0 || sum > bestSum`), strict > keeps the smallest index on ties. Compiled and run with OpenJDK 21.0.12: spec example, large negatives, negative ties, single row, all-tie, zeros and 200,000 random grids match an independent long-sum oracle (old code: 1,284 mismatches; new: 0). Rubric line reworded to match.",
    edit: (c) => ({ ...both(c, [
      ["        int best = 0;\n        int bestSum = -1000000;\n        for (int r = 0; r < grid.length; r++) {", "        int best = 0;\n        int bestSum = 0;\n        for (int r = 0; r < grid.length; r++) {"],
      ["            if (sum > bestSum) {", "            if (r == 0 || sum > bestSum) {"],
      ["Keeps track of the largest row sum seen so far, initialized so negative sums work", "Keeps track of the largest row sum seen so far, initialized so that negative sums work (for example from the first row's sum or with Integer.MIN_VALUE, not an arbitrary fixed value such as -1000000)"],
    ], "CSA4") }) },
  // ───────── P2: multiple-choice stems ─────────
  { id: "R6-PHYS1-MC9", problemId: "b6d4eaa9-9661-4b23-9b56-33c86e25a0fd", csv: "P2 Physics 1 Exam 1 MC9",
    why: "'slides down' does not say the block speeds up; a block moving down while slowing has a negative signed g(sin - mu cos), so the key is the magnitude only when the block accelerates down.",
    validation: "Stem now says the block is released from rest and accelerates down the incline (so sin(theta) > mu cos(theta) and g(sin - mu cos) > 0 is the magnitude). Options and key D unchanged; explanation states the condition.",
    edit: (c) => ({
      question: rep(c.question, "A block of mass $m$ slides down a rough incline that makes an angle $\\theta$ with the horizontal.", "A block of mass $m$ is released from rest on a rough incline that makes an angle $\\theta$ with the horizontal, and it accelerates down the incline.", "PH9q"),
      ...both(c, [["combining them gives $a=g(\\sin\\theta-\\mu\\cos\\theta)$.", "combining them gives $a=g(\\sin\\theta-\\mu\\cos\\theta)$. Because the block is released from rest and accelerates down the incline, $\\sin\\theta>\\mu\\cos\\theta$, so this expression is positive and equals the magnitude of the acceleration."]], "PH9"),
    }) },
  { id: "R6-MICRO1-MC53", problemId: "ce9ec65e-9f24-436a-a8ac-c2af6df55454", csv: "P2 Microeconomics 1 MC53",
    why: "The stem gives only the MRP of the LAST worker hired (30 > wage 26); with diminishing marginal product the NEXT worker's MRP is not implied (official discrete-worker rubrics stop hiring when the next MRP falls below the wage), so 'hire more' did not follow.",
    validation: "Stem now gives the MRP of the next worker the firm could hire (30 vs wage 26), which makes 'hire more workers' correct and the reason in option D exactly the stated fact. Options and key D unchanged; explanation rewritten around the next worker.",
    edit: (c) => ({
      question: rep(c.question, "The marginal revenue product of its last worker is \\$30.", "The marginal revenue product of the next worker it could hire is \\$30.", "M53q"),
      ...both(c, [["here MRP is \\$30 and the wage is \\$26, so it should adjust employment accordingly.", "the next worker would add \\$30 of revenue but cost only the \\$26 wage, so hiring that worker raises profit and the firm should hire more workers."]], "M53"),
    }) },
  { id: "R6-MACRO1-MC28", problemId: "5885525e-029f-4d59-b3fd-f248ba74dbd6", csv: "P2 Macroeconomics 1 MC28",
    why: "The answer depends on which M1 definition applies: the older definition leaves savings out of M1 (key B), the current Federal Reserve H.6 definition includes savings deposits in M1 (then neither aggregate changes, no option).",
    validation: "The stem now states the definitions used (M1 = currency + checkable deposits; M2 = M1 + savings deposits, small time deposits, retail money market funds), under which B is the only correct option. Options and key B unchanged; explanation says 'under the definitions given'.",
    edit: (c) => ({
      question: rep(c.question, "A household moves $1,000", "Use these definitions: M1 is currency in circulation plus checkable (demand) deposits, and M2 is M1 plus savings deposits, small time deposits, and retail money market funds. A household moves \\$1,000", "MAC28q"),
      ...both(c, [["Savings deposits are in M2 but not M1, so the move lowers M1 and leaves M2 unchanged.", "Under the definitions given, savings deposits are in M2 but not in M1, so the move lowers M1 and leaves M2 unchanged."]], "MAC28"),
    }) },
  { id: "R6-CHEM2-MC29", problemId: "e45902d7-9d9c-4c98-a72c-dcd21a7000b0", csv: "P2 Chemistry 2 MC29",
    why: "The stem does not say how to treat the discordant trial: averaging all three gives 21.07 mL (an option), averaging the two concordant trials gives 21.43 mL (the key).",
    validation: "The stem now states the outlier rule (a trial differing from the other two by more than 0.50 mL is excluded before averaging); trial 2 (20.35 mL) differs by about 1.05 mL, trials 1 and 3 (21.45, 21.40) agree within 0.05 mL, so 21.43 mL is the only value that follows. Options and key A unchanged.",
    edit: (c) => ({
      question: rep(c.question, "(table). Which value", "(table). Treat any trial whose delivered volume differs from the other two by more than $0.50\\text{ mL}$ as an outlier and leave it out, then average the remaining trials. Which value", "C29q"),
      ...both(c, [["Trial 2 is far from the other two, so the best estimate is the average of the closest pair,", "Trial 2 differs from the other two by more than 0.50 mL, so by the stated rule it is left out, and the best estimate is the average of the other two trials,"]], "C29"),
    }) },
  ...["58", "59", "60"].map<EditDef6>((pos, i) => {
    const ids = ["6e7e25f1-b0f0-4b2a-9d48-d60aa25e3498", "fed394b6-24d0-41d6-b465-6e266d227fa4", "5239ef26-b201-478a-829b-33096f21ecd5"];
    return { id: `R6-PSY2-MC${pos}`, problemId: ids[i], csv: "P2 Psychology 2 MC58-60",
      why: "Shared table: n = 30 per condition cannot produce 85% or 62% (25/30 = 83.3%, 26/30 = 86.7%; 18/30 = 60%, 19/30 = 63.3%).",
      validation: "Table now shows 83% (25/30), 63% (19/30), 40% (12/30), rounded to whole percents, with a note; decrease direction, key and every option unchanged. MC60 explanation updated (83% to 63% to 40%; range 40% to 83%). figure_checked becomes false (table cells only).",
      edit: (c) => {
        const f = JSON.parse(JSON.stringify(c.figure)) as { rows: string[][]; notes?: string[] };
        if (f.rows[0][2] !== "85%" || f.rows[1][2] !== "62%" || f.rows[2][2] !== "40%") throw new Error("PSY2 table drifted");
        f.rows[0][2] = "83%"; f.rows[1][2] = "63%"; f.notes = ["Percentages are rounded to the nearest whole percent (25, 19, and 12 of the 30 students in each condition)."];
        return { figure: f, ...(pos === "60" ? both(c, [["The percentages fall from 85% to 62% to 40%.", "The percentages fall from 83% to 63% to 40%."], ["Between 40% and 85% of students sought help.", "Between 40% and 83% of students sought help."]], "PSY60") : {}) };
      } };
  }),
  // ───────── P2: FRQ prompts and reference answers ─────────
  { id: "R6-STAT2-FRQ1C", problemId: "58571074-1835-4031-a86b-91d697e02e1a", csv: "P2 Statistics 2 FRQ1C",
    why: "The explanatory variable is exercise before school and the response is homework time 'the previous night', so a morning treatment cannot cause an earlier evening's outcome unless the protocol orders them.",
    validation: "Part C prompt now states the protocol: the routine is assigned and followed for several weeks, then each volunteer reports homework minutes for the previous night (so treatment precedes the measured night and the response is still 'the previous night'); reference answer and rubric point say the cause-and-effect conclusion rests on assignment preceding measurement plus random assignment. Parts A, B, D, E and all point values unchanged.",
    edit: (c) => ({
      statements: stmt(c, "C", "The researcher is considering an experiment with $80$ volunteers from all students at the school. (i)", "The researcher is considering an experiment with $80$ volunteers from all students at the school. Each volunteer would be assigned to follow, or not to follow, a morning exercise routine before school for several weeks. At the end of that period the researcher would ask each volunteer how many minutes he or she spent on homework the previous night. (i)", "ST2C"),
      ...both(c, [["Random assignment tends to balance other variables across the groups, so a difference in the response is attributable to the treatment.", "Because the routine is assigned and followed for weeks before the night whose homework time is recorded, and random assignment tends to balance other variables across the groups, a difference in the response is attributable to the treatment."],
        ["Explains that random assignment balances other (lurking) variables between the groups so cause and effect can be concluded", "Explains that random assignment (with the routine assigned weeks before the homework time is measured) balances other (lurking) variables between the groups so cause and effect can be concluded"]], "ST2C"),
    }) },
  { id: "R6-PHYS2-FRQ1D", problemId: "c76a314a-f22b-4bb2-a1c2-6f17148d1333", csv: "P2 Physics 1 Exam 2 FRQ1D",
    why: "'Long enough that the block comes to rest on it' covers only the first release; at 2h the stopping distance is 12 m, which an 8 m rough section would not provide.",
    validation: "Passage and part D prompt now state that the rough section is long enough for the block to stop in both releases; reference answer (factor 2, d = h/mu) unchanged.",
    edit: (c) => ({
      passage: rep(c.passage, "The rough section is long enough that the block comes to rest on it.", "The rough section is long enough that the block comes to rest on it, including in the second release from height $2h$ described in part (D).", "PH2p"),
      statements: stmt(c, "D", "on the same track and the same rough section.", "on the same track and the same rough section, which is long enough for the block to stop on it in this release too.", "PH2D"),
    }) },
  { id: "R6-PHYS1-FRQ1D", problemId: "4fbf6e9e-b653-41ee-892d-1cb5cefe0403", csv: "P2 Physics 1 Exam 1 FRQ1D (reviewer note)",
    why: "An arbitrarily larger kinetic friction coefficient could stop the blocks from sliding at all, in which case static friction and tension would no longer follow T = m2(g - a).",
    validation: "Part D prompt now says the larger coefficient is small enough that the released blocks still accelerate; answer (tension increases, T = m2(g - a)) unchanged.",
    edit: (c) => ({ statements: stmt(c, "D", "with a larger coefficient of kinetic friction.", "with a larger coefficient of kinetic friction, small enough that the blocks, released from rest, still accelerate.", "PH1D") }) },
  { id: "R6-MICRO2-FRQ1E", problemId: "41e1e9a4-0c6b-411b-b96b-eb3bc09c718f", csv: "P2 Microeconomics 2 FRQ1E",
    why: "A long-run price returning to 18 needs a constant-cost industry (entry does not change input prices or the representative firm's minimum ATC); the stem does not say so.",
    validation: "Part E prompt states the constant-cost assumption; the reference reason names it. Answer (greater than Q_M) unchanged.",
    edit: (c) => ({
      statements: stmt(c, "E", "In the new long-run equilibrium,", "Assume cabbage is a constant-cost industry (input prices and each firm's cost curves do not change when firms enter or exit). In the new long-run equilibrium,", "MI1E"),
      ...both(c, [["Greater than Q_M, because the price returns to its original level while demand is higher, so the market quantity is larger.", "Greater than Q_M, because in a constant-cost industry the long-run price returns to its original level (\\$18) while demand is higher, so the market quantity is larger."]], "MI1E"),
    }) },
  { id: "R6-MICRO2-FRQ3C", problemId: "07516ae5-0353-4b3f-976c-ec50de46dd9e", csv: "P2 Microeconomics 2 FRQ3C",
    why: "The reference adds a 'million' unit that the payoff matrix and prompt never state.",
    validation: "Reference states the payoffs (37 and 43) in the units of the payoff matrix; the numbers and the equilibrium are unchanged.",
    edit: (c) => ({ ...both(c, [["\\$37 million for Airline X and \\$43 million for Airline Y.", "37 for Airline X and 43 for Airline Y (in the units used by the payoff matrix)."]], "MI3C") }) },
  { id: "R6-STAT1-FRQ4D", problemId: "b597391d-c790-4fc0-8a88-c6ef3ff3c592", csv: "P2 Statistics 1 FRQ4D",
    why: "The number of freshmen is not given, so the 10% (independence) condition for the interval cannot be checked from the data.",
    validation: "Part D prompt now states that there are more than 1,810 freshmen (10 times the sample of 181) and the reference lists the conditions (random, 10% satisfied by that statement, 76 and 105 at least 10); the interval (0.348, 0.492) and rubric points unchanged.",
    edit: (c) => ({
      statements: stmt(c, "D", "as a random sample from all freshmen.", "as a random sample from all freshmen, and assume there are more than $1810$ freshmen at the school.", "ST1D"),
      ...both(c, [["$\\hat p = 76/181 = 0.420$; interval:", "Conditions: the sample is random, the population of freshmen is more than 10 times the sample size of 181 (stated), and both $76$ and $105$ are at least 10. $\\hat p = 76/181 = 0.420$; interval:"]], "ST1D"),
    }) },
  { id: "R6-MACRO1-FRQ1DE", problemId: "92765650-9861-477c-9737-7d1412949a13", csv: "P2 Macroeconomics 1 FRQ1 D/E",
    why: "The G = 32 comes from the constant-price-level simple multiplier (the horizontal AD shift of 80), but part E uses an upward-sloping SRAS with a rising price level (and F adds crowding out), so AD2 need not meet SRAS exactly at full-employment output.",
    validation: "Reference D names the constant-price-level simplification; reference E states the qualitative effects (AD shifts right, output rises toward YF, price level PL2 above PL1) and that the price-level rise and crowding out keep the actual gain smaller than the constant-price shift. Rubric points (1 for AD2, 1 for higher PL) and part B/C/F unchanged.",
    edit: (c) => ({ ...both(c, [
      ["The gap is 80 billion and the multiplier is 1/(1 - 0.6) = 2.5, so government purchases must rise by 80/2.5 = 32 billion.", "The gap is 80 billion and the simple multiplier (which holds the price level constant) is 1/(1 - 0.6) = 2.5, so government purchases must rise by 80/2.5 = 32 billion."],
      ["AD shifts right to AD2, intersecting SRAS at full-employment output, with PL2 above PL1.", "AD shifts right to AD2 (the shift of 80 at the original price level that the 32 billion produces under the constant-price simplification), so equilibrium output rises toward full-employment output YF and the price level rises to PL2, above PL1. Because the price level rises along the upward-sloping SRAS, the actual increase in output is smaller than the horizontal shift of AD, so reaching YF exactly would take a larger shift."],
    ], "MAC1DE") }) },
  { id: "R6-ELA2-FRQ1", problemId: "8a522f7d-2718-4820-8d8f-eaba2e0161e9", csv: "P2 English Language 2 FRQ1 reference answer",
    why: "The high sample says dividing dollars by visits 'always looks better' once the hardest people to serve stop showing up; by the sources the system's cost per visit is about 10.73 dollars and the hub's projected 11.43 dollars (higher), and the sample itself says so two sentences earlier.",
    validation: "Sentence reworded to the defensible claim (a cost-per-visit average cannot register who has stopped coming); no 'always'. Arithmetic checked: 1,900,000 / 177,000 = 10.734; 1,600,000 / 140,000 = 11.429.",
    edit: (c) => ({ ...both(c, [["Divide dollars by visits and the number always looks better once the hardest people to serve stop showing up.", "An average like cost per visit cannot register who has stopped coming, because the people who are hardest to serve are exactly the ones who disappear from the count."]], "EL2F1") }) },
  { id: "R6-ELA2-FRQ2", problemId: "e5fb78ec-f380-4c98-9474-c3c81026102e", csv: "P2 English Language 2 FRQ2 reference answer",
    why: "The samples say the audience 'already knew the wharf was losing money' / call the wharf a business 'losing money'; the passage supports only a fuel dock that loses money three months a year, a closed ice house and a smaller fleet, not an overall loss.",
    validation: "All four statements (audience opening, summary sentence, and the thesis sentence that appears in the sample and again in the Row A annotation) limited to what the passage supports (economic pressure and declining facilities); a model review flagged the two 'failing business' occurrences after the first pass.",
    edit: (c) => ({ ...both(c, [
      ["she was speaking to an audience that already knew the wharf was losing money.", "she was speaking to an audience that already knew the wharf was under economic pressure and its facilities were in decline."],
      ["instead of just a business that is losing money.", "instead of just a business under economic pressure."],
      ["redefines the wharf from a failing business into infrastructure", "redefines the wharf from a business under economic pressure into infrastructure", 2],
    ], "EL2F2") }) },
  { id: "R6-ELA1-FRQ1", problemId: "a0d8b10e-5ed9-4740-994c-48fa1f29e1ee", csv: "P2 English Language 1 FRQ1 rubric",
    why: "The ALTON rubric sets the synthesis source-count floor and a Row A to Row B cap differently from the official general rubric (fewer than two sources is Row B 0, two sources is Row B 1, three or more are needed for 2+; Row A 0 does not itself cap Row B).",
    validation: "Row B 1 / 0 now follow the official source-count thresholds; the A=0 note is relabeled as ALTON study guidance, not an official cap. All other rubric text and the sample responses unchanged.",
    edit: (c) => ({ ...both(c, [
      ["   - 1: Mostly summary or paraphrase of fewer than three sources, or of three sources with no explanation of how any of them supports the writer's position.", "   - 1: Uses two of the provided sources, or uses three or more sources mostly by summary or paraphrase with no explanation of how any of them supports the writer's position."],
      ["   - 0: Restates the thesis, offers only personal opinion with no source material, or uses sources", "   - 0: Restates the thesis, offers only personal opinion with no source material, uses fewer than two of the provided sources, or uses sources"],
      ["Note: An essay that earns 0 on Row A can still earn up to 2 on Row B if it uses sources, but cannot earn 3 or 4 because there is no position for the evidence to support.", "Note: An essay that earns 0 on Row A can still earn credit on Row B for its use of sources. ALTON study guidance (not an official College Board cap): without a position there is usually no line of reasoning for the evidence to support, so scores of 3 or 4 on Row B are rare."],
    ], "EL1F1") }) },
  { id: "R6-ELA1-FRQ3", problemId: "95f6fb44-e162-4c88-9966-3cf4aa509017", csv: "P2 English Language 1 FRQ3 rubric",
    why: "Row C 0 reads 'one-sided or treats the question as settled', which penalises a firm, one-sided position although the official sophistication row has several paths and does not require treating the other side equally.",
    validation: "Row C 0 now describes oversimplification and empty complexity gestures, and states that a firm one-sided position is not penalised by itself; Row C 1 and the other rows unchanged.",
    edit: (c) => ({ ...both(c, [["   - 0: The argument is one-sided or treats the question as settled; or the essay gestures at complexity", "   - 0: The argument oversimplifies the issue, for example by treating a complicated question as if it had one obvious answer without testing its own claims (a firm, even one-sided, position is not penalized by itself when the reasoning is precise); or the essay gestures at complexity"]], "EL1F3") }) },
  { id: "R6-PSY1-EBQ", problemId: "be808ea5-604b-495a-96b8-4af052b26940", csv: "P2 Psychology 1 EBQ A/C/E",
    why: "Source 1 bundles three differences (phone off in a bag vs phone on the desk with notification sounds), so the notification sound alone cannot be isolated and attention/encoding were not measured; Source 2 does not measure the schedule of reinforcement, so 'variable-ratio' is asserted, not supported.",
    validation: "A and C reference answers say 'suggests' / 'a possible explanation' and name the bundled condition; E names intermittent (partial) reinforcement and notes the data do not show which schedule operates. Rubric points unchanged.",
    edit: (c) => ({ ...both(c, [
      ["because the evidence shows that notifications reduce what students learn from a lecture.", "because the evidence suggests that having a phone on and sending notifications reduces what students learn from a lecture."],
      ["The notifications captured students' attention, so students could not attend selectively to the lecture (selective attention), which meant that less of the lecture was encoded into memory and quiz scores were lower.", "A possible explanation is that the notifications captured students' attention, so students could not attend selectively to the lecture (selective attention), which would mean that less of the lecture was encoded into memory and quiz scores were lower. The experiment compared a bundle of conditions (phone off in a bag versus phone on the desk with notification sounds), so it cannot isolate the sound alone, and attention and encoding were not measured directly."],
      ["Frequent checking is reinforced on a variable-ratio schedule: unpredictable notifications and messages reward checking, which makes the behavior persistent and hard to stop, so students are repeatedly distracted during class.", "Frequent checking can be maintained by intermittent (partial) reinforcement: because messages and notifications arrive unpredictably, checking is sometimes rewarded (with news or social contact) and sometimes not, which can make the behavior persistent and hard to stop, so students are repeatedly distracted during class. (The survey does not show which reinforcement schedule is operating.)"],
    ], "PSY1") }) },
  { id: "R6-PSY2-EBQ", problemId: "b51a659b-a9d3-44ac-94ec-8c9841a7ad4a", csv: "P2 Psychology 2 EBQ C",
    why: "Source 1 compares schools students were not assigned to, so the reference's causal story (required service built a norm and later volunteering) is stated more strongly than the data allow.",
    validation: "Reference C frames the norm as a possible explanation and names the limits (school and selection differences, norm not measured). Rubric points unchanged.",
    edit: (c) => ({ ...both(c, [["Required service can build a habit and a sense of social responsibility: people feel they should help those in need (the social responsibility norm), so students who served were more likely to keep volunteering as adults.", "One possible explanation is that required service builds a habit and a sense of social responsibility: people feel they should help those in need (the social responsibility norm), so students who served may have been more likely to keep volunteering as adults. Because students were not assigned to the two kinds of schools, school and selection differences cannot be ruled out, and the norm was not measured directly."]], "PSY2C") }) },
  { id: "R6-BIO1-FRQ1D", problemId: "b724f500-e5aa-4330-b4f6-938f7cb23e8a", csv: "P2 Biology 1 FRQ1D",
    why: "The inhibition table alone does not show competitive inhibition; the prediction in part D follows only under the stated competitive-inhibitor hypothesis.",
    validation: "Prompt and reference say 'assuming compound X is a competitive inhibitor'. Rubric points and answer unchanged.",
    edit: (c) => ({
      statements: stmt(c, "D", "Predict how the effect of compound X on the rate would change", "Assuming that compound X is a competitive inhibitor, predict how the effect of compound X on the rate would change", "B1D"),
      ...both(c, [["The decrease in rate caused by compound X would be smaller (the rate with compound X would be closer to the rate without it).", "If compound X is a competitive inhibitor, as hypothesized, the decrease in rate caused by compound X would be smaller (the rate with compound X would be closer to the rate without it)."]], "B1D"),
    }) },
  { id: "R6-BIO1-FRQ2T", problemId: "eeb446bd-4642-4135-a934-6af1b68ffae9", csv: "P3 Biology 1 truncated FRQ title",
    why: "Title is cut mid-sentence ('A student measures the rate at which an  — answer every part.').",
    validation: "Complete title from the passage: enzyme reaction rate at different temperatures.",
    edit: (c) => ({ question: rep(c.question, "Results with graphing: A student measures the rate at which an  — answer every part.", "Results with graphing: enzyme reaction rate at different temperatures — answer every part.", "B1T") }) },
  { id: "R6-BIO1-FRQ3CD", problemId: "16a33027-1c97-44ae-bb72-a44c7a4c3881", csv: "P2 Biology 1 FRQ3C/D",
    why: "Part D asks to justify the 70 C prediction, but part C asked only for the 10-37 C trend.",
    validation: "Part C prompt and reference now also ask for / state the 70 C prediction (lower volume than at 37 C); part D unchanged; point values unchanged.",
    edit: (c) => ({
      statements: stmt(c, "C", "Predict the relationship between temperature and the volume of oxygen produced from 10 °C to 37 °C.", "Predict the relationship between temperature and the volume of oxygen produced from 10 °C to 37 °C, and predict how the volume of oxygen produced at 70 °C compares with the volume produced at 37 °C.", "B3C"),
      ...both(c, [["The volume of oxygen produced will increase as the temperature increases from 10 °C to 37 °C.", "The volume of oxygen produced will increase as the temperature increases from 10 °C to 37 °C, and the volume produced at 70 °C will be lower than the volume produced at 37 °C."]], "B3C"),
    }) },
  { id: "R6-BIO2-FRQ2", problemId: "8e64e190-e66e-4a60-9200-16bffe0244df", csv: "P2/P3 Biology 2 FRQ2D + title",
    why: "A plateau at high light shows a non-light limit but not that it is CO2 (part C also accepts Calvin-cycle enzyme amount), so the unconditional 'would increase' prediction is not supported; the title is also truncated ('rate of oxygen pr').",
    validation: "Part D prompt ties the prediction to the factor named in part C; the reference states the conditional prediction (increase if CO2 limits, little or no change if another factor limits); rubric prediction point accepts either consistent prediction. Title completed.",
    edit: (c) => ({
      question: rep(c.question, "Results with graphing: A student measures the rate of oxygen pr — answer every part.", "Results with graphing: oxygen production at different light intensities — answer every part.", "B2T"),
      statements: stmt(c, "D", "Predict how the rate of oxygen production", "Using the factor you identified in part (C), predict how the rate of oxygen production", "B2D"),
      ...both(c, [
        ["The rate of oxygen production would increase. At high light intensity the rate is limited by carbon dioxide in the Calvin cycle, so more carbon dioxide allows more carbon fixation and more use of the products of the light reactions.\n   - 1 pt: Makes a reasonable prediction\n", "If carbon dioxide is the factor limiting the rate at high light intensity (as in part C), the rate of oxygen production would increase, because more carbon dioxide allows more carbon fixation and more use of the products of the light reactions. If a different factor, such as the amount of Calvin-cycle enzymes, is limiting, doubling carbon dioxide would cause little or no change.\n   - 1 pt: Makes a reasonable prediction consistent with the limiting factor named in part (C)\n"],
      ], "B2D"),
    }) },
];
export const EDITS6_IDS = EDITS6.map((e) => e.id);

const FIELDS6 = ["passage", "question", "options", "correct_index", "explanation", "explanation_en", "figure", "statements"] as const;
/** 현재 공개본 필드에서 패치 JSON 을 만든다(old = 현재 값, new = 편집 결과). 바뀐 필드만. */
export function buildPatch6(def: EditDef6, cur: F6, expectVersionId: string): Patch {
  const out = def.edit(cur);
  const changes: Patch["changes"] = [];
  for (const f of FIELDS6) {
    if (!(f in out) || out[f] === undefined) continue;
    if (JSON.stringify(out[f]) === JSON.stringify(cur[f])) continue;
    changes.push({ field: f, old: cur[f], new: out[f] });
  }
  if (!changes.length) throw new Error(`${def.id}: edit changes nothing`);
  return { id: def.id, problemId: def.problemId, expectVersionId, changes, why: def.why, validation: def.validation, kind: "ap" };
}
