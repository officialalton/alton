"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/utils/supabase/server";
import { sanitizeDocHtml } from "@/lib/sanitize-doc-html";
import type { DocProblem, DocSection, DocEditorData } from "./curriculum-doc-data";
import { loadCurriculumDocDetail } from "./curriculum-doc-data";
import type { SubjectKeyword } from "./subject-data";

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

// 2026-09-10(P1 성능 배치) — "교재 문서" 목록은 경량 목록(loadCurriculumDocList)만
// SSR로 받는다. 관리자가 실제로 문서를 열 때(편집 화면 진입)만 이 액션으로
// 섹션·문제·키워드 전체를 조회한다.
export async function getCurriculumDocDetailAction(docId: string): Promise<DocEditorData | null> {
  const { supabase } = await requireAdmin();
  return loadCurriculumDocDetail(supabase, docId);
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

  // 이미 공개된 교재를 다시 공개하는 경우를 먼저 가른다. 그때는 status 가 바뀌지
  // 않아 스냅샷 트리거(20261327000000)가 돌지 않는다 — 내용을 고쳐 놓고 재공개해도
  // 새 버전이 생기지 않아, 살아 있는 본문과 최신 스냅샷이 벌어진다.
  const { data: before } = await supabase
    .from("curriculum_docs")
    .select("status")
    .eq("id", docId)
    .maybeSingle();
  const wasPublished = (before?.status as string | undefined) === "published";

  const { error } = await supabase
    .from("curriculum_docs")
    .update({ status: published ? "published" : "draft" })
    .eq("id", docId);
  if (error) throw new Error(error.message);

  // 재공개 = 새 버전. 공개한 버전은 고치지 않는다는 규칙을 지키려면 여기서 한 벌
  // 더 떠야 한다. 최초 공개는 트리거가 이미 떴으므로 중복해서 뜨지 않는다.
  if (published && wasPublished) {
    const { error: captureError } = await supabase.rpc("capture_curriculum_doc_version", {
      p_doc_id: docId,
      p_origin: "publish",
      p_note: "재공개",
    });
    if (captureError) throw new Error(captureError.message);
  }
}

export async function addSection(
  docId: string,
  nextPosition: number,
  sectionType: "concept" | "problem"
): Promise<DocSection> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("curriculum_doc_sections")
    .insert({
      curriculum_doc_id: docId,
      position: nextPosition,
      title: "새 섹션",
      body: "",
      section_type: sectionType,
    })
    .select("id, position, title, body, teaching_tip, section_type")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    position: data.position,
    title: data.title,
    body: data.body ?? "",
    teachingTip: data.teaching_tip,
    sectionType: data.section_type,
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

// =========================================================================
// R9(Task 2) — 교재 조각(section)/문제 키워드 태깅
// DB 트리거(20261228000000_r9_curriculum_content_foundation.sql)가 "공개된
// 교재의 섹션만", "확정된 문제만" 관계에 들어갈 수 있게 막는다 — 여기서는
// 과목 불일치를 먼저 걸러 더 읽기 쉬운 에러를 주고, 그 외에는 트리거 에러를
// 그대로 올린다(예: draft 교재에 태그 시도).
// =========================================================================

// 2026-09-10(P0-2 확장) — Minified React error #441 마스킹 버그가 이
// 파일의 섹션·문제 키워드 액션에도 그대로 있었다(관리자 "교재 문서" 편집
// 화면에서 실사용 재현 — 이미 subject-actions.ts/session-prep-actions.ts에
// 적용한 것과 동일한 수정: throw 대신 { ok, error } 반환). 다만 이 파일이
// 호출부에서 쓰는 `KeywordTagger` 공용 컴포넌트는 Promise reject 계약을
// 그대로 쓰므로, 서버 액션 자체는 { ok, error }로 경계를 건너오고
// CurriculumDocEditor.tsx의 각 콜백이 그 결과를 다시 throw로 바꿔
// KeywordTagger의 기존 try/catch에 그대로 맞춘다(공용 컴포넌트 계약은
// 바꾸지 않음).
export type KeywordActionResult = { ok: true } | { ok: false; error: string };

/**
 * 교재의 대표 키워드를 지정하거나 바꾼다(교재당 1개). null이면 해제한다.
 *
 * 대표 키워드는 "이 교재가 어느 키워드의 기본 교재인가"를 말한다 — 회차에 그
 * 키워드가 붙으면 이 교재가 자동으로 구성에 들어간다. 그래서 섹션별 키워드
 * 태깅과는 다른 층이다: 섹션 키워드는 "이 조각이 무엇을 다루는가"(후보 검색용),
 * 대표 키워드는 "이 교재를 어디에 기본으로 넣을 것인가"(자동 구성용).
 *
 * 바꿔도 이미 구성에 들어간 교재가 회수되지는 않는다 — 선생님이 운영 중인 회차의
 * 자동분은 다음 키워드 변경 때 맞춰진다. 과거 수업에 고정된 내용은 스냅샷이라
 * 어느 쪽이든 영향을 받지 않는다.
 */
