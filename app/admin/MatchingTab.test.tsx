import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MatchingTab from "./MatchingTab";
import * as matchingActions from "./matching-actions";
import type { StudentListItem } from "./users-data";
import type { AdminSubject } from "./subject-data";

vi.mock("./matching-actions", () => ({
  confirmMatch: vi.fn(),
}));
// 2026-09-11(제품 오너 지시 — 정보 구조 재편) — "매칭 관리"(SubjectEnrollmentPanel)는
// 이제 이 화면이 아니라 학생 프로필에서 렌더링된다(전용 테스트는
// SubjectEnrollmentPanel.test.tsx에서 다룸) — 여기서는 더 이상 쓰이지 않는다.
const terminationPanelMock = vi.fn((_props: unknown) => null);
vi.mock("./TeacherAssignmentTerminationPanel", () => ({
  default: (props: unknown) => terminationPanelMock(props),
}));
vi.mock("./teacher-assignment-termination-actions", () => ({
  countPendingTerminationRequests: vi.fn().mockResolvedValue(0),
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
  dateOfBirth: null,
    dateOfBirthVerifiedAt: null,
  schoolName: null,
  satScore: 0,
  gpa: null,
    gpaScale: null,
  targetColleges: [],
  intendedMajors: [],
  profileCompletedAt: null,
  apCourseCount: 0,
  extracurricularCount: 0,
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
  // 2026-09-11(매칭 화면 서브탭 분리) — 탭을 시각적으로만 숨긴 채 상세
  // 데이터를 전부 가져오면 안 된다는 요구사항 회귀 테스트: "종료 요청"
  // 탭을 열기 전까지 그 패널은 마운트되지 않아야 한다.
  it("종료 요청 탭을 선택해야 그 패널이 마운트된다(선택하지 않으면 상세 조회를 미리 하지 않는다)", () => {
    terminationPanelMock.mockClear();
    render(
      <MatchingTab
        students={[pendingStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    expect(terminationPanelMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("종료 요청"));
    expect(terminationPanelMock).toHaveBeenCalledTimes(1);
  });

  // 2026-09-11(제품 오너 지시) — "매칭 대기" 탭도 현재 대기 목록과 동일한
  // 기준의 학생 수 배지를 보여줘야 한다(전체 상세를 다시 읽지 않고, 이미
  // 가진 students prop에서 계산).
  it("매칭 대기 탭에 대기 학생 수 배지를 보여준다", () => {
    render(
      <MatchingTab
        students={[pendingStudent, activeStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    const waitingTab = screen.getByText("매칭 대기").closest("button")!;
    expect(within(waitingTab).getByText("1")).toBeInTheDocument();
  });

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

  it("2026-09-10(P0 결함 수정): 총 회차 수 입력 없이 과목/선생님만 골라 매칭 확정하면 confirmMatch를 호출하고 목록에서 사라진다", async () => {
    vi.mocked(matchingActions.confirmMatch).mockResolvedValue({
      ok: true,
      subjectEnrollmentId: "se1",
      teacherAssignmentId: "ta1",
      overlayId: "ov1",
      activationWarning: null,
      curriculumWarning: null,
    });
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
    expect(screen.queryByText("총 회차 수")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("매칭 확정"));

    await waitFor(() =>
      expect(matchingActions.confirmMatch).toHaveBeenCalledWith("st1", "t1", "sub1")
    );
    await waitFor(() =>
      expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument()
    );
  });

  it("2026-09-10: 배정은 성공했지만 커리큘럼 시딩이 실패하면 경고와 재시도 버튼을 보여주고 목록에서 사라지지 않는다", async () => {
    const callsBefore = vi.mocked(matchingActions.confirmMatch).mock.calls.length;
    vi.mocked(matchingActions.confirmMatch).mockResolvedValue({
      ok: true,
      subjectEnrollmentId: "se1",
      teacherAssignmentId: "ta1",
      overlayId: null,
      activationWarning: null,
      curriculumWarning: "DB 오류: 잠시 후 다시 시도하세요.",
    });
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
    fireEvent.click(screen.getByText("매칭 확정"));

    const warningBox = await screen.findByTestId("match-partial-warning");
    expect(warningBox).toHaveTextContent("배정은 완료됐지만 후속 처리가 끝나지 않았습니다");
    expect(warningBox).toHaveTextContent("DB 오류: 잠시 후 다시 시도하세요.");
    expect(screen.queryByText(/Minified React error/)).not.toBeInTheDocument();
    // 학생이 아직 매칭 완료 목록으로 안 넘어갔어야 한다(경고 확인 전).
    expect(screen.queryByText("매칭 대기 중인 학생이 없습니다.")).not.toBeInTheDocument();

    // 재시도 — 이번엔 성공(경고 없음)했다고 가정.
    vi.mocked(matchingActions.confirmMatch).mockResolvedValue({
      ok: true,
      subjectEnrollmentId: "se1",
      teacherAssignmentId: "ta1",
      overlayId: "ov1",
      activationWarning: null,
      curriculumWarning: null,
    });
    fireEvent.click(within(warningBox).getByText("다시 시도"));

    await waitFor(() => expect(vi.mocked(matchingActions.confirmMatch).mock.calls.length).toBe(callsBefore + 2));
    await waitFor(() => expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument());
  });

  it("2026-09-10(P0 결함 수정): 매칭 확정 실패 시 {ok:false,error}의 사용자 문구를 그대로 보여준다(#441 아님)", async () => {
    vi.mocked(matchingActions.confirmMatch).mockResolvedValue({
      ok: false,
      error: "이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다.",
    });
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
    fireEvent.click(screen.getByText("매칭 확정"));

    await waitFor(() =>
      expect(
        screen.getByText("이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText(/Minified React error/)).not.toBeInTheDocument();
  });
});
