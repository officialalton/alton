import { describe, expect, it } from "vitest";
import { planOutputs } from "./ab-select-output";
describe("ab-select 출력 계획", () => {
  it("기본·--dry-run 은 아무것도 쓰지 않는다", () => {
    expect(planOutputs([])).toEqual({ writeReport: undefined, writePublished: false });
    expect(planOutputs(["--dry-run"])).toEqual({ writeReport: undefined, writePublished: false });
  });
  it("--dry-run 과 쓰기 옵션 조합은 거부", () => {
    expect(planOutputs(["--dry-run", "--write-report", "/tmp/x.md"]).error).toBeTruthy();
    expect(planOutputs(["--dry-run", "--write-published"]).error).toBeTruthy();
  });
  it("게시본은 --write-published 명시 때만, report 로는 게시본 경로 불가", () => {
    expect(planOutputs(["--write-published"]).writePublished).toBe(true);
    expect(planOutputs(["--write-report", "docs/ap/ab-full-set-selection.md"]).error).toBeTruthy();
    expect(planOutputs(["--write-report", "./data/ap/stock/ab-full-set-selection.json"]).error).toBeTruthy();
    expect(planOutputs(["--write-report", "/tmp/r.md"])).toEqual({ writeReport: "/tmp/r.md", writePublished: false });
    expect(planOutputs(["--write-report"]).error).toBeTruthy();
  });
});
