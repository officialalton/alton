# 관리자 매칭 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 포털 "매칭" 탭(083 티켓)을 인앱으로 구현한다 — Airtable 대신, 매칭 대기(`students.status = 'pending'`) 학생을 과목별로 그 과목을 가르치는 선생님과 매칭(`enrollments` 생성)하고 학생 상태를 `active`로 바꾼다.

**Architecture:** 051(과목 템플릿)/054(사용자 관리)와 동일한 관리자 CRUD 패턴(`requireAdmin` 서버 액션 가드, pill 버튼 선택 UI)을 재사용한다. `page.tsx`가 이미 로드해둔 `students`/`subjects`를 그대로 재사용하고, 신규 로더는 "과목별로 그 과목을 가르치는 선생님 후보" 하나만 추가한다.

## Global Constraints

- 매칭 대상은 `students.status = 'pending'`인 학생만 다룬다(이미 매칭된 학생에게 두 번째 과목 추가는 스코프 밖).
- 선생님 후보는 `teacher_curriculum_templates`에 해당 과목을 등록해둔 `status = 'active'` 선생님만.
- 총 회차 수(`enrollments.total_sessions`)는 관리자가 직접 입력(1 이상 필수), 자동 계산 소스 없음.
- 매칭 확정 시 `enrollments` insert + `students.status = 'active'` update를 한 서버 액션 안에서 순차 실행.
- `(student_id, teacher_id, subject_id)` 활성 매칭 중복은 이미 있는 부분 unique 인덱스(`enrollments_active_unique`)가 막는다 — 이 제약 위반(Postgres 코드 `23505`)을 "이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다." 안내로 변환한다.
- 새 마이그레이션 불필요 — `enrollments`(관리자 insert), `students`(관리자 update) RLS 정책은 최초 스키마부터 이미 존재함(`supabase/migrations/20260827120001_rls_policies.sql:90-91,180`).
- 완료 후: 관련 테스트 전체 통과 + `npx tsc --noEmit` 클린 → `docs/tickets.md`의 083 반영 → git commit.

---

## Task 1: `matching-data.ts` + `matching-actions.ts`

**Files:**
- Create: `app/admin/matching-data.ts`
- Create: `app/admin/matching-data.test.ts`
- Create: `app/admin/matching-actions.ts`
- Create: `app/admin/matching-actions.test.ts`

**Interfaces:**
- Produces: `MatchingTeacherCandidate = { id: string; name: string }`, `loadTeacherCandidatesBySubject(supabase): Promise<Record<string, MatchingTeacherCandidate[]>>` — 과목 id를 key로, 그 과목을 가르치는 active 선생님 목록을 value로 담은 맵. Task 2가 사용.
- Produces: `confirmMatch(studentId: string, teacherId: string, subjectId: string, totalSessions: number): Promise<void>` — Task 2가 사용.

- [ ] **Step 1: `matching-data.ts` 실패하는 테스트 작성**

`app/admin/matching-data.test.ts` 신규 생성:

```ts
import { describe, expect, it } from "vitest";
import { loadTeacherCandidatesBySubject } from "./matching-data";

function makeSupabaseMock(links: unknown[]) {
  return {
    from: () => ({
      select: () => Promise.resolve({ data: links }),
    }),
  } as never;
}

describe("loadTeacherCandidatesBySubject", () => {
  it("과목별로 active 선생님만 후보로 묶는다", async () => {
    const supabase = makeSupabaseMock([
      {
        subject_id: "sub1",
        teacher: { id: "t1", status: "active", profile: { name: "김선생" } },
      },
      {
        subject_id: "sub1",
        teacher: { id: "t2", status: "pending", profile: { name: "이선생" } },
      },
      {
        subject_id: "sub2",
        teacher: { id: "t1", status: "active", profile: { name: "김선생" } },
      },
    ]);
    const result = await loadTeacherCandidatesBySubject(supabase);
    expect(result["sub1"]).toEqual([{ id: "t1", name: "김선생" }]);
    expect(result["sub2"]).toEqual([{ id: "t1", name: "김선생" }]);
  });

  it("링크가 없으면 빈 객체를 반환한다", async () => {
    const supabase = makeSupabaseMock([]);
    const result = await loadTeacherCandidatesBySubject(supabase);
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/matching-data.test.ts`
Expected: FAIL — 모듈 `./matching-data`를 찾을 수 없음

