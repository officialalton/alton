import { describe, expect, it, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const getUserMock = vi.fn();
const insertMock = vi.fn();
const deleteEqMock = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    rpc: rpcMock,
    auth: { getUser: getUserMock },
    from: (table: string) => ({
      insert: (row: unknown) => insertMock(table, row),
      delete: () => ({ eq: (col: string, val: string) => deleteEqMock(table, col, val) }),
    }),
  }),
}));

import {
  submitCompleteProfile,
  addApCourse,
  removeApCourse,
  addExtracurricularActivity,
  removeExtracurricularActivity,
} from "./actions";

describe("submitCompleteProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ error: null });
  });

  it("complete_student_profile RPC를 정확한 파라미터로 호출한다", async () => {
    await submitCompleteProfile({
      dateOfBirth: "2010-05-01",
      schoolName: "OO국제학교",
      grade: "10학년",
      satScore: 1200,
      gpa: 3.8,
      gpaScale: "4.3",
      targetColleges: ["Stanford"],
      intendedMajors: ["CS"],
    });

    expect(rpcMock).toHaveBeenCalledWith("complete_student_profile", {
      p_date_of_birth: "2010-05-01",
      p_school_name: "OO국제학교",
      p_grade: "10학년",
      p_sat_score: 1200,
      p_gpa: 3.8,
      p_target_colleges: ["Stanford"],
      p_intended_majors: ["CS"],
      p_gpa_scale: "4.3",
    });
  });

  it("SAT 미입력은 null로 전달한다(0으로 강제 변환하지 않음)", async () => {
    await submitCompleteProfile({
      dateOfBirth: "2010-05-01",
      schoolName: "OO국제학교",
      grade: "10학년",
      satScore: null,
      gpa: null,
      gpaScale: null,
      targetColleges: [],
      intendedMajors: [],
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "complete_student_profile",
      expect.objectContaining({ p_sat_score: null })
    );
  });

  it("RPC 에러를 그대로 던진다(예: 학교명 누락)", async () => {
    rpcMock.mockResolvedValue({ error: { message: "학교명은 필수 항목입니다." } });
    await expect(
      submitCompleteProfile({
        dateOfBirth: "2010-05-01",
        schoolName: "",
        grade: "10학년",
        satScore: null,
        gpa: null,
        gpaScale: null,
        targetColleges: [],
        intendedMajors: [],
      })
    ).rejects.toThrow("학교명은 필수 항목입니다.");
  });

  it("SAT가 400~1600 범위를 벗어나면 RPC 호출 전에 거부한다", async () => {
    await expect(
      submitCompleteProfile({
        dateOfBirth: "2010-05-01",
        schoolName: "OO국제학교",
        grade: "10학년",
        satScore: 399,
        gpa: null,
        gpaScale: null,
        targetColleges: [],
        intendedMajors: [],
      })
    ).rejects.toThrow("SAT 점수는 400~1600 사이여야 합니다.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("2026-09-06: GPA가 음수이면 RPC 호출 전에 거부한다", async () => {
    await expect(
      submitCompleteProfile({
        dateOfBirth: "2010-05-01",
        schoolName: "OO국제학교",
        grade: "10학년",
        satScore: null,
        gpa: -0.1,
        gpaScale: "4.0",
        targetColleges: [],
        intendedMajors: [],
      })
    ).rejects.toThrow("GPA는 0 이상이어야 합니다.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("GPA만 있고 척도가 없으면 RPC 호출 전에 거부한다", async () => {
    await expect(
      submitCompleteProfile({
        dateOfBirth: "2010-05-01",
        schoolName: "OO국제학교",
        grade: "10학년",
        satScore: null,
        gpa: 3.5,
        gpaScale: null,
        targetColleges: [],
        intendedMajors: [],
      })
    ).rejects.toThrow("GPA를 입력하려면 GPA 척도를 함께 선택해야 합니다.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("척도만 있고 GPA가 없으면 RPC 호출 전에 거부한다", async () => {
    await expect(
      submitCompleteProfile({
        dateOfBirth: "2010-05-01",
        schoolName: "OO국제학교",
        grade: "10학년",
        satScore: null,
        gpa: null,
        gpaScale: "4.0",
        targetColleges: [],
        intendedMajors: [],
      })
    ).rejects.toThrow("GPA 척도만 선택하고 GPA 값이 없는 상태는 허용되지 않습니다.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["4.0", 4.3],
    ["4.3", 4.5],
    ["4.5", 5.0],
    ["5.0", 5.1],
  ])("GPA가 척도(%s)를 초과하면(%s) RPC 호출 전에 거부한다", async (scale, gpa) => {
    await expect(
      submitCompleteProfile({
        dateOfBirth: "2010-05-01",
        schoolName: "OO국제학교",
        grade: "10학년",
        satScore: null,
        gpa,
        gpaScale: scale,
        targetColleges: [],
        intendedMajors: [],
      })
    ).rejects.toThrow(/초과할 수 없습니다/);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("GPA·척도 둘 다 null이거나 둘 다 유효한 범위 내면 RPC를 호출한다", async () => {
    await submitCompleteProfile({
      dateOfBirth: "2010-05-01",
      schoolName: "OO국제학교",
      grade: "10학년",
      satScore: 1200,
      gpa: 4.0,
      gpaScale: "4.0",
      targetColleges: [],
      intendedMajors: [],
    });
    expect(rpcMock).toHaveBeenCalled();
  });
});

describe("addApCourse / removeApCourse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "student-1" } } });
    insertMock.mockResolvedValue({ error: null });
    deleteEqMock.mockResolvedValue({ error: null });
  });

  it("본인 student_id로 student_ap_courses에 추가한다", async () => {
    await addApCourse({
      courseName: "AP Calculus BC",
      status: "taking",
      examYear: 2027,
      score: null,
    });

    expect(insertMock).toHaveBeenCalledWith(
      "student_ap_courses",
      expect.objectContaining({
        student_id: "student-1",
        course_name: "AP Calculus BC",
        status: "taking",
        exam_year: 2027,
        score: null,
      })
    );
  });

  it("로그인하지 않았으면 에러를 던진다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(
      addApCourse({ courseName: "AP Bio", status: "planned", examYear: null, score: null })
    ).rejects.toThrow("로그인이 필요합니다.");
  });

  it("삭제는 id로 delete().eq()를 호출한다", async () => {
    await removeApCourse("course-1");
    expect(deleteEqMock).toHaveBeenCalledWith("student_ap_courses", "id", "course-1");
  });
});

describe("addExtracurricularActivity / removeExtracurricularActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "student-1" } } });
    insertMock.mockResolvedValue({ error: null });
    deleteEqMock.mockResolvedValue({ error: null });
  });

  it("본인 student_id로 student_extracurricular_activities에 추가한다", async () => {
    await addExtracurricularActivity({
      activityName: "교내 토론 동아리",
      description: "부회장",
      startDate: "2025-03-01",
      endDate: null,
      isOngoing: true,
    });

    expect(insertMock).toHaveBeenCalledWith(
      "student_extracurricular_activities",
      expect.objectContaining({
        student_id: "student-1",
        activity_name: "교내 토론 동아리",
        is_ongoing: true,
      })
    );
  });

  it("삭제는 id로 delete().eq()를 호출한다", async () => {
    await removeExtracurricularActivity("activity-1");
    expect(deleteEqMock).toHaveBeenCalledWith(
      "student_extracurricular_activities",
      "id",
      "activity-1"
    );
  });
});
