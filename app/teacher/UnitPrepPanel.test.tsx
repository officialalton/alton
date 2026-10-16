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
    await waitFor(() => expect(screen.getByLabelText("Add keyword")).toBeInTheDocument());
    expect(screen.getByText("Pick a keyword first to see materials you can add.")).toBeInTheDocument();
    expect(screen.getByText("Pick a keyword first to compose problems.")).toBeInTheDocument();
    expect(screen.getByText("Update 20 problems")).toBeDisabled();
  });

  it("해당 키워드로 수업 주제 세팅하기를 누르면 addUnitKeyword가 호출된다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByLabelText("Add keyword")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Add keyword"), { target: { value: "kw-1" } });
    fireEvent.click(screen.getByText("Set lesson topic with this keyword"));
    await waitFor(() => expect(addUnitKeyword).toHaveBeenCalledWith("unit-1", "kw-1"));
  });

  it("키워드가 이미 있으면 선택된 키워드의 교재 목록이 바로 보인다", async () => {
    mockAll({ composition: { keywords: [{ id: "kw-1", label: "이차함수" }] } });
    renderPanel();
    await waitFor(() => expect(screen.getByText("Materials for selected keywords")).toBeInTheDocument());
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
    fireEvent.click(screen.getAllByText("Add")[0]);
    await waitFor(() => expect(addUnitMaterial).toHaveBeenCalledWith("unit-1", "d1"));
  });

  it("이미 담긴 교재는 다시 담을 수 없다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("삼각비 기초")).toBeInTheDocument());
    expect(screen.getByText("Added")).toBeDisabled();
  });

  it("교재 전체 담기로 안 담은 것을 한 번에 담는다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Add all materials")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Add all materials"));
    await waitFor(() => expect(addAllUnitMaterials).toHaveBeenCalledWith("unit-1"));
    await waitFor(() => expect(screen.getByText("Added 2 materials.")).toBeInTheDocument());
  });

  it("제목으로 목록을 좁힐 수 있다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("이차함수 개론")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Search materials"), { target: { value: "삼각" } });
    expect(screen.queryByText("이차함수 개론")).not.toBeInTheDocument();
    expect(screen.getByText("삼각비 기초")).toBeInTheDocument();
  });

  it("담기 전에 교재 안을 미리 볼 수 있다", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getAllByText("Preview").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Preview")[0]);
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

    fireEvent.click(screen.getByLabelText("Move 둘째 교재 up"));
    await waitFor(() => expect(moveUnitMaterial).toHaveBeenCalledWith("unit-1", "d2", "up"));

    fireEvent.click(screen.getAllByText("Remove")[0]);
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
    await waitFor(() => expect(screen.getByText("Problems: 5")).toBeInTheDocument());
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
    fireEvent.click(await screen.findByText("Update 20 problems"));
    await waitFor(() => expect(composeUnitPrepProblems).toHaveBeenCalledWith("unit-1"));
    await waitFor(() => expect(screen.getByText("Problems: 20")).toBeInTheDocument());
    expect(screen.getByText("Composed 20 problems.")).toBeInTheDocument();
  });

  it("공개 문제가 20개보다 적으면 현재 수와 부족분을 알려준다", async () => {
    (composeUnitPrepProblems as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      composedCount: 12,
      availableCount: 12,
    });
    renderPanel();
    fireEvent.click(await screen.findByText("Update 20 problems"));
    await waitFor(() =>
      expect(screen.getByText("Only 12 published problems are available, so 12 were composed (8 short of 20).")).toBeInTheDocument()
    );
  });

  it("다시 누르면 현재 키워드 기준으로 전체를 다시 구성한다", async () => {
    (composeUnitPrepProblems as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      composedCount: 20,
      availableCount: 40,
    });
    renderPanel();
    const button = await screen.findByText("Update 20 problems");
    fireEvent.click(button);
    await waitFor(() => expect(composeUnitPrepProblems).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(composeUnitPrepProblems).toHaveBeenCalledTimes(2));
  });

  it("실패 사유를 보여준다", async () => {
    (composeUnitPrepProblems as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "This session has no keywords yet. Pick a keyword first.",
    });
    renderPanel();
    fireEvent.click(await screen.findByText("Update 20 problems"));
    await waitFor(() =>
      expect(screen.getByText("This session has no keywords yet. Pick a keyword first.")).toBeInTheDocument()
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
    await waitFor(() => expect(screen.getByLabelText("Add keyword")).toBeInTheDocument());
    expect(screen.queryByText("Import defaults (admin-preset keywords & materials)")).not.toBeInTheDocument();
  });

  it("기본 구성을 가져오면 무엇이 몇 개 왔는지 알려준다", async () => {
    mockAll({ composition: { hasTemplateDefaults: true } });
    renderPanel();
    await waitFor(() => expect(screen.getByText("Import defaults (admin-preset keywords & materials)")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Import defaults (admin-preset keywords & materials)"));
    await waitFor(() => expect(screen.getByText(/Imported 2 keywords and 3 materials/)).toBeInTheDocument());
  });
});

describe("UnitPrepPanel — 키워드 도메인 그룹", () => {
  it("Add keyword 선택 상자가 도메인별 optgroup 으로 묶인다", async () => {
    mockAll({
      composition: {
        subjectKeywords: [
          { id: "kw-1", label: "Linear equations", domainCode: "algebra" } as never,
          { id: "kw-2", label: "Legacy" } as never,
        ],
      },
    });
    renderPanel();
    const select = (await screen.findByLabelText("Add keyword")) as HTMLSelectElement;
    expect([...select.querySelectorAll("optgroup")].map((g) => g.label)).toEqual(["Algebra", "Other"]);
    expect(select.querySelector("option[value='kw-1']")).not.toBeNull();
  });
});
