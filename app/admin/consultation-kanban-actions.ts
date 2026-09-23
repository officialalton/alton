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

import { requireAdminOrCapability, requireConsultant } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { ConsultationListItem } from "./consultation-scheduling-actions";
import { getTrialOnboardingPipelineAction, type TrialOnboardingPipeline } from "./trial-onboarding-actions";
import type { ConsultationClosureType } from "./consultation-kanban-constants";
import { loadKanbanBoard, loadMyKanbanBoard, type KanbanCard } from "./consultation-kanban-data";

const CONSULT_CAPABILITY = "manage_consultations";

export type { KanbanStage, ConsultationClosureType } from "./consultation-kanban-constants";
export type { KanbanCard } from "./consultation-kanban-data";

/** 상담 현황 칸반 보드 — 종료(closure_type not null)/취소/노쇼 건은 제외한다
 * (종료 건은 "지난 상담" 탭, 취소·노쇼는 이 라운드 범위 밖).
 * 2026-09-10(P1-3) — 조회 로직은 consultation-kanban-data.ts로 옮겼다.
 * admin/page.tsx가 상담 탭 SSR 시 그 함수를 직접 호출해 initialCards로
 * 내려주므로, 이 액션은 사용자가 명시적으로 새로고침/변경 후 재조회할 때만
 * (ConsultationKanbanBoard의 refresh()) 클라이언트에서 호출된다.*/
export async function listKanbanBoardAction(): Promise<KanbanCard[]> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  return loadKanbanBoard(createAdminClient());
}

/** R15-A(2/3) — 컨설턴트 본인 배정 건만 보이는 칸반. */
export async function listMyKanbanBoardAction(): Promise<KanbanCard[]> {
  const { user } = await requireConsultant();
  return loadMyKanbanBoard(createAdminClient(), user.id);
}

export type ConsultationCardDetail = {
  // 2026-09-16(실사용 중 발견 → 재설계) — 계정 생성(consultation_id null)
  // 카드는 상담 라이프사이클(상담 결과 기록 전제의 보호자 동의 안내, 체험
  // 온보딩 안내 발송 등)을 흉내 내면 안 된다. 이 카드가 실제 상담인지
  // 계정 생성 유입인지는 상세 패널 렌더링에서도 구분이 필요해 목록(KanbanCard)
  // 과 동일한 방식(id가 "link:"로 시작하는지)으로 여기도 내려준다.
  intakeSource: "consultation" | "account_creation";
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
  // 2026-09-06(제품 오너 지적 — 자녀 카드 분기된 가족 카드에 빈 온보딩 폼이
  // 계속 뜨는 문제): 이 카드가 가족(부모) 원 상담이고 학생별 자녀 카드가 이미
  // 생성돼 있으면(family_root_consultation_id가 이 카드를 가리키는 행) 그
  // 목록. 비어있으면 아직 자녀 카드가 없다는 뜻 — 기존처럼 온보딩 발송 폼을
  // 그대로 보여준다.
  childCards: { consultationId: string; childName: string | null }[];
};

