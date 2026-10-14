import { describe, expect, it } from "vitest";
import { CSA_ITEM_FILE_RE, csaItemNames } from "./supp-batches";
import { STOCK_FILES } from "./keys-file";

// CS A 재고 파일 이름 규칙(2026-10-13): data/ap/stock/csa-<배치>-items.json 은 keys-file(STOCK_FILES)·render-check(SUPP_FILES)가 목록 수정 없이 디스크에서 찾는다.
describe("CS A stock item file pattern", () => {
  it("matches csa batch item files only", () => {
    for (const ok of ["csa-p1a-items.json", "csa-p1b-items.json", "csa-s2a-items.json", "csa-s2-shortfall-a-items.json"]) expect(CSA_ITEM_FILE_RE.test(ok), ok).toBe(true);
    for (const bad of ["csa-items.json", "csa-p1a-pass-keys.json", "csa-p1a-summary.json", "chem-p1a-items.json", "xcsa-p1a-items.json", "csa-P1A-items.json", "csa-p1a-items.json.bak"]) expect(CSA_ITEM_FILE_RE.test(bad), bad).toBe(false);
  });
  it("csaItemNames is empty until a csa batch exists on disk, and STOCK_FILES carries exactly those names (no list edit needed per batch)", () => {
    const names = csaItemNames();
    expect(names.every((n) => /^csa-/.test(n) && !n.endsWith(".json"))).toBe(true);
    expect(STOCK_FILES.filter((f) => /^csa-/.test(f))).toEqual(names);
  });
});
