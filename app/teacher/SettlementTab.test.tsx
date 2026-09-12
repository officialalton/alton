import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// P4-2 — 교사 `정산` 탭 UI 기준 검증.
// 확정 정책 중 화면으로 보장해야 하는 것: 예정/확정/지급 완료 분리, 지급 예정 월·
// 마지막 갱신 시각·변동 가능 안내, 계좌 마스킹, 서류에 게이트성 표현 없음.

const {
  loadMock,
  getAccountMock,
  saveAccountMock,
  listDocsMock,
  uploadDocMock,
  downloadUrlMock,
  deleteDocMock,
} = vi.hoisted(() => ({
  loadMock: vi.fn(),
  getAccountMock: vi.fn(),
  saveAccountMock: vi.fn(),
  listDocsMock: vi.fn(),
  uploadDocMock: vi.fn(),
  downloadUrlMock: vi.fn(),
  deleteDocMock: vi.fn(),
}));

vi.mock("./settlement-actions", () => ({
  loadMySettlementAction: loadMock,
  getMyPayoutAccountAction: getAccountMock,
  saveMyPayoutAccountAction: saveAccountMock,
  listMyDocumentsAction: listDocsMock,
  uploadMyDocumentAction: uploadDocMock,
  getMyDocumentDownloadUrlAction: downloadUrlMock,
  deleteMyDocumentAction: deleteDocMock,
}));

import SettlementTab from "./SettlementTab";

// P4-2(UAT 후속) — 화면이 4개 서브탭(정산 현황/정산 내역/계좌/서류)으로 나뉘었다.
async function openSubtab(id: "summary" | "history" | "account" | "documents") {
  fireEvent.click(await screen.findByTestId(`settlement-subtab-${id}`));
}

const SETTLEMENT = {
  months: [
    {
      settlementMonth: "2026-09",
      payoutMonth: "2026-10",
      currency: "KRW",
      status: "scheduled" as const,
      autoCalculatedAmountMinor: 160000,
      adjustmentAmountMinor: -10000,
      totalAmountMinor: 150000,
      lessonCount: 2,
      paidAt: null,
      scheduledPayoutDate: "2026-10-10",
      autoDispatchEnabled: true,
      dateChanges: [],
      externalTransfer: null,
      adjustments: [
        {
          id: "adj1",
          amountMinor: -10000,
          currency: "KRW",
          reason: "교통비 차감",
          createdAt: "2026-09-11T00:00:00.000Z",
        },
      ],
      lines: [
        {
          payoutItemId: "i1",
          sessionDate: "2026-09-03T01:00:00.000Z",
          studentName: "김학생",
          subjectName: "SAT Math",
          itemType: "regular",
          payableMinutes: 60,
          hourlyRateSnapshotMinor: 50000,
          amountMinor: 50000,
          currency: "KRW",
        },
      ],
    },
  ],
  scheduledTotalsByCurrency: { KRW: 150000 },
  inReviewTotalsByCurrency: { KRW: 40000 },
  approvedTotalsByCurrency: { KRW: 80000 },
  paidTotalsByCurrency: { KRW: 200000 },
  nextPayoutMonth: "2026-10",
  refreshedAt: "2026-09-12T03:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  loadMock.mockResolvedValue(SETTLEMENT);
  getAccountMock.mockResolvedValue(null);
  listDocsMock.mockResolvedValue([]);
  saveAccountMock.mockResolvedValue({
    status: "saved",
    account: {
      accountHolderName: "김선생",
      bankName: "국민은행",
      accountNumberMasked: "****6789",
      currency: "KRW",
      country: null,
      swiftOrRouting: null,
      updatedAt: "2026-09-12T03:00:00.000Z",
    },
  });
});

