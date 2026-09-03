import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MatchingTab from "./MatchingTab";
import * as matchingActions from "./matching-actions";
import type { StudentListItem } from "./users-data";
import type { AdminSubject } from "./subject-data";

vi.mock("./matching-actions", () => ({
  confirmMatch: vi.fn(),
}));
// R5: SubjectEnrollmentPanel은 이 컴포넌트와 별개 관심사(과목 수강/선생님 배정)이고
// students 전체(활성 학생 포함)를 보여주는 게 의도된 동작이라, 이 파일의
// "매칭 대기 학생만 보인다" 단언과 충돌한다 — 자체 테스트(SubjectEnrollmentPanel용
// 별도 테스트에서 다룸)가 있으므로 여기서는 mock으로 대체한다.
vi.mock("./SubjectEnrollmentPanel", () => ({
  default: () => null,
}));
vi.mock("./TeacherAssignmentTerminationPanel", () => ({
  default: () => null,
}));

const pendingStudent: StudentListItem = {
  id: "st1",
  name: "박준서",
  email: "junseo@example.com",
  grade: "11학년",
  status: "pending",
  creditBalance: 0,
  parentNames: ["박부모"],
  subjectNames: [],
};

const activeStudent: StudentListItem = {
  ...pendingStudent,
  id: "st2",
  name: "이미매칭",
  status: "active",
};

const subjects: AdminSubject[] = [
  { subjectId: "sub1", subjectName: "SAT Math", units: [] },
  { subjectId: "sub2", subjectName: "AP Biology", units: [] },
];

const teacherCandidatesBySubject = {
  sub1: [{ id: "t1", name: "김선생" }],
};

describe("MatchingTab", () => {
  it("매칭 대기(pending) 학생만 목록에 보여준다", () => {
    render(
      <MatchingTab
        students={[pendingStudent, activeStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    expect(screen.getByText("박준서")).toBeInTheDocument();
    expect(screen.queryByText("이미매칭")).not.toBeInTheDocument();
  });

  it("매칭 대기 학생이 없으면 안내 문구를 보여준다", () => {
    render(
      <MatchingTab
        students={[activeStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument();
  });

  it("과목 선택 시 그 과목의 선생님 후보만 보여주고, 후보가 없으면 안내한다", () => {
    render(
      <MatchingTab
        students={[pendingStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    fireEvent.click(screen.getByText("매칭하기"));
    fireEvent.click(screen.getByText("SAT Math"));
    expect(screen.getByText("김선생")).toBeInTheDocument();

    fireEvent.click(screen.getByText("AP Biology"));
    expect(
      screen.getByText("이 과목을 가르치는 선생님이 없습니다. 먼저 선생님의 담당 과목을 등록해주세요.")
    ).toBeInTheDocument();
  });

  it("과목/선생님/회차 수를 골라 매칭 확정하면 confirmMatch를 호출하고 목록에서 사라진다", async () => {
    vi.mocked(matchingActions.confirmMatch).mockResolvedValue(undefined);
    render(
      <MatchingTab
        students={[pendingStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    fireEvent.click(screen.getByText("매칭하기"));
    fireEvent.click(screen.getByText("SAT Math"));
    fireEvent.click(screen.getByText("김선생"));
    fireEvent.change(screen.getByPlaceholderText("예: 20"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("매칭 확정"));

    await waitFor(() =>
      expect(matchingActions.confirmMatch).toHaveBeenCalledWith("st1", "t1", "sub1", 20)
    );
    await waitFor(() =>
      expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument()
    );
  });

  it("매칭 확정 실패 시 에러 메시지를 보여준다", async () => {
    vi.mocked(matchingActions.confirmMatch).mockRejectedValue(
      new Error("이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다.")
    );
    render(
      <MatchingTab
        students={[pendingStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    fireEvent.click(screen.getByText("매칭하기"));
    fireEvent.click(screen.getByText("SAT Math"));
    fireEvent.click(screen.getByText("김선생"));
    fireEvent.change(screen.getByPlaceholderText("예: 20"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("매칭 확정"));

    await waitFor(() =>
      expect(
        screen.getByText("이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다.")
      ).toBeInTheDocument()
    );
  });
});
