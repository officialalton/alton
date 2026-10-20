import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes core pages and all 15 subject pages; no insights URLs when empty", async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/practice-tests/ap-calculus-ab"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/practice-tests/sat"))).toBe(true);
    expect(urls.filter((u) => u.includes("/practice-tests/"))).toHaveLength(15);
    expect(urls.some((u) => u.includes("/insights"))).toBe(false);
  });
});
