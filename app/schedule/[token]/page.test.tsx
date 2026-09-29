import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const checkMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/consultation/scheduling-link", async (orig) => ({
  ...(await orig<typeof import("@/lib/consultation/scheduling-link")>()),
  checkSchedulingLink: checkMock,
}));
vi.mock("./ScheduleForm", () => ({ default: () => <div>SCHEDULE_FORM</div> }));

import Page from "./page";

describe("/schedule/[token]", () => {
  it("무효·만료 토큰은 폼 대신 안내 문구", async () => {
    checkMock.mockResolvedValue("invalid");
    render(await Page({ params: Promise.resolve({ token: "bogus" }) }));
    expect(screen.getByText("유효하지 않거나 만료된 예약 링크입니다.")).toBeInTheDocument();
    expect(screen.queryByText("SCHEDULE_FORM")).toBeNull();
  });

  it.each(["valid", "unknown"] as const)("%s 는 기존대로 폼을 그린다", async (status) => {
    checkMock.mockResolvedValue(status);
    render(await Page({ params: Promise.resolve({ token: "t" }) }));
    expect(screen.getByText("SCHEDULE_FORM")).toBeInTheDocument();
  });
});
