import { beforeEach, describe, expect, it, vi } from "vitest";

const membershipMaybeSingleMock = vi.fn();
const profileMaybeSingleMock = vi.fn();
const adminRpcMock = vi.fn();

const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "household_members") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ limit: () => ({ maybeSingle: membershipMaybeSingleMock }) }),
          }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: profileMaybeSingleMock }) }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  }),
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({
    user: { id: "guardian1", email: "guardian@example.com" },
    profile: { role: "parent", name: "김민지" },
    supabase: supabaseMock,
  })),
}));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock }),
}));

import { submitGuardianConsultRequest, listOpenGuardianConsultSlots } from "./consult-request-actions";

describe("submitGuardianConsultRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    membershipMaybeSingleMock.mockResolvedValue({
      data: { household_id: "household1", household: { default_timezone: "Asia/Seoul" } },
    });
    profileMaybeSingleMock.mockResolvedValue({ data: { timezone: null } });
  });

  it("자녀 1명으로 신청하면 세션의 household_id/보호자 정보를 그대로 RPC에 넘긴다(재입력 없음)", async () => {
    adminRpcMock.mockResolvedValue({ data: { id: "c1", status: "requested" }, error: null });

    const result = await submitGuardianConsultRequest({
      slotStartsAtIso: "2027-01-01T09:00:00.000Z",
      children: [{ name: "철수", grade: "10학년" }],
    });

    expect(result).toEqual({ ok: true, consultationId: "c1", status: "requested" });
    expect(adminRpcMock).toHaveBeenCalledWith(
      "submit_guardian_portal_consult_request",
      expect.objectContaining({
        p_household_id: "household1",
        p_guardian_id: "guardian1",
        p_guardian_name: "김민지",
        p_guardian_email: "guardian@example.com",
        p_children: [{ name: "철수", grade: "10학년", subjectInterest: null, concerns: null }],
      })
    );
  });

  it("자녀 3명을 한 번에 신청할 수 있다", async () => {
    adminRpcMock.mockResolvedValue({ data: { id: "c2", status: "requested" }, error: null });

    const result = await submitGuardianConsultRequest({
      slotStartsAtIso: "2027-01-01T09:00:00.000Z",
      children: [{ name: "철수" }, { name: "영희" }, { name: "민수" }],
    });

    expect(result.ok).toBe(true);
    const call = adminRpcMock.mock.calls[0][1] as { p_children: unknown[] };
    expect(call.p_children).toHaveLength(3);
  });

  it("자녀 이름이 비어있으면 RPC를 호출하지 않고 실패를 반환한다", async () => {
    const result = await submitGuardianConsultRequest({
      slotStartsAtIso: "2027-01-01T09:00:00.000Z",
      children: [{ name: "" }],
    });
    expect(result).toEqual({ ok: false, error: "모든 자녀의 이름을 입력해주세요." });
    expect(adminRpcMock).not.toHaveBeenCalled();
  });

  it("household 멤버십이 없으면 실패를 반환한다(예외를 던지지 않음)", async () => {
    membershipMaybeSingleMock.mockResolvedValue({ data: null });
    const result = await submitGuardianConsultRequest({
      slotStartsAtIso: "2027-01-01T09:00:00.000Z",
      children: [{ name: "철수" }],
    });
    expect(result).toEqual({ ok: false, error: "소속된 household가 없습니다. 관리자에게 문의해주세요." });
  });

  it("RPC 에러도 예외를 던지지 않고 실패 결과로 변환한다", async () => {
    adminRpcMock.mockResolvedValue({ data: null, error: { message: "이미 처리 대기 중인 자녀 추가 상담 신청이 있습니다." } });
    const result = await submitGuardianConsultRequest({
      slotStartsAtIso: "2027-01-01T09:00:00.000Z",
      children: [{ name: "철수" }],
    });
    expect(result).toEqual({ ok: false, error: "이미 처리 대기 중인 자녀 추가 상담 신청이 있습니다." });
  });
});

describe("listOpenGuardianConsultSlots", () => {
  it("list_open_consult_slots RPC를 그대로 재사용한다(랜딩과 동일 단일 원본)", async () => {
    adminRpcMock.mockResolvedValue({ data: [{ slot_starts_at: "2027-01-01T09:00:00.000Z" }], error: null });
    const slots = await listOpenGuardianConsultSlots("2027-01-01T00:00:00.000Z", "2027-01-08T00:00:00.000Z");
    expect(slots).toEqual([{ startsAt: "2027-01-01T09:00:00.000Z" }]);
    expect(adminRpcMock).toHaveBeenCalledWith("list_open_consult_slots", {
      p_from: "2027-01-01T00:00:00.000Z",
      p_to: "2027-01-08T00:00:00.000Z",
    });
  });
});
