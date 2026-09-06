import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TeacherAvailabilityTab from "./TeacherAvailabilityTab";

const baseProps = {
  initialRules: [],
  initialExceptions: [],
  timezone: "America/Los_Angeles",
  onAddRule: vi.fn().mockResolvedValue("rule1"),
  onRemoveRule: vi.fn().mockResolvedValue(undefined),
  onAddException: vi.fn().mockResolvedValue("ex1"),
  onRemoveException: vi.fn().mockResolvedValue(undefined),
  onLoadExternalBusy: vi.fn().mockResolvedValue([]),
};

describe("TeacherAvailabilityTab", () => {
  it("월간 달력이 기본으로 렌더링된다", () => {
    render(<TeacherAvailabilityTab {...baseProps} />);
    expect(screen.getByLabelText("다음 달")).toBeInTheDocument();
  });

  it("선택한 날짜를 휴무로 등록하면 onAddException이 호출된다", async () => {
    const onAddException = vi.fn().mockResolvedValue("ex1");
    render(<TeacherAvailabilityTab {...baseProps} onAddException={onAddException} />);
    fireEvent.click(screen.getByText("이 날짜 휴무로"));
    await waitFor(() => expect(onAddException).toHaveBeenCalled());
    expect(onAddException.mock.calls[0][0]).toMatchObject({ kind: "blocked" });
  });

  it("반복 가능시간이 등록돼 있으면 기본으로 주간 그리드가 렌더링된다", () => {
    render(
      <TeacherAvailabilityTab
        {...baseProps}
        initialRules={[
          { id: "rule1", dayOfWeek: 1, startTimeLocal: "10:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01", effectiveUntil: null },
        ]}
      />
    );
    expect(screen.getByTestId("weekly-availability-grid")).toBeInTheDocument();
  });

  it("그리드에서 블록을 클릭하면 onRemoveRule이 호출된다", async () => {
    const onRemoveRule = vi.fn().mockResolvedValue(undefined);
    render(
      <TeacherAvailabilityTab
        {...baseProps}
        onRemoveRule={onRemoveRule}
        initialRules={[
          { id: "rule1", dayOfWeek: 1, startTimeLocal: "10:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01", effectiveUntil: null },
        ]}
      />
    );
    fireEvent.click(screen.getByTestId("availability-block-rule1"));
    await waitFor(() => expect(onRemoveRule).toHaveBeenCalledWith("rule1"));
  });

  it("목록 보기로 전환하면 요일·시간 텍스트 목록이 보인다", () => {
    render(
      <TeacherAvailabilityTab
        {...baseProps}
        initialRules={[
          { id: "rule1", dayOfWeek: 1, startTimeLocal: "10:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01", effectiveUntil: null },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "목록" }));
    expect(screen.getByText("월요일 10:00~17:00")).toBeInTheDocument();
  });

  it("기존 예외가 있는 날짜를 선택하면 삭제 버튼이 보인다", () => {
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
    render(
      <TeacherAvailabilityTab
        {...baseProps}
        initialExceptions={[{ id: "ex1", exceptionDate: todayKey, kind: "blocked", reason: null }]}
      />
    );
    expect(screen.getByText("이 예외 삭제")).toBeInTheDocument();
  });

  // 2026-09-06 — 제품 오너 요구사항: 반복 규칙으로 특정 요일이 열려 있어도 특정
  // 날짜의 일부 시간대만 개별로 휴무 조정할 수 있어야 한다.
  it("이 날짜의 오픈 시간 타임라인이 반복 규칙을 반영해 렌더링된다", () => {
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
    const dow = new Date(`${todayKey}T12:00:00Z`).getUTCDay();
    render(
      <TeacherAvailabilityTab
        {...baseProps}
        initialRules={[
          { id: "rule1", dayOfWeek: dow, startTimeLocal: "09:00", endTimeLocal: "17:00", timezone: "America/Los_Angeles", effectiveFrom: "2026-01-01", effectiveUntil: null },
        ]}
      />
    );
    const timeline = screen.getByTestId("teacher-day-timeline");
    expect(timeline).toHaveTextContent("09:00~17:00");
  });

  it("부분 시간 휴무를 등록하면 onAddException이 startTimeLocal/endTimeLocal과 함께 호출된다", async () => {
    const onAddException = vi.fn().mockResolvedValue("ex-partial");
    render(<TeacherAvailabilityTab {...baseProps} onAddException={onAddException} />);
    fireEvent.click(screen.getByText("이 시간대만 휴무로"));
    await waitFor(() => expect(onAddException).toHaveBeenCalled());
    expect(onAddException.mock.calls[0][0]).toMatchObject({
      kind: "blocked",
      startTimeLocal: "13:00",
      endTimeLocal: "14:00",
    });
  });

  it("부분 시간 휴무 등록 후 목록에 표시되고 삭제할 수 있다", async () => {
    const onAddException = vi.fn().mockResolvedValue("ex-partial");
    const onRemoveException = vi.fn().mockResolvedValue(undefined);
    render(<TeacherAvailabilityTab {...baseProps} onAddException={onAddException} onRemoveException={onRemoveException} />);
    fireEvent.click(screen.getByText("이 시간대만 휴무로"));
    await waitFor(() => expect(screen.getByText(/부분 휴무: 13:00~14:00/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("삭제"));
    await waitFor(() => expect(onRemoveException).toHaveBeenCalledWith("ex-partial"));
  });
});
