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

// M1 요구사항 5(2026-09-03 정정) — 상담 UUID 자체를 공개 확인 권한으로 쓰지 않는다. 이메일에는
// 상담에 귀속된 만료형 확인 토큰만 실리고(원문은 DB/로그에 남기지 않음, consult_consent_tokens는
// 해시만 저장), 이 서버 액션들은 그 토큰으로만 상담을 찾는다. resolve_consult_consent_token()/
// confirm_consult_consent_by_token()은 위조된 토큰이든 존재하지 않는 토큰이든 구분되는 에러를
//주지 않는다(존재 여부 열거 방지).

/** 상담용 동의 확인 화면(요구사항 4·5) — 상담 전 1회만 확인, 반복 체크 없음. 토큰으로만 조회한다. */
export async function getConsultConsentView(token: string): Promise<ConsultConsentView | null> {
  const admin = createAdminClient();
  const { data: resolved, error: resolveError } = await admin.rpc("resolve_consult_consent_token", { p_token_plain: token });
  if (resolveError) throw new Error(resolveError.message);
  const row = (resolved as Array<{ consultation_id: string; already_used: boolean }> | null)?.[0];
  if (!row) return null;

  const { data: consultation, error } = await admin
    .from("consultations")
    .select("id, contact_name, starts_at, consent_version_id, consent_confirmed_at")
    .eq("id", row.consultation_id)
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

/** 상담 전 1회 동의 확인 — 반복 체크 없음(요구사항 4), 토큰 기반·동일 요청 멱등(요구사항 5).
 * 법률 문구가 placeholder인 동안에도 확인 행위 자체(누가/언제/어떤 버전에)는 정확히 기록해
 * 최종 문구 교체 후 재확인 정책을 설계할 수 있게 한다. */
export async function confirmConsultConsent(token: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("confirm_consult_consent_by_token", { p_token_plain: token });
  if (error) throw new Error(error.message);

  // consent_confirmed_ip는 요청 헤더 접근이 필요해 RPC(순수 SQL 계층) 밖, 여기서 별도
  // 기록한다 — RPC가 이미 멱등이므로 이 UPDATE도 몇 번을 다시 실행해도 최신 IP로만 갱신될
  // 뿐 안전하다(감사 목적상 "최초 확인 시각"인 consent_confirmed_at은 RPC가 이미 고정했다).
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? hdrs.get("x-real-ip") ?? null;
  if (ip) {
    const { data: resolved } = await admin.rpc("resolve_consult_consent_token", { p_token_plain: token });
    const row = (resolved as Array<{ consultation_id: string }> | null)?.[0];
    if (row) {
      await admin.from("consultations").update({ consent_confirmed_ip: ip }).eq("id", row.consultation_id).is("consent_confirmed_ip", null);
    }
  }
}
