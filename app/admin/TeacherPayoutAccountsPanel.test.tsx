import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-2 — 관리자 `정산` > `수취 계좌`. 교사 화면과 같은 원본·같은 마스킹을 쓰는지와
// 변경 이력 표시를 검증한다. 관리자는 조회 전용이다(수정 버튼이 없어야 한다).

const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));
vi.mock("./teacher-payout-accounts-actions", () => ({ listTeacherPayoutAccountsAction: listMock }));

import TeacherPayoutAccountsPanel from "./TeacherPayoutAccountsPanel";

const ROW = {
  teacherId: "t1",
  teacherName: "김선생",
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
      createdAt: "2026-09-12T03:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([ROW]);
});

describe("TeacherPayoutAccountsPanel", () => {
  it("마스킹된 계좌번호만 보여준다", async () => {
    render(<TeacherPayoutAccountsPanel />);
    expect(await screen.findByTestId("masked-t1")).toHaveTextContent("****6789");
    expect(screen.queryByText(/110-123/)).not.toBeInTheDocument();
  });

  it("관리자는 조회 전용이다 — 수정·저장 버튼이 없다", async () => {
    render(<TeacherPayoutAccountsPanel />);
    await screen.findByTestId("masked-t1");
    expect(screen.queryByText("수정")).not.toBeInTheDocument();
    expect(screen.queryByText("저장")).not.toBeInTheDocument();
    expect(screen.getByText(/값 수정은 선생님 본인만/)).toBeInTheDocument();
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
