import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdminOrCapability: vi.fn(),
}));
vi.mock("@/lib/enrollment/teacher-rate-check", () => ({
  assertTeacherHasValidRate: vi.fn().mockResolvedValue(undefined),
}));

const insertSingleMock = vi.fn();
const subjectEnrollmentSingleMock = vi.fn();
const studentSingleMock = vi.fn();
const fromMock = vi.fn((table: string) => {
  if (table === "teacher_assignments") {
    return {
      insert: () => ({
        select: () => ({ single: insertSingleMock }),
      }),
    };
  }
  if (table === "subject_enrollments") {
    return {
      select: () => ({ eq: () => ({ single: subjectEnrollmentSingleMock }) }),
    };
  }
  if (table === "students") {
    return {
      select: () => ({ eq: () => ({ single: studentSingleMock }) }),
    };
  }
  throw new Error(`unexpected table ${table}`);
});
// C-2(2026-09-11): assignTeacherToSubjectEnrollment()가 insert 전에
// trial_teacher_succession_eligibility RPC(has_curriculum)로 운영 커리큘럼
// 보유를 확인한다 — 기본값은 "보유함"으로 둬서 이 describe 블록의 원래 관심사
// (배정 후 학생 상태 자동 활성화)를 그대로 검증할 수 있게 하고, 가드 자체는
// 아래 별도 describe에서 검증한다.
const eligibilitySingleMock = vi.fn();
const adminRpcMock = vi.fn((_name: string, _params: unknown) => ({ single: eligibilitySingleMock }));
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock, rpc: adminRpcMock }),
}));

const sessionRpcMock = vi.fn();

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { assignTeacherToSubjectEnrollment } from "./subject-enrollment-actions";

beforeEach(() => {
  vi.clearAllMocks();
  (requireAdminOrCapability as ReturnType<typeof vi.fn>).mockResolvedValue({
    supabase: { rpc: sessionRpcMock },
    actorUserId: "admin-1",
  });
  insertSingleMock.mockResolvedValue({ data: { id: "assignment-1" }, error: null });
  sessionRpcMock.mockResolvedValue({ error: null });
  eligibilitySingleMock.mockResolvedValue({ data: { has_curriculum: true }, error: null });
});

