// 2026-09-10(P1-3) — listKanbanBoardAction()의 조회 로직을 "use server" 액션
// 파일에서 분리한 순수 데이터 함수. admin/page.tsx가 상담 탭 SSR 시 이 함수를
// 직접 호출해 ConsultationKanbanBoard에 initialCards로 내려줄 수 있게 하기
// 위함이다("use server" 파일은 인증을 거친 클라이언트 호출용 액션만 export하고,
// 서버 컴포넌트에서 재사용할 조회 로직은 이렇게 별도 데이터 모듈에 둔다 —
// payout-batches-data.ts/workspace-data.ts와 동일한 관행).

import { createAdminClient } from "@/lib/supabase-admin";
import { archivedHouseholdProfileIds } from "@/lib/household/household-archive";
import {
  listConsultationsForAdmin,
  type ConsultationListItem,
} from "./consultation-scheduling-actions";
import type { KanbanStage } from "./consultation-kanban-constants";

// 2026-09-06(UAT 지적): 다자녀 온보딩의 원 상담(가족) 카드는 정책상 이력으로
// 계속 칸반에 남아있는 게 맞다(별도 보드 분리 금지 — 기존 확정 정책). 다만
// 학생별 카드와 나란히 있으면 관리자가 "왜 안 없어지냐"고 혼동하므로, 최소한
// 시각적으로 구분(흐리게 + "완료(이력)" 배지)할 수 있게 이 플래그를 함께
// 내려준다. 삭제·이동은 하지 않는다(카드 자체는 그대로).
//
// 2026-09-10(P1-B 신규 통합 보드) — 이 보드는 이제 상담 유입뿐 아니라
// "계정 생성"(consultation_id가 null인 trial_onboarding_links, 관리자가
// 상담 없이 보호자+학생 계정을 바로 만드는 기존 흐름) 유입도 함께 보여준다.
// intakeSource가 그 구분이다. 계정 생성 카드는 consultations 테이블에 아무
// 행도 만들지 않는다(가짜 상담 레코드 금지) — 화면에서만 ConsultationListItem과
// 같은 모양으로 조합해 기존 카드 렌더링·파이프라인 로직을 그대로 재사용한다.
export type KanbanCard = ConsultationListItem & {
  stage: KanbanStage;
  is_family_root_with_children: boolean;
  intakeSource: "consultation" | "account_creation";
};

type TrialProgress = { trialBookingDone: boolean; regularIntentDone: boolean };

// 2026-09-10(P1 성능 배치) — 이전에는 카드마다 getTrialOnboardingPipelineAction()을
// 호출해 카드당 인증 1회 + 순차 조회 최대 10회(subject_enrollments →
// teacher_assignments → trial_smart_notes_consents → entitlement_grants →
// sessions → lesson_reviews → trial_regular_progress_selections → contracts →
// contract_versions → purchases)가 반복됐다 — "체험 추천" 카드 수에 비례해
// N+1이 그대로 커졌다. 칸반 카드 단계 판정에는 저 13개 파이프라인 스텝 중
// 실제로 딱 2개(trial_booking, regular_intent)만 쓰이므로, 보드 전체에 대해
// 이 두 사실만 배치 쿼리 3회(자녀별 최신 subject_enrollment 1회 + 그 위의
// sessions 존재 여부 1회 + trial_regular_progress_selections 존재 여부 1회)로
// 한 번에 읽는다. 카드 수가 늘어도 쿼리 수는 늘지 않는다(N+1 제거). 상세
// 파이프라인(카드 상세 패널의 13단계 전체 표시)은 여전히
// getTrialOnboardingPipelineAction()을 그대로 쓴다 — 그건 카드 1개를 열 때만
// 호출되므로 N+1이 아니다.
async function loadTrialProgressByChild(
  admin: ReturnType<typeof createAdminClient>,
  childIds: string[]
): Promise<Map<string, TrialProgress>> {
  const result = new Map<string, TrialProgress>();
  if (childIds.length === 0) return result;

  const { data: enrollments } = await admin
    .from("subject_enrollments")
    .select("id, child_id, created_at")
    .in("child_id", childIds)
    .order("created_at", { ascending: false });

  const latestEnrollmentByChild = new Map<string, string>();
  for (const e of enrollments ?? []) {
    if (!latestEnrollmentByChild.has(e.child_id)) latestEnrollmentByChild.set(e.child_id, e.id);
  }
  const enrollmentIds = Array.from(latestEnrollmentByChild.values());
  if (enrollmentIds.length === 0) return result;

  const [{ data: sessionRows }, { data: intentRows }] = await Promise.all([
    admin.from("sessions").select("subject_enrollment_id").in("subject_enrollment_id", enrollmentIds),
    admin
      .from("trial_regular_progress_selections")
      .select("subject_enrollment_id")
      .in("subject_enrollment_id", enrollmentIds),
  ]);
  const enrollmentsWithSession = new Set((sessionRows ?? []).map((r) => r.subject_enrollment_id as string));
  const enrollmentsWithIntent = new Set((intentRows ?? []).map((r) => r.subject_enrollment_id as string));

  for (const [childId, enrollmentId] of latestEnrollmentByChild.entries()) {
    result.set(childId, {
      trialBookingDone: enrollmentsWithSession.has(enrollmentId),
      regularIntentDone: enrollmentsWithIntent.has(enrollmentId),
    });
  }
  return result;
}

