import { describe, expect, it } from "vitest";
import { findAwkwardFraming, stripMetaLead } from "./awkward-framing";

describe("stripMetaLead", () => {
  it("removes the compiler lead sentence only", () => {
    expect(stripMetaLead("Today, a tutor is checking a warm-up question at the whiteboard and wonders which method is fastest. The equation below has one solution.")).toBe("The equation below has one solution.");
    expect(stripMetaLead("A teacher buys apples and pears at fixed prices.")).toBe("A teacher buys apples and pears at fixed prices.");
  });
});

describe("findAwkwardFraming", () => {
  it.each([
    "For extra practice, an instructor is preparing an old test item at the whiteboard and is unsure which method to use.",
    "In a practice session, a club advisor is presenting a practice problem with a partner and is unsure.",
    "Last week, a teaching assistant is working through a homework item for a math contest.",
    "The following scenario comes from a short practice worksheet.",
    "Think about the everyday situation described in this passage.",
    "The equation $2x + 3 = 7$ are equivalent to the equation below.",
  ])("rejects: %s", (s) => expect(findAwkwardFraming(s)).not.toBeNull());

  it.each([
    "In the system below, k and c are constants.",
    "The equations of system A are $a + b = 8$ and $a - b = 16$.",
    "A teacher buys apples and pears at fixed prices.",
    "Rosa can stock a warehouse in 6 hours when working alone.",
    "Line j has slope -3 and passes through the point $(1, 2)$.",
    "A student is solving the system of equations below.",
  ])("accepts: %s", (s) => expect(findAwkwardFraming(s)).toBeNull());
});
