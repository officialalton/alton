# 정산 탭 + 선생님 셀프 온보딩 + 초대 화면 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) `/set-password`의 추천인 코드 입력을 학부모에게만 보이게 고치고, (2) 선생님 초대 시 시급을 필수로 받아 관리자 "정산" 탭에서 시급×완료 수업시간으로 정산 금액을 계산·수기 완료 처리할 수 있게 하고, (3) 선생님이 로그인 후 스스로 Calendly 링크를 등록하면 자동으로 승인(active)되도록 온보딩 흐름을 만든다.

**Architecture:** 기존 관리자 사용자 관리(`UsersTab.tsx`/`users-actions.ts`) 패턴과 세션뷰 화이트보드 저장 패턴을 그대로 재사용. 정산 계산은 순수 함수(`computePayoutAmounts`)로 분리해 cron 라우트와 관리자 수동 생성 버튼이 같은 로직을 공유한다.

**Tech Stack:** Next.js Server Actions, Supabase(Postgres, RLS), Vercel Cron, `lib/email.ts`(기존 SMTP), Vitest.

## Global Constraints

- 정산 금액 = `round(teachers.hourly_rate_krw * (기간 내 status='completed' 세션들의 duration_minutes 합계) / 60)`. `duration_minutes`는 Calendly 예약 당시 값이 고정된 것이라 실제 진행 시간과 무관하게 항상 합의된 시간 기준이 유지된다 — 별도 "실제 시간" 로직을 만들지 않는다.
- `teacher_payouts.status`는 스키마상 `pending`/`approved`/`paid` 3개 값이 있지만 이번 스코프에서는 `pending`↔`paid` 2단계만 쓴다. `approved`는 쓰지 않는다.
- 정산 승인("완료 처리") 시 선생님에게 이메일 알림을 보낸다(기존 `lib/email.ts` 재사용). 완료 취소 시에는 알림을 보내지 않는다.
- 선생님 초대 시 시급은 필수값이며, 이제부터 시급 없이 초대되는 선생님이 없어야 한다(기존에 이미 초대된 선생님은 예외 — `TeacherDetailPanel`에서 나중에 채움).
- 선생님이 홈에서 Calendly URL을 직접 제출하면 `calendly_scheduling_url`과 `status='active'`를 한 번에 갱신한다(관리자 별도 승인 불필요).
- 완료 후: 관련 테스트 전체 통과 + `npx tsc --noEmit` 클린 → `docs/tickets.md`에 082/086/추가 항목 반영 → git commit.

---

## Task 1: `/set-password` 추천인 코드를 학부모에게만 노출

**Files:**
- Modify: `app/admin/users-actions.ts:6-14`
- Modify: `app/set-password/page.tsx`
- Test: `app/set-password/page.test.tsx:1-20` (기존 파일 수정)

**Interfaces:**
- 없음(다른 태스크와 무관하게 독립적).

- [ ] **Step 1: 실패하는 테스트 추가**

`app/set-password/page.test.tsx`의 기존 `describe("SetPasswordPage", ...)` 블록 안, 첫 번째 `it` 앞에 추가(파일 상단 `import`/`mock`은 그대로 두고 이 두 테스트만 추가):

```tsx
  it("URL에 role=parent가 있으면 추천인 코드 입력을 보여준다", () => {
    Object.defineProperty(window, "location", {
      value: { hash: "", search: "?role=parent" },
      writable: true,
    });
    render(<SetPasswordPage />);
    expect(screen.getByLabelText(/추천인 코드/)).toBeInTheDocument();
  });

  it("role 파라미터가 없으면(예: 비밀번호 재설정 링크) 추천인 코드 입력을 숨긴다", () => {
    Object.defineProperty(window, "location", {
      value: { hash: "", search: "" },
      writable: true,
    });
    render(<SetPasswordPage />);
    expect(screen.queryByLabelText(/추천인 코드/)).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/set-password/page.test.tsx`
Expected: FAIL — role 파라미터와 무관하게 추천인 코드 입력이 항상 렌더링되므로 두 번째 테스트가 실패(첫 번째는 우연히 통과할 수 있음)

- [ ] **Step 3: `app/admin/users-actions.ts`의 `inviteAndCreateProfile` 수정 — parent만 role 쿼리 붙이기**

`inviteAndCreateProfile` 함수 안의 `redirectTo` 줄을 다음으로 교체:

```ts
  const redirectTo =
    params.role === "parent"
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/set-password?role=parent`
      : `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(params.email, {
    redirectTo,
  });
```

(기존의 `const { data, error } = await admin.auth.admin.inviteUserByEmail(params.email, { redirectTo: \`${process.env.NEXT_PUBLIC_SITE_URL}/set-password\`, });` 블록을 위 코드로 통째로 바꾼다.)

- [ ] **Step 4: `app/set-password/page.tsx` 수정 — role에 따라 추천인 코드 필드 조건부 렌더링**

파일 상단 import에 `useSearchParams` 추가:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
```

컴포넌트 본문 맨 위, `const router = useRouter();` 다음 줄에 추가:

```tsx
  const searchParams = useSearchParams();
  const showReferralField = searchParams.get("role") === "parent";
