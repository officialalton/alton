import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import TeacherDocumentsPanel from "./TeacherDocumentsPanel";
import {
  listTeacherDocumentSummariesAction,
  listTeacherDocumentsAction,
  getTeacherDocumentDownloadUrlAction,
} from "./teacher-documents-actions";

vi.mock("./teacher-documents-actions", () => ({
  listTeacherDocumentSummariesAction: vi.fn(),
  listTeacherDocumentsAction: vi.fn(),
  getTeacherDocumentDownloadUrlAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (listTeacherDocumentSummariesAction as ReturnType<typeof vi.fn>).mockResolvedValue([
    { teacherId: "t1", teacherName: "박서연", documentCount: 2, lastUploadedAt: "2026-09-10T00:00:00Z" },
  ]);
  (listTeacherDocumentsAction as ReturnType<typeof vi.fn>).mockResolvedValue([
    {
      id: "d1",
      fileName: "w9.pdf",
      contentType: "application/pdf",
      sizeBytes: 20480,
      note: null,
      uploadedAt: "2026-09-10T00:00:00Z",
    },
  ]);
  (getTeacherDocumentDownloadUrlAction as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    url: "https://signed.example/w9.pdf",
  });
  vi.stubGlobal("open", vi.fn());
});

describe("TeacherDocumentsPanel", () => {
  it("교사별 제출 건수와 최근 제출 시각만 보여준다", async () => {
    render(<TeacherDocumentsPanel />);
    await waitFor(() => expect(screen.getByText("박서연")).toBeInTheDocument());
    expect(screen.getByText("2건")).toBeInTheDocument();
  });

  it("승인·검토·미제출 같은 판정 배지를 만들지 않는다", async () => {
    const { container } = render(<TeacherDocumentsPanel />);
    await waitFor(() => expect(screen.getByText("박서연")).toBeInTheDocument());
    for (const banned of ["미제출", "검토 필요", "승인됨", "반려"]) {
      expect(container.textContent).not.toContain(banned);
    }
  });

  it("업로드·삭제 버튼을 두지 않는다(창구는 교사 포털 하나뿐)", async () => {
    render(<TeacherDocumentsPanel />);
    await waitFor(() => expect(screen.getByText("박서연")).toBeInTheDocument());
    for (const banned of ["업로드", "삭제", "대체"]) {
      expect(screen.queryByText(banned)).not.toBeInTheDocument();
    }
  });

  it("제출 여부가 업무 조건이 아님을 화면에서 밝힌다", async () => {
    render(<TeacherDocumentsPanel />);
    await waitFor(() =>
      expect(screen.getByText(/정산·매칭·수업 어느 것의 조건도 아닙니다/)).toBeInTheDocument()
    );
  });

  it("교사를 펼치면 그 교사의 서류만 조회한다", async () => {
    render(<TeacherDocumentsPanel />);
    fireEvent.click(await screen.findByText("서류 보기"));
    await waitFor(() => expect(listTeacherDocumentsAction).toHaveBeenCalledWith("t1"));
    expect(await screen.findByText("w9.pdf")).toBeInTheDocument();
  });

  it("열기를 누르면 링크를 발급받아 새 창으로 연다", async () => {
    render(<TeacherDocumentsPanel />);
    fireEvent.click(await screen.findByText("서류 보기"));
    fireEvent.click(await screen.findByText("열기"));
    await waitFor(() => expect(getTeacherDocumentDownloadUrlAction).toHaveBeenCalledWith("d1"));
    await waitFor(() => expect(screen.getByText("새 창에서 열었습니다.")).toBeInTheDocument());
    // 내려받았다고 단정하지 않는다 — 링크를 열어준 것까지가 아는 전부다.
    expect(screen.queryByText("내려받았습니다.")).not.toBeInTheDocument();
  });

  it("링크 발급 실패를 사용자 문구로 안내한다", async () => {
    (getTeacherDocumentDownloadUrlAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: "link_failed",
    });
    const { container } = render(<TeacherDocumentsPanel />);
    fireEvent.click(await screen.findByText("서류 보기"));
    fireEvent.click(await screen.findByText("열기"));
    await waitFor(() =>
      expect(screen.getByText(/잠시 뒤 다시 시도해 주세요/)).toBeInTheDocument()
    );
    expect(container.textContent).not.toContain("link_failed");
  });

  it("권한이 없으면 사유를 보여준다", async () => {
    (listTeacherDocumentSummariesAction as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("이 작업을 수행할 권한이 없습니다.")
    );
    render(<TeacherDocumentsPanel />);
    await waitFor(() =>
      expect(screen.getByText("이 작업을 수행할 권한이 없습니다.")).toBeInTheDocument()
    );
  });
});

describe("모든 서버 진입점에 관리자 게이트가 걸려 있다", () => {
  it("teacher-documents-actions의 export 함수마다 requireAdmin을 부른다", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/admin/teacher-documents-actions.ts", "utf-8");

    const exported = [...src.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    expect(exported.length).toBeGreaterThan(0);

    for (const name of exported) {
      const start = src.indexOf(`export async function ${name}`);
      const next = exported
        .map((n) => src.indexOf(`export async function ${n}`))
        .filter((i) => i > start)
        .sort((a, b) => a - b)[0];
      const body = src.slice(start, next === undefined ? src.length : next);
      expect(body).toContain("requireAdmin()");
    }
  });

  it("계정 id를 하드코딩하지 않고 공통 권한 검사 함수를 쓴다", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/admin/teacher-documents-actions.ts", "utf-8");
    expect(src).toContain('from "@/lib/admin-auth"');
    // 특정 관리자 계정 uuid를 코드에 박아두지 않는다.
    expect(src).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  it("업로드·삭제 경로를 갖지 않는다(읽기 전용)", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("app/admin/teacher-documents-actions.ts", "utf-8");
    expect(src).not.toContain(".upload(");
    expect(src).not.toContain(".delete()");
    expect(src).not.toContain(".remove(");
  });
});
