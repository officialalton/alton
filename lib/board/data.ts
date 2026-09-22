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
  createdBy: string;
  createdByRole: "student" | "teacher" | "admin";
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

export function homeworkToBoardCard(batch: HomeworkBatch): BoardCard {
  return {
    id: `homework:${batch.id}`,
    sourceType: "homework",
    sourceId: batch.id,
    title: batch.label,
    subtitle: batch.subjectName,
    status: homeworkStatus(batch),
    dueAt: batch.dueAt,
    href: "/student?tab=homework",
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
    href: attempt.status === "assigned" || attempt.status === "in_progress"
      ? `/student/mock-exam/${attempt.id}`
      : "/student?tab=mock-exam",
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
    href: "/student?tab=vocab",
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
    href: null,
  };
}

const MANUAL_TASK_COLUMNS = "id, student_id, title, status, due_at, created_by, created_by_role, created_at";

type ManualTaskRow = {
  id: string; student_id: string; title: string; status: string; due_at: string | null;
  created_by: string; created_by_role: string; created_at: string;
};

function mapManualTaskRow(row: ManualTaskRow): BoardManualTask {
  return {
    id: row.id,
    studentId: row.student_id,
    title: row.title,
    status: row.status as BoardCardStatus,
    dueAt: row.due_at,
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
  input: { studentId: string; title: string; createdBy: string; createdByRole: BoardManualTask["createdByRole"]; dueAt?: string | null }
): Promise<BoardManualTask> {
  const { data, error } = await supabase
    .from("board_manual_tasks")
    .insert({
      student_id: input.studentId,
      title: input.title,
      created_by: input.createdBy,
      created_by_role: input.createdByRole,
      due_at: input.dueAt ?? null,
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
