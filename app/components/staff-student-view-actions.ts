"use server";

// 학생 열람(오버뷰/보드/통계) 공통 서버 액션 — 관리자·컨설턴트·선생님·학부모가 같이 쓴다.
// 모든 액션이 assertCanViewStudent(역할·담당·활성 배정·보호자 검사)를 먼저 통과해야 하고,
// 쓰기는 역할별 허용 동작(access.actions)만 된다. 학생 본인 로더는 건드리지 않는다.
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  assertCanViewStudent,
  assertCanWriteStudentTask,
  statsTierFor,
  StudentViewDeniedError,
  type StudentViewAccess,
  type StudentViewAction,
} from "@/lib/staff-student-view";
import { loadStudentHomeworkBatches } from "@/lib/homework-batch-data";
import { loadStudentMockExamAttempts } from "@/lib/mock-exam/attempt-data";
import { loadVocabQuizzes } from "@/app/student/vocab-library-data";
import { loadStudentStats, type StatsData } from "@/app/student/stats-data";
import {
  loadBoardManualTasks,
  createBoardManualTask,
  updateBoardManualTaskStatus,
  deleteBoardManualTask,
  homeworkToBoardCard,
  mockExamToBoardCard,
  vocabQuizToBoardCard,
  manualTaskToBoardCard,
} from "@/lib/board/data";
import type { BoardCard, BoardCardStatus } from "@/lib/board/types";

export type StudentViewBoardResult =
  | { ok: true; cards: BoardCard[]; access: StudentViewAccess }
  | { ok: false; error: string };

async function loadCards(supabase: Parameters<typeof loadStudentHomeworkBatches>[0], studentId: string): Promise<BoardCard[]> {
  // 4개 조회를 병렬로 — 오버뷰·보드가 이 결과를 공유한다(화면당 1회). 원본 로더·RPC가
  // 호출자 권한으로 역할별 필터(학부모 채점 전 마스킹, 선생님 본인 과제 등)를 다시 건다.
  const [homework, mockExams, vocabQuizzes, manualTasks] = await Promise.all([
    loadStudentHomeworkBatches(supabase, studentId),
    loadStudentMockExamAttempts(supabase, studentId),
    loadVocabQuizzes(supabase, studentId),
    loadBoardManualTasks(supabase, studentId),
  ]);
  return [
    ...homework.map(homeworkToBoardCard),
    ...mockExams.map(mockExamToBoardCard),
    ...vocabQuizzes.map(vocabQuizToBoardCard),
    ...manualTasks.map(manualTaskToBoardCard),
  ];
}

export async function loadStaffViewBoardCardsAction(studentId: string): Promise<StudentViewBoardResult> {
  const { supabase, user } = await requireUser();
  try {
    const access = await assertCanViewStudent(supabase, user.id, studentId);
    return { ok: true, cards: await loadCards(supabase, studentId), access };
  } catch (e) {
    // 권한 거부는 500 대신 결과값으로 — 판정 자체는 그대로 서버에서 수행된다.
    if (e instanceof StudentViewDeniedError) return { ok: false, error: e.message };
    throw e;
  }
}

export async function loadStaffViewStatsAction(studentId: string): Promise<StatsData> {
  const { supabase, user } = await requireUser();
  const access = await assertCanViewStudent(supabase, user.id, studentId);
  if (!access.tabs.includes("stats")) throw new StudentViewDeniedError("통계는 열람할 수 없습니다.");
  // 권한 검사를 통과한 뒤의 읽기 전용 집계 — 수업·피드백 테이블의 RLS가 컨설턴트를
  // 열어주지 않고 채점 컬럼 권한이 회수돼 있으므로 서비스 클라이언트(정의자 집계 RPC)로 읽는다(쓰기 없음).
  // 통계 탭은 관리자·컨설턴트·학부모(본인 자녀) — 등급별로 필드를 서버에서 뺀다. 선생님은 탭이 없다.
  return loadStudentStats(createAdminClient(), studentId, statsTierFor(access.role));
}

export type StaffViewKind = "overview" | "board" | "stats";

// 열람 감사 기록 — DB RPC가 역할·담당·활성 배정을 다시 검사하고 같은 조합은 10분 안에 1건으로
// 묶는다. 학부모 열람은 기록하지 않는다(RPC가 거절).
export async function recordStaffStudentViewAction(studentId: string, view: StaffViewKind): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("record_staff_student_view", { p_student_id: studentId, p_view_kind: view });
  if (error) throw new Error(error.message);
}

const TASK_ROLE = { admin: "admin", consultant: "consultant", teacher: "teacher", parent: "admin" } as const;

export async function createStudentViewTaskAction(studentId: string, title: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const access = await assertCanWriteStudentTask(supabase, user.id, studentId, "create");
  const trimmed = title.trim();
  if (!trimmed) throw new Error("할 일 제목을 입력하세요.");
  await createBoardManualTask(supabase, {
    studentId,
    title: trimmed,
    createdBy: user.id,
    createdByRole: TASK_ROLE[access.role],
  });
}

// 이동·삭제는 task id만 받으므로 그 할 일의 학생을 서버에서 찾아 같은 검사를 한다.
async function assertCanWriteTask(taskId: string, action: StudentViewAction) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("board_manual_tasks").select("student_id").eq("id", taskId).maybeSingle();
  if (!data) throw new Error("할 일을 찾을 수 없습니다.");
  await assertCanWriteStudentTask(supabase, user.id, data.student_id as string, action);
  return supabase;
}

export async function updateStudentViewTaskStatusAction(taskId: string, status: BoardCardStatus): Promise<void> {
  const supabase = await assertCanWriteTask(taskId, "move");
  await updateBoardManualTaskStatus(supabase, taskId, status);
}

export async function deleteStudentViewTaskAction(taskId: string): Promise<void> {
  const supabase = await assertCanWriteTask(taskId, "delete");
  await deleteBoardManualTask(supabase, taskId);
}
