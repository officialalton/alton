import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UnitPrepPanel from "./UnitPrepPanel";
import { loadUnitComposition, loadProblemCount, composeUnitPrepProblems } from "./unit-prep-actions";

vi.mock("./unit-prep-actions", () => ({
  addUnitMaterial: (...a: unknown[]) => addUnitMaterial(...a),
  addAllUnitMaterials: (...a: unknown[]) => addAllUnitMaterials(...a),
  loadUnitMaterialCatalog: (...a: unknown[]) => loadUnitMaterialCatalog(...a),
  previewUnitMaterial: (...a: unknown[]) => previewUnitMaterial(...a),
  loadUnitComposition: vi.fn(),
  loadProblemCount: vi.fn(),
  composeUnitPrepProblems: vi.fn(),
  addUnitKeyword: (...a: unknown[]) => addUnitKeyword(...a),
  removeUnitKeyword: (...a: unknown[]) => removeUnitKeyword(...a),
  inheritUnitDefaults: (...a: unknown[]) => inheritUnitDefaults(...a),
  moveUnitMaterial: (...a: unknown[]) => moveUnitMaterial(...a),
  removeUnitMaterial: (...a: unknown[]) => removeUnitMaterial(...a),
}));

const loadUnitMaterialCatalog = vi.fn();
const addUnitMaterial = vi.fn();
const addAllUnitMaterials = vi.fn();
const previewUnitMaterial = vi.fn();
const addUnitKeyword = vi.fn();
const removeUnitKeyword = vi.fn();
const inheritUnitDefaults = vi.fn();
const moveUnitMaterial = vi.fn();
const removeUnitMaterial = vi.fn();

const emptyComposition = {
  keywords: [] as { id: string; label: string }[],
  materials: [] as { curriculumDocId: string; title: string; position: number; source: "auto" | "manual" }[],
  hasTemplateDefaults: false,
  subjectKeywords: [{ id: "kw-1", label: "이차함수" }],
};

function mockAll(overrides: {
  composition?: Partial<typeof emptyComposition>;
  problemCount?: number;
} = {}) {
  (loadUnitComposition as ReturnType<typeof vi.fn>).mockResolvedValue({
    ...emptyComposition,
    ...(overrides.composition ?? {}),
  });
  (loadProblemCount as ReturnType<typeof vi.fn>).mockResolvedValue(overrides.problemCount ?? 0);
  addUnitKeyword.mockResolvedValue({ ok: true });
  removeUnitKeyword.mockResolvedValue({ ok: true });
  inheritUnitDefaults.mockResolvedValue({ ok: true, keywordsAdded: 2, materialsAdded: 3 });
  moveUnitMaterial.mockResolvedValue({ ok: true });
  removeUnitMaterial.mockResolvedValue({ ok: true });
  addUnitMaterial.mockResolvedValue({ ok: true });
  addAllUnitMaterials.mockResolvedValue({ ok: true, addedCount: 2 });
  loadUnitMaterialCatalog.mockResolvedValue([
    { curriculumDocId: "d1", title: "이차함수 개론", primaryKeywordLabel: "이차함수", kind: "html", picked: false },
    { curriculumDocId: "d9", title: "삼각비 기초", primaryKeywordLabel: null, kind: "html", picked: true },
  ]);
  previewUnitMaterial.mockResolvedValue({ title: "이차함수 개론", sectionTitles: ["정의", "그래프"] });
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

describe("UnitPrepPanel — 목표·예약연결·개별 후보 선택 없이 키워드→교재→문제만", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll();
  });

  it("목표 입력란과 예약 수업 연결 섹션이 없다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("이차함수의 그래프")).toBeInTheDocument());
    expect(screen.queryByPlaceholderText(/이 회차가 끝났을 때/)).not.toBeInTheDocument();
    expect(screen.queryByText("수업에 연결하기")).not.toBeInTheDocument();
    expect(screen.queryByText(/예약이 없어도 미리 준비할 수 있습니다/)).not.toBeInTheDocument();
  });

  it("키워드가 없으면 교재·문제 영역이 키워드부터 고르라고 안내한다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("키워드 추가")).toBeInTheDocument());
    expect(screen.getByText("키워드를 먼저 고르면 담을 수 있는 교재가 나타납니다.")).toBeInTheDocument();
    expect(screen.getByText("키워드를 먼저 고르면 문제를 구성할 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByText("문제 20개 업데이트")).toBeDisabled();
  });

  it("해당 키워드로 수업 주제 세팅하기를 누르면 addUnitKeyword가 호출된다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("키워드 추가")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("키워드 추가"), { target: { value: "kw-1" } });
    fireEvent.click(screen.getByText("해당 키워드로 수업 주제 세팅하기"));
    await waitFor(() => expect(addUnitKeyword).toHaveBeenCalledWith("unit-1", "kw-1"));
  });

  it("키워드가 이미 있으면 선택된 키워드의 교재 목록이 바로 보인다", async () => {
    mockAll({ composition: { keywords: [{ id: "kw-1", label: "이차함수" }] } });
    renderPanel();
    await waitFor(() => expect(screen.getByText("선택된 키워드의 교재")).toBeInTheDocument());
    expect(screen.getByText("이차함수 개론")).toBeInTheDocument();
  });
});

