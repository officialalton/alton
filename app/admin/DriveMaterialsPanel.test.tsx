import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DriveMaterialsPanel from "./DriveMaterialsPanel";
import * as actions from "./curriculum-asset-actions";
import type { AdminSubject } from "./subject-data";

vi.mock("./curriculum-asset-actions", () => ({
  syncSubjectDriveMaterialsAction: vi.fn(),
  archiveNonDriveDocsAction: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Drive 자료 패널", () => {
  it("키워드를 고르는 단계가 없다 — 과목 하나로 자료 동기화를 실행한다(2026-09-14)", async () => {
    vi.mocked(actions.syncSubjectDriveMaterialsAction).mockResolvedValue({
      state: "ok",
      keywordFolders: 2,
      published: 1,
      alreadyPublished: 1,
      failed: 1,
      skipped: 1,
      items: [
        { keywordLabel: "추론", name: "개념.pdf", kind: "pdf", outcome: "published", detail: "120KB · 3쪽", docId: "d1" },
        { keywordLabel: "추론", name: "강의.mp4", kind: "video", outcome: "already_published", detail: null, docId: "d2" },
        { keywordLabel: "어휘", name: "메모.txt", kind: null, outcome: "skipped_unsupported", detail: "text/plain", docId: null },
        { keywordLabel: "어휘", name: "깨진.pdf", kind: "pdf", outcome: "failed", detail: "원본을 내려받지 못해 공개하지 않았습니다", docId: "d3" },
      ],
    });
    render(<DriveMaterialsPanel subjects={subjects} />);
    expect(screen.queryByLabelText("키워드")).not.toBeInTheDocument();
    const run = screen.getByRole("button", { name: "과목 자료 동기화 실행" });
    expect(run).toBeDisabled();
    fireEvent.change(screen.getByLabelText("과목"), { target: { value: "s1" } });
    fireEvent.click(run);
    await waitFor(() => expect(actions.syncSubjectDriveMaterialsAction).toHaveBeenCalledWith("s1"));
    const result = await screen.findByTestId("material-sync-result");
    expect(result).toHaveTextContent("키워드 폴더 2개 — 새로 공개 1개 · 이미 공개 1개 · 건너뜀 1개 · 실패 1개");
    expect(result).toHaveTextContent("개념.pdf");
    expect(result).toHaveTextContent("공개됨 · 120KB · 3쪽");
    expect(result).toHaveTextContent("이미 공개");
    expect(result).toHaveTextContent("지원 안 함");
    expect(result).toHaveTextContent("실패 — 원본을 내려받지 못해");
  });

  it("키워드 폴더가 아직 없으면 그 사유를 보여준다", async () => {
    vi.mocked(actions.syncSubjectDriveMaterialsAction).mockResolvedValue({ state: "no_folders", reason: "이 과목의 키워드 폴더가 아직 Drive 에 없습니다. 폴더 동기화를 먼저 실행하세요." });
    render(<DriveMaterialsPanel subjects={subjects} />);
    fireEvent.change(screen.getByLabelText("과목"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "과목 자료 동기화 실행" }));
    await waitFor(() => expect(screen.getByText(/폴더 동기화를 먼저/)).toBeInTheDocument());
  });

  it("Drive 원본 없는 교재 보관은 확인을 거쳐 보관한 제목을 보여준다", async () => {
    window.confirm = vi.fn(() => true);
    vi.mocked(actions.archiveNonDriveDocsAction).mockResolvedValue({ ok: true, archived: [{ id: "a", title: "옛 HTML 교재" }, { id: "b", title: "로컬 표본" }] });
    render(<DriveMaterialsPanel subjects={subjects} />);
    fireEvent.change(screen.getByLabelText("과목"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "Drive 원본 없는 교재 보관" }));
    await waitFor(() => expect(actions.archiveNonDriveDocsAction).toHaveBeenCalledWith("s1"));
    expect(await screen.findByTestId("archive-result")).toHaveTextContent("보관했습니다 (2개): 옛 HTML 교재, 로컬 표본");
  });

  it("보관 확인을 취소하면 아무것도 하지 않는다", () => {
    window.confirm = vi.fn(() => false);
    render(<DriveMaterialsPanel subjects={subjects} />);
    fireEvent.change(screen.getByLabelText("과목"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "Drive 원본 없는 교재 보관" }));
    expect(actions.archiveNonDriveDocsAction).not.toHaveBeenCalled();
  });

  it("폴더 동기화는 실제 쓰기가 꺼져 있으면 계획만 보여준다", async () => {
    vi.mocked(actions.runCurriculumDriveFolderSyncAction).mockResolvedValue({
      state: "ok",
      driveName: "ALTON Curriculum",
      pendingAfter: 3,
      outcome: { created: 2, renamed: 1, skipped: [{ rowId: "r", reason: "x" }], failed: [], dryRun: true, missingRecreated: 1 },
    });
    render(<DriveMaterialsPanel subjects={subjects} />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 동기화 실행" }));
    await waitFor(() => expect(screen.getByTestId("folder-sync-result")).toHaveTextContent("연결됨: ALTON Curriculum · 계획만(실제 쓰기 꺼짐) — 만들 폴더 2개 · 이름 변경 1개 · 건너뜀 1개 · 실패 0개 · 남은 대기 3개 · Drive 에서 사라진 폴더 1개는 다시 만들 대상"));
  });

  it("드라이브에 접근하지 못하면 그 사유를 보여준다 — 쓰기를 켜기 전에 알 수 있어야 한다", async () => {
    vi.mocked(actions.runCurriculumDriveFolderSyncAction).mockResolvedValue({ state: "drive_unreachable", reason: "Drive API 요청 실패 (status 404)" });
    render(<DriveMaterialsPanel subjects={subjects} />);
    fireEvent.click(screen.getByRole("button", { name: "폴더 동기화 실행" }));
    await waitFor(() => expect(screen.getByTestId("folder-sync-result")).toHaveTextContent("드라이브에 접근하지 못했습니다 — Drive API 요청 실패 (status 404)"));
  });
});
