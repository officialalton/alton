import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setMock, refreshMock, hookState } = vi.hoisted(() => ({
  setMock: vi.fn(),
  refreshMock: vi.fn(),
  hookState: { data: null as unknown },
}));
vi.mock("./contract-dispatch-actions", () => ({
  listContractDispatchJobs: vi.fn(),
  runContractDispatchQueueAction: vi.fn(),
  retryContractDispatchJobAction: vi.fn(),
  setContractAutoDispatchEnabledAction: setMock,
}));
vi.mock("./use-tab-cached-data", () => ({
  useTabCachedData: () => ({ data: hookState.data, refreshing: false, refresh: refreshMock }),
}));

import ContractDispatchQueueSection from "./ContractDispatchQueueSection";

function setData(enabled: boolean, envHardStop = false) {
  hookState.data = {
    autoDispatchEnabled: enabled && !envHardStop,
    envHardStop,
    setting: { enabled, updatedAt: "2026-10-06T01:00:00Z", updatedByName: "김관리" },
    jobs: [],
  };
}

describe("계약서 자동 발송 토글", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
  });
  it("켜짐 상태·마지막 변경자를 보여주고, 끄기는 확인 없이 바로 적용", async () => {
    setData(true);
    render(<ContractDispatchQueueSection />);
    expect(screen.getByText("계약서 자동 발송 켜짐")).toBeInTheDocument();
    expect(screen.getByTestId("contract-dispatch-toggle-meta").textContent).toContain("김관리");
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(setMock).toHaveBeenCalledWith(false));
  });
  it("켜기는 확인 대화상자를 거친다(취소하면 호출 없음)", async () => {
    setData(false);
    render(<ContractDispatchQueueSection />);
    expect(screen.getByText("계약서 자동 발송 꺼짐")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByTestId("contract-dispatch-confirm").textContent).toContain("실제 DocuSign 계약서");
    expect(setMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("취소"));
    expect(screen.queryByTestId("contract-dispatch-confirm")).toBeNull();
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByText("켜기 확인"));
    await waitFor(() => expect(setMock).toHaveBeenCalledWith(true));
  });
  it("비상 정지 중이면 배너가 env 정지를 알린다", () => {
    setData(true, true);
    render(<ContractDispatchQueueSection />);
    expect(screen.getByTestId("contract-dispatch-disabled-banner").textContent).toContain("비상 정지");
  });
  it("저장 실패 시 오류를 보여준다", async () => {
    setData(true);
    setMock.mockRejectedValue(new Error("관리자만 사용할 수 있습니다."));
    render(<ContractDispatchQueueSection />);
    fireEvent.click(screen.getByRole("switch"));
    expect(await screen.findByRole("alert")).toHaveTextContent("관리자만");
  });
});
