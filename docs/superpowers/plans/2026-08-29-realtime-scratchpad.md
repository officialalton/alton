# 실시간 공동 필기 문서 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세션뷰 "연습장 > Docs" 탭의 외부 Google Docs 링크 기능을 완전히 제거하고, 같은 자리에 Supabase Realtime 기반 실시간 공동 텍스트 문서를 넣는다.

**Architecture:** 이미 있는 화이트보드(`WhiteboardCanvas.tsx`)와 동일한 패턴 — Supabase Realtime `broadcast` 채널로 즉시 전파하고, 타이핑이 멈추면 디바운스 후 `sessions` 테이블에 저장. 재접속/사후 열람은 그 저장된 값을 초기값으로 읽어오는 것만으로 해결된다.

**Tech Stack:** Next.js Server Actions, Supabase(Postgres + Realtime broadcast), React(client component), Vitest.

## Global Constraints

- 서식(볼드/이탤릭 등) 없음 — 순수 텍스트(`<textarea>`)만 지원한다.
- 글자 단위 병합(OT/CRDT)은 구현하지 않는다 — 전체 텍스트를 통째로 주고받는 "마지막에 반영된 게 이긴다" 방식. 대신 로컬에서 타이핑 중(마지막 입력 후 1.2초 이내)일 때는 원격에서 온 텍스트를 즉시 반영하지 않고 보류했다가 타이핑이 멈추면 적용한다 — `docs/superpowers/specs/2026-08-29-realtime-scratchpad-design.md` 참고.
- 기존 `session_doc_links` 관련 코드(`addDocLink`/`removeDocLink`/`loadDocLinks`, `DocLink` 타입)는 전부 삭제한다. 테이블 자체는 드롭하지 않는다(스코프 밖).
- 권한: 기존 "Docs" 탭과 동일 — 학생/선생님은 쓰기 가능(`viewerRole === "student" || "teacher"`), 그 외(학부모/관리자)는 읽기 전용.
- 완료 후: 관련 테스트 전체 통과 + `npx tsc --noEmit` 클린 확인 → `docs/tickets.md`에 신규 항목 추가/체크 → git commit.

---

## Task 1: 저장 계층 — 마이그레이션 + `scratchpad-actions.ts`/`scratchpad-data.ts`

**Files:**
- Create: `supabase/migrations/20260829070000_sessions_scratchpad_text.sql`
- Modify: `app/session/[id]/scratchpad-actions.ts`
- Modify: `app/session/[id]/scratchpad-data.ts`
- Test: `app/session/[id]/scratchpad-actions.test.ts` (신규)

**Interfaces:**
- Produces: `saveScratchpadText(sessionId: string, text: string): Promise<void>` — Task 2의 `RealtimeScratchpad.tsx`가 사용.
- `scratchpad-data.ts`에서 `DocLink` 타입과 `loadDocLinks` 함수를 제거한다(더 이상 아무도 쓰지 않음). `parseWhiteboardStrokes`는 그대로 유지.

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/20260829070000_sessions_scratchpad_text.sql`:

```sql
-- 세션뷰 "연습장" 실시간 공동 문서 — 기존 Google Docs 링크 기능(session_doc_links)을
-- 대체. whiteboard_strokes와 같은 자리에 텍스트 하나만 저장(세션당 문서 1개).
alter table sessions add column scratchpad_text text;
```

로컬 DB에 적용:

```bash
npx supabase db reset
```

Expected: `Applying migration 20260829070000_sessions_scratchpad_text.sql...` 출력 후 정상 종료.

- [ ] **Step 2: `saveScratchpadText`의 실패하는 테스트 작성**

`app/session/[id]/scratchpad-actions.test.ts` (신규 파일 — 화이트보드 저장 함수와 같은 파일에 있는 `saveWhiteboardStrokes`는 건드리지 않는다, 그대로 둔다):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

describe("saveScratchpadText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateEqMock.mockResolvedValue({ error: null });
  });

  it("sessions.scratchpad_text를 해당 세션 id로 갱신한다", async () => {
    const { saveScratchpadText } = await import("./scratchpad-actions");
    await saveScratchpadText("s1", "안녕하세요");

    expect(fromMock).toHaveBeenCalledWith("sessions");
    expect(updateMock).toHaveBeenCalledWith({ scratchpad_text: "안녕하세요" });
    expect(updateEqMock).toHaveBeenCalledWith("id", "s1");
  });

  it("저장이 실패하면 에러를 던진다", async () => {
    updateEqMock.mockResolvedValue({ error: { message: "권한 없음" } });
    const { saveScratchpadText } = await import("./scratchpad-actions");

    await expect(saveScratchpadText("s1", "안녕하세요")).rejects.toThrow("권한 없음");
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run app/session/\[id\]/scratchpad-actions.test.ts`
Expected: FAIL — `saveScratchpadText is not a function` (또는 export 없음 에러)

