"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import type { ReviewCategoryId } from "./review-data";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORY_LABEL: Record<ReviewCategoryId, string> = {
  concept: "개념 이해도",
  problemsolving: "문제 해결 능력",
  participation: "수업 참여도",
  homework: "과제 수행도",
};

export type ReviewDraft = {
  teacherSummary: string;
  strength: string;
  improve: string;
  nextPlan: string;
  categories: Record<ReviewCategoryId, string>;
};

async function requireSessionTeacher(sessionId: string) {
  const { supabase, user, profile } = await requireUser();
  if (profile?.role === "admin") return { supabase, user };

  const { data: session } = await supabase
    .from("sessions")
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

export async function generateReviewDraft(params: {
  sessionId: string;
  subjectName: string;
  unitTitle: string | null;
  sessionNumber: number;
  note: string | null;
  teacherComment: string | null;
  homeworkItems: { title: string; graded: boolean; score: string | null }[];
}): Promise<ReviewDraft> {
  const { sessionId, subjectName, unitTitle, sessionNumber, note, teacherComment, homeworkItems } =
    params;
  await requireSessionTeacher(sessionId);

  const homeworkSummary =
    homeworkItems.length === 0
      ? "이번 회차에 배정된 과제 없음"
      : homeworkItems
          .map(
            (h) =>
              `- ${h.title}: ${h.graded ? `채점 완료(${h.score ?? "점수 없음"})` : "미채점"}`
          )
          .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [
      {
        name: "draft_session_review",
        description: "완료된 SAT/AP 튜터링 수업에 대한 리뷰 초안을 작성한다.",
        input_schema: {
          type: "object",
          properties: {
            teacher_summary: {
              type: "string",
              description: "학생·학부모에게 보여줄 이번 수업 총평, 2~3문장",
            },
            strength: { type: "string", description: "이번 수업에서 학생이 잘한 점" },
            improve: { type: "string", description: "보완이 필요한 점" },
            next_plan: { type: "string", description: "다음 수업 계획 또는 추천 사항" },
            categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["concept", "problemsolving", "participation", "homework"],
                  },
                  text: { type: "string", description: "해당 카테고리에 대한 1~2문장 평가" },
                },
                required: ["category", "text"],
              },
            },
          },
          required: ["teacher_summary", "strength", "improve", "next_plan", "categories"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "draft_session_review" },
    messages: [
      {
        role: "user",
        content: `다음 SAT/AP 튜터링 수업에 대한 리뷰 초안을 작성해주세요.
- 과목: ${subjectName}
- 회차: ${sessionNumber}회차${unitTitle ? ` (${unitTitle})` : ""}
- 선생님이 남긴 메모: ${note ?? "없음"}
- 선생님 코멘트: ${teacherComment ?? "없음"}
- 이번 회차 과제:
${homeworkSummary}

각 카테고리(개념 이해도, 문제 해결 능력, 수업 참여도, 과제 수행도)에 대해 위 정보를 바탕으로
구체적이고 학부모가 읽기에 자연스러운 톤으로 작성해주세요. 정보가 부족한 항목은 일반적이되
과도하게 단정하지 않는 문장으로 작성해주세요.`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI 응답을 처리할 수 없습니다.");
  }
  const raw = toolUse.input as {
    teacher_summary: string;
    strength: string;
    improve: string;
    next_plan: string;
    categories: { category: ReviewCategoryId; text: string }[];
  };

  const categories = Object.fromEntries(
    raw.categories.map((c) => [c.category, c.text])
  ) as Record<ReviewCategoryId, string>;
  for (const id of Object.keys(CATEGORY_LABEL) as ReviewCategoryId[]) {
    if (!categories[id]) categories[id] = "";
  }

  return {
    teacherSummary: raw.teacher_summary,
    strength: raw.strength,
    improve: raw.improve,
    nextPlan: raw.next_plan,
    categories,
  };
}

export async function submitReview(
  sessionId: string,
  fields: {
    teacherSummary: string;
    strength: string;
    improve: string;
    nextPlan: string;
    categories: Record<ReviewCategoryId, { text: string; reviewed: boolean }>;
  }
): Promise<void> {
  const { supabase } = await requireSessionTeacher(sessionId);

  const { data: review, error } = await supabase
    .from("session_reviews")
    .upsert(
      {
        session_id: sessionId,
        teacher_summary: fields.teacherSummary || null,
        strength: fields.strength || null,
        improve: fields.improve || null,
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
    .from("sessions")
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
