"use server";

import { requireAdminOrCapability } from "@/lib/admin-auth";
import {
  loadConsentGaps,
  loadCompletedConsents,
  type ConsentGapItem,
  type CompletedConsentItem,
} from "./consultation-data";

const CAPABILITY = "manage_guardian_consent";

// R2 Task 6 — 관리자의 수동 보호자 동의 등록(예: 서면/전화로 확인된 동의를
// 사후 입력). 일반 보호자 셀프서비스 동의(app/parent/consent-actions.ts)와는
// 별도 경로다 — 증빙(verification_reference) 필수 확인은
// record_manual_guardian_consent() DB 함수가 강제한다. 이 액션을 호출하는
// 관리자 화면은 아직 없다(R12 후속 UI 항목) — 이 파일은 그 UI가 붙을 때
// 바로 쓸 수 있는 서버 액션 자체만 먼저 마련해둔 것이다.
export async function recordManualGuardianConsent(params: {
  studentId: string;
  policyVersionId: string;
  consentedBy: string;
  verificationReference: string;
}): Promise<void> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  if (!params.verificationReference.trim()) {
    throw new Error("수동 확인 증빙을 입력해주세요.");
  }

  const { error } = await supabase.rpc("record_manual_guardian_consent", {
    p_student_id: params.studentId,
    p_policy_version_id: params.policyVersionId,
    p_consented_by: params.consentedBy,
    p_verification_reference: params.verificationReference,
    p_notice_delivered_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// P4-3 1단계 — `문서 > 동의서` 이관.
//
// 보호자 동의 현황은 지금까지 admin/page.tsx가 상담 탭 SSR에서 한 번 읽어
// prop으로 내려줬다. 이 화면이 `신규`에서 `문서`로 옮겨가면서 두 최상위 탭이
// 같은 데이터를 보게 되는데, SSR 드릴링 조건에 "documents"를 덧붙이면 동의서만
// 보려는 관리자가 오류 현황판용 로더까지 전부 실행하게 된다(P1-3에서 탭별
// 로더 분리로 없앤 문제로 되돌아간다).
//
// 그래서 이 두 액션으로 지연 조회한다. 화면 쪽은 useTabCachedData의 같은
// cacheKey를 쓰므로, 두 탭이 TTL 안에서는 한 번만 조회한다.
//
// 로더 자체(consultation-data.ts)는 손대지 않는다 — 기존 호출자와 동작이
// 갈라지지 않게 한다.
export async function listConsentGapsAction(): Promise<ConsentGapItem[]> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  return loadConsentGaps(supabase);
}

export async function listCompletedConsentsAction(): Promise<CompletedConsentItem[]> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  return loadCompletedConsents(supabase);
}
