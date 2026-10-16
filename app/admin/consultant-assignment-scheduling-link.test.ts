import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-09-29 시나리오 감사 — 예약 링크 메일은 신청 대기(requested) 상담에만 나간다.

const state = vi.hoisted(() => ({
  consultation: { contact_name: "김", contact_email: "k@example.com", admissions_consultant_id: "c1", starts_at: null as string | null, status: "requested" },
  linkInsert: vi.fn().mockResolvedValue({ error: null }),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: async () => ({
    adminUserId: "admin1",
    supabase: {
      from: (table: string) => {
        if (table === "consultations") return { select: () => ({ eq: () => ({ single: async () => ({ data: state.consultation, error: null }) }) }) };
        if (table === "profiles") return { select: () => ({ eq: () => ({ single: async () => ({ data: { name: "이상담" }, error: null }) }) }) };
        if (table === "consultation_scheduling_links") return { insert: state.linkInsert };
        throw new Error(`unexpected table ${table}`);
      },
    },
  }),
}));
vi.mock("@/lib/consultation/notifications", () => ({
  sendConsultationSchedulingLinkEmail: (...a: unknown[]) => state.sendEmail(...a),
  sendConsultationRejectionEmail: vi.fn(),
}));
vi.mock("@/lib/request-origin", () => ({ currentRequestOrigin: async () => "http://localhost:3024" }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({}) }));

import { sendConsultationSchedulingLinkAction } from "./consultant-assignment-actions";

beforeEach(() => {
  state.consultation = { contact_name: "김", contact_email: "k@example.com", admissions_consultant_id: "c1", starts_at: null, status: "requested" };
  state.linkInsert.mockClear();
  state.sendEmail.mockClear();
});

describe("sendConsultationSchedulingLinkAction", () => {
  it("신청 대기 상담에는 링크를 만들고 메일을 1통 보낸다", async () => {
    await sendConsultationSchedulingLinkAction("c1");
    expect(state.linkInsert).toHaveBeenCalledTimes(1);
    expect(state.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("취소된 상담에는 링크도 메일도 만들지 않는다", async () => {
    state.consultation.status = "cancelled";
    await expect(sendConsultationSchedulingLinkAction("c1")).rejects.toThrow("신청 대기 상태의 상담에만");
    expect(state.linkInsert).not.toHaveBeenCalled();
    expect(state.sendEmail).not.toHaveBeenCalled();
  });

  it("담당 컨설턴트가 없거나 이미 시간이 확정된 상담은 거절한다", async () => {
    state.consultation.admissions_consultant_id = null as unknown as string;
    await expect(sendConsultationSchedulingLinkAction("c1")).rejects.toThrow("담당 컨설턴트가 먼저");
    state.consultation.admissions_consultant_id = "c1";
    state.consultation.starts_at = "2030-01-01T00:00:00Z";
    await expect(sendConsultationSchedulingLinkAction("c1")).rejects.toThrow("이미 일정이 확정");
    expect(state.sendEmail).not.toHaveBeenCalled();
  });
});