```

추천인 코드 `<div className="mb-4">...</div>` 블록 전체(`htmlFor="referral"`인 라벨+인풋 블록)를 다음으로 감싼다:

```tsx
          {showReferralField && (
            <div className="mb-4">
              <label htmlFor="referral" className="block text-[13px] font-bold text-ink mb-1.5">
                추천인 코드 (선택)
              </label>
              <input
                id="referral"
                name="referral"
                type="text"
                placeholder="예: ALTON-MINJI82"
                className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
              />
            </div>
          )}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run app/set-password/page.test.tsx`
Expected: PASS 전체

- [ ] **Step 6: 커밋**

```bash
git add app/admin/users-actions.ts app/set-password/page.tsx app/set-password/page.test.tsx
git commit -m "fix(auth): 추천인 코드 입력을 학부모 초대일 때만 보이게 수정"
```

---

## Task 2: 선생님 시급 — 마이그레이션 + 초대 필수화 + 관리자 백필

**Files:**
- Create: `supabase/migrations/20260829080000_teachers_hourly_rate.sql`
- Modify: `app/admin/users-actions.ts`
- Modify: `app/admin/users-data.ts`
- Modify: `app/admin/UsersTab.tsx`
- Modify: `app/admin/UsersTab.test.tsx`
- Modify: `app/admin/TeacherDetailPanel.tsx`
- Test: `app/admin/users-actions.test.ts` (기존 파일에 테스트 추가), `app/admin/TeacherDetailPanel.test.tsx`(기존 파일에 테스트 추가)

**Interfaces:**
- Produces: `inviteTeacher(params: { name, email, school, hourlyRateKrw: number }): Promise<string>`(기존 `Promise<void>`에서 id를 반환하도록 변경), `setTeacherHourlyRate(teacherId: string, rateKrw: number): Promise<void>`, `TeacherListItem.hourlyRateKrw: number | null` — Task 4/5(payouts-data/actions)가 `teachers.hourly_rate_krw` 컬럼을 직접 쿼리해서 쓴다(이 타입/액션에 직접 의존하진 않음, 컬럼 존재만 전제).

- [ ] **Step 1: 마이그레이션 작성 + 적용**

`supabase/migrations/20260829080000_teachers_hourly_rate.sql`:

```sql
-- 086(정산): 선생님별 시급(원). 정산 금액 = hourly_rate_krw * 완료 세션 시간(분)/60.
-- 기존에 이미 초대된 선생님은 NULL로 남고, 관리자가 TeacherDetailPanel에서 나중에 채운다.
-- 이제부터 새로 초대되는 선생님은 초대 폼에서 필수 입력이라 NULL이 생기지 않는다.
alter table teachers add column hourly_rate_krw int;
```

```bash
npx supabase db reset
```

Expected: `Applying migration 20260829080000_teachers_hourly_rate.sql...` 출력 후 정상 종료.

- [ ] **Step 2: `inviteTeacher`의 실패하는 테스트 작성**

`app/admin/users-actions.test.ts` 파일을 열어서(Task 1 이전에 이미 존재하는 파일 — `inviteParent` 테스트가 있음) 같은 스타일로 아래 `describe` 블록을 파일 끝에 추가:

```ts
describe("inviteTeacher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    inviteUserByEmailMock.mockResolvedValue({ data: { user: { id: "teacher1" } }, error: null });
    profilesInsertMock.mockResolvedValue({ error: null });
  });

  it("hourlyRateKrw를 teachers.hourly_rate_krw로 저장하고 teacherId를 반환한다", async () => {
    const teachersInsertMock = vi.fn().mockResolvedValue({ error: null });
    vi.doMock("@/lib/supabase-admin", () => ({
      createAdminClient: () => ({
        auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } },
        from: (table: string) => {
          if (table === "profiles") return { insert: profilesInsertMock };
          if (table === "teachers") return { insert: teachersInsertMock };
          throw new Error(`unexpected table ${table}`);
        },
      }),
    }));
    vi.resetModules();
    const { inviteTeacher } = await import("./users-actions");

    const teacherId = await inviteTeacher({
      name: "박서연",
      email: "seoyeon@example.com",
      school: "서울대학교",
      hourlyRateKrw: 30000,
    });

    expect(teacherId).toBe("teacher1");
    expect(teachersInsertMock).toHaveBeenCalledWith({
      id: "teacher1",
      school: "서울대학교",
      status: "pending",
      hourly_rate_krw: 30000,
    });
  });
});
```

(주의: 기존 `app/admin/users-actions.test.ts`가 이미 `@/lib/supabase-admin`을 파일 상단에서 `vi.mock`하고 있을 것이다 — 이 새 테스트에서는 `teachers` 테이블 insert를 추가로 검증해야 해서 `vi.doMock` + `vi.resetModules()` + 동적 `import`로 그 테스트 안에서만 mock을 다시 정의한다. 파일 상단의 기존 최상위 `vi.mock("@/lib/supabase-admin", ...)`는 그대로 둔다 — `inviteParent` 등 다른 테스트들이 계속 그걸 쓴다.)

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run app/admin/users-actions.test.ts`
Expected: FAIL — `inviteTeacher`가 `hourlyRateKrw`를 받지 않고, `teachers` insert에 `hourly_rate_krw`가 없음

- [ ] **Step 4: `inviteTeacher` 수정**

`app/admin/users-actions.ts`의 `inviteTeacher` 함수 전체를 다음으로 교체:

```ts
export async function inviteTeacher(params: {
  name: string;
  email: string;
  school: string;
  hourlyRateKrw: number;
}): Promise<string> {
  await requireAdmin();
  if (!Number.isFinite(params.hourlyRateKrw) || params.hourlyRateKrw <= 0) {
    throw new Error("시급은 1원 이상의 숫자로 입력해주세요.");
  }
  const admin = createAdminClient();
  const userId = await inviteAndCreateProfile({
    name: params.name,
    email: params.email,
    role: "teacher",
  });
  const { error } = await admin
    .from("teachers")
    .insert({
      id: userId,
      school: params.school,
      status: "pending",
      hourly_rate_krw: params.hourlyRateKrw,
    });
  if (error) throw new Error(error.message);
  return userId;
}
```

바로 아래에 새 함수 추가:

```ts
export async function setTeacherHourlyRate(
  teacherId: string,
  rateKrw: number
): Promise<void> {
  const { supabase } = await requireAdmin();
  if (!Number.isFinite(rateKrw) || rateKrw <= 0) {
    throw new Error("시급은 1원 이상의 숫자로 입력해주세요.");
  }
  const { error } = await supabase
    .from("teachers")
    .update({ hourly_rate_krw: rateKrw })
    .eq("id", teacherId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run app/admin/users-actions.test.ts`
Expected: PASS 전체

- [ ] **Step 6: `TeacherListItem`/`loadTeachers`에 `hourlyRateKrw` 추가**

`app/admin/users-data.ts`의 `TeacherListItem` 타입에 필드 추가:

```ts
export type TeacherListItem = {
  id: string;
  name: string;
  email: string;
  school: string | null;
  status: string;
  qcWarningCount: number;
  subjectNames: string[];
  calendlySchedulingUrl: string | null;
  hourlyRateKrw: number | null;
};
```

`loadTeachers`의 select 문자열에 컬럼 추가:

```ts
    .select("id, school, status, calendly_scheduling_url, hourly_rate_krw, profile:profiles(name)")
```

`loadTeachers`의 반환 map에 필드 추가:

```ts
    calendlySchedulingUrl: t.calendly_scheduling_url,
    hourlyRateKrw: t.hourly_rate_krw,
  }));
```

(마지막 두 줄이 기존 `calendlySchedulingUrl: t.calendly_scheduling_url, }));`를 대체한다.)

- [ ] **Step 7: `UsersTab.tsx`에 시급 입력 필드 추가**

`FieldKey` 타입에 `"hourlyRate"` 추가:

```ts
type FieldKey = "name" | "email" | "grade" | "school" | "parentId" | "hourlyRate";
```

`InviteForm`의 `values` 초기 상태와 `handleSubmit`의 리셋 값 둘 다에 `hourlyRate: ""`를 추가:

```ts
  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: "",
    email: "",
    grade: "",
    school: "",
    parentId: "",
    hourlyRate: "",
  });
```

```ts
      setValues({ name: "", email: "", grade: "", school: "", parentId: "", hourlyRate: "" });
```

`{fields.includes("school") && ( ... )}` 블록 바로 다음에 새 필드 추가:

```tsx
      {fields.includes("hourlyRate") && (
        <input
          value={values.hourlyRate}
          onChange={(e) => set("hourlyRate", e.target.value)}
          placeholder="시급 (원, 예: 30000)"
          type="number"
          min="1"
          className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        />
      )}
```

선생님 `InviteForm` 호출부(`fields={["name", "email", "school"]}`)를 다음으로 교체:

