import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import DocumentsTab from "./DocumentsTab";
import { listConsentGapsAction, listCompletedConsentsAction } from "./consent-actions";

vi.mock("./company-documents-actions", () => ({
  listCompanyDocumentsAction: vi.fn(async () => ({ state: "not_configured" })),
  openCompanyDocumentAction: vi.fn(),
}));

vi.mock("./teacher-documents-actions", () => ({
  listTeacherDocumentSummariesAction: vi.fn(async () => []),
  listTeacherDocumentsAction: vi.fn(async () => []),
  getTeacherDocumentDownloadUrlAction: vi.fn(),
}));

vi.mock("./contract-archive-actions", () => ({
  listContractArchiveAction: vi.fn(async () => []),
}));

vi.mock("./consent-actions", () => ({
  listConsentGapsAction: vi.fn(),
  listCompletedConsentsAction: vi.fn(),
}));

vi.mock("./tab-data-cache", () => {
  const store = new Map<string, { data: unknown; fetchedAt: number }>();
  return {
    getCachedTabData: (k: string) => store.get(k) ?? null,
    setCachedTabData: (k: string, d: unknown) => void store.set(k, { data: d, fetchedAt: Date.now() }),
    __store: store,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  (listConsentGapsAction as ReturnType<typeof vi.fn>).mockResolvedValue([
    { childId: "s1", childName: "지훈", hasDob: false, hasActiveConsent: false },
  ]);
  (listCompletedConsentsAction as ReturnType<typeof vi.fn>).mockResolvedValue([
    { childId: "s2", childName: "이서아" },
  ]);
});

describe("DocumentsTab", () => {
  it("네 개 서브탭을 보여주고 계약을 기본으로 연다", () => {
    render(<DocumentsTab />);
    for (const label of ["회사 문서", "계약", "동의서", "교사 서류"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("계약")).toHaveAttribute("aria-pressed", "true");
  });

  it("조회·다운로드만 하는 곳임을 알려준다(발송·무효화 진입점이 아니다)", () => {
    render(<DocumentsTab />);
    expect(screen.getByText(/조회와\s*\n?\s*다운로드만 합니다/)).toBeInTheDocument();
  });

  it("동의서 서브탭에서 대기·완료 목록을 불러온다", async () => {
    render(<DocumentsTab />);
    fireEvent.click(screen.getByText("동의서"));
    await waitFor(() => expect(screen.getByText("지훈")).toBeInTheDocument());
    expect(listConsentGapsAction).toHaveBeenCalled();
    expect(listCompletedConsentsAction).toHaveBeenCalled();
  });

  it("네 서브탭이 모두 실제 화면을 연다", async () => {
    render(<DocumentsTab />);
    // 계약(기본) → 동의서 → 교사 서류 → 회사 문서 순으로 전환해도
    // "준비 중" 자리표시가 남아 있지 않다.
    for (const label of ["동의서", "교사 서류", "회사 문서"]) {
      fireEvent.click(screen.getByText(label));
      await waitFor(() => expect(screen.queryByText(/준비 중입니다/)).not.toBeInTheDocument());
    }
  });
});

// §2.4 중복 금지 규칙 — 문서 탭은 계약 쓰기 액션을 import 하지 않는다.
describe("문서 탭은 계약 쓰기 동작을 갖지 않는다", () => {
  it("발송·재발송·무효화 액션을 import 하지 않는다", async () => {
    const fs = await import("node:fs");
    const files = [
      "app/admin/DocumentsTab.tsx",
      "app/admin/ConsentGapPanel.tsx",
      "app/admin/ConsentGapSection.tsx",
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf-8");
      expect(src).not.toContain("sendRegularContractOneClickAction");
      expect(src).not.toContain("createNewContractVersionForResend");
      expect(src).not.toContain("voidContractVersion");
    }
  });
});
