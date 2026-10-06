import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MySubjectsTab from "./MySubjectsTab";
import * as actions from "./mysubjects-actions";
import type { MySubject } from "./mysubjects-data";

vi.mock("./mysubjects-actions", () => ({
  createMyTemplate: vi.fn(),
  addTemplateUnit: vi.fn(),
  updateTemplateUnit: vi.fn(),
  removeTemplateUnit: vi.fn(),
  moveTemplateUnit: vi.fn(),
  addTemplateUnitKeyword: vi.fn(),
  removeTemplateUnitKeyword: vi.fn(),
  inheritUnitDefaults: vi.fn(),
  inheritTemplateDefaults: vi.fn(),
}));

const withTemplate: MySubject = {
  subjectId: "sub1",
  subjectName: "SAT Math",
  templateId: "tpl1",
  archived: false,
  keywords: [],
  units: [
    { id: "u1", position: 1, unitTitle: "함수의 기초", note: null, teacherComment: null, keywordIds: [], linkedToCatalog: true },
    { id: "u7", position: 7, unitTitle: "이차방정식 응용", note: "실수 유형", teacherComment: null, keywordIds: [], linkedToCatalog: true },
  ],
};

const withoutTemplate: MySubject = {
  subjectId: "sub2",
  subjectName: "AP Statistics",
  templateId: null,
  archived: false,
  keywords: [],
  units: [],
};

describe("MySubjectsTab", () => {
  it("템플릿 유무에 따라 편집/만들기 버튼을 다르게 보여준다", () => {
    render(<MySubjectsTab initialSubjects={[withTemplate, withoutTemplate]} />);
    expect(screen.getByText("2 sessions composed")).toBeInTheDocument();
    expect(screen.getByText("No template yet")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Create template")).toBeInTheDocument();
  });

  it("템플릿 만들기를 누르면 생성 후 바로 편집 화면으로 이동한다", async () => {
    vi.mocked(actions.createMyTemplate).mockResolvedValue({
      templateId: "tpl2",
      units: [{ id: "u1", position: 1, unitTitle: "기초 통계", note: null, teacherComment: null, keywordIds: [], linkedToCatalog: true }],
    });
    render(<MySubjectsTab initialSubjects={[withoutTemplate]} />);
    fireEvent.click(screen.getByText("Create template"));
    await waitFor(() =>
      expect(screen.getByText("Edit AP Statistics Curriculum")).toBeInTheDocument()
    );
    expect(screen.getByDisplayValue("기초 통계")).toBeInTheDocument();
  });

  it("편집 화면에서 회차를 추가/삭제할 수 있다", async () => {
    vi.mocked(actions.addTemplateUnit).mockResolvedValue({
      id: "u8",
      position: 8,
      keywordIds: [],
      linkedToCatalog: false,
      unitTitle: "새 회차",
      note: null,
      teacherComment: null,
    });
    vi.mocked(actions.removeTemplateUnit).mockResolvedValue(undefined);
    render(<MySubjectsTab initialSubjects={[withTemplate]} />);
    fireEvent.click(screen.getByText("Edit"));

    fireEvent.click(screen.getByText("+ Add session"));
    await waitFor(() => expect(actions.addTemplateUnit).toHaveBeenCalledWith("tpl1", 8));
    await waitFor(() => expect(screen.getByDisplayValue("새 회차")).toBeInTheDocument());

    fireEvent.click(screen.getAllByText("Delete")[0]);
    await waitFor(() => expect(actions.removeTemplateUnit).toHaveBeenCalledWith("u1"));
  });

  it("맨 위 회차는 위로 이동 버튼이 비활성화된다", () => {
    render(<MySubjectsTab initialSubjects={[withTemplate]} />);
    fireEvent.click(screen.getByText("Edit"));
    const upButtons = screen.getAllByText("↑ Up");
    expect(upButtons[0]).toBeDisabled();
  });
});

// 보관 과목은 새 배정 대상이 아니지만, 쌓아 둔 커리큘럼에는 들어갈 수 있어야
// 한다 — 보관은 숨김이지 접근 차단이 아니다(2026-09-12 확정).
describe("MySubjectsTab — 보관된 과목", () => {
  const archivedSubject = {
    subjectId: "sub9",
    subjectName: "테스트 과목 1",
    templateId: "tpl9",
    archived: true,
    keywords: [],
    units: [{ id: "u9", position: 1, unitTitle: "회차", note: null, teacherComment: null, keywordIds: [], linkedToCatalog: true }],
  };

  it("현재 목록에는 보관 과목이 섞이지 않는다", () => {
    render(<MySubjectsTab initialSubjects={[archivedSubject]} />);
    expect(screen.queryByText("테스트 과목 1")).not.toBeInTheDocument();
    expect(screen.getByText("No subjects assigned yet.")).toBeInTheDocument();
  });

  it("보관됨에서 열어 커리큘럼을 계속 볼 수 있다", () => {
    render(<MySubjectsTab initialSubjects={[archivedSubject]} />);
    fireEvent.click(screen.getByText(/^Archived/));

    expect(screen.getByText("테스트 과목 1")).toBeInTheDocument();
    // 탭 라벨과 배지가 같은 글자다 — 개수로 확인한다.
    expect(screen.getAllByText("Archived").length).toBeGreaterThan(1);
    // 편집 진입이 살아 있어야 한다 — 접근 자체를 막으면 안 된다.
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("회차")).toBeInTheDocument();
  });
});

