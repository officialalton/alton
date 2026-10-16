# 관리자 선생님 담당 과목 배정 Implementation Plan

> **문서 상태: 과거 구현 이력·직접 재실행 금지.** 현재 결과를 이해할 때만 참고하고 신규 teacher assignment는 v3 기간 이력 모델을 따른다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 선생님 상세 화면에서 그 선생님이 가르칠 과목(`teacher_curriculum_templates`)을 직접 등록/제거할 수 있게 하고, "담당 과목(등록)"과 "매칭된 학생(수강 중)"을 화면에서 분리해 보여준다.

**Architecture:** 선생님 포털의 `createMyTemplate`(`app/teacher/mysubjects-actions.ts`)과 동일한 패턴(과목 템플릿의 회차를 복사)을 관리자 전용 버전으로 재사용한다. RLS는 이미 "본인 선생님 또는 관리자" 쓰기 정책이 있어 새 마이그레이션 불필요.

## Global Constraints

- 관리자가 과목을 등록하면 그 과목의 `subject_template_units`를 복사해 `teacher_curriculum_template_units`를 만든다(선생님이 스스로 등록할 때와 동일한 동작).
- 관리자가 과목을 제거하려는데 그 선생님-과목 조합으로 이미 활성(`enrollments.status='active'`) 매칭된 학생이 있으면 제거를 막고 "이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요." 에러를 던진다.
- 기존 "담당 과목" 표시(enrollments 기준)는 라벨을 "매칭된 학생 (수강 중)"으로 바꾸되 로직/폴백 문구는 그대로 유지한다.
- 완료 후: 관련 테스트 전체 통과 + `npx tsc --noEmit` 클린 → `docs/tickets.md`(054 근처, 관련 있다면) 반영 → git commit.

---

## Task 1: `users-data.ts` 확장 + `teacher-subjects-actions.ts`

**Files:**
- Modify: `app/admin/users-data.ts`
- Modify: `app/admin/users-data.test.ts` (있다면; 없으면 이 태스크에서 새로 만들지 않는다 — 기존 관례상 이 파일은 컴포넌트 테스트로 간접 커버됨)
- Create: `app/admin/teacher-subjects-actions.ts`
- Create: `app/admin/teacher-subjects-actions.test.ts`

**Interfaces:**
- Produces: `TeacherListItem.assignedSubjectIds: string[]` 필드 추가.
- Produces: `assignTeacherSubject(teacherId: string, subjectId: string): Promise<void>`, `unassignTeacherSubject(teacherId: string, subjectId: string): Promise<void>` — Task 2가 사용.

- [ ] **Step 1: `users-data.ts`에 `assignedSubjectIds` 추가**

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
  assignedSubjectIds: string[];
  calendlySchedulingUrl: string | null;
  hourlyRateKrw: number | null;
};
```

`loadTeachers` 함수 안, `const { data: enrollments } = await supabase.from("enrollments")...` 블록 뒤(`subjectsByTeacher` 계산 다음)에 추가:

```ts
  const { data: templates } = await supabase
    .from("teacher_curriculum_templates")
    .select("teacher_id, subject_id")
    .in("teacher_id", teacherIds);
  const assignedSubjectIdsByTeacher = new Map<string, string[]>();
  for (const t of templates ?? []) {
    const list = assignedSubjectIdsByTeacher.get(t.teacher_id) ?? [];
    list.push(t.subject_id);
    assignedSubjectIdsByTeacher.set(t.teacher_id, list);
  }
```

`return teachers.map((t) => ({...}))`의 반환 객체에 필드 추가:

```ts
    assignedSubjectIds: assignedSubjectIdsByTeacher.get(t.id) ?? [],
```

- [ ] **Step 2: `npx tsc --noEmit`으로 이 파일 자체에 에러 없는지 확인**

Run: `npx tsc --noEmit`
Expected: `app/admin/TeacherDetailPanel.tsx`나 그 테스트에서 `assignedSubjectIds` 관련 에러가 나는 게 정상(Task 2에서 고침). `users-data.ts` 자체 문법 에러는 없어야 한다.

- [ ] **Step 3: `teacher-subjects-actions.ts` 실패하는 테스트 작성**

`app/admin/teacher-subjects-actions.test.ts` 신규 생성:

```ts
import { describe, expect, it, vi } from "vitest";

