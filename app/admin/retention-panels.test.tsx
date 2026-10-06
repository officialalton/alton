import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LegalHoldsPanel from "./LegalHoldsPanel";
import DeletionQueuePanel from "./DeletionQueuePanel";
import { isReviewOverdue, reviewByError, reasonError } from "./retention-data";
import * as actions from "./retention-actions";
import type { LegalHoldsView, DeletionQueueView } from "./retention-data";

vi.mock("./retention-actions", () => ({
  loadLegalHoldsAction: vi.fn(),
  searchHoldTargetsAction: vi.fn(),
  placeLegalHoldAction: vi.fn(),
  extendLegalHoldAction: vi.fn(),
  releaseLegalHoldAction: vi.fn(),
  requestLegalHoldAction: vi.fn(),
  decideLegalHoldRequestAction: vi.fn(),
  loadDeletionQueueAction: vi.fn(),
  retryDeletionTargetAction: vi.fn(),
}));
const a = vi.mocked(actions);

const hold = (over = {}) => ({
  id: "h1", subjectType: "profile" as const, subjectId: "p1", subjectLabel: "김학생", scope: ["all"],
  reason: "분쟁 대응을 위한 보류", setByName: "담당자", setAt: "2026-09-01T00:00:00Z", reviewBy: "2999-01-01",
  releasedAt: null, releasedByName: null, releaseNote: null,
  events: [{ id: "e1", eventType: "placed" as const, actorName: "담당자", reviewBy: "2999-01-01", note: "분쟁 대응을 위한 보류", createdAt: "2026-09-01T00:00:00Z" }],
  ...over,
});
const req = (over = {}) => ({
  id: "r1", subjectType: "household" as const, subjectId: "x", subjectLabel: null, scope: ["all"], reason: "소송 가능성 때문에 요청",
  requestedByName: "운영자", requestedByMe: true, requestedAt: "2026-09-02T00:00:00Z", status: "pending" as const,
  decidedByName: null, decidedAt: null, decisionNote: null, ...over,
});
const view = (over: Partial<LegalHoldsView> = {}): LegalHoldsView => ({ isHolder: true, holds: [hold()], requests: [], ...over });

beforeEach(() => vi.clearAllMocks());

describe("retention-data 규칙", () => {
  it("재검토일 경과·범위·사유 검증", () => {
    expect(isReviewOverdue("2020-01-01")).toBe(true);
    expect(isReviewOverdue("2999-01-01")).toBe(false);
    expect(reviewByError("", new Date(2026, 9, 7))).toBeTruthy();
    expect(reviewByError("2026-10-07", new Date(2026, 9, 7))).toBeTruthy();
    expect(reviewByError("2026-10-08", new Date(2026, 9, 7))).toBeNull();
    expect(reviewByError("2027-10-09", new Date(2026, 9, 7))).toBeTruthy();
    expect(reasonError("짧음")).toBeTruthy();
    expect(reasonError("충분히 긴 사유 입니다 정말")).toBeNull();
  });
});

