import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProblemBankTab from "./ProblemBankTab";
import type { AdminSubject } from "./subject-data";

// P2 8차 — 문제은행 화면.
//
// 2026-09-13 제품 오너 지시로 흐름이 바뀌었다: 관리자가 자기 자신에게 "검수 요청"을
// 누르는 단계는 없애고, **초안 저장 → 미리보기·내용 확인 → 공개**로 정리했다.
// 내용을 보지 않고 공개되는 길은 여전히 없다.

vi.mock("./problem-bank-actions", () => ({
  listBankProblemsAction: (...a: unknown[]) => listBankProblemsAction(...a),
  createBankProblemAction: (...a: unknown[]) => createBankProblemAction(...a),
  createDraftVersionAction: (...a: unknown[]) => createDraftVersionAction(...a),
  createDraftFromPublishedAction: (...a: unknown[]) => createDraftFromPublishedAction(...a),
  publishDraftAction: (...a: unknown[]) => publishDraftAction(...a),
  markFigureCheckedAction: (...a: unknown[]) => markFigureCheckedAction(...a),
  uploadProblemImageAction: (...a: unknown[]) => uploadProblemImageAction(...a),
  generateFigureForProblemAction: (...a: unknown[]) => generateFigureForProblemAction(...a),
  setProblemArchivedAction: (...a: unknown[]) => setProblemArchivedAction(...a),
  setProblemKeywordAction: (...a: unknown[]) => setProblemKeywordAction(...a),
  updateProblemMetaAction: (...a: unknown[]) => updateProblemMetaAction(...a),
  generateBankProblemsAction: (...a: unknown[]) => generateBankProblemsAction(...a),
  problemQuestionAuditAction: (...a: unknown[]) => problemQuestionAuditAction(...a),
  reassignProblemSubjectAction: (...a: unknown[]) => reassignProblemSubjectAction(...a),
}));

const listBankProblemsAction = vi.fn();
const createBankProblemAction = vi.fn();
const createDraftVersionAction = vi.fn();
const createDraftFromPublishedAction = vi.fn();
const publishDraftAction = vi.fn();
const markFigureCheckedAction = vi.fn(async (..._a: unknown[]) => ({ ok: true }));
const generateFigureForProblemAction = vi.fn(async (..._a: unknown[]) => ({
  ok: true,
  value: { type: "plane", axes: { x: { min: -2, max: 8 }, y: { min: -2, max: 8 } }, objects: [{ id: "A", kind: "point", at: [1, 3], label: "A" }] },
}));
const uploadProblemImageAction = vi.fn(async (..._a: unknown[]) => ({ ok: true, value: { type: "image", bucket: "problem-assets", path: "p1/abc.png", alt: "fig" } }));
const setProblemArchivedAction = vi.fn();
const setProblemKeywordAction = vi.fn();
const updateProblemMetaAction = vi.fn();
const generateBankProblemsAction = vi.fn();
const problemQuestionAuditAction = vi.fn(async (..._a: unknown[]) => ({ ok: true, value: { withQuestion: 1, draftWithout: 0, publishedWithout: 0 } }));
const reassignProblemSubjectAction = vi.fn();

const subjects: AdminSubject[] = [
  {
    subjectId: "sub1",
    subjectName: "SAT Math",
    units: [],
    keywords: [
      { id: "kw1", label: "이차방정식", status: "active" },
      { id: "kw2", label: "판별식", status: "active" },
    ],
  },
  { subjectId: "sub2", subjectName: "SAT R&W", units: [] },
  { subjectId: "sub9", subjectName: "보관 과목", units: [], archivedAt: "2026-09-11T00:00:00Z" },
];

const base = {
  id: "p1",
  format: "mc",
  passage: null,
  skillType: "Words in Context",
  topic: "생태계",
  difficulty: "medium",
  subjectId: "sub1",
  subjectName: "SAT Math",
  archived: false,
  updatedAt: "2026-09-12T00:00:00Z",
  readiness: "ok" as const,
  createdVia: "manual" as const,
};

const draftProblem = {
  ...base,
  workState: "draft" as const,
  keywords: [{ id: "kw1", label: "이차방정식" }],
  published: null,
  draft: {
    versionId: "v1",
    passage: "판별식이 0일 때",
    options: ["가", "나", "다", "라"],
    correctIndex: 1,
    explanation: "중근입니다",
  },
};

