import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultForm from "./ConsultForm";
import * as actions from "./consult-actions";

vi.mock("./consult-actions", () => ({
  submitHomepageConsultRequest: vi.fn(),
}));

// 2026-09-22(컨설턴트 스펙 Phase 2b, 사용자 승인) — 홈페이지 폼에서 슬롯
// 선택 UI(ConsultSlotPicker)를 없앴다. 이제 "신청만" 접수하고, 배정된
// 컨설턴트 전용 스케줄링 링크로 고객이 나중에 직접 시간을 고른다.
function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("학부모 이름"), { target: { value: "김민지" } });
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "minji@example.com" } });
}

function agree() {
  fireEvent.click(screen.getByText(/개인정보 수집·이용에 동의합니다/).closest("label")!.querySelector("input")!);
}

describe("ConsultForm", () => {
  it("동의 없이 제출하면 에러 문구를 보여주고 서버 액션을 호출하지 않는다", async () => {
    render(<ConsultForm />);
    fillRequiredFields();
    fireEvent.click(screen.getByText("상담 신청하기"));
    expect(await screen.findByText("개인정보 수집·이용에 동의해주세요.")).toBeInTheDocument();
    expect(actions.submitHomepageConsultRequest).not.toHaveBeenCalled();
  });

  it("필수 항목을 채우고 동의 후 제출하면 서버 액션이 호출되고 완료 문구가 보인다(슬롯 선택 없음)", async () => {
    vi.mocked(actions.submitHomepageConsultRequest).mockResolvedValue({ id: "c1", status: "requested" });
    render(<ConsultForm />);
    fillRequiredFields();
    agree();
    fireEvent.click(screen.getByText("상담 신청하기"));

    await waitFor(() =>
      expect(actions.submitHomepageConsultRequest).toHaveBeenCalledWith(
        expect.objectContaining({ parentName: "김민지", email: "minji@example.com" })
      )
    );
    expect(await screen.findByText("상담 신청이 접수되었습니다.")).toBeInTheDocument();
    expect(screen.getByText(/담당 컨설턴트가 배정되면 예약 링크를/)).toBeInTheDocument();
  });

  it("서버 액션이 실패하면 에러 메시지를 보여준다", async () => {
    vi.mocked(actions.submitHomepageConsultRequest).mockRejectedValue(
      new Error("이미 처리 대기 중인 상담 신청이 있습니다. 관리자가 확인할 때까지 기다려 주세요.")
    );
    render(<ConsultForm />);
    fillRequiredFields();
    agree();
    fireEvent.click(screen.getByText("상담 신청하기"));

    expect(
      await screen.findByText("이미 처리 대기 중인 상담 신청이 있습니다. 관리자가 확인할 때까지 기다려 주세요.")
    ).toBeInTheDocument();
  });
});