- [ ] **Step 3: `matching-data.ts` 작성**

`app/admin/matching-data.ts` 신규 생성:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type MatchingTeacherCandidate = {
  id: string;
  name: string;
};

function extractOne<T>(rel: unknown): T | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as T | undefined) ?? null;
}

export async function loadTeacherCandidatesBySubject(
  supabase: SupabaseClient
): Promise<Record<string, MatchingTeacherCandidate[]>> {
  const { data: links } = await supabase
    .from("teacher_curriculum_templates")
    .select("subject_id, teacher:teachers(id, status, profile:profiles(name))");

  const bySubject: Record<string, MatchingTeacherCandidate[]> = {};
  for (const l of (links ?? []) as {
    subject_id: string;
    teacher: unknown;
  }[]) {
    const teacher = extractOne<{
      id: string;
      status: string;
      profile: unknown;
    }>(l.teacher);
    if (!teacher || teacher.status !== "active") continue;
    const profile = extractOne<{ name?: string }>(teacher.profile);

    const list = bySubject[l.subject_id] ?? [];
    if (!list.some((c) => c.id === teacher.id)) {
      list.push({ id: teacher.id, name: profile?.name ?? "" });
    }
    bySubject[l.subject_id] = list;
  }
  return bySubject;
}
```

- [ ] **Step 4: `matching-data.ts` 테스트 통과 확인**

Run: `npx vitest run app/admin/matching-data.test.ts`
Expected: PASS

- [ ] **Step 5: `matching-actions.ts` 실패하는 테스트 작성**

`app/admin/matching-actions.test.ts` 신규 생성:

```ts
import { describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const updateEqMock = vi.fn();
const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } }) },
  from: vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { role: "admin" } }),
          }),
        }),
      };
    }
    if (table === "enrollments") {
      return { insert: insertMock };
    }
    if (table === "students") {
      return { update: () => ({ eq: updateEqMock }) };
    }
    throw new Error(`unexpected table ${table}`);
  }),
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { confirmMatch } from "./matching-actions";