describe("SettlementTab — 예정액 요약", () => {
  it("예정·검토 중·송금 승인됨·지급 완료 4단계를 나눠 보여준다", async () => {
    render(<SettlementTab />);
    // 같은 금액이 월별 표에도 나오므로 요약 카드(예정)만 콕 집어 확인한다.
    const scheduled = await screen.findAllByText("₩150,000");
    expect(scheduled.length).toBeGreaterThan(0);
    for (const label of ["검토 중", "송금 승인됨", "지급 완료"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("₩40,000")).toBeInTheDocument();
    expect(screen.getByText("₩80,000")).toBeInTheDocument();
    expect(screen.getByText("₩200,000")).toBeInTheDocument();
    // '확정'이라는 모호한 라벨은 더 이상 쓰지 않는다.
    expect(screen.queryByText("확정(지급 대기)")).not.toBeInTheDocument();
  });

  it("매월 10일 전월분 지급 안내와 예정 금액의 지급 예정일을 함께 보여준다", async () => {
    render(<SettlementTab />);
    expect(await screen.findByText(/매월 10일에 전월 수업분을 지급합니다/)).toBeInTheDocument();
    // <b> 때문에 텍스트가 여러 노드로 쪼개져 있어 컨테이너 기준으로 확인한다.
    expect(screen.getByText(/송금 승인 시점에 정해집니다/)).toBeInTheDocument();
    expect(screen.getByText(/마지막 갱신:/)).toBeInTheDocument();
    expect(screen.getByText(/확정 전까지 금액이 변동될 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByText(/공제를 반영하지 않은 총액/)).toBeInTheDocument();
  });

  it("서브탭 4개로 나뉘어 있고 기본은 정산 현황이다", async () => {
    render(<SettlementTab />);
    for (const label of ["정산 현황", "정산 내역", "계좌", "서류"]) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    // 기본 탭에서는 월별 내역·계좌·서류 카드가 보이지 않는다.
    expect(screen.queryByText("월별 정산 내역")).not.toBeInTheDocument();
    expect(screen.queryByText("수취 계좌")).not.toBeInTheDocument();
  });

  it("마감 뒤 변동은 승인된 금액을 고치지 않고 다음 정산월 조정으로 간다고 안내한다", async () => {
    render(<SettlementTab />);
    expect(
      await screen.findByText(/이미 승인된 금액을 고치지 않고 다음 정산월의 조정 항목으로 반영합니다/)
    ).toBeInTheDocument();
  });

  it("월 행을 펼치면 수업별 산출 근거를 보여준다", async () => {
    render(<SettlementTab />);
    await openSubtab("history");
    const row = await screen.findByTestId("settlement-month-2026-09|KRW|scheduled");
    fireEvent.click(row);
    expect(await screen.findByText("김학생")).toBeInTheDocument();
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText("60분")).toBeInTheDocument();
  });

  it("자동 산정 수업 합계·관리자 조정액·최종 금액을 분리해 보여준다", async () => {
    render(<SettlementTab />);
    await openSubtab("history");
    fireEvent.click(await screen.findByTestId("settlement-month-2026-09|KRW|scheduled"));

    const key = "2026-09|KRW|scheduled";
    expect(await screen.findByTestId(`auto-${key}`)).toHaveTextContent("₩160,000");
    expect(screen.getByTestId(`adjust-${key}`)).toHaveTextContent("-₩10,000");
    expect(screen.getByTestId(`final-${key}`)).toHaveTextContent("₩150,000");
  });

  it("지급 예정일과 자동 송금 여부를 상세에 구분해 보여준다", async () => {
    render(<SettlementTab />);
    await openSubtab("history");
    fireEvent.click(await screen.findByTestId("settlement-month-2026-09|KRW|scheduled"));

    const key = "2026-09|KRW|scheduled";
    expect(await screen.findByTestId(`sched-${key}`)).toHaveTextContent("2026. 10. 10.");
    expect(screen.getByTestId(`auto-dispatch-${key}`)).toHaveTextContent("대상");
  });

  it("예정일이 아직 정해지지 않았으면 구체적인 날짜를 보여주지 않는다", async () => {
    loadMock.mockResolvedValue({
      ...SETTLEMENT,
      months: [{ ...SETTLEMENT.months[0], scheduledPayoutDate: null }],
    });
    render(<SettlementTab />);
    await openSubtab("history");
    expect(await screen.findByText(/승인 후 지급 예정일이 정해집니다/)).toBeInTheDocument();
  });

  it("지급 예정일 변경 이력과 은행 직접 송금 사실을 교사도 볼 수 있다", async () => {
    loadMock.mockResolvedValue({
      ...SETTLEMENT,
      months: [
        {
          ...SETTLEMENT.months[0],
          status: "paid" as const,
          scheduledPayoutDate: "2026-10-10",
          dateChanges: [
            {
              id: "dc1",
              previousDate: "2026-10-10",
              newDate: "2026-10-20",
              reason: "은행 점검으로 연기",
              createdAt: "2026-10-05T00:00:00.000Z",
            },
          ],
          externalTransfer: { transferredOn: "2026-10-20", amountMinor: 150000, currency: "KRW" },
        },
      ],
    });
    render(<SettlementTab />);
    await openSubtab("history");
    fireEvent.click(await screen.findByTestId("settlement-month-2026-09|KRW|paid"));

    expect(await screen.findByTestId("date-change-dc1")).toHaveTextContent("은행 점검으로 연기");
    expect(screen.getByTestId("external-2026-09|KRW|paid")).toHaveTextContent("은행 직접 송금");
  });

  it("관리자 조정 내역의 사유와 금액을 교사도 볼 수 있다", async () => {
    render(<SettlementTab />);
    await openSubtab("history");
    fireEvent.click(await screen.findByTestId("settlement-month-2026-09|KRW|scheduled"));
    expect(await screen.findByTestId("adjust-reason-adj1")).toHaveTextContent("교통비 차감");
    expect(screen.getByTestId("adjust-reason-adj1")).toHaveTextContent("-₩10,000");
  });

  it("검토 중인 건은 날짜만 덩그러니 보여주지 않고 '검토 완료 후 지급'을 앞세운다", async () => {
    loadMock.mockResolvedValue({
      ...SETTLEMENT,
      months: [{ ...SETTLEMENT.months[0], status: "in_review" as const }],
    });
    render(<SettlementTab />);
    await openSubtab("history");
    expect(await screen.findByText(/검토 완료 후 지급 \(예정일 2026\. 10\. 10\.\)/)).toBeInTheDocument();
  });

  it("예정 건은 지급 예정일을 그대로 보여준다", async () => {
    render(<SettlementTab />);
    await openSubtab("history");
    expect(await screen.findByText(/지급 예정일 2026\. 10\. 10\./)).toBeInTheDocument();
  });

  it("정산 내역이 없으면 빈 상태 문구를 보여준다", async () => {
    loadMock.mockResolvedValue({
      months: [],
      scheduledTotalsByCurrency: {},
      inReviewTotalsByCurrency: {},
      approvedTotalsByCurrency: {},
      paidTotalsByCurrency: {},
      nextPayoutMonth: null,
      refreshedAt: "2026-09-12T03:00:00.000Z",
    });
    render(<SettlementTab />);
    await openSubtab("history");
    expect(await screen.findByTestId("settlement-empty")).toBeInTheDocument();
  });
});

describe("SettlementTab — 수취 계좌", () => {
  it("등록 전에는 빈 상태를, 저장 후에는 마스킹된 계좌번호만 보여준다", async () => {
    render(<SettlementTab />);
    await openSubtab("account");
    expect(await screen.findByTestId("account-empty")).toBeInTheDocument();

    fireEvent.click(screen.getByText("등록"));
    fireEvent.change(screen.getByLabelText("예금주"), { target: { value: "김선생" } });
    fireEvent.change(screen.getByLabelText("은행명"), { target: { value: "국민은행" } });
    fireEvent.change(screen.getByLabelText("계좌번호"), { target: { value: "110-123-456789" } });
    fireEvent.click(screen.getByText("저장"));

    expect(await screen.findByTestId("account-masked")).toHaveTextContent("****6789");
    // 전체 계좌번호가 화면에 남아 있으면 안 된다.
    expect(screen.queryByText(/110-123-456789/)).not.toBeInTheDocument();
  });

  it("서버가 입력을 거부하면 사유를 보여주고 편집 상태를 유지한다", async () => {
    saveAccountMock.mockResolvedValue({ status: "invalid", message: "예금주를 입력해주세요." });
    render(<SettlementTab />);
    await openSubtab("account");
    fireEvent.click(await screen.findByText("등록"));
    fireEvent.click(screen.getByText("저장"));

    expect(await screen.findByText("예금주를 입력해주세요.")).toBeInTheDocument();
    expect(screen.getByLabelText("은행명")).toBeInTheDocument();
  });
});

  it("통화는 KRW/USD 중에서 고르게 하고 계좌번호 하이픈 안내를 보여준다", async () => {
    render(<SettlementTab />);
    await openSubtab("account");
    fireEvent.click(await screen.findByText("등록"));

    const currency = screen.getByLabelText("통화") as HTMLSelectElement;
    expect(currency.tagName).toBe("SELECT");
    expect(Array.from(currency.options).map((o) => o.value)).toEqual(["KRW", "USD"]);
    expect(screen.getByText(/띄어쓰기 없이 하이픈\(-\)을 넣어서 작성/)).toBeInTheDocument();
  });

describe("SettlementTab — 제출 서류", () => {
  it("보관 창구임을 안내하고 게이트로 읽힐 '필수/미제출' 표현을 쓰지 않는다", async () => {
    render(<SettlementTab />);
    await openSubtab("documents");
    expect(await screen.findByTestId("documents-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/제출 여부가 정산·매칭·수업 진행에 영향을 주지 않습니다/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/필수 서류/)).not.toBeInTheDocument();
    expect(screen.queryByText(/미제출/)).not.toBeInTheDocument();
  });

  it("업로드 입력이 버튼으로 보인다(기본 file input을 그대로 노출하지 않는다)", async () => {
    render(<SettlementTab />);
    await openSubtab("documents");
    expect(await screen.findByTestId("upload-document")).toHaveTextContent("파일 선택해서 올리기");
    expect(screen.getByLabelText("서류 업로드")).toHaveClass("hidden");
  });

  it("잘못 올린 서류를 삭제할 수 있다", async () => {
    listDocsMock.mockResolvedValue([
      {
        id: "d1",
        fileName: "잘못올림.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
        note: null,
        uploadedAt: "2026-09-12T03:00:00.000Z",
      },
    ]);
    deleteDocMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<SettlementTab />);
    await openSubtab("documents");
    fireEvent.click(await screen.findByTestId("delete-document-d1"));

    await waitFor(() => expect(deleteDocMock).toHaveBeenCalledWith("d1"));
    await waitFor(() => expect(screen.getByTestId("documents-empty")).toBeInTheDocument());
  });

  it("업로드가 성공하면 목록에 바로 추가된다", async () => {
    uploadDocMock.mockResolvedValue({
      status: "uploaded",
      document: {
        id: "d1",
        fileName: "계약서.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
        note: null,
        uploadedAt: "2026-09-12T03:00:00.000Z",
      },
    });
    render(<SettlementTab />);
    await openSubtab("documents");
    await screen.findByTestId("documents-empty");

    const input = screen.getByLabelText("서류 업로드");
    fireEvent.change(input, {
      target: { files: [new File(["1"], "계약서.pdf", { type: "application/pdf" })] },
    });

    await waitFor(() => expect(screen.getByText("계약서.pdf")).toBeInTheDocument());
  });
});
