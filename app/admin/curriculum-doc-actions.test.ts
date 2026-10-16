import { describe, expect, it, vi } from "vitest";

const { mockSingle, mockUpdateResult, mockUpdate, mockSupabase } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockUpdateResult = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: () => ({ select: () => ({ maybeSingle: mockUpdateResult }) }) }));
  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { role: "admin" } }),
            }),
          }),
        };
      }
      if (table === "curriculum_docs") {
        return {
          select: () => ({
            eq: () => ({ single: mockSingle }),
          }),
          update: mockUpdate,
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { mockSingle, mockUpdateResult, mockUpdate, mockSupabase };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function AnthropicMock(this: unknown) {
    return { messages: { create: vi.fn() } };
  }),
}));

import { deleteCurriculumDoc, setDocAccess } from "./curriculum-doc-actions";

describe("deleteCurriculumDoc", () => {
  it("배포된 문서는 삭제를 거부한다", async () => {
    mockSingle.mockResolvedValue({ data: { status: "published" }, error: null });
    await expect(deleteCurriculumDoc("doc1")).rejects.toThrow(
      "배포된 교재는 삭제할 수 없습니다. 먼저 배포를 취소하세요."
    );
  });
});

// 2026-10-05 무료 회원 S3
describe("setDocAccess", () => {
  it("허용되지 않은 값은 DB에 가기 전에 거절한다", async () => {
    mockUpdate.mockClear();
    expect(await setDocAccess("doc1", { accessTier: "public" as never })).toEqual({ ok: false, error: "공개 범위 값이 올바르지 않습니다." });
    expect(await setDocAccess("doc1", { rightsStatus: "ok" as never })).toEqual({ ok: false, error: "권리 상태 값이 올바르지 않습니다." });
    expect(await setDocAccess("doc1", {})).toEqual({ ok: false, error: "바꿀 내용이 없습니다." });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("DB 오류(free+권리 미확인 CHECK)는 메시지를 그대로 돌려준다", async () => {
    mockUpdateResult.mockResolvedValue({ data: null, error: { message: 'violates check constraint "curriculum_docs_free_requires_confirmed_rights"' } });
    const result = await setDocAccess("doc1", { accessTier: "free" });
    expect(result).toEqual({ ok: false, error: 'violates check constraint "curriculum_docs_free_requires_confirmed_rights"' });
    expect(mockUpdate).toHaveBeenCalledWith({ access_tier: "free" });
  });

  it("성공하면 트리거가 기록한 확인 시각을 돌려주고 메모는 trim/빈값→null", async () => {
    mockUpdateResult.mockResolvedValue({ data: { rights_confirmed_at: "2026-10-05T00:00:00Z" }, error: null });
    const result = await setDocAccess("doc1", { rightsStatus: "confirmed", rightsNote: "  " });
    expect(result).toEqual({ ok: true, rightsConfirmedAt: "2026-10-05T00:00:00Z" });
    expect(mockUpdate).toHaveBeenLastCalledWith({ rights_status: "confirmed", rights_note: null });
  });
});
