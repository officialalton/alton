import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StudentCurriculumPanel from "./StudentCurriculumPanel";
import * as actions from "./student-curriculum-actions";
import type { StudentCurriculum, EligibleLibrary } from "./student-curriculum-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("./student-curriculum-actions", () => ({
  ensureActiveOverlay: vi.fn(),
  addCanonicalUnit: vi.fn(),
  createSupplementUnit: vi.fn(),
  excludeUnit: vi.fn(),
  moveUnit: vi.fn(),
  setUnitStatus: vi.fn(),
  setActiveKeywords: vi.fn(),
  previewBaseCurriculumUpdate: vi.fn(),
  applyBaseCurriculumUpdate: vi.fn(),
  previewAdditionalStudyUnitInsert: vi.fn(),
  insertAdditionalStudyUnit: vi.fn(),
  reloadCurriculumUnits: vi.fn(),
}));

vi.mock("./unit-prep-actions", () => ({
  loadUnitPrepSummaries: vi.fn().mockResolvedValue({}),
}));

const initial: StudentCurriculum = {
  overlayId: "overlay1",
  units: [
    {
      id: "u1",
      sourceUnitId: "src1",
    sourceTeacherTemplateUnitId: null,
      position: 1,
      unitTitle: "이차방정식",
      note: null,
      status: "not_started",
      statusChangedAt: null,
      keywordIds: ["kw1"],
    keywordLabels: [],
      materialDocIds: [],
      needsBaseUpdate: false,
    },
  ],
};

const library: EligibleLibrary = {
  units: [],
  publishedDocs: [],
  keywords: [
    { id: "kw1", label: "이차방정식" },
    { id: "kw2", label: "판별식" },
  ],
};

describe("StudentCurriculumPanel — 2026-09-09(UAT 지적) 회차별 키워드 조정", () => {
  it("이미 태그된 키워드는 활성 표시되고, 새 키워드를 누르면 setActiveKeywords가 합쳐진 목록으로 호출된다", async () => {
    vi.mocked(actions.setActiveKeywords).mockResolvedValue(undefined);
    render(
      <StudentCurriculumPanel subjectEnrollmentId="se1" initial={initial} library={library} />
    );

    const kw1Button = screen.getByText("이차방정식", { selector: "button" });
    expect(kw1Button.className).toContain("bg-ink");

    fireEvent.click(screen.getByText("판별식"));
    await waitFor(() =>
      expect(actions.setActiveKeywords).toHaveBeenCalledWith("se1", "u1", ["kw1", "kw2"])
    );
  });

  it("이미 활성인 키워드를 다시 누르면 목록에서 제외된다", async () => {
    vi.mocked(actions.setActiveKeywords).mockResolvedValue(undefined);
    render(
      <StudentCurriculumPanel subjectEnrollmentId="se1" initial={initial} library={library} />
    );

    fireEvent.click(screen.getByText("이차방정식", { selector: "button" }));
    await waitFor(() => expect(actions.setActiveKeywords).toHaveBeenCalledWith("se1", "u1", []));
  });
});

const inProgressUnit = {
  id: "u2",
  sourceUnitId: "src2",
  sourceTeacherTemplateUnitId: null,
  position: 1,
  unitTitle: "Math 1",
  note: null,
  status: "in_progress" as const,
  statusChangedAt: null,
  keywordIds: [],
  keywordLabels: [],
  materialDocIds: [],
  needsBaseUpdate: false,
};

const notStartedUnit = {
  ...inProgressUnit,
  id: "u3",
  unitTitle: "Math 2",
  status: "not_started" as const,
};

