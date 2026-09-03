"use server";

import { headers } from "next/headers";
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

export type OpenConsultSlot = { startsAt: string };

export async function listOpenHomepageConsultSlots(fromIso: string, toIso: string): Promise<OpenConsultSlot[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_open_consult_slots", { p_from: fromIso, p_to: toIso });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ slot_starts_at: string }>).map((r) => ({ startsAt: r.slot_starts_at }));
}

export async function submitHomepageConsultRequest(params: {
  parentName: string;
  email: string;
  phone: string;
  studentGrade: string;
  concerns: string;
  slotStartsAtIso: string;
  idempotencyKey: string;
}): Promise<{ id: string; status: string }> {
  if (!params.parentName.trim() || !params.email.trim()) {
    throw new Error("이름과 이메일은 필수입니다.");
  }
  if (!params.slotStartsAtIso) {
    throw new Error("상담 시간을 선택해 주세요.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("submit_homepage_consult_request", {
    p_full_name: params.parentName.trim(),
    p_email: params.email.trim(),
    p_phone: params.phone.trim() || null,
    p_starts_at: params.slotStartsAtIso,
    p_student_grade: params.studentGrade.trim() || null,
    p_concerns: params.concerns.trim() || null,
    p_idempotency_key: params.idempotencyKey,
  });
  if (error) throw new Error(error.message);
  const row = data as { id: string; status: string };
  return { id: row.id, status: row.status };
}

export type ConsultConsentView = {
  consultationId: string;
  contactName: string;
  startsAt: string | null;
  consentVersion: { id: string; title: string; bodyMarkdown: string; isPlaceholder: boolean } | null;
  alreadyConfirmedAt: string | null;
};

/** 상담용 동의 확인 화면(요구사항 4) — 상담 전 1회만 확인, 반복 체크 없음. */
export async function getConsultConsentView(consultationId: string): Promise<ConsultConsentView | null> {
  const admin = createAdminClient();
  const { data: consultation, error } = await admin
    .from("consultations")
    .select("id, contact_name, starts_at, consent_version_id, consent_confirmed_at")
    .eq("id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!consultation) return null;

  let consentVersion: ConsultConsentView["consentVersion"] = null;
  const versionId = consultation.consent_version_id;
  const { data: version } = await admin
    .from("consult_consent_versions")
    .select("id, title, body_markdown, is_placeholder")
    .eq("id", versionId ?? "")
    .maybeSingle();
  if (version) {
    consentVersion = { id: version.id, title: version.title, bodyMarkdown: version.body_markdown, isPlaceholder: version.is_placeholder };
  }

  return {
    consultationId: consultation.id,
    contactName: consultation.contact_name,
    startsAt: consultation.starts_at,
    consentVersion,
    alreadyConfirmedAt: consultation.consent_confirmed_at,
  };
}

/** 상담 전 1회 동의 확인 — 반복 체크 없음(요구사항 4). 법률 문구가 placeholder인 동안에도
 * 확인 행위 자체(누가/언제/어떤 버전에)는 정확히 기록해 최종 문구 교체 후 재확인 정책을
 * 설계할 수 있게 한다. */
export async function confirmConsultConsent(consultationId: string): Promise<void> {
  const admin = createAdminClient();
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? null;

  const { data: consultation } = await admin
    .from("consultations")
    .select("id, consent_confirmed_at")
    .eq("id", consultationId)
    .maybeSingle();
  if (!consultation) throw new Error("상담 신청을 찾을 수 없습니다.");
  if (consultation.consent_confirmed_at) return; // 이미 확인됨 — 반복 체크 없음(멱등)

  const { error } = await admin
    .from("consultations")
    .update({ consent_confirmed_at: new Date().toISOString(), consent_confirmed_ip: ip })
    .eq("id", consultationId);
  if (error) throw new Error(error.message);
}
