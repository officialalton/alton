import { beforeEach, describe, expect, it, vi } from "vitest";

const reviewUpsertSelectSingleMock = vi.fn();
const categoryUpsertMock = vi.fn().mockResolvedValue({ error: null });
const sessionMaybeSingleMock = vi.fn();
const studentProfileMaybeSingleMock = vi.fn();

const supabaseMock = {
  from: (table: string) => {
    if (table === "session_reviews") {
      return {
        upsert: () => ({ select: () => ({ single: reviewUpsertSelectSingleMock }) }),
      };
    }
    if (table === "session_review_categories") {
      return { upsert: categoryUpsertMock };
    }
    if (table === "sessions") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: sessionMaybeSingleMock }) }),
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({ eq: () => ({ maybeSingle: studentProfileMaybeSingleMock }) }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  },
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({
    user: { id: "teacher1" },
    profile: { role: "admin" },
    supabase: supabaseMock,
  }),
}));

const childMembershipMaybeSingleMock = vi.fn();
const guardianLinksThenMock = vi.fn();
const activeParentsNeqMock = vi.fn();
const getUserByIdMock = vi.fn();

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: getUserByIdMock } },
    from: (table: string) => {
      if (table === "household_members") {
        return {
          select: (cols: string) => ({
            eq: (col1: string) => ({
              eq: (col2: string, val2: unknown) => {
                if (col2 === "role" && val2 === "child") {
                  return { maybeSingle: childMembershipMaybeSingleMock };
                }
                // role === "guardian" 조회는 await 가능한 thenable로 반환
                return { then: guardianLinksThenMock };
              },
            }),
          }),
        };
      }
      if (table === "parents") {
        return {
          select: () => ({
            in: () => ({ neq: activeParentsNeqMock }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: vi.fn() };
  },
}));

describe("submitReview -> notifyGuardiansOfReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reviewUpsertSelectSingleMock.mockResolvedValue({ data: { id: "review1" }, error: null });
    categoryUpsertMock.mockResolvedValue({ error: null });
    sessionMaybeSingleMock.mockResolvedValue({
      data: {
        session_number: 3,
        enrollment: { student_id: "student1", subject: { name: "SAT Math" } },
      },
    });
    studentProfileMaybeSingleMock.mockResolvedValue({ data: { name: "지훈" } });
    childMembershipMaybeSingleMock.mockResolvedValue({ data: { household_id: "household1" } });
    getUserByIdMock.mockResolvedValue({ data: { user: { email: null } } });
  });

  function mockGuardians(guardianIds: string[]) {
    guardianLinksThenMock.mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: guardianIds.map((id) => ({ profile_id: id })) })
    );
  }

  it("같은 household의 유효한(closed가 아닌) 보호자 전체에게 중복 없이 1번씩 이메일을 보낸다", async () => {
    mockGuardians(["guardian1", "guardian2"]);
    activeParentsNeqMock.mockResolvedValue({ data: [{ id: "guardian1" }, { id: "guardian2" }] });
    getUserByIdMock.mockImplementation(async (id: string) => ({
      data: { user: { email: `${id}@example.com` } },
    }));

    const { submitReview } = await import("./review-actions");
    await submitReview("session1", {
      teacherSummary: "요약",
      strength: "강점",
      improve: "개선",
      nextPlan: "다음 계획",
      categories: {
        concept: { text: "", reviewed: true },
        problemsolving: { text: "", reviewed: true },
        participation: { text: "", reviewed: true },
        homework: { text: "", reviewed: true },
      },
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const sentTo = sendEmailMock.mock.calls.map((c) => c[0].to).sort();
    expect(sentTo).toEqual(["guardian1@example.com", "guardian2@example.com"]);
  });

  it("계정 상태가 closed인 보호자는 알림 대상에서 제외한다", async () => {
    mockGuardians(["guardian1", "guardian2"]);
    // parents 조회는 status != 'closed' 필터를 이미 걸었다고 가정 — guardian2가
    // closed라 이 목록에서 빠져있는 상황을 시뮬레이션.
    activeParentsNeqMock.mockResolvedValue({ data: [{ id: "guardian1" }] });
    getUserByIdMock.mockImplementation(async (id: string) => ({
      data: { user: { email: `${id}@example.com` } },
    }));

    const { submitReview } = await import("./review-actions");
    await submitReview("session1", {
      teacherSummary: "요약",
      strength: "강점",
      improve: "개선",
      nextPlan: "다음 계획",
      categories: {
        concept: { text: "", reviewed: true },
        problemsolving: { text: "", reviewed: true },
        participation: { text: "", reviewed: true },
        homework: { text: "", reviewed: true },
      },
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "guardian1@example.com" })
    );
  });

  it("household에 속하지 않은 학생이면(자녀 관계 없음) 알림을 보내지 않는다", async () => {
    childMembershipMaybeSingleMock.mockResolvedValue({ data: null });

    const { submitReview } = await import("./review-actions");
    await submitReview("session1", {
      teacherSummary: "요약",
      strength: "강점",
      improve: "개선",
      nextPlan: "다음 계획",
      categories: {
        concept: { text: "", reviewed: true },
        problemsolving: { text: "", reviewed: true },
        participation: { text: "", reviewed: true },
        homework: { text: "", reviewed: true },
      },
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
