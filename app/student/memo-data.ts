import type { SupabaseClient } from "@supabase/supabase-js";

export type Memo = {
  id: string;
  authorRole: "teacher" | "student" | "admin";
  text: string;
  createdAt: string;
};

export async function loadMemos(
  supabase: SupabaseClient,
  enrollmentId: string
): Promise<Memo[]> {
  const { data } = await supabase
    .from("session_memos")
    .select("id, author_role, text, created_at")
    .eq("enrollment_id", enrollmentId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((m) => ({
    id: m.id,
    authorRole: m.author_role,
    text: m.text,
    createdAt: m.created_at,
  }));
}

// 2026-09-11(제품 오너 실사용 보고 — 선생님 "학생별 커리큘럼" 진입이 매우
// 느림, Gateway Timeout까지 실측) — 선생님 포털은 담당 학생 전체의 메모를
// enrollment마다 개별 조회했다(학생·과목 수만큼 동시 쿼리, 담당 학생이
// 많아지면 DB 커넥션에 부담을 줘 응답이 급격히 느려짐). 쿼리 1회로 전체
// enrollment의 메모를 한 번에 가져와 enrollmentId별로 묶어 반환한다.
export async function loadMemosByEnrollmentIds(
  supabase: SupabaseClient,
  enrollmentIds: string[]
): Promise<Record<string, Memo[]>> {
  if (enrollmentIds.length === 0) return {};
  const { data } = await supabase
    .from("session_memos")
    .select("id, enrollment_id, author_role, text, created_at")
    .in("enrollment_id", enrollmentIds)
    .order("created_at", { ascending: true });

  const result: Record<string, Memo[]> = {};
  for (const m of data ?? []) {
    const list = result[m.enrollment_id] ?? [];
    list.push({ id: m.id, authorRole: m.author_role, text: m.text, createdAt: m.created_at });
    result[m.enrollment_id] = list;
  }
  return result;
}