const insertMock = vi.fn();
const selectUnitsMock = vi.fn();
const insertUnitsMock = vi.fn();
const deleteEqMocks: Record<string, ReturnType<typeof vi.fn>> = {};
const enrollmentsSelectMock = vi.fn();

const mockSupabase = {
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } }) },
  from: vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: { role: "admin" } }) }),
        }),
      };
    }
    if (table === "teacher_curriculum_templates") {
      return {
        insert: insertMock,
        delete: () => ({
          eq: (col: string, val: string) => {
            deleteEqMocks[`${col}:${val}`] = deleteEqMocks[`${col}:${val}`] ?? vi.fn();
            const chain = {
              eq: (col2: string, val2: string) => {
                const key = `${col}:${val}|${col2}:${val2}`;
                deleteEqMocks[key] = deleteEqMocks[key] ?? vi.fn().mockResolvedValue({ error: null });
                return deleteEqMocks[key]();
              },
            };
            return chain;
          },
        }),
      };
    }
    if (table === "subject_template_units") {
      return { select: () => ({ eq: () => ({ order: selectUnitsMock }) }) };
    }
    if (table === "teacher_curriculum_template_units") {
      return { insert: insertUnitsMock };
    }
    if (table === "enrollments") {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ eq: enrollmentsSelectMock }) }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  }),
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { assignTeacherSubject, unassignTeacherSubject } from "./teacher-subjects-actions";

describe("assignTeacherSubject", () => {
  it("과목 템플릿을 만들고 회차를 복사한다", async () => {
    insertMock.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: "tmpl1" }, error: null }) }),
    });
    selectUnitsMock.mockResolvedValue({
      data: [{ position: 1, unit_title: "함수의 기초", note: null }],
    });
    insertUnitsMock.mockResolvedValue({ error: null });

    await assignTeacherSubject("t1", "sub1");

    expect(insertMock).toHaveBeenCalledWith({ teacher_id: "t1", subject_id: "sub1" });
    expect(insertUnitsMock).toHaveBeenCalledWith([
      { template_id: "tmpl1", position: 1, unit_title: "함수의 기초", note: null },
    ]);
  });
});

