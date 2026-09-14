import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-1(B) — 아카이브 오케스트레이션 단위 검증(외부 경로는 모킹).
// 확정 정책 검증: 진행 중 수업이 있으면 **아무 것도 바꾸기 전에** 차단 / 완료된
// 수업은 취소하지 않음 / 아카이브 플래그는 모든 처리가 끝난 뒤 마지막에 설정 /
// 이미 아카이브된 가구는 재실행해도 무변경(멱등) / 복귀는 플래그 해제만.

type QueryResult = { data: unknown; error: unknown };
type Call = { table: string; op: "update" | "insert"; payload: Record<string, unknown> };

const { adminRpcMock, adminFromMock, cancelLessonBookingMock, createTerminationRequestMock, processTerminationMock } =
  vi.hoisted(() => ({
    adminRpcMock: vi.fn(),
    adminFromMock: vi.fn(),
    cancelLessonBookingMock: vi.fn(),
    createTerminationRequestMock: vi.fn(),
    processTerminationMock: vi.fn(),
  }));

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: adminRpcMock, from: adminFromMock }),
}));
vi.mock("@/lib/booking/create-booking", () => ({ cancelLessonBooking: cancelLessonBookingMock }));
vi.mock("@/lib/enrollment/teacher-assignment-termination", () => ({
  createTerminationRequest: createTerminationRequestMock,
  processTeacherAssignmentTermination: processTerminationMock,
}));

import { archiveHousehold, restoreHousehold } from "./household-archive";

const queues = new Map<string, QueryResult[]>();
let calls: Call[] = [];

