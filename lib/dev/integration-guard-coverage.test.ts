import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import main from "../../vitest.config";
import uni from "../../vitest.integration.config";

// 모든 *.integration.test.ts 가 (a) unit 프로젝트에서 제외되고 (b) 가드(globalSetup)가 달린 프로젝트/설정 중 하나에서만 실행되는지 증명한다.
const ROOT = path.resolve(__dirname, "../..");
const SKIP = new Set(["node_modules", ".next", ".git", ".claude", "e2e"]);
function walk(d: string, out: string[] = []) { for (const n of readdirSync(d)) { if (SKIP.has(n)) continue; const f = path.join(d, n); const st = statSync(f); if (st.isDirectory()) walk(f, out); else if (/\.integration\.test\.[tj]sx?$/.test(n)) out.push(path.relative(ROOT, f)); } return out; }
const files = walk(ROOT);
type Proj = { test: { name?: string; include?: string[]; exclude?: string[]; globalSetup?: string[] } };
const projects = ((main as unknown as { test: { projects: Proj[] } }).test.projects);
const byName = (n: string) => projects.find((p) => p.test.name === n)!;
const rx = (g: string) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0001").replace(/\*\*/g, "\u0002").replace(/\*/g, "[^/]*").replace(/\u0001/g, "(.*/)?").replace(/\u0002/g, ".*") + "$");
const match = (gs: string[] | undefined, f: string) => (gs ?? []).some((g) => rx(g).test(f));

describe("통합 테스트 가드 적용 범위", () => {
  const unit = byName("unit"), integ = byName("integration");
  const uniCfg = (uni as unknown as { test: { include: string[]; globalSetup?: string[] } }).test;
  it("통합 테스트 파일이 존재하고 확장자는 .ts 뿐", () => { expect(files.length).toBeGreaterThan(100); expect(files.every((f) => f.endsWith(".ts"))).toBe(true); });
  it("모든 통합 테스트는 unit 에서 제외된다(가드 없는 경로로 실행되지 않음)", () => { for (const f of files) expect(match(unit.test.exclude, f), f).toBe(true); });
  it("모든 통합 테스트는 가드 달린 integration 프로젝트 또는 universities 설정에서 실행된다", () => {
    for (const f of files) {
      const inMain = match(integ.test.include, f) && !match(integ.test.exclude, f);
      const inUni = match(uniCfg.include, f);
      expect(inMain || inUni, f).toBe(true);
      if (inMain) expect(integ.test.globalSetup).toContain("./vitest.integration-guard.ts");
      if (inUni) expect(uniCfg.globalSetup).toContain("./vitest.integration-guard.ts");
    }
  });
  it("메인 설정에서 universities 통합 테스트는 실행되지 않는다(가드 없는 이중 경로 없음)", () => { expect(files.filter((f) => f.startsWith("lib/universities/")).every((f) => !(match(integ.test.include, f) && !match(integ.test.exclude, f)))).toBe(true); });
});