describe("confirmMatch", () => {
  it("총 회차 수가 1 미만이면 서버 호출 없이 에러를 던진다", async () => {
    await expect(confirmMatch("s1", "t1", "sub1", 0)).rejects.toThrow(
      "총 회차 수는 1 이상이어야 합니다."
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("정상 매칭 시 enrollments를 만들고 학생 상태를 active로 바꾼다", async () => {
    insertMock.mockResolvedValue({ error: null });
    updateEqMock.mockResolvedValue({ error: null });
    await confirmMatch("s1", "t1", "sub1", 20);
    expect(insertMock).toHaveBeenCalledWith({
      student_id: "s1",
      teacher_id: "t1",
      subject_id: "sub1",
      status: "active",
      total_sessions: 20,
      current_session: 1,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", "s1");
  });

  it("중복 매칭(unique 제약 위반)이면 친화적 에러로 변환한다", async () => {
    insertMock.mockResolvedValue({ error: { code: "23505", message: "duplicate" } });
    await expect(confirmMatch("s1", "t1", "sub1", 20)).rejects.toThrow(
      "이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다."
    );
    expect(updateEqMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/matching-actions.test.ts`
Expected: FAIL — 모듈 `./matching-actions`를 찾을 수 없음

- [ ] **Step 7: `matching-actions.ts` 작성**

`app/admin/matching-actions.ts` 신규 생성:

```ts
"use server";

import { createClient } from "@/utils/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("관리자만 사용할 수 있습니다.");
  return { supabase };
}

export async function confirmMatch(
  studentId: string,
  teacherId: string,
  subjectId: string,
  totalSessions: number
): Promise<void> {
  if (!Number.isFinite(totalSessions) || totalSessions < 1) {
    throw new Error("총 회차 수는 1 이상이어야 합니다.");
  }

  const { supabase } = await requireAdmin();

  const { error: insertError } = await supabase.from("enrollments").insert({
    student_id: studentId,
    teacher_id: teacherId,
    subject_id: subjectId,
    status: "active",
    total_sessions: totalSessions,
    current_session: 1,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다.");
    }
    throw new Error(insertError.message);
  }

  const { error: updateError } = await supabase
    .from("students")
    .update({ status: "active" })
    .eq("id", studentId);
  if (updateError) throw new Error(updateError.message);
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npx vitest run app/admin/matching-actions.test.ts`
Expected: PASS

- [ ] **Step 9: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음(이 태스크에서 건드린 4개 파일은 다른 무엇에도 아직 소비되지 않으므로 완전히 클린해야 한다)

- [ ] **Step 10: 커밋**

```bash
git add app/admin/matching-data.ts app/admin/matching-data.test.ts app/admin/matching-actions.ts app/admin/matching-actions.test.ts
git commit -m "feat(admin): 매칭 데이터 로더 + confirmMatch 서버 액션 추가"
```

---

## Task 2: `MatchingTab.tsx` + 관리자 셸 배선

**Files:**
- Create: `app/admin/MatchingTab.tsx`
- Create: `app/admin/MatchingTab.test.tsx`
- Modify: `app/admin/AdminShell.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: Task 1의 `MatchingTeacherCandidate`, `loadTeacherCandidatesBySubject`, `confirmMatch`. `app/admin/users-data.ts`의 `StudentListItem`(이미 존재, `page.tsx`가 이미 로드해둔 `students` prop을 그대로 재사용). `app/admin/subject-data.ts`의 `AdminSubject`(이미 존재, `page.tsx`가 이미 로드해둔 `subjects` prop을 그대로 재사용).
- Produces: `MatchingTab` 컴포넌트 — `AdminShell.tsx`가 "매칭" 탭 자리에 배치.

- [ ] **Step 1: `MatchingTab.tsx` 실패하는 테스트 작성**

`app/admin/MatchingTab.test.tsx` 신규 생성:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MatchingTab from "./MatchingTab";
import * as matchingActions from "./matching-actions";
import type { StudentListItem } from "./users-data";
import type { AdminSubject } from "./subject-data";

vi.mock("./matching-actions", () => ({
  confirmMatch: vi.fn(),
}));

const pendingStudent: StudentListItem = {
  id: "st1",
  name: "박준서",
  email: "junseo@example.com",
  grade: "11학년",
  status: "pending",
  creditBalance: 0,
  parentNames: ["박부모"],
  subjectNames: [],
};

const activeStudent: StudentListItem = {
  ...pendingStudent,
  id: "st2",
  name: "이미매칭",
  status: "active",
};

const subjects: AdminSubject[] = [
  { subjectId: "sub1", subjectName: "SAT Math", units: [] },
  { subjectId: "sub2", subjectName: "AP Biology", units: [] },
];

const teacherCandidatesBySubject = {
  sub1: [{ id: "t1", name: "김선생" }],
};

describe("MatchingTab", () => {
  it("매칭 대기(pending) 학생만 목록에 보여준다", () => {
    render(
      <MatchingTab
        students={[pendingStudent, activeStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    expect(screen.getByText("박준서")).toBeInTheDocument();
    expect(screen.queryByText("이미매칭")).not.toBeInTheDocument();
  });

  it("매칭 대기 학생이 없으면 안내 문구를 보여준다", () => {
    render(
      <MatchingTab
        students={[activeStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument();
  });

  it("과목 선택 시 그 과목의 선생님 후보만 보여주고, 후보가 없으면 안내한다", () => {
    render(
      <MatchingTab
        students={[pendingStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    fireEvent.click(screen.getByText("매칭하기"));
    fireEvent.click(screen.getByText("SAT Math"));
    expect(screen.getByText("김선생")).toBeInTheDocument();

    fireEvent.click(screen.getByText("AP Biology"));
    expect(
      screen.getByText("이 과목을 가르치는 선생님이 없습니다. 먼저 선생님의 담당 과목을 등록해주세요.")
    ).toBeInTheDocument();
  });

  it("과목/선생님/회차 수를 골라 매칭 확정하면 confirmMatch를 호출하고 목록에서 사라진다", async () => {
    vi.mocked(matchingActions.confirmMatch).mockResolvedValue(undefined);
    render(
      <MatchingTab
        students={[pendingStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    fireEvent.click(screen.getByText("매칭하기"));
    fireEvent.click(screen.getByText("SAT Math"));
    fireEvent.click(screen.getByText("김선생"));
    fireEvent.change(screen.getByPlaceholderText("예: 20"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("매칭 확정"));

    await waitFor(() =>
      expect(matchingActions.confirmMatch).toHaveBeenCalledWith("st1", "t1", "sub1", 20)
    );
    await waitFor(() =>
      expect(screen.getByText("매칭 대기 중인 학생이 없습니다.")).toBeInTheDocument()
    );
  });

  it("매칭 확정 실패 시 에러 메시지를 보여준다", async () => {
    vi.mocked(matchingActions.confirmMatch).mockRejectedValue(
      new Error("이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다.")
    );
    render(
      <MatchingTab
        students={[pendingStudent]}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
      />
    );
    fireEvent.click(screen.getByText("매칭하기"));
    fireEvent.click(screen.getByText("SAT Math"));
    fireEvent.click(screen.getByText("김선생"));
    fireEvent.change(screen.getByPlaceholderText("예: 20"), { target: { value: "20" } });
    fireEvent.click(screen.getByText("매칭 확정"));

    await waitFor(() =>
      expect(
        screen.getByText("이미 이 학생-선생님-과목 조합으로 매칭되어 있습니다.")
      ).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/MatchingTab.test.tsx`
Expected: FAIL — 모듈 `./MatchingTab`을 찾을 수 없음

- [ ] **Step 3: `MatchingTab.tsx` 작성**

`app/admin/MatchingTab.tsx` 신규 생성:

```tsx
"use client";

import { useState } from "react";
import { confirmMatch } from "./matching-actions";
import type { MatchingTeacherCandidate } from "./matching-data";
import type { StudentListItem } from "./users-data";
import type { AdminSubject } from "./subject-data";

export default function MatchingTab({
  students,
  subjects,
  teacherCandidatesBySubject,
}: {
  students: StudentListItem[];
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
}) {
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const pending = students.filter(
    (s) => s.status === "pending" && !matchedIds.includes(s.id)
  );
  const open = pending.find((s) => s.id === openStudentId);

  if (open) {
    return (
      <MatchForm
        student={open}
        subjects={subjects}
        teacherCandidatesBySubject={teacherCandidatesBySubject}
        onBack={() => setOpenStudentId(null)}
        onMatched={() => {
          setMatchedIds((prev) => [...prev, open.id]);
          setOpenStudentId(null);
        }}
      />
    );
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">매칭</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        매칭 대기 중인 학생을 과목별로 선생님과 연결합니다.
      </p>

      {pending.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">
          매칭 대기 중인 학생이 없습니다.
        </div>
      ) : (
        pending.map((s) => (
          <div
            key={s.id}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5 flex items-center justify-between"
          >
            <div>
              <div className="text-[13.5px] font-bold text-ink">{s.name}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                {s.grade ?? "학년 미입력"}
                {s.parentNames.length > 0 ? ` · 보호자 ${s.parentNames.join(", ")}` : ""}
              </div>
            </div>
            <button
              onClick={() => setOpenStudentId(s.id)}
              className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 text-ink shrink-0"
            >
              매칭하기
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function MatchForm({
  student,
  subjects,
  teacherCandidatesBySubject,
  onBack,
  onMatched,
}: {
  student: StudentListItem;
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
  onBack: () => void;
  onMatched: () => void;
}) {
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = subjectId ? teacherCandidatesBySubject[subjectId] ?? [] : [];
  const sessionsNumber = Number(totalSessions);
  const canSubmit =
    !!subjectId && !!teacherId && Number.isFinite(sessionsNumber) && sessionsNumber >= 1;

  async function handleConfirm() {
    if (!subjectId || !teacherId || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await confirmMatch(student.id, teacherId, subjectId, sessionsNumber);
      onMatched();
    } catch (e) {
      setError(e instanceof Error ? e.message : "매칭에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-5">{student.name} 매칭</h1>

      <div className="mb-4">
        <label className="text-[12.5px] font-bold text-ink mb-1.5 block">과목</label>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.subjectId}
              onClick={() => {
                setSubjectId(s.subjectId);
                setTeacherId(null);
              }}
              className={
                "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] " +
                (subjectId === s.subjectId
                  ? "bg-ink text-white border-ink"
                  : "border-grey-200 text-ink")
              }
            >
              {s.subjectName}
            </button>
          ))}
        </div>
      </div>

      {subjectId && (
        <div className="mb-4">
          <label className="text-[12.5px] font-bold text-ink mb-1.5 block">선생님</label>
          {candidates.length === 0 ? (
            <p className="text-[12.5px] text-grey-500">
              이 과목을 가르치는 선생님이 없습니다. 먼저 선생님의 담당 과목을 등록해주세요.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setTeacherId(c.id)}
                  className={
                    "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] " +
                    (teacherId === c.id
                      ? "bg-ink text-white border-ink"
                      : "border-grey-200 text-ink")
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <label className="text-[12.5px] font-bold text-ink mb-1.5 block">총 회차 수</label>
        <input
          type="number"
          min={1}
          value={totalSessions}
          onChange={(e) => setTotalSessions(e.target.value)}
          placeholder="예: 20"
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
      </div>

      {error && <p className="text-[13px] text-red mb-4">{error}</p>}

      <button
        disabled={!canSubmit || submitting}
        onClick={handleConfirm}
        className="text-[13px] font-bold px-4 py-2.5 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {submitting ? "매칭 중..." : "매칭 확정"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: `MatchingTab.tsx` 테스트 통과 확인**

Run: `npx vitest run app/admin/MatchingTab.test.tsx`
Expected: PASS (전체)

- [ ] **Step 5: `page.tsx`에 신규 로더 배선**

`app/admin/page.tsx` 상단 import에 추가:

```tsx
import { loadTeacherCandidatesBySubject } from "./matching-data";
```

`const payouts = await loadPayouts(supabase);` 바로 뒤에 추가:

```tsx
  const teacherCandidatesBySubject = await loadTeacherCandidatesBySubject(supabase);
```

`<AdminShell ... payouts={payouts}` 뒤에 prop 추가:

```tsx
      teacherCandidatesBySubject={teacherCandidatesBySubject}
```

- [ ] **Step 6: `AdminShell.tsx`에 "매칭" 탭 배선**

`app/admin/AdminShell.tsx` 상단 import에 추가:

```tsx
import MatchingTab from "./MatchingTab";
import type { MatchingTeacherCandidate } from "./matching-data";
```

컴포넌트 props 목록(`payouts,` 뒤)에 추가:

```tsx
  teacherCandidatesBySubject,
```

props 타입(`payouts: PayoutListItem[];` 뒤)에 추가:

```tsx
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
```

`activeTab === "payouts" ? ( <PayoutsTab initialPayouts={payouts} /> ) :` 바로 뒤, `(` 준비중 placeholder 앞에 추가:

```tsx
          ) : activeTab === "matching" ? (
            <MatchingTab
              students={students}
              subjects={subjects}
              teacherCandidatesBySubject={teacherCandidatesBySubject}
            />
```

- [ ] **Step 7: 전체 관련 테스트 + 타입체크**

Run: `npx vitest run app/admin/ && npx tsc --noEmit`
Expected: 전부 PASS, 에러 없음

- [ ] **Step 8: `docs/tickets.md`에 083 반영**

`docs/tickets.md`에서 `083-admin-matching` 항목을 찾아 `[ ]`를 `[x]`로 바꾸고, 다른 완료 티켓과 같은 형식으로 요약을 덧붙인다:

```markdown
- [x] **083-admin-matching**: 관리자 "매칭" 탭 (Airtable 대신 인앱 구현 결정. `students.status='pending'` 학생을 과목별로 `teacher_curriculum_templates`에 그 과목을 등록한 active 선생님과 매칭 — `enrollments` 생성 + 학생 상태를 `active`로 전환. 총 회차 수는 관리자가 직접 입력(계약 데이터에 회차 정보가 없음). 새 마이그레이션 불필요(기존 RLS로 충분). 2026-08-29)
```

- [ ] **Step 9: 커밋**

```bash
git add app/admin/MatchingTab.tsx app/admin/MatchingTab.test.tsx app/admin/AdminShell.tsx app/admin/page.tsx docs/tickets.md
git commit -m "feat(admin): 매칭 탭 UI + 배선 완료"
```

---

## 전체 완료 확인

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npx vitest run`
Expected: 전부 PASS, 실패 0건

- [ ] **Step 2: 전체 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 3: 브라우저 수동 스모크 확인 (로컬 Supabase/`npm run dev` 구동 중일 때)**

관리자 계정으로 로그인 → 매칭 탭 → 매칭 대기 학생 클릭 → 과목 선택 → 그 과목의 선생님 후보만 보이는지 확인 → 후보 없는 과목 선택 시 안내 문구 확인 → 회차 수 입력 후 매칭 확정 → 목록에서 사라지는지, `enrollments`/`students.status`가 실제로 반영되는지 확인.
