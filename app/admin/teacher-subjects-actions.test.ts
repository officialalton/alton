import { describe, expect, it, vi } from "vitest";

const {
  insertMock,
  selectUnitsMock,
  insertUnitsMock,
  deleteEqMocks,
  enrollmentsSelectMock,
  assignmentsSelectMock,
  subjectSelectMock,
  mockSupabase,
} = vi.hoisted(() => {
  const insertMock = vi.fn();
  const selectUnitsMock = vi.fn();
  const insertUnitsMock = vi.fn();
  const deleteEqMocks: Record<string, () => Promise<{ error: null }>> = {};
  const enrollmentsSelectMock = vi.fn();
  const assignmentsSelectMock = vi.fn();
  const subjectSelectMock = vi.fn();

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
      if (table === "subjects") {
        return { select: () => ({ eq: () => ({ maybeSingle: subjectSelectMock }) }) };
      }
      if (table === "teacher_assignments") {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: assignmentsSelectMock }) }) }),
        };
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
    assignmentsSelectMock,
    subjectSelectMock,
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
    subjectSelectMock.mockResolvedValue({ data: { archived_at: null } });

    expect(await assignTeacherSubject("t1", "sub1")).toEqual({ ok: true });

    expect(insertMock).toHaveBeenCalledWith({ teacher_id: "t1", subject_id: "sub1" });
    expect(insertUnitsMock).toHaveBeenCalledWith([
      { template_id: "tmpl1", position: 1, unit_title: "함수의 기초", note: null },
    ]);
  });
});

describe("unassignTeacherSubject", () => {
  // 2026-09-12(UAT): 던지지 않고 { ok, error }로 돌려준다. 던진 예외는
  // Production 빌드에서 Minified React error #441로 마스킹돼 사유가 사라진다.
  it("레거시 매칭이 있으면 막고, 종료 경로를 안내한다", async () => {
    enrollmentsSelectMock.mockResolvedValue({ data: [{ id: "e1" }] });
    assignmentsSelectMock.mockResolvedValue({ data: [] });
    const result = await unassignTeacherSubject("t1", "sub1");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("매칭 탭에서 담당을 먼저 종료해주세요");
  });

  it("v3 매칭(teacher_assignments)만 있어도 막는다", async () => {
    enrollmentsSelectMock.mockResolvedValue({ data: [] });
    assignmentsSelectMock.mockResolvedValue({ data: [{ id: "ta1" }] });
    const result = await unassignTeacherSubject("t1", "sub1");
    expect(result.ok).toBe(false);
  });

  it("매칭이 없으면 템플릿을 삭제한다", async () => {
    enrollmentsSelectMock.mockResolvedValue({ data: [] });
    assignmentsSelectMock.mockResolvedValue({ data: [] });
    expect(await unassignTeacherSubject("t1", "sub1")).toEqual({ ok: true });
    expect(deleteEqMocks["teacher_id:t1|subject_id:sub1"]).toHaveBeenCalled();
  });

  it("과목 해제는 매칭·예약을 건드리지 않는다", async () => {
    enrollmentsSelectMock.mockResolvedValue({ data: [] });
    assignmentsSelectMock.mockResolvedValue({ data: [] });
    await unassignTeacherSubject("t1", "sub1");
    // 담당 가능 과목에서 빼는 것과 학생 매칭 종료는 다른 일이다.
    const touched = mockSupabase.from.mock.calls.map((c) => c[0]);
    expect(touched).not.toContain("reservations");
    expect(touched).not.toContain("sessions");
  });
});

describe("assignTeacherSubject — 보관 과목", () => {
  it("보관된 과목은 새로 배정하지 않는다", async () => {
    subjectSelectMock.mockResolvedValue({ data: { archived_at: "2026-09-11T00:00:00Z" } });
    insertMock.mockClear();
    const result = await assignTeacherSubject("t1", "sub9");
    expect(result).toEqual({ ok: false, error: "보관된 과목은 새로 배정할 수 없습니다." });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
