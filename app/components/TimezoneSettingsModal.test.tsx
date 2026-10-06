import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimezoneSettingsModal from "./TimezoneSettingsModal";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const update = vi.fn();
vi.mock("@/lib/timezone-actions", () => ({
  getMyTimezoneSettings: vi.fn(async () => ({
    profileTimezone: "America/Los_Angeles",
    householdDefaultTimezone: null,
    householdId: null,
    isPrimaryGuardian: false,
  })),
  updateMyTimezone: (...a: unknown[]) => update(...a),
  updateHouseholdDefaultTimezone: vi.fn(),
}));

beforeEach(() => {
  refresh.mockReset();
  update.mockReset();
  update.mockResolvedValue(undefined);
});

describe("TimezoneSettingsModal", () => {
  it("저장에 성공하면 화면을 새로고침하고 창을 닫는다", async () => {
    const onClose = vi.fn();
    render(<TimezoneSettingsModal onClose={onClose} showHouseholdDefault={false} />);
    await screen.findByText("My time zone");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("저장에 실패하면 창을 닫지 않고 오류를 보인다", async () => {
    update.mockRejectedValue(new Error("저장에 실패했습니다"));
    const onClose = vi.fn();
    render(<TimezoneSettingsModal onClose={onClose} showHouseholdDefault={false} />);
    await screen.findByText("My time zone");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("저장에 실패했습니다")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("'닫기'는 헤더 ✕ 하나뿐이고 아래에는 '취소'와 '저장'이 있다", async () => {
    const onClose = vi.fn();
    render(<TimezoneSettingsModal onClose={onClose} showHouseholdDefault={false} />);
    await screen.findByText("My time zone");
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
