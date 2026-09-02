import type { SupabaseClient } from "@supabase/supabase-js";

export type ReviewCategoryId = "concept" | "problemsolving" | "participation" | "homework";

export type SessionReviewContext = {
  sessionId: string;
  studentName: string;
  subjectName: string;
  sessionNumber: number;
  unitTitle: string | null;
  note: string | null;
  teacherComment: string | null;
  homeworkItems: { title: string; graded: boolean; score: string | null }[];
};

export type ExistingReview = {
  teacherSummary: string | null;
  strength: string | null;
  improve: string | null;
  nextPlan: string | null;
  submittedAt: string | null;
  categories: Record<ReviewCategoryId, { finalText: string | null; reviewed: boolean }>;
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadSessionReviewContext(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionReviewContext | null> {
  const { data: session } = await supabase
    .from("legacy_sessions")
    .select(
      "id, session_number, unit_title, note, teacher_comment, enrollment:enrollments(student_id, subject:subjects(name))"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const enrollment = Array.isArray(session.enrollment)
    ? session.enrollment[0]
    : session.enrollment;
  const studentId = (enrollment as { student_id?: string } | null)?.student_id;

  const { data: studentProfile } = studentId
    ? await supabase.from("profiles").select("name").eq("id", studentId).maybeSingle()
    : { data: null };

  const { data: homeworkItems } = await supabase
    .from("homework_items")
    .select("title, graded, score")
    .eq("session_id", sessionId);

  return {
    sessionId: session.id,
    studentName: studentProfile?.name ?? "",
    subjectName: extractName((enrollment as { subject?: unknown } | null)?.subject),
    sessionNumber: session.session_number,
    unitTitle: session.unit_title,
    note: session.note,
    teacherComment: session.teacher_comment,
    homeworkItems: (homeworkItems ?? []).map((h) => ({
      title: h.title,
      graded: h.graded,
      score: h.score,
    })),
  };
}

const CATEGORY_IDS: ReviewCategoryId[] = [
  "concept",
  "problemsolving",
  "participation",
  "homework",
];

export async function loadExistingReview(
  supabase: SupabaseClient,
  sessionId: string
): Promise<ExistingReview | null> {
  const { data: review } = await supabase
    .from("session_reviews")
    .select("id, teacher_summary, strength, improve, next_plan, submitted_at")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!review) return null;

  const { data: categories } = await supabase
    .from("session_review_categories")
    .select("category, final_text, reviewed")
    .eq("review_id", review.id);

  const categoryMap = Object.fromEntries(
    CATEGORY_IDS.map((c) => [c, { finalText: null, reviewed: false }])
  ) as ExistingReview["categories"];
  for (const c of categories ?? []) {
    categoryMap[c.category as ReviewCategoryId] = {
      finalText: c.final_text,
      reviewed: c.reviewed,
    };
  }

  return {
    teacherSummary: review.teacher_summary,
    strength: review.strength,
    improve: review.improve,
    nextPlan: review.next_plan,
    submittedAt: review.submitted_at,
    categories: categoryMap,
  };
}
