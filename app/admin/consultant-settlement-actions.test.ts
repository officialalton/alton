import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminOrCapabilityMock } = vi.hoisted(() => ({ requireAdminOrCapabilityMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdminOrCapability: requireAdminOrCapabilityMock }));

const { adminFromMock } = vi.hoisted(() => ({ adminFromMock: vi.fn() }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ from: adminFromMock }) }));

import {
  createConsultantPayoutPeriodAction,
  updateConsultantPayoutPeriodAmountAction,
  updateConsultantPayoutPeriodStatusAction,
} from "./consultant-settlement-actions";

beforeEach(() => {
  requireAdminOrCapabilityMock.mockReset();
  adminFromMock.mockReset();
  requireAdminOrCapabilityMock.mockResolvedValue({ actorUserId: "admin1" });
});

describe("createConsultantPayoutPeriodAction", () => {
  it("draft로 생성하고 created 이벤트를 남긴다", async () => {
    const insertEventMock = vi.fn(() => Promise.resolve({ error: null }));
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultant_payout_periods") {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "p1" }, error: null }) }) }),
        };
      }
      if (table === "consultant_payout_period_events") {
        return { insert: insertEventMock };
      }
      throw new Error(`unexpected ${table}`);
    });

    const result = await createConsultantPayoutPeriodAction({
      consultantId: "c1",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      amountMinor: 500000,
      currency: "KRW",
    });

    expect(result).toEqual({ id: "p1" });
    expect(insertEventMock).toHaveBeenCalledWith(expect.objectContaining({ period_id: "p1", event_type: "created" }));
  });

  it("종료일이 시작일보다 빠르면 거부한다", async () => {
    await expect(
      createConsultantPayoutPeriodAction({
        consultantId: "c1",
        periodStart: "2026-09-30",
        periodEnd: "2026-09-01",
        amountMinor: 100,
        currency: "KRW",
      })
    ).rejects.toThrow("종료일은 시작일보다 빠를 수 없습니다.");
  });
});

describe("updateConsultantPayoutPeriodAmountAction", () => {
  it("금액이 바뀌면 이력을 남긴다", async () => {
    const insertEventMock = vi.fn(() => Promise.resolve({ error: null }));
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultant_payout_periods") {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: { consultant_id: "c1", amount_minor: 500000, currency: "KRW" }, error: null }) }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === "consultant_payout_period_events") return { insert: insertEventMock };
      throw new Error(`unexpected ${table}`);
    });

    await updateConsultantPayoutPeriodAmountAction({ periodId: "p1", amountMinor: 600000 });

    expect(insertEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "amount_changed", previous_value: "500000 KRW", new_value: "600000 KRW" })
    );
  });

  it("금액이 같으면 아무것도 하지 않는다", async () => {
    const insertEventMock = vi.fn();
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultant_payout_periods") {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { consultant_id: "c1", amount_minor: 500000, currency: "KRW" }, error: null }) }) }) };
      }
      return { insert: insertEventMock };
    });
    await updateConsultantPayoutPeriodAmountAction({ periodId: "p1", amountMinor: 500000 });
    expect(insertEventMock).not.toHaveBeenCalled();
  });
});

describe("updateConsultantPayoutPeriodStatusAction", () => {
  it("draft -> paid로 바로 전이하면 거부한다", async () => {
    adminFromMock.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { consultant_id: "c1", status: "draft" }, error: null }) }) }),
    });
    await expect(updateConsultantPayoutPeriodStatusAction({ periodId: "p1", status: "paid" })).rejects.toThrow(
      "draft에서 paid(으)로 바꿀 수 없습니다."
    );
  });

  it("confirmed -> paid는 허용하고 paid_at/paid_by를 남긴다", async () => {
    const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const insertEventMock = vi.fn(() => Promise.resolve({ error: null }));
    adminFromMock.mockImplementation((table: string) => {
      if (table === "consultant_payout_periods") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { consultant_id: "c1", status: "confirmed" }, error: null }) }) }),
          update: updateMock,
        };
      }
      return { insert: insertEventMock };
    });

    await updateConsultantPayoutPeriodStatusAction({ periodId: "p1", status: "paid" });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "paid", paid_by: "admin1" }));
    expect(insertEventMock).toHaveBeenCalledWith(expect.objectContaining({ event_type: "status_changed", previous_value: "confirmed", new_value: "paid" }));
  });
});