```tsx
          <InviteForm
            fields={["name", "email", "school", "hourlyRate"]}
            submitLabel="선생님 초대"
            onSubmit={async (values) => {
              const hourlyRateKrw = Number(values.hourlyRate);
              if (!hourlyRateKrw || hourlyRateKrw <= 0) {
                throw new Error("시급을 입력해주세요.");
              }
              await inviteTeacher({
                name: values.name,
                email: values.email,
                school: values.school,
                hourlyRateKrw,
              });
              setTeachers((prev) => [
                {
                  id: `pending-${Date.now()}`,
                  name: values.name,
                  email: values.email,
                  school: values.school || null,
                  status: "pending",
                  qcWarningCount: 0,
                  subjectNames: [],
                  calendlySchedulingUrl: null,
                  hourlyRateKrw,
                },
                ...prev,
              ]);
            }}
          />
```

- [ ] **Step 8: `UsersTab.test.tsx` mock에 새 함수 추가**

`vi.mock("./users-actions", ...)` 블록에 `setTeacherHourlyRate: vi.fn(),` 한 줄 추가(기존 `setTeacherCalendlyUrl: vi.fn(),` 다음 줄).

- [ ] **Step 9: `TeacherDetailPanel.tsx`에 시급 편집 필드 추가**

import 줄 수정:

```tsx
import { setTeacherStatus, setTeacherCalendlyUrl, setTeacherHourlyRate } from "./users-actions";
```

컴포넌트 안, `const [savedUrl, setSavedUrl] = useState(false);` 다음 줄에 상태 추가:

```tsx
  const [hourlyRate, setHourlyRate] = useState(
    teacher.hourlyRateKrw != null ? String(teacher.hourlyRateKrw) : ""
  );
  const [savingRate, setSavingRate] = useState(false);
  const [savedRate, setSavedRate] = useState(false);
```

`handleSaveCalendlyUrl` 함수 다음에 새 핸들러 추가:

```tsx
  async function handleSaveHourlyRate() {
    const rate = Number(hourlyRate);
    if (!rate || rate <= 0) return;
    setSavingRate(true);
    setSavedRate(false);
    try {
      await setTeacherHourlyRate(teacher.id, rate);
      onUpdated({ hourlyRateKrw: rate });
      setSavedRate(true);
    } finally {
      setSavingRate(false);
    }
  }
```

"개인 예약 링크 (Calendly)" `<div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">...</div>` 블록 바로 다음에 새 카드 추가:

```tsx
      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          시급 (정산 기준)
        </div>
        <div className="flex gap-2">
          <input
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            type="number"
            min="1"
            placeholder="예: 30000"
            className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <button
            disabled={savingRate}
            onClick={handleSaveHourlyRate}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50 shrink-0"
          >
            {savingRate ? "저장 중..." : "저장"}
          </button>
        </div>
        {savedRate && <p className="text-[12px] text-green mt-1.5">✓ 저장되었습니다</p>}
      </div>
```

- [ ] **Step 10: `TeacherDetailPanel.test.tsx`에 테스트 추가**

기존 파일을 열어서 teacher fixture에 `hourlyRateKrw: 30000,` 필드를 추가하고(타입 에러 방지), `vi.mock("./users-actions", ...)`에 `setTeacherHourlyRate: vi.fn(),` 추가한 뒤 파일 끝에 테스트 추가:

```tsx
it("시급을 수정하고 저장할 수 있다", async () => {
  render(
    <TeacherDetailPanel
      teacher={teacher}
      warnings={[]}
      onBack={vi.fn()}
      onUpdated={vi.fn()}
    />
  );

  const input = screen.getByPlaceholderText("예: 30000");
  fireEvent.change(input, { target: { value: "35000" } });
  fireEvent.click(screen.getAllByText("저장")[1]);

  await waitFor(() =>
    expect(setTeacherHourlyRate).toHaveBeenCalledWith(teacher.id, 35000)
  );
});
```

(이 파일에 이미 `render`, `screen`, `fireEvent`, `waitFor`, `vi` import와 `teacher` fixture, `import * as actions` 또는 개별 import 패턴이 있을 것 — 기존 스타일을 그대로 따라 `setTeacherHourlyRate`를 import/참조한다. "저장" 버튼이 Calendly 카드와 시급 카드 둘 다에 있으므로 `getAllByText("저장")[1]`로 두 번째(시급) 버튼을 특정한다.)

- [ ] **Step 11: 전체 테스트 + 타입체크**

Run: `npx vitest run app/admin/users-actions.test.ts app/admin/UsersTab.test.tsx app/admin/TeacherDetailPanel.test.tsx`
Expected: PASS 전체

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 12: 커밋**

```bash
git add supabase/migrations/20260829080000_teachers_hourly_rate.sql app/admin/users-actions.ts app/admin/users-actions.test.ts app/admin/users-data.ts app/admin/UsersTab.tsx app/admin/UsersTab.test.tsx app/admin/TeacherDetailPanel.tsx app/admin/TeacherDetailPanel.test.tsx
git commit -m "feat(admin): 선생님 시급 필수화(초대 시 입력) + 기존 선생님 백필 UI"
```

---

## Task 3: 선생님 셀프 Calendly 온보딩 (자동 승인)

**Files:**
- Create: `app/teacher/onboarding-actions.ts`
- Modify: `app/teacher/dashboard-data.ts`
- Modify: `app/teacher/TeacherHomeDashboard.tsx`
- Test: `app/teacher/onboarding-actions.test.ts`(신규), `app/teacher/TeacherHomeDashboard.test.tsx`(기존 파일 수정)

**Interfaces:**
- Produces: `submitCalendlyOnboarding(url: string): Promise<void>`, `TeacherDashboardData`에 `status: string`, `calendlySchedulingUrl: string | null` 필드 추가 — Task 없음(이 태스크가 마지막 소비자).

- [ ] **Step 1: `submitCalendlyOnboarding`의 실패하는 테스트 작성**

`app/teacher/onboarding-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "teacher1" } } });
const updateEqMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const fromMock = vi.fn(() => ({ update: updateMock }));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

describe("submitCalendlyOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "teacher1" } } });
    updateEqMock.mockResolvedValue({ error: null });
  });

  it("본인의 calendly_scheduling_url을 저장하고 status를 active로 바꾼다", async () => {
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await submitCalendlyOnboarding("https://calendly.com/seoyeon-teacher/session");

    expect(fromMock).toHaveBeenCalledWith("teachers");
    expect(updateMock).toHaveBeenCalledWith({
      calendly_scheduling_url: "https://calendly.com/seoyeon-teacher/session",
      status: "active",
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "teacher1");
  });

  it("로그인하지 않았으면 에러를 던진다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await expect(submitCalendlyOnboarding("https://calendly.com/x")).rejects.toThrow(
      "로그인이 필요합니다."
    );
  });

  it("빈 URL이면 에러를 던진다", async () => {
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await expect(submitCalendlyOnboarding("  ")).rejects.toThrow(
      "Calendly 예약 링크를 입력해주세요."
    );
  });

  it("저장이 실패하면 에러를 던진다", async () => {
    updateEqMock.mockResolvedValue({ error: { message: "권한 없음" } });
    const { submitCalendlyOnboarding } = await import("./onboarding-actions");
    await expect(
      submitCalendlyOnboarding("https://calendly.com/x")
    ).rejects.toThrow("권한 없음");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/teacher/onboarding-actions.test.ts`
Expected: FAIL — `Cannot find module './onboarding-actions'`

