import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { submitMeetingRequestMock, listOpenGuardianMeetingSlotsMock } = vi.hoisted(() => ({
  submitMeetingRequestMock: vi.fn(),
  listOpenGuardianMeetingSlotsMock: vi.fn(),
}));

vi.mock("./inquiry-actions", () => ({
  submitMeetingRequest: submitMeetingRequestMock,
  listOpenGuardianMeetingSlots: listOpenGuardianMeetingSlotsMock,
}));

// ConsultSlotPicker(캘린더+시간 버튼)는 자체 단위 테스트가 있으므로 여기서는
// "슬롯을 하나 골랐다"는 사실만 흉내내는 얇은 stub으로 대체한다.
vi.mock("@/app/components/ConsultSlotPicker", () => ({
  default: ({ onSelect, selectedStartsAt }: { onSelect: (iso: string) => void; selectedStartsAt: string | null }) => (
    <div>
      <button type="button" onClick={() => onSelect("2027-01-01T09:00:00.000Z")}>
        테스트용 슬롯 선택
      </button>
      {selectedStartsAt && <span data-testid="selected-slot">{selectedStartsAt}</span>}
    </div>
  ),
}));

import ConsultationRequestTab from "./ConsultationRequestTab";

describe("ConsultationRequestTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOpenGuardianMeetingSlotsMock.mockResolvedValue([]);
  });

  it("슬롯 미선택 시 제출을 막고 에러를 보여준다", async () => {
    render(<ConsultationRequestTab />);
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() => expect(screen.getByText("상담 희망 시간을 먼저 선택해주세요.")).toBeInTheDocument());
    expect(submitMeetingRequestMock).not.toHaveBeenCalled();
  });

  it("슬롯을 골랐지만 사유 없이 제출하면 에러를 보여주고 submitMeetingRequest는 호출되지 않는다", async () => {
    render(<ConsultationRequestTab />);
    fireEvent.click(screen.getByText("테스트용 슬롯 선택"));
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() => expect(screen.getByText("상담 사유를 입력해주세요.")).toBeInTheDocument());
    expect(submitMeetingRequestMock).not.toHaveBeenCalled();
  });

  it("슬롯 선택 + 사유 입력 후 제출하면 submitMeetingRequest가 { reason, slotStartsAtIso }로 호출된다", async () => {
    submitMeetingRequestMock.mockResolvedValue({ ok: true });
    render(<ConsultationRequestTab />);
    fireEvent.click(screen.getByText("테스트용 슬롯 선택"));
    fireEvent.change(screen.getByLabelText("상담 사유"), { target: { value: "상담 사유입니다" } });
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() =>
      expect(submitMeetingRequestMock).toHaveBeenCalledWith({
        reason: "상담 사유입니다",
        slotStartsAtIso: "2027-01-01T09:00:00.000Z",
      })
    );
    await waitFor(() => expect(screen.getByText("상담 신청이 접수되었습니다.")).toBeInTheDocument());
  });

  it("제출 실패 시 서버가 반환한 에러 메시지를 보여준다", async () => {
    submitMeetingRequestMock.mockResolvedValue({ ok: false, error: "이미 진행 중인 상담이 있습니다." });
    render(<ConsultationRequestTab />);
    fireEvent.click(screen.getByText("테스트용 슬롯 선택"));
    fireEvent.change(screen.getByLabelText("상담 사유"), { target: { value: "상담 사유입니다" } });
    fireEvent.click(screen.getByText("상담 신청하기"));
    await waitFor(() => expect(screen.getByText("이미 진행 중인 상담이 있습니다.")).toBeInTheDocument());
  });
});
