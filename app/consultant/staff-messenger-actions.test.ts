import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireConsultantMock } = vi.hoisted(() => ({ requireConsultantMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireConsultant: requireConsultantMock }));

import { startMyStaffInquiryAction, sendMyStaffMessageAction, getMyStaffMessengerUnreadCountAction } from "./staff-messenger-actions";

beforeEach(() => {
  requireConsultantMock.mockReset();
});

describe("startMyStaffInquiryAction", () => {
  it("문의와 첫 메시지를 함께 만든다", async () => {
    const insertMessageMock = vi.fn(() => Promise.resolve({ error: null }));
    const supabase = {
      from: (table: string) => {
        if (table === "consultant_admin_inquiries") {
          return { insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "i1" }, error: null }) }) }) };
        }
        if (table === "consultant_admin_messages") return { insert: insertMessageMock };
        throw new Error(`unexpected ${table}`);
      },
    };
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });

    const result = await startMyStaffInquiryAction("이슈가 있습니다", "장비 문제");

    expect(result).toEqual({ inquiryId: "i1" });
    expect(insertMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ inquiry_id: "i1", sender_id: "c1", sender_role: "consultant", body: "이슈가 있습니다" })
    );
  });

  it("내용이 비어있으면 거부한다", async () => {
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase: {} });
    await expect(startMyStaffInquiryAction("   ")).rejects.toThrow("내용을 입력해주세요.");
  });
});

describe("sendMyStaffMessageAction", () => {
  it("종료된 문의에 보내면 에러 메시지를 사람이 읽을 수 있게 바꾼다", async () => {
    const supabase = {
      from: () => ({ insert: () => Promise.resolve({ error: { message: "violates foreign key constraint on consultant_admin_inquiries" } }) }),
    };
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });
    await expect(sendMyStaffMessageAction("i1", "내용")).rejects.toThrow("종료된 문의입니다.");
  });
});

describe("getMyStaffMessengerUnreadCountAction", () => {
  it("관리자가 보낸 메시지 중 안 읽은 것만 센다", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "consultant_admin_message_reads") {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) };
        }
        if (table === "consultant_admin_inquiries") {
          return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "i1" }] }) }) };
        }
        if (table === "consultant_admin_messages") {
          return { select: () => ({ in: () => ({ eq: () => ({ gt: () => Promise.resolve({ count: 3, error: null }) }) }) }) };
        }
        throw new Error(`unexpected ${table}`);
      },
    };
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });
    expect(await getMyStaffMessengerUnreadCountAction()).toBe(3);
  });

  it("본인 스레드가 없으면 0", async () => {
    const supabase = {
      from: (table: string) => {
        if (table === "consultant_admin_message_reads") {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) };
        }
        if (table === "consultant_admin_inquiries") {
          return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
        }
        throw new Error(`unexpected ${table}`);
      },
    };
    requireConsultantMock.mockResolvedValue({ user: { id: "c1" }, supabase });
    expect(await getMyStaffMessengerUnreadCountAction()).toBe(0);
  });
});
