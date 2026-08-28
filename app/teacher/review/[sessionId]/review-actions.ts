"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
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
}