- [ ] **Step 3: 구현**

`app/teacher/onboarding-actions.ts`:

```ts
"use server";

import { createClient } from "@/utils/supabase/server";

export async function submitCalendlyOnboarding(url: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const trimmed = url.trim();
  if (!trimmed) throw new Error("Calendly 예약 링크를 입력해주세요.");

  const { error } = await supabase
    .from("teachers")
    .update({ calendly_scheduling_url: trimmed, status: "active" })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/teacher/onboarding-actions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: `TeacherDashboardData`에 `status`/`calendlySchedulingUrl` 추가**

`app/teacher/dashboard-data.ts`의 `TeacherDashboardData` 타입에 필드 추가:

```ts
export type TeacherDashboardData = {
  teacherName: string;
  status: string;
  calendlySchedulingUrl: string | null;
  upcoming: TeacherLesson[];
  past: TeacherLesson[];
  calendarByDay: Record<number, CalendarDaySession[]>;
  calendarYear: number;
  calendarMonth: number;
};
```

`loadTeacherDashboard` 안, `profile` 조회 다음에 teachers 행 조회 추가:

```ts
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", teacherId)
    .single();

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("status, calendly_scheduling_url")
    .eq("id", teacherId)
    .single();
```

함수의 반환 객체(마지막 `return { ... }`)에 두 필드를 추가한다 — 정확한 반환문 위치와 기존 필드들은 파일을 열어서 확인한 뒤, `teacherName: profile?.name ?? "선생님",` 바로 다음 줄에 아래 두 줄을 추가:

```ts
    status: teacherRow?.status ?? "pending",
    calendlySchedulingUrl: teacherRow?.calendly_scheduling_url ?? null,
```

- [ ] **Step 6: `TeacherHomeDashboard.tsx`에 온보딩 배너 추가**

import 줄에 `useState`는 이미 있으므로 액션만 추가:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TeacherDashboardData } from "./dashboard-data";
import { submitCalendlyOnboarding } from "./onboarding-actions";
```

컴포넌트 본문 맨 위, `const [selectedDay, setSelectedDay] = useState<number | null>(null);` 다음 줄에 온보딩 상태 추가:

```tsx
  const [status, setStatus] = useState(data.status);
  const [calendlyUrl, setCalendlyUrl] = useState(data.calendlySchedulingUrl ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOnboardingSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await submitCalendlyOnboarding(calendlyUrl);
      setStatus("active");
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }
```

`return (` 안, `<h1 ...>{data.teacherName} 선생님, 안녕하세요</h1>` 바로 다음에 배너 추가:

```tsx
      {status === "pending" && (
        <div className="border-[1.5px] border-ink rounded-xl px-5 py-4.5 mb-6">
          <h2 className="text-[14px] font-bold text-ink mb-1.5">
            👋 시작하기 전에 — Calendly 연동이 필요해요
          </h2>
          <p className="text-[12.5px] text-grey-500 mb-3 leading-[1.6]">
            학생들이 선생님과 직접 회차를 예약할 수 있도록, 본인의 Calendly 개인
            예약 링크를 등록해주세요. 등록하시면 바로 활동을 시작하실 수 있습니다.
          </p>
          <div className="flex gap-2">
            <input
              value={calendlyUrl}
              onChange={(e) => setCalendlyUrl(e.target.value)}
              placeholder="https://calendly.com/xxx-teacher/session"
              className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
            />
            <button
              disabled={submitting}
              onClick={handleOnboardingSubmit}
              className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50 shrink-0"
            >
              {submitting ? "저장 중..." : "등록하고 시작하기"}
            </button>
          </div>
          {error && <p className="text-[12px] text-red mt-1.5">{error}</p>}
        </div>
      )}
```

- [ ] **Step 7: `TeacherHomeDashboard.test.tsx`에 테스트 추가**

기존 파일 상단에 mock 추가:

```tsx
vi.mock("./onboarding-actions", () => ({
  submitCalendlyOnboarding: vi.fn(),
}));
```

기존 `data` fixture에 `status: "active", calendlySchedulingUrl: "https://calendly.com/seoyeon",` 두 필드를 추가한다(테스트가 이미 지나가는 상태를 기본값으로 유지하기 위해 — 온보딩 배너는 아래 신규 테스트에서 `status: "pending"`을 명시적으로 오버라이드해서 검증).

파일 끝에 테스트 추가:

```tsx
it("status가 pending이면 온보딩 배너가 보이고, 제출하면 사라진다", async () => {
  const { submitCalendlyOnboarding } = await import("./onboarding-actions");
  vi.mocked(submitCalendlyOnboarding).mockResolvedValue(undefined);

  render(
    <TeacherHomeDashboard
      data={{ ...data, status: "pending", calendlySchedulingUrl: null }}
      onShowSchedule={vi.fn()}
    />
  );

  expect(screen.getByText(/Calendly 연동이 필요해요/)).toBeInTheDocument();

  fireEvent.change(
    screen.getByPlaceholderText("https://calendly.com/xxx-teacher/session"),
    { target: { value: "https://calendly.com/seoyeon-teacher/session" } }
  );
  fireEvent.click(screen.getByText("등록하고 시작하기"));

  await waitFor(() =>
    expect(submitCalendlyOnboarding).toHaveBeenCalledWith(
      "https://calendly.com/seoyeon-teacher/session"
    )
  );
  await waitFor(() =>
    expect(screen.queryByText(/Calendly 연동이 필요해요/)).not.toBeInTheDocument()
  );
});

it("status가 active면 온보딩 배너가 안 보인다", () => {
  render(
    <TeacherHomeDashboard data={{ ...data, status: "active" }} onShowSchedule={vi.fn()} />
  );
  expect(screen.queryByText(/Calendly 연동이 필요해요/)).not.toBeInTheDocument();
});
```

(이 파일에 `fireEvent`, `waitFor`가 이미 `@testing-library/react`에서 import돼 있지 않다면 import 줄에 추가한다.)

- [ ] **Step 8: 전체 테스트 + 타입체크**

Run: `npx vitest run app/teacher/onboarding-actions.test.ts app/teacher/TeacherHomeDashboard.test.tsx`
Expected: PASS 전체

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 9: 커밋**

```bash
git add app/teacher/onboarding-actions.ts app/teacher/onboarding-actions.test.ts app/teacher/dashboard-data.ts app/teacher/TeacherHomeDashboard.tsx app/teacher/TeacherHomeDashboard.test.tsx
git commit -m "feat(teacher): 셀프 Calendly 온보딩 — 등록 시 자동 승인"
```

---

## Task 4: 정산 계산/조회 — `payouts-data.ts`

**Files:**
- Create: `app/admin/payouts-data.ts`
- Test: `app/admin/payouts-data.test.ts`

