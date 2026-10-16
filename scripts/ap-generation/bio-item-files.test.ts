import { describe, expect, it } from "vitest";
import { BIO_ITEM_FILE_RE, bioItemNames } from "./supp-batches";
import { STOCK_FILES } from "./keys-file";

// Biology 재고 파일 이름 규칙(2026-10-13): data/ap/stock/bio-<배치>-items.json 은 keys-file(STOCK_FILES)·render-check(SUPP_FILES)가 목록 수정 없이 디스크에서 찾는다.
describe("Biology stock item file pattern", () => {
  it("matches bio batch item files only", () => {
    for (const ok of ["bio-p1a-items.json", "bio-p1b-items.json", "bio-s2a-items.json", "bio-s2-shortfall-a-items.json"]) expect(BIO_ITEM_FILE_RE.test(ok), ok).toBe(true);
    for (const bad of ["bio-items.json", "bio-p1a-pass-keys.json", "bio-p1a-summary.json", "chem-p1a-items.json", "xbio-p1a-items.json", "bio-P1A-items.json", "bio-p1a-items.json.bak"]) expect(BIO_ITEM_FILE_RE.test(bad), bad).toBe(false);
  });
  it("bioItemNames is empty until a bio batch exists on disk, and STOCK_FILES carries exactly those names (no list edit needed per batch)", () => {
    const names = bioItemNames();
    expect(names.every((n) => /^bio-/.test(n) && !n.endsWith(".json"))).toBe(true);
    expect(STOCK_FILES.filter((f) => /^bio-/.test(f))).toEqual(names);
  });
});
