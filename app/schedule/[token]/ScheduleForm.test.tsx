import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listMock = vi.hoisted(() => vi.fn());
const redeemMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/schedule-actions", () => ({ listOpenSlotsForTokenAction: listMock, redeemSchedulingLinkAction: redeemMock }));
vi.mock("@/app/components/ConsultSlotPicker", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef(function Picker(props: { fetchSlots: (a: string, b: string) => Promise<unknown> }, _ref) {
      React.useEffect(() => {
        void props.fetchSlots("a", "b");
      }, [props]);
      return <div>PICKER</div>;
    }),
  };
});

import ScheduleForm from "./ScheduleForm";

describe("ScheduleForm — 무효 토큰", () => {
  it("슬롯 조회가 invalid_link 를 돌려주면 안내 문구로 바뀐다", async () => {
    listMock.mockResolvedValue({ ok: false, reason: "invalid_link", error: "유효하지 않거나 만료된 예약 링크입니다." });
    render(<ScheduleForm token="bogus" />);
    await waitFor(() => expect(screen.getByText("유효하지 않거나 만료된 예약 링크입니다.")).toBeInTheDocument());
  });
});
