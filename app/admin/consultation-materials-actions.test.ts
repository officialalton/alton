import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock } = vi.hoisted(() => ({ requireAdminMock: vi.fn() }));
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: requireAdminMock }));

import { createConsultationMaterialAction, archiveConsultationMaterialAction } from "./consultation-materials-actions";

beforeEach(() => {
  requireAdminMock.mockReset();
});

describe("createConsultationMaterialAction", () => {
  it("제목이 없으면 거부한다", async () => {
    requireAdminMock.mockResolvedValue({ supabase: {}, adminUserId: "admin1" });
    await expect(createConsultationMaterialAction({ title: "  ", externalUrl: "https://example.com" })).rejects.toThrow(
      "제목을 입력해주세요."
    );
  });

  it("Drive 파일 ID도 외부 링크도 없으면 거부한다", async () => {
    requireAdminMock.mockResolvedValue({ supabase: {}, adminUserId: "admin1" });
    await expect(createConsultationMaterialAction({ title: "제목" })).rejects.toThrow(
      "Drive 파일 ID 또는 외부 링크 중 하나는 있어야 합니다."
    );
  });

  it("정상 입력이면 생성된다", async () => {
    const supabase = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: "m1",
                  title: "SAT 안내",
                  category: "입시",
                  drive_file_id: null,
                  external_url: "https://example.com",
                  description: null,
                  created_at: "2026-09-23T00:00:00Z",
                  archived_at: null,
                },
                error: null,
              }),
          }),
        }),
      }),
    };
    requireAdminMock.mockResolvedValue({ supabase, adminUserId: "admin1" });

    const result = await createConsultationMaterialAction({ title: "SAT 안내", category: "입시", externalUrl: "https://example.com" });
    expect(result.id).toBe("m1");
  });
});

describe("archiveConsultationMaterialAction", () => {
  it("archived_at을 설정한다", async () => {
    const updateMock = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    requireAdminMock.mockResolvedValue({ supabase: { from: () => ({ update: updateMock }) }, adminUserId: "admin1" });
    await archiveConsultationMaterialAction("m1");
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ archived_at: expect.any(String) }));
  });
});
