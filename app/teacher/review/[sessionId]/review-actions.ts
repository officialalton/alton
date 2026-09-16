"use server";

import { createClient } from "@/utils/supabase/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import type { ReviewCategoryId, ReviewRating } from "./review-data";

async function requireSessionTeacher(sessionId: string) {
  const { supabase, user, profile } = await requireUser();
  if (profile?.role === "admin") return { supabase, user };

  const { data: session } = await supabase
    .from("legacy_sessions")
    .select("enrollment:enrollments(teacher_id)")
    .eq("id", sessionId)
    .single();
  const enrollment = Array.isArray(session?.enrollment)
    ? session.enrollment[0]
    : session?.enrollment;
  if (!enrollment || enrollment.teacher_id !== user.id) {
    throw new Error("이 세션의 선생님만 사용할 수 있습니다.");
  }
  return { supabase, user };
}

export async function submitReview(
  sessionId: string,
  fields: {
    /** 2026-09-16(제품 오너 지시) — "오늘 배운 것"(필수). */
    teacherSummary: string;
    /** "최종 정리"(필수). */
    nextPlan: string;
    categories: Record<ReviewCategoryId, { text: string; reviewed: boolean; rating: ReviewRating | null }>;
  }
): Promise<void> {
  const { supabase } = await requireSessionTeacher(sessionId);

  const { data: review, error } = await supabase
    .from("session_reviews")
    .upsert(
      {
        session_id: sessionId,
        teacher_summary: fields.teacherSummary || null,
        next_plan: fields.nextPlan || null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const now = new Date().toISOString();
  const rows = (Object.keys(fields.categories) as ReviewCategoryId[]).map((category) => ({
    review_id: review.id,
    category,
    final_text: fields.categories[category].text || null,
    rating: fields.categories[category].rating,
    reviewed: fields.categories[category].reviewed,
    reviewed_at: fields.categories[category].reviewed ? now : null,
  }));

  const { error: categoryError } = await supabase
    .from("session_review_categories")
    .upsert(rows, { onConflict: "review_id,category" });
  if (categoryError) throw new Error(categoryError.message);

  await notifyGuardiansOfReview(supabase, sessionId);
}

async function notifyGuardiansOfReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<void> {
  const { data: session } = await supabase
    .from("legacy_sessions")
    .select(
      "session_number, enrollment:enrollments(student_id, subject:subjects(name))"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return;

  const enrollment = Array.isArray(session.enrollment)
    ? session.enrollment[0]
    : session.enrollment;
  const studentId = (enrollment as { student_id?: string } | null)?.student_id;
  if (!studentId) return;

  const subjectName = extractName(
    (enrollment as { subject?: unknown } | null)?.subject
  );

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", studentId)
    .maybeSingle();

  const admin = createAdminClient();

  // (2026-08-30 R2 Task 3) 가족 관계 원본은 households/household_members다
  // (guardian_students는 동결). 같은 household의 보호자 전체에게 알림을
  // 보내되(household_members는 (household_id, profile_id) unique라 자연히
  // 중복 없음), 계정이 완전히 닫힌(closed) 보호자는 "유효한 보호자"에서 제외한다.
  const { data: childMembership } = await admin
    .from("household_members")
    .select("household_id")
    .eq("profile_id", studentId)
    .eq("role", "child")
    .maybeSingle();
  if (!childMembership) return;

  const { data: guardianLinks } = await admin
    .from("household_members")
    .select("profile_id")
    .eq("household_id", childMembership.household_id)
    .eq("role", "guardian");
  if (!guardianLinks || guardianLinks.length === 0) return;

  const guardianIds = guardianLinks.map((l) => l.profile_id);
  const { data: activeParents } = await admin
    .from("parents")
    .select("id")
    .in("id", guardianIds)
    .neq("status", "closed");
  const validGuardianIds = new Set((activeParents ?? []).map((p) => p.id));

  for (const guardianId of guardianIds.filter((id) => validGuardianIds.has(id))) {
    const { data } = await admin.auth.admin.getUserById(guardianId);
    const email = data.user?.email;
    if (!email) continue;

    await sendEmail({
      to: email,
      subject: `[Alton Education] ${studentProfile?.name ?? "자녀"} 학생의 수업 리뷰가 도착했습니다`,
      html: `
        <p>안녕하세요.</p>
        <p>${studentProfile?.name ?? "자녀"} 학생의 ${subjectName} ${session.session_number}회차 수업 리뷰가 작성되었습니다.</p>
        <p>포털에 로그인하여 확인해주세요.</p>
        <p>감사합니다.<br/>Alton Education</p>
      `,
    });
  }
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}
