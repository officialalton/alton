import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 2026-10-12 오너 결정: 로그아웃은 현재 기기만. 인자 없는 signOut() 은 기본 scope=global 이라 모든 기기·창의 세션을 폐기한다.
describe("signOut scope", () => {
  const files = ["app/login/actions.ts", "lib/auth.ts", "app/signup/student/actions.ts", "app/signup/student/page.tsx", "app/auth/admin-google-callback/route.ts"];
  it.each(files)("%s 는 signOut 을 local scope 로만 호출한다", (f) => {
    const src = readFileSync(f, "utf-8");
    const calls = src.match(/auth\.signOut\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c).toContain('scope: "local"');
  });
});