/**
 * 교재를 보관하거나 보관을 푼다.
 *
 * **삭제가 아니다.** 보관된 교재는 신규 선택과 자동 구성 후보에서 빠지지만,
 * 이미 회차에 담긴 것과 과거 수업에 고정된 내용은 그대로다 — 과거 수업이 읽는
 * 것은 시작 시점의 매니페스트 스냅샷이고 그 조회는 id로 한다.
 *
 * 보관하면 이 교재를 대표 키워드로 쓰던 회차들의 자동 구성이 다시 맞춰진다
 * (curriculum_docs_resync 트리거) — 선생님이 직접 담은 것은 건드리지 않는다.
 */
/**
 * 교재가 속한 단원을 바꾼다. null이면 단원 없음.
 *
 * 교재를 만들 때 단원을 안 정했으면 나중에 정할 길이 없었다 — 편집 화면에
 * 그 입력이 아예 없어서, 다시 만드는 것 말고는 방법이 없었다.
 */
export async function setDocUnit(
  docId: string,
  unitId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();

  if (unitId) {
    // 다른 과목의 단원을 붙이면 교재가 과목 경계를 넘어 새어 나간다.
    const [{ data: doc }, { data: unit }] = await Promise.all([
      supabase.from("curriculum_docs").select("subject_id").eq("id", docId).maybeSingle(),
      supabase.from("subject_template_units").select("subject_id").eq("id", unitId).maybeSingle(),
    ]);
    if (!doc || !unit) return { ok: false, error: "존재하지 않는 교재 또는 단원입니다." };
    if (doc.subject_id !== unit.subject_id) {
      return { ok: false, error: "교재와 단원은 같은 과목이어야 합니다." };
    }
  }

  const { error } = await supabase
    .from("curriculum_docs")
    .update({ unit_id: unitId })
    .eq("id", docId);
  if (error) {
    console.error(JSON.stringify({ event: "set_doc_unit_failed", message: error.message }));
    return { ok: false, error: "단원을 저장하지 못했습니다." };
  }
  return { ok: true };
}

export async function setDocArchived(
  docId: string,
  archived: boolean,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_docs")
    .update({
      archived_at: archived ? new Date().toISOString() : null,
      archived_reason: archived ? reason?.trim() || null : null,
    })
    .eq("id", docId);
  if (error) {
    console.error(JSON.stringify({ event: "set_doc_archived_failed", message: error.message }));
    return { ok: false, error: archived ? "보관하지 못했습니다." : "보관을 풀지 못했습니다." };
  }
  return { ok: true };
}

export async function setDocPrimaryKeyword(
  docId: string,
  keywordId: string | null,
  position?: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireAdmin();

  if (keywordId) {
    const [{ data: doc }, { data: keyword }] = await Promise.all([
      supabase.from("curriculum_docs").select("subject_id").eq("id", docId).maybeSingle(),
      supabase.from("subject_keywords").select("subject_id").eq("id", keywordId).maybeSingle(),
    ]);
    if (!doc || !keyword) return { ok: false, error: "존재하지 않는 교재 또는 키워드입니다." };
    // 트리거가 방어선이지만, 여기서 먼저 걸러 읽을 만한 문구를 준다.
    if (doc.subject_id !== keyword.subject_id) {
      return { ok: false, error: "대표 키워드는 교재와 같은 과목이어야 합니다." };
    }
  }

  const { error } = await supabase
    .from("curriculum_docs")
    .update({
      primary_keyword_id: keywordId,
      // 키워드를 해제하면 그 안의 순서도 의미가 없다.
      primary_keyword_position: keywordId ? position ?? null : null,
    })
    .eq("id", docId);
  if (error) return { ok: false, error: "대표 키워드를 저장하지 못했습니다." };
  return { ok: true };
}

