import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/insights/sanity", () => ({ getPublishedPosts: async () => [] }));
vi.mock("@/lib/landing/test-pages", () => ({
  getAllPublicTestPaths: async () => [{ subject: "sat", test: { id: "1", name: "SAT Practice Test 1", slug: "sat-practice-test-1" } }],
}));

import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes core pages, hubs, all subject pages and per-test pages with lastmod; no insights URLs when empty", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith("/practice-tests/ap-calculus-ab"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/practice-tests/sat"))).toBe(true);
    expect(urls.filter((u) => /\/practice-tests\/[^/]+$/.test(u))).toHaveLength(19);
    expect(urls).toContain("https://alton.education/practice-tests/sat/sat-practice-test-1");
    for (const p of ["/ap-practice-tests", "/sat-math-practice", "/sat-reading-and-writing-practice"]) expect(urls).toContain(`https://alton.education${p}`);
    expect(entries.every((e) => e.lastModified)).toBe(true);
    expect(urls.some((u) => u.includes("/insights"))).toBe(false);
  });
});
