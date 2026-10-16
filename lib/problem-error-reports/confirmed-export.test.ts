import { describe, expect, it } from "vitest";
import { confirmedToCsv, confirmedToMarkdown, type ConfirmedExportRow } from "./confirmed-export";

const row: ConfirmedExportRow = {
  problemId: "p1", versionId: "v1", versionNo: 1, currentVersionNo: 1, satDomain: "rw_craft_structure", skillCode: "words_in_context", difficulty: "medium",
  confirmedAt: "2026-10-08T00:00:00Z", confirmNote: null, hasExplanationEn: false, hasExplanationKo: true,
  sets: [{ name: "Practice Test 1", module: "rw_m1", position: 4 }],
  reports: [{ type: "flawed_problem", memo: "밑줄 \"없음\",\n확인", reporter: "민수", role: "student", at: "2026-10-07T00:00:00Z" }],
};
describe("confirmed export", () => {
  it("markdown has ids, set/module/position, skill, explanation flags", () => {
    const md = confirmedToMarkdown([row]);
    expect(md).toContain("p1 (v1)");
    expect(md).toContain("Practice Test 1 R&W M1 #4");
    expect(md).toContain("words_in_context · medium");
    expect(md).toContain("영어 없음 / 한글 있음");
  });
  it("csv escapes quotes and newlines", () => {
    const csv = confirmedToCsv([row]);
    expect(csv).toContain('"밑줄 ""없음"", 확인"');
    expect(csv.split("\n")).toHaveLength(3);
  });
  it("empty", () => expect(confirmedToMarkdown([])).toContain("확인된 문항 없음"));
});
