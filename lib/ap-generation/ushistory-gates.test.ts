import { describe, expect, it } from "vitest";
import { realPeopleIn, dateConflicts, derivedViolations, itemViolations, lengthBias, setViolations, yearRangeViolations, type UshItemRaw, type UshSetRaw } from "./ushistory-gates";

const body = "Our town has watched the wagons pass for a season, and the merchants of the river landing now speak of little but the price of freight and the coming of the rails. ".repeat(2);
const set = (o: Partial<UshSetRaw> = {}): UshSetRaw => ({ period: 6, stim_type: "primary_text", theme: "t", title: "A merchant's letter", sources: [{ id: "A", kind: "primary_text", title: "Letter", attribution: "A letter from a fictional river-town merchant, 1881 (ALTON-composed, in the style of period correspondence)", body, provenance: { kind: "alton_composed", note: "x" } }], items: [], ...o });
const opt = (text: string, is_key: boolean, label = "key") => ({ text, is_key, label: is_key ? "key" : label, why: "this explanation is long enough to count" });
const item = (o: Partial<UshItemRaw> = {}): UshItemRaw => ({ skill: "2.B", topic: "6.6", stem: "Which of the following best explains the merchant's concern in the excerpt?", options: [opt("Falling freight prices on rail lines", true), opt("A shortage of river steamboats in the region overall", false, "wrong_period"), opt("Growing federal taxes on all river commerce today", false, "reversal"), opt("The closing of the western frontier markets entirely", false, "too_broad")], facts: ["Railroads expanded after 1865"], est_seconds: 70, ...o });

describe("ushistory gates", () => {
  it("flags dates that conflict with the canon and accepts correct ones", () => {
    expect(dateConflicts("The Dred Scott decision of 1858 held that")).toEqual(["date_conflict_dred_scott_1858_vs_1857"]);
    expect(dateConflicts("The Dred Scott decision of 1857 held that")).toEqual([]);
    expect(dateConflicts("The Seven Years' War (1754) began")).toEqual([]);
  });
  it("flags years far from the period", () => { expect(yearRangeViolations("In 1492 and 1999", 6)).toContain("year_1492_far_from_period_6"); expect(yearRangeViolations("In 1881", 6)).toEqual([]); });
  it("recomputes derived numbers", () => {
    expect(derivedViolations(item({ derived: [{ desc: "growth", op: "pct_change", operands: [50, 75], result: 50 }] }))).toEqual([]);
    expect(derivedViolations(item({ derived: [{ desc: "growth", op: "pct_change", operands: [50, 75], result: 40 }] }))[0]).toMatch(/derived_mismatch/);
  });
  it("detects the key being the longest option", () => {
    const longKey = item({ options: [opt("A very long and detailed correct answer about freight", true), opt("Short wrong", false, "reversal"), opt("Another wrong one", false, "too_broad"), opt("Third wrong", false, "wrong_period")] });
    expect(lengthBias(longKey)).toBe(true); expect(itemViolations(set(), longKey)).toContain("key_is_longest_option");
    expect(lengthBias(item())).toBe(false);
  });
  it("accepts a clean set and rejects real people in attribution and missing marker", () => {
    expect(setViolations(set(), { period: 6, stim: "primary_text" }).filter((v) => !/^items_/.test(v))).toEqual([]);
    const bad = set({ sources: [{ ...set().sources[0], attribution: "A letter by Abraham Lincoln, 1881" }] });
    const v = setViolations(bad, { period: 6, stim: "primary_text" }); expect(v.join()).toMatch(/real_person_in_attribution_abraham lincoln/); expect(v.join()).toMatch(/not_marked_alton_composed/);
  });
  it("real people: full names and titled surnames only (place names such as Washington or Monroe pass)", () => {
    expect(realPeopleIn("A letter from a fictional editor in Washington County (ALTON-composed)")).toEqual([]);
    expect(realPeopleIn("Monroe Ledger, 1887")).toEqual([]);
    expect(realPeopleIn("A speech by President Lincoln, 1863")).toEqual(["lincoln"]);
    expect(realPeopleIn("Letter of Thomas Jefferson")).toEqual(["thomas jefferson"]);
  });
  it("rejects item hazards", () => { expect(itemViolations(set(), item({ stem: "Which cost $5 more than the other option in the excerpt?" }))).toContain("item_dollar_sign"); expect(itemViolations(set(), item({ skill: "6.A" }))).toContain("skill_6.A_not_assessed_in_mc"); });
});
