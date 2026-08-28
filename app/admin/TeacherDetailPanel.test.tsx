import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherDetailPanel from "./TeacherDetailPanel";
import * as actions from "./users-actions";
import type { TeacherListItem } from "./users-data";

vi.mock("./users-actions", () => ({
  setTeacherStatus: vi.fn(),
  setTeacherCalendlyUrl: vi.fn(),
}));

const teacher: TeacherListItem = {
  id: "t1",
  name: "박서연 선생님",
  email: "seoyeon@example.com",
  school: "서울대학교",
  status: "active",
  qcWarningCount: 1,
  subjectNames: ["SAT Math"],
  calendlySchedulingUrl: null,
};

describe("TeacherDetailPanel", () => {
  it("선생님 정보와 QC 경고 이력을 보여준다", () => {
    render(
      <TeacherDetailPanel
        teacher={teacher}
        warnings={[{ id: "w1", type: "지각", detail: "10분 지각", occurredAt: "2026-08-01T00:00:00.000Z", studentName: "지훈" }]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    expect(screen.getByText("박서연 선생님")).toBeInTheDocument();
    expect(screen.getByText(/지각 · 지훈/)).toBeInTheDocument();
  });

  it("경고 이력이 없으면 안내 문구를 보여준다", () => {
    render(<TeacherDetailPanel teacher={teacher} warnings={[]} onBack={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByText("경고 이력이 없습니다.")).toBeInTheDocument();
  });

  it("상태를 변경하면 setTeacherStatus가 호출된다", async () => {
    vi.mocked(actions.setTeacherStatus).mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    render(
      <TeacherDetailPanel teacher={teacher} warnings={[]} onBack={vi.fn()} onUpdated={onUpdated} />
    );
    fireEvent.change(screen.getByDisplayValue("활성"), { target: { value: "pending" } });
    await waitFor(() => expect(actions.setTeacherStatus).toHaveBeenCalledWith("t1", "pending"));
    expect(onUpdated).toHaveBeenCalledWith({ status: "pending" });
  });

  it("Calendly 예약 링크를 입력하고 저장하면 setTeacherCalendlyUrl이 호출된다", async () => {
    vi.mocked(actions.setTeacherCalendlyUrl).mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    render(
      <TeacherDetailPanel teacher={teacher} warnings={[]} onBack={vi.fn()} onUpdated={onUpdated} />
    );
    fireEvent.change(screen.getByPlaceholderText("https://calendly.com/xxx-teacher/session"), {
      target: { value: "https://calendly.com/seoyeon-teacher/session" },
    });
    fireEvent.click(screen.getByText("저장"));
    await waitFor(() =>
      expect(actions.setTeacherCalendlyUrl).toHaveBeenCalledWith(
        "t1",
        "https://calendly.com/seoyeon-teacher/session"
      )
    );
    expect(onUpdated).toHaveBeenCalledWith({
      calendlySchedulingUrl: "https://calendly.com/seoyeon-teacher/session",
    });
  });
});
