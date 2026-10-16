import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminHomeDashboard from "./AdminHomeDashboard";
import type { AdminDashboardData } from "./dashboard-data";

// 2026-09-29 — /admin 로드마다 React #418(hydration 텍스트 불일치). 서버(UTC)와 브라우저
// (사용자 로컬)가 같은 시각을 다르게 포맷한 것이 원인. 프로세스 TZ를 바꿔가며 렌더해 동일한지 확인.
const data: AdminDashboardData = {
  adminName: "관리자",
  pendingConsults: [],
  upcomingConsults: [{ id: "u1", personName: "김민지", scheduledAt: "2026-09-29T15:04:00.000Z" }],
  pendingStudents: [],
  pendingTeachers: [],
  qcWarnings: [],
};
const original = process.env.TZ;
afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

describe("AdminHomeDashboard hydration", () => {
  it("서버(UTC)와 클라이언트(LA/서울) 시간대에서 같은 HTML을 렌더한다", () => {
    const html = ["UTC", "America/Los_Angeles", "Asia/Seoul"].map((tz) => {
      process.env.TZ = tz;
      return renderToString(<AdminHomeDashboard data={data} onNavigate={vi.fn()} />);
    });
    expect(html[0]).toContain("9월 30일 오전 12:04");
    expect(html[1]).toBe(html[0]);
    expect(html[2]).toBe(html[0]);
  });
});
