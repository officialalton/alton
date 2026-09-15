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
  createDraftVersionAction.mockResolvedValue({ ok: true, value: "v2" });
  createDraftFromPublishedAction.mockResolvedValue({
    ok: true,
    value: { versionId: "v9", reused: false },
  });
  publishDraftAction.mockResolvedValue({ ok: true });
  setProblemArchivedAction.mockResolvedValue({ ok: true });
  setProblemKeywordAction.mockResolvedValue({ ok: true });
  updateProblemMetaAction.mockResolvedValue({ ok: true });
  generateBankProblemsAction.mockResolvedValue({ ok: true, value: 3 });
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
  await waitFor(() => expect(screen.getByLabelText("지문")).toBeInTheDocument());
}

describe("목록 — 생성 · 공개 · 보관", () => {
  it("기본은 생성이고, 보관은 서버에서 따로 불러온다", async () => {
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

  it("과목·형식·키워드·검색으로 좁힌다. 키워드는 과목을 고른 뒤에 고른다", async () => {
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

    fireEvent.change(screen.getByLabelText("문제 검색"), { target: { value: "판별" } });
    await waitFor(() =>
      expect(listBankProblemsAction).toHaveBeenCalledWith(
        expect.objectContaining({ query: "판별" })
      )
    );
  });

  it("새 문제 상자는 생성 탭에만 있고, 검색은 지금 탭 안에서 찾는다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    expect(screen.getByPlaceholderText("작성 중인 문제에서 찾기")).toBeInTheDocument();

    fireEvent.click(screen.getByText("공개"));
    await waitFor(() =>
      expect(screen.queryByLabelText("새 문제 과목")).not.toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText("공개된 문제에서 찾기")).toBeInTheDocument();
  });

  it("보관 과목은 새 문제 대상으로 고를 수 없다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    expect(screen.getByLabelText("새 문제 과목").querySelectorAll("option")).toHaveLength(2);
    expect(screen.queryByRole("option", { name: "보관 과목" })).not.toBeInTheDocument();
  });
});

describe("유형과 주제는 별도 항목이다", () => {
  it("새 문제에서 둘을 따로 받는다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("문제 유형"), {
      target: { value: "Words in Context" },
    });
    fireEvent.change(screen.getByLabelText("주제"), { target: { value: "생태계" } });
    fireEvent.click(screen.getByText("직접 쓰기"));

    await waitFor(() =>
      expect(createBankProblemAction).toHaveBeenCalledWith(
        expect.objectContaining({ skillType: "Words in Context", topic: "생태계" })
      )
    );
  });

  it("만들 때 키워드도 함께 고를 수 있다 — 선택 항목이다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());

    // 과목을 고르기 전에는 고를 키워드가 없다.
    expect(screen.queryByRole("button", { name: "판별식" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "판별식" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "판별식" }));
    fireEvent.click(screen.getByText("직접 쓰기"));

    await waitFor(() =>
      expect(createBankProblemAction).toHaveBeenCalledWith(
        expect.objectContaining({ keywordIds: ["kw2"] })
      )
    );
  });

  it("키워드를 고르지 않아도 만들 수 있다", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.click(screen.getByText("직접 쓰기"));

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
    expect(screen.getByLabelText("지문")).toHaveValue("판별식이 0일 때");
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
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("문제 유형"), { target: { value: "판별식" } });
    fireEvent.click(screen.getByText("AI로 만들기"));

    await waitFor(() =>
      expect(screen.getByText(/3개를 초안으로 만들었습니다/)).toBeInTheDocument()
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
    expect(screen.getByText("3. 셋 · 정답")).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("문제 유형"), { target: { value: "판별식" } });
    fireEvent.change(screen.getByLabelText("난이도"), { target: { value: "hard" } });
    fireEvent.click(screen.getByText("AI로 만들기"));
    await waitFor(() =>
      expect(generateBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ difficulty: "hard" }))
    );
  });

  it("생성 탭에서 '전체 공개'는 보이는 초안을 모두 공개하고 결과를 알린다(2026-09-14)", async () => {
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

  it("그림 데이터를 적으면 미리보기가 그려지고, 틀리면 사유가 보인다(2026-09-14 ③)", async () => {
    await openFirstProblem();
    const box = screen.getByLabelText("그림 데이터");
    fireEvent.change(box, { target: { value: '{"type":"plane","axes":{"x":{"min":-2,"max":8},"y":{"min":-2,"max":8}},"objects":[{"id":"A","kind":"point","at":[1,3],"label":"A"}]}' } });
    expect(screen.getByTestId("problem-figure")).toBeInTheDocument();
    expect(screen.getByLabelText("그림 확인함")).toBeDisabled(); // 저장 전엔 확인 못 한다
    fireEvent.change(box, { target: { value: '{"type":"geometry","shapes":[]}' } });
    expect(screen.getByText(/그림 데이터 오류/)).toBeInTheDocument();
  });

  it("그림 옵션을 고르면 AI 생성에 그 요구가 가고, Geometry 유형을 고르면 '도형 필수'가 기본이다(2026-09-14)", async () => {
    render(<ProblemBankTab subjects={subjects} />);
    await waitFor(() => expect(screen.getByLabelText("새 문제 과목")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("새 문제 과목"), { target: { value: "sub1" } });
    fireEvent.change(screen.getByLabelText("문제 유형"), { target: { value: "Geometry and Trigonometry" } });
    expect(screen.getByLabelText("그림")).toHaveValue("require_geometry");
    fireEvent.change(screen.getByLabelText("그림"), { target: { value: "require_plane" } });
    fireEvent.click(screen.getByText("AI로 만들기"));
    await waitFor(() =>
      expect(generateBankProblemsAction).toHaveBeenCalledWith(expect.objectContaining({ figurePolicy: "require_plane" }))
    );
  });

  it("초안에서 'AI로 좌표평면 데이터 만들기'를 누르면 그림 칸이 채워지고 미리보기가 뜬다", async () => {
    await openFirstProblem();
    fireEvent.click(screen.getByRole("button", { name: "AI로 좌표평면 데이터 만들기" }));
    await waitFor(() => expect(generateFigureForProblemAction).toHaveBeenCalledWith(expect.objectContaining({ kind: "plane" })));
    await waitFor(() => expect(screen.getByTestId("problem-figure")).toBeInTheDocument());
    expect((screen.getByLabelText("그림 데이터") as HTMLTextAreaElement).value).toContain('"plane"');
  });

  it("지문에 표·수식이 있으면 편집 칸 아래에 학생 화면과 같은 미리보기(표 렌더)가 붙는다", async () => {
    await openFirstProblem();
    fireEvent.change(screen.getByLabelText("지문"), { target: { value: "Data:\n| Shift | Defective |\n|---|---|\n| 1 | 6 |\nQ?" } });
    const preview = screen.getByTestId("passage-preview");
    expect(preview.querySelector("table")).not.toBeNull();
    expect(preview).toHaveTextContent("Defective");
  });
});