**Interfaces:**
- Produces:
  - `type PayoutPeriod = { periodStart: string; periodEnd: string }` (ISO 날짜 문자열, `YYYY-MM-DD`)
  - `type TeacherPayoutAmount = { teacherId: string; teacherName: string; amountKrw: number; totalMinutes: number }`
  - `type MissingRatePayoutSkip = { teacherId: string; teacherName: string }`
  - `computePayoutAmounts(supabase, period: PayoutPeriod): Promise<{ amounts: TeacherPayoutAmount[]; skipped: MissingRatePayoutSkip[] }>` — Task 5의 `generatePayouts`가 사용.
  - `type PayoutListItem = { id: string; teacherId: string; teacherName: string; amountKrw: number; periodStart: string; periodEnd: string; status: "pending" | "paid"; paidAt: string | null }`
  - `loadPayouts(supabase): Promise<PayoutListItem[]>` — Task 6의 `PayoutsTab.tsx`가 사용.
  - `previousMonthRange(now: Date): PayoutPeriod` — 순수 함수, "전월 1일~말일"을 계산. cron 라우트(Task 7)와 관리자 수동 생성 버튼 기본값(Task 6) 둘 다 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`app/admin/payouts-data.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  computePayoutAmounts,
  loadPayouts,
  previousMonthRange,
} from "./payouts-data";

describe("previousMonthRange", () => {
  it("주어진 날짜 기준 전월 1일~말일을 반환한다", () => {
    const result = previousMonthRange(new Date("2026-09-15T00:00:00Z"));
    expect(result).toEqual({ periodStart: "2026-08-01", periodEnd: "2026-08-31" });
  });

  it("1월이면 전년도 12월을 반환한다", () => {
    const result = previousMonthRange(new Date("2026-01-10T00:00:00Z"));
    expect(result).toEqual({ periodStart: "2025-12-01", periodEnd: "2025-12-31" });
  });
});

describe("computePayoutAmounts", () => {
  it("시급이 있는 선생님만 완료 세션 시간을 합산해 금액을 계산한다", async () => {
    const teachers = [
      { id: "t1", hourly_rate_krw: 30000, profile: { name: "박서연" } },
      { id: "t2", hourly_rate_krw: null, profile: { name: "이도현" } },
    ];
    const sessions = [
      { teacher_id: "t1", duration_minutes: 60 },
      { teacher_id: "t1", duration_minutes: 90 },
      { teacher_id: "t2", duration_minutes: 60 },
    ];
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "teachers") {
          return { select: () => Promise.resolve({ data: teachers }) };
        }
        if (table === "sessions") {
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({ lte: () => Promise.resolve({ data: sessions }) }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await computePayoutAmounts(supabase as never, {
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
    });

    expect(result.amounts).toEqual([
      { teacherId: "t1", teacherName: "박서연", amountKrw: 75000, totalMinutes: 150 },
    ]);
    expect(result.skipped).toEqual([{ teacherId: "t2", teacherName: "이도현" }]);
  });
});

describe("loadPayouts", () => {
  it("teacher_payouts를 선생님 이름과 함께 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "teacher_payouts") {
          return {
            select: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "p1",
                      teacher_id: "t1",
                      amount_krw: 75000,
                      period_start: "2026-08-01",
                      period_end: "2026-08-31",
                      status: "pending",
                      paid_at: null,
                    },
                  ],
                }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({ in: () => Promise.resolve({ data: [{ id: "t1", name: "박서연" }] }) }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await loadPayouts(supabase as never);
    expect(result).toEqual([
      {
        id: "p1",
        teacherId: "t1",
        teacherName: "박서연",
        amountKrw: 75000,
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        status: "pending",
        paidAt: null,
      },
    ]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/admin/payouts-data.test.ts`
Expected: FAIL — `Cannot find module './payouts-data'`

- [ ] **Step 3: 구현**

`app/admin/payouts-data.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type PayoutPeriod = { periodStart: string; periodEnd: string };

export type TeacherPayoutAmount = {
  teacherId: string;
  teacherName: string;
  amountKrw: number;
  totalMinutes: number;
};

export type MissingRatePayoutSkip = { teacherId: string; teacherName: string };

export type PayoutListItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  amountKrw: number;
  periodStart: string;
  periodEnd: string;
  status: "pending" | "paid";
  paidAt: string | null;
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function previousMonthRange(now: Date): PayoutPeriod {
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(
    Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1)
  );
  return {
    periodStart: toDateOnly(firstOfPrevMonth),
    periodEnd: toDateOnly(lastOfPrevMonth),
  };
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function computePayoutAmounts(
  supabase: SupabaseClient,
  period: PayoutPeriod
): Promise<{ amounts: TeacherPayoutAmount[]; skipped: MissingRatePayoutSkip[] }> {
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, hourly_rate_krw, profile:profiles(name)");

  const { data: sessions } = await supabase
    .from("sessions")
    .select("teacher_id, duration_minutes")
    .eq("status", "completed")
    .gte("scheduled_at", period.periodStart)
    .lte("scheduled_at", `${period.periodEnd}T23:59:59`);

  const minutesByTeacher = new Map<string, number>();
  for (const s of (sessions ?? []) as { teacher_id: string; duration_minutes: number }[]) {
    minutesByTeacher.set(
      s.teacher_id,
      (minutesByTeacher.get(s.teacher_id) ?? 0) + s.duration_minutes
    );
  }

  const amounts: TeacherPayoutAmount[] = [];
  const skipped: MissingRatePayoutSkip[] = [];

  for (const t of (teachers ?? []) as {
    id: string;
    hourly_rate_krw: number | null;
    profile: unknown;
  }[]) {
    const totalMinutes = minutesByTeacher.get(t.id) ?? 0;
    if (totalMinutes === 0) continue;
    const teacherName = extractName(t.profile);
    if (t.hourly_rate_krw == null) {
      skipped.push({ teacherId: t.id, teacherName });
      continue;
    }
    amounts.push({
      teacherId: t.id,
      teacherName,
      amountKrw: Math.round((t.hourly_rate_krw * totalMinutes) / 60),
      totalMinutes,
    });
  }

  return { amounts, skipped };
}

export async function loadPayouts(supabase: SupabaseClient): Promise<PayoutListItem[]> {
  const { data: payouts } = await supabase
    .from("teacher_payouts")
    .select("id, teacher_id, amount_krw, period_start, period_end, status, paid_at")
    .order("period_start", { ascending: false });
  if (!payouts || payouts.length === 0) return [];

  const teacherIds = Array.from(new Set(payouts.map((p) => p.teacher_id)));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", teacherIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  return payouts.map((p) => ({
    id: p.id,
    teacherId: p.teacher_id,
    teacherName: nameById.get(p.teacher_id) ?? "알 수 없음",
    amountKrw: p.amount_krw,
    periodStart: p.period_start,
    periodEnd: p.period_end,
    status: p.status,
    paidAt: p.paid_at,
  }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/admin/payouts-data.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/admin/payouts-data.ts app/admin/payouts-data.test.ts
git commit -m "feat(admin): 정산 계산/조회 함수 추가"
```

---

## Task 5: 정산 생성/승인 서버 액션 — `payouts-actions.ts`

**Files:**
- Create: `app/admin/payouts-actions.ts`
- Test: `app/admin/payouts-actions.test.ts`

