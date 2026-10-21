// 공개 페이지용 자체 제작 샘플 문항과 과목 소개 문단. 공식 SAT/AP 문항을 인용하지 않는다(ALTON이 직접 작성).
// 정답·해설을 함께 게재한다. 계산·표기는 일반 텍스트만 사용한다.

export type Sample = { topic: string; prompt: string; choices?: string[]; answer: string; explanation: string };

export const SAT_SAMPLES: { math: Sample[]; rw: Sample[] } = {
  math: [
    {
      topic: "Algebra — linear equations",
      prompt: "If 5(x − 2) = 3x + 6, what is the value of x?",
      choices: ["A) 4", "B) 6", "C) 8", "D) 10"],
      answer: "C) 8",
      explanation: "Distribute on the left: 5x − 10 = 3x + 6. Subtract 3x from both sides: 2x − 10 = 6. Add 10: 2x = 16, so x = 8. Check: 5(8 − 2) = 30 and 3(8) + 6 = 30.",
    },
    {
      topic: "Algebra — slope (student-produced response)",
      prompt: "A line in the xy-plane passes through the points (2, 5) and (6, 13). What is the slope of the line? (Enter your answer as a number.)",
      answer: "2",
      explanation: "Slope is the change in y divided by the change in x: (13 − 5) / (6 − 2) = 8 / 4 = 2.",
    },
  ],
  rw: [
    {
      topic: "Standard English Conventions — subject-verb agreement",
      prompt: "The committee, which includes teachers, parents, and students, ______ every Thursday in the library. Which choice completes the text so that it conforms to the conventions of Standard English?",
      choices: ["A) meet", "B) meets", "C) are meeting", "D) have met"],
      answer: "B) meets",
      explanation: "The subject is the singular noun 'committee'. The phrase between the commas is a nonessential description and does not change the subject, so the verb must be singular: 'meets'.",
    },
    {
      topic: "Craft and Structure — words in context",
      prompt: "The first report seemed implausible, but later experiments produced the same result again and again, making the claim increasingly ______. Which choice completes the text with the most logical and precise word?",
      choices: ["A) dubious", "B) credible", "C) trivial", "D) ambiguous"],
      answer: "B) credible",
      explanation: "The sentence contrasts an 'implausible' first report with repeated confirmation. Repeated confirmation makes a claim more believable, so 'credible' fits. 'Dubious' would mean the opposite.",
    },
  ],
};

