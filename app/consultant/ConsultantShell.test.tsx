import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ list: vi.fn(), review: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/app/login/actions", () => ({ logout: vi.fn() }));
vi.mock("./meeting-actions", () => ({
  listMyAssignedMeetingRequestsAction: m.list,
  scheduleMyMeetingRequestAction: vi.fn(),
  cancelMyMeetingRequestAction: vi.fn(),
}));
vi.mock("./meeting-request-review-actions", () => ({
  getMeetingRequestReviewForConsultant: m.review,
  saveMeetingRequestReviewDraftForConsultant: vi.fn(),
  finalizeMeetingRequestReviewForConsultant: vi.fn(),
  editFinalMeetingRequestReviewForConsultant: vi.fn(),
  listMeetingRequestReviewEditsForConsultant: vi.fn(async () => []),
}));

import ConsultantShell, { SchedulePanel } from "./ConsultantShell";

const mk = (id: string, name: string, status: string) => ({
  id, studentName: name, content: null, status, startsAt: null, endsAt: null, googleMeetLink: null, createdAt: "2026-10-01T00:00:00Z",
});

describe("컨설턴트 Schedule — Upcoming / Past 분리", () => {
  it("Upcoming에는 진행 중인 요청만, Completed·Declined는 Past 탭에만 보인다", async () => {
    m.list.mockResolvedValue([mk("a", "Ann", "requested"), mk("b", "Bob", "scheduled"), mk("c", "Cat", "completed"), mk("d", "Dan", "cancelled")]);
    m.review.mockResolvedValue({ status: "draft", draftText: "", finalText: null });
    render(<SchedulePanel assignedConsultations={[]} />);
    expect(await screen.findByText("Ann")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Cat")).not.toBeInTheDocument();
    expect(screen.queryByText("Dan")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Past" }));
    expect(await screen.findByText("Cat")).toBeInTheDocument();
    expect(screen.getByText("Dan")).toBeInTheDocument();
    expect(screen.queryByText("Ann")).not.toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    // 리뷰 패널은 Past 탭의 완료 건에서 계속 열린다.
    await waitFor(() => expect(m.review).toHaveBeenCalledWith("c"));
  });

  it("각 탭의 빈 상태 문구", async () => {
    m.list.mockResolvedValue([]);
    render(<SchedulePanel assignedConsultations={[]} />);
    expect(await screen.findByText("No upcoming meeting requests.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Past" }));
    expect(await screen.findByText("No past meeting requests yet.")).toBeInTheDocument();
  });
});

describe("컨설턴트 사이드바 — New Assignments 배지", () => {
  const base = {
    consultantName: "Kim", students: [], endedStudents: [], initialTab: "students",
  };
  const c = (id: string, extra: Record<string, unknown> = {}) => ({
    id, contactName: id, contactEmail: "x@y.z", studentGrade: null, concerns: null, status: "requested",
    requestedAt: "2026-10-01T00:00:00Z", contactedAt: null, startsAt: null, intakeOwnerId: null, admissionsConsultantId: "me", ...extra,
  });
  it("연락 전(requested) 건만 세고, 종료된 건은 칸반에서 빠지므로 배지에서도 뺀다", () => {
    render(<ConsultantShell {...base} assignedConsultations={[c("1"), c("2", { closureType: "no_trial" }), c("3", { status: "scheduled" })]} />);
    const btn = screen.getByRole("button", { name: /New Assignments/ });
    expect(btn).toHaveTextContent("1");
    expect(btn).not.toHaveTextContent("2");
  });
  it("세어질 건이 없으면 배지가 없다", () => {
    render(<ConsultantShell {...base} assignedConsultations={[c("2", { closureType: "no_trial" })]} />);
    expect(screen.getByRole("button", { name: /New Assignments/ })).toHaveTextContent(/^New Assignments$/);
  });
  it("계정 메뉴: 토글·Escape·바깥 클릭으로 닫힌다", () => {
    render(<ConsultantShell {...base} assignedConsultations={[]} />);
    const t = screen.getAllByRole("button").find((b) => b.hasAttribute("data-account-menu-trigger"))!;
    fireEvent.click(t);
    expect(screen.getByText("Log out")).toBeInTheDocument();
    fireEvent.click(t);
    expect(screen.queryByText("Log out")).toBeNull();
    fireEvent.click(t);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Log out")).toBeNull();
    fireEvent.click(t);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Log out")).toBeNull();
  });
});
