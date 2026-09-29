import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 2026-09-29(QA 포털 점검) — 375px 에서 학생·학부모 과제 탭/수강 과목 탭이 가로로 넘쳤다.
// 셸 본문 컬럼(flex-1)이 min-w-0 이 없어 안쪽 nowrap 탭 줄의 최소 너비(~800px)를 따라갔기 때문이다.
// 실제 레이아웃은 jsdom 으로 잴 수 없어 클래스 계약만 고정한다(실측은 QA 스윕 스크립트).
describe.each(["student/StudentShell.tsx", "parent/ParentShell.tsx", "teacher/TeacherShell.tsx"])("%s", (file) => {
  it("본문 컬럼이 min-w-0 을 가진다(모바일 가로 넘침 방지)", () => {
    const src = readFileSync(join(process.cwd(), "app", file), "utf8");
    expect(src).toMatch(/flex-1 min-w-0 flex flex-col pb-16 md:pb-0/);
  });
});