export const AP_SAMPLES: Record<string, Sample> = {
  ap_calculus_ab: {
    topic: "Unit 3: Differentiation — product rule",
    prompt: "If f(x) = x^2 · e^x, what is f'(1)?",
    choices: ["A) e", "B) 2e", "C) 3e", "D) 4e"],
    answer: "C) 3e",
    explanation: "By the product rule, f'(x) = 2x·e^x + x^2·e^x. At x = 1 this is 2e + e = 3e.",
  },
  ap_calculus_bc: {
    topic: "Unit 10: Infinite series — geometric series",
    prompt: "What is the sum of the series 1 + 1/3 + 1/9 + 1/27 + ... ?",
    choices: ["A) 1", "B) 4/3", "C) 3/2", "D) The series diverges"],
    answer: "C) 3/2",
    explanation: "This is a geometric series with first term 1 and ratio 1/3. Because |r| < 1 it converges to a / (1 − r) = 1 / (2/3) = 3/2.",
  },
  ap_statistics: {
    topic: "Unit 6: Inference for proportions and means — standard error",
    prompt: "A random sample of 64 batteries has a mean lifetime of 50 hours with a sample standard deviation of 8 hours. What is the standard error of the sample mean?",
    choices: ["A) 0.125", "B) 1", "C) 6.25", "D) 8"],
    answer: "B) 1",
    explanation: "The standard error of the mean is s / sqrt(n) = 8 / sqrt(64) = 8 / 8 = 1 hour.",
  },
  ap_biology: {
    topic: "Unit 6: Gene expression and regulation — translation",
    prompt: "Which molecule carries a specific amino acid to the ribosome during translation?",
    choices: ["A) mRNA", "B) tRNA", "C) rRNA", "D) DNA polymerase"],
    answer: "B) tRNA",
    explanation: "Transfer RNA molecules each bind one amino acid and pair their anticodon with an mRNA codon at the ribosome. mRNA carries the code, rRNA is part of the ribosome, and DNA polymerase copies DNA.",
  },
  ap_chemistry: {
    topic: "Unit 1: Atomic structure and properties — the mole",
    prompt: "How many moles of water are in 36.0 g of H2O? (Molar mass of H2O = 18.0 g/mol)",
    choices: ["A) 0.50 mol", "B) 1.0 mol", "C) 2.0 mol", "D) 648 mol"],
    answer: "C) 2.0 mol",
    explanation: "Moles = mass / molar mass = 36.0 g / 18.0 g per mol = 2.0 mol.",
  },
  ap_physics_1: {
    topic: "Unit 2: Dynamics — Newton's second law",
    prompt: "A 2.0 kg cart starts from rest and is pushed by a constant net force of 6.0 N for 4.0 s. What is its speed at the end of the push?",
    choices: ["A) 3.0 m/s", "B) 6.0 m/s", "C) 12 m/s", "D) 24 m/s"],
    answer: "C) 12 m/s",
    explanation: "Acceleration is F / m = 6.0 / 2.0 = 3.0 m/s^2. Starting from rest, v = a·t = 3.0 × 4.0 = 12 m/s.",
  },
  ap_physics_c_mechanics: {
    topic: "Kinematics with calculus",
    prompt: "A particle moves along the x-axis with position x(t) = t^3 − 6t^2 (meters, seconds). At what time t > 0 is its velocity zero?",
    choices: ["A) 2 s", "B) 3 s", "C) 4 s", "D) 6 s"],
    answer: "C) 4 s",
    explanation: "Velocity is the derivative: v(t) = 3t^2 − 12t = 3t(t − 4). It equals zero at t = 0 and t = 4, so the positive time is 4 s.",
  },
  ap_physics_c_electricity_and_magnetism: {
    topic: "Electric fields of point charges",
    prompt: "A point charge produces an electric field of magnitude E at a distance r. What is the magnitude of the field at a distance 2r from the same charge?",
    choices: ["A) E/4", "B) E/2", "C) 2E", "D) 4E"],
    answer: "A) E/4",
    explanation: "The field of a point charge falls off as 1/r^2. Doubling the distance divides the field by 2^2 = 4, giving E/4.",
  },
  ap_precalculus: {
    topic: "Function composition",
    prompt: "If f(x) = 2x + 3 and g(x) = x^2, what is f(g(2))?",
    choices: ["A) 7", "B) 11", "C) 14", "D) 19"],
    answer: "B) 11",
    explanation: "Work from the inside out. g(2) = 2^2 = 4, and then f(4) = 2(4) + 3 = 11.",
  },
  ap_computer_science_a: {
    topic: "Unit 1: Using objects and methods — operators",
    prompt: "What is the value of x after the following code segment runs?\nint x = 7;\nx += 3;\nx /= 2;",
    choices: ["A) 4", "B) 5", "C) 5.0", "D) 6"],
    answer: "B) 5",
    explanation: "After x += 3, x is 10. Then x /= 2 performs integer division on an int, giving 5. The result is an int, so it is not 5.0.",
  },
  ap_microeconomics: {
    topic: "Perfect competition — profit maximization",
    prompt: "A perfectly competitive firm faces a market price of $12 and is currently producing a quantity at which marginal cost is $15. Assuming price is above average variable cost, what should the firm do to maximize profit?",
    choices: ["A) Increase output", "B) Decrease output", "C) Keep output unchanged", "D) Shut down immediately"],
    answer: "B) Decrease output",
    explanation: "A profit-maximizing competitive firm produces where P = MC. Here MC ($15) exceeds P ($12), so the last unit costs more than it earns; producing less raises profit. Shutting down is only optimal if price falls below average variable cost.",
  },
  ap_macroeconomics: {
    topic: "Fiscal policy — the spending multiplier",
    prompt: "If the marginal propensity to consume is 0.8, what is the simple spending multiplier?",
    choices: ["A) 1.25", "B) 4", "C) 5", "D) 8"],
    answer: "C) 5",
    explanation: "The simple spending multiplier is 1 / (1 − MPC) = 1 / (1 − 0.8) = 1 / 0.2 = 5.",
  },
  ap_psychology: {
    topic: "Learning — operant conditioning",
    prompt: "A student receives praise each time she raises her hand, and she begins raising her hand more often. Which concept does this best illustrate?",
    choices: ["A) Positive reinforcement", "B) Negative reinforcement", "C) Positive punishment", "D) Extinction"],
    answer: "A) Positive reinforcement",
    explanation: "Praise is a pleasant stimulus added after the behavior, and the behavior increases. Adding a stimulus to increase behavior is positive reinforcement.",
  },
};

