import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PdfTipAdminPanel from "./PdfTipAdminPanel";
import * as tipActions from "./pdf-tip-actions";

vi.mock("@/app/materials/asset-actions", () => ({
  getAssetVersionUrlAction: vi.fn(async () => ({ ok: true, url: "https://x/old.pdf", mimeType: "application/pdf", expiresInSeconds: 600 })),
}));
vi.mock("./PdfMaterialViewer", () => ({ PdfPageThumbnail: ({ label }: { label: string }) => <div>{label}</div> }));

const state = (over: Record<string, unknown> = {}) => ({
  ok: true as const,
  state: { pendingPages: [] as number[], tipPages: [] as number[], copiedFromVersionId: null, fromPageCount: null, toPageCount: 5, ...over },
});

vi.mock("./pdf-tip-actions", () => ({
  getPdfTipReviewStateAction: vi.fn(),
  listPdfTipSourceVersionsAction: vi.fn(async () => ({ ok: true, versions: [{ id: "v0", versionNumber: 1, pageCount: 4, createdAt: "2026-01-01" }] })),
  copyPdfTipsMappedAction: vi.fn(),
  copyPdfTipPageAction: vi.fn(),
  markPdfTipPageReviewedAction: vi.fn(async () => ({ ok: true })),
  markPdfTipVersionReviewedAction: vi.fn(async () => ({ ok: true, count: 2 })),
}));

