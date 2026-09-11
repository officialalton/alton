import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  TrialPipelineStepKey,
  TrialOnboardingPipeline,
} from "./trial-onboarding-actions";

// 2026-09-10(P1 성능 배치 — 매칭 하단 "상담 → 체험 → 정규 전환" 현황표)
// — 이전에는 후보 카드마다 getTrialOnboardingPipelineAction()을 호출해
// 카드당 인증 1회 + 순차 조회 최대 10회가 반복됐다(카드 최대 50장 ×
// 10 = 최대 500회 순차 DB 왕복). 신규(상담) 칸반의 N+1을 고친 것과 같은
// 방식으로, 후보 전체에 대해 필요한 값을 배치 쿼리 9회로 한 번에 읽고
// 조합한다 — 후보 수가 늘어도 쿼리 수는 늘지 않는다.
//
// getTrialOnboardingPipelineAction()(단일 후보, 카드 상세 모달에서만 호출)과
// 이 배치 로더 둘 다 아래 buildPipeline()으로 조합 로직을 공유해, 신규
// 통합 보드로 이관되더라도 이 배치 로더(loadTrialPipelinesBatch)를 그대로
// 재사용할 수 있게 했다.

export type TrialPipelineCandidateInput = {
  consultationId: string;
  childId: string | null;
  trialIntentConfirmedAt: string | null;
};

type PrefetchedMaps = {
  grantByConsultation: Map<string, { status: string | null; error: string | null }>;
  enrollmentByChild: Map<string, { id: string; status: string }>;
  activeAssignmentEnrollmentIds: Set<string>;
  consentChildIds: Set<string>;
  entitlementGrantChildIds: Set<string>;
  smartNotesCompletedEnrollmentIds: Set<string>;
  sessionExistsEnrollmentIds: Set<string>;
  reviewEnrollmentIds: Set<string>;
  regularIntentEnrollmentIds: Set<string>;
  latestContractByChild: Map<string, { id: string; status: string | null }>;
  contractSentContractIds: Set<string>;
  succeededPurchaseContractIds: Set<string>;
};

function buildPipeline(input: TrialPipelineCandidateInput, maps: PrefetchedMaps): TrialOnboardingPipeline {
  const done: Partial<Record<TrialPipelineStepKey, boolean>> = {
    trial_intent: !!input.trialIntentConfirmedAt,
    account_linked: !!input.childId,
  };
  let subjectEnrollmentId: string | null = null;

  if (input.childId) {
    const enrollment = maps.enrollmentByChild.get(input.childId) ?? null;
    subjectEnrollmentId = enrollment?.id ?? null;
    done.assignment = subjectEnrollmentId ? maps.activeAssignmentEnrollmentIds.has(subjectEnrollmentId) : false;
    done.subject_active = enrollment?.status === "active";
    done.trial_consent = maps.consentChildIds.has(input.childId);
    done.trial_entitlement = maps.entitlementGrantChildIds.has(input.childId);

    if (subjectEnrollmentId) {
      done.trial_booking = maps.sessionExistsEnrollmentIds.has(subjectEnrollmentId);
      done.smart_notes = maps.smartNotesCompletedEnrollmentIds.has(subjectEnrollmentId);
      done.review = maps.reviewEnrollmentIds.has(subjectEnrollmentId);
      done.regular_intent = maps.regularIntentEnrollmentIds.has(subjectEnrollmentId);
    }

    const contract = maps.latestContractByChild.get(input.childId) ?? null;
    if (contract) {
      done.contract_sent = maps.contractSentContractIds.has(contract.id);
      done.signed = contract.status === "active";
      done.purchase = maps.succeededPurchaseContractIds.has(contract.id);
    }
  }

  const order: TrialPipelineStepKey[] = [
    "trial_intent",
    "account_linked",
    "assignment",
    "trial_consent",
    "trial_entitlement",
    "trial_booking",
    "smart_notes",
    "review",
    "regular_intent",
    "contract_sent",
    "signed",
    "purchase",
    "subject_active",
  ];

  const grant = maps.grantByConsultation.get(input.consultationId);

  return {
    consultationId: input.consultationId,
    subjectEnrollmentId,
    trialEntitlementGrantStatus: grant?.status ?? null,
    trialEntitlementGrantError: grant?.error ?? null,
    steps: order.map((key) => ({ key, done: !!done[key], label: PIPELINE_STEP_LABELS[key] })),
  };
}

