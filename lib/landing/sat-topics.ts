// SAT 섹션·영역 소개 페이지의 사람이 쓴 본문. 비율은 College Board가 공개한 영역 배점 근사치(저장소 마이그레이션 참고값과 동일).
import type { Sample } from "./samples";
import { SAT_SAMPLES } from "./samples";

export type SatTopic = {
  path: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  domains: { name: string; share: number; text: string }[];
  samples: Sample[];
  faq: { q: string; a: string }[];
};

export const SAT_TOPICS: SatTopic[] = [
  {
    path: "/sat-math-practice",
    title: "Free SAT Math Practice Test Online with Explanations | ALTON Education",
    h1: "Free SAT Math Practice",
    description: "Practice the digital SAT Math section for free: the four content domains, sample questions with explanations, and full-length practice tests with two math modules.",
    intro: "The digital SAT Math section has two modules of 22 questions each, 35 minutes per module. Most questions are multiple choice and some are student-produced responses, where you type the answer. A built-in graphing calculator is available for the whole section. The questions fall into four content domains, and knowing which domain a missed question belongs to is the fastest way to decide what to review.",
    domains: [
      { name: "Algebra", share: 35, text: "Linear equations and inequalities, systems of linear equations, and linear functions. These questions often reward setting up the equation carefully before solving it." },
      { name: "Advanced Math", share: 35, text: "Quadratic and other nonlinear equations, exponential and polynomial functions, and equivalent expressions. Look for structure, such as factoring or completing the square, before reaching for the calculator." },
      { name: "Problem-Solving and Data Analysis", share: 15, text: "Ratios, rates, percentages, unit conversion, probability, and interpreting tables, scatterplots and statistics. Reading the question stem closely matters more than the arithmetic." },
      { name: "Geometry and Trigonometry", share: 15, text: "Area and volume, lines and angles, triangles, right-triangle trigonometry and circles. Keep the formulas you actually use in a short personal list." },
    ],
    samples: SAT_SAMPLES.math,
    faq: [
      { q: "Is a calculator allowed on the SAT Math section?", a: "Yes. The digital SAT lets you use a calculator for the entire Math section, and a graphing calculator is built into the test application." },
      { q: "Does ALTON have SAT Math practice by topic?", a: "ALTON's practice tests are full-length, and your results show which skill domains cost you points. Use that breakdown to decide which domain to review next." },
    ],
  },
  {
    path: "/sat-reading-and-writing-practice",
    title: "Free SAT Reading and Writing Practice Test with Explanations | ALTON Education",
    h1: "Free SAT Reading and Writing Practice",
    description: "Practice the digital SAT Reading and Writing section for free: the four content domains, sample questions with explanations, and full-length practice tests with two modules.",
    intro: "The digital SAT Reading and Writing section has two modules of 27 questions each, 32 minutes per module. Every question is multiple choice and is attached to a short passage, often a single paragraph. Questions fall into four domains. Unlike the old SAT there is no long passage, so pacing is about reading precisely and moving on.",
    domains: [
      { name: "Craft and Structure", share: 28, text: "Words in context, the purpose of a sentence or text, and how two texts relate. Predict the missing word from context before reading the choices." },
      { name: "Information and Ideas", share: 26, text: "Central ideas, details, inferences, and using quantitative evidence from a graph or table. The correct answer must be supported by the text, not just plausible." },
      { name: "Standard English Conventions", share: 26, text: "Grammar, punctuation, sentence boundaries, agreement and verb tense. These are the most rule-based questions, and a small set of rules covers most of them." },
      { name: "Expression of Ideas", share: 20, text: "Revising for rhetorical goals, such as adding a transition or choosing the sentence that best accomplishes a stated purpose." },
    ],
    samples: SAT_SAMPLES.rw,
    faq: [
      { q: "How long are the passages on the digital SAT?", a: "Each Reading and Writing question is attached to a short passage, typically a paragraph or less, rather than a long multi-question passage." },
      { q: "How do I review Reading and Writing mistakes?", a: "After grading, see which domains you missed, then save missed questions to your Mistake Notebook and re-read the explanation for the reasoning, not just the answer." },
    ],
  },
];
