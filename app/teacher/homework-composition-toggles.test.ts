import { describe, expect, it, vi } from "vitest";

// R9(레슨 준비 Task 4) — composeHomeworkFromSession()의 후보 풀 계산 로직
// (issue-time 재검증 + 두 토글의 독립 적용)을 가짜 supabase 클라이언트로
// 검증한다. 인가/에러 케이스는 homework-composition-actions.test.ts가 이미
// 다룬다 — 이 파일은 오직 "어떤 문제가 최종 후보 풀/발급 목록에 남는가"에
// 집중한다.

const { mockSupabase, state } = vi.hoisted(() => {
  const state: {
    selectableProblemIds: string[]; // problem_keywords_selectable을 통과하는 문제(=confirmed 재검증 결과)
    usedProblemIds: string[]; // session_content_use_events에 있는 문제
    attemptedProblemIds: string[]; // session_problem_attempts에 있는 문제
    inserted: Array<Record<string, unknown>>;
  } = { selectableProblemIds: [], usedProblemIds: [], attemptedProblemIds: [], inserted: [] };

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
      if (table === "problem_keywords_selectable") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: state.selectableProblemIds.map((problem_id) => ({ problem_id })),
                error: null,
              }),
          }),
        };
      }
      if (table === "session_content_use_events") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () =>
                  Promise.resolve({
                    data: state.usedProblemIds.map((content_id) => ({ content_id })),
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "session_problem_attempts") {
        return {
          select: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({
                  data: state.attemptedProblemIds.map((problem_id) => ({ problem_id })),
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "session_homework_items") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          insert: (rows: Array<Record<string, unknown>>) => {
            state.inserted = rows;
            return {
              select: () =>
                Promise.resolve({ data: rows.map((r) => ({ problem_id: r.problem_id })), error: null }),
            };
          },
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

describe("composeHomeworkFromSession — 발급 시점 재검증", () => {
  it("problem_keywords 관계는 있어도 지금 unconfirmed면(=problem_keywords_selectable 밖) 후보에서 빠진다", async () => {
    // problem_keywords_selectable을 통과하는 것은 confirmed-p뿐 — unconfirmed-p는
    // 태깅 시점엔 존재했더라도 이 뷰가 이미 걸러낸 상태로 이 함수에 도달한다.
    state.selectableProblemIds = ["confirmed-p"];
    state.usedProblemIds = [];
    state.attemptedProblemIds = [];

    const result = await composeHomeworkFromSession("sess1", ["kw1"], 10, {
      includeUsedInLesson: true,
      includeAlreadyAttempted: true,
    });

    expect(result).toEqual(["confirmed-p"]);
    expect(result).not.toContain("unconfirmed-p");
  });
});

describe("composeHomeworkFromSession — 두 토글의 독립 적용(4가지 조합)", () => {
  // 고정 픽스처: neither(둘 다 아님), used(사용됨만), attempted(풀어봄만), both(둘 다).
  function setFixture() {
    state.selectableProblemIds = ["neither", "used", "attempted", "both"];
    state.usedProblemIds = ["used", "both"];
    state.attemptedProblemIds = ["attempted", "both"];
  }

  it("둘 다 끔 — neither만 포함", async () => {
    setFixture();
    const result = await composeHomeworkFromSession("sess1", ["kw1"], 10, {
      includeUsedInLesson: false,
      includeAlreadyAttempted: false,
    });
    expect(result.sort()).toEqual(["neither"]);
  });

  it("사용된 문제만 포함(includeUsedInLesson=true, includeAlreadyAttempted=false) — neither+used, attempted/both 제외", async () => {
    setFixture();
    const result = await composeHomeworkFromSession("sess1", ["kw1"], 10, {
      includeUsedInLesson: true,
      includeAlreadyAttempted: false,
    });
    expect(result.sort()).toEqual(["neither", "used"]);
  });

  it("이미 풀어본 문제만 포함(includeUsedInLesson=false, includeAlreadyAttempted=true) — neither+attempted, used/both 제외", async () => {
    setFixture();
    const result = await composeHomeworkFromSession("sess1", ["kw1"], 10, {
      includeUsedInLesson: false,
      includeAlreadyAttempted: true,
    });
    expect(result.sort()).toEqual(["attempted", "neither"]);
  });

  it("둘 다 켬 — 네 개 전부 포함", async () => {
    setFixture();
    const result = await composeHomeworkFromSession("sess1", ["kw1"], 10, {
      includeUsedInLesson: true,
      includeAlreadyAttempted: true,
    });
    expect(result.sort()).toEqual(["attempted", "both", "neither", "used"]);
  });

  it("count로 발급 개수를 제한한다", async () => {
    setFixture();
    const result = await composeHomeworkFromSession("sess1", ["kw1"], 2, {
      includeUsedInLesson: true,
      includeAlreadyAttempted: true,
    });
    expect(result.length).toBe(2);
  });
});
