// HiGHS(scipy) 정수계획 호출 래퍼(오프라인 배정 전용). lib/ap-exam/ilp.ts 의 solveMip 와 같은 문제 형식을 받아 같은 모양의 결과를 돌려준다.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Problem } from "../../lib/ap-exam/ilp";
import { AP_PYTHON } from "./py";

export type HighsResult = { status: "optimal" | "infeasible" | "unbounded" | "limit"; obj: number; nodes: number; x: number[] };
export function solveMipHighs(p: Problem, o: { timeMs: number; log?: (s: string) => void }): HighsResult {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ilp-"));
  try {
    const f = path.join(dir, "p.json");
    writeFileSync(f, JSON.stringify({ n: p.n, obj: p.obj, cons: p.cons, integer: p.integer, binary: p.binary ?? [], timeMs: o.timeMs }));
    const r = spawnSync(AP_PYTHON, ["-I", path.resolve(__dirname, "ilp_highs.py"), f], { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024, timeout: o.timeMs + 60000 });
    if (r.status !== 0) throw new Error(`HiGHS 풀이 실패(status ${r.status}, signal ${r.signal ?? "-"}${r.error ? `, ${r.error.message}` : ""}): ${(r.stderr ?? "").slice(-300)}`);
    const out = JSON.parse(r.stdout) as { status: HighsResult["status"]; obj: number | null; x: number[]; message: string };
    o.log?.(`HiGHS: ${out.status} ${out.message}`);
    return { status: out.status, obj: out.obj ?? Infinity, nodes: 0, x: out.x };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