/** 과목별 손으로 쓴 소개 문단(자동 템플릿 아님). 키는 과목 코드. */
export const SUBJECT_ABOUT: Record<string, string> = {
  sat: "The digital SAT is a two-section, adaptive test taken on a device: Reading & Writing and Math, each split into two modules. ALTON's free practice tests follow that structure so that timing, module breaks and question styles feel familiar on test day. After grading you see which skill domains cost you points, and you can send missed questions to a notebook for later review. Students at international schools in Korea, Asia and the United States use the tests to find weak domains early, well before a real sitting.",
  ap_calculus_ab: "AP Calculus AB covers limits, derivatives and the first half of integral calculus, with a split between calculator-allowed and no-calculator parts. The free-response section rewards clear justification, not just a final number, so ALTON's practice sets are organized by part so you can rehearse both situations.",
  ap_calculus_bc: "AP Calculus BC includes everything in AB and adds parametric, polar and vector-valued functions plus infinite series. Series and convergence tests are where many students lose points, so it helps to see the unit weights below before deciding where to practice first.",
  ap_statistics: "AP Statistics is about reasoning from data: exploring distributions, designing studies, probability, and inference for proportions, means and slopes. Free-response answers are graded on communication in context, so practice means writing full sentences, not only computing.",
  ap_biology: "AP Biology spans eight units from the chemistry of life to ecology, with heavy emphasis on experimental design and interpreting data. Use the unit list below to see how the multiple-choice questions are distributed.",
  ap_chemistry: "AP Chemistry mixes quantitative problem solving (stoichiometry, equilibrium, thermodynamics) with particle-level explanation. Practice sets here are separated by calculator rules where the exam separates them.",
  ap_physics_1: "AP Physics 1 is algebra-based mechanics plus waves and circuits, and it rewards conceptual explanation over plug-and-chug. Many questions ask you to justify a claim with a physical principle, so review the explanations after each set.",
  ap_physics_c_mechanics: "AP Physics C: Mechanics is calculus-based and is a good fit for students already taking calculus. Expect kinematics, Newton's laws, energy, momentum, rotation and oscillations treated with derivatives and integrals.",
  ap_physics_c_electricity_and_magnetism: "AP Physics C: Electricity and Magnetism uses calculus to treat electric fields, Gauss's law, circuits, magnetic fields and induction. It pairs naturally with Physics C: Mechanics for students who want both exams.",
  ap_precalculus: "AP Precalculus builds fluency with polynomial, rational, exponential, logarithmic, trigonometric and polar functions, including how to model data. It is the natural course before calculus and is useful preparation for the SAT Math section as well.",
  ap_computer_science_a: "AP Computer Science A is a Java course: objects and methods, control flow, classes, arrays and ArrayList, 2D arrays and recursion. Practice questions here ask you to trace code and predict output, the same skill the exam tests.",
  ap_microeconomics: "AP Microeconomics studies how individual consumers and firms decide, from supply and demand to market structures and market failure. Graph reading is central, so the explanations walk through the graph logic.",
  ap_macroeconomics: "AP Macroeconomics covers national income, inflation, unemployment, monetary and fiscal policy and international trade. Many items test whether you can predict how a policy shifts a model, such as aggregate demand.",
  ap_psychology: "AP Psychology surveys research methods, biological bases of behavior, learning, cognition, development, social psychology and mental health. Vocabulary is large, so spaced practice with explanations is more effective than rereading notes.",
  ap_us_history: "AP U.S. History covers colonial settlement through the present, tested with source-based multiple-choice questions plus short-answer, document-based and long-essay writing. Identifying the argument in a source is the key skill.",
  ap_world_history: "AP World History: Modern starts around 1200 and tracks themes such as trade, state building, technology and revolutions. The exam stresses comparison, continuity and change, and use of evidence from primary sources.",
  ap_european_history: "AP European History covers the Renaissance to the present, tested with source-based multiple-choice questions and written responses. Strong answers connect events to broad themes such as political authority, economic change and cultural thought.",
  ap_english_language: "AP English Language focuses on rhetorical analysis, argument and synthesis of sources. Multiple-choice passages test how authors build effects, and the free-response essays are scored for a defensible thesis and sophisticated evidence.",
  ap_english_literature: "AP English Literature focuses on close reading of prose and poetry and literary argument. Practice by reading each passage for narrator, tone and shifts before looking at the answer choices.",
};