describe("unassignTeacherSubject", () => {
  it("매칭된 학생이 있으면 제거를 막는다", async () => {
    enrollmentsSelectMock.mockResolvedValue({ data: [{ id: "e1" }] });
    await expect(unassignTeacherSubject("t1", "sub1")).rejects.toThrow(
      "이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요."
    );
  });

  it("매칭된 학생이 없으면 템플릿을 삭제한다", async () => {
    enrollmentsSelectMock.mockResolvedValue({ data: [] });
    await unassignTeacherSubject("t1", "sub1");
    expect(deleteEqMocks["teacher_id:t1|subject_id:sub1"]).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/teacher-subjects-actions.test.ts`
Expected: FAIL — 모듈 `./teacher-subjects-actions`를 찾을 수 없음

- [ ] **Step 5: `teacher-subjects-actions.ts` 작성**

`app/admin/teacher-subjects-actions.ts` 신규 생성:

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

export async function assignTeacherSubject(
  teacherId: string,
  subjectId: string
): Promise<void> {
  const { supabase } = await requireAdmin();

  const { data: template, error } = await supabase
    .from("teacher_curriculum_templates")
    .insert({ teacher_id: teacherId, subject_id: subjectId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: catalogUnits } = await supabase
    .from("subject_template_units")
    .select("position, unit_title, note")
    .eq("subject_id", subjectId)
    .order("position", { ascending: true });

  if (!catalogUnits || catalogUnits.length === 0) return;

  const { error: unitsError } = await supabase
    .from("teacher_curriculum_template_units")
    .insert(
      catalogUnits.map((u) => ({
        template_id: template.id,
        position: u.position,
        unit_title: u.unit_title,
        note: u.note,
      }))
    );
  if (unitsError) throw new Error(unitsError.message);
}

export async function unassignTeacherSubject(
  teacherId: string,
  subjectId: string
): Promise<void> {
  const { supabase } = await requireAdmin();

  const { data: activeEnrollments } = await supabase
    .from("enrollments")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId)
    .eq("status", "active");
  if (activeEnrollments && activeEnrollments.length > 0) {
    throw new Error(
      "이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요."
    );
  }

  const { error } = await supabase
    .from("teacher_curriculum_templates")
    .delete()
    .eq("teacher_id", teacherId)
    .eq("subject_id", subjectId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run app/admin/teacher-subjects-actions.test.ts`
Expected: PASS (전체) — 브리프 테스트의 모킹 체인이 실제 구현의 정확한 호출 순서(`.eq().eq().eq()` 등)와 다르면, 테스트 의도(매칭 있으면 막고, 없으면 삭제)를 유지한 채 모킹 형태만 고쳐서 통과시킨다.

- [ ] **Step 7: 타입체크**

Run: `npx tsc --noEmit`
Expected: `TeacherDetailPanel.tsx` 관련 에러(Task 2에서 고침) 외에 이 태스크에서 건드린 파일 자체는 에러 없어야 한다.

- [ ] **Step 8: 커밋**

```bash
git add app/admin/users-data.ts app/admin/teacher-subjects-actions.ts app/admin/teacher-subjects-actions.test.ts
git commit -m "feat(admin): 선생님 담당 과목 배정/해제 서버 액션 추가"
```

---

## Task 2: `TeacherDetailPanel.tsx` UI + 배선

**Files:**
- Modify: `app/admin/TeacherDetailPanel.tsx`
- Modify: `app/admin/TeacherDetailPanel.test.tsx`
- Modify: `app/admin/UsersTab.tsx`
- Modify: `app/admin/UsersTab.test.tsx`
- Modify: `app/admin/AdminShell.tsx`
- Modify: `app/admin/AdminShell.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `TeacherListItem.assignedSubjectIds`, `assignTeacherSubject`, `unassignTeacherSubject`. `app/admin/subject-data.ts`의 `AdminSubject`(이미 존재).

- [ ] **Step 1: 현재 파일들 읽기**

`app/admin/TeacherDetailPanel.tsx`, `app/admin/TeacherDetailPanel.test.tsx`, `app/admin/UsersTab.tsx`, `app/admin/UsersTab.test.tsx`, `app/admin/AdminShell.tsx`를 전부 읽어 정확한 현재 구조를 파악한다(다른 작업으로 줄 번호가 약간 밀렸을 수 있다).

- [ ] **Step 2: `TeacherDetailPanel.test.tsx`에 실패하는 테스트 추가**

기존 테스트 픽스처(`teacher: TeacherListItem`)에 `assignedSubjectIds: []` 필드를 추가한다(타입 만족용). `describe` 블록에 아래 테스트 추가:

```tsx

  it("담당 과목과 매칭된 학생을 구분해서 보여준다", () => {
    const teacher = { ...baseTeacher, subjectNames: ["SAT Math"], assignedSubjectIds: ["sub1"] };
    render(
      <TeacherDetailPanel
        teacher={teacher}
        warnings={[]}
        subjects={[
          { subjectId: "sub1", subjectName: "SAT Math", units: [] },
          { subjectId: "sub2", subjectName: "AP Biology", units: [] },
        ]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    expect(screen.getByText("담당 과목")).toBeInTheDocument();
    expect(screen.getByText("매칭된 학생 (수강 중)")).toBeInTheDocument();
    expect(screen.getByText("SAT Math")).toBeInTheDocument();
  });

  it("등록 안 된 과목 pill을 누르면 assignTeacherSubject를 호출한다", async () => {
    vi.mocked(teacherSubjectsActions.assignTeacherSubject).mockResolvedValue(undefined);
    const teacher = { ...baseTeacher, assignedSubjectIds: [] };
    render(
      <TeacherDetailPanel
        teacher={teacher}
        warnings={[]}
        subjects={[{ subjectId: "sub1", subjectName: "SAT Math", units: [] }]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("SAT Math"));
    await waitFor(() =>
      expect(teacherSubjectsActions.assignTeacherSubject).toHaveBeenCalledWith(
        teacher.id,
        "sub1"
      )
    );
  });

  it("등록된 과목 pill을 누르면 unassignTeacherSubject를 호출하고, 실패 시 에러를 보여준다", async () => {
    vi.mocked(teacherSubjectsActions.unassignTeacherSubject).mockRejectedValue(
      new Error("이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요.")
    );
    const teacher = { ...baseTeacher, assignedSubjectIds: ["sub1"] };
    render(
      <TeacherDetailPanel
        teacher={teacher}
        warnings={[]}
        subjects={[{ subjectId: "sub1", subjectName: "SAT Math", units: [] }]}
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("SAT Math"));
    await waitFor(() =>
      expect(
        screen.getByText(
          "이 과목으로 매칭된 학생이 있어 담당 과목에서 제거할 수 없습니다. 먼저 매칭을 해제해주세요."
        )
      ).toBeInTheDocument()
    );
  });
```

파일 상단에 mock/import 추가(기존 `vi.mock("./users-actions", ...)` 옆에):

```tsx
import * as teacherSubjectsActions from "./teacher-subjects-actions";

vi.mock("./teacher-subjects-actions", () => ({
  assignTeacherSubject: vi.fn(),
  unassignTeacherSubject: vi.fn(),
}));
```

(`baseTeacher`라는 이름이 기존 테스트 파일의 픽스처 변수명과 다르면, 실제 파일에 있는 기존 teacher 픽스처 변수명을 그대로 쓰고 `assignedSubjectIds: []`만 추가한다.)

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/TeacherDetailPanel.test.tsx`
Expected: FAIL — `subjects` prop이 없어 타입/렌더 에러, "매칭된 학생 (수강 중)" 텍스트 없음

- [ ] **Step 4: `TeacherDetailPanel.tsx` 수정**

상단 import에 추가:

```tsx
import { assignTeacherSubject, unassignTeacherSubject } from "./teacher-subjects-actions";
import type { AdminSubject } from "./subject-data";
```

컴포넌트 props에 추가:

```tsx
export default function TeacherDetailPanel({
  teacher,
  warnings,
  subjects,
  onBack,
  onUpdated,
}: {
  teacher: TeacherListItem;
  warnings: QcWarning[];
  subjects: AdminSubject[];
  onBack: () => void;
  onUpdated: (patch: Partial<TeacherListItem>) => void;
}) {
```

state 선언부에 추가:

```tsx
  const [assignedSubjectIds, setAssignedSubjectIds] = useState(teacher.assignedSubjectIds);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [togglingSubjectId, setTogglingSubjectId] = useState<string | null>(null);
```

핸들러 추가:

```tsx
  async function handleToggleSubject(subjectId: string) {
    if (togglingSubjectId) return;
    setSubjectError(null);
    setTogglingSubjectId(subjectId);
    try {
      if (assignedSubjectIds.includes(subjectId)) {
        await unassignTeacherSubject(teacher.id, subjectId);
        const next = assignedSubjectIds.filter((id) => id !== subjectId);
        setAssignedSubjectIds(next);
        onUpdated({ assignedSubjectIds: next });
      } else {
        await assignTeacherSubject(teacher.id, subjectId);
        const next = [...assignedSubjectIds, subjectId];
        setAssignedSubjectIds(next);
        onUpdated({ assignedSubjectIds: next });
      }
    } catch (e) {
      setSubjectError(e instanceof Error ? e.message : "과목 배정 처리에 실패했습니다.");
    } finally {
      setTogglingSubjectId(null);
    }
  }
```

`담당 과목` 박스(`<div className="border-[1.5px] ...">...담당 과목...</div>`)를 아래로 교체:

```tsx
      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          담당 과목
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {subjects.map((s) => {
            const assigned = assignedSubjectIds.includes(s.subjectId);
            return (
              <button
                key={s.subjectId}
                disabled={togglingSubjectId === s.subjectId}
                onClick={() => handleToggleSubject(s.subjectId)}
                className={
                  "text-[12.5px] font-semibold px-3 py-1.5 rounded-full border-[1.5px] disabled:opacity-50 " +
                  (assigned ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
                }
              >
                {s.subjectName}
              </button>
            );
          })}
        </div>
        {subjectError && <p className="text-[12px] text-red">{subjectError}</p>}
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          매칭된 학생 (수강 중)
        </div>
        <p className="text-[13px] text-ink">
          {teacher.subjectNames.length ? teacher.subjectNames.join(", ") : "매칭된 학생 없음"}
        </p>
      </div>
```

- [ ] **Step 5: `TeacherDetailPanel.tsx` 테스트 통과 확인**

Run: `npx vitest run app/admin/TeacherDetailPanel.test.tsx`
Expected: PASS (전체)

- [ ] **Step 6: `UsersTab.tsx`/`UsersTab.test.tsx`에 `subjects` prop 배선**

`app/admin/UsersTab.tsx` props 타입에 추가:

```tsx
  subjects: AdminSubject[];
```

(상단 import에 `import type { AdminSubject } from "./subject-data";` 추가)

`<TeacherDetailPanel teacher={openTeacher} warnings={...} onBack={...} onUpdated={...} />` 호출에 prop 추가:

```tsx
        subjects={subjects}
```

`UsersTab.test.tsx`의 기존 render 호출들에 `subjects={[]}` prop을 추가한다(타입 만족용 — 이 파일의 기존 테스트들은 `TeacherDetailPanel` 상세 동작을 직접 검증하지 않으므로 빈 배열이면 충분하다).

- [ ] **Step 7: `AdminShell.tsx`/`AdminShell.test.tsx`에 `subjects` 배선**

`<UsersTab initialParents={parents} initialStudents={students} initialTeachers={teachers} creditHistoryByStudent={...} qcWarningsByTeacher={...} />` 호출에 prop 추가:

```tsx
              subjects={subjects}
```

(`AdminShell`은 이미 `subjects` prop을 갖고 있으므로 새로 추가할 필요 없이 그대로 전달만 하면 된다.)

- [ ] **Step 8: 전체 관련 테스트 + 타입체크**

Run: `npx vitest run app/admin/ && npx tsc --noEmit`
Expected: 전부 PASS, 에러 없음

- [ ] **Step 9: `docs/tickets.md` 반영**

`054-admin-users-billing` 항목 아래에 서브 항목 추가:

```markdown
  - [x] 관리자가 선생님 상세 화면에서 담당 과목(teacher_curriculum_templates)을 직접 등록/제거할 수 있게 하고, "담당 과목(등록)"과 "매칭된 학생(수강 중, enrollments 기준)"을 화면에서 분리 (2026-08-29)
```

- [ ] **Step 10: 커밋**

```bash
git add app/admin/TeacherDetailPanel.tsx app/admin/TeacherDetailPanel.test.tsx app/admin/UsersTab.tsx app/admin/UsersTab.test.tsx app/admin/AdminShell.tsx app/admin/AdminShell.test.tsx docs/tickets.md
git commit -m "feat(admin): 선생님 담당 과목 배정 UI + 배선 완료"
```

---

## 전체 완료 확인

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npx vitest run`
Expected: 전부 PASS

- [ ] **Step 2: 전체 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 3: 브라우저 수동 스모크 확인**

관리자 계정으로 로그인 → 사용자 → 선생님 탭 → 아무 선생님 상세 진입 → "담당 과목"에서 과목 pill 클릭해 등록 → 새로고침 후에도 유지되는지 확인 → 이 과목으로 매칭 탭에서 학생을 매칭 → 다시 선생님 상세로 돌아와 그 과목 제거 시도 → 에러 메시지로 막히는지 확인.
