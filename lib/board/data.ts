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
  /** 서버 트리거가 기록하는 감사 필드(이름은 기록 시점 스냅샷). */
  createdByName?: string | null;
  updatedByName?: string | null;
  updatedAt?: string | null;
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
  return "in_progress"; // 보드는 '시작한 응시'(진행 중·완료)만 다룬다 — 시작 전(assigned)은 mockExamsToBoardCards 가 거른다.
}

/** 모의고사 카드는 배정 기반이 아니다(2026-10-01): 학생이 시작한 응시(진행 중·완료)만 카드로 만들고,
 * 미응시 세트·시작 화면만 열린 'assigned' 응시는 카드로 만들지 않는다. */
export function mockExamsToBoardCards(attempts: MockExamAttemptSummary[]): BoardCard[] {
  return attempts.filter((a) => a.status !== "assigned").map(mockExamToBoardCard);
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
    createdByLabel: batch.teacherName ?? "담당 선생님",
    audit: null,
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
    href: attempt.status === "in_progress"
      ? `/student/mock-exam/${attempt.id}`
      : "/student?tab=mock-exam",
    // 배정 폐지(2026-10-01): 학생이 직접 시작한 응시. 기존 배정 응시는 배정한 선생님 이름을 그대로 쓴다.
    createdByLabel: attempt.assignedByName ?? "학생 본인",
    audit: null,
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
    audit: null,
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
    audit: { createdByName: task.createdByName ?? null, createdAt: task.createdAt, updatedByName: task.updatedByName ?? null, updatedAt: task.updatedAt ?? null },
  };
}

const MANUAL_TASK_COLUMNS =
  "id, student_id, title, status, due_at, due_start_at, created_by, created_by_role, created_at, created_by_name, updated_by_name, updated_at";

type ManualTaskRow = {
  id: string; student_id: string; title: string; status: string; due_at: string | null; due_start_at: string | null;
  created_by: string; created_by_role: string; created_at: string;
  created_by_name: string | null; updated_by_name: string | null; updated_at: string | null;
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
    createdByName: row.created_by_name ?? null,
    updatedByName: row.updated_by_name ?? null,
    updatedAt: row.updated_at ?? null,
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