// P2 3차 — 관리자 기준본에서 내려온 키워드가 이 화면에 보이고, 선생님이 자기
// 기본 구성으로 고칠 수 있어야 한다. 이게 안 되면 선생님은 배정받은 학생마다
// 같은 키워드를 다시 찍게 된다.
describe("회차 키워드", () => {
  const withKeywords: MySubject = {
    subjectId: "sub3",
    subjectName: "SAT Reading",
    templateId: "tpl3",
    archived: false,
    keywords: [
      { id: "k1", label: "이차방정식" },
      { id: "k2", label: "함수" },
    ],
    units: [
      {
        id: "u1",
        position: 1,
        unitTitle: "1회차",
        note: null,
        teacherComment: null,
        keywordIds: ["k1"],
        linkedToCatalog: true,
      },
    ],
  };

  function openEditor(subject: MySubject = withKeywords) {
    render(<MySubjectsTab initialSubjects={[subject]} />);
    fireEvent.click(screen.getByText("Edit"));
  }

  it("기준본에서 내려온 키워드가 붙은 상태로 보인다", () => {
    openEditor();
    expect(screen.getByRole("button", { name: "이차방정식" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "함수" })).toHaveAttribute("aria-pressed", "false");
  });

  it("붙이지 않은 키워드를 누르면 붙고, 붙은 키워드를 누르면 떨어진다", async () => {
    vi.mocked(actions.addTemplateUnitKeyword).mockResolvedValue({ ok: true });
    vi.mocked(actions.removeTemplateUnitKeyword).mockResolvedValue({ ok: true });
    openEditor();

    fireEvent.click(screen.getByRole("button", { name: "함수" }));
    await waitFor(() =>
      expect(actions.addTemplateUnitKeyword).toHaveBeenCalledWith("u1", "k2")
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "함수" })).toHaveAttribute("aria-pressed", "true")
    );

    fireEvent.click(screen.getByRole("button", { name: "이차방정식" }));
    await waitFor(() =>
      expect(actions.removeTemplateUnitKeyword).toHaveBeenCalledWith("u1", "k1")
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "이차방정식" })).toHaveAttribute(
        "aria-pressed",
        "false"
      )
    );
  });

  it("실패하면 사유를 화면에 보여주고 상태를 바꾸지 않는다", async () => {
    vi.mocked(actions.addTemplateUnitKeyword).mockResolvedValue({
      ok: false,
      error: "Couldn't attach the keyword.",
    });
    openEditor();

    fireEvent.click(screen.getByRole("button", { name: "함수" }));
    await waitFor(() =>
      expect(screen.getByText("Couldn't attach the keyword.")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "함수" })).toHaveAttribute("aria-pressed", "false");
  });

  it("기준본과 이어진 회차에는 보정 버튼이 있다", () => {
    openEditor();
    expect(screen.getByText("Import from base")).toBeInTheDocument();
  });

  it("직접 추가한 보충 회차에는 보정 버튼이 없다", () => {
    // 물려받을 기준본이 없는 회차다. 버튼을 눌러도 할 일이 없으므로 보이지 않는다.
    openEditor({
      ...withKeywords,
      units: [{ ...withKeywords.units[0], linkedToCatalog: false, keywordIds: [] }],
    });
    expect(screen.queryByText("Import from base")).not.toBeInTheDocument();
    expect(
      screen.getByText("This session was added manually, so there is no base to inherit from. Pick keywords yourself.")
    ).toBeInTheDocument();
  });

  it("보정 결과는 추측하지 않고 서버가 돌려준 상태를 그린다", async () => {
    vi.mocked(actions.inheritUnitDefaults).mockResolvedValue({
      ok: true,
      keywordsAdded: 1,
      keywordIds: ["k1", "k2"],
    });
    openEditor();

    fireEvent.click(screen.getByText("Import from base"));
    await waitFor(() =>
      expect(screen.getByText("Imported 1 keywords from the base curriculum.")).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: "함수" })).toHaveAttribute("aria-pressed", "true");
  });
});