**Interfaces:**
- Consumes: `computePayoutAmounts`, `PayoutPeriod`(Task 4), `sendEmail`(`@/lib/email.ts`), `requireAdmin`(`@/lib/admin-auth`)
- Produces: `generatePayouts(period: PayoutPeriod): Promise<{ created: number; skippedNoRate: MissingRatePayoutSkip[] }>`, `markPayoutPaid(id: string): Promise<void>`, `markPayoutsPaidBulk(ids: string[]): Promise<void>`, `revertPayoutToPending(id: string): Promise<void>` — Task 6의 `PayoutsTab.tsx`가 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`app/admin/payouts-actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue({ supabase: {}, adminUserId: "admin1" }),
}));

const computePayoutAmountsMock = vi.fn();
vi.mock("./payouts-data", () => ({
  computePayoutAmounts: computePayoutAmountsMock,
}));

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailMock,
}));

const existingCheckMock = vi.fn();
const payoutsInsertMock = vi.fn().mockResolvedValue({ error: null });
const payoutsUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
const payoutsUpdateMock = vi.fn(() => ({ eq: payoutsUpdateEqMock }));
const payoutsSingleSelectMock = vi.fn();
const emailByIdMock = vi.fn();

const fromMock = vi.fn((table: string) => {
  if (table === "teacher_payouts") {
    return {
      select: (cols: string) => {
        if (cols === "id") {
          return { eq: () => ({ eq: () => ({ eq: existingCheckMock }) }) };
        }
        return { eq: () => ({ single: payoutsSingleSelectMock }) };
      },
      insert: payoutsInsertMock,
      update: payoutsUpdateMock,
    };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ from: fromMock }),
}));

describe("generatePayouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computePayoutAmountsMock.mockResolvedValue({
      amounts: [
        { teacherId: "t1", teacherName: "박서연", amountKrw: 75000, totalMinutes: 150 },
      ],
      skipped: [{ teacherId: "t2", teacherName: "이도현" }],
    });
    existingCheckMock.mockResolvedValue({ data: [] });
    payoutsInsertMock.mockResolvedValue({ error: null });
  });

  it("이미 같은 선생님·기간 정산이 없으면 새로 만들고, 시급 미설정 선생님은 skippedNoRate로 반환한다", async () => {
    const { generatePayouts } = await import("./payouts-actions");
    const result = await generatePayouts({ periodStart: "2026-08-01", periodEnd: "2026-08-31" });

    expect(payoutsInsertMock).toHaveBeenCalledWith({
      teacher_id: "t1",
      amount_krw: 75000,
      period_start: "2026-08-01",
      period_end: "2026-08-31",
      status: "pending",
    });
    expect(result).toEqual({
      created: 1,
      skippedNoRate: [{ teacherId: "t2", teacherName: "이도현" }],
    });
  });

  it("이미 같은 선생님·기간 정산이 있으면 건너뛴다", async () => {
    existingCheckMock.mockResolvedValue({ data: [{ id: "existing1" }] });
    const { generatePayouts } = await import("./payouts-actions");
    const result = await generatePayouts({ periodStart: "2026-08-01", periodEnd: "2026-08-31" });

    expect(payoutsInsertMock).not.toHaveBeenCalled();
    expect(result.created).toBe(0);
  });
});

describe("markPayoutPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payoutsUpdateEqMock.mockResolvedValue({ error: null });
    payoutsSingleSelectMock.mockResolvedValue({
      data: { teacher_id: "t1", amount_krw: 75000 },
    });
  });

  it("상태를 paid로 바꾸고 선생님에게 이메일을 보낸다", async () => {
    const { markPayoutPaid } = await import("./payouts-actions");
    await markPayoutPaid("p1");

    expect(payoutsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "paid", approved_by: "admin1" })
    );
    expect(payoutsUpdateEqMock).toHaveBeenCalledWith("id", "p1");
    expect(sendEmailMock).toHaveBeenCalled();
  });
});

describe("revertPayoutToPending", () => {
  it("상태를 pending으로 되돌리고 이메일은 보내지 않는다", async () => {
    vi.clearAllMocks();
    payoutsUpdateEqMock.mockResolvedValue({ error: null });
    const { revertPayoutToPending } = await import("./payouts-actions");
    await revertPayoutToPending("p1");

    expect(payoutsUpdateMock).toHaveBeenCalledWith({
      status: "pending",
      paid_at: null,
      approved_by: null,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/admin/payouts-actions.test.ts`
Expected: FAIL — `Cannot find module './payouts-actions'`

- [ ] **Step 3: 구현**

`app/admin/payouts-actions.ts`:

```ts
"use server";

import { createAdminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import {
  computePayoutAmounts,
  type MissingRatePayoutSkip,
  type PayoutPeriod,
} from "./payouts-data";

async function loadEmailById(userIds: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const map = new Map<string, string>();
  for (const id of userIds) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data.user?.email) map.set(id, data.user.email);
  }
  return map;
}

export async function generatePayouts(
  period: PayoutPeriod
): Promise<{ created: number; skippedNoRate: MissingRatePayoutSkip[] }> {
  await requireAdmin();
  const admin = createAdminClient();

  const { amounts, skipped } = await computePayoutAmounts(admin, period);

  let created = 0;
  for (const a of amounts) {
    const { data: existing } = await admin
      .from("teacher_payouts")
      .select("id")
      .eq("teacher_id", a.teacherId)
      .eq("period_start", period.periodStart)
      .eq("period_end", period.periodEnd);
    if (existing && existing.length > 0) continue;

    const { error } = await admin.from("teacher_payouts").insert({
      teacher_id: a.teacherId,
      amount_krw: a.amountKrw,
      period_start: period.periodStart,
      period_end: period.periodEnd,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    created += 1;
  }

  return { created, skippedNoRate: skipped };
}

export async function markPayoutPaid(id: string): Promise<void> {
  const { adminUserId } = await requireAdmin();
  const admin = createAdminClient();

  const { data: payout } = await admin
    .from("teacher_payouts")
    .select("teacher_id, amount_krw")
    .eq("id", id)
    .single();
  if (!payout) throw new Error("정산 내역을 찾을 수 없습니다.");

  const { error } = await admin
    .from("teacher_payouts")
    .update({ status: "paid", paid_at: new Date().toISOString(), approved_by: adminUserId })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const emailById = await loadEmailById([payout.teacher_id]);
  const email = emailById.get(payout.teacher_id);
  if (email) {
    await sendEmail({
      to: email,
      subject: "[Alton Education] 정산이 완료됐습니다",
      html: `<p>이번 정산(${payout.amount_krw.toLocaleString()}원) 지급이 완료됐습니다. 감사합니다.</p>`,
    });
  }
}

export async function markPayoutsPaidBulk(ids: string[]): Promise<void> {
  for (const id of ids) {
    await markPayoutPaid(id);
  }
}

export async function revertPayoutToPending(id: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_payouts")
    .update({ status: "pending", paid_at: null, approved_by: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/admin/payouts-actions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/admin/payouts-actions.ts app/admin/payouts-actions.test.ts
git commit -m "feat(admin): 정산 생성/완료처리/완료취소 서버 액션"
```

---

## Task 6: `PayoutsTab.tsx` UI + 배선

