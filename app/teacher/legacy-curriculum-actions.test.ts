import { describe, expect, it, vi, beforeEach } from "vitest";

// 2026-09-11(제품 오너 UAT — 첫 진입 지연 재지적) — "학생별" 커리큘럼 상세는
// 이제 그 enrollment 하나만 온디맨드 조회한다(담당 학생 전체를 미리 읽지
// 않음). 인가(담당 선생님만 조회 가능)는 그대로 유지되는지 확인한다.

const { getUserMock, fromMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}));

function tableMock(rows: Record<string, unknown>) {
  return (table: string) => {
    if (!(table in rows)) throw new Error(`unexpected table ${table}`);
    const data = rows[table];
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      single: () => Promise.resolve({ data }),
      maybeSingle: () => Promise.resolve({ data }),
      then: (resolve: (v: { data: unknown }) => unknown) => Promise.resolve({ data }).then(resolve),
    };
    return builder;
  };
}

describe("loadLegacyCurriculumDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("담당 선생님이 아니면 거부한다(담당 학생의 커리큘럼만 조회 가능)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "teacher-other" } } });
    fromMock.mockImplementation(
      tableMock({
        profiles: { role: "teacher" },
        enrollments: { id: "en1", student_id: "st1", teacher_id: "teacher-owner" },
      })
    );

    const { loadLegacyCurriculumDetail } = await import("./legacy-curriculum-actions");
    await expect(loadLegacyCurriculumDetail("en1")).rejects.toThrow(
      "담당 학생의 커리큘럼만 조회할 수 있습니다."
    );
  });

  it("로그인하지 않으면 거부한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    fromMock.mockImplementation(tableMock({}));

    const { loadLegacyCurriculumDetail } = await import("./legacy-curriculum-actions");
    await expect(loadLegacyCurriculumDetail("en1")).rejects.toThrow("로그인이 필요합니다.");
  });
});
