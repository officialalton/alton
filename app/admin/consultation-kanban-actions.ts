"use server";

// M4 UAT #3.1/#5/#6 — "상담 현황" 화면 재편(관리자 정보구조 재편):
// - 기존 13+ 세부 상태(status/outcome/파이프라인 13단계)를 5단계 칸반으로 압축해
//   보여주되, 세부 상태는 카드 상세 패널에서 그대로 노출한다(정보 손실 없음).
// - "선생님 배정만 빼고" 상담 파이프라인의 모든 액션(체험 온보딩 안내 발송,
//   체험수업권 재처리, 체험 리뷰 확정, 정규 계약 발송)을 이 화면 카드 상세에서
//   직접 실행 가능하게 통합한다. 서버 액션 로직 자체는 기존 모듈을 그대로
//   재사용한다(중복 구현 금지) — 이 파일은 그 액션들을 카드 단위로 조합하는
//   조회 전용 계층 + 종료(closure) 액션만 새로 추가한다.
// - 선생님 배정 액션만 기존 위치(SubjectEnrollmentPanel)에 그대로 둔다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  listConsultationsForAdmin,
  type ConsultationListItem,
} from "./consultation-scheduling-actions";
import { getTrialOnboardingPipelineAction, type TrialOnboardingPipeline } from "./trial-onboarding-actions";
import type { KanbanStage, ConsultationClosureType } from "./consultation-kanban-constants";

const CONSULT_CAPABILITY = "manage_consultations";

export type { KanbanStage, ConsultationClosureType } from "./consultation-kanban-constants";

// 2026-09-06(UAT 지적): 다자녀 온보딩의 원 상담(가족) 카드는 정책상 이력으로
// 계속 칸반에 남아있는 게 맞다(별도 보드 분리 금지 — 기존 확정 정책). 다만
// 학생별 카드와 나란히 있으면 관리자가 "왜 안 없어지냐"고 혼동하므로, 최소한
// 시각적으로 구분(흐리게 + "완료(이력)" 배지)할 수 있게 이 플래그를 함께
// 내려준다. 삭제·이동은 하지 않는다(카드 자체는 그대로).
export type KanbanCard = ConsultationListItem & { stage: KanbanStage; is_family_root_with_children: boolean };

/** 개별 상담을 5단계 중 하나로 분류한다. 기존 상태값은 전혀 바꾸지 않고
 * 표시용으로만 압축한다 — 세부 상태(status/outcome/pipeline)는 카드 상세 패널에서
 * 그대로 조회 가능하다. */
async function classifyStage(
  admin: ReturnType<typeof createAdminClient>,
  row: ConsultationListItem
): Promise<KanbanStage> {
  if (row.status === "requested") return "requested";
  if (row.status === "scheduled") return "scheduled";
  if (row.status !== "completed") return "scheduled"; // 예외적 상태는 안전하게 2단계로

  if (!row.outcome || row.outcome === "on_hold") return "scheduled";
  if (row.outcome === "regular_recommended") return "contract_sent";

  // outcome === 'trial_recommended' — 파이프라인 단계로 세분화한다.
  const pipeline = await getTrialOnboardingPipelineAction(row.id, row.child_id, row.trial_intent_confirmed_at);
  const done = (key: string) => pipeline.steps.find((s) => s.key === key)?.done ?? false;
  if (!done("trial_booking")) return "trial_requested";
  // 2026-09-05 사용자 지시: "계약" 단계는 관리자의 실제 발송 여부가 아니라
  // 보호자의 정규 진행 희망 표시(regular_intent) 시점부터 시작한다 — 관리자가
  // 아직 발송 버튼을 누르지 않았어도 카드는 이미 "계약" 칸에 있어야 한다.
  // 서명 완료(contract active) 시점에는 admin_close_consultation()이 자동으로
  // closure_type='contract_signed'를 채워 이 상담을 "지난 상담"으로 옮기므로
  // (app/api/webhooks/docusign/route.ts), 여기서는 그 이후 상태를 별도로 분기할
  // 필요가 없다.
  if (!done("regular_intent")) return "trial_scheduled";
  return "contract_sent";
}

/** 상담 현황 칸반 보드 — 종료(closure_type not null)/취소/노쇼 건은 제외한다
 * (종료 건은 "지난 상담" 탭, 취소·노쇼는 이 라운드 범위 밖). */
