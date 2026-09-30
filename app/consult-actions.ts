"use server";

import { createAdminClient } from "@/lib/supabase-admin";

// M1 — 홈페이지 상담 신청. 레거시 consult_requests에 직접 쓰던 것을 v3
// consultations(+ prospect_contacts)로 통합했다(요구사항 2·5, master-roadmap-v3.md
// "근접 실행계획" M1). 실제 상태 전이·hold·중복 슬롯 방지는 전부
// submit_homepage_consult_request() SECURITY DEFINER 함수(20261009000000)가
// 담당하고, 이 서버 액션은 얇은 호출부일 뿐이다 — 레거시 consult_requests 테이블은
// 더 이상 신규 신청 경로로 쓰지 않는다(과거 데이터 조회용으로만 동결 보존).
//
// 확정 발송 이메일(수락 시점)은 lib/consultation/calendar-sync.ts가 담당한다 —
// 이 신청 단계에서는 접수 확인 이메일을 별도로 보내지 않는다(레거시 흐름과
// 달리, 아직 관리자가 승인하지 않은 슬롯이라 "확정" 톤의 메일을 보낼 수 없다 —
// 홈페이지 화면 자체가 "승인 대기" 상태를 즉시 안내한다).

// 2026-09-29 오너 규칙 — 상담 시간은 고객과 "배정된 컨설턴트" 사이에만 존재한다.
// 공용 슬롯 목록(list_open_consult_slots)은 제거됐고, DB(submit_homepage_consult_request)도
// 시간을 받으면 거절한다.
// 2026-09-22(컨설턴트 스펙 Phase 2b, 사용자 승인) — 홈페이지는 이제 "신청만"
// 받는다. 슬롯은 어드미션 컨설턴트 배정 후 그 사람 전용 스케줄링 링크
// (app/schedule-actions.ts)로 고객이 직접 고른다. slotStartsAtIso는 더 이상
// 필수가 아니다 — submit_homepage_consult_request()도 이제 nullable을 받는다.
export async function submitHomepageConsultRequest(params: {
  parentName: string;
  email: string;
  phone: string;
  studentGrade: string;
  concerns: string;
  idempotencyKey: string;
}): Promise<{ id: string; status: string }> {
  if (!params.parentName.trim() || !params.email.trim()) {
    throw new Error("이름과 이메일은 필수입니다.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_homepage_consult_request", {
    p_full_name: params.parentName.trim(),
    p_email: params.email.trim(),
    p_phone: params.phone.trim() || null,
    p_starts_at: null,
    p_student_grade: params.studentGrade.trim() || null,
    p_concerns: params.concerns.trim() || null,
    p_idempotency_key: params.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  const row = data as { id: string; status: string };
  return { id: row.id, status: row.status };
}