// 2026-09-10(P1-B 신규 통합 보드) — "계정 생성"(consultation_id가 null인
// trial_onboarding_links) 유입 중 학생 계정까지 만들어진 건만 카드로
// 보여준다(아직 보호자가 링크를 열지 않은 건은 "발급 대기"일 뿐 진행할
// 파이프라인이 없어 이 보드에 넣지 않는다 — 기존 "계정 생성" 화면의 발송
// 내역 목록에서 그대로 확인 가능). 최대 200건까지만 읽어 유입이 늘어도
// 첫 화면이 느려지지 않게 한다.
const ACCOUNT_CREATION_CARD_LIMIT = 200;

function buildAccountCreationCard(
  student: { id: string; student_name: string; student_grade: string | null; child_auth_user_id: string; created_at: string },
  link: { guardian_name: string; guardian_email: string }
): ConsultationListItem {
  // 계정 생성 카드는 이미 계정이 만들어진 뒤라 "상담 신청/일정 확정"에
  // 해당하는 단계가 없다 — classifyStage()가 곧바로 체험 파이프라인 분기를
  // 타도록 status='completed'/outcome='trial_recommended'로 둔다. 이 값은
  // 화면 조합용일 뿐 어떤 테이블에도 쓰이지 않는다.
  //
  // 2026-09-10(제품 오너 지적): 보호자 1명이 자녀 여러 명을 만들면 카드마다
  // contact_name/contact_email이 전부 같은 보호자 정보라 어느 카드가 어느
  // 자녀인지 구분이 안 됐다. requested_children는 원래 다자녀 상담의
  // "아직 개별 카드로 안 쪼개진 자녀 목록"을 보여주던 필드인데, 카드 렌더
  // 코드가 이미 "자녀 N명: 이름, 이름"을 그대로 출력하므로 여기서는 이 카드가
  // 담당하는 자녀 1명만 담아 재사용한다(새 UI 코드 없이 동일한 방식으로 표시).
  return {
    id: `link:${student.id}`,
    contact_name: link.guardian_name,
    contact_email: link.guardian_email,
    contact_phone: null,
    student_grade: student.student_grade,
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
    consent_confirmed_at: null,
    child_id: student.child_auth_user_id,
    trial_intent_confirmed_at: student.created_at,
    trial_entitlement_grant_id: null,
    trial_entitlement_grant_status: "not_applicable",
    trial_entitlement_grant_error: null,
    trial_entitlement_grant_expires_at: null,
    family_root_consultation_id: null,
    is_child_onboarding_card: false,
    source_link_child_id: null,
    requested_children: [{ name: student.student_name, grade: student.student_grade ?? undefined }],
    consultReadiness: "not_applicable",
    completionReadiness: "not_applicable",
  };
}

async function loadAccountCreationCards(admin: ReturnType<typeof createAdminClient>): Promise<ConsultationListItem[]> {
  const { data: linkRows } = await admin
    .from("trial_onboarding_links")
    .select("id, guardian_name, guardian_email")
    .is("consultation_id", null);
  if (!linkRows || linkRows.length === 0) return [];

  const linkById = new Map(linkRows.map((l) => [l.id, l]));
  const { data: studentRows } = await admin
    .from("trial_onboarding_link_students")
    .select("id, link_id, student_name, student_grade, child_auth_user_id, created_at")
    .in("link_id", linkRows.map((l) => l.id))
    .eq("status", "created")
    .order("created_at", { ascending: false })
    .limit(ACCOUNT_CREATION_CARD_LIMIT);

  return (studentRows ?? [])
    .filter((s): s is typeof s & { child_auth_user_id: string } => !!s.child_auth_user_id)
    .map((s) => {
      const link = linkById.get(s.link_id)!;
      return buildAccountCreationCard(s, link);
    });
}

/** 개별 상담을 5단계 중 하나로 분류한다. 기존 상태값은 전혀 바꾸지 않고
 * 표시용으로만 압축한다 — 세부 상태(status/outcome/pipeline)는 카드 상세 패널에서
 * 그대로 조회 가능하다. */
