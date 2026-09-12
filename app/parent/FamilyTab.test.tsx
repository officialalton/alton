import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FamilyTab from "./FamilyTab";

describe("FamilyTab", () => {
  it("새 자녀 상담 신청 진입 버튼을 누르면 콜백을 호출한다", () => {
    const onGo = vi.fn();
    render(<FamilyTab onGoToConsultRequest={onGo} />);
    fireEvent.click(screen.getByText("새 자녀 상담 신청하러 가기 →"));
    expect(onGo).toHaveBeenCalledTimes(1);
  });

  it("직접 초대 발송 버튼은 비활성화되어 있다(상담 전 발송 차단)", () => {
    render(<FamilyTab onGoToConsultRequest={() => {}} />);
    expect(screen.getByText("초대 보내기")).toBeDisabled();
  });
});
