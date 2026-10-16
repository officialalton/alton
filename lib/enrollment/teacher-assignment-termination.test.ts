import { beforeEach, describe, expect, it, vi } from "vitest";

// 체이닝 가능한 최소 쿼리 빌더 목 — 테스트별로 table/동작에 따라 응답을 미리 큐잉한다.
function chain(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const self = () => obj;
  obj.select = self;
  obj.eq = self;
  obj.in = self;
  obj.order = () => Promise.resolve(result);
  obj.update = self;
  obj.insert = self;
  obj.single = () => Promise.resolve(result);
  obj.maybeSingle = () => Promise.resolve(result);
  // insert/update 체인 끝에 select().single()이 안 붙는 단순 insert도 있으므로 thenable 처리.
  obj.then = (resolve: (v: unknown) => void) => resolve(result);
  return obj;
}

const rpcMock = vi.fn();
const fromResponses: Record<string, Array<{ data: unknown; error: unknown }>> = {};
function queueFrom(table: string, result: { data: unknown; error: unknown }) {
  fromResponses[table] = fromResponses[table] ?? [];
  fromResponses[table].push(result);
}
const fromMock = vi.fn((table: string) => {
  const queue = fromResponses[table];
  const result = queue && queue.length > 0 ? queue.shift()! : { data: null, error: null };
  return chain(result);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock, from: fromMock }),
}));

const cancelLessonBookingMock = vi.fn();
vi.mock("@/lib/booking/create-booking", () => ({
  cancelLessonBooking: (...args: unknown[]) => cancelLessonBookingMock(...args),
}));

import {
  createTerminationRequest,
  previewTerminationImpact,
  processTeacherAssignmentTermination,
} from "./teacher-assignment-termination";

beforeEach(() => {
  vi.clearAllMocks();
  for (const k of Object.keys(fromResponses)) delete fromResponses[k];
});

describe("previewTerminationImpact", () => {
  it("RPC 결과를 camelCase로 매핑한다", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ reservation_id: "r1", starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-01T01:00:00Z", has_active_hold: true, session_final_status: "scheduled" }],
      error: null,
    });
    const result = await previewTerminationImpact("ta1");
    expect(result).toEqual([{ reservationId: "r1", startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-01T01:00:00Z", hasActiveHold: true, sessionFinalStatus: "scheduled" }]);
    expect(rpcMock).toHaveBeenCalledWith("preview_teacher_assignment_termination_impact", { p_teacher_assignment_id: "ta1" });
  });
});

describe("createTerminationRequest", () => {
  it("insert 후 requestId를 반환한다", async () => {
    queueFrom("teacher_assignment_termination_requests", { data: { id: "req1" }, error: null });
    const result = await createTerminationRequest({
      subjectEnrollmentId: "se1",
      teacherAssignmentId: "ta1",
      requestedByRole: "admin",
      requestedBy: "admin1",
      reason: "테스트",
    });
    expect(result).toEqual({ requestId: "req1" });
  });
});

