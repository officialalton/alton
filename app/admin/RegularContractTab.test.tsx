import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import RegularContractTab from "./RegularContractTab";
import {
  listRegularConversionCandidatesAction,
  manuallyCompleteContractAction,
} from "./trial-onboarding-actions";

vi.mock("./trial-onboarding-actions", () => ({
  listRegularConversionCandidatesAction: vi.fn(),
  sendRegularContractOneClickAction: vi.fn(),
  manuallyCompleteContractAction: vi.fn(),
}));
vi.mock("./consultation-actions", () => ({
  createNewContractVersionForResend: vi.fn(),
}));

// 2026-09-21(제품 오너 지시) — 메일 전달 문제로 보호자가 서명 링크를 못 받는 테스트
// 계정(+alton 서브어드레싱 등)을 관리자가 수동으로 "완료 처리"해 다음 단계로 넘길 수
// 있게 한 우회 버튼. 이미 발송된(isSent) 계약에만 노출되고, 확인 단계에서 실제 서명이
// 아니라는 문구를 반드시 보여준 뒤에만 액션을 호출해야 한다.
describe("RegularContractTab — 메일 미수신 계약 수동 완료 처리", () => {
  const candidate = {
    subjectEnrollmentId: "se1",
    childId: "child1",
    contractId: "contract1",
    childName: "테스트 학생",
    subjectName: "SAT Math",
    guardianEmail: "matchbox512+alton@example.com",
    guardianName: "테스트 보호자",
    contractStatus: "sent",
    latestVersionHasEnvelope: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (listRegularConversionCandidatesAction as ReturnType<typeof vi.fn>).mockResolvedValue([candidate]);
  });

  it("발송된 계약에는 수동 완료 버튼이 뜨고, 확인 단계에서 실제 서명이 아니라는 경고를 보여준다", async () => {
    render(<RegularContractTab />);
    await screen.findByText("테스트 학생 · SAT Math");

    const manualButton = await screen.findByText("메일 미수신 — 수동으로 완료 처리");
    fireEvent.click(manualButton);

    expect(screen.getByText(/실제 DocuSign 서명이 아닙니다/)).toBeInTheDocument();
    expect(manuallyCompleteContractAction).not.toHaveBeenCalled();
  });

  it("확인을 누르면 액션을 호출하고, 성공하면 수동 완료 안내로 바뀐다", async () => {
    (manuallyCompleteContractAction as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    render(<RegularContractTab />);
    await screen.findByText("테스트 학생 · SAT Math");
    fireEvent.click(await screen.findByText("메일 미수신 — 수동으로 완료 처리"));
    fireEvent.click(screen.getByText("확인 — 수동 완료 처리"));

    await waitFor(() => expect(manuallyCompleteContractAction).toHaveBeenCalledWith("contract1"));
    expect(await screen.findByText(/관리자가 수동으로 완료 처리했습니다/)).toBeInTheDocument();
  });

  it("실패하면 오류 메시지를 보여주고 완료 처리로 넘어가지 않는다", async () => {
    (manuallyCompleteContractAction as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "이미 완료 처리된 계약입니다.",
    });

    render(<RegularContractTab />);
    await screen.findByText("테스트 학생 · SAT Math");
    fireEvent.click(await screen.findByText("메일 미수신 — 수동으로 완료 처리"));
    fireEvent.click(screen.getByText("확인 — 수동 완료 처리"));

    expect(await screen.findByText("이미 완료 처리된 계약입니다.")).toBeInTheDocument();
    expect(screen.queryByText(/관리자가 수동으로 완료 처리했습니다/)).toBeNull();
  });
});
