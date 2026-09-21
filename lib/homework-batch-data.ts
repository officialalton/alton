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
  teacherName: string | null;
  studentId: string;
  label: string;
  subjectId: string | null;
  subjectName: string | null;
  items: HomeworkBatchItem[];
  createdAt: string;
};

const SELECT_COLUMNS = "id, teacher_id, student_id, label, subject_id, items, created_at, teacher:profiles!homework_batches_teacher_id_fkey(name), subject:subjects(name)";

type Row = {
  id: string; teacher_id: string; student_id: string; label: string; subject_id: string | null; items: unknown; created_at: string;
  teacher: { name: string | null } | { name: string | null }[] | null;
  subject: { name: string | null } | { name: string | null }[] | null;
};

function firstOf<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapRow(row: Row): HomeworkBatch {
  return {
    id: row.id, teacherId: row.teacher_id, teacherName: firstOf(row.teacher)?.name ?? null,
    studentId: row.student_id, label: row.label,
    subjectId: row.subject_id, subjectName: firstOf(row.subject)?.name ?? null,
    items: (row.items as HomeworkBatchItem[]) ?? [], createdAt: row.created_at,
  };
}

/** 학생 본인·보호자가 본다 — 자기(자녀) 과제 배치 전체(모든 발급 교사 포함).
 * 2026-09-21(P0 보안 차단) — homework_batches 는 이제 학생·보호자에게 직접 SELECT 가 열리지 않는다
 * (items JSON 에 정답·해설·자동채점·성적이 함께 들어 있어 REST API 로 그대로 읽혔다). SECURITY DEFINER
 * RPC 가 채점 확정(graded) 전 문항의 correctIndex/answers/explanation/autoCorrect/grade 를 null 로
 * 마스킹한 사본을 돌려준다. */
export async function loadStudentHomeworkBatches(supabase: SupabaseClient, studentId: string): Promise<HomeworkBatch[]> {
  const { data, error } = await supabase.rpc("homework_batches_for_viewer", { p_student_id: studentId });
  if (error) throw new Error(error.message);
  const rows = (Array.isArray(data) ? data : []) as (Omit<HomeworkBatch, "items"> & { items: HomeworkBatchItem[] | null })[];
  return rows.map((b) => ({ ...b, items: Array.isArray(b.items) ? b.items : [] }));
}

/** 교사 본인이 본다 — "이 교사가 이 학생에게 낸" 배치만(다른 교사가 낸 것은 RLS가 애초에 안 보여준다). */
export async function loadTeacherHomeworkBatchesForStudent(supabase: SupabaseClient, teacherId: string, studentId: string): Promise<HomeworkBatch[]> {
  const { data } = await supabase
    .from("homework_batches")
    .select(SELECT_COLUMNS)
    .eq("teacher_id", teacherId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => mapRow(r as unknown as Row));
}

export async function loadHomeworkBatch(supabase: SupabaseClient, batchId: string): Promise<HomeworkBatch | null> {
  const { data } = await supabase
    .from("homework_batches")
    .select(SELECT_COLUMNS)
    .eq("id", batchId)
    .maybeSingle();
  return data ? mapRow(data as unknown as Row) : null;
}
