// 선택 목록 읽기: JSON 배열 / 줄 단위 키 / ab-select 결과 객체({keys:{mcA,mcB,frqA,frqB}}). 객체면 섹션 지정(mcA→ap_mc_a …)도 돌려준다.
import { readFileSync } from "../../lib/ap-generation/data-fs";
import path from "node:path";
import { bioItemNames, csaItemNames, elItemNames, ltItemNames, macroItemNames, psychItemNames, suppItemNames, expandItemNames, ushItemNames, whItemNames, auditWuelItemNames } from "./supp-batches";
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
export const STOCK_FILES = ["items", "s1a-items", "v1ab-items", "v45ab-items", "bc-topup-items", "graph-s1-items", "graph-s2a-items", "graph-s2b-items", "graph-s3a-items", "graph-s3b-items", "graph-s3c-items", "graph-s3d-items", "graph-s3e-items", "graph-s3f-items", "graph-s3g-items", "stats-s1-items", "stats-s2a-items", "stats-s2b-items", "stats-s3a-items", "stats-s3b-items", "stats-r19-p3-items", "phys-p1a-items", "phys-p1a2-items", "phys-p1b-items", "phys-s2-items", "phys-s3-items", "phys-s4-items", "phys-s5a-items", "phys-s5s-items", "phys-s5f-items", "phys-s5b-items", "phys-s5g-items", "phys-s5h-items", "chem-p1a-items", "chem-p1a2-items", "chem-p1b-items", "chem-s2f-items", "chem-s2ma-items", "chem-s2mb-items", "chem-s2mc-items", "micro-p1a-items", "micro-p1b-items", "micro-p2f-items", "micro-p2a-items", "micro-p2b-items", "micro-p2c-items", "micro-p2d-items", ...csaItemNames(), ...elItemNames(), ...ltItemNames(), ...bioItemNames(), ...macroItemNames(), ...psychItemNames(), ...ushItemNames(), ...whItemNames(), ...auditWuelItemNames(), ...suppItemNames(), ...expandItemNames()];
