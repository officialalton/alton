import { describe, expect, it } from "vitest";
import { buildStock, cellCounts, contentSignature, LATEST_GATE, shortfall, summarize, topicTargets, type RawCand } from "./stock";

const mc = (key: string, subject: string, stem: string, opts: string[], extra: Partial<RawCand> = {}): RawCand => ({ candidateKey: key, cellId: `${subject}-c1`, apSubjectCode: subject, kind: "mc", keywordCode: "2.8", unitCode: "2", skillPrimary: "1.E", structure: "standalone", calculator: "not_allowed",
  reviewState: "pending_expert_review", reserve: false, rejectionReason: null, difficultyProvisional: "exam_prep", payload: { stem, options: opts.map((t) => ({ text: t })), stimulus: { data: {} } }, ...extra });

describe("stock: separate validation / expert / selection, exact vs variants", () => {
  it("old selected/reserve rows are NOT promoted: pre-latest-gate passes need revalidation; latest-gate passes are auto_passed", () => {
    const s = buildStock({ run1: [mc("a", "ap_calculus_ab", "Old gate item alpha one", ["$1$", "$2$"]), mc("b", "ap_calculus_ab", "Old gate reserve bravo", ["$3$", "$4$"], { reserve: true })], run2: [mc("c", "ap_calculus_ab", "Latest gate item charlie unique words", ["$5$", "$6$"], { archetype: "x" })] });
    const by = Object.fromEntries(s.map((x) => [x.candidateKey, x]));
    expect(by.a.validation).toBe("needs_revalidation"); expect(by.b.validation).toBe("needs_revalidation"); expect(by.b.legacyReserve).toBe(true); expect(by.c.validation).toBe("auto_passed"); expect(by.c.gateVersion).toBe(LATEST_GATE);
    expect(s.every((x) => !x.publishable)).toBe(true);                       // 전문가 승인 전에는 공개 가능 0
    expect(by.c.expertStatus).toBe("pending"); expect(by.a.expertStatus).toBe("none"); expect(by.a.selectedForSample).toBe(true); expect(by.b.selectedForSample).toBe(false);
  });
  it("publishable = latest-gate auto_passed AND expert approved/waived; history is preserved per item", () => {
    const s = buildStock({ run2: [mc("c", "ap_calculus_ab", "Item charlie", ["$5$", "$6$"], { archetype: "x" })] }, { expert: { "run2:c": "approved" }, history: { "run2:c": [{ run: "run2a", gateVersion: "v2-interim", outcome: "rejected", reasons: "criterion_failed_x" }] } });
    expect(s[0].publishable).toBe(true); expect(s[0].history.map((h) => h.run)).toEqual(["run2a", "run2"]); expect(s[0].history[0].outcome).toBe("rejected");
  });
  it("exact duplicates link to a canonical and leave the count; number/wording variants stay and form one item family (not rejected)", () => {
    const base = "A particle moves along the x axis with velocity given by a quadratic function of time and we ask for the acceleration at the stated instant in seconds";
    const a = mc("a", "ap_calculus_ab", base, ["$1$", "$2$"], { archetype: "motion" }); const dupA = mc("dup", "ap_calculus_ab", base, ["$2$", "$1$"], { archetype: "motion" });
    const v = mc("v", "ap_calculus_ab", base + " now", ["$7$", "$8$"], { archetype: "motion" }); const other = mc("o", "ap_calculus_ab", "Which statement about the series is true given the ratio test conclusion", ["$9$", "$3$"], { archetype: "series" });
    const s = buildStock({ run2: [a, dupA, v, other] }); const by = Object.fromEntries(s.map((x) => [x.candidateKey, x]));
    expect(by.dup.validation).toBe("exact_duplicate"); expect(by.dup.duplicateOf).toBe("run2:a");
    expect(by.v.validation).toBe("auto_passed"); expect(by.v.itemFamilyId).toBe(by.a.itemFamilyId); expect(by.o.itemFamilyId).not.toBe(by.a.itemFamilyId);
    const sm = summarize(s)[0]; expect(sm.exactDuplicates).toBe(1); expect(sm.autoPassed).toBe(3); expect(sm.itemFamilies).toBe(2);
  });
  it("3-gram similarity alone never rejects", () => {
    const base = "Evaluate the limit as x approaches three of the quotient formed by the stated rational function and report the exact value of that limit using algebraic factoring and cancellation of the common factor shared by the numerator and the denominator of the expression";
    const s = buildStock({ run2: [mc("a", "ap_calculus_ab", base, ["$1$", "$2$"]), mc("b", "ap_calculus_ab", base.replace("three", "four"), ["$1$", "$2$"])] });
    expect(s.filter((x) => x.validation === "auto_passed")).toHaveLength(2); expect(new Set(s.map((x) => x.itemFamilyId)).size).toBe(1);
  });
  it("AB items are shared with BC and counted once; an identical BC item collapses into the AB canonical", () => {
    const ab = mc("ab", "ap_calculus_ab", "Use the chain rule on the composite function in the table to find h prime", ["$5$", "$6$"], { archetype: "chain_table" });
    const bc = mc("bc", "ap_calculus_bc", "Use the chain rule on the composite function in the table to find h prime", ["$6$", "$5$"], { archetype: "chain_table" });
    const s = buildStock({ run2: [ab], run2bc: [bc] }); const by = Object.fromEntries(s.map((x) => [x.candidateKey, x]));
    expect(by.bc.validation).toBe("exact_duplicate"); expect(by.ab.sharedWith).toContain("ap_calculus_bc");
    const sm = summarize(s); expect(sm.find((r) => r.subject === "ap_calculus_ab")!.autoPassed).toBe(1); expect(sm.find((r) => r.subject === "ap_calculus_bc")!.autoPassed).toBe(0); expect(sm.find((r) => r.subject === "ap_calculus_bc")!.sharedIn).toBe(1);
  });
  it("cell fill counts latest-gate item families capped per family, so stale passes and number variants cannot fill a cell", () => {
    const same = (i: number) => mc(`v${i}`, "ap_calculus_ab", `Template stem about the product rule with different numbers ${i * 3} and ${i * 7} then more shared words here`, [`$${i}$`, `$${i + 9}$`], { archetype: "product_table" });
    const s = buildStock({ run1: [mc("old", "ap_calculus_ab", "A stale old gate item in the same cell unique words", ["$1$", "$2$"])], run2: [1, 2, 3, 4, 5].map(same) });
    const c = cellCounts(s, false)[0];
    expect(c.autoPassed).toBe(5); expect(c.families).toBe(1); expect(c.effective).toBe(2); expect(c.needsRevalidation).toBe(1);
    expect(shortfall(4, c.effective)).toBe(2);
  });
  it("topic targets follow official unit weights; signature ignores option order", () => {
    const t = topicTargets([{ code: "1", topics: [{ code: "1.1", scope: "both" }, { code: "1.2", scope: "both" }] }, { code: "2", topics: [{ code: "2.1", scope: "both" }, { code: "2.2", scope: "bc_only" }] }], { "1": [10, 20], "2": [30, 50] }, 100, "ap_calculus_ab");
    expect(t["1.1"] + t["1.2"]).toBe(27); expect(t["2.1"]).toBe(73); expect(t["2.2"]).toBeUndefined();
    expect(contentSignature(mc("a", "x", "s", ["$1$", "$2$"]))).toBe(contentSignature(mc("b", "x", "s", ["$2$", "$1$"])));
  });
});