describe("LegalHoldsPanel", () => {
  it("로딩 → 활성 보류 표시, 재검토 경과는 빨간 배지(자동 해제 없음 안내)", async () => {
    a.loadLegalHoldsAction.mockResolvedValue(view({ holds: [hold(), hold({ id: "h2", reviewBy: "2020-01-01" })] }));
    render(<LegalHoldsPanel />);
    expect(screen.getByText("불러오는 중…")).toBeInTheDocument();
    expect(await screen.findByText("활성 보류 2건")).toBeInTheDocument();
    const overdue = screen.getByTestId("hold-h2");
    expect(within(overdue).getByTestId("overdue-badge")).toHaveTextContent("해제 전까지 보류 유지");
    expect(within(screen.getByTestId("hold-h1")).queryByTestId("overdue-badge")).toBeNull();
    expect(a.loadLegalHoldsAction).toHaveBeenCalledTimes(1);
  });

  it("빈 상태·오류 상태", async () => {
    a.loadLegalHoldsAction.mockResolvedValueOnce(view({ holds: [] }));
    const { unmount } = render(<LegalHoldsPanel />);
    expect(await screen.findByText("활성 보류가 없습니다.")).toBeInTheDocument();
    unmount();
    a.loadLegalHoldsAction.mockRejectedValueOnce(new Error("boom"));
    render(<LegalHoldsPanel />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("지정자: 연장·해제 버튼과 대기 요청 승인(재검토일 필수) 노출, 연장 호출", async () => {
    a.loadLegalHoldsAction.mockResolvedValue(view({ requests: [req()] }));
    a.extendLegalHoldAction.mockResolvedValue({ ok: true });
    a.decideLegalHoldRequestAction.mockResolvedValue({ ok: true });
    render(<LegalHoldsPanel />);
    expect(await screen.findByText("대기 중 요청 1건")).toBeInTheDocument();
    const card = screen.getByTestId("hold-h1");
    fireEvent.click(within(card).getByText("연장"));
    fireEvent.change(within(card).getByLabelText("연장 사유"), { target: { value: "계속 분쟁 중이라 연장" } });
    fireEvent.change(within(card).getByLabelText("새 재검토일"), { target: { value: "2999-02-02" } });
    fireEvent.click(within(card).getByText("연장 확정"));
    await waitFor(() => expect(a.extendLegalHoldAction).toHaveBeenCalledWith("h1", "계속 분쟁 중이라 연장", "2999-02-02"));
    // 승인
    const r = screen.getByTestId("request-r1");
    fireEvent.change(within(r).getByLabelText("승인 재검토일"), { target: { value: "2999-03-03" } });
    fireEvent.click(within(r).getByText("승인"));
    await waitFor(() => expect(a.decideLegalHoldRequestAction).toHaveBeenCalledWith("r1", true, "", "2999-03-03"));
  });

  it("비지정 관리자: 설정·연장·해제·승인 UI 없음, '보류 요청'과 내 요청만", async () => {
    a.loadLegalHoldsAction.mockResolvedValue(view({ isHolder: false, requests: [req()] }));
    render(<LegalHoldsPanel />);
    expect(await screen.findByText("내 요청")).toBeInTheDocument();
    expect(screen.queryByText("연장")).toBeNull();
    expect(screen.queryByText("해제")).toBeNull();
    expect(screen.queryByText("승인")).toBeNull();
    expect(screen.queryByText("보류 설정")).toBeNull();
    a.requestLegalHoldAction.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByText("보류 요청"));
    const form = screen.getByTestId("new-hold-form");
    expect(within(form).queryByLabelText("재검토일")).toBeNull();
    fireEvent.change(within(form).getByLabelText("대상 종류"), { target: { value: "global" } });
    fireEvent.change(within(form).getByLabelText("사유"), { target: { value: "전체 보류가 필요한 사유입니다" } });
    fireEvent.click(within(form).getByText("요청 보내기"));
    await waitFor(() =>
      expect(a.requestLegalHoldAction).toHaveBeenCalledWith({ subjectType: "global", subjectId: null, reason: "전체 보류가 필요한 사유입니다" })
    );
  });

  it("보류 설정 오류는 폼에 표시된다", async () => {
    a.loadLegalHoldsAction.mockResolvedValue(view({ holds: [] }));
    a.placeLegalHoldAction.mockResolvedValue({ ok: false, error: "사유는 10자 이상 입력해 주세요." });
    render(<LegalHoldsPanel />);
    fireEvent.click(await screen.findByText("보류 설정"));
    const form = screen.getByTestId("new-hold-form");
    fireEvent.change(within(form).getByLabelText("대상 종류"), { target: { value: "global" } });
    fireEvent.click(within(form).getByText("보류 설정", { selector: "button" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("10자");
  });
});

const row = (over = {}) => ({
  id: "t1", category: "lesson_ai_artifacts", sourceTable: "session_smart_notes", driveFileId: "drv-1", status: "failed" as const,
  attempts: 3, lastError: "403 forbidden", firstFailedAt: "2026-09-01T00:00:00Z", escalatedAt: null,
  dueAt: "2026-08-01T00:00:00Z", nextAttemptAt: "2026-10-01T00:00:00Z", deletedAt: null, ...over,
});
const qview = (over: Partial<DeletionQueueView> = {}): DeletionQueueView => ({ canRetry: true, rows: [row(), row({ id: "t2", status: "deleted", deletedAt: "2026-09-05T00:00:00Z", lastError: null })], truncated: false, ...over });

describe("DeletionQueuePanel", () => {
  it("실패 건은 오류·file id와 함께 보이고 재시도만 가능(삭제·완료 버튼 없음)", async () => {
    a.loadDeletionQueueAction.mockResolvedValue(qview());
    a.retryDeletionTargetAction.mockResolvedValue({ ok: true });
    render(<DeletionQueuePanel />);
    const failed = await screen.findByTestId("target-t1");
    expect(failed).toHaveTextContent("drv-1");
    expect(failed).toHaveTextContent("403 forbidden");
    expect(within(screen.getByTestId("target-t2")).queryByText("지금 재시도")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^삭제$|삭제하기|완료 처리/ })).toHaveLength(0);
    fireEvent.click(within(failed).getByText("지금 재시도"));
    await waitFor(() => expect(a.retryDeletionTargetAction).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(a.loadDeletionQueueAction).toHaveBeenCalledTimes(2));
  });

  it("재시도 권한이 없으면 버튼이 없고, 서버 거부(hold)는 행에 표시된다", async () => {
    a.loadDeletionQueueAction.mockResolvedValueOnce(qview({ canRetry: false }));
    const { unmount } = render(<DeletionQueuePanel />);
    await screen.findByTestId("target-t1");
    expect(screen.queryByText("지금 재시도")).toBeNull();
    unmount();
    a.loadDeletionQueueAction.mockResolvedValue(qview());
    a.retryDeletionTargetAction.mockResolvedValue({ ok: false, error: "활성 legal hold가 걸린 건은 재시도할 수 없습니다." });
    render(<DeletionQueuePanel />);
    fireEvent.click(await screen.findByText("지금 재시도"));
    expect(await screen.findByRole("alert")).toHaveTextContent("legal hold");
  });

  it("필터와 빈 상태", async () => {
    a.loadDeletionQueueAction.mockResolvedValue(qview({ rows: [row()] }));
    render(<DeletionQueuePanel />);
    await screen.findByTestId("target-t1");
    fireEvent.click(screen.getByText("대기"));
    expect(screen.getByText("표시할 항목이 없습니다.")).toBeInTheDocument();
  });
});