// 2026-09-10(P1-B 신규 통합 보드) — 카드 id가 "link:"로 시작하면 상담이
// 아니라 "계정 생성"(consultation_id가 null인 trial_onboarding_links) 유입
// 카드다. consultations 테이블에는 그 행이 없으므로 별도 경로로 상세를
// 조합한다 — 가짜 상담 레코드를 만들지 않고, 화면 표시용으로만
// ConsultationCardDetail과 같은 모양을 맞춘다.
async function getAccountCreationCardDetail(
  admin: ReturnType<typeof createAdminClient>,
  cardId: string
): Promise<ConsultationCardDetail> {
  const studentRowId = cardId.slice("link:".length);
  const { data: studentRow, error: studentError } = await admin
    .from("trial_onboarding_link_students")
    .select("id, link_id, student_name, child_auth_user_id, created_at")
    .eq("id", studentRowId)
    .maybeSingle();
  if (studentError) throw new Error(studentError.message);
  if (!studentRow) throw new Error("계정 생성 건을 찾을 수 없습니다.");

  const { data: link, error: linkError } = await admin
    .from("trial_onboarding_links")
    .select("id, guardian_name, guardian_email")
    .eq("id", studentRow.link_id)
    .maybeSingle();
  if (linkError) throw new Error(linkError.message);
  if (!link) throw new Error("계정 생성 링크를 찾을 수 없습니다.");

  const childId = studentRow.child_auth_user_id;
  // 2026-09-16(실사용 중 발견) — 계정 생성 경로는 consultations.consent_confirmed_at을
  // 애초에 안 쓰고 record_trial_smart_notes_consent()가 trial_smart_notes_consents에
  // 실제 동의를 남긴다(20261272000000). 이 카드 상세도(목록과 별개로) 그 값을
  // 확인하지 않고 항상 null로 합성해, 보호자가 실제로 동의를 마쳐도 카드 상세
  // 패널의 "보호자 동의 확인 대기 중" 배지가 절대 안 풀리는 결함이 있었다.
  const { data: consentRow } = childId
    ? await admin.from("trial_smart_notes_consents").select("confirmed_at").eq("child_id", childId).maybeSingle()
    : { data: null };
  const consultation: ConsultationListItem = {
    id: cardId,
    contact_name: link.guardian_name,
    contact_email: link.guardian_email,
    contact_phone: null,
    student_grade: null,
    concerns: null,
    status: "completed",
    source: "admin",
    starts_at: null,
    ends_at: null,
    scheduled_at: null,
    hold_expires_at: null,
    google_event_id: null,
    google_meet_link: null,
    google_sync_status: "not_applicable",
    google_sync_retry_count: 0,
    google_sync_last_error: null,
    smart_notes_config_status: "not_applicable",
    smart_notes_config_error: null,
    smart_notes_drive_file_id: null,
    admin_review_summary: null,
    outcome: "trial_recommended",
    outcome_notes: null,
    prospect_contact_id: null,
    consent_version_id: null,
    consent_confirmed_at: consentRow?.confirmed_at ?? null,
    child_id: childId,
    trial_intent_confirmed_at: studentRow.created_at,
    trial_entitlement_grant_id: null,
    trial_entitlement_grant_status: "not_applicable",
    trial_entitlement_grant_error: null,
    trial_entitlement_grant_expires_at: null,
    family_root_consultation_id: null,
    is_child_onboarding_card: false,
    source_link_child_id: null,
    admissions_consultant_id: null,
    requested_children: null,
    consultReadiness: "not_applicable",
    completionReadiness: "not_applicable",
  };

  const pipeline = await getTrialOnboardingPipelineAction(cardId, childId, consultation.trial_intent_confirmed_at);

  let contractId: string | null = null;
  let contractStatus: string | null = null;
  let latestContractVersionHasEnvelope = false;
  if (childId) {
    const { data: contract } = await admin
      .from("contracts")
      .select("id, status")
      .eq("child_id", childId)
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
    intakeSource: "account_creation",
    consultation,
    pipeline,
    childName: studentRow.student_name,
    guardianEmail: link.guardian_email,
    guardianName: link.guardian_name,
    contractId,
    contractStatus,
    latestContractVersionHasEnvelope,
    // 계정 생성 건의 안내 발송 상태는 "계정 생성" 화면의 발송 내역 목록에서
    // 이미 확인 가능하다(listDirectOnboardingLinksAction) — 이 카드는 이미
    // 계정이 생성된 뒤의 진행 상황을 보여주는 게 목적이라 여기서는 다루지
    // 않는다(범위 밖).
    noticeDeliveryStatus: null,
    noticeSendError: null,
    noticeSentAt: null,
    latestOnboardingLinkId: null,
    // 계정 생성 링크의 다자녀 형제자매는 family_root_consultation_id가 아니라
    // 같은 link_id로 묶인다 — 이번 배치 범위 밖으로 보류(형제자매 배지 없음).
    childCards: [],
  };
}

/** 카드 상세 패널 — 교사 배정을 제외한 모든 후속 액션에 필요한 정보를 한 번에 모은다. */
export async function getConsultationCardDetailAction(consultationId: string): Promise<ConsultationCardDetail> {
  await requireAdminOrCapability(CONSULT_CAPABILITY);
  const admin = createAdminClient();
  return loadConsultationCardDetail(admin, consultationId);
}

// R15-A(2/3) — 컨설턴트 전용 카드 상세 조회. 담당(본인) 건인지 서버에서 다시
// 확인한 뒤에만 같은 상세 조합 로직을 재사용한다 — 화면에서 행동만 가리는 게
// 아니라 조회 자체를 다른 컨설턴트의 카드로는 못 하게 막는다.
export async function getMyConsultationCardDetailAction(consultationId: string): Promise<ConsultationCardDetail> {
  const { supabase, user } = await requireConsultant();
  const admin = createAdminClient();

  if (consultationId.startsWith("link:")) {
    const childAuthUserId = await childIdForAccountCreationCard(admin, consultationId);
    if (!childAuthUserId) throw new Error("담당 건을 찾을 수 없습니다.");
    const { data: assignment } = await admin
      .from("consultant_assignments")
      .select("consultant_id")
      .eq("student_id", childAuthUserId)
      .maybeSingle();
    if (assignment?.consultant_id !== user.id) throw new Error("담당 학생이 아닙니다.");
  } else {
    const { data: consultation } = await supabase
      .from("consultations")
      .select("admissions_consultant_id")
      .eq("id", consultationId)
      .maybeSingle();
    if (consultation?.admissions_consultant_id !== user.id) throw new Error("담당 상담이 아닙니다.");
  }

  return loadConsultationCardDetail(admin, consultationId);
}

