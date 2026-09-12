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
} = vi.hoisted(() => ({
  loadMock: vi.fn(),
  getAccountMock: vi.fn(),
  saveAccountMock: vi.fn(),
  listDocsMock: vi.fn(),
  uploadDocMock: vi.fn(),
  downloadUrlMock: vi.fn(),
}));

vi.mock("./settlement-actions", () => ({
  loadMySettlementAction: loadMock,
  getMyPayoutAccountAction: getAccountMock,
  saveMyPayoutAccountAction: saveAccountMock,
  listMyDocumentsAction: listDocsMock,
  uploadMyDocumentAction: uploadDocMock,
  getMyDocumentDownloadUrlAction: downloadUrlMock,
}));

import SettlementTab from "./SettlementTab";

const SETTLEMENT = {
  months: [
    {
      settlementMonth: "2026-09",
      payoutMonth: "2026-10",
      currency: "KRW",
      status: "scheduled" as const,
      totalAmountMinor: 150000,
      lessonCount: 2,
      paidAt: null,
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
    const scheduled = await screen.findAllByText("150,000 KRW");
    expect(scheduled.length).toBeGreaterThan(0);
    for (const label of ["검토 중", "송금 승인됨", "지급 완료"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("40,000 KRW")).toBeInTheDocument();
    expect(screen.getByText("80,000 KRW")).toBeInTheDocument();
    expect(screen.getByText("200,000 KRW")).toBeInTheDocument();
    // '확정'이라는 모호한 라벨은 더 이상 쓰지 않는다.
    expect(screen.queryByText("확정(지급 대기)")).not.toBeInTheDocument();
  });

  it("지급 예정 월·갱신 시각·변동 안내를 표시하고 구체 지급일은 표시하지 않는다", async () => {
    render(<SettlementTab />);
    expect(await screen.findByText(/지급 예정 월: 2026년 10월/)).toBeInTheDocument();
    expect(screen.getByText(/마지막 갱신:/)).toBeInTheDocument();
    expect(screen.getByText(/확정 전까지 금액이 변동될 수 있습니다/)).toBeInTheDocument();
    expect(screen.getByText(/공제를 반영하지 않은 총액/)).toBeInTheDocument();
    expect(screen.getByText(/구체적인 지급일은 확정되면 안내합니다/)).toBeInTheDocument();
  });

  it("마감 뒤 변동은 승인된 금액을 고치지 않고 다음 정산월 조정으로 간다고 안내한다", async () => {
    render(<SettlementTab />);
    expect(
      await screen.findByText(/이미 승인된 금액을 고치지 않고 다음 정산월의 조정 항목으로 반영합니다/)
    ).toBeInTheDocument();
  });

  it("월 행을 펼치면 수업별 산출 근거를 보여준다", async () => {
    render(<SettlementTab />);
    const row = await screen.findByTestId("settlement-month-2026-09|KRW|scheduled");
    fireEvent.click(row);
    expect(await screen.findByText("김학생")).toBeInTheDocument();
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
    expect(screen.getByText("60분")).toBeInTheDocument();
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
    expect(await screen.findByTestId("settlement-empty")).toBeInTheDocument();
  });
});

describe("SettlementTab — 수취 계좌", () => {
  it("등록 전에는 빈 상태를, 저장 후에는 마스킹된 계좌번호만 보여준다", async () => {
    render(<SettlementTab />);
    expect(await screen.findByTestId("account-empty")).toBeInTheDocument();

    fireEvent.click(screen.getByText("등록"));
    fireEvent.change(screen.getByPlaceholderText("예금주"), { target: { value: "김선생" } });
    fireEvent.change(screen.getByPlaceholderText("은행명"), { target: { value: "국민은행" } });
    fireEvent.change(screen.getByPlaceholderText("계좌번호(전체 입력)"), {
      target: { value: "110-123-456789" },
    });
    fireEvent.click(screen.getByText("저장"));

    expect(await screen.findByTestId("account-masked")).toHaveTextContent("****6789");
    // 전체 계좌번호가 화면에 남아 있으면 안 된다.
    expect(screen.queryByText(/110-123-456789/)).not.toBeInTheDocument();
  });

  it("서버가 입력을 거부하면 사유를 보여주고 편집 상태를 유지한다", async () => {
    saveAccountMock.mockResolvedValue({ status: "invalid", message: "예금주를 입력해주세요." });
    render(<SettlementTab />);
    fireEvent.click(await screen.findByText("등록"));
    fireEvent.click(screen.getByText("저장"));

    expect(await screen.findByText("예금주를 입력해주세요.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("은행명")).toBeInTheDocument();
  });
});

describe("SettlementTab — 제출 서류", () => {
  it("보관 창구임을 안내하고 게이트로 읽힐 '필수/미제출' 표현을 쓰지 않는다", async () => {
    render(<SettlementTab />);
    expect(await screen.findByTestId("documents-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/제출 여부가 정산·매칭·수업 진행에 영향을 주지 않습니다/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/필수 서류/)).not.toBeInTheDocument();
    expect(screen.queryByText(/미제출/)).not.toBeInTheDocument();
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
    await screen.findByTestId("documents-empty");

    const input = screen.getByLabelText("서류 업로드");
    fireEvent.change(input, {
      target: { files: [new File(["1"], "계약서.pdf", { type: "application/pdf" })] },
    });

    await waitFor(() => expect(screen.getByText("계약서.pdf")).toBeInTheDocument());
  });
});
