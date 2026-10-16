import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// 회귀 방지: 서버 컴포넌트(app/**/page.tsx 등 "use client" 가 없는 파일)가 "use client" 컴포넌트에 화살표 함수·function 표현식을 prop 으로 넘기면
// 런타임에 "Functions cannot be passed directly to Client Components" 로 죽는다(채점 완료 결과 페이지 사고, 2026-10-09). 직렬화 가능한 값(문자열 등)만 넘겨야 한다.
export function findFunctionPropsToClient(src: string, isClient: (spec: string) => boolean): string[] {
  const imports = new Map<string, string>();
  for (const m of src.matchAll(/import\s+(?:(\w+)\s*(?:,\s*\{[^}]*\})?|\{([^}]*)\})\s+from\s+["']([^"']+)["']/g)) {
    if (m[1]) imports.set(m[1], m[3]);
    for (const n of (m[2] ?? "").split(",")) { const nm = n.trim().split(/\s+as\s+/).pop(); if (nm) imports.set(nm, m[3]); }
  }
  const bad: string[] = [];
  for (const [name, spec] of imports) {
    if (!/^[A-Z]/.test(name) || !isClient(spec)) continue;
    let from = 0;
    for (;;) {
      const i = src.indexOf(`<${name}`, from); if (i < 0) break;
      from = i + 1;
      const next = src[i + name.length + 1]; if (next && /[\w]/.test(next)) continue;
      let depth = 0, j = i + name.length + 1;
      for (; j < src.length; j++) { const c = src[j]; if (c === "{") depth++; else if (c === "}") depth--; else if (c === ">" && depth === 0 && src[j - 1] !== "=") break; }
      const tag = src.slice(i, j);
      for (const m of tag.matchAll(/(\w+)=\{\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|\w+\s*=>)/g)) bad.push(`<${name} ${m[1]}=…> (함수 prop)`);
    }
  }
  return bad;
}

const ROOT = process.cwd();
function resolveSpec(file: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(file), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx")]) if (existsSync(c) && statSync(c).isFile()) return c;
  return null;
}
const isClientFile = (f: string | null) => !!f && /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(readFileSync(f, "utf-8").slice(0, 600));
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) { const p = path.join(dir, e); if (e === "node_modules" || e.startsWith(".")) continue; if (statSync(p).isDirectory()) walk(p, out); else if (/(?:page|layout)\.tsx$/.test(e)) out.push(p); }
  return out;
}

describe("서버 → 클라이언트 컴포넌트 prop 직렬화", () => {
  it("탐지기 자체: 화살표 함수 prop 을 잡고 문자열 prop 은 통과", () => {
    const src = 'import Foo from "./Foo";\nexport default function P() { return (<div><Foo a="x" href={`/p/${id}`} /><Foo go={(id) => `/s/${id}`} /></div>); }';
    expect(findFunctionPropsToClient(src, () => true)).toEqual(["<Foo go=…> (함수 prop)"]);
    expect(findFunctionPropsToClient('import Foo from "./Foo";\nconst x = <Foo a="x" b={1} />;', () => true)).toEqual([]);
    expect(findFunctionPropsToClient('import Foo from "./Foo";\nconst x = <Foo go={(id) => id} />;', () => false)).toEqual([]); // 서버 컴포넌트에 넘기는 건 허용
  });
  it("app 의 서버 페이지·레이아웃은 클라이언트 컴포넌트에 함수 prop 을 넘기지 않는다", () => {
    const offenders: string[] = [];
    for (const file of walk(path.join(ROOT, "app"))) {
      if (isClientFile(file)) continue;
      const src = readFileSync(file, "utf-8");
      const bad = findFunctionPropsToClient(src, (spec) => isClientFile(resolveSpec(file, spec)));
      for (const b of bad) offenders.push(`${path.relative(ROOT, file)}: ${b}`);
    }
    expect(offenders).toEqual([]);
  });
});
