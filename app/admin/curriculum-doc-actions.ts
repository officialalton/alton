"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
import { sanitizeDocHtml } from "@/lib/sanitize-doc-html";
import type { DocProblem, DocSection } from "./curriculum-doc-data";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function requireAdmin() {
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
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");
  return { supabase, user };
}

export async function createCurriculumDoc(params: {
  title: string;
  subjectId: string;
  unitId: string | null;
}): Promise<{ id: string }> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("curriculum_docs")
    .insert({
      title: params.title,
      subject_id: params.subjectId,
      unit_id: params.unitId,
      owner_type: "admin",
      owner_teacher_id: null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateDocTitle(docId: string, title: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_docs")
    .update({ title })
    .eq("id", docId);
  if (error) throw new Error(error.message);
}

export async function setDocPublished(docId: string, published: boolean): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_docs")
    .update({ status: published ? "published" : "draft" })
    .eq("id", docId);
  if (error) throw new Error(error.message);
}

export async function addSection(
  docId: string,
  nextPosition: number
): Promise<DocSection> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("curriculum_doc_sections")
    .insert({ curriculum_doc_id: docId, position: nextPosition, title: "새 섹션", body: "" })
    .select("id, position, title, body, teaching_tip")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    position: data.position,
    title: data.title,
    body: data.body ?? "",
    teachingTip: data.teaching_tip,
    problems: [],
  };
}

export async function updateSection(
  sectionId: string,
  fields: { title?: string; body?: string; teachingTip?: string }
): Promise<void> {
  const { supabase } = await requireAdmin();
  const patch: Record<string, string | null> = {};
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.body !== undefined) patch.body = sanitizeDocHtml(fields.body);
  if (fields.teachingTip !== undefined)
    patch.teaching_tip = fields.teachingTip ? sanitizeDocHtml(fields.teachingTip) : null;

  const { error } = await supabase
    .from("curriculum_doc_sections")
    .update(patch)
    .eq("id", sectionId);
  if (error) throw new Error(error.message);
}

export async function removeSection(sectionId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_doc_sections")
    .delete()
    .eq("id", sectionId);
  if (error) throw new Error(error.message);
}

export async function moveSection(sectionId: string, otherSectionId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: rows, error } = await supabase
    .from("curriculum_doc_sections")
    .select("id, position")
    .in("id", [sectionId, otherSectionId]);
  if (error) throw new Error(error.message);
  if (!rows || rows.length !== 2) return;

  const [a, b] = rows;
  const TEMP_OFFSET = -1000000;
  await supabase.from("curriculum_doc_sections").update({ position: TEMP_OFFSET }).eq("id", a.id);
  await supabase.from("curriculum_doc_sections").update({ position: a.position }).eq("id", b.id);
  await supabase.from("curriculum_doc_sections").update({ position: b.position }).eq("id", a.id);
}

export type ProblemFormat = "mc" | "essay" | "math";
export type ProblemDifficulty = "easy" | "medium" | "hard";

const FORMAT_LABEL: Record<ProblemFormat, string> = {
  mc: "객관식",
  essay: "서술형",
  math: "풀이형",
};

export async function generateSectionProblems(params: {
  sectionTitle: string;
  subjectName: string;
  skillType: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  count: number;
}): Promise<Omit<DocProblem, "id">[]> {
  await requireAdmin();
  const { sectionTitle, subjectName, skillType, difficulty, format, count } = params;
  const clampedCount = Math.max(1, Math.min(10, count));

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4000,
    tools: [
      {
        name: "generate_problems",
        description: "SAT/AP 교재 섹션에 귀속될 문제 은행용 문제를 조건에 맞춰 생성한다.",
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
                    description: format === "mc" ? "정답 해설" : "모범 답안 또는 풀이 과정",
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
        content: `다음 조건에 맞는 SAT/AP 교재용 문제 ${clampedCount}개를 생성해주세요.
- 과목: ${subjectName}
- 교재 섹션: ${sectionTitle}
- 문제 유형(스킬): ${skillType}
- 난이도: ${difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "보통" : "어려움"}
- 답안 형식: ${FORMAT_LABEL[format]}
${format === "mc" ? "객관식은 반드시 선택지 4개와 정답 인덱스를 포함해주세요." : ""}
이 문제들은 특정 학생이 아니라 이 교재를 배정받는 어떤 학생에게도 재사용될 문제
은행에 들어갑니다. 실전 SAT/AP 시험에 나올 법한 퀄리티로 만들어주세요.`,
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
    difficulty,
  }));
}

export async function confirmSectionProblems(
  sectionId: string,
  subjectId: string,
  drafts: Omit<DocProblem, "id">[]
): Promise<DocProblem[]> {
  const { supabase, user } = await requireAdmin();

  const created: DocProblem[] = [];
  for (const draft of drafts) {
    const { data, error } = await supabase
      .from("problems")
      .insert({
        format: draft.format,
        passage: draft.passage,
        options: draft.options,
        correct_index: draft.correctIndex,
        explanation: draft.explanation,
        difficulty: draft.difficulty,
        subject_id: subjectId,
        section_id: sectionId,
        status: "confirmed",
        created_by: user.id,
      })
      .select("id, format, passage, options, correct_index, explanation, difficulty")
      .single();
    if (error) throw new Error(error.message);
    created.push({
      id: data.id,
      format: data.format,
      passage: data.passage,
      options: data.options,
      correctIndex: data.correct_index,
      explanation: data.explanation,
      difficulty: data.difficulty,
    });
  }
  return created;
}

export async function removeSectionProblem(problemId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("problems").delete().eq("id", problemId);
  if (error) throw new Error(error.message);
}
