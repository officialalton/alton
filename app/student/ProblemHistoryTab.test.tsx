import { render, screen, fireEvent, within, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProblemHistoryTab from "./ProblemHistoryTab";
import type { ProblemHistoryEntry } from "./problem-history-data";

vi.mock("@/app/session/[id]/problem-image-actions", () => ({ getProblemImageUrlAction: vi.fn() }));

// 폴더·배정 서버 액션은 메모리 가짜로 대체한다(RLS·제약은 notebook.integration.test.ts 가 DB 로 검증).
const fake = vi.hoisted(() => ({
  folders: [] as { id: string; name: string; isDefault: boolean }[],
  assignments: {} as Record<string, string>,
  seq: 0,
}));
vi.mock("./notebook-actions", () => ({
  loadNotebookStateAction: vi.fn(async () => ({ folders: [...fake.folders], assignments: { ...fake.assignments } })),
  createNotebookFolderAction: vi.fn(async (name: string) => {
    if (fake.folders.some((f) => f.name.toLowerCase() === name.trim().toLowerCase())) return { ok: false, error: "A folder with that name already exists." };
    const f = { id: `f${++fake.seq}`, name: name.trim(), isDefault: false };
    fake.folders.push(f);
    return { ok: true, value: f };
  }),
  renameNotebookFolderAction: vi.fn(async (id: string, name: string) => {
    const f = fake.folders.find((x) => x.id === id);
    if (!f || f.isDefault) return { ok: false, error: "This folder can't be renamed." };
    f.name = name.trim();
    return { ok: true, value: { name: f.name } };
  }),
  deleteNotebookFolderAction: vi.fn(async (id: string) => {
    fake.folders = fake.folders.filter((f) => f.id !== id);
    fake.assignments = Object.fromEntries(Object.entries(fake.assignments).filter(([, v]) => v !== id));
    return { ok: true, value: undefined };
  }),
  moveNotebookProblemAction: vi.fn(async (key: string, folderId: string | null) => {
    if (folderId) fake.assignments[key] = folderId; else delete fake.assignments[key];
    return { ok: true, value: undefined };
  }),
}));
vi.mock("./activity-tracking", () => ({ logLearningEventAction: vi.fn() }));

beforeEach(() => { fake.folders = [{ id: "fd", name: "Review later", isDefault: true }]; fake.assignments = {}; fake.seq = 0; });
afterEach(cleanup);

const base: ProblemHistoryEntry = {
  workId: "w1", sessionId: "s1", source: "lesson", subjectName: "SAT", startsAt: null, unitTitle: "1회차", format: "mc",
  passage: "Which word?", options: ["harvested", "developed"], figure: null, myChoice: 0, myText: null, submittedAt: "2026-09-14T00:00:00Z",
  graded: false, grade: null, gradeComment: null, correctIndex: null, acceptedAnswers: null, explanation: null,
  satDomain: "algebra", skillCode: "linear_functions",
};

describe("ProblemHistoryTab — 학생 포털 문제 기록(v3, 2026-09-14)", () => {
  it("비어 있으면 서브탭별 안내를 보여준다", () => {
    render(<ProblemHistoryTab entries={[]} />);
    expect(screen.getByTestId("notebook-empty")).toHaveTextContent(/Nothing here yet/);
    fireEvent.click(screen.getByRole("button", { name: "Mistake Notebook" }));
    expect(screen.getByTestId("notebook-empty")).toHaveTextContent(/No missed questions yet/);
  });

  it("채점 전엔 정답·해설이 없고 채점 대기로, 채점 뒤엔 결과·정답·해설이 펼쳐진다", () => {
    const graded: ProblemHistoryEntry = {
      ...base, workId: "w2", source: "homework", graded: true, grade: "incorrect", gradeComment: "다시 보자", correctIndex: 1, explanation: "developed 가 맞다",
    };
    render(<ProblemHistoryTab entries={[base, graded]} />);
    expect(screen.getAllByText("Pending").length).toBe(1);
    expect(screen.getAllByText("Incorrect").length).toBe(1);
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    expect(screen.getByText(/explanation will appear here once your teacher grades it/)).toBeInTheDocument();
    expect(screen.queryByText("developed 가 맞다")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);
    expect(screen.getByText("developed 가 맞다")).toBeInTheDocument();
    expect(screen.getByText(/다시 보자/)).toBeInTheDocument();
  });

  it("기술별 성취를 채점된 문제 기준으로 모으고, 누르면 그 기술만 남긴다(2026-09-14 분류)", () => {
    const g1: ProblemHistoryEntry = { ...base, workId: "g1", graded: true, grade: "correct", correctIndex: 0 };
    const g2: ProblemHistoryEntry = { ...base, workId: "g2", graded: true, grade: "incorrect", correctIndex: 1, skillCode: "percentages", satDomain: "problem_solving_data" };
    render(<ProblemHistoryTab entries={[base, g1, g2]} />);
    const summary = screen.getByTestId("skill-summary");
    expect(summary).toHaveTextContent("Linear functions");
    expect(summary).toHaveTextContent("1 / 1 (+1 pending)");
    expect(summary).toHaveTextContent("Percentages");
    fireEvent.click(within(summary).getByRole("button", { name: /Percentages/ }));
    expect(screen.getAllByText("Which word?").length).toBe(1);
  });

  it("Grade·Format 필터는 없고 출처 필터는 동작한다", () => {
    const graded: ProblemHistoryEntry = { ...base, workId: "w2", source: "homework", graded: true, grade: "correct", correctIndex: 0 };
    render(<ProblemHistoryTab entries={[base, graded]} />);
    expect(screen.queryByText("Grade")).toBeNull();
    expect(screen.queryByText("Format")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Assignment" }));
    expect(screen.getAllByText("Which word?").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Lesson" }));
    fireEvent.click(screen.getByRole("button", { name: "Practice Test" }));
    expect(screen.getByText("No problems match these filters.")).toBeInTheDocument();
  });
});

const mk = (o: Partial<ProblemHistoryEntry>): ProblemHistoryEntry => ({ ...base, ...o });
const wrong = (id: string, o: Partial<ProblemHistoryEntry> = {}) => mk({ workId: id, passage: `Q-${id}`, graded: true, grade: "incorrect", correctIndex: 1, ...o });

describe("ProblemHistoryTab — My Notebook(2026-10-08)", () => {
  const entries = [
    mk({ workId: "s1", passage: "Q-saved", graded: true, grade: "correct", correctIndex: 0, satDomain: "algebra", skillCode: "linear_functions" }),
    wrong("m1", { satDomain: "algebra", skillCode: "percentages" }),
    wrong("m2", { satDomain: "rw_craft_structure", skillCode: "words_in_context" }),
  ];

  it("All / My Notebook / Mistake Notebook 서브탭이 저장·오답을 나눈다", () => {
    render(<ProblemHistoryTab entries={entries} />);
    expect(screen.getAllByText(/^Q-/).length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "My Notebook" }));
    expect(screen.getAllByText(/^Q-/).map((n) => n.textContent)).toEqual(["Q-saved"]);
    fireEvent.click(screen.getByRole("button", { name: "Mistake Notebook" }));
    expect(screen.getAllByText(/^Q-/).map((n) => n.textContent)).toEqual(["Q-m1", "Q-m2"]);
  });

  it("Section → Main category → Sub-category 필터는 가진 분류만 보여주고 연쇄로 좁힌다", () => {
    render(<ProblemHistoryTab entries={entries} />);
    const section = screen.getByLabelText("Section") as HTMLSelectElement;
    const domain = screen.getByLabelText("Main category") as HTMLSelectElement;
    const skill = screen.getByLabelText("Sub-category") as HTMLSelectElement;
    expect([...section.options].map((o) => o.text)).toEqual(["All sections", "R&W", "Math"]);
    fireEvent.change(section, { target: { value: "math" } });
    expect([...domain.options].map((o) => o.text)).toEqual(["All categories", "Algebra"]);
    expect(screen.getAllByText(/^Q-/).length).toBe(2);
    fireEvent.change(domain, { target: { value: "algebra" } });
    expect([...skill.options].map((o) => o.text)).toEqual(["All sub-categories", "Linear functions", "Percentages"]);
    fireEvent.change(skill, { target: { value: "percentages" } });
    expect(screen.getAllByText(/^Q-/).map((n) => n.textContent)).toEqual(["Q-m1"]);
    // 상위를 바꾸면 하위 선택이 비워진다.
    fireEvent.change(section, { target: { value: "rw" } });
    expect(domain.value).toBe("");
    expect(skill.value).toBe("");
    expect(screen.getAllByText(/^Q-/).map((n) => n.textContent)).toEqual(["Q-m2"]);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getAllByText(/^Q-/).length).toBe(3);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("폴더를 만들고 문제를 옮기면 개수가 바뀌고, 폴더를 지워도 문제는 Unfiled 로 남는다", async () => {
    render(<ProblemHistoryTab entries={entries} />);
    await screen.findByTestId("folder-bar");
    fireEvent.click(screen.getByRole("button", { name: "+ New folder" }));
    fireEvent.change(screen.getByLabelText("New folder name"), { target: { value: "Algebra drills" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    const chip = await screen.findByRole("button", { name: "Algebra drills (0)" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    // 지금은 새 폴더(비어 있음)가 선택돼 있다 — 전체로 돌아가 문제를 연다.
    fireEvent.click(screen.getByRole("button", { name: /^All \(3\)/ }));
    fireEvent.click(screen.getByText("Q-m1"));
    fireEvent.change(screen.getByLabelText("Move to folder"), { target: { value: "f1" } });
    await screen.findByRole("button", { name: "Algebra drills (1)" });
    expect(screen.getByRole("button", { name: "Unfiled (2)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Algebra drills (1)" }));
    expect(screen.queryByText("Q-m2")).toBeNull();
    expect(screen.queryByText("Q-saved")).toBeNull();
    expect(screen.getAllByText("Q-m1").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Delete folder" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete folder" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Algebra drills/ })).toBeNull());
    expect(screen.getByRole("button", { name: "Unfiled (3)" })).toBeInTheDocument();
    expect(screen.getAllByText("Q-m1").length).toBeGreaterThan(0);
    expect(screen.getByText("Q-m2")).toBeInTheDocument();
  });

  it("기본 폴더는 이름 변경·삭제 버튼이 없고, 중복 이름은 오류로 알려준다", async () => {
    render(<ProblemHistoryTab entries={entries} />);
    fireEvent.click(await screen.findByRole("button", { name: "Review later (0)" }));
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete folder" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "+ New folder" }));
    fireEvent.change(screen.getByLabelText("New folder name"), { target: { value: "review later" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A folder with that name already exists.");
  });

  it("폴더 목록을 기다리는 동안 스켈레톤을 보인다", () => {
    render(<ProblemHistoryTab entries={entries} />);
    expect(screen.getByTestId("folders-skeleton")).toBeInTheDocument();
  });
});

describe("ProblemHistoryTab — 무료 회원(2026-10-05 UAT)", () => {
  const mock: ProblemHistoryEntry = { ...base, workId: "m1", source: "mock_exam", subjectName: "Mock Exam", unitTitle: "Set A", startsAt: "2026-10-03T12:00:00Z", graded: true, grade: "incorrect", correctIndex: 1, explanation: "why" };
  it("무료 회원: 안내 문구·소스 필터·행 라벨이 연습시험 기준이다", () => {
    render(<ProblemHistoryTab entries={[mock]} isFreeMember />);
    expect(screen.getByText(/Questions you missed or saved from your practice tests\./)).toBeInTheDocument();
    expect(screen.queryByText(/teacher grades/)).toBeNull();
    expect(screen.queryByText("Source")).toBeNull();
    expect(screen.queryByText("Lesson")).toBeNull();
    expect(screen.getByText("Practice Test · Set A · Oct 3, 2026")).toBeInTheDocument();
  });
  it("과외 회원은 기존 문구 유지", () => {
    render(<ProblemHistoryTab entries={[mock]} />);
    expect(screen.getByText(/unlock once they are graded/)).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
  });
});