// 마이그레이션 이전 템플릿은 연결만 있고 키워드가 비어 있다. 회차마다 하나씩
// 누르게 하면 "선생님이 같은 키워드를 다시 지정하는 흐름"과 같아진다.
describe("템플릿 전체 보정", () => {
  const emptyTemplate: MySubject = {
    subjectId: "sub4",
    subjectName: "SAT Reading",
    templateId: "tpl4",
    archived: false,
    keywords: [
      { id: "k1", label: "Speaking" },
      { id: "k2", label: "Voca" },
    ],
    units: [
      { id: "u1", position: 1, unitTitle: "1회차", note: null, teacherComment: null, keywordIds: [], linkedToCatalog: true },
      { id: "u2", position: 2, unitTitle: "2회차", note: null, teacherComment: null, keywordIds: [], linkedToCatalog: true },
    ],
  };

  it("비어 있는 회차 수를 알려주고 한 번에 가져오게 한다", () => {
    render(<MySubjectsTab initialSubjects={[emptyTemplate]} />);
    fireEvent.click(screen.getByText("Edit"));
    expect(
      screen.getByText(/2 sessions have no keywords yet/)
    ).toBeInTheDocument();
    expect(screen.getByText("Import all")).toBeInTheDocument();
  });

  it("전체 가져오기는 서버가 돌려준 회차별 상태를 그대로 그린다", async () => {
    vi.mocked(actions.inheritTemplateDefaults).mockResolvedValue({
      ok: true,
      keywordsAdded: 2,
      keywordIdsByUnit: { u1: ["k1"], u2: ["k2"] },
    });
    render(<MySubjectsTab initialSubjects={[emptyTemplate]} />);
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Import all"));

    await waitFor(() =>
      expect(screen.getByText("Imported 2 keywords from the base curriculum.")).toBeInTheDocument()
    );
    // 두 회차가 서로 다른 키워드를 받는다 — 한 덩어리로 뭉뚱그리지 않는다.
    const speaking = screen.getAllByRole("button", { name: "Speaking" });
    const voca = screen.getAllByRole("button", { name: "Voca" });
    expect(speaking[0]).toHaveAttribute("aria-pressed", "true");
    expect(voca[0]).toHaveAttribute("aria-pressed", "false");
    expect(speaking[1]).toHaveAttribute("aria-pressed", "false");
    expect(voca[1]).toHaveAttribute("aria-pressed", "true");
    // 다 채워졌으므로 안내는 사라진다.
    expect(screen.queryByText(/sessions have no keywords yet/)).not.toBeInTheDocument();
  });

  it("채울 것이 없으면 안내가 보이지 않는다", () => {
    render(
      <MySubjectsTab
        initialSubjects={[
          {
            ...emptyTemplate,
            units: [{ ...emptyTemplate.units[0], keywordIds: ["k1"] }],
          },
        ]}
      />
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.queryByText(/sessions have no keywords yet/)).not.toBeInTheDocument();
  });
});

describe("회차 키워드 — 도메인 그룹", () => {
  it("SAT 도메인 제목 아래 칩이 묶이고 선택 상태가 유지된다", () => {
    const subject: MySubject = {
      subjectId: "sub7", subjectName: "SAT Math", templateId: "tpl7", archived: false,
      keywords: [
        { id: "k1", label: "Linear equations", domainCode: "algebra" },
        { id: "k2", label: "Legacy" },
      ],
      units: [{ id: "u1", position: 1, unitTitle: "1회차", note: null, teacherComment: null, keywordIds: ["k1"], linkedToCatalog: true }],
    };
    render(<MySubjectsTab initialSubjects={[subject]} />);
    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Algebra")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Linear equations" })).toHaveAttribute("aria-pressed", "true");
  });
});