const publishedProblem = {
  ...base,
  workState: "published" as const,
  keywords: [{ id: "kw1", label: "이차방정식" }],
  published: {
    versionId: "pv1",
    passage: "공개된 지문입니다",
    options: ["하나", "둘", "셋", "넷"],
    correctIndex: 2,
    explanation: "공개된 해설입니다",
  },
  draft: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  listBankProblemsAction.mockResolvedValue([draftProblem]);
  createBankProblemAction.mockResolvedValue({ ok: true, value: "p2" });
  createDraftVersionAction.mockResolvedValue({ ok: true, value: { versionId: "v2", answerFixed: false } });
  createDraftFromPublishedAction.mockResolvedValue({
    ok: true,
    value: { versionId: "v9", reused: false },
  });
  publishDraftAction.mockResolvedValue({ ok: true });
  setProblemArchivedAction.mockResolvedValue({ ok: true });
  setProblemKeywordAction.mockResolvedValue({ ok: true });
  updateProblemMetaAction.mockResolvedValue({ ok: true });
  generateBankProblemsAction.mockResolvedValue({ ok: true, value: { created: 3, failures: [], requested: 3, shortfall: 0, stoppedReason: "target_met" } });
  reassignProblemSubjectAction.mockResolvedValue({ ok: true, value: { subjectId: "sub2", subjectName: "SAT R&W" } });
});

/** 공개 탭으로 옮겨 첫 문제를 편다. 공개된 문제는 생성 탭에 없다. */
async function openPublishedProblem() {
  render(<ProblemBankTab subjects={subjects} />);
  await waitFor(() => expect(screen.getByText("공개")).toBeInTheDocument());
  fireEvent.click(screen.getByText("공개"));
  await waitFor(() => expect(screen.getByText("공개된 지문입니다")).toBeInTheDocument());
  fireEvent.click(screen.getByText("공개된 지문입니다"));
}

async function openFirstProblem() {
  render(<ProblemBankTab subjects={subjects} />);
  await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
  fireEvent.click(screen.getByText("판별식이 0일 때"));
  await waitFor(() => expect(screen.getByLabelText("지문 / 자료")).toBeInTheDocument());
}

