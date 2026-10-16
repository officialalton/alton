import { afterEach, describe, expect, it } from "vitest";
import { isAnalyticsEnabled } from "./config";

const ORIGINAL = process.env.NEXT_PUBLIC_VERCEL_ENV;

describe("isAnalyticsEnabled", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    else process.env.NEXT_PUBLIC_VERCEL_ENV = ORIGINAL;
  });

  it("NEXT_PUBLIC_VERCEL_ENV이 없으면(local/test) false", () => {
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("preview면 false", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("development면 false", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "development";
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("production이면 true", () => {
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    expect(isAnalyticsEnabled()).toBe(true);
  });
});
