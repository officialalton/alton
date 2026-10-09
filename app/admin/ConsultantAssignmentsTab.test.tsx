import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConsultantAssignmentsTab from "./ConsultantAssignmentsTab";
import type { IntakeConsultation } from "@/app/consultant/intake-data";

const { listRequestsMock, loadMeetingsMock } = vi.hoisted(() => ({ listRequestsMock: vi.fn(), loadMeetingsMock: vi.fn() }));

vi.mock("./consultant-assignment-actions", () => ({
  listConsultantsAction: vi.fn().mockResolvedValue([]),
  promoteToConsultantAction: vi.fn(),
  assignStudentToConsultantAction: vi.fn(),
  unassignStudentFromConsultantAction: vi.fn(),
  listUnassignedConsultationsAction: vi.fn().mockResolvedValue([]),
  assignConsultationToConsultantAction: vi.fn(),
  listAssignedAwaitingScheduleAction: vi.fn().mockResolvedValue([]),
  sendConsultationSchedulingLinkAction: vi.fn(),
  setAutoAssignEnabledAction: vi.fn(),
}));
vi.mock("./inquiry-and-meeting-actions", () => ({
  loadMeetingOperationsDashboardAction: loadMeetingsMock,
  updateMeetingRequestStatus: vi.fn(),
  scheduleMeetingRequest: vi.fn(),
  assignMeetingRequestConsultant: vi.fn(),
  cancelAndRerequestMeetingRequest: vi.fn(),
  resyncMeetingRequestCalendar: vi.fn(),
}));
vi.mock("./teacher-assignment-requests-actions", () => ({
  listAllTeacherAssignmentRequestsAction: listRequestsMock,
  adminReprocessTeacherAssignmentRequestAction: vi.fn(),
  adminCancelTeacherAssignmentRequestAction: vi.fn(),
}));
vi.mock("./consultation-materials-actions", () => ({
  listConsultationMaterialsAction: vi.fn().mockResolvedValue([]),
  createConsultationMaterialAction: vi.fn(),
  archiveConsultationMaterialAction: vi.fn(),
}));

const consult = (id: string) => ({ id, contactName: "학부모", contactEmail: "a@b.c", status: "requested" }) as unknown as IntakeConsultation;

beforeEach(() => {
  vi.clearAllMocks();
  loadMeetingsMock.mockResolvedValue({ requests: [], consultants: [] });
  listRequestsMock.mockResolvedValue([
    { id: "r1", studentId: "s1", studentName: "김학생", status: "pending", needsReprocessing: false, reprocessingError: null },
  ]);
});

function renderTab() {
  return render(
    <ConsultantAssignmentsTab
      initialConsultants={[]}
      initialUnassignedConsultations={[consult("c1"), consult("c2")]}
      initialAssignedAwaitingSchedule={[consult("c3")]}
      initialAutoAssignEnabled={false}
    />,
  );
}

describe("ConsultantAssignmentsTab 서브탭", () => {
  it("기본은 배정 서브탭이고 건수 헤더가 유지된다", async () => {
    renderTab();
    expect(screen.getByText("자동배정")).toBeInTheDocument();
    expect(screen.getByText("미배정 상담 요청 (2)")).toBeInTheDocument();
    expect(screen.getByText("일정 대기 중 (1)")).toBeInTheDocument();
    expect(screen.queryByText("컨설턴트 계정")).not.toBeInTheDocument();
    expect(screen.queryByText("정산")).not.toBeInTheDocument();
    await waitFor(() => expect(listRequestsMock).toHaveBeenCalled());
  });

  it("서브탭 라벨에 대기 건수 배지가 붙는다", async () => {
    renderTab();
    expect(screen.getByRole("button", { name: /^배정\s*3$/ })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^선생님 배정 요청\s*1$/ })).toBeInTheDocument();
  });

  it("계정 서브탭에서만 컨설턴트 계정이 보인다", () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "계정" }));
    expect(screen.getByText("컨설턴트 계정")).toBeInTheDocument();
    expect(screen.queryByText("자동배정")).not.toBeInTheDocument();
  });

  it("선생님 배정 요청 서브탭에서 전체 목록이 보인다", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: /^선생님 배정 요청/ }));
    expect(await screen.findByText("선생님 배정 요청 — 전체(1)")).toBeInTheDocument();
    expect(screen.queryByText("정산")).not.toBeInTheDocument();
  });

  it("면담 서브탭은 열 때만 로드하고 초기 건수 배지를 보인다", async () => {
    render(
      <ConsultantAssignmentsTab
        initialConsultants={[]}
        initialUnassignedConsultations={[]}
        initialAssignedAwaitingSchedule={[]}
        initialAutoAssignEnabled={false}
        initialMeetingActionCount={2}
      />,
    );
    expect(loadMeetingsMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^면담\s*2$/ }));
    await waitFor(() => expect(loadMeetingsMock).toHaveBeenCalled());
    expect(await screen.findByText("면담 요청이 없습니다.")).toBeInTheDocument();
  });
});
