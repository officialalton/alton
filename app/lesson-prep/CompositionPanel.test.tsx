import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CompositionPanel from "./CompositionPanel";
import * as actions from "./actions";
import type { UnitComposition } from "@/lib/unit-composition";

vi.mock("./actions", () => ({
  addKeyword: vi.fn(),
  removeKeyword: vi.fn(),
  addMaterial: vi.fn(),
  removeMaterial: vi.fn(),
  swapMaterialOrder: vi.fn(),
}));

function makeComposition(over: Partial<UnitComposition> = {}): UnitComposition {
  return {
    layer: "teacher",
    unitId: "u1",
    unitTitle: "1회차 Speaking",
    subjectId: "sub1",
    subjectName: "SAT Reading",
    scopeLabel: "내 기본 구성",
    keywords: [{ id: "k1", label: "Speaking" }],
    materials: [
      { curriculumDocId: "d1", title: "자동 교재", position: 1, source: "auto" },
      { curriculumDocId: "d2", title: "직접 담은 교재", position: 2, source: "manual" },
    ],
    subjectKeywords: [
      { id: "k1", label: "Speaking" },
      { id: "k2", label: "Voca" },
    ],
    hasInheritableDefaults: true,
    ...over,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("수업 준비 구성 패널", () => {
  it("무엇을 고치는 중인지 머리말로 밝힌다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} />);
    expect(screen.getByText("내 기본 구성")).toBeInTheDocument();
    expect(screen.getByText("1회차 Speaking")).toBeInTheDocument();
    expect(screen.getByText(/SAT Reading/)).toBeInTheDocument();
  });

  it("학생 계층에서는 '학생 커리큘럼의 기본값' 안내를 쓰지 않는다", () => {
    // 학생 회차를 고치는 것은 그 학생에게만 적용된다 — 기본값이라고 하면 거짓말이다.
    render(
      <CompositionPanel
        composition={makeComposition({ layer: "student", scopeLabel: "테스트 자녀 10-1 학생" })}
        pickable={[]}
      />
    );
    expect(screen.getByText("테스트 자녀 10-1 학생")).toBeInTheDocument();
    expect(screen.queryByText(/기본값이 됩니다/)).not.toBeInTheDocument();
  });

  it("자동으로 들어온 교재와 직접 담은 교재를 구분해 보여준다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} />);
    expect(screen.getByText("키워드에서 자동")).toBeInTheDocument();
    expect(screen.getByText("직접 담음")).toBeInTheDocument();
  });

  it("붙은 키워드와 붙지 않은 키워드를 구분한다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} />);
    expect(screen.getByRole("button", { name: "Speaking" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Voca" })).toHaveAttribute("aria-pressed", "false");
  });

  it("교재를 빼면 층을 함께 넘긴다", async () => {
    vi.mocked(actions.removeMaterial).mockResolvedValue({ ok: true });
    render(<CompositionPanel composition={makeComposition()} pickable={[]} />);

    fireEvent.click(screen.getAllByText("빼기")[0]);
    await waitFor(() =>
      expect(actions.removeMaterial).toHaveBeenCalledWith("teacher", "u1", "d1")
    );
    await waitFor(() => expect(screen.queryByText("자동 교재")).not.toBeInTheDocument());
  });

  it("실패하면 사유를 보여주고 목록을 바꾸지 않는다", async () => {
    vi.mocked(actions.removeMaterial).mockResolvedValue({
      ok: false,
      error: "교재를 빼지 못했습니다.",
    });
    render(<CompositionPanel composition={makeComposition()} pickable={[]} />);

    fireEvent.click(screen.getAllByText("빼기")[0]);
    await waitFor(() => expect(screen.getByText("교재를 빼지 못했습니다.")).toBeInTheDocument());
    expect(screen.getByText("자동 교재")).toBeInTheDocument();
  });

  it("담긴 교재는 다시 담을 수 없게 표시한다", () => {
    render(
      <CompositionPanel
        composition={makeComposition()}
        pickable={[
          { curriculumDocId: "d1", title: "자동 교재", primaryKeywordLabel: "Speaking", picked: true },
          { curriculumDocId: "d9", title: "새 교재", primaryKeywordLabel: null, picked: false },
        ]}
      />
    );
    fireEvent.click(screen.getByText("교재 담기"));
    expect(screen.getByText("담김")).toBeInTheDocument();
    expect(screen.getByText("담기")).toBeInTheDocument();
  });

  it("담긴 교재가 없으면 빈 상태를 말해준다", () => {
    render(
      <CompositionPanel composition={makeComposition({ materials: [] })} pickable={[]} />
    );
    expect(
      screen.getByText("아직 담긴 교재가 없습니다. 키워드를 붙이거나 직접 담아 주세요.")
    ).toBeInTheDocument();
  });
});