- [ ] **Step 4: `scratchpad-actions.ts` 수정 — `addDocLink`/`removeDocLink` 삭제, `saveScratchpadText` 추가**

`app/session/[id]/scratchpad-actions.ts` 전체를 다음으로 교체(맨 아래 `saveWhiteboardStrokes`는 그대로 유지):

```ts
"use server";

import { createClient } from "@/utils/supabase/server";
import type { CanvasStroke } from "./material-data";

export async function saveScratchpadText(sessionId: string, text: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ scratchpad_text: text })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}

export async function saveWhiteboardStrokes(
  sessionId: string,
  strokes: CanvasStroke[]
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ whiteboard_strokes: strokes })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}
```

(주의: 기존 파일에 있던 `import type { DocLink } from "./scratchpad-data";`와 `addDocLink`/`removeDocLink` 함수는 완전히 제거한다.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run app/session/\[id\]/scratchpad-actions.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: `scratchpad-data.ts`에서 `DocLink`/`loadDocLinks` 제거**

`app/session/[id]/scratchpad-data.ts` 전체를 다음으로 교체:

```ts
import type { CanvasStroke } from "./material-data";

export function parseWhiteboardStrokes(raw: unknown): CanvasStroke[] {
  return Array.isArray(raw) ? (raw as CanvasStroke[]) : [];
}
```

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/20260829070000_sessions_scratchpad_text.sql app/session/\[id\]/scratchpad-actions.ts app/session/\[id\]/scratchpad-actions.test.ts app/session/\[id\]/scratchpad-data.ts
git commit -m "feat(session): 실시간 공동 문서 저장 계층 추가, Docs 링크 저장 계층 제거"
```

---

## Task 2: `RealtimeScratchpad.tsx` 컴포넌트

**Files:**
- Create: `app/session/[id]/RealtimeScratchpad.tsx`
- Test: `app/session/[id]/RealtimeScratchpad.test.tsx`

**Interfaces:**
- Consumes: `saveScratchpadText(sessionId, text): Promise<void>` (Task 1)
- Produces: `RealtimeScratchpad` 컴포넌트, props `{ sessionId: string; initialText: string; canEdit: boolean }` — Task 3의 `ScratchpadTab.tsx`가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`app/session/[id]/RealtimeScratchpad.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RealtimeScratchpad from "./RealtimeScratchpad";
import { saveScratchpadText } from "./scratchpad-actions";

vi.mock("./scratchpad-actions", () => ({
  saveScratchpadText: vi.fn().mockResolvedValue(undefined),
}));

let broadcastHandler: ((msg: { payload: unknown }) => void) | null = null;
const sendMock = vi.fn();
const removeChannelMock = vi.fn();

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: (_type: string, _filter: unknown, handler: (msg: { payload: unknown }) => void) => {
        broadcastHandler = handler;
        return {
          subscribe: function subscribe() {
            return this;
          },
          send: sendMock,
        };
      },
    }),
    removeChannel: removeChannelMock,
  }),
}));

