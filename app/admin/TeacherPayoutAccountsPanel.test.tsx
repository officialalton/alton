import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-2 — 관리자 `정산` > `수취 계좌`. 교사 화면과 같은 원본·같은 마스킹을 쓰는지와
// 변경 이력 표시를 검증한다. 수정·전체 번호 보기는 정산권한·마스터만 가능하다(권한 없으면 버튼이 없어야 한다).

const { listMock, permMock, revealMock, saveMock } = vi.hoisted(() => ({ listMock: vi.fn(), permMock: vi.fn(), revealMock: vi.fn(), saveMock: vi.fn() }));
vi.mock("./teacher-payout-accounts-actions", () => ({
  listTeacherPayoutAccountsAction: listMock,
  getPayoutAccountStaffPermissionAction: permMock,
  revealTeacherPayoutAccountAction: revealMock,
  saveTeacherPayoutAccountByAdminAction: saveMock,
}));

import TeacherPayoutAccountsPanel from "./TeacherPayoutAccountsPanel";

const ROW = {
  teacherId: "t1",
  teacherName: "김선생",
  registered: true,
  swiftOrRoutingMasked: null,
  enteredByAdmin: false,
  accountHolderName: "김선생",
  bankName: "국민은행",
  accountNumberMasked: "****6789",
  currency: "KRW",
  country: null,
  updatedAt: "2026-09-12T03:00:00.000Z",
  changes: [
    {
      id: "e1",
      action: "updated",
      changedFields: ["bank_name", "account_number"],
      previousLast4: "1111",
      newLast4: "6789",
      enteredByAdmin: false,
      createdAt: "2026-09-12T03:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([ROW]);
  permMock.mockResolvedValue({ canManage: true });
});

describe("TeacherPayoutAccountsPanel", () => {
  it("마스킹된 계좌번호만 보여준다", async () => {
    render(<TeacherPayoutAccountsPanel />);
    expect(await screen.findByTestId("masked-t1")).toHaveTextContent("****6789");
    expect(screen.queryByText(/110-123/)).not.toBeInTheDocument();
  });

  it("권한이 없으면(정산권한·마스터 아님) 입력·전체 번호 보기 버튼이 없다", async () => {
    permMock.mockResolvedValue({ canManage: false });
    render(<TeacherPayoutAccountsPanel />);
    await screen.findByTestId("masked-t1");
    await waitFor(() => expect(permMock).toHaveBeenCalled());
    expect(screen.queryByTestId("reveal-t1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-t1")).not.toBeInTheDocument();
  });

  it("전체 번호 보기: 눌러야만 번호가 나오고 감사 액션을 호출하며, 목록에는 번호가 없다", async () => {
    revealMock.mockResolvedValue({ accountHolderName: "김선생", bankName: "국민은행", accountNumber: "110123456789", swiftOrRouting: null, currency: "KRW", country: "KR" });
    render(<TeacherPayoutAccountsPanel />);
    await screen.findByTestId("masked-t1");
    expect(screen.queryByText(/110123456789/)).not.toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("reveal-t1"));
    // 사유 없이는 호출하지 않는다.
    fireEvent.click(await screen.findByTestId("reveal-confirm-t1"));
    expect(await screen.findByTestId("error-t1")).toHaveTextContent("5자 이상");
    expect(revealMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("열람 사유"), { target: { value: "10월 수동 송금" } });
    fireEvent.click(screen.getByTestId("reveal-confirm-t1"));
    expect(await screen.findByTestId("revealed-number-t1")).toHaveTextContent("110123456789");
    expect(revealMock).toHaveBeenCalledWith("t1", "10월 수동 송금");
    fireEvent.click(screen.getByText("지금 숨기기"));
    expect(screen.queryByTestId("revealed-number-t1")).not.toBeInTheDocument();
  });

  it("미등록 교사는 '미등록'으로 보이고 대신 입력 폼을 열어 저장할 수 있다", async () => {
    listMock.mockResolvedValue([{ ...ROW, teacherId: "t2", teacherName: "박선생", registered: false, accountHolderName: "", bankName: "", accountNumberMasked: "", currency: "", updatedAt: null, changes: [] }]);
    saveMock.mockResolvedValue({ status: "saved", changedFields: [] });
    render(<TeacherPayoutAccountsPanel />);
    expect(await screen.findByTestId("not-registered-t2")).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("edit-t2"));
    fireEvent.change(screen.getByLabelText("예금주"), { target: { value: "박선생" } });
    fireEvent.change(screen.getByLabelText("은행명"), { target: { value: "신한은행" } });
    fireEvent.change(screen.getByLabelText("계좌번호"), { target: { value: "110-222-333444" } });
    fireEvent.click(screen.getByTestId("save-t2"));
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith("t2", expect.objectContaining({ accountNumber: "110-222-333444", currency: "KRW" })));
  });

  it("서버 검증 오류를 한국어로 보여준다", async () => {
    saveMock.mockResolvedValue({ status: "invalid", message: "계좌번호 자릿수가 맞지 않습니다(KRW 8~16자리, USD 4~17자리)." });
    render(<TeacherPayoutAccountsPanel />);
    fireEvent.click(await screen.findByTestId("edit-t1"));
    fireEvent.click(screen.getByTestId("save-t1"));
    expect(await screen.findByTestId("error-t1")).toHaveTextContent("자릿수");
  });

  it("변경 이력을 펼치면 바뀐 필드와 끝 4자리 전·후를 보여준다", async () => {
    render(<TeacherPayoutAccountsPanel />);
    fireEvent.click(await screen.findByTestId("history-t1"));
    expect(screen.getByText(/은행명, 계좌번호/)).toBeInTheDocument();
    expect(screen.getByText(/\*\*\*\*1111 → \*\*\*\*6789/)).toBeInTheDocument();
  });

  it("등록된 계좌가 없으면 빈 상태 문구를 보여준다", async () => {
    listMock.mockResolvedValue([]);
    render(<TeacherPayoutAccountsPanel />);
    expect(await screen.findByTestId("payout-accounts-empty")).toBeInTheDocument();
  });
});