describe("StudentCurriculumPanel — 2026-09-18 회차 카드 배지·추가 학습 회차", () => {
  it("진행 중·완료 회차에만 '다음 수업에 추가 학습 회차 넣기' 버튼이 보인다", () => {
    render(
      <StudentCurriculumPanel
        subjectEnrollmentId="se1"
        initial={{ overlayId: "overlay1", units: [inProgressUnit, notStartedUnit] }}
        library={library}
      />
    );
    expect(screen.getAllByText("다음 수업에 추가 학습 회차 넣기")).toHaveLength(1);
  });

  it("'목표 미작성'·'수업 N개에 연결됨' 배지를 더는 쓰지 않는다", () => {
    render(
      <StudentCurriculumPanel
        subjectEnrollmentId="se1"
        initial={{ overlayId: "overlay1", units: [inProgressUnit] }}
        library={library}
      />
    );
    expect(screen.queryByText("목표 미작성")).not.toBeInTheDocument();
    expect(screen.queryByText(/에 연결됨/)).not.toBeInTheDocument();
  });

  it("버튼을 누르면 미리보기를 불러와 새 회차명·영향받는 예정 수업을 보여준다", async () => {
    vi.mocked(actions.previewAdditionalStudyUnitInsert).mockResolvedValue({
      ok: true,
      preview: {
        newUnitTitle: "추가 학습 · Math 1",
        affectedFutureSessions: [
          {
            sessionId: "s1",
            startsAt: "2026-10-01T05:00:00.000Z",
            currentUnitTitle: "Math 2",
            resultingUnitTitle: "추가 학습 · Math 1",
          },
        ],
        unaffectedStartedOrCompletedCount: 1,
      },
    });
    render(
      <StudentCurriculumPanel
        subjectEnrollmentId="se1"
        initial={{ overlayId: "overlay1", units: [inProgressUnit] }}
        library={library}
      />
    );
    fireEvent.click(screen.getByText("다음 수업에 추가 학습 회차 넣기"));
    await waitFor(() =>
      expect(actions.previewAdditionalStudyUnitInsert).toHaveBeenCalledWith("se1", "u2")
    );
    await waitFor(() => expect(screen.getByText(/새 회차: 추가 학습 · Math 1/)).toBeInTheDocument());
    expect(screen.getByText(/영향받지 않는 시작·완료 수업 1개/)).toBeInTheDocument();
  });

  it("확정하면 insertAdditionalStudyUnit을 한 번만 호출하고 목록을 새로고침한다", async () => {
    vi.mocked(actions.previewAdditionalStudyUnitInsert).mockResolvedValue({
      ok: true,
      preview: { newUnitTitle: "추가 학습 · Math 1", affectedFutureSessions: [], unaffectedStartedOrCompletedCount: 0 },
    });
    vi.mocked(actions.insertAdditionalStudyUnit).mockResolvedValue({
      ok: true,
      result: { newUnitId: "new1", newUnitTitle: "추가 학습 · Math 1", reassigned: [], leftPending: [] },
    });
    vi.mocked(actions.reloadCurriculumUnits).mockResolvedValue({
      overlayId: "overlay1",
      units: [inProgressUnit, { ...notStartedUnit, id: "new1", unitTitle: "추가 학습 · Math 1" }],
    });

    render(
      <StudentCurriculumPanel
        subjectEnrollmentId="se1"
        initial={{ overlayId: "overlay1", units: [inProgressUnit] }}
        library={library}
      />
    );
    fireEvent.click(screen.getByText("다음 수업에 추가 학습 회차 넣기"));
    await waitFor(() => expect(screen.getByText("추가 학습 회차 넣기")).toBeInTheDocument());
    fireEvent.click(screen.getByText("추가 학습 회차 넣기"));

    await waitFor(() => expect(actions.insertAdditionalStudyUnit).toHaveBeenCalledTimes(1));
    expect(actions.insertAdditionalStudyUnit).toHaveBeenCalledWith("se1", "u2");
    await waitFor(() => expect(actions.reloadCurriculumUnits).toHaveBeenCalledWith("se1"));
    await waitFor(() => expect(screen.getByText("추가 학습 · Math 1")).toBeInTheDocument());
  });

  it("'기준본 업데이트 있음' 대신 '교재·문제 변경 있음'을 쓰고, 버튼은 '변경 내용 보기'·'구성에 반영'이다", () => {
    render(
      <StudentCurriculumPanel
        subjectEnrollmentId="se1"
        initial={{ overlayId: "overlay1", units: [{ ...inProgressUnit, needsBaseUpdate: true }] }}
        library={library}
      />
    );
    expect(screen.getByText("교재·문제 변경 있음")).toBeInTheDocument();
    expect(screen.getByText("변경 내용 보기")).toBeInTheDocument();
    expect(screen.queryByText("기준본 업데이트 있음")).not.toBeInTheDocument();
    expect(screen.queryByText("변경 확인")).not.toBeInTheDocument();
  });
});
