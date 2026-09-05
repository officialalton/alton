import { describe, expect, it, vi, beforeEach } from "vitest";

const { adminFromMock, rpcMock, listConsultationsMock, pipelineMock } = vi.hoisted(() => ({
  adminFromMock: vi.fn(),
  rpcMock: vi.fn(),
  listConsultationsMock: vi.fn(),
  pipelineMock: vi.fn(),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: adminFromMock, auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } } }),
}));
vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn().mockResolvedValue({ supabase: { rpc: rpcMock }, actorUserId: "admin1" }),
}));
vi.mock("./consultation-scheduling-actions", () => ({
  listConsultationsForAdmin: listConsultationsMock,
}));
vi.mock("./trial-onboarding-actions", () => ({
  getTrialOnboardingPipelineAction: pipelineMock,
}));

import { listKanbanBoardAction, closeConsultationAction } from "./consultation-kanban-actions";

function baseRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    contact_name: "김민지",
    contact_email: "minji@example.com",
    contact_phone: null,
    student_grade: null,
    concerns: null,
    status: "requested",
    source: "admin",
    starts_at: null,
    ends_at: null,
    scheduled_at: null,
    hold_expires_at: null,
    google_event_id: null,
    google_meet_link: null,
    google_sync_status: "pending",
    google_sync_retry_count: 0,
    google_sync_last_error: null,
    smart_notes_config_status: "pending",
    smart_notes_config_error: null,
    smart_notes_drive_file_id: null,
    admin_review_summary: null,
    outcome: null,
    outcome_notes: null,
    prospect_contact_id: null,
    consent_version_id: null,
    consent_confirmed_at: null,
    child_id: null,
    trial_entitlement_grant_id: null,
    trial_entitlement_grant_status: "not_applicable",
    trial_entitlement_grant_error: null,
    trial_entitlement_grant_expires_at: null,
    consultReadiness: "not_applicable",
    completionReadiness: "not_applicable",
    ...overrides,
  };
}

describe("listKanbanBoardAction — 5단계 stage 분류", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminFromMock.mockReturnValue({
      select: () => ({ not: () => Promise.resolve({ data: [] }) }),
    });
  });

  it("requested 상태는 '상담 신청' 컬럼으로 분류한다", async () => {
    listConsultationsMock.mockResolvedValue([baseRow({ status: "requested" })]);
    const cards = await listKanbanBoardAction();
    expect(cards).toHaveLength(1);
    expect(cards[0].stage).toBe("requested");
  });

  it("scheduled 상태는 '상담 일정 확정' 컬럼으로 분류한다", async () => {
    listConsultationsMock.mockResolvedValue([baseRow({ status: "scheduled" })]);
    const cards = await listKanbanBoardAction();
    expect(cards[0].stage).toBe("scheduled");
  });

  it("outcome=regular_recommended면 '계약서 전달' 컬럼으로 분류한다", async () => {
    listConsultationsMock.mockResolvedValue([baseRow({ status: "completed", outcome: "regular_recommended" })]);
    const cards = await listKanbanBoardAction();
    expect(cards[0].stage).toBe("contract_sent");
  });

  it("outcome=trial_recommended이고 체험 예약이 아직이면 '체험 신청' 컬럼으로 분류한다", async () => {
    listConsultationsMock.mockResolvedValue([baseRow({ status: "completed", outcome: "trial_recommended", child_id: "child1" })]);
    pipelineMock.mockResolvedValue({
      consultationId: "c1",
      subjectEnrollmentId: "se1",
      trialEntitlementGrantStatus: null,
      trialEntitlementGrantError: null,
      steps: [
        { key: "trial_booking", done: false, label: "체험 예약" },
        { key: "contract_sent", done: false, label: "계약 발송" },
      ],
    });
    const cards = await listKanbanBoardAction();
    expect(cards[0].stage).toBe("trial_requested");
  });

  it("체험 예약은 됐지만 계약 발송 전이면 '체험 일정 확정' 컬럼으로 분류한다", async () => {
    listConsultationsMock.mockResolvedValue([baseRow({ status: "completed", outcome: "trial_recommended", child_id: "child1" })]);
    pipelineMock.mockResolvedValue({
      consultationId: "c1",
      subjectEnrollmentId: "se1",
      trialEntitlementGrantStatus: null,
      trialEntitlementGrantError: null,
      steps: [
        { key: "trial_booking", done: true, label: "체험 예약" },
        { key: "contract_sent", done: false, label: "계약 발송" },
      ],
    });
    const cards = await listKanbanBoardAction();
    expect(cards[0].stage).toBe("trial_scheduled");
  });

  it("종료(closure_type not null)된 상담은 칸반 보드에서 제외한다", async () => {
    listConsultationsMock.mockResolvedValue([baseRow({ id: "c1" }), baseRow({ id: "c2" })]);
    adminFromMock.mockReturnValue({
      select: () => ({ not: () => Promise.resolve({ data: [{ id: "c2" }] }) }),
    });
    const cards = await listKanbanBoardAction();
    expect(cards.map((c) => c.id)).toEqual(["c1"]);
  });
});

describe("closeConsultationAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("admin_close_consultation RPC를 종료유형·리뷰텍스트와 함께 호출한다", async () => {
    rpcMock.mockResolvedValue({ error: null });
    await closeConsultationAction({ consultationId: "c1", closureType: "trial_no_convert", reviewText: "요약본" });
    expect(rpcMock).toHaveBeenCalledWith("admin_close_consultation", {
      p_consultation_id: "c1",
      p_closure_type: "trial_no_convert",
      p_review_text: "요약본",
    });
  });

  it("RPC 에러를 그대로 던진다", async () => {
    rpcMock.mockResolvedValue({ error: { message: "이미 종료된 상담입니다." } });
    await expect(
      closeConsultationAction({ consultationId: "c1", closureType: "no_trial", reviewText: "요약" })
    ).rejects.toThrow("이미 종료된 상담입니다.");
  });
});
