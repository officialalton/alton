import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/analytics/next", () => ({ Analytics: () => <div data-testid="vercel-analytics" /> }));
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => <div data-testid="vercel-speed-insights" /> }));

const ORIGINAL = process.env.NEXT_PUBLIC_VERCEL_ENV;

describe("AnalyticsScripts", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    else process.env.NEXT_PUBLIC_VERCEL_ENV = ORIGINAL;
    vi.resetModules();
  });

  it("production이 아니면 아무 스크립트도 렌더링하지 않는다", async () => {
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    const { default: AnalyticsScripts } = await import("./AnalyticsScripts");
    const { queryByTestId } = render(<AnalyticsScripts />);
    expect(queryByTestId("vercel-analytics")).toBeNull();
    expect(queryByTestId("vercel-speed-insights")).toBeNull();
  });

  it("preview면 아무 스크립트도 렌더링하지 않는다", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    const { default: AnalyticsScripts } = await import("./AnalyticsScripts");
    const { queryByTestId } = render(<AnalyticsScripts />);
    expect(queryByTestId("vercel-analytics")).toBeNull();
    expect(queryByTestId("vercel-speed-insights")).toBeNull();
  });

  it("production이면 Analytics·SpeedInsights를 모두 렌더링한다", async () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    const { default: AnalyticsScripts } = await import("./AnalyticsScripts");
    const { queryByTestId } = render(<AnalyticsScripts />);
    expect(queryByTestId("vercel-analytics")).not.toBeNull();
    expect(queryByTestId("vercel-speed-insights")).not.toBeNull();
  });
});
