"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ProblemFormat = "mc" | "essay" | "math";
export type ProblemDifficulty = "easy" | "medium" | "hard";

export type DraftProblem = {
  format: ProblemFormat;
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  skillType: string;
  difficulty: ProblemDifficulty;
  unitTitle: string;
};

const FORMAT_LABEL: Record<ProblemFormat, string> = {
  mc: "객관식",
  essay: "서술형",
  math: "풀이형(화이트보드에 손으로 풀이)",
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

export async function generateProblems(params: {
  sessionId: string;
  subjectName: string;
  unitTitle: string;
  skillType: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  count: number;
}): Promise<DraftProblem[]> {
  const {
    sessionId,
    subjectName,
    unitTitle,
    skillType,
    difficulty,
    format,
    count,
  } = params;
  await requireSessionTeacher(sessionId);
  const clampedCount = Math.max(1, Math.min(10, count));

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    tools: [
      {
        name: "generate_problems",
        description: "SAT/AP 튜터링용 문제를 조건에 맞춰 생성한다.",
        input_schema: {
          type: "object",
          properties: {
            problems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  passage: {
                    type: "string",
                    description:
                      format === "mc"
                        ? "지문과 문제. 빈칸이 필요하면 ______로 표시."
                        : "문제 지문",
                  },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    description: "객관식일 때만 4개의 선택지",
                  },
                  correct_index: {
                    type: "number",
                    description: "객관식일 때만, 정답 선택지의 0-based 인덱스",
                  },
                  explanation: {
                    type: "string",
                    description:
                      format === "mc"
                        ? "정답 해설"
                        : "모범 답안 또는 풀이 과정",
                  },
                },
                required: ["passage", "explanation"],
              },
            },
          },
          required: ["problems"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "generate_problems" },
    messages: [
      {
        role: "user",
        content: `다음 조건에 맞는 SAT/AP 튜터링용 문제 ${clampedCount}개를 생성해주세요.
- 과목: ${subjectName}
- 단원: ${unitTitle}
- 문제 유형(스킬): ${skillType}
- 난이도: ${difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "보통" : "어려움"}
- 답안 형식: ${FORMAT_LABEL[format]}
${format === "mc" ? "객관식은 반드시 선택지 4개와 정답 인덱스를 포함해주세요." : ""}
실전 SAT/AP 시험에 나올 법한 퀄리티로 만들어주세요.`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI 응답을 처리할 수 없습니다.");
  }
  const raw = (
    toolUse.input as {
      problems: {
        passage: string;
        options?: string[];
        correct_index?: number;
        explanation: string;
      }[];
    }
  ).problems;

  return raw.map((p) => ({
    format,
    passage: p.passage,
    options: format === "mc" ? p.options ?? null : null,
    correctIndex: format === "mc" ? p.correct_index ?? null : null,
    explanation: p.explanation,
    skillType,
    difficulty,
    unitTitle,
  }));
}

export async function finalizeProblemsToHomework(
  sessionId: string,
  subjectId: string,
  drafts: DraftProblem[]
) {
  const { supabase, user } = await requireSessionTeacher(sessionId);

  const created: { id: string; title: string; description: string | null }[] =
    [];

  for (const draft of drafts) {
    const { data: problem, error: problemError } = await supabase
      .from("problems")
      .insert({
        format: draft.format,
        passage: draft.passage,
        options: draft.options,
        correct_index: draft.correctIndex,
        explanation: draft.explanation,
        difficulty: draft.difficulty,
        skill_type: draft.skillType,
        unit_title: draft.unitTitle,
        subject_id: subjectId,
        origin_session_id: sessionId,
        status: "confirmed",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (problemError) throw new Error(problemError.message);

    const title = `${draft.skillType} (${FORMAT_LABEL[draft.format]})`;
    const { data: homework, error: homeworkError } = await supabase
      .from("homework_items")
      .insert({
        session_id: sessionId,
        problem_id: problem.id,
        title,
        description: draft.passage,
      })
      .select("id, title, description")
      .single();
    if (homeworkError) throw new Error(homeworkError.message);

    created.push(homework);
  }

  return created;
}
