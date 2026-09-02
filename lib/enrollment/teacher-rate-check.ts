// R2 선생님 active 전환과 R5 선생님 배정(체험→정규 승계, 최초 배정) 모두
// "이 선생님이 유효한 현재 시급을 갖고 있는가"를 같은 DB 함수
// (has_valid_current_teacher_rate)로 확인한다. 두 곳에서 각자 RPC를 호출하고
// 각자 우호적 오류 메시지를 만들던 걸 하나로 합쳐, DB 트리거의 원시 오류
// 대신 항상 같은 방식으로 미리 확인·안내하게 한다.

import type { createAdminClient } from "@/lib/supabase-admin";

export type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * 이 선생님에게 유효한 현재 시급이 있는지 확인한다. service_role 전용 RPC라
 * admin 클라이언트로만 호출 가능하다(app/admin/users-actions.ts,
 * app/admin/subject-enrollment-actions.ts와 동일 패턴).
 */
export async function hasValidCurrentTeacherRate(
  admin: AdminClient,
  teacherId: string
): Promise<boolean> {
  const { data, error } = await admin.rpc("has_valid_current_teacher_rate", {
    p_teacher_id: teacherId,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * 유효한 시급이 없으면 주어진 안내 메시지로 즉시 던진다. 호출부(R2 active
 * 전환, R5 선생님 배정)마다 문맥에 맞는 메시지를 넘긴다 — DB
 * 트리거(teachers_enforce_active_requires_rate,
 * teacher_assignments_enforce_rate)가 최종 방어선이지만 원시 오류를 사용자에게
 * 그대로 보여주지 않기 위함이다.
 */
export async function assertTeacherHasValidRate(
  admin: AdminClient,
  teacherId: string,
  friendlyMessage: string
): Promise<void> {
  const hasRate = await hasValidCurrentTeacherRate(admin, teacherId);
  if (!hasRate) {
    throw new Error(friendlyMessage);
  }
}
