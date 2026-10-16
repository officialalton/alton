import { describe, expect, it } from "vitest";
import { EL_ITEM_FILE_RE, LT_ITEM_FILE_RE, elItemNames, ltItemNames } from "./supp-batches";
import { STOCK_FILES } from "./keys-file";

// English 재고 파일 이름 규칙(2026-10-14): data/ap/stock/el-<배치>-items.json 은 keys-file(STOCK_FILES)·render-check(SUPP_FILES)가 목록 수정 없이 디스크에서 찾는다.
describe("English stock item file pattern", () => {
  it("matches el batch item files only", () => {
    for (const ok of ["el-p1a-items.json", "el-p2a-items.json", "el-p2-frq-items.json"]) expect(EL_ITEM_FILE_RE.test(ok), ok).toBe(true);
    for (const bad of ["el-items.json", "el-p1a-pass-keys.json", "el-p1a-summary.json", "chem-p1a-items.json", "xel-p1a-items.json", "el-P1A-items.json", "el-p1a-items.json.bak"]) expect(EL_ITEM_FILE_RE.test(bad), bad).toBe(false);
  });
  it("STOCK_FILES carries exactly the el files found on disk", () => {
    const names = elItemNames();
    expect(names.every((n) => /^el-/.test(n) && !n.endsWith(".json"))).toBe(true);
    expect(STOCK_FILES.filter((f) => /^el-/.test(f))).toEqual(names);
  });
  it("matches lt (English Literature) batch item files only, and STOCK_FILES carries them", () => {
    for (const ok of ["lt-p1a-items.json", "lt-p2-frq-items.json"]) expect(LT_ITEM_FILE_RE.test(ok), ok).toBe(true);
    for (const bad of ["lt-items.json", "lt-p1a-pass-keys.json", "el-p1a-items.json", "xlt-p1a-items.json"]) expect(LT_ITEM_FILE_RE.test(bad), bad).toBe(false);
    expect(STOCK_FILES.filter((f) => /^lt-/.test(f))).toEqual(ltItemNames());
  });
});
