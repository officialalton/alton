// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { STUDENT_TERMS_VERSION } from "@/lib/free-member-signup";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

vi.mock("@/lib/landing/viewer", () => ({ loadLandingViewer: async () => ({}) }));
vi.mock("@/lib/landing/cta", () => ({ resolveLandingDestinations: () => ({}) }));
vi.mock("@/app/components/public/PublicShell", () => ({
  PublicPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PageHero: ({ title }: { title: string }) => <h1>{title}</h1>,
  Prose: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("legal pages", () => {
  it("version and last-updated date are in step", () => {
    expect(STUDENT_TERMS_VERSION).toBe("2026-10-06");
    expect(LEGAL_LAST_UPDATED).toBe("October 6, 2026");
  });

  it.each([
    ["privacy", async () => (await import("./privacy/page")).default, "under 13"],
    ["terms", async () => (await import("./terms/page")).default, "College Board"],
  ])("%s page renders without draft banner, with last updated and anchors", async (_n, load, phrase) => {
    const Page = await load();
    render(await Page());
    expect(document.body.textContent).not.toMatch(/pending legal review/i);
    expect(screen.getByText(/Last updated: October 6, 2026/)).toBeTruthy();
    expect(document.body.textContent).toContain(phrase);
    const links = [...document.querySelectorAll("nav a")].map((a) => a.getAttribute("href")!.slice(1));
    expect(links.length).toBeGreaterThan(8);
    for (const id of links) expect(document.getElementById(id)).not.toBeNull();
  });
});