function classifyStage(row: ConsultationListItem, trialProgressByChild: Map<string, TrialProgress>): KanbanStage {
  if (row.status === "requested") return "requested";
  if (row.status === "scheduled") return "scheduled";
  if (row.status !== "completed") return "scheduled"; // 예외적 상태는 안전하게 2단계로

  if (!row.outcome || row.outcome === "on_hold") return "scheduled";
  if (row.outcome === "regular_recommended") return "contract_sent";

  // outcome === 'trial_recommended' — 파이프라인 단계로 세분화한다.
  const progress = row.child_id ? trialProgressByChild.get(row.child_id) : undefined;
  if (!progress?.trialBookingDone) return "trial_requested";
  // 2026-09-05 사용자 지시: "계약" 단계는 관리자의 실제 발송 여부가 아니라
  // 보호자의 정규 진행 희망 표시(regular_intent) 시점부터 시작한다 — 관리자가
  // 아직 발송 버튼을 누르지 않았어도 카드는 이미 "계약" 칸에 있어야 한다.
  // 서명 완료(contract active) 시점에는 admin_close_consultation()이 자동으로
  // closure_type='contract_signed'를 채워 이 상담을 "지난 상담"으로 옮기므로
  // (app/api/webhooks/docusign/route.ts), 여기서는 그 이후 상태를 별도로 분기할
  // 필요가 없다.
  if (!progress.regularIntentDone) return "trial_scheduled";
  return "contract_sent";
}

/** 상담 현황 칸반 보드 — 종료(closure_type not null)/취소/노쇼 건은 제외한다
 * (종료 건은 "지난 상담" 탭, 취소·노쇼는 이 라운드 범위 밖). 호출자가 인증을
 * 책임진다(listKanbanBoardAction()과 admin/page.tsx 둘 다 이미 requireAdmin
 * 계열을 거친 뒤에만 이 함수를 호출한다). */
export async function loadKanbanBoard(admin: ReturnType<typeof createAdminClient>): Promise<KanbanCard[]> {
  // 2026-09-10(P1-1) — 세 조회(rows/closedIds/rootIds)는 서로 독립이다.
  // 이전엔 순차 실행(rows → closedIds → [stages] → rootIds)이라 왕복이
  // 불필요하게 늘어났다 — 병렬로 묶어 왕복 2회를 없앤다. (전체 이력 조회
  // 범위 자체를 DB 쪽에서 좁히는 것은 listConsultationsForAdmin()이 다른
  // 화면과 공유하는 함수라 이번 배치에서는 건드리지 않는다 — 범위 조정은
  // 별도 배치로 분리.)
  const [rows, { data: closedIdsData }, { data: rootIdsData }, accountCreationRows, archivedProfileIds] =
    await Promise.all([
      listConsultationsForAdmin({ from: "2020-01-01T00:00:00.000Z", to: "2035-01-01T00:00:00.000Z" }),
      admin.from("consultations").select("id").not("closure_type", "is", null),
      admin.from("consultations").select("family_root_consultation_id").not("family_root_consultation_id", "is", null),
      loadAccountCreationCards(admin),
      // P4-1(B) — 아카이브된 가구의 자녀 카드는 보드에서 뺀다. 상담 카드와
      // 계정 생성 카드 둘 다 child_id를 자녀 profile id로 채우므로(계정 생성
      // 카드는 child_auth_user_id) 합친 뒤 한 번만 걸러도 양쪽이 모두 처리된다.
      archivedHouseholdProfileIds(admin),
    ]);
  const closedIds = new Set((closedIdsData ?? []).map((r) => r.id as string));
  const activeConsultations = rows.filter((r) => !closedIds.has(r.id) && r.status !== "cancelled" && r.status !== "no_show");
  // 2026-09-10(P1-B) — 계정 생성 카드까지 합친 뒤에 파이프라인 배치 조회를
  // 한 번만 실행한다(카드 출처와 무관하게 여전히 쿼리 3회 고정).
  const active = [...activeConsultations, ...accountCreationRows].filter(
    (r) => !(r.child_id && archivedProfileIds.has(r.child_id))
  );

  // classifyStage가 실제로 trial_recommended+completed인 카드에서만 파이프라인
  // 정보를 쓰므로, 그 대상 자녀 id만 모아 배치 조회한다(카드 수와 무관하게
  // 쿼리 3회).
  const trialChildIds = Array.from(
    new Set(
      active
        .filter((r) => r.status === "completed" && r.outcome === "trial_recommended" && r.child_id)
        .map((r) => r.child_id as string)
    )
  );
  const trialProgressByChild = await loadTrialProgressByChild(admin, trialChildIds);
  const stages = active.map((r) => classifyStage(r, trialProgressByChild));

  const rootIdsWithChildren = new Set((rootIdsData ?? []).map((r) => r.family_root_consultation_id as string));

  return active.map((r, i) => ({
    ...r,
    stage: stages[i],
    is_family_root_with_children: !r.is_child_onboarding_card && rootIdsWithChildren.has(r.id),
    intakeSource: r.id.startsWith("link:") ? "account_creation" : "consultation",
  }));
}
