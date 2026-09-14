import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DriveMaterialsPanel from "./DriveMaterialsPanel";
import * as actions from "./curriculum-asset-actions";
import type { AdminSubject } from "./subject-data";

vi.mock("./curriculum-asset-actions", () => ({
  listKeywordDriveFilesAction: vi.fn(),
  importDriveFileAction: vi.fn(),
  publishAssetDocAction: vi.fn(),
  registerLocalSampleAssetAction: vi.fn(),
  runCurriculumDriveFolderSyncAction: vi.fn(),
}));

const subjects: AdminSubject[] = [
  {
    subjectId: "s1",
    subjectName: "SAT Reading",
    units: [{ id: "u1", position: 1, unitTitle: "단원1", note: null, keywordIds: ["k1"] }],
    keywords: [
      { id: "k1", label: "추론", status: "active" },
      { id: "k2", label: "어휘", status: "active" },
    ],
  },
];

beforeEach(() => vi.clearAllMocks());

function pickKeyword() {
  fireEvent.change(screen.getByLabelText("과목"), { target: { value: "s1" } });
  fireEvent.change(screen.getByLabelText("단원"), { target: { value: "u1" } });
  fireEvent.change(screen.getByLabelText("키워드"), { target: { value: "k1" } });
}

describe("Drive 자료 패널", () => {
  it("단원을 고르면 그 단원의 키워드만 후보에 남는다", () => {
    render(<DriveMaterialsPanel subjects={subjects} />);
    pickKeyword();
    const options = Array.from((screen.getByLabelText("키워드") as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(["키워드 고르기…", "추론"]);
  });

  it("불러오기는 키워드 폴더의 파일을 보여주고, 등록된 것은 공개 버튼·안 된 것은 등록 버튼", async () => {
    vi.mocked(actions.listKeywordDriveFilesAction).mockResolvedValue({
      state: "ok",
      folderId: "F",
      files: [
        { fileId: "f1", name: "개념 설명.pdf", mimeType: "application/pdf", kind: "pdf", sizeBytes: 2048, modifiedAt: null, registeredDocId: null },
        { fileId: "f2", name: "설명 영상.mp4", mimeType: "video/mp4", kind: "video", sizeBytes: null, modifiedAt: null, registeredDocId: "doc2" },
        { fileId: "f3", name: "메모.txt", mimeType: "text/plain", kind: null, sizeBytes: null, modifiedAt: null, registeredDocId: null },
      ],
    });
    render(<DriveMaterialsPanel subjects={subjects} />);
    pickKeyword();
    fireEvent.click(screen.getByRole("button", { name: /Drive 에서 불러오기/ }));
    await waitFor(() => expect(screen.getByText("개념 설명.pdf")).toBeInTheDocument());
    expect(actions.listKeywordDriveFilesAction).toHaveBeenCalledWith("k1");
    expect(screen.getAllByRole("button", { name: "자료로 등록" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "공개 (고정 사본)" })).toHaveLength(1);
    expect(screen.getByText("지원 안 함")).toBeInTheDocument();
  });

  it("등록은 초안이라고 알리고, 공개 실패는 공개하지 않았다고 말한다", async () => {
    vi.mocked(actions.listKeywordDriveFilesAction).mockResolvedValue({
      state: "ok",
      folderId: "F",
      files: [
        { fileId: "f1", name: "a.pdf", mimeType: "application/pdf", kind: "pdf", sizeBytes: null, modifiedAt: null, registeredDocId: null },
        { fileId: "f2", name: "b.pdf", mimeType: "application/pdf", kind: "pdf", sizeBytes: null, modifiedAt: null, registeredDocId: "doc-b" },
      ],
    });
    vi.mocked(actions.importDriveFileAction).mockResolvedValue({ ok: true, docId: "doc-a" });
    vi.mocked(actions.publishAssetDocAction).mockResolvedValue({ ok: false, error: "고정 사본을 저장하지 못해 공개하지 않았습니다." });
    render(<DriveMaterialsPanel subjects={subjects} />);
    pickKeyword();
    fireEvent.click(screen.getByRole("button", { name: /Drive 에서 불러오기/ }));
    await waitFor(() => expect(screen.getByText("a.pdf")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "자료로 등록" }));
    await waitFor(() => expect(screen.getByTestId("drive-notice")).toHaveTextContent("등록했습니다(초안): a.pdf"));
    expect(actions.importDriveFileAction).toHaveBeenCalledWith("k1", "f1");

    fireEvent.click(screen.getByRole("button", { name: "공개 (고정 사본)" }));
    await waitFor(() => expect(screen.getByTestId("drive-notice")).toHaveTextContent("공개하지 않았습니다 — 고정 사본을 저장하지 못해"));
    expect(actions.publishAssetDocAction).toHaveBeenCalledWith("doc-b");
  });

  it("폴더가 아직 없으면 그 사유를 보여준다", async () => {
    vi.mocked(actions.listKeywordDriveFilesAction).mockResolvedValue({ state: "folder_not_linked", reason: "키워드 폴더가 아직 Drive 에 만들어지지 않았습니다. 폴더 동기화를 먼저 실행하세요." });
    render(<DriveMaterialsPanel subjects={subjects} />);
    pickKeyword();
    fireEvent.click(screen.getByRole("button", { name: /Drive 에서 불러오기/ }));
    await waitFor(() => expect(screen.getByText(/폴더 동기화를 먼저/)).toBeInTheDocument());
  });

  it("폴더 동기화는 실제 쓰기가 꺼져 있으면 계획만 보여준다", async () => {
    vi.mocked(actions.runCurriculumDriveFolderSyncAction).mockResolvedValue({
      state: "ok",
      driveName: "ALTON Curriculum",
      pendingAfter: 3,
      outcome: { created: 2, renamed: 1, skipped: [{ rowId: "r", reason: "x" }], failed: [], dryRun: true },
    });
    render(<DriveMaterialsPanel subjects={subjects} />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 동기화 실행" }));
    await waitFor(() => expect(screen.getByTestId("folder-sync-result")).toHaveTextContent("연결됨: ALTON Curriculum · 계획만(실제 쓰기 꺼짐) — 만들 폴더 2개 · 이름 변경 1개 · 건너뜀 1개 · 실패 0개 · 남은 대기 3개"));
  });

  it("드라이브에 접근하지 못하면 그 사유를 보여준다 — 쓰기를 켜기 전에 알 수 있어야 한다", async () => {
    vi.mocked(actions.runCurriculumDriveFolderSyncAction).mockResolvedValue({ state: "drive_unreachable", reason: "Drive API 요청 실패 (status 404)" });
    render(<DriveMaterialsPanel subjects={subjects} />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 동기화 실행" }));
    await waitFor(() => expect(screen.getByTestId("folder-sync-result")).toHaveTextContent("드라이브에 접근하지 못했습니다 — Drive API 요청 실패 (status 404)"));
  });
});