describe("UnitPrepPanel — 교재: 개별 담기·전체 담기", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll({ composition: { keywords: [{ id: "kw-1", label: "이차함수" }] } });
  });

  it("선택된 키워드의 교재를 개별로 담을 수 있다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("이차함수 개론")).toBeInTheDocument());
    fireEvent.click(screen.getAllByText("담기")[0]);
    await waitFor(() => expect(addUnitMaterial).toHaveBeenCalledWith("unit-1", "d1"));
  });

  it("이미 담긴 교재는 다시 담을 수 없다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("삼각비 기초")).toBeInTheDocument());
    expect(screen.getByText("담김")).toBeDisabled();
  });

  it("교재 전체 담기로 안 담은 것을 한 번에 담는다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("교재 전체 담기")).toBeInTheDocument());
    fireEvent.click(screen.getByText("교재 전체 담기"));
    await waitFor(() => expect(addAllUnitMaterials).toHaveBeenCalledWith("unit-1"));
    await waitFor(() => expect(screen.getByText("교재 2개를 담았습니다.")).toBeInTheDocument());
  });

  it("제목으로 목록을 좁힐 수 있다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("이차함수 개론")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("교재 검색"), { target: { value: "삼각" } });
    expect(screen.queryByText("이차함수 개론")).not.toBeInTheDocument();
    expect(screen.getByText("삼각비 기초")).toBeInTheDocument();
  });

  it("담기 전에 교재 안을 미리 볼 수 있다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getAllByText("미리보기").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("미리보기")[0]);
    await waitFor(() => expect(screen.getByText("정의")).toBeInTheDocument());
  });

  it("담은 교재의 순서를 바꾸고 뺄 수 있다", async () => {
    mockAll({
      composition: {
        keywords: [{ id: "kw-1", label: "이차함수" }],
        materials: [
          { curriculumDocId: "d1", title: "첫째 교재", position: 1, source: "manual" as const },
          { curriculumDocId: "d2", title: "둘째 교재", position: 2, source: "manual" as const },
        ],
      },
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText("1. 첫째 교재")).toBeInTheDocument());
    expect(screen.queryByText("키워드 자동")).not.toBeInTheDocument();
    expect(screen.queryByText("직접 담음")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("둘째 교재 위로"));
    await waitFor(() => expect(moveUnitMaterial).toHaveBeenCalledWith("unit-1", "d2", "up"));

    fireEvent.click(screen.getAllByText("빼기")[0]);
    await waitFor(() => expect(removeUnitMaterial).toHaveBeenCalledWith("unit-1", "d1"));
  });
});

describe("UnitPrepPanel — 문제 20개 업데이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll({ composition: { keywords: [{ id: "kw-1", label: "이차함수" }] }, problemCount: 5 });
  });

  it("현재 구성된 문제 수만 보여주고, 개별 후보나 담기 버튼은 없다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("문제 5개")).toBeInTheDocument());
    expect(screen.queryByText("문제 후보")).not.toBeInTheDocument();
    expect(screen.queryByText("✏️")).not.toBeInTheDocument();
  });

  it("눌러서 20개로 구성하면 결과 개수를 보여준다", async () => {
    (composeUnitPrepProblems as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      composedCount: 20,
      availableCount: 35,
    });
    renderPanel();
    fireEvent.click(await screen.findByText("문제 20개 업데이트"));
    await waitFor(() => expect(composeUnitPrepProblems).toHaveBeenCalledWith("unit-1"));
    await waitFor(() => expect(screen.getByText("문제 20개")).toBeInTheDocument());
    expect(screen.getByText("문제 20개로 구성했습니다.")).toBeInTheDocument();
  });

  it("공개 문제가 20개보다 적으면 현재 수와 부족분을 알려준다", async () => {
    (composeUnitPrepProblems as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      composedCount: 12,
      availableCount: 12,
    });
    renderPanel();
    fireEvent.click(await screen.findByText("문제 20개 업데이트"));
    await waitFor(() =>
      expect(screen.getByText("공개된 문제가 12개뿐이라 12개로 구성했습니다(20개보다 8개 부족).")).toBeInTheDocument()
    );
  });

  it("다시 누르면 현재 키워드 기준으로 전체를 다시 구성한다", async () => {
    (composeUnitPrepProblems as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      composedCount: 20,
      availableCount: 40,
    });
    renderPanel();
    const button = await screen.findByText("문제 20개 업데이트");
    fireEvent.click(button);
    await waitFor(() => expect(composeUnitPrepProblems).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(composeUnitPrepProblems).toHaveBeenCalledTimes(2));
  });

  it("실패 사유를 보여준다", async () => {
    (composeUnitPrepProblems as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "이 회차에 아직 키워드가 없습니다. 키워드를 먼저 선택하세요.",
    });
    renderPanel();
    fireEvent.click(await screen.findByText("문제 20개 업데이트"));
    await waitFor(() =>
      expect(screen.getByText("이 회차에 아직 키워드가 없습니다. 키워드를 먼저 선택하세요.")).toBeInTheDocument()
    );
  });
});

describe("UnitPrepPanel — 기본 구성 보충", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll();
  });

  it("템플릿에서 나온 회차에서만 기본 구성을 가져올 수 있다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("키워드 추가")).toBeInTheDocument());
    expect(screen.queryByText("기본 구성 가져오기(관리자가 미리 정한 키워드·교재)")).not.toBeInTheDocument();
  });

  it("기본 구성을 가져오면 무엇이 몇 개 왔는지 알려준다", async () => {
    mockAll({ composition: { hasTemplateDefaults: true } });
    renderPanel();
    await waitFor(() => expect(screen.getByText("기본 구성 가져오기(관리자가 미리 정한 키워드·교재)")).toBeInTheDocument());
    fireEvent.click(screen.getByText("기본 구성 가져오기(관리자가 미리 정한 키워드·교재)"));
    await waitFor(() => expect(screen.getByText(/키워드 2개, 교재 3개를 가져왔습니다/)).toBeInTheDocument());
  });
});
