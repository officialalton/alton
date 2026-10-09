import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { FEATURE_KEYS, TUTORING_FEATURE_KEYS } from "./feature-access-keys";
import { FEATURE_NAV_TAB, GUARDED_ACTION_FILES } from "./feature-access-guards";

// 2026-10-05 무료 회원 S2 — 검증 항목 9.1-7 "메뉴·서버·DB 근거 일치" 스냅샷.
const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf-8");

/** export async function 이름과 본문(다음 export 또는 파일 끝까지)을 자른다. */
function exportedFunctions(src: string): { name: string; body: string }[] {
  const re = /export async function (\w+)/g;
  const marks: { name: string; start: number }[] = [];
  for (const m of src.matchAll(re)) marks.push({ name: m[1], start: m.index ?? 0 });
  return marks.map((m, i) => ({ name: m.name, body: src.slice(m.start, marks[i + 1]?.start ?? src.length) }));
}

/** 파일 내부(비export) 헬퍼 이름 → 본문. */
function localHelpers(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/(?<!export )(?:async )?function (\w+)\s*\(/g)) {
    const start = m.index ?? 0;
    const next = src.slice(start + 1).search(/\n(?:export |async function |function )/);
    out.set(m[1], src.slice(start, next === -1 ? src.length : start + 1 + next));
  }
  return out;
}

describe("기능 키 ↔ 탭 ↔ 서버 가드 표", () => {
  it("FEATURE_NAV_TAB 은 StudentShell.NAV_FEATURE 와 같다(메뉴 숨김과 서버 가드가 같은 키)", () => {
    const shell = read("app/student/StudentShell.tsx");
    const block = shell.slice(shell.indexOf("const NAV_FEATURE"), shell.indexOf("};", shell.indexOf("const NAV_FEATURE")));
    const fromShell: Record<string, string> = {};
    for (const m of block.matchAll(/"?([\w-]+)"?:\s*"(\w+)"/g)) fromShell[m[2]] = m[1];
    const fromTable = Object.fromEntries(Object.entries(FEATURE_NAV_TAB).filter(([, tab]) => tab !== null));
    expect(fromTable).toEqual(fromShell);
    for (const key of Object.keys(FEATURE_NAV_TAB)) expect(FEATURE_KEYS).toContain(key);
    expect(Object.keys(FEATURE_NAV_TAB).sort()).toEqual([...FEATURE_KEYS].sort());
  });

  it("app/student/*-actions.ts 는 전부 표에 있다(새 액션 파일은 표에 등록해야 한다)", () => {
    const files = readdirSync(path.join(ROOT, "app/student"))
      .filter((f) => f.endsWith("-actions.ts") && !f.includes(".test."))
      .map((f) => `app/student/${f}`)
      .sort();
    expect(files).toEqual(GUARDED_ACTION_FILES.map((g) => g.file).filter((f) => f.startsWith("app/student/")).sort());
  });

  for (const entry of GUARDED_ACTION_FILES) {
    it(`${entry.file}: export된 async 함수마다 requireStudentFeature("${entry.key}") 를 거친다`, () => {
      const src = read(entry.file);
      expect(src.includes("requireUser(")).toBe(false);
      const helpers = localHelpers(src);
      const fns = exportedFunctions(src);
      expect(fns.length).toBeGreaterThan(0);
      for (const fn of fns) {
        const key = entry.overrides?.[fn.name] ?? entry.key;
        const direct = fn.body.includes(`requireStudentFeature("${key}")`);
        const viaHelper = [...helpers.entries()].some(
          ([name, body]) => fn.body.includes(`${name}(`) && body.includes(`requireStudentFeature("${key}")`),
        );
        expect(direct || viaHelper, `${entry.file}#${fn.name} 에 requireStudentFeature("${key}") 가드가 없다`).toBe(true);
      }
    });
  }

  it("과외 키는 전부 적어도 하나의 가드된 액션 파일 또는 탭을 가진다", () => {
    for (const key of TUTORING_FEATURE_KEYS) {
      const guarded = GUARDED_ACTION_FILES.some((g) => g.key === key || Object.values(g.overrides ?? {}).includes(key));
      // session 은 관계 기반 RLS 전용(브리프 §2.1) — 가드 대상 없음.
      if (key === "session") continue;
      expect(guarded || FEATURE_NAV_TAB[key] !== null, `${key}`).toBe(true);
    }
  });
});
