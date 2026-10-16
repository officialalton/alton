import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// 회귀: 로그아웃은 서버 액션(<form action={logout}>)이 아니라 POST /logout 이어야 한다
// (서버 액션은 현재 화면을 세션 없이 재렌더링하며 에러 바운더리를 띄웠다).
const FILES = [
  "admin/AdminShell.tsx", "teacher/TeacherShell.tsx", "parent/ParentShell.tsx", "student/StudentShell.tsx",
  "consultant/ConsultantShell.tsx", "account-pending/page.tsx", "account-suspended/page.tsx",
  "consent-pending/page.tsx", "complete-profile/page.tsx",
];
describe("logout forms", () => {
  it.each(FILES)("%s posts to /logout, not a server action", (f) => {
    const src = readFileSync(`app/${f}`, "utf8");
    expect(src).toContain('<form action="/logout" method="post"');
    expect(src).not.toMatch(/action=\{logout\}/);
  });
});
