import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { itemContentHash } from "./verify-guard";

// psych-hard-a/b 의 모든 통과 키: 화면 증거(모바일·데스크톱) content_hash == 재고 항목 payload 해시 == 렌더 보고서 contentHash(관리자 적재 3단계가 같은 값을 비교한다).
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const ev = rd<{ entries: { candidate_key: string; content_hash: string; viewport: string }[] }>("data/ap/screen-evidence/evidence-psych-hard.json").entries;
const render = new Map(rd<{ results: { key: string; contentHash: string }[] }>("data/ap/render-check/report.json").results.map((r) => [r.key, r.contentHash]));
for (const b of ["psych-hard-a", "psych-hard-b"]) describe(b, () => {
  const items = new Map(rd<{ stockKey: string; payload: Record<string, unknown> }[]>(`data/ap/stock/${b}-items.json`).map((r) => [r.stockKey, r]));
  it("증거·렌더 해시가 항목 해시와 같고 두 화면 크기가 모두 있다", () => {
    for (const k of rd<string[]>(`data/ap/stock/${b}-pass-keys.json`)) {
      const h = itemContentHash(items.get(k)!.payload); const es = ev.filter((e) => e.candidate_key === k);
      expect([...new Set(es.map((e) => e.viewport))].sort(), k).toEqual(["1280x800", "390x844"]); expect(es.every((e) => e.content_hash === h), k).toBe(true); expect(render.get(k), k).toBe(h);
    }
  });
});
