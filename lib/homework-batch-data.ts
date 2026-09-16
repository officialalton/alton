import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-09-16 제품 오너 정정(2차) — 과제는 수업(세션)과 무관하다. 교사가 발급할 때마다 발급 날짜로
// 이름 붙는 새 배치가 생기고, 이 교사↔이 학생 쌍으로만 저장·노출된다. 단어장 즉석 시험 발급과 같은
// 구조 — session_homework_items/session_problem_work(세션 결합) 대신 문항 스냅샷을 담은 독립
// 테이블(homework_batches)을 쓴다.

export type HomeworkBatchItem = {
  problemId: string;
  position: number;
  format: "mc" | "spr" | "essay" | "math";
  passage: string | null;
  question: string | null;
  options: string[] | null;
  correctIndex: number | null;
  answers: string[] | null;
  explanation: string | null;
  statements: string[] | null;
  figure: unknown;
  response: string | null;
  submittedAt: string | null;
  /** mc/spr 는 제출 즉시 서버가 계산해 둔다 — graded=true 가 되기 전까지 학생에게는 보여주지 않는다. */
  autoCorrect: boolean | null;
  graded: boolean;
  gradedAt: string | null;
  grade: "correct" | "incorrect" | null;
  gradeComment: string | null;
};

export type HomeworkBatch = {
  id: string;
  teacherId: string;
  studentId: string;
  label: string;
  items: HomeworkBatchItem[];
  createdAt: string;
};

function mapRow(row: { id: string; teacher_id: string; student_id: string; label: string; items: unknown; created_at: string }): HomeworkBatch {
  return {
    id: row.id, teacherId: row.teacher_id, studentId: row.student_id, label: row.label,
    items: (row.items as HomeworkBatchItem[]) ?? [], createdAt: row.created_at,
  };
}

/** 학생 본인이 본다 — 자기 과제 배치 전체(모든 발급 교사 포함, RLS가 본인 것만 걸러준다). */
export async function loadStudentHomeworkBatches(supabase: SupabaseClient, studentId: string): Promise<HomeworkBatch[]> {
  const { data } = await supabase
    .from("homework_batches")
    .select("id, teacher_id, student_id, label, items, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map(mapRow);
}

/** 교사 본인이 본다 — "이 교사가 이 학생에게 낸" 배치만(다른 교사가 낸 것은 RLS가 애초에 안 보여준다). */
export async function loadTeacherHomeworkBatchesForStudent(supabase: SupabaseClient, teacherId: string, studentId: string): Promise<HomeworkBatch[]> {
  const { data } = await supabase
    .from("homework_batches")
    .select("id, teacher_id, student_id, label, items, created_at")
    .eq("teacher_id", teacherId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map(mapRow);
}

export async function loadHomeworkBatch(supabase: SupabaseClient, batchId: string): Promise<HomeworkBatch | null> {
  const { data } = await supabase
    .from("homework_batches")
    .select("id, teacher_id, student_id, label, items, created_at")
    .eq("id", batchId)
    .maybeSingle();
  return data ? mapRow(data) : null;
}
