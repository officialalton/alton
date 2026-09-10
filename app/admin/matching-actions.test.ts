import { describe, expect, it, vi } from "vitest";

// 2026-09-10(매칭 공통화) — confirmMatch()는 이제 matching-common-actions.ts의
// confirmStudentTeacherSubjectMatch()에 그대로 위임하는 얇은 어댑터다(legacy
// enrollments 테이블을 더 이상 건드리지 않는다). 이 파일은 그 위임 자체만
// 검증한다 — 실제 배정 로직 검증은 matching-common-actions.test.ts에서 한다.

const confirmStudentTeacherSubjectMatchMock = vi.fn();
vi.mock("./matching-common-actions", () => ({
  confirmStudentTeacherSubjectMatch: (...args: unknown[]) => confirmStudentTeacherSubjectMatchMock(...args),
}));

import { confirmMatch } from "./matching-actions";

describe("confirmMatch (매칭 탭 어댑터)", () => {
  it("studentId/teacherId/subjectId를 childId로 매핑해 confirmStudentTeacherSubjectMatch에 위임한다", async () => {
    confirmStudentTeacherSubjectMatchMock.mockResolvedValue({
      ok: true,
      subjectEnrollmentId: "se1",
      teacherAssignmentId: "ta1",
      overlayId: "ov1",
      activationWarning: null,
      curriculumWarning: null,
    });

    const result = await confirmMatch("s1", "t1", "sub1");

    expect(confirmStudentTeacherSubjectMatchMock).toHaveBeenCalledWith({
      childId: "s1",
      teacherId: "t1",
      subjectId: "sub1",
    });
    expect(result).toEqual({
      ok: true,
      subjectEnrollmentId: "se1",
      teacherAssignmentId: "ta1",
      overlayId: "ov1",
      activationWarning: null,
      curriculumWarning: null,
    });
  });

  it("공통 경로가 {ok:false,error}를 반환하면 그대로 전달한다", async () => {
    confirmStudentTeacherSubjectMatchMock.mockResolvedValue({
      ok: false,
      error: "선생님(t1)에게 유효한 현재 시급 이력이 없어 배정할 수 없습니다.",
    });

    const result = await confirmMatch("s1", "t1", "sub1");
    expect(result).toEqual({
      ok: false,
      error: "선생님(t1)에게 유효한 현재 시급 이력이 없어 배정할 수 없습니다.",
    });
  });
});
