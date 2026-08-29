import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherDetailPanel from "./TeacherDetailPanel";
import * as actions from "./users-actions";
import * as teacherSubjectsActions from "./teacher-subjects-actions";
import type { TeacherListItem } from "./users-data";

vi.mock("./users-actions", () => ({
  setTeacherStatus: vi.fn(),
  setTeacherCalendlyUrl: vi.fn(),
  setTeacherHourlyRate: vi.fn(),
}));

vi.mock("./teacher-subjects-actions", () => ({
  assignTeacherSubject: vi.fn(),
  unassignTeacherSubject: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const teacher: TeacherListItem = {
  id: "t1",
  name: "박서연 선생님",
  email: "seoyeon@example.com",
  school: "서울대학교",
  status: "active",
  qcWarningCount: 1,
  subjectNames: ["SAT Math"],
  assignedSubjectIds: [],
  calendlySchedulingUrl: null,
  hourlyRateKrw: 30000,
};

describe("TeacherDetailPanel", () => {
  it("선생님 정보와 QC 경고 이력을 보여준다", () => {
    render(
      <TeacherDetailPanel
        teacher={teacher}
        warnings={[{ id: "w1", type: "지각", detail: "10분 지각", occurredAt: "2026-08-01T00:00:00.000Z", studentName: "지훈" }]}
        subjects={[]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    expect(screen.getByText("박서연 선생님")).toBeInTheDocument();
    expect(screen.getByText(/지각 · 지훈/)).toBeInTheDocument();
  });

  it("경고 이력이 없으면 안내 문구를 보여준다", () => {
    render(<TeacherDetailPanel teacher={teacher} warnings={[]} subjects={[]} onBack={vi.fn()} onUpdated={vi.fn()} />);
    expect(screen.getByText("경고 이력이 없습니다.")).toBeInTheDocument();
  });

  it("상태를 변경하면 setTeacherStatus가 호출된다", async () => {
    vi.mocked(actions.setTeacherStatus).mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    render(
      <TeacherDetailPanel teacher={teacher} warnings={[]} subjects={[]} onBack={vi.fn()} onUpdated={onUpdated} />
    );
    fireEvent.change(screen.getByDisplayValue("활성"), { target: { value: "pending" } });
    await waitFor(() => expect(actions.setTeacherStatus).toHaveBeenCalledWith("t1", "pending"));
    expect(onUpdated).toHaveBeenCalledWith({ status: "pending" });
  });

  it("Calendly 예약 링크를 입력하고 저장하면 setTeacherCalendlyUrl이 호출된다", async () => {
    vi.mocked(actions.setTeacherCalendlyUrl).mockResolvedValue(undefined);
    const onUpdated = vi.fn();
    render(
      <TeacherDetailPanel teacher={teacher} warnings={[]} subjects={[]} onBack={vi.fn()} onUpdated={onUpdated} />
    );
    fireEvent.change(screen.getByPlaceholderText("https://calendly.com/xxx-teacher/session"), {
      target: { value: "https://calendly.com/seoyeon-teacher/session" },
    });
    fireEvent.click(screen.getAllByText("저장")[0]);
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

  it("시급을 수정하고 저장할 수 있다", async () => {
    render(
      <TeacherDetailPanel
        teacher={teacher}
        warnings={[]}
        subjects={[]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("예: 30000");
    fireEvent.change(input, { target: { value: "35000" } });
    fireEvent.click(screen.getAllByText("저장")[1]);

    await waitFor(() =>
      expect(actions.setTeacherHourlyRate).toHaveBeenCalledWith(teacher.id, 35000)
    );
  });

  it("담당 과목과 매칭된 학생을 구분해서 보여준다", () => {
    const t = { ...teacher, subjectNames: ["SAT Math"], assignedSubjectIds: ["sub1"] };
    render(
      <TeacherDetailPanel
        teacher={t}
        warnings={[]}
        subjects={[
          { subjectId: "sub1", subjectName: "SAT Math", units: [] },
          { subjectId: "sub2", subjectName: "AP Biology", units: [] },
        ]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    expect(screen.getByText("담당 과목")).toBeInTheDocument();
    expect(screen.getByText("매칭된 학생 (수강 중)")).toBeInTheDocument();
    expect(screen.getAllByText("SAT Math").length).toBeGreaterThan(0);
  });

  it("등록 안 된 과목 pill을 누르면 assignTeacherSubject를 호출한다", async () => {
    vi.mocked(teacherSubjectsActions.assignTeacherSubject).mockResolvedValue(undefined);
    const t = { ...teacher, assignedSubjectIds: [] };
    render(
      <TeacherDetailPanel
        teacher={t}
        warnings={[]}
        subjects={[{ subjectId: "sub1", subjectName: "SAT Math", units: [] }]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "SAT Math" }));
    await waitFor(() =>
      expect(teacherSubjectsActions.assignTeacherSubject).toHaveBeenCalledWith(
        t.id,
        "sub1"
      )
    );
  });

  it("등록된 과목 pill을 누르면 unassignTeacherSubject를 호출하고, 실패 시 에러를 보여준다", async () => {
    vi.mocked(teacherSubjectsActions.unassignTeacherSubject).mockRejectedValue(
      new Error("이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요.")
    );
    const t = { ...teacher, assignedSubjectIds: ["sub1"] };
    render(
      <TeacherDetailPanel
        teacher={t}
        warnings={[]}
        subjects={[{ subjectId: "sub1", subjectName: "SAT Math", units: [] }]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "SAT Math" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요."
        )
      ).toBeInTheDocument()
    );
  });
});