describe("RealtimeScratchpad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    broadcastHandler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("초기 텍스트를 textarea에 표시한다", () => {
    render(<RealtimeScratchpad sessionId="s1" initialText="기존 내용" canEdit={true} />);
    expect(screen.getByDisplayValue("기존 내용")).toBeInTheDocument();
  });

  it("canEdit이 false면 textarea가 읽기 전용이다", () => {
    render(<RealtimeScratchpad sessionId="s1" initialText="기존 내용" canEdit={false} />);
    expect(screen.getByDisplayValue("기존 내용")).toHaveAttribute("readonly");
  });

  it("타이핑하면 브로드캐스트로 즉시 전파하고, 멈추면 디바운스 후 저장한다", async () => {
    render(<RealtimeScratchpad sessionId="s1" initialText="" canEdit={true} />);
    const textarea = screen.getByPlaceholderText("여기에 함께 기록하세요...");

    fireEvent.change(textarea, { target: { value: "안녕" } });

    expect(sendMock).toHaveBeenCalledWith({
      type: "broadcast",
      event: "text",
      payload: { text: "안녕" },
    });
    expect(saveScratchpadText).not.toHaveBeenCalled();

    vi.advanceTimersByTime(600);
    await waitFor(() => expect(saveScratchpadText).toHaveBeenCalledWith("s1", "안녕"));
  });

  it("타이핑 중이 아닐 때 브로드캐스트를 받으면 즉시 반영한다", () => {
    render(<RealtimeScratchpad sessionId="s1" initialText="" canEdit={true} />);
    expect(broadcastHandler).not.toBeNull();

    broadcastHandler!({ payload: { text: "상대방이 쓴 내용" } });

    expect(screen.getByDisplayValue("상대방이 쓴 내용")).toBeInTheDocument();
  });

  it("타이핑 중에 브로드캐스트를 받으면 즉시 덮어쓰지 않고, 타이핑이 멈춘 뒤 반영한다", () => {
    render(<RealtimeScratchpad sessionId="s1" initialText="" canEdit={true} />);
    const textarea = screen.getByPlaceholderText("여기에 함께 기록하세요...");

    fireEvent.change(textarea, { target: { value: "내가 쓰는 중" } });
    broadcastHandler!({ payload: { text: "상대방이 그 사이에 보낸 것" } });

    // 아직 타이핑 중(1.2초 이내)이라 로컬 입력이 유지돼야 한다.
    expect(screen.getByDisplayValue("내가 쓰는 중")).toBeInTheDocument();

    vi.advanceTimersByTime(1200);

    expect(screen.getByDisplayValue("상대방이 그 사이에 보낸 것")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/session/\[id\]/RealtimeScratchpad.test.tsx`
Expected: FAIL — `Cannot find module './RealtimeScratchpad'`

- [ ] **Step 3: 구현**

`app/session/[id]/RealtimeScratchpad.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { saveScratchpadText } from "./scratchpad-actions";

const TYPING_HOLD_MS = 1200;
const SAVE_DEBOUNCE_MS = 600;

export default function RealtimeScratchpad({
  sessionId,
  initialText,
  canEdit,
}: {
  sessionId: string;
  initialText: string;
  canEdit: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const pendingRemoteTextRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`session-scratchpad:${sessionId}`);
    channel
      .on("broadcast", { event: "text" }, ({ payload }) => {
        const nextText = (payload as { text: string }).text;
        if (isTypingRef.current) {
          pendingRemoteTextRef.current = nextText;
        } else {
          setText(nextText);
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  function scheduleSave(value: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveScratchpadText(sessionId, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, SAVE_DEBOUNCE_MS);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);

    isTypingRef.current = true;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (pendingRemoteTextRef.current !== null) {
        setText(pendingRemoteTextRef.current);
        pendingRemoteTextRef.current = null;
      }
    }, TYPING_HOLD_MS);

    channelRef.current?.send({
      type: "broadcast",
      event: "text",
      payload: { text: value },
    });
    scheduleSave(value);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[14px] font-bold text-ink">📝 함께 쓰는 문서</h2>
        {saved && (
          <span className="text-[11px] font-bold text-green">✓ 저장됨</span>
        )}
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        readOnly={!canEdit}
        placeholder={
          canEdit ? "여기에 함께 기록하세요..." : "아직 작성된 내용이 없습니다."
        }
        className="w-full min-h-[420px] p-4 border-[1.5px] border-grey-200 rounded-xl text-[13.5px] leading-[1.7] focus:outline-none focus:border-ink resize-y"
      />
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/session/\[id\]/RealtimeScratchpad.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/session/\[id\]/RealtimeScratchpad.tsx app/session/\[id\]/RealtimeScratchpad.test.tsx
git commit -m "feat(session): 실시간 공동 문서 컴포넌트(RealtimeScratchpad) 추가"
```

---

## Task 3: `ScratchpadTab.tsx`에서 Docs 서브탭을 `RealtimeScratchpad`로 교체

**Files:**
- Modify: `app/session/[id]/ScratchpadTab.tsx`
- Modify: `app/session/[id]/ScratchpadTab.test.tsx`

**Interfaces:**
- Consumes: `RealtimeScratchpad` (Task 2)
- Produces: `ScratchpadTab` props가 `initialDocLinks: DocLink[]` → `initialScratchpadText: string`로 변경됨 — Task 4의 `SessionShell.tsx`가 이 새 prop 이름을 사용해야 한다.

- [ ] **Step 1: `ScratchpadTab.test.tsx`를 새 동작에 맞게 교체**

`app/session/[id]/ScratchpadTab.test.tsx` 전체를 다음으로 교체:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ScratchpadTab from "./ScratchpadTab";

vi.mock("./scratchpad-actions", () => ({
  saveScratchpadText: vi.fn().mockResolvedValue(undefined),
  saveWhiteboardStrokes: vi.fn(),
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

describe("ScratchpadTab", () => {
  it("기본 서브탭은 Docs이고, 실시간 문서 textarea를 보여준다", () => {
    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="student"
        initialScratchpadText="이전에 쓴 내용"
        initialWhiteboardStrokes={[]}
      />
    );
    expect(screen.getByDisplayValue("이전에 쓴 내용")).toBeInTheDocument();
  });

  it("학부모(읽기 전용 역할)에게는 textarea가 readonly로 보인다", () => {
    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="parent"
        initialScratchpadText="이전에 쓴 내용"
        initialWhiteboardStrokes={[]}
      />
    );
    expect(screen.getByDisplayValue("이전에 쓴 내용")).toHaveAttribute("readonly");
  });

  it("학생/선생님은 textarea를 편집할 수 있다(readonly 아님)", () => {
    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="teacher"
        initialScratchpadText=""
        initialWhiteboardStrokes={[]}
      />
    );
    expect(
      screen.getByPlaceholderText("여기에 함께 기록하세요...")
    ).not.toHaveAttribute("readonly");
  });

  it("화이트보드 서브탭으로 전환하면 스크롤 안내 문구가 보인다", () => {
    render(
      <ScratchpadTab
        sessionId="s1"
        viewerRole="teacher"
        initialScratchpadText=""
        initialWhiteboardStrokes={[]}
      />
    );
    fireEvent.click(screen.getByText("화이트보드"));
    expect(
      screen.getByText("아래로 계속 스크롤하며 필기할 수 있습니다.")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/session/\[id\]/ScratchpadTab.test.tsx`
Expected: FAIL — `initialScratchpadText`가 없는 타입 에러 또는 기존 `DocsPanel`이 그대로 렌더링돼 텍스트를 못 찾음

- [ ] **Step 3: `ScratchpadTab.tsx` 수정**

`app/session/[id]/ScratchpadTab.tsx` 전체를 다음으로 교체:

```tsx
"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import type { CanvasStroke } from "./material-data";
import WhiteboardCanvas from "./WhiteboardCanvas";
import RealtimeScratchpad from "./RealtimeScratchpad";

const SUBTABS = [
  { id: "docs", label: "Docs" },
  { id: "whiteboard", label: "화이트보드" },
] as const;

type SubtabId = (typeof SUBTABS)[number]["id"];

export default function ScratchpadTab({
  sessionId,
  viewerRole,
  initialScratchpadText,
  initialWhiteboardStrokes,
}: {
  sessionId: string;
  viewerRole: SessionViewViewer;
  initialScratchpadText: string;
  initialWhiteboardStrokes: CanvasStroke[];
}) {
  const [subtab, setSubtab] = useState<SubtabId>("docs");
  const canEdit = viewerRole === "student" || viewerRole === "teacher";

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">연습장</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        수업 중 함께 기록하는 공간입니다.
      </p>

      <div className="flex gap-4 mb-5 border-b border-grey-200">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            className={
              "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
              (subtab === t.id
                ? "text-ink border-ink"
                : "text-grey-500 border-transparent")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "docs" ? (
        <RealtimeScratchpad
          sessionId={sessionId}
          initialText={initialScratchpadText}
          canEdit={canEdit}
        />
      ) : (
        <WhiteboardCanvas
          sessionId={sessionId}
          initialStrokes={initialWhiteboardStrokes}
          canDraw={canEdit}
        />
      )}
    </div>
  );
}
```

(기존 `DocsPanel`/`AddDocLinkForm` 함수와 `addDocLink`/`removeDocLink`/`DocLink` import는 전부 제거한다. `isTeacher` 변수도 더 이상 안 쓰이므로 제거 — 화이트보드 `canDraw`와 문서 `canEdit`가 이제 같은 조건이라 하나로 합쳤다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/session/\[id\]/ScratchpadTab.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/session/\[id\]/ScratchpadTab.tsx app/session/\[id\]/ScratchpadTab.test.tsx
git commit -m "feat(session): ScratchpadTab의 Docs 서브탭을 실시간 공동 문서로 교체"
```

---

## Task 4: `page.tsx`/`SessionShell.tsx` 배선 + 전체 검증 + 티켓 체크

**Files:**
- Modify: `app/session/[id]/page.tsx`
- Modify: `app/session/[id]/SessionShell.tsx`
- Modify: `docs/tickets.md`

**Interfaces:**
- Consumes: `ScratchpadTab` props `initialScratchpadText: string`(Task 3)

- [ ] **Step 1: `page.tsx` 수정**

`app/session/[id]/page.tsx`의 import 줄을 수정:

```ts
import { parseWhiteboardStrokes } from "./scratchpad-data";
```

(기존 `import { loadDocLinks, parseWhiteboardStrokes } from "./scratchpad-data";`를 위처럼 바꾼다.)

`sessions` 테이블 select 문자열에 `scratchpad_text` 추가:

```ts
  const { data: session } = await supabase
    .from("sessions")
    .select(
      "id, session_number, unit_title, status, scheduled_at, duration_minutes, enrollment_id, curriculum_doc_id, whiteboard_strokes, scratchpad_text"
    )
    .eq("id", id)
    .single();
```

`docLinks` 로딩 줄을 제거하고 그 자리에 텍스트를 읽는 줄로 교체:

```ts
  const whiteboardStrokes = parseWhiteboardStrokes(session.whiteboard_strokes);
  const scratchpadText = session.scratchpad_text ?? "";
  const problemLog = await loadProblemLog(supabase, enrollment.student_id);
```

(기존 `const docLinks = await loadDocLinks(supabase, session.id);` 줄을 삭제하고 `const whiteboardStrokes = ...` 다음 줄에 `const scratchpadText = session.scratchpad_text ?? "";`를 추가한다.)

`<SessionShell ... />`에 넘기는 prop을 교체:

```tsx
      docLinks={docLinks}
      whiteboardStrokes={whiteboardStrokes}
```

위 두 줄을

```tsx
      scratchpadText={scratchpadText}
      whiteboardStrokes={whiteboardStrokes}
```

로 바꾼다(`docLinks` prop 삭제, `scratchpadText` prop 추가).

- [ ] **Step 2: `SessionShell.tsx` 수정**

import 줄에서 `DocLink` 타입 import 제거:

```ts
import ScratchpadTab from "./ScratchpadTab";
import type { CanvasStroke } from "./material-data";
```

(기존 `import ScratchpadTab from "./ScratchpadTab";` 다음 줄의 `import type { DocLink } from "./scratchpad-data";`를 삭제한다.)

컴포넌트 props 구조분해와 타입 선언에서 `docLinks` → `scratchpadText`로 교체:

```ts
  scratchpadText,
  whiteboardStrokes,
  problemLog,
}: {
  sessionId: string;
  studentId: string;
  unitTitle: string;
  subjectName: string;
  studentName: string;
  sessionNumber: number;
  viewerRole: SessionViewViewer;
  initialTab?: string;
  initialState: SessionViewState;
  status: string;
  scheduledAt: string | null;
  durationMinutes: number;
  backHref: string;
  material: MaterialData;
  vocabWords: VocabEntry[];
  homeworkItems: HomeworkItem[];
  subjectId: string;
  unitOptions: string[];
  scratchpadText: string;
  whiteboardStrokes: CanvasStroke[];
  problemLog: ProblemLogEntry[];
}) {
```

`<ScratchpadTab ... />` 호출부 교체:

```tsx
      ) : activeTab === "docs" ? (
        <ScratchpadTab
          sessionId={sessionId}
          viewerRole={viewerRole}
          initialScratchpadText={scratchpadText}
          initialWhiteboardStrokes={whiteboardStrokes}
        />
```

(기존 `initialDocLinks={docLinks}`를 `initialScratchpadText={scratchpadText}`로 바꾼다.)

- [ ] **Step 3: 전체 테스트 + 타입체크**

Run: `npx vitest run`
Expected: 전체 통과(기존 테스트 포함, 새 테스트 포함)

Run: `npx tsc --noEmit`
Expected: 에러 없음

만약 `SessionShell.test.tsx`가 `docLinks` prop을 넘기고 있다면(파일을 열어서 확인), 그 테스트 파일에서 `docLinks={[...]}` 부분을 `scratchpadText="..."`(빈 문자열 또는 임의 문자열)로 바꾸고 다시 테스트를 돌린다.

- [ ] **Step 4: `docs/tickets.md`에 신규 항목 추가**

`docs/tickets.md`에서 Phase 8(통합 테스트 및 파일럿 준비) 섹션 바로 앞, 또는 세션뷰 관련 티켓이 모여 있는 섹션에 다음 줄을 추가한다(정확한 위치는 파일을 열어 세션뷰/연습장 관련 기존 티켓 근처를 찾아 그 다음 줄에 삽입):

```
- [x] **082-realtime-scratchpad**: 연습장 실시간 공동 문서 (2026-08-29: 기존 "Docs" 서브탭의 외부 Google Docs 링크 붙여넣기 기능을 완전히 대체 — 선생님×학생이 세션뷰 안에서 직접 실시간으로 같이 타이핑하는 순수 텍스트 문서로 구현. 화이트보드(`WhiteboardCanvas.tsx`)와 동일한 패턴(Supabase Realtime broadcast 채널 + 디바운스 저장)을 재사용. `sessions.scratchpad_text` 컬럼 신설, `session_doc_links` 관련 코드(`addDocLink`/`removeDocLink`/`loadDocLinks`) 삭제(테이블 자체는 스코프 밖, 안 쓰는 채로 유지). 글자 단위 병합(OT/CRDT)은 하지 않고 전체 텍스트 통째 동기화 + "타이핑 중엔 원격 갱신을 보류했다가 멈추면 반영"하는 방식으로 커서 튀는 문제만 방지 — 완벽한 동시 편집 병합은 스코프 밖으로 명시. 유닛 테스트 신규(저장 액션, 컴포넌트의 로컬 타이핑/원격 수신/타이핑 중 보류 분기), 전체 테스트 통과, tsc 클린.)
```

- [ ] **Step 5: 커밋**

```bash
git add app/session/\[id\]/page.tsx app/session/\[id\]/SessionShell.tsx docs/tickets.md
git commit -m "feat(session): 세션뷰 배선을 실시간 공동 문서로 전환, 082 티켓 체크"
```