describe("탭 재구성(2026-09-17) — 생성/검수/공개/보관, 필터 단순화", () => {
  it("탭은 생성·검수·공개·보관 순서이고, '검수 대기'라는 이름은 더 없다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("검수")).toBeInTheDocument());
    const labels = ["생성", "검수", "공개", "보관"];
    const order = screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .filter((t): t is string => !!t && labels.includes(t));
    expect(order).toEqual(labels);
    expect(screen.queryByText("검수 대기")).not.toBeInTheDocument();
  });

  it("검수·공개·보관 탭에는 생성 폼이 없고 필터+목록만 있다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    expect(screen.queryByTestId("new-problem-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("공개"));
    await waitFor(() => expect(screen.queryByTestId("new-problem-panel")).not.toBeInTheDocument());

    fireEvent.click(screen.getByText("보관"));
    await waitFor(() => expect(screen.queryByTestId("new-problem-panel")).not.toBeInTheDocument());
  });

  it("형식·난이도 필터는 드롭다운이 아니라 버튼 그룹이다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByRole("group", { name: "형식" })).toBeInTheDocument());
    expect(screen.getByRole("group", { name: "난이도 필터" })).toBeInTheDocument();
    const hardButton = screen.getByRole("button", { name: "Hard" });
    fireEvent.click(hardButton);
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ difficulty: "hard" }))
    );
  });

  // 2026-09-18 버그 수정 — 검수 탭에서 필터를 연달아 두 번 바꾸면 먼저 보낸 요청의
  // 응답이 나중 요청보다 늦게 도착할 수 있다(느린 네트워크·DB 부하). 그 경우 이전엔
  // 도착 순서와 무관하게 "가장 나중에 도착한 응답"이 화면을 덮어써, 이미 지나간 첫
  // 번째 필터의 결과가 두 번째(최신) 필터를 선택했는데도 그대로 남아 있었다(전체
  // 새로고침 없이는 고쳐지지 않았다). 응답에 순번을 매겨 오래된 응답을 버리도록
  // 고쳤다 — 이 테스트는 일부러 첫 요청 응답을 두 번째 요청 응답보다 늦게
  // resolve시켜 그 회귀를 잡는다.
  it("필터를 연달아 두 번 바꾸면, 첫 번째 요청 응답이 두 번째보다 늦게 와도 화면은 두 번째(최신) 필터의 결과를 보여준다", async () => {
    const firstFilterResult = { ...draftProblem, draft: { ...draftProblem.draft, passage: "첫 번째 필터 결과 문항" } };
    const secondFilterResult = { ...draftProblem, draft: { ...draftProblem.draft, passage: "두 번째 필터 결과 문항" } };

    let resolveFirst!: (v: (typeof draftProblem)[]) => void;
    const firstCallPromise = new Promise<(typeof draftProblem)[]>((resolve) => {
      resolveFirst = resolve;
    });

    // 초기 마운트 로딩은 즉시 끝내고, 이후 필터 변경 두 번만 응답 순서를 통제한다.
    listBankProblemsAction.mockResolvedValueOnce([draftProblem]);
    listBankProblemsAction.mockImplementationOnce(() => firstCallPromise);
    listBankProblemsAction.mockResolvedValueOnce([secondFilterResult]);

    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());

    // 첫 번째 필터 변경 — 아직 응답하지 않는다(firstCallPromise가 나중에 resolve됨).
    fireEvent.change(screen.getByLabelText("세부 기술"), { target: { value: "words_in_context" } });
    // 두 번째 필터 변경 — 먼저 응답한다.
    fireEvent.change(screen.getByLabelText("세부 기술"), { target: { value: "linear_functions" } });

    await waitFor(() => expect(screen.getByText("두 번째 필터 결과 문항")).toBeInTheDocument());

    // 이제 첫 번째(오래된) 요청이 뒤늦게 응답한다 — 화면을 덮어쓰면 안 된다.
    resolveFirst([firstFilterResult]);
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText("두 번째 필터 결과 문항")).toBeInTheDocument();
    expect(screen.queryByText("첫 번째 필터 결과 문항")).not.toBeInTheDocument();
  });

  it("삭제 대상이던 설명 문단 4개는 더 이상 렌더되지 않는다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    expect(screen.queryByText(/관리 과목은 문제를 보관하고/)).not.toBeInTheDocument();
    expect(screen.queryByText(/문제를 보관하고 키워드·커리큘럼·자동 구성에 연결하는 라이브러리 단위입니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(/영역 → 세부 기술을 고르면 유형·답안 형식·자료 판정이 따라옵니다\./)).not.toBeInTheDocument();
    expect(screen.queryByText(/어느 쪽으로 만들든 초안으로 들어갑니다/)).not.toBeInTheDocument();
  });
});

describe("목록 — 검수 · 공개 · 보관", () => {
  it("기본은 검수이고, 보관은 서버에서 따로 불러온다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(
        expect.objectContaining({ archived: undefined })
      )
    );

    fireEvent.click(screen.getByText("보관"));
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(
        expect.objectContaining({ archived: true })
      )
    );
  });

  it("공개 탭에는 공개된 문제만 남는다", async () => {
    listBankProblemsAction.mockResolvedValue([draftProblem, publishedProblem]);
    render(<ProblemBankTab subjects={subjects} />);
    // 생성 탭에는 작업 중인 것만.
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    expect(screen.queryByText("공개된 지문입니다")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("공개"));
    await waitFor(() => expect(screen.getByText("공개된 지문입니다")).toBeInTheDocument());
    expect(screen.queryByText("판별식이 0일 때")).not.toBeInTheDocument();
  });

  it("과목·형식·키워드로 좁힌다. 키워드는 과목을 고른 뒤에 고른다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());

    expect(screen.getByLabelText("키워드")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("과목"), { target: { value: "sub1" } });
    await waitFor(() => expect(screen.getByLabelText("키워드")).not.toBeDisabled());
    expect(screen.getByRole("option", { name: "이차방정식" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("키워드"), { target: { value: "kw2" } });
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(
        expect.objectContaining({ subjectId: "sub1", keywordId: "kw2" })
      )
    );
  });

  it("텍스트 검색 입력은 더 이상 없다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    expect(screen.queryByLabelText("문제 검색")).not.toBeInTheDocument();
  });

  it("새 문제 상자는 생성 탭에만 있고, 검수·공개 탭에는 필터만 있다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    // 기본은 검수 탭 — 필터+목록만 있고 생성 상자는 없다.
    await waitFor(() => expect(screen.getByLabelText("과목")).toBeInTheDocument());
    expect(screen.queryByLabelText("새 문제 과목")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    expect(screen.queryByLabelText("과목")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("공개"));
    await waitFor(() =>
      expect(screen.queryByLabelText("새 문제 과목")).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText("과목")).toBeInTheDocument();
  });

  it("보관 과목은 새 문제 대상으로 고를 수 없다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    expect(screen.getByLabelText("새 문제 과목").querySelectorAll("option")).toHaveLength(3);
    expect(screen.queryByRole("option", { name: "보관 과목" })).not.toBeInTheDocument();
  });
});

