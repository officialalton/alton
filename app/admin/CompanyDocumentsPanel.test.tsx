import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CompanyDocumentsPanel from "./CompanyDocumentsPanel";
import { listCompanyDocumentsAction, openCompanyDocumentAction } from "./company-documents-actions";

vi.mock("./company-documents-actions", () => ({
  listCompanyDocumentsAction: vi.fn(),
  openCompanyDocumentAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (listCompanyDocumentsAction as ReturnType<typeof vi.fn>).mockResolvedValue({
    state: "ok",
    entries: [
      { id: "f1", name: "법인 서류", isFolder: true, sizeBytes: null, modifiedAt: null },
      {
        id: "f2",
        name: "w9-blank.pdf",
        isFolder: false,
        sizeBytes: 2048,
        modifiedAt: "2026-09-01T00:00:00Z",
      },
    ],
  });
});

describe("CompanyDocumentsPanel — 빈 상태를 구분한다", () => {
  it("아직 연결되지 않음", async () => {
    (listCompanyDocumentsAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: "not_configured",
    });
    render(<CompanyDocumentsPanel />);
    await waitFor(() =>
      expect(screen.getByText(/아직 연결되지 않았습니다/)).toBeInTheDocument()
    );
  });

  it("폴더가 비어 있음 — 연결되지 않음과 다른 문구다", async () => {
    (listCompanyDocumentsAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: "ok",
      entries: [],
    });
    render(<CompanyDocumentsPanel />);
    await waitFor(() => expect(screen.getByText("이 폴더는 비어 있습니다.")).toBeInTheDocument());
    expect(screen.queryByText(/아직 연결되지 않았습니다/)).not.toBeInTheDocument();
  });

  it("권한 없음 — 설정 문제와 구분한다", async () => {
    (listCompanyDocumentsAction as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("이 작업을 수행할 권한이 없습니다.")
    );
    render(<CompanyDocumentsPanel />);
    await waitFor(() =>
      expect(screen.getByText("이 작업을 수행할 권한이 없습니다.")).toBeInTheDocument()
    );
    expect(screen.queryByText(/아직 연결되지 않았습니다/)).not.toBeInTheDocument();
  });

  it("조회 실패 — 원문 대신 안내와 재시도", async () => {
    (listCompanyDocumentsAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: "fetch_failed",
    });
    const { container } = render(<CompanyDocumentsPanel />);
    await waitFor(() =>
      expect(screen.getByText(/연결하지 못했습니다/)).toBeInTheDocument()
    );
    expect(screen.getByText("다시 시도")).toBeInTheDocument();
    expect(container.textContent).not.toContain("fetch_failed");
  });

  it("다시 시도를 누르면 같은 폴더를 다시 읽는다", async () => {
    (listCompanyDocumentsAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: "fetch_failed",
    });
    render(<CompanyDocumentsPanel />);
    await waitFor(() => expect(screen.getByText("다시 시도")).toBeInTheDocument());
    const before = (listCompanyDocumentsAction as ReturnType<typeof vi.fn>).mock.calls.length;
    fireEvent.click(screen.getByText("다시 시도"));
    await waitFor(() =>
      expect(
        (listCompanyDocumentsAction as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeGreaterThan(before)
    );
  });
});

describe("CompanyDocumentsPanel — 폴더 이동과 파일 열기", () => {
  it("폴더를 열면 그 폴더 안을 읽고 경로가 쌓인다", async () => {
    render(<CompanyDocumentsPanel />);
    fireEvent.click(await screen.findByText("법인 서류"));
    await waitFor(() => expect(listCompanyDocumentsAction).toHaveBeenCalledWith("f1"));
    expect(screen.getAllByText("법인 서류").length).toBeGreaterThan(0);
  });

  it("파일에만 내려받기가 붙는다(폴더에는 없다)", async () => {
    render(<CompanyDocumentsPanel />);
    await waitFor(() => expect(screen.getByText("w9-blank.pdf")).toBeInTheDocument());
    expect(screen.getAllByText("내려받기")).toHaveLength(1);
  });

  it("열기 실패를 사용자 문구로 안내한다", async () => {
    (openCompanyDocumentAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: "fetch_failed",
    });
    const { container } = render(<CompanyDocumentsPanel />);
    fireEvent.click(await screen.findByText("내려받기"));
    await waitFor(() =>
      expect(screen.getByText(/잠시 뒤 다시 시도해 주세요/)).toBeInTheDocument()
    );
    expect(container.textContent).not.toContain("fetch_failed");
  });

  it("업로드·삭제 버튼을 두지 않는다(읽기 전용)", async () => {
    render(<CompanyDocumentsPanel />);
    await waitFor(() => expect(screen.getByText("w9-blank.pdf")).toBeInTheDocument());
    for (const banned of ["업로드", "삭제", "새 폴더"]) {
      expect(screen.queryByText(banned)).not.toBeInTheDocument();
    }
  });
});