**Files:**
- Create: `app/admin/PayoutsTab.tsx`
- Test: `app/admin/PayoutsTab.test.tsx`
- Modify: `app/admin/AdminShell.tsx`
- Modify: `app/admin/AdminShell.test.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `PayoutListItem`, `loadPayouts`, `previousMonthRange`(Task 4), `generatePayouts`, `markPayoutPaid`, `markPayoutsPaidBulk`, `revertPayoutToPending`(Task 5)

- [ ] **Step 1: 실패하는 테스트 작성**

`app/admin/PayoutsTab.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PayoutsTab from "./PayoutsTab";
import type { PayoutListItem } from "./payouts-data";
import {
  generatePayouts,
  markPayoutPaid,
  markPayoutsPaidBulk,
  revertPayoutToPending,
} from "./payouts-actions";

vi.mock("./payouts-actions", () => ({
  generatePayouts: vi.fn(),
  markPayoutPaid: vi.fn(),
  markPayoutsPaidBulk: vi.fn(),
  revertPayoutToPending: vi.fn(),
}));

const payouts: PayoutListItem[] = [
  {
    id: "p1",
    teacherId: "t1",
    teacherName: "박서연",
    amountKrw: 750000,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    status: "pending",
    paidAt: null,
  },
  {
    id: "p2",
    teacherId: "t2",
    teacherName: "이도현",
    amountKrw: 450000,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    status: "paid",
    paidAt: "2026-09-03T00:00:00.000Z",
  },
];