describe("유형과 주제는 별도 항목이다", () => {
  it("유형은 세부 기술을 고르면 내부적으로 자동 채워지고(화면에는 입력칸이 없다), 주제는 따로 받는다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());

    // '유형' 입력칸은 화면에 없다 — 세부 기술 선택이 자동으로 채운다.
    expect(screen.queryByLabelText("문제 유형")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("SAT 영역"), { target: { value: "rw_craft_structure" } });
    fireEvent.change(screen.getByLabelText("세부 기술"), { target: { value: "words_in_context" } });
    fireEvent.change(screen.getByLabelText("주제"), { target: { value: "생태계" } });
    fireEvent.click(screen.getByText("직접 생성"));

    await waitFor(() =>
      expect(createBankProblemAction).toHaveBeenCalledWith(
        expect.objectContaining({ skillType: "Words in Context", topic: "생태계" })
      )
    );
  });

  it("만들 때 키워드도 함께 고를 수 있다 — 선택 항목이다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());

    // 과목을 고르기 전에는 고를 키워드가 없다.
    expect(screen.queryByRole("button", { name: "판별식" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "판별식" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "판별식" }));
    fireEvent.click(screen.getByText("직접 생성"));

    await waitFor(() =>
      expect(createBankProblemAction).toHaveBeenCalledWith(
        expect.objectContaining({ keywordIds: ["kw2"] })
      )
    );
  });

  it("키워드를 고르지 않아도 만들 수 있다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.click(screen.getByText("직접 생성"));

    await waitFor(() =>
      expect(createBankProblemAction).toHaveBeenCalledWith(
        expect.objectContaining({ keywordIds: undefined })
      )
    );
  });

  it("이미 만든 문제에서도 유형·주제를 고칠 수 있다", async () => {
    await openFirstProblem();
    fireEvent.change(screen.getByLabelText("주제 수정"), { target: { value: "기후" } });
    fireEvent.click(screen.getByText("저장"));
    await waitFor(() =>
      expect(updateProblemMetaAction).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ topic: "기후" })
      )
    );
  });
});

describe("객관식은 4칸과 정답 라디오다", () => {
  it("칸 네 개가 나오고 기존 초안 내용이 채워진다", async () => {
    await openFirstProblem();
    expect(screen.getByLabelText("선택지 1")).toHaveValue("가");
    expect(screen.getByLabelText("선택지 4")).toHaveValue("라");
    expect(screen.queryByLabelText("선택지 5")).not.toBeInTheDocument();
    // 정답은 하나만 체크된다.
    expect(screen.getByLabelText("2번이 정답")).toBeChecked();
    expect(screen.getByLabelText("1번이 정답")).not.toBeChecked();
  });

  it("화면의 1부터를 0부터로 바꿔 저장한다", async () => {
    await openFirstProblem();
    fireEvent.click(screen.getByLabelText("3번이 정답"));
    fireEvent.click(screen.getByText("초안 저장"));
    await waitFor(() =>
      expect(createDraftVersionAction).toHaveBeenCalledWith(
        expect.objectContaining({ correctIndex: 2, options: ["가", "나", "다", "라"] })
      )
    );
  });

  it("선택지가 4개가 아닌 기존 문제는 잘라내지 않고 그대로 보여준다", async () => {
    listBankProblemsAction.mockResolvedValue([
      {
        ...draftProblem,
        draft: { ...draftProblem.draft, options: ["가", "나", "다", "라", "마"] },
      },
    ]);
    await openFirstProblem();
    expect(screen.getByLabelText("선택지 5")).toHaveValue("마");
    expect(screen.getByText(/선택지가 5개입니다/)).toBeInTheDocument();
  });
});

