import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurriculumOverlayView from "./CurriculumOverlayView";
import { loadMyCurriculumOverlay } from "./curriculum-overlay-actions";
import type { StudentCurriculum } from "@/lib/curriculum-overlay-data";

vi.mock("./curriculum-overlay-actions", () => ({
  loadMyCurriculumOverlay: vi.fn(),
}));

const data: StudentCurriculum = {
  overlayId: "overlay1",
  units: [
    {
      id: "u1",
      sourceUnitId: "src1",
      position: 1,
      unitTitle: "이차방정식",
      note: "기초 개념",
      status: "completed",
      statusChangedAt: "2026-09-01T00:00:00Z",
      keywordIds: [],
      materialDocIds: [],
    },
    {
      id: "u2",
      sourceUnitId: "src2",
      position: 2,
      unitTitle: "판별식",
      note: null,
      status: "in_progress",
      statusChangedAt: null,
      keywordIds: [],
      materialDocIds: [],
    },
    {
      id: "u3",
      sourceUnitId: null,
      position: 3,
      unitTitle: "근과 계수의 관계",
      note: null,
      status: "not_started",
      statusChangedAt: null,
      keywordIds: [],
      materialDocIds: [],
    },
  ],
};

// v3 커리큘럼 열람 결함 수정(2026-09-11) — 읽기 전용 화면이므로 편집 버튼(이동/
// 제외/키워드토글/단원추가)이 전혀 렌더링되지 않음을 검증한다.
describe("CurriculumOverlayView — 학생·학부모 공용 읽기 전용 v3 커리큘럼", () => {
  it("단원 목록과 상태, 현재/다음 단원을 보여준다", async () => {
    (loadMyCurriculumOverlay as ReturnType<typeof vi.fn>).mockResolvedValue(data);
    render(
      <CurriculumOverlayView subjectEnrollmentId="se1" subjectName="SAT Math" onBack={() => {}} />
    );

    expect((await screen.findAllByText("이차방정식", { exact: false })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("판별식", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("근과 계수의 관계", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
    expect(screen.getByText("예정")).toBeInTheDocument();
    expect(screen.getByText(/진행 1 \/ 전체 3회차/)).toBeInTheDocument();
  });

  it("편집 버튼(순서변경/제외/키워드토글/단원추가)을 전혀 렌더링하지 않는다", async () => {
    (loadMyCurriculumOverlay as ReturnType<typeof vi.fn>).mockResolvedValue(data);
    render(
      <CurriculumOverlayView subjectEnrollmentId="se1" subjectName="SAT Math" onBack={() => {}} />
    );
    await screen.findByText("이차방정식", { exact: false });

    expect(screen.queryByText("제외")).toBeNull();
    expect(screen.queryByText("+ 단원 추가")).toBeNull();
    expect(screen.queryByRole("button", { name: /↑|↓/ })).toBeNull();
  });

  it("아직 커리큘럼이 없으면 빈 상태 안내를 보여준다(다른 가구 접근 시도와 동일하게 빈 상태만 노출)", async () => {
    (loadMyCurriculumOverlay as ReturnType<typeof vi.fn>).mockResolvedValue({
      overlayId: null,
      units: [],
    });
    render(
      <CurriculumOverlayView subjectEnrollmentId="se2" subjectName="AP Bio" onBack={() => {}} />
    );

    expect(await screen.findByText("아직 배정된 커리큘럼이 없습니다.")).toBeInTheDocument();
  });

  it("뒤로 버튼이 onBack을 호출한다", async () => {
    (loadMyCurriculumOverlay as ReturnType<typeof vi.fn>).mockResolvedValue(data);
    const onBack = vi.fn();
    render(
      <CurriculumOverlayView subjectEnrollmentId="se1" subjectName="SAT Math" onBack={onBack} />
    );
    await screen.findByText("이차방정식", { exact: false });
    fireEvent.click(screen.getByText("← 뒤로"));
    expect(onBack).toHaveBeenCalled();
  });

  it("로드 실패 시 오류 메시지를 보여준다", async () => {
    (loadMyCurriculumOverlay as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("로그인이 필요합니다.")
    );
    render(
      <CurriculumOverlayView subjectEnrollmentId="se1" subjectName="SAT Math" onBack={() => {}} />
    );
    await waitFor(() =>
      expect(screen.getByText("로그인이 필요합니다.")).toBeInTheDocument()
    );
  });
});
