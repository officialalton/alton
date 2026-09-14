import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CompositionPanel from "./CompositionPanel";
import * as actions from "./actions";
import type { UnitComposition } from "@/lib/unit-composition";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("./actions", () => ({
  saveGoal: vi.fn(),
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

beforeEach(() => vi.clearAllMocks());

describe("수업 준비 구성 패널", () => {
  it("무엇을 고치는 중인지 머리말로 밝힌다", () => {
    render(<CompositionPanel composition={makeComposition()} pickable={[]} problems={[]} />);
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
        problems={[]}
      />
    );
    expect(screen.getByText("테스트 자녀 10-1 학생")).toBeInTheDocument();
    expect(screen.queryByText(/기본값이 됩니다/)).not.toBeInTheDocument();
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
          { curriculumDocId: "d1", title: "자동 교재", primaryKeywordLabel: "Speaking", picked: true },
          { curriculumDocId: "d9", title: "새 교재", primaryKeywordLabel: null, picked: false },
        ]}
        problems={[]}
      />
    );
    fireEvent.click(screen.getByText("교재 담기"));
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
    expect(screen.getByText(/아래 계층의 기본값이 됩니다/)).toBeInTheDocument();
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

  // 지시 3번 — 의도적으로 비운 목표와 아직 상속되지 않은 목표는 다르다.
  it("아직 정해지지 않은 목표와 일부러 비운 목표를 다르게 안내한다", () => {
    const { unmount } = render(
      <CompositionPanel composition={makeComposition({ goal: null })} pickable={[]} problems={[]} />
    );
    expect(screen.getByPlaceholderText("아직 정해지지 않았습니다")).toBeInTheDocument();
    unmount();

    render(
      <CompositionPanel composition={makeComposition({ goal: "" })} pickable={[]} problems={[]} />
    );
    expect(screen.getByPlaceholderText("비워 두면 목표 없이 진행합니다")).toBeInTheDocument();
  });

  it("목표를 고치면 층과 함께 저장한다", async () => {
    vi.mocked(actions.saveGoal).mockResolvedValue({ ok: true });
    render(
      <CompositionPanel
        composition={makeComposition({ goal: "이전 목표" })}
        pickable={[]}
        problems={[]}
      />
    );
    const box = screen.getByDisplayValue("이전 목표");
    fireEvent.blur(box, { target: { value: "새 목표" } });
    await waitFor(() => expect(actions.saveGoal).toHaveBeenCalledWith("teacher", "u1", "새 목표"));
  });

  it("바뀌지 않았으면 저장하지 않는다", async () => {
    vi.mocked(actions.saveGoal).mockResolvedValue({ ok: true });
    render(
      <CompositionPanel
        composition={makeComposition({ goal: "그대로" })}
        pickable={[]}
        problems={[]}
      />
    );
    fireEvent.blur(screen.getByDisplayValue("그대로"), { target: { value: "그대로" } });
    await waitFor(() => expect(actions.saveGoal).not.toHaveBeenCalled());
  });

  it("학생 층에서는 목표 안내가 다르다", () => {
    render(
      <CompositionPanel
        composition={makeComposition({ layer: "student" })}
        pickable={[]}
        problems={[]}
      />
    );
    expect(screen.getByText(/이 학생의 이번 회차에서 달성할 것입니다/)).toBeInTheDocument();
  });
});

// P2 12차 — '기본 구성 업데이트'가 상위에서 빠진 것·순서·목표까지 보여준다.
describe("기본 구성 업데이트 미리보기", () => {
  const summary = {
    materialsAdded: 0,
    materialsRemoved: 0,
    problemsAdded: 0,
    problemsRemoved: 0,
    problemsAvailable: 3,
    versionsUpdated: 0,
    inheritedKeywords: 0,
    inheritedMaterials: 1,
    inheritedProblems: 0,
    withdrawnKeywords: 0,
    withdrawnMaterials: 2,
    withdrawnProblems: 1,
    reordered: 2,
    orderKeptByChoice: 1,
    goalUpdated: 0,
    goalKeptByChoice: 1,
    fingerprint: "fp",
  };

  it("빠질 것·순서·목표를 숫자와 말로 보여주고, 사람이 한 일은 그대로 둔다고 밝힌다", async () => {
    vi.mocked(actions.previewRecomposition).mockResolvedValue({ ok: true, value: summary });
    render(
      <CompositionPanel
        composition={makeComposition({ parentPendingCount: 3 })}
        pickable={[]}
        problems={[]}
      />
    );
    expect(screen.getByText(/위 계층과 어긋난 항목이 3개/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "기본 구성 업데이트" }));
    await waitFor(() =>
      expect(actions.previewRecomposition).toHaveBeenCalledWith("teacher", "u1")
    );

    expect(screen.getByText(/빠져 함께 빠질 것 — 키워드 0개 · 교재 2개 · 문제 1개/)).toBeInTheDocument();
    expect(screen.getByText(/자리가 바뀔 항목 — 2개/)).toBeInTheDocument();
    expect(screen.getByText(/직접 맞춘 순서는 그대로 둡니다/)).toBeInTheDocument();
    expect(screen.getByText(/직접 고친 목표를 그대로 둡니다/)).toBeInTheDocument();
  });

  it("적용은 미리 본 지문을 그대로 들고 간다", async () => {
    vi.mocked(actions.previewRecomposition).mockResolvedValue({ ok: true, value: summary });
    vi.mocked(actions.applyRecomposition).mockResolvedValue({ ok: true, value: summary });
    render(
      <CompositionPanel
        composition={makeComposition({ parentPendingCount: 1 })}
        pickable={[]}
        problems={[]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "기본 구성 업데이트" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "적용" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    await waitFor(() =>
      expect(actions.applyRecomposition).toHaveBeenCalledWith("teacher", "u1", "fp")
    );
  });
});