// trial-onboarding-actions.ts와 동일한 라벨 — 이 모듈이 순수 데이터 계층이라
// 그쪽의 라벨 상수를 그대로 다시 export하지 않고 복제해 순환 참조를 피한다.
// (라벨 문구를 바꿀 때는 두 파일 모두 갱신해야 한다 — 흔치 않은 변경이라
// 이 정도 중복은 감수한다.)
const PIPELINE_STEP_LABELS: Record<TrialPipelineStepKey, string> = {
  trial_intent: "체험 희망 확정",
  account_linked: "보호자·학생 계정 연결",
  assignment: "과목·선생님 배정",
  trial_consent: "체험 Smart Notes 동의",
  trial_entitlement: "체험수업권 지급",
  trial_booking: "체험 예약",
  smart_notes: "Smart Notes 연결",
  review: "선생님 리뷰 확정",
  regular_intent: "정규 진행 희망",
  contract_sent: "계약 발송",
  signed: "보호자 서명",
  purchase: "정규상품 구매",
  subject_active: "과목 활성화",
};

export async function loadTrialPipelinesBatch(
  admin: SupabaseClient,
  candidates: TrialPipelineCandidateInput[]
): Promise<Map<string, TrialOnboardingPipeline>> {
  const result = new Map<string, TrialOnboardingPipeline>();
  if (candidates.length === 0) return result;

  const consultationIds = candidates.map((c) => c.consultationId);
  const childIds = Array.from(new Set(candidates.map((c) => c.childId).filter((id): id is string => !!id)));

  const [{ data: consultationRows }, { data: enrollmentRows }] = await Promise.all([
    admin.from("consultations").select("id, trial_entitlement_grant_status, trial_entitlement_grant_error").in("id", consultationIds),
    childIds.length
      ? admin.from("subject_enrollments").select("id, child_id, status, created_at").in("child_id", childIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; child_id: string; status: string; created_at: string }[] }),
  ]);

  const grantByConsultation = new Map<string, { status: string | null; error: string | null }>();
  for (const r of consultationRows ?? []) {
    grantByConsultation.set(r.id, { status: r.trial_entitlement_grant_status, error: r.trial_entitlement_grant_error });
  }

  const enrollmentByChild = new Map<string, { id: string; status: string }>();
  for (const e of enrollmentRows ?? []) {
    if (!enrollmentByChild.has(e.child_id)) enrollmentByChild.set(e.child_id, { id: e.id, status: e.status });
  }
  const enrollmentIds = Array.from(new Set(Array.from(enrollmentByChild.values()).map((e) => e.id)));

  const [
    { data: assignmentRows },
    { data: consentRows },
    { data: grantRows },
    { data: sessionRows },
    { data: reviewRows },
    { data: intentRows },
    { data: contractRows },
  ] = await Promise.all([
    enrollmentIds.length
      ? admin.from("teacher_assignments").select("subject_enrollment_id").in("subject_enrollment_id", enrollmentIds).eq("status", "active")
      : Promise.resolve({ data: [] as { subject_enrollment_id: string }[] }),
    childIds.length
      ? admin.from("trial_smart_notes_consents").select("child_id").in("child_id", childIds)
      : Promise.resolve({ data: [] as { child_id: string }[] }),
    childIds.length
      ? admin.from("entitlement_grants").select("child_id, entitlement_products!inner(code)").in("child_id", childIds).eq("entitlement_products.code", "trial_lesson_grant")
      : Promise.resolve({ data: [] as { child_id: string }[] }),
    enrollmentIds.length
      ? admin.from("sessions").select("subject_enrollment_id, smart_notes_status, created_at").in("subject_enrollment_id", enrollmentIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { subject_enrollment_id: string; smart_notes_status: string | null; created_at: string }[] }),
    enrollmentIds.length
      ? admin.from("lesson_reviews").select("subject_enrollment_id").in("subject_enrollment_id", enrollmentIds).eq("lesson_type", "trial").eq("status", "final")
      : Promise.resolve({ data: [] as { subject_enrollment_id: string }[] }),
    enrollmentIds.length
      ? admin.from("trial_regular_progress_selections").select("subject_enrollment_id").in("subject_enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [] as { subject_enrollment_id: string }[] }),
    childIds.length
      ? admin.from("contracts").select("id, child_id, status, created_at").in("child_id", childIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; child_id: string; status: string | null; created_at: string }[] }),
  ]);

  const activeAssignmentEnrollmentIds = new Set((assignmentRows ?? []).map((r) => r.subject_enrollment_id));
  const consentChildIds = new Set((consentRows ?? []).map((r) => r.child_id));
  const entitlementGrantChildIds = new Set((grantRows ?? []).map((r) => r.child_id));
  const reviewEnrollmentIds = new Set((reviewRows ?? []).map((r) => r.subject_enrollment_id));
  const regularIntentEnrollmentIds = new Set((intentRows ?? []).map((r) => r.subject_enrollment_id));

  const sessionExistsEnrollmentIds = new Set<string>();
  const latestSessionByEnrollment = new Map<string, { smart_notes_status: string | null }>();
  for (const s of sessionRows ?? []) {
    sessionExistsEnrollmentIds.add(s.subject_enrollment_id);
    if (!latestSessionByEnrollment.has(s.subject_enrollment_id)) {
      latestSessionByEnrollment.set(s.subject_enrollment_id, { smart_notes_status: s.smart_notes_status });
    }
  }
  const smartNotesCompletedEnrollmentIds = new Set(
    Array.from(latestSessionByEnrollment.entries())
      .filter(([, v]) => v.smart_notes_status === "completed")
      .map(([k]) => k)
  );

  const latestContractByChild = new Map<string, { id: string; status: string | null }>();
  for (const c of contractRows ?? []) {
    if (!latestContractByChild.has(c.child_id)) latestContractByChild.set(c.child_id, { id: c.id, status: c.status });
  }
  const contractIds = Array.from(new Set(Array.from(latestContractByChild.values()).map((c) => c.id)));

  const [{ data: contractVersionRows }, { data: purchaseRows }] = await Promise.all([
    contractIds.length
      ? admin.from("contract_versions").select("contract_id, docusign_envelope_id, version_number").in("contract_id", contractIds).order("version_number", { ascending: false })
      : Promise.resolve({ data: [] as { contract_id: string; docusign_envelope_id: string | null; version_number: number }[] }),
    contractIds.length
      ? admin.from("purchases").select("contract_id").in("contract_id", contractIds).eq("status", "succeeded")
      : Promise.resolve({ data: [] as { contract_id: string }[] }),
  ]);

  const latestVersionByContract = new Map<string, { docusign_envelope_id: string | null }>();
  for (const v of contractVersionRows ?? []) {
    if (!latestVersionByContract.has(v.contract_id)) latestVersionByContract.set(v.contract_id, { docusign_envelope_id: v.docusign_envelope_id });
  }
  const contractSentContractIds = new Set(
    Array.from(latestVersionByContract.entries())
      .filter(([, v]) => !!v.docusign_envelope_id)
      .map(([k]) => k)
  );
  const succeededPurchaseContractIds = new Set((purchaseRows ?? []).map((r) => r.contract_id));

  const maps: PrefetchedMaps = {
    grantByConsultation,
    enrollmentByChild,
    activeAssignmentEnrollmentIds,
    consentChildIds,
    entitlementGrantChildIds,
    smartNotesCompletedEnrollmentIds,
    sessionExistsEnrollmentIds,
    reviewEnrollmentIds,
    regularIntentEnrollmentIds,
    latestContractByChild,
    contractSentContractIds,
    succeededPurchaseContractIds,
  };

  for (const c of candidates) {
    result.set(c.consultationId, buildPipeline(c, maps));
  }
  return result;
}
