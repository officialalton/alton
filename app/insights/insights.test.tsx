import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/cache", () => ({ unstable_cache: <T,>(fn: T) => fn }));
vi.mock("@/lib/landing/viewer", () => ({ loadLandingViewer: async () => ({ kind: "anonymous" }) }));
vi.mock("@/app/components/legal/LegalLink", () => ({ default: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import InsightsPage, { metadata } from "./page";
import { generateMetadata as subjectMeta } from "../practice-tests/[subject]/page";

describe("/insights without Sanity", () => {
  it("renders the Coming soon empty state with canonical metadata", async () => {
    render(await InsightsPage());
    expect(screen.getByTestId("insights-empty").textContent).toContain("Coming soon");
    expect(metadata.alternates?.canonical).toBe("/insights");
    expect(document.querySelector('nav a[href="/insights"]')).toBeNull();
  });
});

describe("subject metadata", () => {
  it("has canonical, title and og for a subject; empty for unknown", async () => {
    const m = await subjectMeta({ params: Promise.resolve({ subject: "ap-calculus-ab" }) });
    expect(m.alternates?.canonical).toBe("/practice-tests/ap-calculus-ab");
    expect(String(m.title)).toContain("AP Calculus AB");
    expect(await subjectMeta({ params: Promise.resolve({ subject: "nope" }) })).toEqual({});
  });
});