export async function listKanbanBoardAction(): Promise<KanbanCard[]> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const rows = await listConsultationsForAdmin({ from: "2020-01-01T00:00:00.000Z", to: "2035-01-01T00:00:00.000Z" });
  const { data: closedIdsData } = await admin.from("consultations").select("id").not("closure_type", "is", null);
  const closedIds = new Set((closedIdsData ?? []).map((r) => r.id as string));
  const active = rows.filter((r) => !closedIds.has(r.id) && r.status !== "cancelled" && r.status !== "no_show");
  const stages = await Promise.all(active.map((r) => classifyStage(admin, r)));

  const { data: rootIdsData } = await admin
    .from("consultations")
    .select("family_root_consultation_id")
    .not("family_root_consultation_id", "is", null);
  const rootIdsWithChildren = new Set((rootIdsData ?? []).map((r) => r.family_root_consultation_id as string));

  return active.map((r, i) => ({
    ...r,
    stage: stages[i],
    is_family_root_with_children: !r.is_child_onboarding_card && rootIdsWithChildren.has(r.id),
  }));
}

export type ConsultationCardDetail = {
  consultation: ConsultationListItem;
  pipeline: TrialOnboardingPipeline | null;
  childName: string | null;
  guardianEmail: string | null;
  guardianName: string | null;
  contractId: string | null;
  contractStatus: string | null;
  latestContractVersionHasEnvelope: boolean;
  // 체험 온보딩 안내 이메일의 최신 발송 상태 — 발송 실패가 로그로만 남고
  // 관리자 화면에서는 안 보이던 문제를 보완(2026-09-05)하기 위해 노출한다.
  // 이 상담에 발급된 적 없으면(링크 없음) 전부 null.
  noticeDeliveryStatus: "pending" | "sent" | "failed" | null;
  noticeSendError: string | null;
  noticeSentAt: string | null;
  // 2026-09-06(발송 상태 조회 화면) — 이 상담에 발급된 최신 온보딩 링크의 id.
  // 관리자가 카드 상세에서 "발송 내역 보기"로 그 링크의 진행 상태(학생별
  // 입력값·계정 생성 상태 포함)를 조회할 때 쓴다. 발급된 적 없으면 null.
  latestOnboardingLinkId: string | null;
};

