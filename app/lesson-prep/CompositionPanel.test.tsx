import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CompositionPanel from "./CompositionPanel";
import * as actions from "./actions";
import type { UnitComposition } from "@/lib/unit-composition";

vi.mock("@/app/session/[id]/problem-image-actions", () => ({ getProblemImageUrlAction: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./actions", () => ({
  addKeyword: vi.fn(),
  removeKeyword: vi.fn(),
  addMaterial: vi.fn(),
  removeMaterial: vi.fn(),
  swapMaterialOrder: vi.fn(),
  addProblem: vi.fn(),
  removeProblem: vi.fn(),
  inheritDefaults: vi.fn(),
  previewRecomposition: vi.fn(),
  applyRecomposition: vi.fn(),
  listLessonsForUnit: vi.fn(async () => []),
  linkLesson: vi.fn(),
  startLesson: vi.fn(),
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
  composed: true,
  hasUnappliedChanges: false,
  outdatedVersionCount: 0,
  parentPendingCount: 0,
  problems: [],
    goal: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(actions.previewRecomposition).mockResolvedValue({
    ok: true,
    value: {
      materialsAdded: 0, materialsRemoved: 0, problemsAdded: 0, problemsRemoved: 0, problemsAvailable: 0,
      versionsUpdated: 0, inheritedKeywords: 0, inheritedMaterials: 0, inheritedProblems: 0,
      withdrawnKeywords: 0, withdrawnMaterials: 0, withdrawnProblems: 0, reordered: 0,
      orderKeptByChoice: 0, goalUpdated: 0, goalKeptByChoice: 0, fingerprint: "fp",
    },
  });
  vi.mocked(actions.applyRecomposition).mockResolvedValue({ ok: true, value: {} as never });
});

describe("수업 준비 구성 패널", () => {
  it("무엇을 고치는 중인지 머리말로 밝힌다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);
    expect(screen.getByText("내 기본 구성")).toBeInTheDocument();
    expect(screen.getByText("1회차 Speaking")).toBeInTheDocument();
    expect(screen.getByText(/SAT Reading/)).toBeInTheDocument();
  });

  it("자동으로 들어온 교재와 직접 담은 교재를 구분해 보여준다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);
    expect(screen.getByText("키워드에서 자동")).toBeInTheDocument();
    expect(screen.getByText("직접 담음")).toBeInTheDocument();
  });

  it("붙은 키워드와 붙지 않은 키워드를 구분한다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);
    expect(screen.getByRole("button", { name: "Speaking" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Voca" })).toHaveAttribute("aria-pressed", "false");
  });

  // 2026-09-21(제품 오너 지시) — 키워드를 붙이거나 떼면 확인 배너 없이 바로 다시 구성해
  // 반영한다("구성에 반영되지 않은 변경 있음" → 사람이 눌러 확인하던 중간 단계 제거).
  it("이미 구성된 회차에서 키워드를 떼면 곧바로 다시 구성한다", async () => {
    vi.mocked(actions.removeKeyword).mockResolvedValue({ ok: true });
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Speaking" }));
    await waitFor(() => expect(actions.removeKeyword).toHaveBeenCalledWith("teacher", "u1", "k1"));
    await waitFor(() => expect(actions.previewRecomposition).toHaveBeenCalledWith("teacher", "u1"));
    await waitFor(() => expect(actions.applyRecomposition).toHaveBeenCalledWith("teacher", "u1", "fp"));
  });

  it("교재를 빼면 층을 함께 넘긴다", async () => {
    vi.mocked(actions.removeMaterial).mockResolvedValue({ ok: true });
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);

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
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);

    fireEvent.click(screen.getAllByText("빼기")[0]);
    await waitFor(() => expect(screen.getByText("교재를 빼지 못했습니다.")).toBeInTheDocument());
    expect(screen.getByText("자동 교재")).toBeInTheDocument();
  });

  it("담긴 교재는 다시 담을 수 없게 표시한다", () => {
    render(
      <CompositionPanel
        composition={makeComposition()}
        pickable={[
          { curriculumDocId: "d1", title: "자동 교재", primaryKeywordLabel: "Speaking", kind: "html", picked: true },
          { curriculumDocId: "d9", title: "새 교재", primaryKeywordLabel: null, kind: "pdf", picked: false },
        ]}
        problems={[]}
      />
    );
    fireEvent.click(screen.getByText("직접 담기"));
    expect(screen.getByText("담김")).toBeInTheDocument();
    expect(screen.getByText("담기")).toBeInTheDocument();
  });

  it("담긴 교재가 없으면 빈 상태를 말해준다", () => {
    render(
      <CompositionPanel composition={makeComposition({ materials: [] })} pickable={[]} problems={[]} />
    );
    expect(
      screen.getByText("아직 담긴 교재가 없습니다. 키워드를 붙이거나 직접 담아 주세요.")
    ).toBeInTheDocument();
  });

  // 4절 — 관리자·선생님 기본 화면은 문제를 "미리보고", 실제 출제는 학생별 문맥에서
  // 한다. 여기서 고를 수 있게 하면 학생 없이 문제를 확정하는 셈이 된다.
  it("키워드로 들어올 문제를 미리 보여준다", () => {
    render(
      <CompositionPanel
        composition={makeComposition()}
        pickable={[]}
        problems={[
          { problemId: "p1", label: "지문 첫 줄…", difficulty: "medium", format: "mcq" },
          { problemId: "p2", label: "두 번째 문제", difficulty: null, format: "mcq" },
        ]}
      />
    );
    expect(screen.getByText("지문 첫 줄…")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    // 2026-09-13 지시 3번: 세 계층 모두 여기서 담고 뺀다 — 미리보기 전용이 아니다.
    expect(screen.getAllByText("담기").length).toBe(2);
  });

  // 2026-09-14 UAT: "문제를 클릭하면 문제를 볼 수 있어야 될 거 같아 간략하게라도"
  it("문제를 누르면 지문·선택지 미리보기가 펼쳐지고, 다시 누르면 접힌다", () => {
    render(
      <CompositionPanel
        composition={makeComposition()}
        pickable={[]}
        problems={[
          {
            problemId: "p1",
            label: "지문 첫 줄…",
            difficulty: "medium",
            format: "mc",
            preview: { passage: "지문 첫 줄 전체 내용입니다.", options: ["하나", "둘"], figure: null },
          },
          { problemId: "p2", label: "미리보기 없는 문제", difficulty: null, format: "mc" },
        ]}
      />
    );
    expect(screen.queryByTestId("problem-preview")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("지문 첫 줄…"));
    expect(screen.getByText("지문 첫 줄 전체 내용입니다.")).toBeInTheDocument();
    expect(screen.getByText("하나")).toBeInTheDocument();
    expect(screen.getByText("둘")).toBeInTheDocument();
    // 다른 문제를 누르면 그쪽으로 옮겨 간다 — 공개 버전이 없으면 이유를 말한다.
    fireEvent.click(screen.getByText("미리보기 없는 문제"));
    expect(screen.queryByText("지문 첫 줄 전체 내용입니다.")).not.toBeInTheDocument();
    expect(screen.getByText(/미리보기를 보여줄 수 없습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("미리보기 없는 문제"));
    expect(screen.queryByTestId("problem-preview")).not.toBeInTheDocument();
  });

  it("키워드가 없으면 왜 문제가 비었는지 말해준다", () => {
    render(
      <CompositionPanel
        composition={makeComposition({ keywords: [] })}
        pickable={[]}
        problems={[]}
      />
    );
    expect(
      screen.getByText("키워드를 붙이면 해당하는 문제가 여기에 모입니다.")
    ).toBeInTheDocument();
  });

  it("키워드는 있는데 문제가 없으면 다르게 말한다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);
    expect(screen.getByText("더 담을 문제가 없습니다.")).toBeInTheDocument();
  });

  // 지시 1번 — 시작한 수업 안에서 이 패널이 열리면, 보이는 것과 적용 범위가 다르다.
  // 말해주지 않으면 고정된 수업을 여기서 고치는 것처럼 보인다.
  it("적용 범위 안내를 받으면 그대로 보여준다", () => {
    render(
      <CompositionPanel
        composition={makeComposition({ layer: "student" })}
        pickable={[]}
        problems={[]}
        scopeNotice="지난 수업입니다. 이 수업의 교재·문제·필기·답안은 시작 시점으로 고정돼 바뀌지 않습니다."
      />
    );
    expect(
      screen.getByText(/시작 시점으로 고정돼 바뀌지 않습니다/)
    ).toBeInTheDocument();
  });

  it("안내가 없으면 아무 말도 덧붙이지 않는다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);
    expect(screen.queryByText(/고정/)).not.toBeInTheDocument();
  });
});

// 2026-09-21(제품 오너 지시) — 위 계층·버전 변경도 확인 배너 없이 자동으로 맞춘다
// (예전 "기본 구성 업데이트" 미리보기 → 적용 2단계 UI는 제거됨, AutoSync가 조용히 처리).
describe("위 계층·버전 변경 자동 반영", () => {
  it("반영할 변경이 있으면 확인 없이 바로 미리보기+적용을 실행한다", async () => {
    render(
      <CompositionPanel
        composition={makeComposition({ parentPendingCount: 3 })}
        pickable={[]}
        problems={[]}
      />
    );
    await waitFor(() =>
      expect(actions.previewRecomposition).toHaveBeenCalledWith("teacher", "u1")
    );
    await waitFor(() =>
      expect(actions.applyRecomposition).toHaveBeenCalledWith("teacher", "u1", "fp")
    );
  });

  it("반영할 변경이 없으면 아무것도 하지 않는다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);
    expect(actions.previewRecomposition).not.toHaveBeenCalled();
  });
});
