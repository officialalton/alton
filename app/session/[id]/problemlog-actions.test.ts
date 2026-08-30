import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "student1" } } });
const problemSingleMock = vi.fn();
const insertMock = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "problems") {
        return { select: () => ({ eq: () => ({ single: problemSingleMock }) }) };
      }
      if (table === "session_problem_attempts") {
        return { insert: insertMock };
      }
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: { role: "student" } }) }) }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: async () => ({ data: "active", error: null }),
  }),
}));

describe("retryEssayAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "student1" } } });
    insertMock.mockResolvedValue({ error: null });
  });

  it("문제의 실제 format이 mc면 해설을 반환하지 않는다 (다른 포맷 문제 해설 우회 차단)", async () => {
    problemSingleMock.mockResolvedValue({
      data: { explanation: "MC 문제의 정답 해설", format: "mc" },
    });
    const { retryEssayAttempt } = await import("./problemlog-actions");

    const result = await retryEssayAttempt("mc-problem-1", "아무거나");

    expect(result.explanation).toBeNull();
  });

  it("문제의 실제 format이 essay면 해설을 정상 반환한다", async () => {
    problemSingleMock.mockResolvedValue({
      data: { explanation: "서술형 문제의 정답 해설", format: "essay" },
    });
    const { retryEssayAttempt } = await import("./problemlog-actions");

    const result = await retryEssayAttempt("essay-problem-1", "내 답안입니다");

    expect(result.explanation).toBe("서술형 문제의 정답 해설");
  });
});

describe("retryMathAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "student1" } } });
    insertMock.mockResolvedValue({ error: null });
  });

  it("문제의 실제 format이 mc면 해설을 반환하지 않는다", async () => {
    problemSingleMock.mockResolvedValue({
      data: { explanation: "MC 문제의 정답 해설", format: "mc" },
    });
    const { retryMathAttempt } = await import("./problemlog-actions");

    const result = await retryMathAttempt("mc-problem-1", "data:image/png;base64,xxx");

    expect(result.explanation).toBeNull();
  });

  it("문제의 실제 format이 math면 해설을 정상 반환한다", async () => {
    problemSingleMock.mockResolvedValue({
      data: { explanation: "풀이형 문제의 정답 해설", format: "math" },
    });
    const { retryMathAttempt } = await import("./problemlog-actions");

    const result = await retryMathAttempt("math-problem-1", "data:image/png;base64,xxx");

    expect(result.explanation).toBe("풀이형 문제의 정답 해설");
  });
});
