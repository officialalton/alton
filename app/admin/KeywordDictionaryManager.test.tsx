// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KeywordDictionaryManager from "./KeywordDictionaryManager";
import type { KeywordDictionary } from "./subject-data";
import * as actions from "./keyword-folder-actions";

vi.mock("./keyword-folder-actions", () => ({
  createKeywordFolder: vi.fn(),
  createKeywordInFolder: vi.fn(),
  deleteKeywordFolder: vi.fn(),
  deleteSubjectKeyword: vi.fn(),
  moveKeywordToFolder: vi.fn(),
  renameKeywordFolder: vi.fn(),
  reorderKeywordFolders: vi.fn(),
  reorderKeywordsInFolder: vi.fn(),
}));
vi.mock("./subject-actions", () => ({ renameSubjectKeyword: vi.fn() }));

const dict: KeywordDictionary = {
  folders: [
    { id: "f1", name: "Information and Ideas", position: 0 },
    { id: "f2", name: "Craft and Structure", position: 1 },
    { id: "f3", name: "빈 폴더", position: 2 },
  ],
  keywords: [
    { id: "k1", label: "Central Ideas", status: "active", folderId: "f1", sortOrder: 1 },
    { id: "k2", label: "Inferences", status: "active", folderId: "f1", sortOrder: 2 },
    { id: "k3", label: "Words in Context", status: "active", folderId: "f2", sortOrder: 0 },
    { id: "k4", label: "UAT 키워드", status: "active", folderId: null, sortOrder: 0 },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("KeywordDictionaryManager", () => {
  const expandAll = () => fireEvent.click(screen.getByRole("button", { name: "모두 펼치기" }));

  it("처음에는 모든 폴더가 접혀 있고, 모두 펼치기/모두 접기와 개별 펼치기가 된다", () => {
    render(<KeywordDictionaryManager subjectId="s" initial={dict} />);
    expect(screen.queryByText("Words in Context")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { expanded: false }).length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole("button", { name: /^Craft and Structure.*\(1\)/ }));
    expect(screen.getByText("Words in Context")).toBeInTheDocument();
    expect(screen.queryByText("Inferences")).not.toBeInTheDocument();
    expandAll();
    expect(screen.getByText("Inferences")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "모두 접기" }));
    expect(screen.queryByText("Words in Context")).not.toBeInTheDocument();
  });

  it("폴더 섹션과 개수, 기타, 빈 폴더 안내를 보여준다", () => {
    render(<KeywordDictionaryManager subjectId="s" initial={dict} />);
    expandAll();
    expect(screen.getByText(/키워드 4개 · 폴더 3개/)).toBeInTheDocument();
    const info = screen.getByTestId("keyword-folder-f1");
    expect(within(info).getByText("(2)")).toBeInTheDocument();
    expect(within(screen.getByTestId("keyword-folder-f3")).getByText(/비어 있습니다/)).toBeInTheDocument();
    expect(screen.getByTestId("keyword-folder-__other")).toHaveTextContent("UAT 키워드");
  });

  it("검색은 일치하는 키워드가 있는 섹션만 남긴다", () => {
    render(<KeywordDictionaryManager subjectId="s" initial={dict} />);
    fireEvent.change(screen.getByLabelText("키워드 검색"), { target: { value: "infer" } });
    expect(screen.getByText("Inferences")).toBeInTheDocument();
    expect(screen.queryByText("Words in Context")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("키워드 검색"), { target: { value: "zzz" } });
    expect(screen.getByText(/일치하는 키워드가 없습니다/)).toBeInTheDocument();
  });

  it("폴더 접기/펼치기", () => {
    render(<KeywordDictionaryManager subjectId="s" initial={dict} />);
    expandAll();
    fireEvent.click(screen.getByRole("button", { name: /^Craft and Structure.*\(1\)/ }));
    expect(screen.queryByText("Words in Context")).not.toBeInTheDocument();
  });

  it("폴더 삭제는 확인 문구(키워드는 기타로)를 거쳐 액션을 호출하고 결과를 반영한다", async () => {
    vi.mocked(actions.deleteKeywordFolder).mockResolvedValue({
      ok: true,
      value: { folders: dict.folders.filter((f) => f.id !== "f2"), keywords: dict.keywords.map((k) => (k.folderId === "f2" ? { ...k, folderId: null } : k)) },
    });
    render(<KeywordDictionaryManager subjectId="s" initial={dict} />);
    expandAll();
    fireEvent.click(screen.getByLabelText("Craft and Structure 폴더 삭제"));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("삭제되지 않고 “기타”로 이동");
    fireEvent.click(screen.getByRole("button", { name: "폴더 삭제" }));
    await waitFor(() => expect(actions.deleteKeywordFolder).toHaveBeenCalledWith("f2"));
    await waitFor(() => expect(screen.getByTestId("keyword-folder-__other")).toHaveTextContent("Words in Context"));
  });

  it("키워드를 폴더로 옮긴다", async () => {
    vi.mocked(actions.moveKeywordToFolder).mockResolvedValue({ ok: true, value: dict });
    render(<KeywordDictionaryManager subjectId="s" initial={dict} />);
    expandAll();
    fireEvent.click(screen.getByRole("button", { name: "UAT 키워드" }));
    fireEvent.change(screen.getByLabelText("키워드 폴더 이동"), { target: { value: "f1" } });
    await waitFor(() => expect(actions.moveKeywordToFolder).toHaveBeenCalledWith("k4", "f1"));
  });

  it("추가 시 선택한 폴더로 만들고, 서버 오류는 alert로 보여준다", async () => {
    vi.mocked(actions.createKeywordInFolder).mockResolvedValue({ ok: false, error: "이미 존재하는 키워드입니다." });
    render(<KeywordDictionaryManager subjectId="s" initial={dict} />);
    fireEvent.change(screen.getByLabelText("새 키워드 이름"), { target: { value: "Inferences" } });
    fireEvent.change(screen.getByLabelText("새 키워드를 넣을 폴더"), { target: { value: "f1" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() => expect(actions.createKeywordInFolder).toHaveBeenCalledWith("s", "Inferences", "f1"));
    expect(await screen.findByRole("alert")).toHaveTextContent("이미 존재하는 키워드입니다.");
  });

  it("폴더 순서 변경은 전체 순서를 보낸다(첫 폴더의 위로는 비활성)", async () => {
    vi.mocked(actions.reorderKeywordFolders).mockResolvedValue({ ok: true, value: dict });
    render(<KeywordDictionaryManager subjectId="s" initial={dict} />);
    expect(screen.getByLabelText("Information and Ideas 폴더를 위로")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Information and Ideas 폴더를 아래로"));
    await waitFor(() => expect(actions.reorderKeywordFolders).toHaveBeenCalledWith("s", ["f2", "f1", "f3"]));
  });

  it("비어 있는 과목은 안내 문구", () => {
    render(<KeywordDictionaryManager subjectId="s" initial={{ folders: [], keywords: [] }} />);
    expect(screen.getByText(/아직 키워드가 없습니다/)).toBeInTheDocument();
  });
});