describe("공개는 내용을 본 뒤에만 — 검수 요청 단계는 없다", () => {
  it("초안 화면에 검수 요청 버튼이 없다", async () => {
    await openFirstProblem();
    expect(screen.queryByText("검수 요청")).not.toBeInTheDocument();
  });

  it("편집 화면에 지문·선택지·정답·해설이 그대로 있고, 공개는 저장한 버전을 공개한다", async () => {
    await openFirstProblem();
    expect(screen.getByLabelText("지문 / 자료")).toHaveValue("판별식이 0일 때");
    expect(screen.getByLabelText("선택지 2")).toHaveValue("나");
    expect(screen.getByLabelText("2번이 정답")).toBeChecked();
    expect(screen.getByLabelText("해설")).toHaveValue("중근입니다");

    fireEvent.click(screen.getByText("공개하기"));
    // 화면에 있는 것을 먼저 저장하고, **저장이 돌려준 버전**을 공개한다.
    await waitFor(() => expect(createDraftVersionAction).toHaveBeenCalled());
    await waitFor(() => expect(publishDraftAction).toHaveBeenCalledWith("v2"));
  });

  it("AI로 만들어도 초안으로만 들어간다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("SAT 영역"), { target: { value: "rw_craft_structure" } });
    fireEvent.change(screen.getByLabelText("세부 기술"), { target: { value: "words_in_context" } });
    fireEvent.click(screen.getByText("AI 생성"));

    await waitFor(() =>
      expect(screen.getByText(/자동 통과 3\/3/)).toBeInTheDocument()
    );
    expect(publishDraftAction).not.toHaveBeenCalled();
  });

  it("실패 사유를 화면에 보여준다", async () => {
    publishDraftAction.mockResolvedValue({ ok: false, error: "공개하지 못했습니다." });
    await openFirstProblem();
    fireEvent.click(screen.getByText("공개하기"));
    await waitFor(() =>
      expect(screen.getByText("공개하지 못했습니다.")).toBeInTheDocument()
    );
  });
});

describe("공개본 조회와 수정 초안", () => {
  it("공개된 문제의 현재 내용을 볼 수 있다", async () => {
    listBankProblemsAction.mockResolvedValue([publishedProblem]);
    await openPublishedProblem();

    await waitFor(() => expect(screen.getByText("지금 공개된 내용")).toBeInTheDocument());
    // 선택지는 수식 렌더(LearningText)라 글자가 나뉜다 — 정답 표시가 붙은 항목을 본다.
    const correct = screen.getByText("셋").closest("li");
    expect(correct).toHaveTextContent("정답");
    expect(screen.getByText(/공개된 해설입니다/)).toBeInTheDocument();
  });

  it("수정 초안을 만들면 공개본은 그대로 둔다고 알려준다", async () => {
    listBankProblemsAction.mockResolvedValue([publishedProblem]);
    await openPublishedProblem();
    await waitFor(() => expect(screen.getByText("수정 초안 만들기")).toBeInTheDocument());

    fireEvent.click(screen.getByText("수정 초안 만들기"));
    await waitFor(() => expect(createDraftFromPublishedAction).toHaveBeenCalledWith("p1"));
    await waitFor(() =>
      expect(screen.getByText(/공개본을 복사해 수정 초안을 만들었습니다/)).toBeInTheDocument()
    );
  });

  it("이미 초안이 있으면 새로 만들지 않고 이어서 편집하라고 알린다", async () => {
    listBankProblemsAction.mockResolvedValue([
      { ...publishedProblem, draft: { ...draftProblem.draft, versionId: "v7" } },
    ]);
    createDraftFromPublishedAction.mockResolvedValue({
      ok: true,
      value: { versionId: "v7", reused: true },
    });
    await openPublishedProblem();

    await waitFor(() => expect(screen.getByText("수정 초안 이어서 편집")).toBeInTheDocument());
    fireEvent.click(screen.getByText("수정 초안 이어서 편집"));
    await waitFor(() =>
      expect(screen.getByText(/이미 작업 중인 수정 초안이 있어/)).toBeInTheDocument()
    );
  });
});

