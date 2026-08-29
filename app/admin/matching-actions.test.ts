import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertMock, updateEqMock, mockSupabase } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const updateEqMock = vi.fn();
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
      if (table === "enrollments") {
        return { insert: insertMock };
      }
      if (table === "students") {
        return { update: () => ({ eq: updateEqMock }) };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };
  return { insertMock, updateEqMock, mockSupabase };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { confirmMatch } from "./matching-actions";

describe("confirmMatch", () => {
  beforeEach(() => {
    insertMock.mockReset();
    updateEqMock.mockReset();
  });

  it("총 회차 수가 1 미만이면 서버 호출 없이 에러를 던진다", async () => {
    await expect(confirmMatch("s1", "t1", "sub1", 0)).rejects.toThrow(
      "총 회차 수는 1 이상이어야 합니다."
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("정상 매칭 시 enrollments를 만들고 학생 상태를 active로 바꾼다", async () => {
    insertMock.mockResolvedValue({ error: null });
    updateEqMock.mockResolvedValue({ error: null });
    await confirmMatch("s1", "t1", "sub1", 20);
    expect(insertMock).toHaveBeenCalledWith({
      student_id: "s1",
      teacher_id: "t1",
      subject_id: "sub1",
      status: "active",
      total_sessions: 20,
      current_session: 1,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "s1");
  });

  it("중복 매칭(unique 제약 위반)이면 친화적 에러로 변환한다", async () => {
    insertMock.mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    await expect(confirmMatch("s1", "t1", "sub1", 20)).rejects.toThrow(
      "이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다."
    );
    expect(updateEqMock).not.toHaveBeenCalled();
  });
});