describe("processTeacherAssignmentTermination", () => {
  it("이미 completed인 요청은 재처리 없이 바로 반환한다 (멱등성)", async () => {
    queueFrom("teacher_assignment_termination_requests", {
      data: { id: "req1", status: "completed", new_teacher_id: "t2" },
      error: null,
    });
    const result = await processTeacherAssignmentTermination({
      requestId: "req1",
      resolution: "reassign",
      processedBy: "admin1",
    });
    expect(result).toEqual({ status: "completed", newAssignmentId: "t2" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("end_enrollment: 미래 예약을 모두 취소하고 배정·수강을 종료한다", async () => {
    queueFrom("teacher_assignment_termination_requests", {
      data: { id: "req1", status: "requested", teacher_assignment_id: "ta1", subject_enrollment_id: "se1", reason: "사유", new_teacher_id: null },
      error: null,
    });
    queueFrom("teacher_assignment_termination_requests", { data: { id: "req1" }, error: null }); // claim update
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "preview_teacher_assignment_termination_impact") {
        return Promise.resolve({ data: [{ reservation_id: "r1", starts_at: "x", ends_at: "y", has_active_hold: true, session_final_status: "scheduled" }], error: null });
      }
      if (fn === "assert_teacher_assignment_ready_for_closure") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    queueFrom("teacher_assignment_termination_reservation_actions", { data: null, error: null }); // already? check -> none found
    queueFrom("teacher_assignment_termination_reservation_actions", { data: null, error: null }); // insert action row
    queueFrom("teacher_assignments", { data: null, error: null }); // end assignment
    queueFrom("subject_enrollments", { data: null, error: null }); // end enrollment
    queueFrom("teacher_assignment_termination_requests", { data: null, error: null }); // final completed update

    const result = await processTeacherAssignmentTermination({
      requestId: "req1",
      resolution: "end_enrollment",
      processedBy: "admin1",
    });

    expect(result.status).toBe("completed");
    expect(cancelLessonBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: "r1", cancelledByRole: "company" })
    );
  });

  // C-2(2026-09-11, Preview UAT 결함 수정) — "이미 consume된 예약은 release할
  // 수 없습니다" 실패의 원인 수정: 연결 세션이 이미 최종 판정(completed 등)된
  // 예약은 완료된 수업·수업권을 보존하기 위해 취소를 시도하지 않고 건너뛴다.
  it("end_enrollment: 이미 최종 판정된(완료) 세션의 예약은 취소를 시도하지 않고 건너뛴 사실만 감사 이력에 남긴다", async () => {
    queueFrom("teacher_assignment_termination_requests", {
      data: { id: "req1", status: "requested", teacher_assignment_id: "ta1", subject_enrollment_id: "se1", reason: "사유", new_teacher_id: null },
      error: null,
    });
    queueFrom("teacher_assignment_termination_requests", { data: { id: "req1" }, error: null }); // claim update
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "preview_teacher_assignment_termination_impact") {
        return Promise.resolve({
          data: [{ reservation_id: "r1", starts_at: "x", ends_at: "y", has_active_hold: false, session_final_status: "completed" }],
          error: null,
        });
      }
      if (fn === "assert_teacher_assignment_ready_for_closure") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    queueFrom("teacher_assignment_termination_reservation_actions", { data: null, error: null }); // already? -> none found
    queueFrom("teacher_assignment_termination_reservation_actions", { data: null, error: null }); // insert action row (skip audit)
    queueFrom("teacher_assignments", { data: null, error: null });
    queueFrom("subject_enrollments", { data: null, error: null });
    queueFrom("teacher_assignment_termination_requests", { data: null, error: null });

    const result = await processTeacherAssignmentTermination({
      requestId: "req1",
      resolution: "end_enrollment",
      processedBy: "admin1",
    });

    expect(result.status).toBe("completed");
    expect(cancelLessonBookingMock).not.toHaveBeenCalled();
  });

  // "진행 중 수업 때문에 종료를 보류해야 한다면 대상 수업과 다음 행동을
  // 안내"(제품 오너 지시) — live 수업이 있으면 어떤 예약도 건드리지 않고
  // 실패로 남겨 안전하게 재시도할 수 있게 한다.
  it("live인 세션이 하나라도 있으면 아무 예약도 건드리지 않고 실패로 남긴다", async () => {
    queueFrom("teacher_assignment_termination_requests", {
      data: { id: "req1", status: "requested", teacher_assignment_id: "ta1", subject_enrollment_id: "se1", reason: "사유", new_teacher_id: null },
      error: null,
    });
    queueFrom("teacher_assignment_termination_requests", { data: { id: "req1" }, error: null }); // claim update
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "preview_teacher_assignment_termination_impact") {
        return Promise.resolve({
          data: [{ reservation_id: "r-live", starts_at: "x", ends_at: "y", has_active_hold: false, session_final_status: "live" }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    queueFrom("teacher_assignment_termination_requests", { data: null, error: null }); // failed status update

    const result = await processTeacherAssignmentTermination({
      requestId: "req1",
      resolution: "end_enrollment",
      processedBy: "admin1",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/진행 중인 수업이 있어/);
    expect(cancelLessonBookingMock).not.toHaveBeenCalled();
  });

  it("이미 다른 흐름이 선점 중이면(claim 실패) 예외를 던진다", async () => {
    queueFrom("teacher_assignment_termination_requests", {
      data: { id: "req1", status: "requested", teacher_assignment_id: "ta1", subject_enrollment_id: "se1", reason: "사유", new_teacher_id: null },
      error: null,
    });
    queueFrom("teacher_assignment_termination_requests", { data: null, error: null }); // claim fails (maybeSingle -> null)
    queueFrom("teacher_assignment_termination_requests", { data: { status: "processing", new_teacher_id: null }, error: null }); // re-fetch latest

    await expect(
      processTeacherAssignmentTermination({ requestId: "req1", resolution: "end_enrollment", processedBy: "admin1" })
    ).rejects.toThrow("이미 처리 중인 종료 요청입니다");
  });
});