describe("키워드 — 공개는 막지 않되 사유는 알린다", () => {
  it("과목 키워드를 눌러 붙이고 뗀다", async () => {
    await openFirstProblem();
    fireEvent.click(screen.getByRole("button", { name: "판별식" }));
    await waitFor(() =>
      expect(setProblemKeywordAction).toHaveBeenCalledWith("p1", "kw2", true)
    );

    fireEvent.click(screen.getByRole("button", { name: "이차방정식" }));
    await waitFor(() =>
      expect(setProblemKeywordAction).toHaveBeenCalledWith("p1", "kw1", false)
    );
  });

  it("키워드가 없으면 공개 전에 자동 구성에서 빠진다고 안내한다", async () => {
    listBankProblemsAction.mockResolvedValue([
      { ...draftProblem, keywords: [], readiness: "no_keyword" as const },
    ]);
    await openFirstProblem();
    expect(screen.getByText(/키워드 없이도 저장하고 공개할 수 있습니다/)).toBeInTheDocument();
    expect(
      screen.getByText("키워드가 없어 자동 구성에는 포함되지 않습니다. 공개는 됩니다.")
    ).toBeInTheDocument();
  });

  it("공개된 뒤에도 목록에서 사유를 보고 키워드를 붙일 수 있다", async () => {
    listBankProblemsAction.mockResolvedValue([
      { ...publishedProblem, keywords: [], readiness: "no_keyword" as const },
    ]);
    await openPublishedProblem();
    expect(
      screen.getByText("키워드가 없어 자동 구성에 포함되지 않습니다. 키워드는 아래에서 붙일 수 있습니다.")
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "이차방정식" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "이차방정식" }));
    await waitFor(() =>
      expect(setProblemKeywordAction).toHaveBeenCalledWith("p1", "kw1", true)
    );
  });
});

