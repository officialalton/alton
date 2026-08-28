import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultForm from "./ConsultForm";
import * as actions from "./consult-actions";

vi.mock("./consult-actions", () => ({
  submitConsultRequest: vi.fn(),
}));

describe("ConsultForm", () => {
  it("동의 없이 제출하면 에러 문구를 보여주고 서버 액션을 호출하지 않는다", async () => {
    render(<ConsultForm />);
    fireEvent.change(screen.getByLabelText("학부모 이름"), { target: { value: "김민지" } });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "minji@example.com" },
    });
    fireEvent.click(screen.getByText("상담 신청하기"));
    expect(
      await screen.findByText("개인정보 수집·이용에 동의해주세요.")
    ).toBeInTheDocument();
    expect(actions.submitConsultRequest).not.toHaveBeenCalled();
  });

  it("필수 항목을 채우고 동의 후 제출하면 서버 액션이 호출되고 완료 문구가 보인다", async () => {
    vi.mocked(actions.submitConsultRequest).mockResolvedValue(undefined);
    render(<ConsultForm />);
    fireEvent.change(screen.getByLabelText("학부모 이름"), { target: { value: "김민지" } });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "minji@example.com" },
    });
    fireEvent.click(
      screen.getByText(/개인정보 수집·이용에 동의합니다/).closest("label")!.querySelector(
        "input"
      )!
    );
    fireEvent.click(screen.getByText("상담 신청하기"));

    await waitFor(() =>
      expect(actions.submitConsultRequest).toHaveBeenCalledWith(
        expect.objectContaining({ parentName: "김민지", email: "minji@example.com" })
      )
    );
    expect(await screen.findByText("상담 신청이 접수되었습니다.")).toBeInTheDocument();
  });

  it("서버 액션이 실패하면 에러 메시지를 보여준다", async () => {
    vi.mocked(actions.submitConsultRequest).mockRejectedValue(
      new Error("이름과 이메일은 필수입니다.")
    );
    render(<ConsultForm />);
    fireEvent.change(screen.getByLabelText("학부모 이름"), { target: { value: "김민지" } });
    fireEvent.change(screen.getByLabelText("이메일"), {
      target: { value: "minji@example.com" },
    });
    fireEvent.click(
      screen.getByText(/개인정보 수집·이용에 동의합니다/).closest("label")!.querySelector(
        "input"
      )!
    );
    fireEvent.click(screen.getByText("상담 신청하기"));

    expect(
      await screen.findByText("이름과 이메일은 필수입니다.")
    ).toBeInTheDocument();
  });
});
