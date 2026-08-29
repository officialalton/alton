import { describe, expect, it, vi } from "vitest";

const {
  insertMock,
  selectUnitsMock,
  insertUnitsMock,
  deleteEqMocks,
  enrollmentsSelectMock,
  mockSupabase,
} = vi.hoisted(() => {
  const insertMock = vi.fn();
  const selectUnitsMock = vi.fn();
  const insertUnitsMock = vi.fn();
  const deleteEqMocks: Record<string, () => Promise<{ error: null }>> = {};
  const enrollmentsSelectMock = vi.fn();

  const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } }) },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ single: () => Promise.resolve({ data: { role: "admin" } }) }),
          }),
        };
      }
      if (table === "teacher_curriculum_templates") {
        return {
          insert: insertMock,
          delete: () => ({
            eq: (col: string, val: string) => {
              const chain = {
                eq: (col2: string, val2: string) => {
                  const key = `${col}:${val}|${col2}:${val2}`;
                  deleteEqMocks[key] =
                    deleteEqMocks[key] ?? vi.fn().mockResolvedValue({ error: null });
                  return deleteEqMocks[key]();
                },
              };
              return chain;
            },
          }),
        };
      }
      if (table === "subject_template_units") {
        return { select: () => ({ eq: () => ({ order: selectUnitsMock }) }) };
      }
      if (table === "teacher_curriculum_template_units") {
        return { insert: insertUnitsMock };
      }
      if (table === "enrollments") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ eq: enrollmentsSelectMock }) }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  };

  return {
    insertMock,
    selectUnitsMock,
    insertUnitsMock,
    deleteEqMocks,
    enrollmentsSelectMock,
    mockSupabase,
  };
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { assignTeacherSubject, unassignTeacherSubject } from "./teacher-subjects-actions";

describe("assignTeacherSubject", () => {
  it("과목 템플릿을 만들고 회차를 복사한다", async () => {
    insertMock.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "tmpl1" }, error: null }) }),
    });
    selectUnitsMock.mockResolvedValue({
      data: [{ position: 1, unit_title: "함수의 기초", note: null }],
    });
    insertUnitsMock.mockResolvedValue({ error: null });

    await assignTeacherSubject("t1", "sub1");

    expect(insertMock).toHaveBeenCalledWith({ teacher_id: "t1", subject_id: "sub1" });
    expect(insertUnitsMock).toHaveBeenCalledWith([
      { template_id: "tmpl1", position: 1, unit_title: "함수의 기초", note: null },
    ]);
  });
});

describe("unassignTeacherSubject", () => {
  it("매칭된 학생이 있으면 제거를 막는다", async () => {
    enrollmentsSelectMock.mockResolvedValue({ data: [{ id: "e1" }] });
    await expect(unassignTeacherSubject("t1", "sub1")).rejects.toThrow(
      "이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요."
    );
  });

  it("매칭된 학생이 없으면 템플릿을 삭제한다", async () => {
    enrollmentsSelectMock.mockResolvedValue({ data: [] });
    await unassignTeacherSubject("t1", "sub1");
    expect(deleteEqMocks["teacher_id:t1|subject_id:sub1"]).toHaveBeenCalled();
  });
});
