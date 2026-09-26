import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock, adminFromMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  adminFromMock: vi.fn(),
}));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/supabase-admin", () => ({ createAdminClient: () => ({ from: adminFromMock }) }));

import { postTeacherAssignmentResultSystemMessage, startStaffInquiryAction } from "./staff-messenger-actions";

beforeEach(() => {
  requireAdminMock.mockReset();
  adminFromMock.mockReset();
  requireAdminMock.mockResolvedValue({ supabase: {}, adminUserId: "admin1" });
});

describe("postTeacherAssignmentResultSystemMessage", () => {
  it("열린 스레드가 있으면 재사용해서 시스템 메시지를 남긴다", async () => {
    const insertMessageMock = vi.fn(() => Promise.resolve({ error: null }));
    adminFromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "master-admin" }, error: null }) }) }) }) }) };
      }
      if (table === "consultant_admin_inquiries") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "existing-inquiry" } }) }) }) }) }) }),
        };
      }
      if (table === "consultant_admin_messages") return { insert: insertMessageMock };
      throw new Error(`unexpected ${table}`);
    });

    await postTeacherAssignmentResultSystemMessage({ consultantId: "c1", body: "수락했습니다" });

    expect(insertMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ inquiry_id: "existing-inquiry", sender_id: "master-admin", sender_role: "admin", body: "수락했습니다" })
    );
  });

  it("열린 스레드가 없으면 새로 만든다", async () => {
    const insertMessageMock = vi.fn(() => Promise.resolve({ error: null }));
    adminFromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "master-admin" }, error: null }) }) }) }) }) };
      }
      if (table === "consultant_admin_inquiries") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "new-inquiry" }, error: null }) }) }),
        };
      }
      if (table === "consultant_admin_messages") return { insert: insertMessageMock };
      throw new Error(`unexpected ${table}`);
    });

    await postTeacherAssignmentResultSystemMessage({ consultantId: "c1", body: "거절했습니다" });

    expect(insertMessageMock).toHaveBeenCalledWith(expect.objectContaining({ inquiry_id: "new-inquiry" }));
  });
});

describe("startStaffInquiryAction", () => {
  it("관리자가 컨설턴트에게 먼저 문의를 시작한다", async () => {
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
    requireAdminMock.mockResolvedValue({ supabase, adminUserId: "admin1" });

    const result = await startStaffInquiryAction("c1", "안내드립니다", "공지");
    expect(result).toEqual({ inquiryId: "i1" });
    expect(insertMessageMock).toHaveBeenCalledWith(expect.objectContaining({ sender_id: "admin1", sender_role: "admin" }));
  });
});