describe("PayoutsTab", () => {
  it("정산 목록을 상태와 함께 보여준다", () => {
    render(<PayoutsTab initialPayouts={payouts} />);
    expect(screen.getByText("박서연")).toBeInTheDocument();
    expect(screen.getByText("750,000원")).toBeInTheDocument();
    expect(screen.getByText("이도현")).toBeInTheDocument();
  });

  it("대기 중인 항목의 승인 버튼을 누르면 markPayoutPaid가 호출된다", async () => {
    vi.mocked(markPayoutPaid).mockResolvedValue(undefined);
    render(<PayoutsTab initialPayouts={payouts} />);

    fireEvent.click(screen.getByText("승인"));

    await waitFor(() => expect(markPayoutPaid).toHaveBeenCalledWith("p1"));
  });

  it("완료된 항목엔 완료 취소 버튼이 보이고 누르면 revertPayoutToPending이 호출된다", async () => {
    vi.mocked(revertPayoutToPending).mockResolvedValue(undefined);
    render(<PayoutsTab initialPayouts={payouts} />);

    fireEvent.click(screen.getByText("완료 취소"));

    await waitFor(() => expect(revertPayoutToPending).toHaveBeenCalledWith("p2"));
  });

  it("전체 승인을 누르면 대기 중인 모든 id로 markPayoutsPaidBulk가 호출된다", async () => {
    vi.mocked(markPayoutsPaidBulk).mockResolvedValue(undefined);
    render(<PayoutsTab initialPayouts={payouts} />);

    fireEvent.click(screen.getByText("전체 승인"));

    await waitFor(() => expect(markPayoutsPaidBulk).toHaveBeenCalledWith(["p1"]));
  });

  it("정산 생성 버튼을 누르면 generatePayouts가 기본 기간(전월)으로 호출된다", async () => {
    vi.mocked(generatePayouts).mockResolvedValue({ created: 2, skippedNoRate: [] });
    render(<PayoutsTab initialPayouts={[]} />);

    fireEvent.click(screen.getByText("정산 생성"));

    await waitFor(() => expect(generatePayouts).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/admin/PayoutsTab.test.tsx`
Expected: FAIL — `Cannot find module './PayoutsTab'`

- [ ] **Step 3: 구현**

`app/admin/PayoutsTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { PayoutListItem } from "./payouts-data";
import {
  generatePayouts,
  markPayoutPaid,
  markPayoutsPaidBulk,
  revertPayoutToPending,
} from "./payouts-actions";

function previousMonthDefaults(): { start: string; end: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(firstOfPrevMonth), end: fmt(lastOfPrevMonth) };
}

export default function PayoutsTab({ initialPayouts }: { initialPayouts: PayoutListItem[] }) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const defaults = previousMonthDefaults();
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const pendingIds = payouts.filter((p) => p.status === "pending").map((p) => p.id);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateMessage(null);
    try {
      const result = await generatePayouts({ periodStart, periodEnd });
      setGenerateMessage(
        `${result.created}건 생성됨` +
          (result.skippedNoRate.length > 0
            ? ` · 시급 미설정으로 건너뜀: ${result.skippedNoRate.map((s) => s.teacherName).join(", ")}`
            : "")
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      await markPayoutPaid(id);
      setPayouts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "paid" as const, paidAt: new Date().toISOString() } : p))
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRevert(id: string) {
    setProcessingId(id);
    try {
      await revertPayoutToPending(id);
      setPayouts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "pending" as const, paidAt: null } : p))
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleApproveAll() {
    if (pendingIds.length === 0) return;
    setBulkProcessing(true);
    try {
      await markPayoutsPaidBulk(pendingIds);
      setPayouts((prev) =>
        prev.map((p) =>
          pendingIds.includes(p.id)
            ? { ...p, status: "paid" as const, paidAt: new Date().toISOString() }
            : p
        )
      );
    } finally {
      setBulkProcessing(false);
    }
  }

  return (
    <div className="max-w-[820px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">정산</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        매달 1일 전월분이 자동 생성됩니다. 수기로 송금하신 뒤 승인해주세요.
      </p>

      <div className="flex items-end gap-2 mb-3">
        <div>
          <label className="block text-[11px] font-bold text-grey-300 mb-1">시작일</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-grey-300 mb-1">종료일</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
        </div>
        <button
          disabled={generating}
          onClick={handleGenerate}
          className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
        >
          {generating ? "생성 중..." : "정산 생성"}
        </button>
        {pendingIds.length > 0 && (
          <button
            disabled={bulkProcessing}
            onClick={handleApproveAll}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            전체 승인
          </button>
        )}
      </div>
      {generateMessage && <p className="text-[12px] text-grey-500 mb-4">{generateMessage}</p>}

      {payouts.length === 0 ? (
        <p className="text-[13px] text-grey-500">정산 내역이 없습니다.</p>
      ) : (
        payouts.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
          >
            <div>
              <div className="text-[13.5px] font-bold text-ink">{p.teacherName}</div>
              <div className="text-[12px] text-grey-500">
                {p.periodStart} ~ {p.periodEnd} · {p.amountKrw.toLocaleString()}원
              </div>
            </div>
            {p.status === "pending" ? (
              <button
                disabled={processingId === p.id}
                onClick={() => handleApprove(p.id)}
                className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
              >
                승인
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-grey-100 text-ink">
                  완료
                </span>
                <button
                  disabled={processingId === p.id}
                  onClick={() => handleRevert(p.id)}
                  className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                >
                  완료 취소
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/admin/PayoutsTab.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: `AdminShell.tsx`에 배선**

import 추가:

```tsx
import PayoutsTab from "./PayoutsTab";
import type { PayoutListItem } from "./payouts-data";
```

props 목록(구조분해)과 타입 선언에 `payouts`/`payouts: PayoutListItem[];` 추가(기존 `devLogContent,` 다음 줄과 `devLogContent: string;` 다음 줄에 각각).

탭 렌더링 분기에서 `activeTab === "devlog"` 분기 다음, `) : ( <div ...준비 중... )` 앞에 추가:

```tsx
          ) : activeTab === "payouts" ? (
            <PayoutsTab initialPayouts={payouts} />
```

- [ ] **Step 6: `AdminShell.test.tsx` 수정**

`baseProps`에 `payouts: [],` 추가(`devLogContent` 다음 줄).

새 테스트 추가(기존 "개발 로그 탭을 누르면..." 테스트 다음):

```tsx
  it("정산 탭을 누르면 PayoutsTab이 렌더링된다", () => {
    render(<AdminShell {...baseProps} />);
    fireEvent.click(screen.getByText("정산"));
    expect(screen.getByText("정산 생성")).toBeInTheDocument();
  });
```

- [ ] **Step 7: `page.tsx`에 데이터 로딩 배선**

import 추가:

```ts
import { loadPayouts } from "./payouts-data";
```

`const devLogContent = loadDevLog();` 다음 줄에 추가:

```ts
  const payouts = await loadPayouts(supabase);
```

`<AdminShell ... />`에 `payouts={payouts}` 추가(`devLogContent={devLogContent}` 다음 줄).

- [ ] **Step 8: 전체 테스트 + 타입체크**

Run: `npx vitest run app/admin/PayoutsTab.test.tsx app/admin/AdminShell.test.tsx`
Expected: PASS 전체

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 9: 커밋**

```bash
git add app/admin/PayoutsTab.tsx app/admin/PayoutsTab.test.tsx app/admin/AdminShell.tsx app/admin/AdminShell.test.tsx app/admin/page.tsx
git commit -m "feat(admin): 정산 탭 UI 및 배선 완료"
```

---

## Task 7: 매달 1일 자동 생성 cron

**Files:**
- Create: `app/api/cron/generate-payouts/route.ts`
- Create: `vercel.json`
- Test: `app/api/cron/generate-payouts/route.test.ts`

**Interfaces:**
- Consumes: `generatePayouts`(Task 5), `previousMonthRange`(Task 4)

- [ ] **Step 1: 실패하는 테스트 작성**

`app/api/cron/generate-payouts/route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generatePayoutsMock = vi.fn();
vi.mock("@/app/admin/payouts-actions", () => ({
  generatePayouts: generatePayoutsMock,
}));

describe("GET /api/cron/generate-payouts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    generatePayoutsMock.mockResolvedValue({ created: 3, skippedNoRate: [] });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("올바른 CRON_SECRET이면 전월 기준으로 generatePayouts를 실행한다", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/cron/generate-payouts", {
      headers: { authorization: "Bearer test-secret" },
    });

    const res = await GET(request);
    expect(res.status).toBe(200);
    expect(generatePayoutsMock).toHaveBeenCalled();
  });

  it("CRON_SECRET이 틀리면 401을 반환하고 실행하지 않는다", async () => {
    const { GET } = await import("./route");
    const request = new Request("http://localhost/api/cron/generate-payouts", {
      headers: { authorization: "Bearer wrong" },
    });

    const res = await GET(request);
    expect(res.status).toBe(401);
    expect(generatePayoutsMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run app/api/cron/generate-payouts/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: 구현**

`app/api/cron/generate-payouts/route.ts`:

```ts
import { NextResponse } from "next/server";
import { generatePayouts } from "@/app/admin/payouts-actions";
import { previousMonthRange } from "@/app/admin/payouts-data";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await generatePayouts(previousMonthRange(new Date()));
  return NextResponse.json({ ok: true, ...result });
}
```

`vercel.json`(신규 파일, 프로젝트 루트):

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-payouts",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/api/cron/generate-payouts/route.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/api/cron/generate-payouts/route.ts app/api/cron/generate-payouts/route.test.ts vercel.json
git commit -m "feat(admin): 매달 1일 정산 자동 생성 cron"
```

---

## Task 8: 전체 검증 + 티켓 체크 + 최종 커밋

**Files:**
- Modify: `docs/tickets.md`

- [ ] **Step 1: 전체 테스트 실행**

Run: `npx vitest run`
Expected: 기존 테스트 전부 + 이번에 추가한 테스트 전부 PASS

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: `docs/tickets.md` 갱신**

`- [ ] **086-admin-payouts-tab**: ...` 줄을 다음으로 교체:

```
- [x] **086-admin-payouts-tab**: 관리자 "정산" 탭 (2026-08-29: Wise 자동 송금은 제외, 시급×완료 수업시간 계산 + 관리자 수기 완료/완료취소 처리로 구현. `teachers.hourly_rate_krw` 신설, 선생님 초대 시 필수 입력으로 변경(`inviteTeacher`), 기존 선생님은 `TeacherDetailPanel`에서 백필. 정산 금액은 `sessions.status='completed'`인 세션들의 `duration_minutes`(Calendly 예약 당시 고정된 값 — 실제 진행 시간과 무관) 합계 × 시급으로 계산(`computePayoutAmounts`). 매달 1일 0시 Vercel Cron(`/api/cron/generate-payouts`, `CRON_SECRET`으로 인증)이 전월분을 전체 선생님에 대해 자동 생성, 관리자가 정산 탭에서 날짜 범위를 지정해 수동 생성도 가능(선생님·기간 조합 중복 시 스킵). `teacher_payouts.status`는 스키마상 3단계(pending/approved/paid)지만 이번 스코프는 pending↔paid 2단계만 사용(수기 송금은 승인 누르는 시점에 이미 끝나 있으므로 approved 불필요). 개별/전체 승인 시 `paid` 전환 + 선생님에게 완료 이메일 발송(기존 073 SMTP 재사용), 완료 취소 시 알림 없이 pending 복귀. 유닛 테스트 다수 신규(계산 함수, 생성/승인/취소 액션, cron 인증, `PayoutsTab` UI), 전체 테스트 통과, tsc 클린.)
```

같은 파일에서 아래 항목도 함께 정리:
- `- [ ] **082-realtime-scratchpad**: ...` — 아직 미착수 상태 유지(이 플랜은 정산/온보딩만 다룸, 손대지 않는다).

파일 아무 곳에나(082 항목 근처) 다음 두 줄을 새로 추가:

```
- [x] **089-referral-code-parent-only**: `/set-password`의 추천인 코드 입력을 학부모 초대일 때만 노출(2026-08-29 — `inviteAndCreateProfile`이 parent 초대에만 `?role=parent` 쿼리를 붙이고, `/set-password`는 그 값이 있을 때만 필드를 렌더링. 비밀번호 재설정 링크에는 role 정보가 없어 항상 숨김)
- [x] **090-teacher-self-onboarding**: 선생님 셀프 Calendly 온보딩(2026-08-29 — 선생님 홈 대시보드에 `status='pending'`일 때 배너 노출, 본인 Calendly 예약 링크를 직접 제출하면 `submitCalendlyOnboarding`이 `calendly_scheduling_url` 저장과 동시에 `status='active'`로 자동 전환, 관리자 별도 승인 불필요)
```

- [ ] **Step 4: 커밋**

```bash
git add docs/tickets.md
git commit -m "docs: 086/089/090 완료 체크"
git push origin main
```