describe("assignTeacherToSubjectEnrollment — 배정 후 학생 상태 자동 활성화", () => {
  it("학생이 매칭 대기(pending)면 배정 성공 후 관리자 세션으로 active 전환을 호출한다", async () => {
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-1", subject_id: "subject-1" } });
    studentSingleMock.mockResolvedValue({ data: { status: "pending" } });

    await assignTeacherToSubjectEnrollment({
      subjectEnrollmentId: "se-1",
      teacherId: "teacher-1",
      effectiveFrom: "2026-09-05",
    });

    expect(sessionRpcMock).toHaveBeenCalledWith("transition_account_status", {
      p_profile_id: "child-1",
      p_new_status: "active",
      p_reason: "과목·선생님 배정 완료(자동 전환)",
    });
    expect(adminRpcMock).not.toHaveBeenCalledWith("transition_account_status", expect.anything());
  });

  it("학생이 이미 active면 상태 전환을 호출하지 않는다", async () => {
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-2", subject_id: "subject-1" } });
    studentSingleMock.mockResolvedValue({ data: { status: "active" } });

    await assignTeacherToSubjectEnrollment({
      subjectEnrollmentId: "se-2",
      teacherId: "teacher-1",
      effectiveFrom: "2026-09-05",
    });

    expect(sessionRpcMock).not.toHaveBeenCalled();
  });

  it("상태 전환 RPC가 실패하면 배정 자체는 성공하되, 관리자 조치가 필요하다는 경고를 반환한다(로그만 남기고 조용히 성공 처리하던 버그 수정, 2026-09-05)", async () => {
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-3", subject_id: "subject-1" } });
    studentSingleMock.mockResolvedValue({ data: { status: "pending" } });
    sessionRpcMock.mockResolvedValue({ error: { message: "boom" } });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await assignTeacherToSubjectEnrollment({
      subjectEnrollmentId: "se-3",
      teacherId: "teacher-1",
      effectiveFrom: "2026-09-05",
    });

    expect(result.id).toBe("assignment-1");
    expect(result.activationWarning).toMatch(/학생 계정을 활성 상태로 전환하지 못했습니다/);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("상태 전환이 성공하면 activationWarning은 null이다", async () => {
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-4", subject_id: "subject-1" } });
    studentSingleMock.mockResolvedValue({ data: { status: "pending" } });
    sessionRpcMock.mockResolvedValue({ error: null });

    const result = await assignTeacherToSubjectEnrollment({
      subjectEnrollmentId: "se-4",
      teacherId: "teacher-1",
      effectiveFrom: "2026-09-05",
    });

    expect(result).toEqual({ id: "assignment-1", activationWarning: null });
  });
});

// C-2(2026-09-11) — 조사 중 발견: 이 경로(재등록 후 최초 배정에도 쓰임)는
// confirm_student_teacher_subject_match()/change_teacher_assignment()의 서버
// 가드를 거치지 않고 teacher_assignments에 직접 INSERT하므로, UI 후보 목록만
// 걸러져 있었을 뿐 서버 가드가 없었다. 여기서도 동일 기준을 강제한다.
describe("assignTeacherToSubjectEnrollment — 운영 커리큘럼 보유 서버 가드(C-2)", () => {
  it("선택한 선생님이 이 과목 운영 커리큘럼이 없으면 배정을 거부하고, INSERT를 시도하지 않는다", async () => {
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-5", subject_id: "subject-1" } });
    eligibilitySingleMock.mockResolvedValue({ data: { has_curriculum: false }, error: null });

    await expect(
      assignTeacherToSubjectEnrollment({
        subjectEnrollmentId: "se-5",
        teacherId: "teacher-no-curriculum",
        effectiveFrom: "2026-09-11",
      })
    ).rejects.toThrow("선택한 선생님은 이 과목의 운영 커리큘럼이 없어 배정할 수 없습니다.");

    expect(insertSingleMock).not.toHaveBeenCalled();
    expect(adminRpcMock).toHaveBeenCalledWith("trial_teacher_succession_eligibility", {
      p_teacher_id: "teacher-no-curriculum",
      p_subject_id: "subject-1",
    });
  });

  // 제품 오너 지시(2026-09-11): "수강 종료까지 처리된 경우 현재 재등록 경로로
  // 같은 교사에게 다시 배정할 수 있는지" 확인 — decideReturningSubjectEnrollment
  // (lib/enrollment/subject-enrollment-decision.test.ts, 기존 테스트로 이미 검증됨)가
  // 종료된 수강에 대해 항상 새 subject_enrollments 행을 만들고, 그 새 행에는
  // 활성 배정이 없으므로 이 함수(최초 배정 경로)가 그대로 쓰인다. 이 함수 자체는
  // "같은 교사인지"를 전혀 구분하지 않는다 — 유일한 조건은 운영 커리큘럼
  // 보유뿐이며, 종료됐던 교사라는 이유로 막지 않는다.
  it("같은 교사(과거에 이 학생의 배정을 종료했던 교사 포함)라는 이유로 재배정이 막히지 않는다 — 운영 커리큘럼 보유만 확인한다", async () => {
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-6", subject_id: "subject-1" } });
    studentSingleMock.mockResolvedValue({ data: { status: "active" } });
    eligibilitySingleMock.mockResolvedValue({ data: { has_curriculum: true }, error: null });

    const result = await assignTeacherToSubjectEnrollment({
      subjectEnrollmentId: "se-6-new-enrollment-after-termination",
      teacherId: "teacher-previously-terminated",
      effectiveFrom: "2026-09-11",
    });

    expect(result.id).toBe("assignment-1");
    expect(adminRpcMock).toHaveBeenCalledWith("trial_teacher_succession_eligibility", {
      p_teacher_id: "teacher-previously-terminated",
      p_subject_id: "subject-1",
    });
  });
});
