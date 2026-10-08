import { describe, expect, it } from "vitest";
import { groupKeywordsByDomain, keywordDisplayLabel } from "./group";

describe("keywordDisplayLabel (AP curriculum keywords)", () => {
  it("prefixes official topic codes, indents sub-keywords, leaves legacy labels alone", () => {
    expect(keywordDisplayLabel({ label: "Defining Limits", officialCode: "1.2", level: 1 })).toBe("1.2 Defining Limits");
    expect(keywordDisplayLabel({ label: "One-sided limits", officialCode: "1.2#1", level: 2 })).toBe("· One-sided limits");
    expect(keywordDisplayLabel({ label: "Inferences", level: 0 })).toBe("Inferences");
  });
  it("groups AP keywords by unit folder in teaching order (topic then its sub-keywords)", () => {
    const items = [
      { id: "b", label: "Sub", folderId: "u1", folderName: "Unit 1: Limits", folderPosition: 1, sortOrder: 2, officialCode: "1.1#1", level: 2 },
      { id: "a", label: "Topic", folderId: "u1", folderName: "Unit 1: Limits", folderPosition: 1, sortOrder: 1, officialCode: "1.1", level: 1 },
      { id: "c", label: "Other unit", folderId: "u2", folderName: "Unit 2", folderPosition: 2, sortOrder: 3, officialCode: "2.1", level: 1 },
    ];
    const groups = groupKeywordsByDomain(items);
    expect(groups.map((g) => g.label)).toEqual(["Unit 1: Limits", "Unit 2"]);
    expect(groups[0].items.map((k) => k.id)).toEqual(["a", "b"]);
  });
});
