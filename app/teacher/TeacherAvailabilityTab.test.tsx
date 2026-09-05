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
});
