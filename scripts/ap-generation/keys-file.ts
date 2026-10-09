// 선택 목록 읽기: JSON 배열 / 줄 단위 키 / ab-select 결과 객체({keys:{mcA,mcB,frqA,frqB}}). 객체면 섹션 지정(mcA→ap_mc_a …)도 돌려준다.
import { readFileSync } from "node:fs";
import path from "node:path";
const SEC: Record<string, string> = { mcA: "ap_mc_a", mcB: "ap_mc_b", frqA: "ap_frq_a", frqB: "ap_frq_b" };
export function readKeysFile(file: string): { keys: string[]; sectionOf: Map<string, string> } {
  const raw = readFileSync(path.resolve(process.cwd(), file), "utf-8").trim();
  const sectionOf = new Map<string, string>();
  if (raw.startsWith("[")) return { keys: JSON.parse(raw) as string[], sectionOf };
  if (raw.startsWith("{")) {
    const o = JSON.parse(raw) as { keys?: Record<string, string[]> }; const keys: string[] = [];
    for (const [g, list] of Object.entries(o.keys ?? {})) for (const k of list) { keys.push(k); if (SEC[g]) sectionOf.set(k, SEC[g]); }
    return { keys, sectionOf };
  }
  return { keys: raw.split("\n").map((l) => l.trim()).filter(Boolean), sectionOf };
}
export const STOCK_FILES = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items", "graph-s1-items", "graph-s2a-items", "graph-s2b-items", "graph-s3a-items", "graph-s3b-items", "graph-s3c-items", "graph-s3d-items"];
