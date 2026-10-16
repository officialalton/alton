import { describe, expect, it, vi } from "vitest";

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("@/lib/auth", () => ({ requireUser: async () => ({ user: { id: "u1" }, supabase: {} }) }));
vi.mock("@/lib/mock-exam/attempt-data", () => ({
  loadMockExamAttemptDetail: async () => {
    throw new Error("이 응시 기록을 볼 권한이 없습니다.");
  },
}));
vi.mock("@/lib/mock-exam/mst-actions", () => ({ loadMstAttemptStateAction: vi.fn() }));
vi.mock("./MockExamTakeClient", () => ({ default: () => null }));
vi.mock("./MockExamMstTakeClient", () => ({ default: () => null }));
vi.mock("./MockExamResultView", () => ({ default: () => null }));

import Page from "./page";

describe("학생 모의고사 응시 페이지", () => {
  it("남의 응시 id 로 RPC 가 권한 오류를 던지면 500 이 아니라 notFound", async () => {
    await expect(Page({ params: Promise.resolve({ attemptId: "x" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