describe("보관은 삭제가 아니다", () => {
  it("보관하면 과거 기록이 남는다고 알린다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("보관하기")).toBeInTheDocument());
    fireEvent.click(screen.getByText("보관하기"));
    await waitFor(() =>
      expect(screen.getByText(/보관했습니다. 과거 기록은 그대로 남습니다./)).toBeInTheDocument()
    );
  });

  it("난이도를 골라 만들면 AI 생성에 그 난이도가 간다(2026-09-14)", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("SAT 영역"), { target: { value: "rw_craft_structure" } });
    fireEvent.change(screen.getByLabelText("세부 기술"), { target: { value: "words_in_context" } });
    fireEvent.change(screen.getByLabelText("난이도"), { target: { value: "hard" } });
    fireEvent.click(screen.getByText("AI 생성"));
    await waitFor(() =>
      expect(generateBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ difficulty: "hard" }))
    );
  });

  it("검수 탭에서 '전체 공개'는 보이는 초안을 모두 공개하고 결과를 알린다(2026-09-14)", async () => {
    window.confirm = vi.fn(() => true);
    publishDraftAction.mockResolvedValue({ ok: true });
    render(<ProblemBankTab subjects={subjects} />);
    const button = await screen.findByRole("button", { name: /전체 공개 \(1\)/ });
    fireEvent.click(button);
    await waitFor(() => expect(publishDraftAction).toHaveBeenCalledWith("v1"));
    await waitFor(() => expect(screen.getByText(/1개를 공개했습니다/)).toBeInTheDocument());
  });

  it("전체 공개 확인을 취소하면 아무것도 공개하지 않는다", async () => {
    window.confirm = vi.fn(() => false);
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(await screen.findByRole("button", { name: /전체 공개/ }));
    expect(publishDraftAction).not.toHaveBeenCalled();
  });

  it("그림 데이터를 적으면 미리보기가 그려지고, 틀리면 사유가 보인다(2026-09-14 ③, 2026-09-15: 확인 체크 없이 미리보기가 항상 뜬다)", async () => {
    await openFirstProblem();
    const box = screen.getByLabelText("그림 데이터");
    fireEvent.change(box, { target: { value: '{"type":"plane","axes":{"x":{"min":-2,"max":8},"y":{"min":-2,"max":8}},"objects":[{"id":"A","kind":"point","at":[1,3],"label":"A"}]}' } });
    expect(screen.getAllByTestId("problem-figure").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("그림 확인함")).not.toBeInTheDocument();
    fireEvent.change(box, { target: { value: '{"type":"geometry","shapes":[]}' } });
    expect(screen.getByText(/자료 데이터 오류|그림 데이터 오류/)).toBeInTheDocument();
  });

  it("문항 체계 탭에서 세부 기술을 고르면 자료 판정이 보이고, 그 판정이 AI 생성의 그림 요구가 된다(2026-09-14 재구성)", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "SAT Math" }));
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    // 생성 탭에는 필터 줄이 없다 — 새 문제 줄의 라벨이 하나뿐이다.
    fireEvent.change(screen.getByLabelText("SAT 영역"), { target: { value: "geometry_trig" } });
    fireEvent.change(screen.getByLabelText("세부 기술"), { target: { value: "lines_angles_triangles" } });
    expect(screen.getByTestId("new-material-need")).toHaveAttribute("data-level", "required");
    expect(screen.getByTestId("new-material-need")).toHaveTextContent(/도형/);
    // 관리자가 고르는 '그림' 선택은 없다.
    expect(screen.queryByLabelText("그림")).toBeNull();
    fireEvent.click(screen.getByText("AI 생성"));
    await waitFor(() =>
      expect(generateBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ figurePolicy: "require_geometry", examSystem: "sat_math", skillCode: "lines_angles_triangles" }))
    );
  });

  it("자료 권장이면 생성 전에 '자료 포함 / 텍스트형'을 고르고, 그 선택이 그림 요구로 들어간다(기본은 자료 포함)", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "SAT Math" }));
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("SAT 영역"), { target: { value: "algebra" } });
    fireEvent.change(screen.getByLabelText("세부 기술"), { target: { value: "linear_equations_two_var" } });
    expect(screen.getByTestId("new-material-need")).toHaveAttribute("data-level", "recommended");
    expect(screen.getByTestId("new-material-need")).toHaveAttribute("data-choice", "with");
    fireEvent.click(screen.getByText("AI 생성"));
    await waitFor(() => expect(generateBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ figurePolicy: "require_plane" })));
    fireEvent.click(screen.getByLabelText(/^텍스트형/));
    expect(screen.getByTestId("new-material-need")).toHaveAttribute("data-choice", "text");
    fireEvent.click(screen.getByText("AI 생성"));
    await waitFor(() => expect(generateBankProblemsAction).toHaveBeenLastCalledWith(expect.objectContaining({ figurePolicy: "none" })));
    // 자료 유형이 둘 이상인 기술(Linear functions: 좌표평면 / 함수표)은 유형까지 고른다.
    fireEvent.change(screen.getByLabelText("세부 기술"), { target: { value: "linear_functions" } });
    expect(screen.getByTestId("new-material-need")).toHaveAttribute("data-kind", "plane");
    fireEvent.click(screen.getByLabelText(/자료 포함 · 표·그래프/));
    expect(screen.getByTestId("new-material-need")).toHaveAttribute("data-kind", "data");
    fireEvent.click(screen.getByText("AI 생성"));
    await waitFor(() => expect(generateBankProblemsAction).toHaveBeenLastCalledWith(expect.objectContaining({ figurePolicy: "require_data" })));
  });

  it("R&W 탭은 답안 형식이 객관식으로 고정되고 Math 전용 항목이 없다; AP 탭은 과목을 고르면 '준비 중'만 보인다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    fireEvent.click(screen.getByText("생성"));
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "SAT Reading & Writing" }));
    expect(screen.getByLabelText("새 문제 형식")).toHaveTextContent("객관식");
    expect(screen.queryByLabelText("그림")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "AP" }));
    fireEvent.change(screen.getByLabelText("AP 과목"), { target: { value: "ap_calculus_ab" } });
    expect(screen.getByTestId("ap-pending-note")).toHaveTextContent("준비 중");
    expect(screen.queryByText("AI 생성")).toBeNull();
  });

  it("초안에서 'AI로 좌표평면 데이터 만들기'를 누르면 그림 칸이 채워지고 미리보기가 뜬다", async () => {
    await openFirstProblem();
    fireEvent.click(screen.getByRole("button", { name: "AI로 좌표평면 데이터 만들기" }));
    await waitFor(() => expect(generateFigureForProblemAction).toHaveBeenCalledWith(expect.objectContaining({ kind: "plane" })));
    await waitFor(() => expect(screen.getAllByTestId("problem-figure").length).toBeGreaterThan(0));
    expect((screen.getByLabelText("그림 데이터") as HTMLTextAreaElement).value).toContain('"plane"');
  });

  it("지문에 표·수식이 있으면 편집 칸 아래에 학생 화면과 같은 미리보기(표 렌더)가 붙는다", async () => {
    await openFirstProblem();
    fireEvent.change(screen.getByLabelText("지문 / 자료"), { target: { value: "Data:\n| Shift | Defective |\n|---|---|\n| 1 | 6 |\nQ?" } });
    const preview = screen.getByTestId("passage-preview");
    expect(preview.querySelector("table")).not.toBeNull();
    expect(preview).toHaveTextContent("Defective");
  });
});

