import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UnitPrepPanel from "./UnitPrepPanel";
import {
  loadUnitPrep,
  loadUnitEligibleContent,
  listBookedLessonsForUnit,
  linkUnitPrepToLesson,
  addUnitPrepItem,
  saveUnitGoal,
} from "./unit-prep-actions";

vi.mock("./unit-prep-actions", () => ({
  loadUnitPrep: vi.fn(),
  loadUnitEligibleContent: vi.fn(),
  listBookedLessonsForUnit: vi.fn(),
  linkUnitPrepToLesson: vi.fn(),
  addUnitPrepItem: vi.fn(),
  removeUnitPrepItem: vi.fn(),
  saveUnitGoal: vi.fn(),
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const emptyPrep = { goal: "", items: [], linkedLessons: [] };

function mockAll(overrides: {
  prep?: typeof emptyPrep;
  content?: { materialSections: unknown[]; problems: unknown[] };
  lessons?: unknown[];
} = {}) {
  (loadUnitPrep as ReturnType<typeof vi.fn>).mockResolvedValue(overrides.prep ?? emptyPrep);
  (loadUnitEligibleContent as ReturnType<typeof vi.fn>).mockResolvedValue(
    overrides.content ?? { materialSections: [], problems: [] }
  );
  (listBookedLessonsForUnit as ReturnType<typeof vi.fn>).mockResolvedValue(overrides.lessons ?? []);
}

function renderPanel() {
  return render(
    <UnitPrepPanel
      overlayUnitId="unit-1"
      unitTitle="이차함수의 그래프"
      studentName="지훈"
      subjectName="SAT Math"
      onBack={vi.fn()}
    />
  );
}

describe("UnitPrepPanel — 예약 없이 회차를 준비한다", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll();
  });

  it("예정된 수업이 없어도 준비 화면이 열린다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("이차함수의 그래프")).toBeInTheDocument());
    expect(screen.getByText(/아직 이 학생의 예정된 수업이 없습니다/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/이 회차가 끝났을 때/)).toBeInTheDocument();
  });

  it("준비 자료 없음·공개된 문제 없음을 각각 구분해 알려준다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/아직 담은 자료가 없습니다/)).toBeInTheDocument());
    expect(screen.getByText(/공개된 문제가 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/공개 교재가 없습니다/)).toBeInTheDocument();
  });

  it("목표를 적고 포커스를 벗어나면 저장한다", async () => {
    renderPanel();
    const box = await screen.findByPlaceholderText(/이 회차가 끝났을 때/);
    fireEvent.change(box, { target: { value: "평행이동을 설명할 수 있다" } });
    fireEvent.blur(box);
    await waitFor(() =>
      expect(saveUnitGoal).toHaveBeenCalledWith("unit-1", "평행이동을 설명할 수 있다")
    );
  });

  it("후보에서 문제를 담을 수 있다", async () => {
    mockAll({
      content: { materialSections: [], problems: [{ problemId: "p1", keywordId: "k1", passage: "문제 지문" }] },
    });
    renderPanel();
    fireEvent.click(await screen.findByText("담기"));
    await waitFor(() => expect(addUnitPrepItem).toHaveBeenCalledWith("unit-1", "problem", "p1"));
  });

  it("수업이 잡히면 그 수업에 연결할 수 있다(연결은 고정이 아니다)", async () => {
    mockAll({
      lessons: [{ sessionId: "sess-1", startsAt: "2026-09-25T18:00:00.000Z", alreadyLinked: false }],
    });
    (linkUnitPrepToLesson as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    renderPanel();
    fireEvent.click(await screen.findByText("이 수업에 연결"));
    await waitFor(() => expect(linkUnitPrepToLesson).toHaveBeenCalledWith("unit-1", "sess-1"));
  });

  it("연결 실패 사유를 화면에 보여준다", async () => {
    mockAll({
      lessons: [{ sessionId: "sess-1", startsAt: null, alreadyLinked: false }],
    });
    (linkUnitPrepToLesson as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "이미 시작했거나 종료한 수업의 준비는 바꿀 수 없습니다.",
    });
    renderPanel();
    fireEvent.click(await screen.findByText("이 수업에 연결"));
    await waitFor(() =>
      expect(screen.getByText("이미 시작했거나 종료한 수업의 준비는 바꿀 수 없습니다.")).toBeInTheDocument()
    );
  });

  it("이미 연결된 수업은 바로 열 수 있다", async () => {
    mockAll({ lessons: [{ sessionId: "sess-9", startsAt: null, alreadyLinked: true }] });
    renderPanel();
    fireEvent.click(await screen.findByText("연결됨 · 수업 열기 →"));
    expect(pushMock).toHaveBeenCalledWith("/teacher/session-prep/sess-9");
  });

  it("내부 id를 화면에 노출하지 않는다", async () => {
    mockAll({ lessons: [{ sessionId: "sess-9", startsAt: null, alreadyLinked: true }] });
    const { container } = renderPanel();
    await waitFor(() => expect(screen.getByText("연결됨 · 수업 열기 →")).toBeInTheDocument());
    expect(container.textContent).not.toContain("sess-9");
    expect(container.textContent).not.toContain("unit-1");
  });
});
