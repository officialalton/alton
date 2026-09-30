import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssetMaterialViewer from "./AssetMaterialViewer";
import * as tipActions from "./pdf-tip-actions";

// 교사용 팁 노출 경계 — 선생님 토글(기본 표시·선택 유지), 학생·보호자 화면 비노출(요청 0), 관리자 편집.

vi.mock("@/app/materials/asset-actions", () => ({
  getAssetVersionUrlAction: vi.fn(async () => ({ ok: true, url: "https://x/y.pdf", mimeType: "application/pdf", expiresInSeconds: 600 })),
}));
vi.mock("./PdfMaterialViewer", async () => {
  const React = await import("react");
  return {
    default: function FakePdfPage({ onRendered }: { onRendered: (s: { width: number; height: number }) => void }) {
      React.useEffect(() => onRendered({ width: 600, height: 340 }), [onRendered]);
      return <div data-testid="pdf-page-canvas" />;
    },
    PdfPageThumbnail: () => <div />,
  };
});
vi.mock("./PdfPageAnnotationLayer", () => ({ default: () => <div data-testid="pdf-page-annotation-layer" /> }));
vi.mock("./VideoMaterialPlayer", () => ({ default: () => <div /> }));
vi.mock("./pdf-tip-actions", () => ({
  loadPdfTipStrokes: vi.fn(async () => []),
  appendPdfTipEvents: vi.fn(async () => ({ savedEventIds: [] })),
  getPdfTipReviewStateAction: vi.fn(async () => ({
    ok: true,
    state: { pendingPages: [1], tipPages: [1], copiedFromVersionId: "v0", fromPageCount: 2, toPageCount: 3 },
  })),
  markPdfTipPageReviewedAction: vi.fn(async () => ({ ok: true })),
  markPdfTipVersionReviewedAction: vi.fn(async () => ({ ok: true, count: 1 })),
  listPdfTipSourceVersionsAction: vi.fn(async () => ({ ok: true, versions: [] })),
  copyPdfTipPageAction: vi.fn(),
  copyPdfTipsMappedAction: vi.fn(),
}));

const assets = [{ docId: "d1", versionId: "v1", kind: "pdf" as const, title: "자료", pageCount: 3, mimeType: "application/pdf" }];
const memory = new Map<string, string>();

beforeEach(() => {
  vi.clearAllMocks();
  memory.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
      removeItem: (k: string) => void memory.delete(k),
    },
  });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(), fillText: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe("교사용 팁 — 선생님 화면", () => {
  it("기본으로 팁 레이어를 보이고 쪽당 1회만 조회하며, 숨기면 조회·레이어가 없고 선택이 기기에 남는다", async () => {
    const { unmount } = render(<AssetMaterialViewer assets={assets} sessionId="s1" role="teacher" viewerUserId="t1" tipAccess="view" />);
    const toggle = await screen.findByTestId("pdf-tip-toggle");
    expect(toggle).toHaveTextContent("교사용 팁 숨기기");
    expect(await screen.findByTestId("pdf-tip-layer-root")).toHaveAttribute("data-mode", "view");
    await waitFor(() => expect(tipActions.loadPdfTipStrokes).toHaveBeenCalledTimes(1));
    expect(tipActions.loadPdfTipStrokes).toHaveBeenCalledWith("v1", 1);

    fireEvent.click(toggle);
    expect(screen.queryByTestId("pdf-tip-layer-root")).toBeNull();
    expect(screen.getByTestId("pdf-tip-toggle")).toHaveTextContent("교사용 팁 보기");
    expect(tipActions.loadPdfTipStrokes).toHaveBeenCalledTimes(1); // 숨김 = 추가 요청 0
    expect(memory.get("alton:pdf-tip-visible")).toBe("0");
    unmount();

    // 다시 열면 숨김이 유지되고 요청도 없다.
    vi.clearAllMocks();
    render(<AssetMaterialViewer assets={assets} sessionId="s1" role="teacher" viewerUserId="t1" tipAccess="view" />);
    await waitFor(() => expect(screen.getByTestId("pdf-tip-toggle")).toHaveTextContent("교사용 팁 보기"));
    expect(screen.queryByTestId("pdf-tip-layer-root")).toBeNull();
    expect(tipActions.loadPdfTipStrokes).not.toHaveBeenCalled();
  });
});

describe("교사용 팁 — 학생·보호자 화면", () => {
  it.each(["student", "reader"] as const)("%s 역할(tipAccess=none)은 토글·레이어·요청이 전혀 없다", async (role) => {
    render(<AssetMaterialViewer assets={assets} sessionId="s1" role={role} viewerUserId="u1" tipAccess="none" />);
    await screen.findByTestId("pdf-page-canvas");
    expect(screen.queryByTestId("pdf-tip-toggle")).toBeNull();
    expect(screen.queryByTestId("pdf-tip-layer-root")).toBeNull();
    expect(screen.queryByTestId("pdf-tip-edit-toggle")).toBeNull();
    expect(tipActions.loadPdfTipStrokes).not.toHaveBeenCalled();
    expect(tipActions.getPdfTipReviewStateAction).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("교사용 팁");
  });

  it("tipAccess 를 주지 않아도(기본값) 비노출이다", async () => {
    render(<AssetMaterialViewer assets={assets} sessionId="s1" role="student" viewerUserId="u1" />);
    await screen.findByTestId("pdf-page-canvas");
    expect(screen.queryByTestId("pdf-tip-toggle")).toBeNull();
    expect(tipActions.loadPdfTipStrokes).not.toHaveBeenCalled();
  });
});

describe("교사용 팁 — 관리자 편집", () => {
  it("팁 편집을 켜면 편집 레이어와 검토 전·쪽수 경고·확인 버튼이 보이고, 끄면 사라진다", async () => {
    render(<AssetMaterialViewer assets={assets} sessionId={null} role="reader" viewerUserId="a1" tipAccess="edit" />);
    expect(screen.queryByTestId("pdf-tip-layer-root")).toBeNull();
    fireEvent.click(await screen.findByTestId("pdf-tip-edit-toggle"));
    expect(await screen.findByTestId("pdf-tip-layer-root")).toHaveAttribute("data-mode", "edit");
    expect(await screen.findByTestId("pdf-tip-pending-count")).toHaveTextContent("검토 전 1쪽");
    expect(screen.getByTestId("pdf-tip-count-warning")).toHaveTextContent("쪽수가 달라졌습니다. 페이지가 밀렸는지 확인하세요.");

    fireEvent.click(screen.getByRole("button", { name: "이 쪽 확인" }));
    await waitFor(() => expect(tipActions.markPdfTipPageReviewedAction).toHaveBeenCalledWith("v1", 1));
    fireEvent.click(screen.getByRole("button", { name: /전체 확인/ }));
    await waitFor(() => expect(tipActions.markPdfTipVersionReviewedAction).toHaveBeenCalledWith("v1"));

    fireEvent.click(screen.getByTestId("pdf-tip-edit-toggle"));
    expect(screen.queryByTestId("pdf-tip-layer-root")).toBeNull();
  });
});
