import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { itemContentHash, validateScreenEntry, judgeScreenEntries, type ScreenEntry } from "./verify-guard";
import { STOCK_FILES } from "../../scripts/ap-generation/keys-file";

// 커밋된 화면 검증 증거(data/ap/screen-evidence/evidence-*.json)가 스키마를 지키고, 결합 재고(items.json + 모든 보조 배치: bc-topup·graph-s* 등)의
// 현재 내용 해시와 일치하는지 점검한다. 결합 재고에 없는 증거 키는 조용히 건너뛰지 않고 실패한다.
const files = existsSync("data/ap/screen-evidence") ? readdirSync("data/ap/screen-evidence").filter((f) => /^evidence-.*\.json$/.test(f)) : [];
const stock = new Map<string, Record<string, unknown>>();
for (const f of STOCK_FILES) {
  const p = `data/ap/stock/${f}.json`;
  if (!existsSync(p)) continue;
  for (const i of JSON.parse(readFileSync(p, "utf-8")) as { stockKey: string; payload: Record<string, unknown> }[]) stock.set(i.stockKey, i.payload);
}
describe.each(files)("증거 파일 %s", (f) => {
  const ev = JSON.parse(readFileSync(`data/ap/screen-evidence/${f}`, "utf-8")) as { schema: string; entries: ScreenEntry[] };
  it("모든 항목이 유효하고 결합 재고에 존재하며 모든 키의 payload 해시가 같다", () => {
    expect(["ap-screen-evidence/v1", "ap-screen-evidence/v2", "ap-screen-evidence/v3"]).toContain(ev.schema);
    expect(ev.entries.every((e) => e.checker_kind === "automated" && e.checker.startsWith("automated-playwright"))).toBe(true);
    const by = new Map<string, ScreenEntry[]>();
    for (const e of ev.entries) { expect(validateScreenEntry(e, process.cwd())).toBeNull(); (by.get(e.candidate_key) ?? by.set(e.candidate_key, []).get(e.candidate_key)!).push(e); }
    const missing = [...by.keys()].filter((k) => !stock.has(k));
    expect(missing, `결합 재고에 없는 증거 키: ${missing.slice(0, 5).join(", ")}`).toEqual([]);
    for (const [k, es] of by) {
      const p = stock.get(k)!;
      expect(judgeScreenEntries(es, p, process.cwd(), { requireResult: ev.schema !== "ap-screen-evidence/v1", requireStimulus: ev.schema === "ap-screen-evidence/v3" }), k).toEqual({ ok: true });
      for (const e of es) expect(e.content_hash, `${k} content_hash`).toBe(itemContentHash(p));
    }
  });
});