export async function assignSectionKeyword(
  sectionId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();

  const { data: section } = await supabase
    .from("curriculum_doc_sections")
    .select("curriculum_doc_id, doc:curriculum_docs(subject_id, status)")
    .eq("id", sectionId)
    .single();
  const docRow = Array.isArray(section?.doc) ? section?.doc[0] : section?.doc;
  const { data: keyword } = await supabase
    .from("subject_keywords")
    .select("subject_id")
    .eq("id", keywordId)
    .single();
  if (!docRow || !keyword) return { ok: false, error: "존재하지 않는 섹션 또는 키워드입니다." };
  if (docRow.subject_id !== keyword.subject_id) {
    return { ok: false, error: "교재와 키워드는 같은 과목이어야 합니다." };
  }

  const { error } = await supabase
    .from("curriculum_doc_section_keywords")
    .insert({ section_id: sectionId, keyword_id: keywordId });
  if (error && error.code !== "23505") {
    // 23505(이미 태그됨)는 멱등 처리 — 에러 아님.
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeSectionKeyword(
  sectionId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("curriculum_doc_section_keywords")
    .delete()
    .eq("section_id", sectionId)
    .eq("keyword_id", keywordId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function assignProblemKeyword(
  problemId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();

  const { data: problem } = await supabase
    .from("problems")
    .select("subject_id, status")
    .eq("id", problemId)
    .single();
  const { data: keyword } = await supabase
    .from("subject_keywords")
    .select("subject_id")
    .eq("id", keywordId)
    .single();
  if (!problem || !keyword) return { ok: false, error: "존재하지 않는 문제 또는 키워드입니다." };
  if (problem.subject_id && problem.subject_id !== keyword.subject_id) {
    return { ok: false, error: "문제와 키워드는 같은 과목이어야 합니다." };
  }

  const { error } = await supabase
    .from("problem_keywords")
    .insert({ problem_id: problemId, keyword_id: keywordId });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function removeProblemKeyword(
  problemId: string,
  keywordId: string
): Promise<KeywordActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("problem_keywords")
    .delete()
    .eq("problem_id", problemId)
    .eq("keyword_id", keywordId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type CreateSubjectKeywordForDocResult =
  | { ok: true; value: SubjectKeyword }
  | { ok: false; error: string };

export async function createSubjectKeywordForDoc(
  subjectId: string,
  label: string
): Promise<CreateSubjectKeywordForDocResult> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("subject_keywords")
    .insert({ subject_id: subjectId, label })
    .select("id, label, status")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "이미 존재하는 키워드입니다." };
    return { ok: false, error: error.message };
  }
  return { ok: true, value: { id: data.id, label: data.label, status: data.status } };
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
}): Promise<Omit<DocProblem, "id" | "keywords">[]> {
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
                    description: "객관식일 때만 정확히 5개의 선택지",
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
${format === "mc" ? "객관식은 반드시 선택지 5개와 정답 인덱스를 포함해주세요." : ""}
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

export async function regenerateProblem(params: {
  sectionTitle: string;
  subjectName: string;
  skillType: string;
  difficulty: ProblemDifficulty;
  format: ProblemFormat;
  current: Omit<DocProblem, "id" | "keywords">;
  feedback: string;
}): Promise<Omit<DocProblem, "id" | "keywords">> {
  await requireAdmin();
  const { sectionTitle, subjectName, skillType, difficulty, format, current, feedback } = params;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2000,
    tools: [
      {
        name: "regenerate_problem",
        description: "기존 문제 초안을 선생님 피드백에 맞춰 수정한 새 버전을 생성한다.",
        input_schema: {
          type: "object",
          properties: {
            passage: { type: "string", description: "문제 지문" },
            options: {
              type: "array",
              items: { type: "string" },
              description: "객관식일 때만 정확히 5개의 선택지",
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
    ],
    tool_choice: { type: "tool", name: "regenerate_problem" },
    messages: [
      {
        role: "user",
        content: `아래 문제 초안을 선생님 피드백에 맞춰 수정해주세요.
- 과목: ${subjectName}
- 교재 섹션: ${sectionTitle}
- 문제 유형(스킬): ${skillType}
- 난이도: ${difficulty === "easy" ? "쉬움" : difficulty === "medium" ? "보통" : "어려움"}
- 답안 형식: ${FORMAT_LABEL[format]}

현재 초안:
지문: ${current.passage}
${current.options ? `선택지: ${current.options.join(" / ")}` : ""}
${current.correctIndex !== null ? `정답 인덱스: ${current.correctIndex}` : ""}
해설/모범답안: ${current.explanation}

선생님 피드백: ${feedback}

이 피드백을 반영해 문제를 다시 작성해주세요.${
          format === "mc" ? " 객관식은 반드시 선택지 5개와 정답 인덱스를 포함해주세요." : ""
        }`,
      },
    ],
  });

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI 응답을 처리할 수 없습니다.");
  }
  const raw = toolUse.input as {
    passage: string;
    options?: string[];
    correct_index?: number;
    explanation: string;
  };

  return {
    format,
    passage: raw.passage,
    options: format === "mc" ? raw.options ?? null : null,
    correctIndex: format === "mc" ? raw.correct_index ?? null : null,
    explanation: raw.explanation,
    difficulty,
  };
}

export async function confirmSectionProblems(
  sectionId: string,
  subjectId: string,
  drafts: Omit<DocProblem, "id" | "keywords">[]
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
      keywords: [],
    });
  }
  return created;
}

export async function removeSectionProblem(problemId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("problems").delete().eq("id", problemId);
  if (error) throw new Error(error.message);
}

export async function deleteCurriculumDoc(docId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: doc, error: fetchError } = await supabase
    .from("curriculum_docs")
    .select("status")
    .eq("id", docId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (doc.status === "published") {
    throw new Error("배포된 교재는 삭제할 수 없습니다. 먼저 배포를 취소하세요.");
  }

  const { error } = await supabase.from("curriculum_docs").delete().eq("id", docId);
  if (error) throw new Error(error.message);
}
