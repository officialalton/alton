import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 새 코드에서 timeZone 없는 ko-KR 날짜 포맷이 다시 생기는 것을 막는다(hydration #418 원인).
// 대신 lib/format-datetime.ts의 fmtDateTime/fmtDate/fmtTime/fmtIntl/dateKey를 쓴다.
const ROOT = path.resolve(__dirname, "..");
const ALLOWLIST: Record<string, string> = {
  "lib/format-datetime.ts": "공용 포맷터 자체(timeZone을 항상 주입)",
  "app/teacher/SettlementTab.tsx": "숫자(금액) 포맷 — 날짜 아님",
  "lib/problem-figures/templates/data.ts": "숫자 포맷 — 날짜 아님",
};

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === "node_modules" || name === ".next") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("timeZone 없는 날짜 포맷 금지", () => {
  it('toLocale*String("ko-KR"…) / Intl.DateTimeFormat("ko-KR"|"en-CA"…)에 timeZone이 있어야 한다', () => {
    const offenders: string[] = [];
    for (const dir of ["app", "lib"]) {
      for (const file of walk(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, file);
        if (rel in ALLOWLIST) continue;
        const src = readFileSync(file, "utf8");
        const re = /(toLocale(?:Date|Time)?String|Intl\.DateTimeFormat)\(\s*"(?:ko-KR|en-CA|en-US)"/g;
        for (const m of src.matchAll(re)) {
          // 호출 인자 범위(첫 "})" 또는 ")" 까지)에 timeZone이 있는지 본다.
          const rest = src.slice(m.index!, m.index! + 400);
          const call = rest.slice(0, rest.search(/\}\)|"\)/) + 2 || 400);
          if (!/timeZone/.test(call)) {
            offenders.push(`${rel}:${src.slice(0, m.index).split("\n").length}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
