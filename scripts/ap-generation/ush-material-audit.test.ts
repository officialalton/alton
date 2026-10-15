import { describe, expect, it } from "vitest";
import { frqTypes, tally } from "./ush-material-audit";
describe("ush audit", () => {
  it("parses DBQ document types", () => { expect(frqTypes("ap_us_history-dbq_1", { set_intro: "x\nDocument 1 (primary text)\nDocument 7 (chart)" })).toEqual(["primary_text", "chart"]); });
  it("LEQ has no stimulus; SAQ3 uses stimulus kind", () => { expect(frqTypes("ap_us_history-leq_1", {})).toEqual(["none(prompt only)"]); expect(frqTypes("ap_us_history-saq3_1", { stimulus: { kind: "table" } })).toEqual(["table"]); });
  it("tallies", () => { expect(tally([{ part: "mc", stimTypes: ["table"] } as any])).toEqual({ mc: { table: 1 } }); });
});
