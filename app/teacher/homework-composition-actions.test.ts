import { describe, expect, it, vi } from "vitest";

const { mockSupabase, state } = vi.hoisted(() => {
  const state: {
    role: string;
    session: { id: string; subject_enrollment_id: string } | null;
    enrollment: { id: string; child_id: string } | null;
    assignment: { id: string } | null;
  } = {
    role: "teacher",
    session: { id: "sess1", subject_enrollment_id: "enr1" },
    enrollment: { id: "enr1", child_id: "student1" },
    assignment: { id: "assign1" },
  };

  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "teacher1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "sessions") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.session, error: null }) }) }),
        };
      }
      if (table === "subject_enrollments") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.enrollment, error: null }) }) }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: state.role } }) }) }),
        };
      }
      if (table === "teacher_assignments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ in: () => ({ maybeSingle: () => Promise.resolve({ data: state.assignment }) }) }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { mockSupabase, state };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { composeHomeworkFromSession } from "./homework-composition-actions";

describe("composeHomeworkFromSession — 인가", () => {
  it("담당이 아닌 선생님이 호출하면 거부한다", async () => {
    state.assignment = null;
    await expect(
      composeHomeworkFromSession("sess1", ["kw1"], 5, {
        includeUsedInLesson: false,
        includeAlreadyAttempted: false,
      })
    ).rejects.toThrow("담당 학생의 세션에만 과제를 구성할 수 있습니다.");
  });

  it("존재하지 않는 세션이면 거부한다", async () => {
    state.assignment = { id: "assign1" };
    state.session = null;
    await expect(
      composeHomeworkFromSession("sess-missing", ["kw1"], 5, {
        includeUsedInLesson: false,
        includeAlreadyAttempted: false,
      })
    ).rejects.toThrow("세션을 찾을 수 없습니다.");
    state.session = { id: "sess1", subject_enrollment_id: "enr1" };
  });

  it("키워드가 없거나 count가 0 이하이면 즉시 빈 결과를 반환하고 DB를 조회하지 않는다", async () => {
    await expect(
      composeHomeworkFromSession("sess1", [], 5, {
        includeUsedInLesson: false,
        includeAlreadyAttempted: false,
      })
    ).resolves.toEqual({ issuedProblemIds: [], requestedCount: 5, issuedCount: 0 });
    await expect(
      composeHomeworkFromSession("sess1", ["kw1"], 0, {
        includeUsedInLesson: false,
        includeAlreadyAttempted: false,
      })
    ).resolves.toEqual({ issuedProblemIds: [], requestedCount: 0, issuedCount: 0 });
  });
});
