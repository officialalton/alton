// 2026-09-10(P1-3) — listKanbanBoardAction()의 조회 로직을 "use server" 액션
// 파일에서 분리한 순수 데이터 함수. admin/page.tsx가 상담 탭 SSR 시 이 함수를
// 직접 호출해 ConsultationKanbanBoard에 initialCards로 내려줄 수 있게 하기
// 위함이다("use server" 파일은 인증을 거친 클라이언트 호출용 액션만 export하고,
// 서버 컴포넌트에서 재사용할 조회 로직은 이렇게 별도 데이터 모듈에 둔다 —
// payout-batches-data.ts/workspace-data.ts와 동일한 관행).

import { createAdminClient } from "@/lib/supabase-admin";
import {
  listConsultationsForAdmin,
  type ConsultationListItem,
} from "./consultation-scheduling-actions";
import { getTrialOnboardingPipelineAction } from "./trial-onboarding-actions";
import type { KanbanStage } from "./consultation-kanban-constants";

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
  const [rows, { data: closedIdsData }, { data: rootIdsData }] = await Promise.all([
    listConsultationsForAdmin({ from: "2020-01-01T00:00:00.000Z", to: "2035-01-01T00:00:00.000Z" }),
    admin.from("consultations").select("id").not("closure_type", "is", null),
    admin.from("consultations").select("family_root_consultation_id").not("family_root_consultation_id", "is", null),
  ]);
  const closedIds = new Set((closedIdsData ?? []).map((r) => r.id as string));
  const active = rows.filter((r) => !closedIds.has(r.id) && r.status !== "cancelled" && r.status !== "no_show");
  const stages = await Promise.all(active.map((r) => classifyStage(admin, r)));

  const rootIdsWithChildren = new Set((rootIdsData ?? []).map((r) => r.family_root_consultation_id as string));

  return active.map((r, i) => ({
    ...r,
    stage: stages[i],
    is_family_root_with_children: !r.is_child_onboarding_card && rootIdsWithChildren.has(r.id),
  }));
}
