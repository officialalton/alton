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
  loadUnitComposition: (...a: unknown[]) => loadUnitComposition(...a),
  addUnitKeyword: (...a: unknown[]) => addUnitKeyword(...a),
  removeUnitKeyword: (...a: unknown[]) => removeUnitKeyword(...a),
  inheritUnitDefaults: (...a: unknown[]) => inheritUnitDefaults(...a),
  moveUnitMaterial: (...a: unknown[]) => moveUnitMaterial(...a),
  removeUnitMaterial: (...a: unknown[]) => removeUnitMaterial(...a),
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

const loadUnitComposition = vi.fn();
const addUnitKeyword = vi.fn();
const removeUnitKeyword = vi.fn();
const inheritUnitDefaults = vi.fn();
const moveUnitMaterial = vi.fn();
const removeUnitMaterial = vi.fn();

const emptyComposition = {
  keywords: [] as { id: string; label: string }[],
  materials: [] as { curriculumDocId: string; title: string; position: number }[],
  hasTemplateDefaults: false,
  subjectKeywords: [{ id: "kw-1", label: "이차함수" }],
};

const emptyPrep = { goal: "", items: [], linkedLessons: [] };

function mockAll(overrides: {
  prep?: typeof emptyPrep;
  content?: { materialSections: unknown[]; problems: unknown[]; keywordCount?: number };
  lessons?: unknown[];
  composition?: Partial<typeof emptyComposition>;
} = {}) {
  loadUnitComposition.mockResolvedValue({ ...emptyComposition, ...(overrides.composition ?? {}) });
  addUnitKeyword.mockResolvedValue({ ok: true });
  removeUnitKeyword.mockResolvedValue({ ok: true });
  inheritUnitDefaults.mockResolvedValue({ ok: true, keywordsAdded: 2, materialsAdded: 3 });
  moveUnitMaterial.mockResolvedValue({ ok: true });
  removeUnitMaterial.mockResolvedValue({ ok: true });
  (loadUnitPrep as ReturnType<typeof vi.fn>).mockResolvedValue(overrides.prep ?? emptyPrep);
  (loadUnitEligibleContent as ReturnType<typeof vi.fn>).mockResolvedValue(
    overrides.content ?? { materialSections: [], problems: [], keywordCount: 2 }
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
    expect(screen.getByText(/확정된 문제가 없습니다/)).toBeInTheDocument();
    expect(screen.getByText(/공개 교재가 없습니다/)).toBeInTheDocument();
  });

  // 후보가 비는 원인은 둘이고, 선생님이 할 일이 다르다. 같은 문구로 뭉뚱그리면
  // "왜 아무것도 못 고르지"에서 멈춘다 — Preview UAT의 '선택 실패'가 이것이었다.
  it("키워드가 없어서 비었으면 키워드를 지정하라고 알려준다", async () => {
    mockAll({ content: { materialSections: [], problems: [], keywordCount: 0 } });
    renderPanel();
    await waitFor(() =>
      expect(screen.getAllByText(/이 회차에 아직 키워드가 없습니다/).length).toBeGreaterThan(0)
    );
    expect(screen.queryByText(/공개 교재가 없습니다/)).not.toBeInTheDocument();
  });

  it("키워드는 있는데 공개된 콘텐츠가 없으면 그렇게 알려준다", async () => {
    mockAll({
      content: { materialSections: [], problems: [], keywordCount: 3 },
      composition: { keywords: [{ id: "kw-1", label: "이차함수" }] },
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText(/공개 교재가 없습니다/)).toBeInTheDocument());
    expect(screen.queryByText(/아직 키워드가 없습니다/)).not.toBeInTheDocument();
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

// P2/P3 2차 — 키워드 설정 진입점과 교재 기본 구성.
// 확정 정책: 새 회차는 키워드 없이 초안으로 존재할 수 있다. 자동으로 채우지 않되,
// 준비 화면에서 설정할 수 있는 자리는 있어야 한다.
describe("UnitPrepPanel — 회차 키워드와 교재 구성", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll();
  });

  it("키워드가 없어도 그 자리에서 붙일 수 있다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("키워드 추가")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("키워드 추가"), { target: { value: "kw-1" } });
    fireEvent.click(screen.getByText("키워드 붙이기"));

    await waitFor(() => expect(addUnitKeyword).toHaveBeenCalledWith("unit-1", "kw-1"));
    // 키워드가 바뀌면 후보도 달라진다 — 둘을 같이 다시 읽어야 화면이 어긋나지 않는다.
    await waitFor(() => expect(loadUnitEligibleContent).toHaveBeenCalledTimes(2));
  });

  it("이미 붙은 키워드는 고르는 목록에 다시 나오지 않는다", async () => {
    mockAll({ composition: { keywords: [{ id: "kw-1", label: "이차함수" }] } });
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("키워드 추가")).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: "이차함수" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("이차함수 키워드 빼기")).toBeInTheDocument();
  });

  it("템플릿에서 나온 회차에서만 기본 구성을 가져올 수 있다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("키워드 추가")).toBeInTheDocument());
    expect(screen.queryByText("기본 구성 가져오기")).not.toBeInTheDocument();
  });

  it("기본 구성을 가져오면 무엇이 몇 개 왔는지 알려준다", async () => {
    mockAll({ composition: { hasTemplateDefaults: true } });
    renderPanel();
    await waitFor(() => expect(screen.getByText("기본 구성 가져오기")).toBeInTheDocument());

    fireEvent.click(screen.getByText("기본 구성 가져오기"));
    await waitFor(() =>
      expect(screen.getByText(/키워드 2개, 교재 3개를 가져왔습니다/)).toBeInTheDocument()
    );
  });

  it("이미 다 가져온 상태도 구분해 알려준다", async () => {
    mockAll({ composition: { hasTemplateDefaults: true } });
    inheritUnitDefaults.mockResolvedValue({ ok: true, keywordsAdded: 0, materialsAdded: 0 });
    renderPanel();
    await waitFor(() => expect(screen.getByText("기본 구성 가져오기")).toBeInTheDocument());

    fireEvent.click(screen.getByText("기본 구성 가져오기"));
    await waitFor(() => expect(screen.getByText(/이미 기본 구성을 모두 가져왔습니다/)).toBeInTheDocument());
  });

  it("교재 구성의 순서를 바꿀 수 있고, 양 끝에서는 그 방향이 막힌다", async () => {
    mockAll({
      composition: {
        materials: [
          { curriculumDocId: "d1", title: "첫째 교재", position: 1 },
          { curriculumDocId: "d2", title: "둘째 교재", position: 2 },
        ],
      },
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText("1. 첫째 교재")).toBeInTheDocument());

    expect(screen.getByLabelText("첫째 교재 위로")).toBeDisabled();
    expect(screen.getByLabelText("둘째 교재 아래로")).toBeDisabled();

    fireEvent.click(screen.getByLabelText("둘째 교재 위로"));
    await waitFor(() => expect(moveUnitMaterial).toHaveBeenCalledWith("unit-1", "d2", "up"));
  });

  it("구성 변경이 실패하면 사유를 보여준다", async () => {
    removeUnitKeyword.mockResolvedValue({ ok: false, error: "키워드를 떼지 못했습니다." });
    mockAll({ composition: { keywords: [{ id: "kw-1", label: "이차함수" }] } });
    removeUnitKeyword.mockResolvedValue({ ok: false, error: "키워드를 떼지 못했습니다." });
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("이차함수 키워드 빼기")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("이차함수 키워드 빼기"));
    await waitFor(() => expect(screen.getByText("키워드를 떼지 못했습니다.")).toBeInTheDocument());
  });
});