function setQueue(table: string, results: QueryResult[]) {
  queues.set(table, [...results]);
}
function nextResult(table: string): QueryResult {
  const queue = queues.get(table);
  if (!queue || queue.length === 0) return { data: null, error: null };
  return queue.length === 1 ? queue[0] : queue.shift()!;
}
function builder(table: string) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "not", "gt", "order", "limit"]) {
    chain[method] = () => chain;
  }
  chain.update = (payload: Record<string, unknown>) => {
    calls.push({ table, op: "update", payload });
    return chain;
  };
  chain.insert = (payload: Record<string, unknown>) => {
    calls.push({ table, op: "insert", payload });
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve(nextResult(table));
  chain.single = () => Promise.resolve(nextResult(table));
  chain.then = (onFulfilled: (v: QueryResult) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(nextResult(table)).then(onFulfilled, onRejected);
  return chain;
}

function impactRows(rows: { child: string; assignments?: number; cancellable?: number; live?: number }[]) {
  return rows.map((r) => ({
    child_id: r.child,
    active_assignment_count: r.assignments ?? 0,
    cancellable_reservation_count: r.cancellable ?? 0,
    live_reservation_count: r.live ?? 0,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  queues.clear();
  calls = [];
  adminFromMock.mockImplementation((table: string) => builder(table));
  cancelLessonBookingMock.mockResolvedValue(undefined);
  createTerminationRequestMock.mockResolvedValue({ requestId: "term1" });
  processTerminationMock.mockResolvedValue({ status: "completed" });
  // 활성 가구 1건 조회 → 아카이브 요청 신규 생성.
  setQueue("households", [{ data: { id: "h1", archived_at: null }, error: null }, { data: null, error: null }]);
  setQueue("household_archive_requests", [
    { data: null, error: null }, // 진행 중인 요청 없음
    { data: { id: "req1" }, error: null }, // insert ... select single
    { data: null, error: null }, // completed 갱신
  ]);
  adminRpcMock.mockResolvedValue({ data: impactRows([{ child: "c1" }]), error: null });
});

function updatesTo(table: string) {
  return calls.filter((c) => c.table === table && c.op === "update").map((c) => c.payload);
}

describe("archiveHousehold", () => {
  it("진행 중 수업이 있으면 어떤 예약·매칭·플래그도 건드리지 않고 차단한다", async () => {
    adminRpcMock.mockResolvedValue({ data: impactRows([{ child: "c1", live: 1, cancellable: 2 }]), error: null });

    const result = await archiveHousehold({ householdId: "h1", actorId: "admin1" });

    expect(result.status).toBe("blocked");
    expect(cancelLessonBookingMock).not.toHaveBeenCalled();
    expect(processTerminationMock).not.toHaveBeenCalled();
    expect(updatesTo("households")).toEqual([]); // archived_at 미설정
    expect(updatesTo("household_archive_requests").at(-1)).toMatchObject({ status: "failed" });
  });

  it("매칭 종료 → 남은 예약 취소 → 마지막에 아카이브 플래그 순서로 처리한다", async () => {
    setQueue("subject_enrollments", [{ data: [{ id: "se1" }], error: null }]);
    setQueue("teacher_assignments", [{ data: [{ id: "ta1", subject_enrollment_id: "se1" }], error: null }]);
    setQueue("teacher_assignment_termination_requests", [{ data: null, error: null }]);
    setQueue("reservations", [{ data: [{ id: "r1" }, { id: "r2" }], error: null }]);
    setQueue("sessions", [
      { data: [{ reservation_id: "r1", final_status: "scheduled" }, { reservation_id: "r2", final_status: "completed" }], error: null },
    ]);

    const result = await archiveHousehold({ householdId: "h1", actorId: "admin1" });

    expect(result).toMatchObject({ status: "completed", endedAssignments: 1, cancelledReservations: 1 });
    expect(processTerminationMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "term1", resolution: "end_enrollment" })
    );
    // 완료된 수업(r2)은 취소하지 않는다 — 완료 수업·사용 수업권 보존.
    expect(cancelLessonBookingMock).toHaveBeenCalledTimes(1);
    expect(cancelLessonBookingMock).toHaveBeenCalledWith(expect.objectContaining({ reservationId: "r1", cancelledByRole: "company" }));

    // 아카이브 플래그는 취소·종료가 전부 끝난 뒤에 설정된다.
    const archiveUpdateIndex = calls.findIndex((c) => c.table === "households" && c.op === "update");
    const eventInsertIndex = calls.findIndex((c) => c.table === "household_archive_events" && c.op === "insert");
    expect(archiveUpdateIndex).toBeGreaterThan(-1);
    expect(calls[archiveUpdateIndex].payload).toMatchObject({ archived_by: "admin1" });
    expect(eventInsertIndex).toBeGreaterThan(archiveUpdateIndex);
    expect(updatesTo("household_archive_requests").at(-1)).toMatchObject({ status: "completed" });
  });

  it("이미 아카이브된 가구는 재실행해도 아무 것도 바꾸지 않는다(멱등)", async () => {
    setQueue("households", [{ data: { id: "h1", archived_at: "2026-09-11T00:00:00Z" }, error: null }]);

    const result = await archiveHousehold({ householdId: "h1", actorId: "admin1" });

    expect(result).toMatchObject({ status: "completed", endedAssignments: 0, cancelledReservations: 0 });
    expect(calls).toEqual([]);
    expect(cancelLessonBookingMock).not.toHaveBeenCalled();
  });

  it("이미 완료된 종료 요청이 있는 매칭은 다시 종료하지 않는다(재실행 안전)", async () => {
    setQueue("subject_enrollments", [{ data: [{ id: "se1" }], error: null }]);
    setQueue("teacher_assignments", [{ data: [{ id: "ta1", subject_enrollment_id: "se1" }], error: null }]);
    setQueue("teacher_assignment_termination_requests", [{ data: { id: "term0", status: "completed" }, error: null }]);
    setQueue("reservations", [{ data: [], error: null }]);

    const result = await archiveHousehold({ householdId: "h1", actorId: "admin1" });

    expect(result).toMatchObject({ status: "completed", endedAssignments: 0 });
    expect(createTerminationRequestMock).not.toHaveBeenCalled();
    expect(processTerminationMock).not.toHaveBeenCalled();
  });

  it("중간 실패면 요청을 failed로 남기고 아카이브 플래그를 세우지 않는다", async () => {
    setQueue("subject_enrollments", [{ data: [{ id: "se1" }], error: null }]);
    setQueue("teacher_assignments", [{ data: [{ id: "ta1", subject_enrollment_id: "se1" }], error: null }]);
    setQueue("teacher_assignment_termination_requests", [{ data: null, error: null }]);
    processTerminationMock.mockResolvedValue({ status: "failed", error: "종료 게이트 실패" });

    const result = await archiveHousehold({ householdId: "h1", actorId: "admin1" });

    expect(result).toMatchObject({ status: "failed", error: "종료 게이트 실패" });
    expect(updatesTo("households")).toEqual([]);
    expect(updatesTo("household_archive_requests").at(-1)).toMatchObject({ status: "failed" });
  });
});

describe("restoreHousehold", () => {
  it("플래그만 해제하고 예약·매칭 복원은 하지 않는다", async () => {
    setQueue("households", [{ data: { id: "h1" }, error: null }]);

    const result = await restoreHousehold({ householdId: "h1", actorId: "admin1" });

    expect(result).toEqual({ restored: true });
    expect(updatesTo("households")).toEqual([{ archived_at: null, archived_by: null }]);
    expect(calls.filter((c) => c.table === "household_archive_events")).toHaveLength(1);
    expect(cancelLessonBookingMock).not.toHaveBeenCalled();
    expect(processTerminationMock).not.toHaveBeenCalled();
  });

  it("이미 활성 상태면 이벤트를 남기지 않는다(멱등)", async () => {
    setQueue("households", [{ data: null, error: null }]);

    const result = await restoreHousehold({ householdId: "h1", actorId: "admin1" });

    expect(result).toEqual({ restored: false });
    expect(calls.filter((c) => c.table === "household_archive_events")).toHaveLength(0);
  });
});
