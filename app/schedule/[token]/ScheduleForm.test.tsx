import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listMock = vi.hoisted(() => vi.fn());
const redeemMock = vi.hoisted(() => vi.fn());
vi.mock("@/app/schedule-actions", () => ({ listOpenSlotsForTokenAction: listMock, redeemSchedulingLinkAction: redeemMock }));
vi.mock("@/app/components/ConsultSlotPicker", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef(function Picker(
      props: { fetchSlots: (a: string, b: string) => Promise<unknown>; onSelect: (v: string) => void },
      _ref,
    ) {
      // 실제 ConsultSlotPicker 처럼 fetchSlots 가 바뀔 때만 다시 조회한다.
      React.useEffect(() => {
        void props.fetchSlots("a", "b");
      }, [props.fetchSlots]);
      return <button onClick={() => props.onSelect("2026-10-01T18:00:00.000Z")}>PICK</button>;
    }),
  };
});

import ScheduleForm from "./ScheduleForm";
import { SCHEDULING_LINK_INVALID_MESSAGE } from "@/lib/consultation/scheduling-link";

describe("ScheduleForm — 무효 토큰", () => {
  it("슬롯 조회가 invalid_link 를 돌려주면 안내 문구로 바뀐다", async () => {
    listMock.mockResolvedValue({ ok: false, reason: "invalid_link", error: SCHEDULING_LINK_INVALID_MESSAGE });
    render(<ScheduleForm token="bogus" />);
    await waitFor(() => expect(screen.getByText(SCHEDULING_LINK_INVALID_MESSAGE)).toBeInTheDocument());
  });
});

describe("ScheduleForm — 예약 확정 직후", () => {
  it("확정 뒤에는 재렌더로 슬롯을 다시 조회하지 않고, 확정 화면이 무효 토큰 안내보다 우선한다", async () => {
    listMock.mockReset();
    redeemMock.mockReset();
    listMock.mockResolvedValue({ ok: true, slots: [] });
    redeemMock.mockResolvedValue({ ok: true });
    render(<ScheduleForm token="good" />);
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("PICK")); // 슬롯 선택 → 부모 재렌더
    await waitFor(() => expect(screen.getByText("Confirm this time")).toBeInTheDocument());
    expect(listMock).toHaveBeenCalledTimes(1); // 재렌더가 재조회를 일으키지 않는다

    // 확정 직후 토큰은 소진된다: 혹시 재조회가 일어나도 확정 화면이 유지돼야 한다.
    listMock.mockResolvedValue({ ok: false, reason: "invalid_link", error: SCHEDULING_LINK_INVALID_MESSAGE });
    fireEvent.click(screen.getByText("Confirm this time"));
    await waitFor(() => expect(screen.getByText("Your consultation is booked.")).toBeInTheDocument());
    expect(screen.queryByText(SCHEDULING_LINK_INVALID_MESSAGE)).not.toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(1);
  });
});

describe("ScheduleForm — 첫 상담 AI 회의록 동의(신청 시 동의가 저장되지 않은 내부 생성 요청만)", () => {
  it("동의가 이미 저장된 요청에는 체크박스가 없다", async () => {
    listMock.mockResolvedValue({ ok: true, slots: [] });
    render(<ScheduleForm token="t" />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("동의가 없으면 같은 문구의 단일 체크박스를 보여주고, 체크 전에는 예약을 확정하지 않는다", async () => {
    listMock.mockResolvedValue({ ok: true, slots: [] });
    redeemMock.mockReset().mockResolvedValue({ ok: true });
    render(<ScheduleForm token="t" needsAiNotesConsent />);
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(document.body.textContent).toContain("AI-generated meeting notes of the first consultation");
    fireEvent.click(screen.getByText("PICK"));
    fireEvent.click(screen.getByText("Confirm this time"));
    expect(await screen.findByText(/agree to the collection and use of your personal information and to AI-generated meeting notes/)).toBeInTheDocument();
    expect(redeemMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Confirm this time"));
    await waitFor(() => expect(redeemMock).toHaveBeenCalledWith("t", "2026-10-01T18:00:00.000Z", expect.any(String), true));
  });
});
