import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProblemFigure from "./ProblemFigure";
import { validateFigureSpec } from "@/lib/problem-figures/spec";

vi.mock("./problem-image-actions", () => ({ getProblemImageUrlAction: vi.fn() }));
afterEach(cleanup);

const one = { type: "image", bucket: "static", path: "ap-sources/img-next-1904/image.jpg", alt: "cartoon", credit: "Credit A", label: "Document 6" };
const two = { ...one, more: [{ path: "ap-sources/img-lowell-1840/image.jpg", alt: "print", credit: "Credit B", label: "Document 7" }] };

describe("static image figure (real sources)", () => {
  it("renders every image with its label and visible credit, each opening full size", () => {
    render(<ProblemFigure spec={two} />);
    expect(screen.getAllByTestId("problem-figure")).toHaveLength(2);
    expect(screen.getAllByTestId("figure-label").map((e) => e.textContent)).toEqual(["Document 6", "Document 7"]);
    expect(screen.getAllByTestId("figure-credit").map((e) => e.textContent)).toEqual(["Credit A", "Credit B"]);
    const links = screen.getAllByTestId("figure-open-full") as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/ap-sources/img-next-1904/image.jpg", "/ap-sources/img-lowell-1840/image.jpg"]);
    for (const a of links) { expect(a.target).toBe("_blank"); expect(a.rel).toContain("noopener"); }
    expect(screen.getAllByRole("img").map((i) => i.getAttribute("alt"))).toEqual(["cartoon", "print"]);
  });
  it("a single image keeps working without a label", () => {
    render(<ProblemFigure spec={{ ...one, label: undefined }} />);
    expect(screen.getAllByTestId("problem-figure")).toHaveLength(1); expect(screen.queryByTestId("figure-label")).toBeNull();
  });
  it("validation: more needs static path + credit, max 3, static only", () => {
    expect(validateFigureSpec(two).ok).toBe(true);
    expect(validateFigureSpec({ ...two, more: [{ path: "../x.jpg", credit: "c" }] }).ok).toBe(false);
    expect(validateFigureSpec({ ...two, more: [{ path: two.more[0].path, credit: " " }] }).ok).toBe(false);
    expect(validateFigureSpec({ ...two, more: [two.more[0], two.more[0], two.more[0], two.more[0]] }).ok).toBe(false);
    expect(validateFigureSpec({ type: "image", bucket: "private", path: "a/b.png", more: two.more }).ok).toBe(false);
  });
});
