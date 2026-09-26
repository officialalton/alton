import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeacherDetailPanel from "./TeacherDetailPanel";
import * as actions from "./users-actions";
import * as teacherSubjectsActions from "./teacher-subjects-actions";
import type { TeacherListItem } from "./users-data";

vi.mock("./users-actions", () => ({
  setTeacherStatus: vi.fn(),
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
    fireEvent.click(screen.getAllByText("저장")[0]);

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
    vi.mocked(teacherSubjectsActions.assignTeacherSubject).mockResolvedValue({ ok: true });
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
    // 2026-09-12: 던지지 않고 { ok, error }로 돌려준다 — 던진 예외는
    // Production에서 내부 오류 코드로 마스킹돼 사유가 사라진다.
    vi.mocked(teacherSubjectsActions.unassignTeacherSubject).mockResolvedValue({
      ok: false,
      error: "이 과목으로 매칭된 학생이 있어 담당 과목에서 뺄 수 없습니다.",
    });
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
        screen.getByText("이 과목으로 매칭된 학생이 있어 담당 과목에서 뺄 수 없습니다.")
      ).toBeInTheDocument()
    );
  });
});

// 2026-09-12(UAT) — 보관 과목 해제에서 Minified React error #441이 노출됐다.
// 서버 액션이 예외를 던지면 Production 빌드가 그것을 내부 오류 코드로 바꿔
// 화면에 내보낸다. 항상 { ok, error }로 받고, 실패하면 선택을 되돌리지 않는다.
describe("담당 과목 해제 실패 처리", () => {
  beforeEach(() => vi.clearAllMocks());

  const assigned = { ...teacher, assignedSubjectIds: ["sub1"] };

  function renderPanel() {
    render(
      <TeacherDetailPanel
        teacher={assigned}
        warnings={[]}
        subjects={[{ subjectId: "sub1", subjectName: "SAT Math", units: [] }]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
  }

  it("활성 매칭 때문에 막히면 사유와 종료 경로를 안내한다", async () => {
    vi.mocked(teacherSubjectsActions.unassignTeacherSubject).mockResolvedValue({
      ok: false,
      error:
        "이 과목으로 매칭된 학생이 있어 담당 과목에서 뺄 수 없습니다. " +
        "매칭 탭에서 담당을 먼저 종료해주세요. 과목을 빼는 것만으로 매칭과 예약이 정리되지는 않습니다.",
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "SAT Math" }));
    await waitFor(() =>
      expect(screen.getByText(/매칭 탭에서 담당을 먼저 종료해주세요/)).toBeInTheDocument()
    );
  });

  it("실패해도 기존 선택을 유지한다", async () => {
    vi.mocked(teacherSubjectsActions.unassignTeacherSubject).mockResolvedValue({
      ok: false,
      error: "담당 과목을 빼지 못했습니다.",
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "SAT Math" }));
    await waitFor(() => expect(screen.getByText("담당 과목을 빼지 못했습니다.")).toBeInTheDocument());
    // 여전히 등록된 상태로 보여야 한다 — 다시 누르면 해제를 시도한다.
    fireEvent.click(screen.getByRole("button", { name: "SAT Math" }));
    await waitFor(() =>
      expect(teacherSubjectsActions.unassignTeacherSubject).toHaveBeenCalledTimes(2)
    );
    expect(teacherSubjectsActions.assignTeacherSubject).not.toHaveBeenCalled();
  });

  it("예외가 나도 내부 오류 문구를 화면에 내보내지 않는다", async () => {
    vi.mocked(teacherSubjectsActions.unassignTeacherSubject).mockRejectedValue(
      new Error("Minified React error #441")
    );
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "SAT Math" }));
    await waitFor(() =>
      expect(screen.getByText(/과목 배정 처리에 실패했습니다/)).toBeInTheDocument()
    );
    expect(screen.queryByText(/Minified React error/)).not.toBeInTheDocument();
  });
});
