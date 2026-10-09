import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { itemContentHash, validateScreenEntry, judgeScreenEntries, type ScreenEntry } from "./verify-guard";

// 커밋된 화면 검증 증거(data/ap/screen-evidence/evidence-*.json)가 스키마를 지키고 재고 파일의 현재 내용 해시와 일치하는지 점검한다.
const files = existsSync("data/ap/screen-evidence") ? readdirSync("data/ap/screen-evidence").filter((f) => /^evidence-.*\.json$/.test(f)) : [];
describe.each(files)("증거 파일 %s", (f) => {
  const ev = JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { schema: string; entries: ScreenEntry[] };
  const stock = new Map((JSON.parse(readFileSync("data/ap/stock/items.json", "utf-8")) as { stockKey: string; payload: Record<string, unknown> }[]).map((i) => [i.stockKey, i.payload]));
  it("모든 항목이 유효하고 재고 payload 해시와 같다(재고에 있는 후보 한정)", () => {
    expect(["ap-screen-evidence/v1", "ap-screen-evidence/v2", "ap-screen-evidence/v3"]).toContain(ev.schema);
    expect(ev.entries.every((e) => e.checker_kind === "automated" && e.checker.startsWith("automated-playwright"))).toBe(true);
    const by = new Map<string, ScreenEntry[]>();
    for (const e of ev.entries) { expect(validateScreenEntry(e, process.cwd())).toBeNull(); (by.get(e.candidate_key) ?? by.set(e.candidate_key, []).get(e.candidate_key)!).push(e); }
    for (const [k, es] of by) { const p = stock.get(k); if (p) expect(judgeScreenEntries(es, p, process.cwd(), { requireResult: ev.schema !== "ap-screen-evidence/v1", requireStimulus: ev.schema === "ap-screen-evidence/v3" })).toEqual({ ok: true }); }
    // 보조 적재 배치(bc-topup 등)의 키는 items.json 에 없다 — 재고에 있는 첫 후보만 대조한다.
    const firstInStock = [...by.keys()].find((k) => stock.has(k));
    if (firstInStock) expect(itemContentHash(stock.get(firstInStock)!)).toBe(ev.entries.find((e) => e.candidate_key === firstInStock)!.content_hash);
  });
});
