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
const adminRpcMock = vi.fn();
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
});

describe("assignTeacherToSubjectEnrollment — 배정 후 학생 상태 자동 활성화", () => {
  it("학생이 매칭 대기(pending)면 배정 성공 후 관리자 세션으로 active 전환을 호출한다", async () => {
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-1" } });
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
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-2" } });
    studentSingleMock.mockResolvedValue({ data: { status: "active" } });

    await assignTeacherToSubjectEnrollment({
      subjectEnrollmentId: "se-2",
      teacherId: "teacher-1",
      effectiveFrom: "2026-09-05",
    });

    expect(sessionRpcMock).not.toHaveBeenCalled();
  });

  it("상태 전환 RPC가 실패해도 배정 자체는 성공으로 반환한다(로그만 남김)", async () => {
    subjectEnrollmentSingleMock.mockResolvedValue({ data: { child_id: "child-3" } });
    studentSingleMock.mockResolvedValue({ data: { status: "pending" } });
    sessionRpcMock.mockResolvedValue({ error: { message: "boom" } });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await assignTeacherToSubjectEnrollment({
      subjectEnrollmentId: "se-3",
      teacherId: "teacher-1",
      effectiveFrom: "2026-09-05",
    });

    expect(result).toEqual({ id: "assignment-1" });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