/** 카드 상세 패널 — 교사 배정을 제외한 모든 후속 액션에 필요한 정보를 한 번에 모은다. */
export async function getConsultationCardDetailAction(consultationId: string): Promise<ConsultationCardDetail> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();

  const { data: consultationRow, error } = await admin
    .from("consultations")
    .select(
      "id, contact_name, contact_email, contact_phone, student_grade, concerns, status, source, starts_at, ends_at, scheduled_at, hold_expires_at, google_event_id, google_meet_link, google_sync_status, google_sync_retry_count, google_sync_last_error, smart_notes_config_status, smart_notes_config_error, smart_notes_drive_file_id, admin_review_summary, outcome, outcome_notes, prospect_contact_id, consent_version_id, consent_confirmed_at, child_id, trial_intent_confirmed_at, trial_entitlement_grant_id, trial_entitlement_grant_status, trial_entitlement_grant_error, family_root_consultation_id, is_child_onboarding_card, source_link_child_id"
    )
    .eq("id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!consultationRow) throw new Error("상담을 찾을 수 없습니다.");

  const consultation: ConsultationListItem = {
    ...(consultationRow as Omit<ConsultationListItem, "consultReadiness" | "completionReadiness" | "trial_entitlement_grant_expires_at">),
    trial_entitlement_grant_expires_at: null,
    consultReadiness: "not_applicable",
    completionReadiness: "not_applicable",
  };

  let pipeline: TrialOnboardingPipeline | null = null;
  let childName: string | null = null;
  let guardianEmail: string | null = null;
  let guardianName: string | null = null;
  let contractId: string | null = null;
  let contractStatus: string | null = null;
  let latestContractVersionHasEnvelope = false;

  // 잠재고객 단계(child_id 아직 없음)에서도 pipeline은 항상 조회한다 — 그래야
  // "account_linked" 단계 미완료 상태가 정상적으로 채워져 체험 온보딩 안내 발송
  // 폼(TrialNoticeForm)이 카드 상세에 노출된다(classifyStage()와 동일한 패턴).
  pipeline = await getTrialOnboardingPipelineAction(consultation.id, consultation.child_id, consultation.trial_intent_confirmed_at);

  const { data: latestLink } = await admin
    .from("trial_onboarding_links")
    .select("id, notice_delivery_status, notice_send_error, notice_sent_at")
    .eq("consultation_id", consultation.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const noticeDeliveryStatus = (latestLink?.notice_delivery_status as ConsultationCardDetail["noticeDeliveryStatus"]) ?? null;
  const noticeSendError = latestLink?.notice_send_error ?? null;
  const noticeSentAt = latestLink?.notice_sent_at ?? null;
  const latestOnboardingLinkId = latestLink?.id ?? null;

  if (consultation.child_id) {
    const { data: childProfile } = await admin.from("profiles").select("name").eq("id", consultation.child_id).maybeSingle();
    childName = childProfile?.name ?? null;

    const { data: hm } = await admin
      .from("household_members")
      .select("household_id")
      .eq("profile_id", consultation.child_id)
      .eq("role", "child")
      .maybeSingle();
    if (hm) {
      const { data: guardianHm } = await admin
        .from("household_members")
        .select("profile_id")
        .eq("household_id", hm.household_id)
        .eq("role", "guardian")
        .limit(1)
        .maybeSingle();
      if (guardianHm) {
        const { data: guardianProfile } = await admin.from("profiles").select("name").eq("id", guardianHm.profile_id).maybeSingle();
        const { data: guardianAuth } = await admin.auth.admin.getUserById(guardianHm.profile_id);
        guardianName = guardianProfile?.name ?? null;
        guardianEmail = guardianAuth?.user?.email ?? null;
      }
    }

    const { data: contract } = await admin
      .from("contracts")
      .select("id, status")
      .eq("child_id", consultation.child_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (contract) {
      contractId = contract.id;
      contractStatus = contract.status;
      const { data: version } = await admin
        .from("contract_versions")
        .select("docusign_envelope_id")
        .eq("contract_id", contract.id)
        .eq("version_status", "active")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      latestContractVersionHasEnvelope = !!version?.docusign_envelope_id;
    }
  }

  return {
    consultation,
    pipeline,
    childName,
    guardianEmail: guardianEmail ?? consultation.contact_email,
    guardianName: guardianName ?? consultation.contact_name,
    contractId,
    contractStatus,
    latestContractVersionHasEnvelope,
    noticeDeliveryStatus,
    noticeSendError,
    noticeSentAt,
    latestOnboardingLinkId,
  };
}

// =========================================================================
// 상담 종료 ("상담 종료" 버튼 → 리뷰 팝업 → 종료 처리 → 지난 상담 탭)
// =========================================================================

/** 팝업 초기값 힌트 — AI 미팅록 재요약본 대신, 현재 확정 정보(admin_review_summary,
 * 체험 리뷰 최종 텍스트)를 이어붙인 초안을 채워준다(실제 AI 재호출은 배선하지
 * 않는다 — lesson_reviews.ai_summary와 동일하게 이번 범위에서는 붙여넣기/수정형).
 * 종료유형도 현재까지 확인된 정보로 기본값을 추천하되, 최종 선택은 관리자가 한다. */
export async function getClosureDraftAction(
  consultationId: string
): Promise<{ suggestedClosureType: ConsultationClosureType; draftText: string }> {
  const detail = await getConsultationCardDetailAction(consultationId);
  const parts: string[] = [];
  if (detail.consultation.admin_review_summary) parts.push(detail.consultation.admin_review_summary);

  let suggested: ConsultationClosureType = "no_trial";
  if (detail.contractStatus === "active" || detail.latestContractVersionHasEnvelope) {
    suggested = "contract_signed";
    if (detail.contractStatus !== "active") suggested = "regular_in_progress";
  } else if (detail.pipeline?.steps.find((s) => s.key === "regular_intent")?.done) {
    suggested = "regular_in_progress";
  } else if (detail.pipeline?.steps.find((s) => s.key === "trial_booking")?.done) {
    suggested = "trial_no_convert";
  }

  return {
    suggestedClosureType: suggested,
    draftText: parts.join("\n\n") || "",
  };
}

export async function closeConsultationAction(params: {
  consultationId: string;
  closureType: ConsultationClosureType;
  reviewText: string;
}): Promise<void> {
  const { supabase } = await requireAdminOrCapability(CONSULT_CAPABILITY);
  const { error } = await supabase.rpc("admin_close_consultation", {
    p_consultation_id: params.consultationId,
    p_closure_type: params.closureType,
    p_review_text: params.reviewText,
  });
  if (error) throw new Error(error.message);
}

export type ClosedConsultationItem = {
  id: string;
  contactName: string;
  contactEmail: string;
  closureType: ConsultationClosureType;
  closedAt: string;
  closureReviewText: string | null;
};

export async function listClosedConsultationsAction(): Promise<{
  items: ClosedConsultationItem[];
  countsByType: Record<ConsultationClosureType, number>;
}> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("consultations")
    .select("id, contact_name, contact_email, closure_type, closed_at, closure_review_text")
    .not("closure_type", "is", null)
    .order("closed_at", { ascending: false });
  if (error) throw new Error(error.message);

  const items: ClosedConsultationItem[] = (data ?? []).map((r) => ({
    id: r.id as string,
    contactName: r.contact_name as string,
    contactEmail: r.contact_email as string,
    closureType: r.closure_type as ConsultationClosureType,
    closedAt: r.closed_at as string,
    closureReviewText: r.closure_review_text as string | null,
  }));

  const countsByType: Record<ConsultationClosureType, number> = {
    no_trial: 0,
    trial_no_convert: 0,
    regular_in_progress: 0,
    contract_signed: 0,
  };
  for (const item of items) countsByType[item.closureType]++;

  return { items, countsByType };
}
