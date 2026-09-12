import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ContractArchivePanel from "./ContractArchivePanel";
import { listContractArchiveAction } from "./contract-archive-actions";
import type { ContractArchiveRow } from "./contract-archive-data";

vi.mock("./contract-archive-actions", () => ({ listContractArchiveAction: vi.fn() }));

const base: ContractArchiveRow = {
  contractId: "ct-1",
  studentName: "지훈",
  guardianName: "김민지",
  status: "active",
  createdAt: "2026-09-01T00:00:00Z",
  latestVersionId: "cv-1",
  latestVersionNumber: 2,
  envelopeStatus: "completed",
  envelopeStatusUpdatedAt: "2026-09-02T00:00:00Z",
  companySignedAt: "2026-09-02T00:00:00Z",
  signedArtifactId: "da-1",
  signedArtifactSyncStatus: "succeeded",
  signedArtifactDownloadable: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  (listContractArchiveAction as ReturnType<typeof vi.fn>).mockResolvedValue([base]);
  vi.stubGlobal("fetch", vi.fn());
});

describe("ContractArchivePanel", () => {
  it("계약을 사람이 읽는 상태 이름으로 보여준다(내부 상태값 노출 금지)", async () => {
    const { container } = render(<ContractArchivePanel />);
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    // 상태 필터의 <option>에도 같은 말이 있으므로 배지 쪽(span)만 본다.
    expect(
      screen.getAllByText("이용 중").some((el) => el.tagName === "SPAN")
    ).toBe(true);
    // 필터 <option>과 겹치지 않게 행 안쪽만 본다.
    const row = screen.getByText("지훈").closest("div")?.parentElement;
    expect(row?.textContent).toContain("서명 완료");
    expect(row?.textContent).toContain("보관 완료");
    // 내부 상태값은 화면에 나타나지 않는다.
    expect(container.textContent).not.toContain("succeeded");
    expect(container.textContent).not.toContain("awaiting_signature");
  });

  it("보관 완료된 서명본만 내려받기 버튼을 준다", async () => {
    render(<ContractArchivePanel />);
    await waitFor(() => expect(screen.getByText("서명본 내려받기")).toBeInTheDocument());
  });

  it("서명본이 아예 없는 경우와 아직 보관되지 않은 경우를 구분해 알려준다", async () => {
    (listContractArchiveAction as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...base, contractId: "ct-2", signedArtifactId: null, signedArtifactSyncStatus: null, signedArtifactDownloadable: false },
      { ...base, contractId: "ct-3", signedArtifactSyncStatus: "retryable_failed", signedArtifactDownloadable: false },
    ]);
    render(<ContractArchivePanel />);
    await waitFor(() => expect(screen.getByText("서명본이 아직 없습니다")).toBeInTheDocument());
    expect(screen.getByText("아직 보관되지 않아 내려받을 수 없습니다")).toBeInTheDocument();
    expect(screen.getByText(/보관 실패\(재시도 가능\)/)).toBeInTheDocument();
    expect(screen.queryByText("서명본 내려받기")).not.toBeInTheDocument();
  });

  it("목록·상세·다운로드가 같은 서명본을 가리킨다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["pdf"]),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });

    render(<ContractArchivePanel />);
    await waitFor(() => expect(screen.getByText("서명본 내려받기")).toBeInTheDocument());
    fireEvent.click(screen.getByText("서명본 내려받기"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/contract-artifacts/da-1")
    );
  });

  it("다운로드 실패 사유를 서버 응답 그대로 보여준다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "아직 보관되지 않은 문서입니다." }),
      })
    );
    render(<ContractArchivePanel />);
    await waitFor(() => expect(screen.getByText("서명본 내려받기")).toBeInTheDocument());
    fireEvent.click(screen.getByText("서명본 내려받기"));
    await waitFor(() =>
      expect(screen.getByText("아직 보관되지 않은 문서입니다.")).toBeInTheDocument()
    );
  });

  it("검색·상태 필터가 서버 조회에 전달된다", async () => {
    render(<ContractArchivePanel />);
    await waitFor(() => expect(listContractArchiveAction).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("학생·보호자 이름으로 찾기"), {
      target: { value: "지훈" },
    });
    await waitFor(() =>
      expect(listContractArchiveAction).toHaveBeenCalledWith(
        expect.objectContaining({ search: "지훈" })
      )
    );
  });

  it("발송·재발송·무효화 버튼을 두지 않는다", async () => {
    render(<ContractArchivePanel />);
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    for (const label of ["발송", "재발송", "무효화"]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});

describe("계약 아카이브는 쓰기 액션을 갖지 않는다", () => {
  it("발송·무효화 액션을 import 하지 않는다", async () => {
    const fs = await import("node:fs");
    for (const f of [
      "app/admin/ContractArchivePanel.tsx",
      "app/admin/contract-archive-actions.ts",
      "app/admin/contract-archive-data.ts",
    ]) {
      const src = fs.readFileSync(f, "utf-8");
      expect(src).not.toContain("sendRegularContractOneClickAction");
      expect(src).not.toContain("createNewContractVersionForResend");
      expect(src).not.toContain("voidContractVersion");
    }
  });
});