const onChanged = vi.fn();
function renderPanel(page = 1) {
  return render(<PdfTipAdminPanel docId="d1" versionId="v1" page={page} pageCount={5} refreshSignal={0} onChanged={onChanged} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tipActions.getPdfTipReviewStateAction).mockImplementation(async (id: string) =>
    (id === "v0" ? state({ tipPages: [1, 2, 3, 4], toPageCount: 4 }) : state()) as never
  );
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

async function openImport() {
  fireEvent.click(await screen.findByRole("button", { name: "Import tips from a previous version" }));
  const select = await screen.findByLabelText("Source version");
  fireEvent.change(select, { target: { value: "v0" } });
  await screen.findByTestId("pdf-tip-import-rows");
}
const targetOf = (from: number) => (screen.getByLabelText(`Target page for old page ${from}`) as HTMLSelectElement).value;

describe("팁 관리자 패널 — 검토 전·확인", () => {
  it("검토 전 쪽 수와 이 쪽 상태를 보이고, 쪽별·전체 확인을 서버에 보낸다", async () => {
    vi.mocked(tipActions.getPdfTipReviewStateAction).mockResolvedValue(
      state({ pendingPages: [1, 3], tipPages: [1, 3], copiedFromVersionId: "v0", fromPageCount: 4, toPageCount: 5 }) as never
    );
    renderPanel(1);
    expect(await screen.findByTestId("pdf-tip-pending-count")).toHaveTextContent("2 unreviewed pages");
    expect(screen.getByTestId("pdf-tip-count-warning")).toHaveTextContent("Page count changed. Check whether pages have shifted.");
    fireEvent.click(screen.getByRole("button", { name: "Mark page reviewed" }));
    await waitFor(() => expect(tipActions.markPdfTipPageReviewedAction).toHaveBeenCalledWith("v1", 1));
    fireEvent.click(screen.getByRole("button", { name: "Mark all reviewed (2)" }));
    await waitFor(() => expect(tipActions.markPdfTipVersionReviewedAction).toHaveBeenCalledWith("v1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("검토 전이 없고 쪽수가 같으면 경고·확인 버튼이 없다", async () => {
    renderPanel(2);
    await screen.findByText(/0 pages with tips/);
    expect(screen.queryByTestId("pdf-tip-count-warning")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark page reviewed" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark all reviewed/ })).toBeNull();
  });
});

describe("팁 관리자 패널 — 이전 버전 불러오기 매핑", () => {
  it("기본은 같은 쪽수, +1 밀기·맞바꾸기·건너뛰기가 행에 반영되고 쪽수 경고가 뜬다", async () => {
    renderPanel();
    await openImport();
    expect([1, 2, 3, 4].map(targetOf)).toEqual(["1", "2", "3", "4"]);
    expect(screen.getByText(/previous: 4 pages → new: 5 pages/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Shift from page"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Shift +1" }));
    expect([1, 2, 3, 4].map(targetOf)).toEqual(["1", "3", "4", "5"]);

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect([1, 2, 3, 4].map(targetOf)).toEqual(["1", "2", "3", "4"]));
    fireEvent.change(screen.getByLabelText("Swap page A"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Swap page B"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Swap" }));
    expect([1, 2, 3, 4].map(targetOf)).toEqual(["4", "2", "3", "1"]);

    fireEvent.change(screen.getByLabelText("Target page for old page 2"), { target: { value: "" } });
    expect(targetOf(2)).toBe("");
  });

  it("같은 대상 쪽으로 중복 매핑하면 실행 전에 막는다", async () => {
    renderPanel();
    await openImport();
    fireEvent.change(screen.getByLabelText("Target page for old page 3"), { target: { value: "2" } });
    expect(screen.getByTestId("pdf-tip-dup-error")).toHaveTextContent("same target page (2)");
    const run = screen.getByRole("button", { name: "Import tips" });
    expect(run).toBeDisabled();
    fireEvent.click(run);
    expect(tipActions.copyPdfTipsMappedAction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Target page for old page 3"), { target: { value: "" } }); // 건너뛰기로 해소
    expect(screen.queryByTestId("pdf-tip-dup-error")).toBeNull();
    expect(screen.getByRole("button", { name: "Import tips" })).toBeEnabled();
  });

  it("대상에 팁이 있으면 덮어쓰기 확인 후 다시 보내고, 결과 요약을 보인다. 확인을 거절하면 아무것도 하지 않는다", async () => {
    const base = { skipped: [], dropped: [], pageCountChanged: true, fromPageCount: 4, toPageCount: 5 };
    vi.mocked(tipActions.copyPdfTipsMappedAction)
      .mockResolvedValueOnce({ ok: true, status: "needs_confirmation", copied: [], conflicts: [2], ...base } as never)
      .mockResolvedValueOnce({ ok: true, status: "done", copied: [1, 2, 3, 4], conflicts: [2], ...base } as never);
    renderPanel();
    await openImport();
    fireEvent.click(screen.getByRole("button", { name: "Import tips" }));
    await waitFor(() => expect(tipActions.copyPdfTipsMappedAction).toHaveBeenCalledTimes(2));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Page 2 already has tips"));
    const [first, second] = vi.mocked(tipActions.copyPdfTipsMappedAction).mock.calls.map((c) => c[0]);
    expect(first).toMatchObject({ fromVersionId: "v0", toVersionId: "v1", overwrite: false, mapping: [{ from: 1, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 3 }, { from: 4, to: 4 }] });
    expect(second.overwrite).toBe(true);
    const summary = await screen.findByTestId("pdf-tip-import-summary");
    expect(summary).toHaveTextContent("Copied 4 pages");
    expect(summary).toHaveTextContent("overwrote 1");
    expect(summary).toHaveTextContent("unreviewed");

    // 거절.
    vi.clearAllMocks();
    vi.mocked(window.confirm).mockReturnValue(false);
    vi.mocked(tipActions.copyPdfTipsMappedAction).mockResolvedValueOnce({ ok: true, status: "needs_confirmation", copied: [], conflicts: [2], ...base } as never);
    fireEvent.click(screen.getByRole("button", { name: "Import tips" }));
    await waitFor(() => expect(screen.getByTestId("pdf-tip-import-summary")).toHaveTextContent("Overwrite cancelled"));
    expect(tipActions.copyPdfTipsMappedAction).toHaveBeenCalledTimes(1);
  });

  it("서버 오류를 그대로 보여 준다", async () => {
    vi.mocked(tipActions.copyPdfTipsMappedAction).mockResolvedValueOnce({ ok: false, error: "Only admins can import tips." });
    renderPanel();
    await openImport();
    fireEvent.click(screen.getByRole("button", { name: "Import tips" }));
    const panel = screen.getByTestId("pdf-tip-import-panel");
    expect(await within(panel).findByRole("alert")).toHaveTextContent("Only admins");
  });
});

describe("팁 관리자 패널 — 같은 버전 안 복사·이동", () => {
  it("쪽 번호 검증, 충돌 시 확인 후 덮어쓰기", async () => {
    vi.mocked(tipActions.copyPdfTipPageAction)
      .mockResolvedValueOnce({ ok: true, status: "needs_confirmation" })
      .mockResolvedValueOnce({ ok: true, status: "done" });
    renderPanel(1);
    await screen.findByText(/with tips/);
    fireEvent.click(screen.getByRole("button", { name: "Move to page" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("between 1 and 5");
    fireEvent.change(screen.getByLabelText("Target page number"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Move to page" }));
    await waitFor(() => expect(tipActions.copyPdfTipPageAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(tipActions.copyPdfTipPageAction).mock.calls[0][0]).toEqual({ versionId: "v1", fromPage: 1, toPage: 3, move: true, overwrite: false });
    expect(vi.mocked(tipActions.copyPdfTipPageAction).mock.calls[1][0].overwrite).toBe(true);
    expect(await screen.findByRole("status")).toHaveTextContent("Moved tips from page 1 to page 3.");
    expect(onChanged).toHaveBeenCalled();
  });
});
