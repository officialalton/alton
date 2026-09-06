import { createRef } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultSlotPicker, { type ConsultSlotPickerHandle } from "./ConsultSlotPicker";

const TZ = "Asia/Seoul";

const SLOT_DATE = new Date();
SLOT_DATE.setDate(SLOT_DATE.getDate() + 1);
SLOT_DATE.setHours(3, 0, 0, 0); // UTC 03:00 → KST 12:00, 같은 KST 날짜에 남도록 이른 시간 사용
const SLOT_ISO = SLOT_DATE.toISOString();
const SLOT_DAY_KST = String(
  Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, day: "2-digit" }).format(SLOT_DATE)
  )
);

describe("ConsultSlotPicker", () => {
  it("로딩 중에는 로딩 문구를 보여준다", () => {
    const fetchSlots = vi.fn(() => new Promise<never>(() => {}));
    render(<ConsultSlotPicker fetchSlots={fetchSlots} selectedStartsAt={null} onSelect={() => {}} timezone={TZ} />);
    expect(screen.getByText("가능한 시간을 불러오는 중...")).toBeInTheDocument();
  });

  it("조회 실패 시 에러 메시지와 재시도 버튼을 보여주고, 재시도하면 다시 조회한다", async () => {
    const fetchSlots = vi.fn()
      .mockRejectedValueOnce(new Error("네트워크 오류"))
      .mockResolvedValueOnce([{ startsAt: SLOT_ISO }]);
    render(<ConsultSlotPicker fetchSlots={fetchSlots} selectedStartsAt={null} onSelect={() => {}} timezone={TZ} />);

    expect(await screen.findByText("네트워크 오류")).toBeInTheDocument();
    const retryButton = screen.getByText("다시 시도");
    fireEvent.click(retryButton);

    await waitFor(() => expect(fetchSlots).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("네트워크 오류")).not.toBeInTheDocument());
  });

  it("날짜 선택 전에는 캘린더에서 날짜를 먼저 선택하라는 안내를 보여준다", async () => {
    const fetchSlots = vi.fn().mockResolvedValue([{ startsAt: SLOT_ISO }]);
    render(<ConsultSlotPicker fetchSlots={fetchSlots} selectedStartsAt={null} onSelect={() => {}} timezone={TZ} />);
    expect(await screen.findByText("캘린더에서 날짜를 먼저 선택해주세요.")).toBeInTheDocument();
  });

  it("슬롯이 없는 날짜를 선택하면 빈 상태 메시지를 보여준다", async () => {
    const fetchSlots = vi.fn().mockResolvedValue([]);
    render(<ConsultSlotPicker fetchSlots={fetchSlots} selectedStartsAt={null} onSelect={() => {}} timezone={TZ} />);
    await waitFor(() => expect(screen.queryByText("가능한 시간을 불러오는 중...")).not.toBeInTheDocument());
    // 오늘 날짜 셀(배지 없음)을 클릭해도 빈 상태 문구가 뜬다.
    const anyDay = screen.getAllByRole("button", { name: /일$/ })[10];
    fireEvent.click(anyDay);
    expect(await screen.findByText("선택하신 날짜에는 신청 가능한 시간이 없습니다. 다른 날짜를 선택해주세요.")).toBeInTheDocument();
  });

  it("날짜 선택 → 시간 버튼 목록 → 시간 선택 → 확인 표시까지 전체 흐름이 동작한다", async () => {
    const fetchSlots = vi.fn().mockResolvedValue([{ startsAt: SLOT_ISO }]);
    const onSelect = vi.fn();
    const { rerender } = render(
      <ConsultSlotPicker fetchSlots={fetchSlots} selectedStartsAt={null} onSelect={onSelect} timezone={TZ} />
    );

    const dayButtons = await screen.findAllByRole("button", { name: `${SLOT_DAY_KST}일` });
    fireEvent.click(dayButtons[0]);

    const timeGroup = await screen.findByRole("group", { name: "상담 희망 시간 선택" });
    const timeButton = timeGroup.querySelector("button")!;
    expect(timeButton).toBeTruthy();
    fireEvent.click(timeButton);
    expect(onSelect).toHaveBeenCalledWith(SLOT_ISO);

    rerender(<ConsultSlotPicker fetchSlots={fetchSlots} selectedStartsAt={SLOT_ISO} onSelect={onSelect} timezone={TZ} />);
    expect(await screen.findByTestId("consult-slot-confirmation")).toBeInTheDocument();
    expect(timeGroup.querySelector('button[aria-pressed="true"]')).toBeTruthy();
  });

  it("키보드로 시간 버튼에 접근하고 aria-pressed로 선택 상태를 식별할 수 있다", async () => {
    const fetchSlots = vi.fn().mockResolvedValue([{ startsAt: SLOT_ISO }]);
    render(<ConsultSlotPicker fetchSlots={fetchSlots} selectedStartsAt={SLOT_ISO} onSelect={() => {}} timezone={TZ} />);
    const dayButtons = await screen.findAllByRole("button", { name: `${SLOT_DAY_KST}일` });
    fireEvent.click(dayButtons[0]);
    const timeGroup = await screen.findByRole("group", { name: "상담 희망 시간 선택" });
    const timeButton = timeGroup.querySelector("button")!;
    expect(timeButton.getAttribute("aria-pressed")).toBe("true");
    expect(timeButton.tabIndex).not.toBe(-1);
  });

  it("ref.refetch()를 호출하면 fetchSlots를 다시 실행한다(제출 직전 슬롯 충돌 대응)", async () => {
    const fetchSlots = vi.fn().mockResolvedValue([{ startsAt: SLOT_ISO }]);
    const ref = createRef<ConsultSlotPickerHandle>();
    render(<ConsultSlotPicker ref={ref} fetchSlots={fetchSlots} selectedStartsAt={null} onSelect={() => {}} timezone={TZ} />);
    await waitFor(() => expect(fetchSlots).toHaveBeenCalledTimes(1));
    ref.current?.refetch();
    await waitFor(() => expect(fetchSlots).toHaveBeenCalledTimes(2));
  });
});
