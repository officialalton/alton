import { describe, expect, it, vi } from "vitest";

// R9 corrective(20261250000000) — composeHomeworkFromSession()의 후보 풀
// 계산/토글 필터링/이미-발급-제외/원자성은 이제 DB 함수
// compose_homework_from_session() 안에서 전부 이뤄진다(app/teacher/
// homework-composition.integration.test.ts가 실제 DB로 그 로직 자체를
// 검증한다). 이 파일은 오직 "서버 액션이 그 RPC를 올바른 인자로 부르고,
// 반환된 issued_problem_ids/requested_count/issued_count를 그대로 정직하게
// 앱 형태로 매핑하는가"만 가짜 supabase 클라이언트로 확인한다.

const { mockSupabase, state } = vi.hoisted(() => {
  const state: {
    rpcArgs: Record<string, unknown> | null;
    rpcResult: { issued_problem_ids: string[] | null; requested_count: number; issued_count: number };
  } = {
    rpcArgs: null,
    rpcResult: { issued_problem_ids: [], requested_count: 0, issued_count: 0 },
  };

  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "teacher1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "sessions") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { id: "sess1", subject_enrollment_id: "enr1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "subject_enrollments") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "enr1", child_id: "student1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: "teacher" } }) }) }),
        };
      }
      if (table === "teacher_assignments") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ in: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "assign1" } }) }) }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
    rpc: vi.fn((_name: string, args: Record<string, unknown>) => {
      state.rpcArgs = args;
      return { single: () => Promise.resolve({ data: state.rpcResult, error: null }) };
    }),
  };
  return { mockSupabase, state };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { composeHomeworkFromSession } from "./homework-composition-actions";

describe("composeHomeworkFromSession — RPC 위임", () => {
  it("compose_homework_from_session RPC를 올바른 인자로 호출한다", async () => {
    state.rpcResult = { issued_problem_ids: ["p1", "p2"], requested_count: 5, issued_count: 2 };

    const result = await composeHomeworkFromSession("sess1", ["kw1", "kw2"], 5, {
      includeUsedInLesson: true,
      includeAlreadyAttempted: false,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("compose_homework_from_session", {
      p_session_id: "sess1",
      p_keyword_ids: ["kw1", "kw2"],
      p_count: 5,
      p_include_used_in_lesson: true,
      p_include_already_attempted: false,
    });
    expect(result).toEqual({ issuedProblemIds: ["p1", "p2"], requestedCount: 5, issuedCount: 2 });
  });

  it("issued_problem_ids가 null이면 빈 배열로 매핑한다(후보가 아예 없던 경우)", async () => {
    state.rpcResult = { issued_problem_ids: null, requested_count: 3, issued_count: 0 };

    const result = await composeHomeworkFromSession("sess1", ["kw1"], 3, {
      includeUsedInLesson: false,
      includeAlreadyAttempted: false,
    });

    expect(result).toEqual({ issuedProblemIds: [], requestedCount: 3, issuedCount: 0 });
  });

  it("issued_count < requested_count를 그대로 정직하게 전달한다(부족을 숨기지 않음)", async () => {
    state.rpcResult = { issued_problem_ids: ["p1"], requested_count: 10, issued_count: 1 };

    const result = await composeHomeworkFromSession("sess1", ["kw1"], 10, {
      includeUsedInLesson: false,
      includeAlreadyAttempted: false,
    });

    expect(result.issuedCount).toBe(1);
    expect(result.requestedCount).toBe(10);
    expect(result.issuedCount).toBeLessThan(result.requestedCount);
  });

  it("RPC가 에러를 반환하면 그대로 던진다", async () => {
    mockSupabase.rpc = vi.fn(() => ({
      single: () => Promise.resolve({ data: null, error: { message: "boom" } }),
    })) as unknown as typeof mockSupabase.rpc;

    await expect(
      composeHomeworkFromSession("sess1", ["kw1"], 5, {
        includeUsedInLesson: false,
        includeAlreadyAttempted: false,
      })
    ).rejects.toThrow("boom");
  });
});