async function childIdForAccountCreationCard(
  admin: ReturnType<typeof createAdminClient>,
  cardId: string
): Promise<string | null> {
  const { data } = await admin
    .from("trial_onboarding_link_students")
    .select("child_auth_user_id")
    .eq("id", cardId.slice("link:".length))
    .maybeSingle();
  return data?.child_auth_user_id ?? null;
}

async function loadConsultationCardDetail(
  admin: ReturnType<typeof createAdminClient>,
  consultationId: string
): Promise<ConsultationCardDetail> {
  if (consultationId.startsWith("link:")) {
    return getAccountCreationCardDetail(admin, consultationId);
  }

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

  const { data: childCardRows } = await admin
    .from("consultations")
    .select("id, child_id")
    .eq("family_root_consultation_id", consultation.id);
  let childCards: ConsultationCardDetail["childCards"] = [];
  if (childCardRows && childCardRows.length > 0) {
    const childIds = childCardRows.map((r) => r.child_id).filter((id): id is string => !!id);
    const { data: childProfiles } = childIds.length
      ? await admin.from("profiles").select("id, name").in("id", childIds)
      : { data: [] as { id: string; name: string | null }[] };
    const nameById = new Map((childProfiles ?? []).map((p) => [p.id, p.name]));
    childCards = childCardRows.map((r) => ({
      consultationId: r.id,
      childName: r.child_id ? nameById.get(r.child_id) ?? null : null,
    }));
  }

  return {
    intakeSource: "consultation",
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
    childCards,
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

  // 2026-09-16(제품 오너 지시) — 계정 생성(consultation_id null) 카드는 상담이
  // 아니므로 "지난 상담"(신규 내역)에 넣을 때도 admin_close_consultation() 같은
  // 상담 전용 종료 경로를 타지 않는다. 완료 기준은 loadAccountCreationCards()가
  // "신규 현황"에서 뺄 때 쓰는 것과 정확히 같은 정본(contracts.status='active')
  // 이다 — 그래야 어느 목록에도 없거나 양쪽에 동시에 있는 카드가 생기지 않는다.
  const { data: linkRows } = await admin
    .from("trial_onboarding_links")
    .select("id, guardian_name, guardian_email")
    .is("consultation_id", null);
  if (linkRows && linkRows.length > 0) {
    const linkById = new Map(linkRows.map((l) => [l.id, l]));
    const { data: studentRows } = await admin
      .from("trial_onboarding_link_students")
      .select("id, link_id, student_name, child_auth_user_id")
      .in("link_id", linkRows.map((l) => l.id))
      .eq("status", "created");
    const childIds = (studentRows ?? [])
      .map((s) => s.child_auth_user_id)
      .filter((id): id is string => !!id);
    const { data: activeContracts } = childIds.length
      ? await admin.from("contracts").select("child_id, updated_at").eq("status", "active").in("child_id", childIds)
      : { data: [] as { child_id: string; updated_at: string }[] };
    const activeContractByChildId = new Map((activeContracts ?? []).map((c) => [c.child_id, c.updated_at]));

    for (const s of studentRows ?? []) {
      if (!s.child_auth_user_id) continue;
      const contractUpdatedAt = activeContractByChildId.get(s.child_auth_user_id);
      if (!contractUpdatedAt) continue;
      const link = linkById.get(s.link_id)!;
      items.push({
        id: `link:${s.id}`,
        contactName: link.guardian_name,
        contactEmail: link.guardian_email,
        closureType: "contract_signed",
        closedAt: contractUpdatedAt,
        closureReviewText: null,
      });
    }
    items.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  }

  const countsByType: Record<ConsultationClosureType, number> = {
    no_trial: 0,
    trial_no_convert: 0,
    regular_in_progress: 0,
    contract_signed: 0,
  };
  for (const item of items) countsByType[item.closureType]++;

  return { items, countsByType };
}
