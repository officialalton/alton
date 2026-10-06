import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewerTimezoneProvider } from "@/app/components/ViewerTimezoneProvider";
import CreditsTab from "@/app/student/CreditsTab";
import ConsentTab from "@/app/parent/ConsentTab";
import SessionShell from "@/app/session/[id]/SessionShell";

// 서버(TZ=UTC)에서 만든 HTML을, 뷰어 저장 시간대와도 서버 TZ와도 다른 브라우저(Asia/Seoul)에서 hydrate해도
// 불일치(#418)가 없어야 한다. 뷰어 시간대는 서버·클라이언트가 같은 prop으로 받기 때문이다.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/student/credits-actions", () => ({ requestParentPayment: vi.fn() }));
vi.mock("@/app/parent/consent-actions", () => ({ consentForChild: vi.fn() }));
vi.mock("@/app/teacher/lesson-schedule-actions", () => ({ finalizeMyLessonSession: vi.fn() }));
vi.mock("@/app/session/[id]/actions", () => ({ submitMcAttempt: vi.fn(), submitEssayAttempt: vi.fn(), submitMathAttempt: vi.fn() }));
vi.mock("@/app/session/[id]/canvas-actions", () => ({ saveCanvasStrokes: vi.fn() }));
vi.mock("@/app/session/[id]/vocab-actions", () => ({ addVocabWord: vi.fn(), removeVocabWord: vi.fn() }));
vi.mock("@/app/session/[id]/homework-actions", () => ({ saveHomeworkAnswer: vi.fn(), addHomeworkItem: vi.fn() }));
vi.mock("@/app/session/[id]/scratchpad-actions", () => ({ addDocLink: vi.fn(), removeDocLink: vi.fn(), saveWhiteboardStrokes: vi.fn() }));
vi.mock("@/app/session/[id]/problemlog-actions", () => ({
  toggleSaveAttempt: vi.fn(),
  retryMcAttempt: vi.fn(),
  retryEssayAttempt: vi.fn(),
  retryMathAttempt: vi.fn(),
  saveTeacherPick: vi.fn(),
  removeTeacherPick: vi.fn(),
}));
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function on() {
        return this;
      },
      subscribe: function subscribe() {
        return this;
      },
      send: vi.fn(),
    }),
    removeChannel: vi.fn(),
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const INSTANT = "2026-09-29T15:04:00.000Z"; // 서울 9/30 00:04 · LA 9/29 08:04
const LA = "America/Los_Angeles";
const original = process.env.TZ;
afterEach(() => {
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;
});

async function serverThenHydrate(el: ReactElement) {
  process.env.TZ = "UTC";
  const html = renderToString(el);
  process.env.TZ = "Asia/Seoul";
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const errors: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...a) => {
    errors.push(a.map(String).join(" "));
  });
  await act(async () => {
    hydrateRoot(container, el, { onRecoverableError: (e) => errors.push(String(e)) });
  });
  spy.mockRestore();
  return { html, text: container.textContent ?? "", errors };
}

describe("뷰어 시간대 hydration 일관성 (서버 UTC / 브라우저 서울 / 뷰어 LA)", () => {
  it("학생 화면", async () => {
    const data = { balance: 0, guardianName: null, regularRemaining: 3, regularNearestExpiry: INSTANT, trialEntitlement: null };
    const r = await serverThenHydrate(
      <ViewerTimezoneProvider timezone={LA}>
        <CreditsTab data={data} />
      </ViewerTimezoneProvider>
    );
    expect(r.html).toMatch(/Sep(tember)? 29, 2026/);
    expect(r.errors).toEqual([]);
  });

  it("학부모 화면", async () => {
    const child = {
      studentId: "c1",
      name: "지훈",
      isUnder13: true,
      dobKnown: true,
      hasValidConsent: true,
      latestConsent: { id: "x", policyVersionTitle: "정책 v1", consentedAt: INSTANT, revokedAt: null },
    };
    const r = await serverThenHydrate(
      <ViewerTimezoneProvider timezone={LA}>
        <ConsentTab {...{ children: [child], activePolicy: null }} />
      </ViewerTimezoneProvider>
    );
    expect(r.html).toContain("2026. 9. 29.");
    expect(r.errors).toEqual([]);
  });

  it("세션뷰 셸: 뷰어(LA)의 시각으로 예정 시각을 보여주고 불일치가 없다", async () => {
    const r = await serverThenHydrate(
      <ViewerTimezoneProvider timezone={LA}>
        <SessionShell
          sessionId="session-1"
          studentId="student-1"
          material={null}
          sessionVocab={{ myWords: [], books: [], quizzes: [], folders: [] }}
          homeworkItems={[]}
          unitTitle="이차방정식"
          subjectName="SAT Math"
          studentName="지훈"
          sessionNumber={7}
          backHref="/student"
          sessionSource="legacy"
          currentUserId="user-1"
          viewerRole="student"
          initialState="prep"
          status="upcoming"
          scheduledAt={INSTANT}
          durationMinutes={30}
        />
      </ViewerTimezoneProvider>
    );
    expect(r.html).toMatch(/Sep(tember)? 29/);
    expect(r.html).not.toMatch(/Sep(tember)? 30/);
    expect(r.errors).toEqual([]);
  });
});
