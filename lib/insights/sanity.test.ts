import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));

import { getPostBySlug, getPublishedPosts, hasPublishedInsights, insightsConfigured, isValidInsightSlug } from "./sanity";

describe("insights without Sanity project id", () => {
  it("is unconfigured and returns empty values (no network)", async () => {
    expect(insightsConfigured()).toBe(false);
    expect(await getPublishedPosts()).toEqual([]);
    expect(await hasPublishedInsights()).toBe(false);
    expect(await getPostBySlug("hello-world")).toBeNull();
  });
  it("validates slugs", () => {
    for (const ok of ["a", "hello-world", "ap-calc-2027"]) expect(isValidInsightSlug(ok)).toBe(true);
    for (const bad of ["", "Hello", "a--b", "-a", "a-", "a b", "a/b", "../x", 5, null]) expect(isValidInsightSlug(bad)).toBe(false);
  });
});
