import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConsultForm from "./ConsultForm";
import * as actions from "./consult-actions";
import * as analytics from "@/lib/analytics/track";

vi.mock("./consult-actions", () => ({
  submitHomepageConsultRequest: vi.fn(),
}));
vi.mock("@/lib/analytics/track", () => ({
  trackEvent: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    expect(analytics.trackEvent).not.toHaveBeenCalledWith("consultation_submitted", expect.anything(), expect.anything());
  });

  it("폼 포커스마다 consultation_started를 같은 onceKey로 호출한다(트래커의 dedup이 중복을 걸러낼 수 있게)", () => {
    render(<ConsultForm />);
    fireEvent.focus(screen.getByLabelText("학부모 이름"));
    fireEvent.focus(screen.getByLabelText("이메일"));
    fireEvent.focus(screen.getByLabelText("학부모 이름"));

    const startedCalls = vi
      .mocked(analytics.trackEvent)
      .mock.calls.filter(([eventName]) => eventName === "consultation_started");
    expect(startedCalls.length).toBeGreaterThanOrEqual(1);
    for (const call of startedCalls) {
      expect(call[1]).toMatchObject({ entry_point: "landing_form" });
      expect(call[2]).toMatchObject({ onceKey: startedCalls[0][2]?.onceKey });
    }
  });

  it("제출이 성공하면 consultation_submitted를 발생시킨다", async () => {
    vi.mocked(actions.submitHomepageConsultRequest).mockResolvedValue({ id: "c1", status: "requested" });
    render(<ConsultForm />);
    fillRequiredFields();
    agree();
    fireEvent.click(screen.getByText("상담 신청하기"));

    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith(
        "consultation_submitted",
        expect.objectContaining({ entry_point: "landing_form", consultation_type: "homepage" }),
        expect.anything()
      )
    );
  });

  it("consultation_submitted payload에 이름·이메일 등 개인정보를 넘기지 않는다", async () => {
    vi.mocked(actions.submitHomepageConsultRequest).mockResolvedValue({ id: "c1", status: "requested" });
    render(<ConsultForm />);
    fillRequiredFields();
    agree();
    fireEvent.click(screen.getByText("상담 신청하기"));

    await waitFor(() => expect(analytics.trackEvent).toHaveBeenCalled());
    const submittedCall = vi
      .mocked(analytics.trackEvent)
      .mock.calls.find(([eventName]) => eventName === "consultation_submitted");
    const payload = submittedCall?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("email");
    expect(payload).not.toHaveProperty("parentName");
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("concerns");
  });
});
