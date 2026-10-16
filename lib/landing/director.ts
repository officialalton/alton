// Approved by Chrisy Kim per owner, 2026-10-06.
//
// Chrisy Kim is a real person. Every interview answer below is philosophy-level copy. It deliberately contains no biography,
// employers, publications, student counts, score gains, awards, specific-school claims or
// guarantees. Do not add any unless she supplies and approves them.
//
// Portrait: place the photo at public/team/chrisy-kim.jpg (4:5 portrait).

export const DIRECTOR = {
  anchor: "chrisy-kim",
  name: "Chrisy Kim",
  heading: "Meet Chrisy Kim",
  eyebrow: "Founder & Director",
  title: "Founder & Director, ALTON Education",
  credential: "Master's & PhD in International Security · 15 Years of Experience in Education",
  photoSrc: "/team/chrisy-kim.jpg",
  photoAlt: "Portrait of Chrisy Kim",
  initials: "CK",
  advisorLabel: "Your advisor",
  advisorLine: "Founder & Director of ALTON, with 15 years of experience in education.",
  advisorLink: "Read the interview",
} as const;

export const DIRECTOR_INTERVIEW: readonly { q: string; a: string }[] = [
  {
    q: "Why did you found ALTON?",
    a: "I wanted students to have one place where practice, understanding, and personal guidance work together. Too often preparation is scattered across tools and advice that never connect. ALTON is built so that what you practice and what you are guided on belong to the same picture.",
  },
  {
    q: "What has your experience in education taught you about how students improve?",
    a: "Students improve when they understand why an answer was wrong, not only that it was wrong. Steady practice, honest review, and a clear sense of what to work on next matter more than any single test day.",
  },
  {
    q: "How do free practice and tutoring connect at ALTON?",
    a: "Free practice tests and learning tools let any student start on their own and see where they stand. Tutoring and consulting are a separate, premium service for students who want a more personal approach. When a student chooses to continue, their ALTON learning history gives us a starting point for the conversation.",
  },
  {
    q: "What does a first consultation look like?",
    a: "It begins with listening. We talk about the student's goals and how preparation has been going, and look at where they are today. The aim is to leave with a clearer sense of priorities and a sensible next step, without pressure to commit.",
  },
  {
    q: "What is your advice to parents?",
    a: "Support the process, not just the outcome. Ask your child what they are working on and what they found difficult, and treat mistakes as useful information. Steady encouragement helps more than constant pressure.",
  },
  {
    q: "What is your advice to students about mistakes?",
    a: "Do not hide from them. Every mistake shows you something specific to learn. Keep them in one place, come back to them, and notice the patterns. That is how a mistake becomes progress.",
  },
  {
    q: "What do you want students to feel when they work with ALTON?",
    a: "I want them to feel supported and capable: clear about what to do next, confident that effort leads somewhere, and never alone in the process.",
  },
];
