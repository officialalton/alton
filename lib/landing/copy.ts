
// 2026-10-05 랜딩 v2 — 공개 영문 카피. 숫자 주장은 claims.ts 값만 쓴다(copy.test.ts가 검증).
// 제품 용어(앱 전체 통일): Practice Tests / Mistake Notebook / Vocabulary Builder / Study Materials.

export const NAV_ITEMS = [
  { label: "Practice Tests", href: "/practice-tests" },
  { label: "Learning Tools", href: "/learning-tools" },
  { label: "Premium Tutoring", href: "/premium-tutoring" },
  { label: "About ALTON", href: "/about" },
] as const;

export const HERO = {
  eyebrow: "FREE PRACTICE · PREMIUM GUIDANCE WHEN YOU NEED IT",
  supporting:
    "Prepare with modular, adaptive SAT practice and subject-specific AP tests. Understand your mistakes, strengthen your weak areas, and keep your review organized with a personal vocabulary builder and mistake notebook.",
  primaryCta: "Start Practicing for Free",
  secondaryCta: "Explore Premium Tutoring",
  labels: ["Free Practice Tests", "Detailed Performance Analysis", "Vocabulary Builder", "Mistake Notebook"],
  freeNote: "Free means practice tests and learning tools. Tutoring and consulting are separate premium services.",
} as const;

export const FEATURES = {
  eyebrow: "PRACTICE. UNDERSTAND. IMPROVE.",
  title: "Practice. Understand. Improve.",
  items: [
    { title: "Practice With Purpose", body: "Build confidence with free SAT and AP practice tests. Review your results and see where to focus next." },
    { title: "Understand Your Mistakes", body: "Go beyond your score. Review incorrect answers, explore explanations, and identify the question types that need more attention." },
    { title: "Build Your Mistake Notebook", body: "Keep your mistakes in one place and return to them for focused review." },
    { title: "Grow Your Vocabulary", body: "Save and review words in your personal vocabulary builder, alongside your test preparation." },
  ],
} as const;

export const NEXT_STEP = {
  eyebrow: "YOUR NEXT STEP",
  title: "Your Next Step, Made Clear",
  body: "Move from practice to focused review with your results, mistake notebook, vocabulary builder, and SAT study materials in one learning platform.",
  steps: ["Take a Practice Test", "Understand Your Results", "Review Your Mistakes", "Keep Improving"],
  cta: "Start Your First Practice Test",
  materialsLink: "Browse free study materials",
} as const;

export const EXPERT = {
  eyebrow: "EXPERT SUPPORT WHEN YOU NEED IT",
  title: "Independent Practice. Premium Guidance. One ALTON.",
  body: "When you need a more personal approach, continue with ALTON's premium tutoring and educational consulting.",
  // 오너 확인: 15년은 창업자의 경력(claims.ts EXPERIENCE_ATTRIBUTION).
  experience:
    "Led by a founder with 15 years of experience in education, our team combines subject tutoring and educational guidance in one coordinated service, helping you connect your daily learning with your broader academic goals.",
  cards: [
    { title: "Personalized Tutoring", body: "Work with specialist tutors to address learning gaps and strengthen your understanding." },
    { title: "Educational Consulting", body: "Get guidance on your academic direction and preparation priorities." },
    { title: "One Coordinated Service", body: "Bring tutoring and consulting together, with your ALTON learning history providing a starting point for the conversation." },
  ],
  premiumCta: "Explore Premium Tutoring",
  consultCta: "Request a Consultation",
} as const;


export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "What is included for free?",
    a: "A free ALTON account includes SAT and AP practice tests with detailed results and explanations, a mistake notebook for questions you want to revisit, a vocabulary builder, and the study materials ALTON has approved for free access. Tutoring and consulting are not part of the free account.",
  },
  {
    q: "Do I need a parent account to start?",
    a: "No. Students aged 13 or older can create a free account on their own. A parent or guardian is only involved if you later choose to explore premium tutoring, and tutoring starts only after a parent or guardian is on board.",
  },
  {
    q: "How do SAT and AP practice tests differ?",
    a: "SAT practice on ALTON is modular and adaptive: each section has two modules, and your performance in the first module shapes the second. AP practice tests are subject-specific, with one set of tests for each AP subject.",
  },
  {
    q: "Can I review my mistakes and save vocabulary?",
    a: "Yes. Save missed questions to your mistake notebook to retry them later, and save unfamiliar words to your vocabulary builder to review them alongside your test preparation.",
  },
  {
    q: "What does premium tutoring include?",
    a: "Premium tutoring pairs you with a specialist tutor, together with educational consulting. It is a separate paid service and is never included in the free account. Details are on the Premium Tutoring page.",
  },
  {
    q: "How do I request a consultation?",
    a: "Use any Request a Consultation button. Free students can register interest from their dashboard, and ALTON invites a parent or guardian to continue. Parents and other visitors can submit the consultation form on the home page.",
  },
];

export const FINAL_CTA = {
  title: "Start Free. Find Your Next Step.",
  body: "Take a practice test, understand your mistakes, and build a stronger study routine. Expert support is available when you need it.",
  cta: "Create Your Free Account",
} as const;

export const FOOTER_LINKS = [
  { label: "Practice Tests", href: "/practice-tests" },
  { label: "Learning Tools", href: "/learning-tools" },
  { label: "Premium Tutoring", href: "/premium-tutoring" },
  { label: "About ALTON", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
] as const;

export const PRACTICE_TESTS_PAGE = {
  intro: `ALTON offers free SAT and AP practice tests, and the library keeps growing. SAT tests follow the digital SAT structure: Reading & Writing and Math, with two modules per section, and your first-module performance shapes the second. AP tests are subject-specific.`,
} as const;

/** 공개 카피 전체(숫자 주장 검증용). */
export function allPublicCopy(): string[] {
  return [
    ...NAV_ITEMS.map((i) => i.label),
    HERO.eyebrow, HERO.supporting, HERO.primaryCta, HERO.secondaryCta, ...HERO.labels, HERO.freeNote,
    FEATURES.title, ...FEATURES.items.flatMap((i) => [i.title, i.body]),
    NEXT_STEP.title, NEXT_STEP.body, ...NEXT_STEP.steps, NEXT_STEP.cta, NEXT_STEP.materialsLink,
    EXPERT.title, EXPERT.body, ...EXPERT.cards.flatMap((c) => [c.title, c.body]), EXPERT.premiumCta, EXPERT.consultCta,
    EXPERT.experience,
    ...FAQ.flatMap((f) => [f.q, f.a]),
    FINAL_CTA.title, FINAL_CTA.body, FINAL_CTA.cta,
    PRACTICE_TESTS_PAGE.intro,
  ];
}
