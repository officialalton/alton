import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeworkBatch } from "../homework-batch-data";
import type { MockExamAttemptSummary } from "../mock-exam/attempt-data";
import type { VocabQuiz } from "@/app/student/vocab-library-data";
import type { BoardCard, BoardCardStatus } from "./types";

export type BoardManualTask = {
  id: string;
  studentId: string;
  title: string;
  status: BoardCardStatus;
  dueAt: string | null;
  dueStartAt: string | null;
  createdBy: string;
  createdByRole: "student" | "teacher" | "admin" | "consultant";
  createdAt: string;
};

function homeworkStatus(batch: HomeworkBatch): BoardCardStatus {
  if (batch.items.length === 0) return "backlog";
  const submittedCount = batch.items.filter((it) => it.submittedAt).length;
  if (submittedCount === batch.items.length) return "done";
  if (submittedCount > 0 || batch.items.some((it) => it.response)) return "in_progress";
  return "backlog";
}

function mockExamStatus(status: MockExamAttemptSummary["status"]): BoardCardStatus {
  if (status === "submitted" || status === "graded") return "done";
  if (status === "in_progress") return "in_progress";
  return "backlog";
}

function vocabQuizStatus(status: VocabQuiz["status"]): BoardCardStatus {
  if (status === "completed") return "done";
  if (status === "in_progress") return "in_progress";
  return "backlog";
}

// 2026-09-22(사용자 지시) — 카드마다 "누가 만들었는지" 보여준다. 자동 카드는
// 발급 주체가 고정돼 있어 소스 타입으로 바로 정할 수 있다(과제=선생님이 발급,
// 모의고사=선생님/관리자가 배정, 단어시험=학생 본인이 만든 학습 세션).
const CREATED_BY_LABEL: Record<BoardManualTask["createdByRole"], string> = {
  student: "학생 본인",
  teacher: "담당 선생님",
  consultant: "담당 컨설턴트",
  admin: "관리자",
};

export function homeworkToBoardCard(batch: HomeworkBatch): BoardCard {
  return {
    id: `homework:${batch.id}`,
    sourceType: "homework",
    sourceId: batch.id,
    title: batch.label,
    subtitle: batch.subjectName,
    status: homeworkStatus(batch),
    dueAt: batch.dueAt,
    dueStartAt: null,
    href: "/student?tab=homework",
    createdByLabel: "담당 선생님",
  };
}

export function mockExamToBoardCard(attempt: MockExamAttemptSummary): BoardCard {
  return {
    id: `mock_exam:${attempt.id}`,
    sourceType: "mock_exam",
    sourceId: attempt.id,
    title: attempt.examSetName,
    subtitle: null,
    status: mockExamStatus(attempt.status),
    dueAt: attempt.dueAt,
    dueStartAt: null,
    href: attempt.status === "assigned" || attempt.status === "in_progress"
      ? `/student/mock-exam/${attempt.id}`
      : "/student?tab=mock-exam",
    createdByLabel: "담당 선생님",
  };
}

export function vocabQuizToBoardCard(quiz: VocabQuiz): BoardCard {
  return {
    id: `vocab_quiz:${quiz.id}`,
    sourceType: "vocab_quiz",
    sourceId: quiz.id,
    title: `단어 시험(${quiz.wordCount}단어)`,
    subtitle: null,
    status: vocabQuizStatus(quiz.status),
    dueAt: quiz.dueAt,
    dueStartAt: null,
    href: "/student?tab=vocab",
    createdByLabel: "학생 본인",
  };
}

export function manualTaskToBoardCard(task: BoardManualTask): BoardCard {
  return {
    id: task.id,
    sourceType: "manual",
    sourceId: task.id,
    title: task.title,
    subtitle: null,
    status: task.status,
    dueAt: task.dueAt,
    dueStartAt: task.dueStartAt,
    href: null,
    createdByLabel: CREATED_BY_LABEL[task.createdByRole],
  };
}

const MANUAL_TASK_COLUMNS = "id, student_id, title, status, due_at, due_start_at, created_by, created_by_role, created_at";

type ManualTaskRow = {
  id: string; student_id: string; title: string; status: string; due_at: string | null; due_start_at: string | null;
  created_by: string; created_by_role: string; created_at: string;
};

function mapManualTaskRow(row: ManualTaskRow): BoardManualTask {
  return {
    id: row.id,
    studentId: row.student_id,
    title: row.title,
    status: row.status as BoardCardStatus,
    dueAt: row.due_at,
    dueStartAt: row.due_start_at,
    createdBy: row.created_by,
    createdByRole: row.created_by_role as BoardManualTask["createdByRole"],
    createdAt: row.created_at,
  };
}

export async function loadBoardManualTasks(supabase: SupabaseClient, studentId: string): Promise<BoardManualTask[]> {
  const { data, error } = await supabase
    .from("board_manual_tasks")
    .select(MANUAL_TASK_COLUMNS)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapManualTaskRow(r as unknown as ManualTaskRow));
}

export async function createBoardManualTask(
  supabase: SupabaseClient,
  input: {
    studentId: string;
    title: string;
    createdBy: string;
    createdByRole: BoardManualTask["createdByRole"];
    dueAt?: string | null;
    /** 2026-09-22(사용자 지시) — 기간(시작~마감) 입력. dueAt 없이 dueStartAt만 주면 무시된다(끝 날짜가 있어야 기간이 성립). */
    dueStartAt?: string | null;
  }
): Promise<BoardManualTask> {
  const { data, error } = await supabase
    .from("board_manual_tasks")
    .insert({
      student_id: input.studentId,
      title: input.title,
      created_by: input.createdBy,
      created_by_role: input.createdByRole,
      due_at: input.dueAt ?? null,
      due_start_at: input.dueAt ? input.dueStartAt ?? null : null,
    })
    .select(MANUAL_TASK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return mapManualTaskRow(data as unknown as ManualTaskRow);
}

export async function updateBoardManualTaskStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: BoardCardStatus
): Promise<void> {
  const { error } = await supabase.from("board_manual_tasks").update({ status }).eq("id", taskId);
  if (error) throw new Error(error.message);
}

export async function deleteBoardManualTask(supabase: SupabaseClient, taskId: string): Promise<void> {
  const { error } = await supabase.from("board_manual_tasks").delete().eq("id", taskId);
  if (error) throw new Error(error.message);
}
