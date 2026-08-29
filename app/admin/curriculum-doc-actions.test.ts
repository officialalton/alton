import { describe, expect, it, vi } from "vitest";

const { mockSingle, mockSupabase } = vi.hoisted(() => {
  const mockSingle = vi.fn();
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
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { mockSingle, mockSupabase };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function AnthropicMock(this: unknown) {
    return { messages: { create: vi.fn() } };
  }),
}));

import { deleteCurriculumDoc } from "./curriculum-doc-actions";

describe("deleteCurriculumDoc", () => {
  it("배포된 문서는 삭제를 거부한다", async () => {
    mockSingle.mockResolvedValue({ data: { status: "published" }, error: null });
    await expect(deleteCurriculumDoc("doc1")).rejects.toThrow(
      "배포된 교재는 삭제할 수 없습니다. 먼저 배포를 취소하세요."
    );
  });
});