describe("자동 생성(AI·계산형 컴파일러) 문항 — 읽기 전용 검수", () => {
  const autoDraft = {
    ...draftProblem,
    createdVia: "compiler" as const,
  };

  it("지문·질문·선택지·정답·해설 편집 칸이 없고, 공개하기/보관하기만 있다", async () => {
    listBankProblemsAction.mockResolvedValue([autoDraft]);
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    fireEvent.click(screen.getByText("판별식이 0일 때"));

    // 편집 칸(지문 / 자료 textbox)은 없다 — 읽기 전용 뷰만 있다.
    await waitFor(() => expect(screen.getByText("학생용 미리보기 · 선생님용 정보(정답·해설) — 읽기 전용")).toBeInTheDocument());
    expect(screen.queryByLabelText("지문 / 자료")).toBeNull();
    expect(screen.queryByLabelText("세부 기술 수정")).toBeNull();
    expect(screen.queryByLabelText("난이도 수정")).toBeNull();

    // 행동은 공개하기/보관하기 둘뿐이다.
    expect(screen.getByText("공개하기")).toBeInTheDocument();
    expect(screen.getByText("보관하기")).toBeInTheDocument();
  });

  it("공개하기를 누르면 publishDraftAction이 그 문항의 초안 버전으로 호출된다", async () => {
    listBankProblemsAction.mockResolvedValue([autoDraft]);
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    fireEvent.click(screen.getByText("판별식이 0일 때"));
    await waitFor(() => expect(screen.getByText("공개하기")).toBeInTheDocument());
    fireEvent.click(screen.getByText("공개하기"));
    await waitFor(() => expect(publishDraftAction).toHaveBeenCalledWith("v1"));
  });

  it("키워드는 자동 생성 문항에서도 여전히 바꿀 수 있다", async () => {
    listBankProblemsAction.mockResolvedValue([autoDraft]);
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    fireEvent.click(screen.getByText("판별식이 0일 때"));
    await waitFor(() => expect(screen.getByRole("button", { name: "판별식" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "판별식" }));
    await waitFor(() => expect(setProblemKeywordAction).toHaveBeenCalledWith("p1", "kw2", true));
  });

  it("manual 문항은 그대로 기존 편집기가 보인다(회귀 확인)", async () => {
    await openFirstProblem();
    expect(screen.getByLabelText("지문 / 자료")).toBeInTheDocument();
  });
});

describe("과목 재배정", () => {
  it("활성 과목만 선택지에 뜨고 보관 과목은 빠진다", async () => {
    await openFirstProblem();
    const select = screen.getByLabelText("문제 과목") as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toContain("SAT Math");
    expect(optionLabels).toContain("SAT R&W");
    expect(optionLabels).not.toContain("보관 과목");
  });

  it("과목을 바꾸면 reassignProblemSubjectAction이 즉시 호출된다", async () => {
    await openFirstProblem();
    const select = screen.getByLabelText("문제 과목") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "sub2" } });
    await waitFor(() => expect(reassignProblemSubjectAction).toHaveBeenCalledWith("p1", "sub2"));
  });

  it("자동 생성 문항의 검수 화면에서도 과목을 바꿀 수 있다", async () => {
    listBankProblemsAction.mockResolvedValue([{ ...draftProblem, createdVia: "compiler" as const }]);
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByText("판별식이 0일 때")).toBeInTheDocument());
    fireEvent.click(screen.getByText("판별식이 0일 때"));
    const select = await screen.findByLabelText("문제 과목");
    fireEvent.change(select, { target: { value: "sub2" } });
    await waitFor(() => expect(reassignProblemSubjectAction).toHaveBeenCalledWith("p1", "sub2"));
  });
});
