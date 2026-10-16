import { describe, expect, it } from "vitest";
import { isAllowedReturnPath } from "./return-to";

describe("isAllowedReturnPath — 열린 리다이렉트 차단", () => {
  it("/guardian-link/<token>만 허용한다", () => {
    expect(isAllowedReturnPath("/guardian-link/" + "a".repeat(64))).toBe(true);
    expect(isAllowedReturnPath("/guardian-link/short")).toBe(false);
    expect(isAllowedReturnPath("/parent")).toBe(false);
    expect(isAllowedReturnPath("https://evil.example/guardian-link/" + "a".repeat(64))).toBe(false);
    expect(isAllowedReturnPath("/guardian-link/" + "a".repeat(64) + "?x=1")).toBe(false);
    expect(isAllowedReturnPath(null)).toBe(false);
  });
});
