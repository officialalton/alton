# 교재 문서 편집기 업그레이드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교재 문서 편집기(`app/admin/CurriculumDocEditor.tsx` 등)에 섹션 타입 구분(개념 설명/문제 생성), 문제 포맷별(객관식 5지선다/서술형/수학 화이트보드형) 전용 저작 UI, 리치텍스트 표 삽입, 문서 삭제 기능을 추가한다.

**Architecture:** 기존 052 티켓의 서버 액션(`curriculum-doc-actions.ts`) + 클라이언트 상태 패턴을 그대로 확장한다. 문제 포맷별 입력 필드는 `CurriculumDocEditor.tsx`가 비대해지는 것을 막기 위해 새 파일 `ProblemDraftFields.tsx`로 분리한다. 문서 삭제는 `SubjectTemplateTab.tsx`의 `SubjectDetailEditor` 2단계 확인 패턴을 그대로 재사용한다.

**Tech Stack:** Next.js Server Actions, Supabase(Postgres, RLS), `sanitize-html`, Vitest + Testing Library.

## Global Constraints

- 섹션 타입(`section_type`)은 생성 시 한 번만 선택하며 이후 변경 불가 — 타입 전환 UI를 만들지 않는다.
- 문서 삭제는 2단계 확인(정말 삭제하시겠습니까? → 삭제/취소)을 거치며, `status === 'published'`인 문서는 삭제할 수 없다(배포 취소 후에만 가능) — 서버 액션과 UI 양쪽에서 검증한다.
- 저장은 기존처럼 필드별 `onBlur` 자동저장을 그대로 유지한다 — 별도 "임시저장" 버튼을 추가하지 않는다.
- 객관식(mc) 문제는 선택지가 정확히 5개여야 한다(기존 AI 생성 프롬프트는 4개를 요청하고 있었음 — 5개로 변경).
- 수학 화이트보드형(math) 문제는 저작 화면에서 화이트보드 자체를 편집하지 않는다 — "학생은 세션뷰의 화이트보드에서 직접 풀이를 작성합니다" 안내 문구만 고정 표시하고, LaTeX는 완전한 렌더링 없이 텍스트 스니펫 삽입 버튼(위첨자/분수/근호)만 제공한다.
- 서술형(essay) 문제의 "모범답안"은 `problems.explanation` 컬럼을 그대로 사용한다 — 스키마에 별도 컬럼을 추가하지 않는다(UI 라벨만 "모범답안"으로 다르게 보여준다).
- 이미지 업로드는 이번 스코프에서 제외한다(코드베이스에 기존 스토리지 업로드 유틸이 없음을 확인함 — `app/`, `lib/` 어디에도 `storage.from/upload` 호출 없음).
- 완료 후: 관련 테스트 전체 통과 + `npx tsc --noEmit` 클린 → `docs/tickets.md`에 항목 반영 → git commit.

---

## Task 1: `curriculum_doc_sections.section_type` 컬럼 + `curriculum_docs` 삭제 RLS 정책

**Files:**
- Create: `supabase/migrations/20260829070000_curriculum_doc_section_type.sql`

**Interfaces:**
- Produces: `curriculum_doc_sections.section_type` 컬럼(`text`, `check (section_type in ('concept', 'problem'))`, `not null default 'concept'`) — Task 2의 `curriculum-doc-data.ts`, Task 3의 `curriculum-doc-actions.ts`가 사용.
- Produces: `curriculum_docs` 테이블에 관리자 전용 `delete` RLS 정책 — Task 3의 `deleteCurriculumDoc`이 사용.

이 테이블은 기존 데이터가 있을 수 있으므로(052 티켓으로 이미 배포됨), `not null default 'concept'`로 추가하면 기존 행은 전부 `concept`으로 자동 백필된다. 별도 backfill UPDATE 문은 필요 없다.

`curriculum_docs`에는 현재 `select`/`insert`/`update` RLS 정책만 있고 `delete` 정책이 없다(RLS 기본값=거부이므로 지금은 그 누구도 못 지운다). `problems` 테이블에 이미 있는 관리자 전용 삭제 정책(`supabase/migrations/20260829040000_problems_admin_delete.sql`)과 같은 패턴으로 추가한다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 교재 문서 편집기 업그레이드: 섹션을 "개념 설명"과 "문제 생성"으로 구분하고,
-- 관리자가 교재 문서 자체를 삭제할 수 있게 한다.

alter table curriculum_doc_sections
  add column section_type text not null default 'concept'
    check (section_type in ('concept', 'problem'));

create policy "관리자 삭제" on curriculum_docs for delete using (is_admin());
```

- [ ] **Step 2: 로컬 Supabase에 적용**

Run: `npx supabase migration up`
Expected: `Applying migration 20260829070000_curriculum_doc_section_type.sql...` 로그 출력, 에러 없음

- [ ] **Step 3: 컬럼/정책이 실제로 생성됐는지 확인**

Run: `npx supabase db diff --schema public 2>&1 | head -5`
Expected: 로컬 스키마와 마이그레이션 파일 사이에 diff 없음(즉, 마이그레이션이 스키마를 완전히 반영함) — 또는 빈 출력.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260829070000_curriculum_doc_section_type.sql
git commit -m "feat(db): 교재 섹션 타입 컬럼 + 교재 문서 삭제 RLS 정책 추가"
```

---

## Task 2: `DocSection.sectionType` 필드 + 로드 쿼리 반영

**Files:**
- Modify: `app/admin/curriculum-doc-data.ts:13-20` (`DocSection` 타입), `:55-98` (`loadAllCurriculumDocs`)
- Test: `app/admin/curriculum-doc-data.test.ts` (신규 파일)

**Interfaces:**
- Consumes: Task 1의 `curriculum_doc_sections.section_type` 컬럼.
- Produces: `DocSection.sectionType: "concept" | "problem"` — Task 3(`addSection` 반환값), Task 4(`CurriculumDocEditor.tsx` 렌더링 분기)가 사용.

기존에 이 데이터 레이어를 직접 테스트하는 파일이 없다(로직이 단순한 매핑이라 `CurriculumDocEditor.test.tsx`로 간접 커버됨). 이번엔 컬럼 매핑이 실제로 되는지 최소 단위 테스트를 하나 추가한다 — Supabase 클라이언트를 모킹한다.

- [ ] **Step 1: 실패하는 테스트 추가**

`app/admin/curriculum-doc-data.test.ts` 신규 생성:

```ts
import { describe, expect, it, vi } from "vitest";
import { loadAllCurriculumDocs } from "./curriculum-doc-data";

function makeSupabaseMock() {
  const tables: Record<string, unknown[]> = {
    curriculum_docs: [
      {
        id: "doc1",
        title: "이차방정식",
        status: "draft",
        subject_id: "sub1",
        unit_id: null,
        subject: { name: "SAT Math" },
        unit: null,
      },
    ],
    curriculum_doc_sections: [
      {
        id: "sec1",
        curriculum_doc_id: "doc1",
        position: 1,
        title: "개념",
        body: "<p>본문</p>",
        teaching_tip: null,
        section_type: "problem",
      },
    ],
    problems: [],
  };

  return {
    from: (table: string) => {
      const rows = tables[table] ?? [];
      const builder = {
        select: () => builder,
        order: () => Promise.resolve({ data: rows }),
        in: () => Promise.resolve({ data: rows }),
      };
      return builder;
    },
  } as never;
}

describe("loadAllCurriculumDocs", () => {
  it("section_type을 sectionType으로 매핑한다", async () => {
    const docs = await loadAllCurriculumDocs(makeSupabaseMock());
    expect(docs[0].sections[0].sectionType).toBe("problem");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/curriculum-doc-data.test.ts`
Expected: FAIL — `sectionType` is `undefined` (또는 타입 에러: `Property 'sectionType' does not exist`)

- [ ] **Step 3: `DocSection` 타입에 필드 추가**

`app/admin/curriculum-doc-data.ts:13-20`을 다음으로 교체:

```ts
export type DocSection = {
  id: string;
  position: number;
  title: string;
  body: string;
  teachingTip: string | null;
  sectionType: "concept" | "problem";
  problems: DocProblem[];
};
```

- [ ] **Step 4: 쿼리와 매핑에 컬럼 반영**

`app/admin/curriculum-doc-data.ts:55-59`의 `sections` select 문을 교체:

```ts
  const { data: sections } = await supabase
    .from("curriculum_doc_sections")
    .select("id, curriculum_doc_id, position, title, body, teaching_tip, section_type")
    .in("curriculum_doc_id", docIds)
    .order("position", { ascending: true });
```

`app/admin/curriculum-doc-data.ts:86-98`의 매핑 루프를 교체:

```ts
  const sectionsByDoc = new Map<string, DocSection[]>();
  for (const s of sections ?? []) {
    const list = sectionsByDoc.get(s.curriculum_doc_id) ?? [];
    list.push({
      id: s.id,
      position: s.position,
      title: s.title,
      body: s.body ?? "",
      teachingTip: s.teaching_tip,
      sectionType: s.section_type,
      problems: problemsBySection.get(s.id) ?? [],
    });
    sectionsByDoc.set(s.curriculum_doc_id, list);
  }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run app/admin/curriculum-doc-data.test.ts`
Expected: PASS

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit`
Expected: `CurriculumDocEditor.tsx`, `CurriculumDocEditor.test.tsx`, `CurriculumDocsTab.test.tsx`에서 `sectionType` 누락으로 인한 에러가 나는 게 정상(Task 4/5에서 고침). 이 태스크에서 새로 건드린 두 파일(`curriculum-doc-data.ts`, `curriculum-doc-data.test.ts`) 자체에는 에러가 없어야 한다.

- [ ] **Step 7: 커밋**

```bash
git add app/admin/curriculum-doc-data.ts app/admin/curriculum-doc-data.test.ts
git commit -m "feat(admin): DocSection에 sectionType 필드 추가"
```

---

## Task 3: `addSection` 시그니처 변경 + `deleteCurriculumDoc` + 객관식 5지선다 프롬프트 수정

**Files:**
- Modify: `app/admin/curriculum-doc-actions.ts:66-85` (`addSection`), `:139-235` (`generateSectionProblems`)
- Modify: `app/admin/curriculum-doc-actions.ts` (파일 하단에 `deleteCurriculumDoc` 추가)
- Test: `app/admin/curriculum-doc-actions.test.ts` (신규 파일)

**Interfaces:**
- Consumes: Task 1의 `section_type` 컬럼과 `curriculum_docs` delete RLS 정책, Task 2의 `DocSection.sectionType`.
- Produces: `addSection(docId: string, nextPosition: number, sectionType: "concept" | "problem"): Promise<DocSection>` — Task 4가 사용.
- Produces: `deleteCurriculumDoc(docId: string): Promise<void>` — 이미 `published`면 `Error("배포된 교재는 삭제할 수 없습니다. 먼저 배포를 취소하세요.")`를 throw. Task 7이 사용.
- Produces: `generateSectionProblems`가 `format: "mc"`일 때 정확히 5개 선택지를 요청하도록 프롬프트 수정(반환 타입/시그니처는 변경 없음).

여태 이 파일을 직접 단위 테스트하는 파일이 없었다(전부 `CurriculumDocEditor.test.tsx`를 통한 간접 테스트). `requireAdmin`이 실제 Supabase 클라이언트를 만들기 때문에 이 파일을 직접 유닛테스트하려면 `@/utils/supabase/server`를 모킹해야 한다. `deleteCurriculumDoc`의 published 가드 로직만 직접 테스트하고, 나머지는 계속 `CurriculumDocEditor.test.tsx`(Task 4/5/7)로 간접 커버한다.

- [ ] **Step 1: 실패하는 테스트 추가**

`app/admin/curriculum-doc-actions.test.ts` 신규 생성:

```ts
import { describe, expect, it, vi } from "vitest";

const mockSingle = vi.fn();
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
    if (table === "curriculum_docs") {
      return {
        select: () => ({
          eq: () => ({ single: mockSingle }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  }),
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

import { deleteCurriculumDoc } from "./curriculum-doc-actions";

describe("deleteCurriculumDoc", () => {
  it("배포된 문서는 삭제를 거부한다", async () => {
    mockSingle.mockResolvedValue({ data: { status: "published" }, error: null });
    await expect(deleteCurriculumDoc("doc1")).rejects.toThrow(
      "배포된 교재는 삭제할 수 없습니다. 먼저 배포를 취소하세요."
    );
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/curriculum-doc-actions.test.ts`
Expected: FAIL — `deleteCurriculumDoc is not a function` (아직 존재하지 않음)

- [ ] **Step 3: `addSection` 시그니처 변경**

`app/admin/curriculum-doc-actions.ts:66-85`를 교체:

```ts
export async function addSection(
  docId: string,
  nextPosition: number,
  sectionType: "concept" | "problem"
): Promise<DocSection> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("curriculum_doc_sections")
    .insert({
      curriculum_doc_id: docId,
      position: nextPosition,
      title: "새 섹션",
      body: "",
      section_type: sectionType,
    })
    .select("id, position, title, body, teaching_tip, section_type")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    position: data.position,
    title: data.title,
    body: data.body ?? "",
    teachingTip: data.teaching_tip,
    sectionType: data.section_type,
    problems: [],
  };
}
```

- [ ] **Step 4: `deleteCurriculumDoc` 추가**

`app/admin/curriculum-doc-actions.ts` 파일 맨 끝(`removeSectionProblem` 함수 뒤)에 추가:

```ts

export async function deleteCurriculumDoc(docId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: doc, error: fetchError } = await supabase
    .from("curriculum_docs")
    .select("status")
    .eq("id", docId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (doc.status === "published") {
    throw new Error("배포된 교재는 삭제할 수 없습니다. 먼저 배포를 취소하세요.");
  }

  const { error } = await supabase.from("curriculum_docs").delete().eq("id", docId);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: 객관식 프롬프트를 5개 선택지로 수정**

`app/admin/curriculum-doc-actions.ts:176`(`options` 필드 `description`)을 교체:

```ts
                  options: {
                    type: "array",
                    items: { type: "string" },
                    description: "객관식일 때만 정확히 5개의 선택지",
                  },
```

`app/admin/curriculum-doc-actions.ts:205`를 교체:

```ts
${format === "mc" ? "객관식은 반드시 선택지 5개와 정답 인덱스를 포함해주세요." : ""}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run app/admin/curriculum-doc-actions.test.ts`
Expected: PASS

- [ ] **Step 7: 타입체크**

Run: `npx tsc --noEmit`
Expected: `CurriculumDocEditor.tsx`/`CurriculumDocEditor.test.tsx`에서 `addSection` 호출 인자 개수 불일치 에러(Task 4에서 고침) 외에 이 파일 자체의 에러는 없어야 한다.

- [ ] **Step 8: 커밋**

```bash
git add app/admin/curriculum-doc-actions.ts app/admin/curriculum-doc-actions.test.ts
git commit -m "feat(admin): addSection에 섹션 타입 파라미터 추가, deleteCurriculumDoc 추가, 객관식 5지선다로 변경"
```

---

## Task 4: 섹션 타입 선택 UI + 타입별 렌더링 분기

**Files:**
- Modify: `app/admin/CurriculumDocEditor.tsx:26-142` (`CurriculumDocEditor`), `:144-284` (`SectionEditor`)
- Modify: `app/admin/CurriculumDocEditor.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `DocSection.sectionType`, Task 3의 `addSection(docId, nextPosition, sectionType)`.
- Produces: `SectionEditor`가 `section.sectionType`에 따라 다르게 렌더링 — Task 5가 `problem` 타입 섹션의 문제 UI 영역에서 이어받는다.

"+ 섹션 추가" 버튼을 누르면 바로 섹션이 생기는 대신, 타입을 고르는 2개 버튼(개념 설명 / 문제 생성)이 먼저 뜬다. 타입을 고르면 그 타입으로 `addSection`이 호출된다.

- [ ] **Step 1: 기존 "섹션을 추가할 수 있다" 테스트를 새 흐름에 맞게 교체**

`app/admin/CurriculumDocEditor.test.tsx:58-71`의 기존 테스트를 아래로 교체(같은 자리):

```tsx
  it("섹션 추가 시 타입을 먼저 선택해야 한다", async () => {
    vi.mocked(docActions.addSection).mockResolvedValue({
      id: "sec2",
      position: 2,
      title: "새 섹션",
      body: "",
      teachingTip: null,
      sectionType: "concept",
      problems: [],
    });
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText("+ 섹션 추가"));
    expect(screen.getByText("개념 설명 섹션")).toBeInTheDocument();
    expect(screen.getByText("문제 생성 섹션")).toBeInTheDocument();

    fireEvent.click(screen.getByText("개념 설명 섹션"));
    await waitFor(() =>
      expect(docActions.addSection).toHaveBeenCalledWith("doc1", 2, "concept")
    );
    await waitFor(() => expect(screen.getByDisplayValue("새 섹션")).toBeInTheDocument());
  });

  it("문제 생성 섹션은 본문/티칭팁 없이 문제 목록만 보여준다", async () => {
    vi.mocked(docActions.addSection).mockResolvedValue({
      id: "sec3",
      position: 2,
      title: "새 섹션",
      body: "",
      teachingTip: null,
      sectionType: "problem",
      problems: [],
    });
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText("+ 섹션 추가"));
    fireEvent.click(screen.getByText("문제 생성 섹션"));
    await waitFor(() =>
      expect(docActions.addSection).toHaveBeenCalledWith("doc1", 2, "problem")
    );
    await waitFor(() => expect(screen.getByDisplayValue("새 섹션")).toBeInTheDocument());
    expect(screen.queryByText("본문")).not.toBeInTheDocument();
    expect(screen.queryByText("티칭 팁 (선생님 전용)")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: `doc` 픽스처와 기존 스냅샷성 assertion에 `sectionType` 반영**

`app/admin/CurriculumDocEditor.test.tsx:28-37`의 `sections` 배열 항목에 `sectionType: "concept",`를 `problems: []` 앞에 추가:

```tsx
  sections: [
    {
      id: "sec1",
      position: 1,
      title: "Lesson Overview",
      body: "<p>본문</p>",
      teachingTip: null,
      sectionType: "concept",
      problems: [],
    },
  ],
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/CurriculumDocEditor.test.tsx`
Expected: FAIL — "개념 설명 섹션" 텍스트를 찾을 수 없음, `addSection`이 2개 인자로 호출됨(3개 기대)

- [ ] **Step 4: `CurriculumDocEditor`에 타입 선택 상태 추가**

`app/admin/CurriculumDocEditor.tsx:33-36`(state 선언부)을 교체:

```tsx
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState(doc.status);
  const [sections, setSections] = useState(doc.sections);
  const [publishing, setPublishing] = useState(false);
  const [pickingSectionType, setPickingSectionType] = useState(false);
```

- [ ] **Step 5: `handleAddSection`을 타입 인자를 받도록 변경**

`app/admin/CurriculumDocEditor.tsx:59-64`를 교체:

```tsx
  async function handleAddSection(sectionType: "concept" | "problem") {
    const nextPosition =
      sections.length === 0 ? 1 : Math.max(...sections.map((s) => s.position)) + 1;
    const section = await addSection(doc.id, nextPosition, sectionType);
    setSections((prev) => [...prev, section]);
    setPickingSectionType(false);
  }
```

- [ ] **Step 6: "+ 섹션 추가" 버튼을 타입 선택 UI로 교체**

`app/admin/CurriculumDocEditor.tsx:134-139`를 교체:

```tsx
      {pickingSectionType ? (
        <div className="flex gap-3">
          <button
            onClick={() => handleAddSection("concept")}
            className="flex-1 text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            개념 설명 섹션
          </button>
          <button
            onClick={() => handleAddSection("problem")}
            className="flex-1 text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            문제 생성 섹션
          </button>
          <button
            onClick={() => setPickingSectionType(false)}
            className="text-[12.5px] font-semibold text-grey-500 px-2"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPickingSectionType(true)}
          className="text-[12.5px] font-bold px-4 py-2.5 rounded-lg border-[1.5px] border-grey-200 text-ink w-full"
        >
          + 섹션 추가
        </button>
      )}
```

- [ ] **Step 7: `SectionEditor`가 `sectionType`에 따라 본문/티칭팁을 숨기도록 분기**

`app/admin/CurriculumDocEditor.tsx:208-235`(본문 + 티칭팁 블록)를 아래로 교체 — `section.sectionType === "concept"`일 때만 렌더링하도록 감싼다:

```tsx
      {section.sectionType === "concept" && (
        <>
          <div className="mb-3">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
              본문
            </div>
            <RichTextEditable
              initialHtml={section.body}
              placeholder="섹션 본문을 작성하세요"
              onChange={(html) => {
                onPatch({ body: html });
                updateSection(section.id, { body: html });
              }}
            />
          </div>

          <div className="mb-4">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
              티칭 팁 (선생님 전용)
            </div>
            <RichTextEditable
              initialHtml={section.teachingTip ?? ""}
              placeholder="이 섹션을 가르칠 때 선생님에게 도움이 될 팁"
              minHeight="60px"
              onChange={(html) => {
                onPatch({ teachingTip: html });
                updateSection(section.id, { teachingTip: html });
              }}
            />
          </div>
        </>
      )}
```

- [ ] **Step 8: `problem` 타입 섹션은 AI 생성 패널이 기본으로 펼쳐지도록 초기값 조정**

`app/admin/CurriculumDocEditor.tsx:144-166`(`SectionEditor` 함수 시그니처와 `showProblemForm` state)를 교체:

```tsx
function SectionEditor({
  section,
  index,
  isFirst,
  isLast,
  subjectId,
  subjectName,
  onPatch,
  onRemove,
  onMove,
}: {
  section: DocSection;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  subjectId: string;
  subjectName: string;
  onPatch: (patch: Partial<DocSection>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [problems, setProblems] = useState(section.problems);
  const [showProblemForm, setShowProblemForm] = useState(
    section.sectionType === "problem" && section.problems.length === 0
  );
```

- [ ] **Step 9: `문제 (N)` 블록도 `problem` 타입일 때만 상단 구분선 없이 자연스럽게 보이도록 정리**

`app/admin/CurriculumDocEditor.tsx`의 문제 블록을 감싸는 `<div className="border-t border-grey-200 pt-3">`(기존 `:237`)를 조건부 클래스로 교체 — `concept` 섹션은 위에 본문/티칭팁이 있으므로 구분선이 필요하지만 `problem` 섹션은 바로 시작하므로 구분선을 뺀다:

```tsx
      <div
        className={
          section.sectionType === "concept" ? "border-t border-grey-200 pt-3" : ""
        }
      >
```

- [ ] **Step 10: 테스트 통과 확인**

Run: `npx vitest run app/admin/CurriculumDocEditor.test.tsx`
Expected: PASS (전체)

- [ ] **Step 11: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (Task 5 이전이므로 `ProblemFormat`별 UI 관련 에러는 아직 없어야 정상 — 있다면 이 태스크 범위 내에서 고친다)

- [ ] **Step 12: 커밋**

```bash
git add app/admin/CurriculumDocEditor.tsx app/admin/CurriculumDocEditor.test.tsx
git commit -m "feat(admin): 섹션 추가 시 개념 설명/문제 생성 타입 선택 UI 추가"
```

---

## Task 5: 문제 포맷별(객관식 5지선다/서술형/수학 화이트보드형) 저작 UI

**Files:**
- Create: `app/admin/ProblemDraftFields.tsx`
- Create: `app/admin/ProblemDraftFields.test.tsx`
- Modify: `app/admin/CurriculumDocEditor.tsx:286-426` (`ProblemGenPanel`과 그 위 확정 문제 표시 블록)
- Modify: `app/admin/CurriculumDocEditor.test.tsx`

**Interfaces:**
- Consumes: `ProblemFormat`("mc"|"essay"|"math") — `app/admin/curriculum-doc-actions.ts`에서 export.
- Produces: `ProblemDraftFields` 컴포넌트 — `{ draft: Omit<DocProblem, "id">; onChange: (patch: Partial<Omit<DocProblem, "id">>) => void }` props를 받아 포맷에 맞는 입력 필드를 렌더링. `CurriculumDocEditor.tsx`의 `ProblemGenPanel`(AI 초안 편집 단계)이 사용.

지금 AI 초안(`drafts`)은 읽기 전용 미리보기라 확정 전에 고칠 수가 없다. 이 태스크에서 초안 카드를 포맷별 편집 가능한 입력으로 바꾼다.

- [ ] **Step 1: `ProblemDraftFields` 실패하는 테스트 작성**

`app/admin/ProblemDraftFields.test.tsx` 신규 생성:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProblemDraftFields from "./ProblemDraftFields";
import type { DocProblem } from "./curriculum-doc-data";

const mcDraft: Omit<DocProblem, "id"> = {
  format: "mc",
  passage: "지문",
  options: ["A", "B", "C", "D", "E"],
  correctIndex: 0,
  explanation: "해설",
  difficulty: "medium",
};

const essayDraft: Omit<DocProblem, "id"> = {
  format: "essay",
  passage: "서술형 지문",
  options: null,
  correctIndex: null,
  explanation: "모범답안 내용",
  difficulty: "medium",
};

const mathDraft: Omit<DocProblem, "id"> = {
  format: "math",
  passage: "수학 지문",
  options: null,
  correctIndex: null,
  explanation: "모범풀이",
  difficulty: "medium",
};

describe("ProblemDraftFields", () => {
  it("객관식은 선택지 5개 입력과 정답 라디오를 보여준다", () => {
    render(<ProblemDraftFields draft={mcDraft} onChange={vi.fn()} />);
    expect(screen.getAllByPlaceholderText(/선택지/)).toHaveLength(5);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("객관식 선택지를 수정하면 onChange가 호출된다", () => {
    const onChange = vi.fn();
    render(<ProblemDraftFields draft={mcDraft} onChange={onChange} />);
    fireEvent.change(screen.getAllByPlaceholderText(/선택지/)[1], {
      target: { value: "B 수정" },
    });
    expect(onChange).toHaveBeenCalledWith({
      options: ["A", "B 수정", "C", "D", "E"],
    });
  });

  it("서술형은 선택지 UI 없이 모범답안 입력만 보여준다", () => {
    render(<ProblemDraftFields draft={essayDraft} onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/선택지/)).not.toBeInTheDocument();
    expect(screen.getByText("모범답안")).toBeInTheDocument();
  });

  it("수학 화이트보드형은 LaTeX 삽입 버튼과 안내 문구를 보여준다", () => {
    render(<ProblemDraftFields draft={mathDraft} onChange={vi.fn()} />);
    expect(screen.getByText("위첨자")).toBeInTheDocument();
    expect(screen.getByText("분수")).toBeInTheDocument();
    expect(screen.getByText("근호")).toBeInTheDocument();
    expect(
      screen.getByText("학생은 세션뷰의 화이트보드에서 직접 풀이를 작성합니다.")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/ProblemDraftFields.test.tsx`
Expected: FAIL — 모듈 `./ProblemDraftFields`를 찾을 수 없음

- [ ] **Step 3: `ProblemDraftFields.tsx` 작성**

`app/admin/ProblemDraftFields.tsx` 신규 생성:

```tsx
"use client";

import { useRef } from "react";
import type { DocProblem } from "./curriculum-doc-data";

type Draft = Omit<DocProblem, "id">;

const LATEX_SNIPPETS: { label: string; snippet: string }[] = [
  { label: "위첨자", snippet: "x^2" },
  { label: "분수", snippet: "\\frac{a}{b}" },
  { label: "근호", snippet: "\\sqrt{x}" },
];

export default function ProblemDraftFields({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const passageRef = useRef<HTMLTextAreaElement | null>(null);
  const explanationRef = useRef<HTMLTextAreaElement | null>(null);

  function insertSnippet(
    ref: React.MutableRefObject<HTMLTextAreaElement | null>,
    field: "passage" | "explanation",
    snippet: string
  ) {
    const el = ref.current;
    const current = draft[field] ?? "";
    if (!el) {
      onChange({ [field]: current + snippet } as Partial<Draft>);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + snippet + current.slice(end);
    onChange({ [field]: next } as Partial<Draft>);
  }

  return (
    <div>
      <textarea
        ref={passageRef}
        value={draft.passage}
        onChange={(e) => onChange({ passage: e.target.value })}
        placeholder="문제 지문"
        className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2"
        rows={3}
      />

      {draft.format === "math" && (
        <div className="flex gap-2 mb-2">
          {LATEX_SNIPPETS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => insertSnippet(passageRef, "passage", s.snippet)}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded border-[1.5px] border-grey-200 text-ink"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {draft.format === "mc" && (
        <div className="mb-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <input
                type="radio"
                name="correctIndex"
                checked={draft.correctIndex === i}
                onChange={() => onChange({ correctIndex: i })}
              />
              <input
                value={draft.options?.[i] ?? ""}
                onChange={(e) => {
                  const next = [...(draft.options ?? ["", "", "", "", ""])];
                  next[i] = e.target.value;
                  onChange({ options: next });
                }}
                placeholder={`선택지 ${i + 1}`}
                className="flex-1 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
              />
            </div>
          ))}
        </div>
      )}

      {draft.format === "math" && (
        <p className="text-[11.5px] text-grey-500 mb-2">
          학생은 세션뷰의 화이트보드에서 직접 풀이를 작성합니다. 여기서는 문제와 모범풀이만
          입력하세요.
        </p>
      )}

      <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-1">
        {draft.format === "mc" ? "해설" : draft.format === "essay" ? "모범답안" : "모범풀이"}
      </div>
      <textarea
        ref={explanationRef}
        value={draft.explanation}
        onChange={(e) => onChange({ explanation: e.target.value })}
        placeholder={
          draft.format === "mc" ? "정답 해설" : draft.format === "essay" ? "모범답안" : "모범풀이"
        }
        className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        rows={3}
      />
      {draft.format === "math" && (
        <div className="flex gap-2 mt-2">
          {LATEX_SNIPPETS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => insertSnippet(explanationRef, "explanation", s.snippet)}
              className="text-[11.5px] font-semibold px-2.5 py-1 rounded border-[1.5px] border-grey-200 text-ink"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `ProblemDraftFields` 테스트 통과 확인**

Run: `npx vitest run app/admin/ProblemDraftFields.test.tsx`
Expected: PASS

- [ ] **Step 5: `CurriculumDocEditor.tsx`의 확정 문제 표시 테스트를 새 UI에 맞게 갱신**

`app/admin/CurriculumDocEditor.test.tsx`의 "문제 추가 폼에서 AI 생성 후 문제로 추가할 수 있다" 테스트(기존 `:80-126`)에서, mc 픽스처의 `options`를 5개로 바꾸고(`["A", "B", "C", "D", "E"]`, `correctIndex: 1`), AI 초안 확인 부분의 assertion을 아래로 교체:

```tsx
    await waitFor(() => expect(screen.getByText("AI 초안 (1개)")).toBeInTheDocument());
    expect(screen.getAllByPlaceholderText(/선택지/)).toHaveLength(5);
```

(픽스처 변경: `generateSectionProblems`/`confirmSectionProblems`의 `mockResolvedValue` 안 `options: ["A", "B", "C", "D"]`를 `options: ["A", "B", "C", "D", "E"]`로, 두 곳 모두 수정)

- [ ] **Step 6: 확정된 문제 표시(포맷 라벨) 부분에 포맷별 요약이 보이는지 테스트 추가**

`app/admin/CurriculumDocEditor.test.tsx` 맨 아래(`describe` 블록 안 마지막 `it` 뒤)에 추가:

```tsx

  it("서술형 문제는 확정 목록에서 모범답안을 함께 보여준다", () => {
    const essayDoc = {
      ...doc,
      sections: [
        {
          ...doc.sections[0],
          sectionType: "problem" as const,
          problems: [
            {
              id: "prob1",
              format: "essay" as const,
              passage: "서술형 문제",
              options: null,
              correctIndex: null,
              explanation: "모범답안 내용",
              difficulty: "medium" as const,
            },
          ],
        },
      ],
    };
    render(<CurriculumDocEditor doc={essayDoc} onBack={vi.fn()} />);
    expect(screen.getByText(/서술형 문제/)).toBeInTheDocument();
    expect(screen.getByText(/모범답안 내용/)).toBeInTheDocument();
  });
```

- [ ] **Step 7: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/CurriculumDocEditor.test.tsx`
Expected: FAIL — 5개 선택지 관련 assertion 실패, 서술형 모범답안 텍스트를 찾을 수 없음(현재 UI는 해설만 보여줌)

- [ ] **Step 8: `ProblemGenPanel`을 `ProblemDraftFields` 기반으로 재작성**

`app/admin/CurriculumDocEditor.tsx` 파일 상단 import에 추가:

```tsx
import ProblemDraftFields from "./ProblemDraftFields";
```

`app/admin/CurriculumDocEditor.tsx:286-426`(`ProblemGenPanel` 함수 전체)를 교체:

```tsx
function ProblemGenPanel({
  sectionId,
  sectionTitle,
  subjectId,
  subjectName,
  onConfirmed,
  onCancel,
}: {
  sectionId: string;
  sectionTitle: string;
  subjectId: string;
  subjectName: string;
  onConfirmed: (created: DocProblem[]) => void;
  onCancel: () => void;
}) {
  const [skillType, setSkillType] = useState("");
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>("medium");
  const [format, setFormat] = useState<ProblemFormat>("mc");
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [drafts, setDrafts] = useState<Omit<DocProblem, "id">[] | null>(null);

  async function handleGenerate() {
    if (!skillType.trim() || generating) return;
    setGenerating(true);
    try {
      const result = await generateSectionProblems({
        sectionTitle,
        subjectName,
        skillType: skillType.trim(),
        difficulty,
        format,
        count,
      });
      setDrafts(result);
    } finally {
      setGenerating(false);
    }
  }

  function patchDraft(index: number, patch: Partial<Omit<DocProblem, "id">>) {
    setDrafts((prev) =>
      prev ? prev.map((d, i) => (i === index ? { ...d, ...patch } : d)) : prev
    );
  }

  async function handleConfirm() {
    if (!drafts || confirming) return;
    setConfirming(true);
    try {
      const created = await confirmSectionProblems(sectionId, subjectId, drafts);
      onConfirmed(created);
    } finally {
      setConfirming(false);
    }
  }

  if (drafts) {
    return (
      <div className="border-[1.5px] border-grey-200 rounded-lg px-4 py-3.5">
        <div className="text-[12.5px] font-bold text-ink mb-2">AI 초안 ({drafts.length}개)</div>
        {drafts.map((d, i) => (
          <div key={i} className="bg-grey-100 rounded-lg px-3 py-2.5 mb-2">
            <span className="text-[11px] font-bold text-grey-500">
              [{FORMAT_LABEL[d.format]}]
            </span>
            <ProblemDraftFields draft={d} onChange={(patch) => patchDraft(i, patch)} />
          </div>
        ))}
        <div className="flex gap-3 mt-2">
          <button
            disabled={confirming}
            onClick={handleConfirm}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            {confirming ? "추가 중..." : "문제로 추가"}
          </button>
          <button
            onClick={() => setDrafts(null)}
            className="text-[12px] font-semibold text-grey-500"
          >
            다시 조건 입력
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-lg px-4 py-3.5">
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <input
          value={skillType}
          onChange={(e) => setSkillType(e.target.value)}
          placeholder="문제 유형 (예: 판별식 응용)"
          className="col-span-2 px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as ProblemFormat)}
          className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        >
          <option value="mc">객관식</option>
          <option value="essay">서술형</option>
          <option value="math">풀이형</option>
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as ProblemDifficulty)}
          className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        >
          <option value="easy">쉬움</option>
          <option value="medium">보통</option>
          <option value="hard">어려움</option>
        </select>
        <input
          type="number"
          min={1}
          max={10}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
        />
      </div>
      <div className="flex gap-3">
        <button
          disabled={!skillType.trim() || generating}
          onClick={handleGenerate}
          className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {generating ? "생성 중..." : "✨ AI로 생성하기"}
        </button>
        <button onClick={onCancel} className="text-[12px] font-semibold text-grey-500">
          취소
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: 확정된 문제 표시 블록에 서술형/수학 모범답안 요약 추가**

`app/admin/CurriculumDocEditor.tsx:241-259`(확정된 문제를 나열하는 `{problems.map((p) => ...)}` 블록)를 교체:

```tsx
        {problems.map((p) => (
          <div
            key={p.id}
            className="flex items-start justify-between gap-3 bg-grey-100 rounded-lg px-3 py-2.5 mb-2"
          >
            <div className="text-[12.5px] text-ink">
              <span className="font-bold">[{FORMAT_LABEL[p.format]}]</span> {p.passage}
              {p.format !== "mc" && (
                <p className="text-grey-500 mt-1">
                  {p.format === "essay" ? "모범답안: " : "모범풀이: "}
                  {p.explanation}
                </p>
              )}
            </div>
            <button
              onClick={async () => {
                await removeSectionProblem(p.id);
                commitProblems(problems.filter((x) => x.id !== p.id));
              }}
              className="text-[11.5px] font-semibold text-red shrink-0"
            >
              삭제
            </button>
          </div>
        ))}
```

- [ ] **Step 10: 테스트 통과 확인**

Run: `npx vitest run app/admin/CurriculumDocEditor.test.tsx app/admin/ProblemDraftFields.test.tsx`
Expected: PASS (전체)

- [ ] **Step 11: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 12: 커밋**

```bash
git add app/admin/ProblemDraftFields.tsx app/admin/ProblemDraftFields.test.tsx app/admin/CurriculumDocEditor.tsx app/admin/CurriculumDocEditor.test.tsx
git commit -m "feat(admin): 문제 포맷별(객관식 5지선다/서술형/수학 화이트보드형) 저작 UI 분리"
```

---

## Task 6: 리치텍스트 표(table) 삽입

**Files:**
- Modify: `app/admin/RichTextEditable.tsx`
- Modify: `lib/sanitize-doc-html.ts`
- Modify: `app/globals.css`
- Test: `app/admin/RichTextEditable.test.tsx` (신규 파일)
- Test: `lib/sanitize-doc-html.test.ts` (신규 파일)

**Interfaces:**
- 없음 — 다른 태스크와 독립적. `RichTextEditable`은 이미 `CurriculumDocEditor.tsx`가 사용 중이므로 새 버튼만 추가하면 기존 사용처는 그대로 동작.

- [ ] **Step 1: `sanitize-doc-html`에 표 태그 허용 테스트 추가**

`lib/sanitize-doc-html.test.ts` 신규 생성:

```ts
import { describe, expect, it } from "vitest";
import { sanitizeDocHtml } from "./sanitize-doc-html";

describe("sanitizeDocHtml", () => {
  it("표 태그를 허용한다", () => {
    const html = "<table><tbody><tr><td>내용</td></tr></tbody></table>";
    expect(sanitizeDocHtml(html)).toBe(html);
  });

  it("여전히 script 태그는 제거한다", () => {
    expect(sanitizeDocHtml("<script>alert(1)</script><p>본문</p>")).toBe("<p>본문</p>");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/sanitize-doc-html.test.ts`
Expected: FAIL — 첫 번째 테스트에서 `<table>` 관련 태그가 제거된 결과와 불일치

- [ ] **Step 3: `sanitize-doc-html.ts`에 표 태그 추가**

`lib/sanitize-doc-html.ts:10-25`(`allowedTags` 배열)를 교체:

```ts
    allowedTags: [
      "p",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "br",
      "div",
      "span",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
```

- [ ] **Step 4: `sanitize-doc-html` 테스트 통과 확인**

Run: `npx vitest run lib/sanitize-doc-html.test.ts`
Expected: PASS

- [ ] **Step 5: `RichTextEditable`에 표 삽입 버튼 실패하는 테스트 작성**

`app/admin/RichTextEditable.test.tsx` 신규 생성:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RichTextEditable from "./RichTextEditable";

describe("RichTextEditable", () => {
  it("표 삽입 버튼을 누르면 execCommand로 표 HTML을 삽입한다", () => {
    const execCommandSpy = vi.fn();
    document.execCommand = execCommandSpy;
    render(<RichTextEditable initialHtml="" onChange={vi.fn()} />);
    fireEvent.mouseDown(screen.getByText("표"));
    expect(execCommandSpy).toHaveBeenCalledWith(
      "insertHTML",
      false,
      expect.stringContaining("<table")
    );
  });
});
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/RichTextEditable.test.tsx`
Expected: FAIL — "표" 텍스트를 가진 요소를 찾을 수 없음

- [ ] **Step 7: `RichTextEditable.tsx`에 표 삽입 버튼 추가**

`app/admin/RichTextEditable.tsx:36-39`(`exec` 함수 아래)에 표 삽입 전용 함수를 추가하고, 툴바 버튼 목록 렌더링 부분을 수정한다. 파일 전체를 아래로 교체:

```tsx
"use client";

import { useRef } from "react";

const TOOLBAR_BUTTONS: { label: string; command: string; value?: string }[] = [
  { label: "B", command: "bold" },
  { label: "I", command: "italic" },
  { label: "U", command: "underline" },
  { label: "H2", command: "formatBlock", value: "h2" },
  { label: "H3", command: "formatBlock", value: "h3" },
  { label: "본문", command: "formatBlock", value: "p" },
  { label: "•목록", command: "insertUnorderedList" },
  { label: "1.목록", command: "insertOrderedList" },
];

const TABLE_HTML =
  "<table><tbody>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>" +
  "</tbody></table>";

export default function RichTextEditable({
  initialHtml,
  onChange,
  placeholder,
  minHeight = "100px",
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function setInitialContent(el: HTMLDivElement | null) {
    if (el && ref.current !== el) {
      el.innerHTML = initialHtml;
      ref.current = el;
    }
  }

  function exec(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
  }

  function insertTable() {
    ref.current?.focus();
    document.execCommand("insertHTML", false, TABLE_HTML);
  }

  function handleBlur() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 px-2 py-1.5 bg-grey-100 border-b border-grey-200">
        {TOOLBAR_BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec(b.command, b.value);
            }}
            className="text-[11.5px] font-bold px-2 py-1 rounded hover:bg-white text-ink"
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            insertTable();
          }}
          className="text-[11.5px] font-bold px-2 py-1 rounded hover:bg-white text-ink"
        >
          표
        </button>
      </div>
      <div
        ref={setInitialContent}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        data-placeholder={placeholder}
        className="rte-editable px-3 py-2.5 text-[13.5px] leading-[1.6] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-grey-300"
        style={{ minHeight }}
      />
    </div>
  );
}
```

- [ ] **Step 8: `RichTextEditable` 테스트 통과 확인**

Run: `npx vitest run app/admin/RichTextEditable.test.tsx`
Expected: PASS

- [ ] **Step 9: 표 CSS 추가**

`app/globals.css` 파일 맨 끝에 추가:

```css

.rte-editable table {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
}

.rte-editable table td,
.rte-editable table th {
  border: 1px solid var(--grey-200, #e5e5e5);
  padding: 6px 10px;
  min-width: 60px;
}
```

- [ ] **Step 10: 전체 관련 테스트 통과 확인**

Run: `npx vitest run app/admin/RichTextEditable.test.tsx lib/sanitize-doc-html.test.ts app/admin/CurriculumDocEditor.test.tsx`
Expected: PASS (전체)

- [ ] **Step 11: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 12: 커밋**

```bash
git add app/admin/RichTextEditable.tsx app/admin/RichTextEditable.test.tsx lib/sanitize-doc-html.ts lib/sanitize-doc-html.test.ts app/globals.css
git commit -m "feat(admin): 리치텍스트 에디터에 표 삽입 버튼 추가"
```

---

## Task 7: 교재 문서 삭제 UI

**Files:**
- Modify: `app/admin/CurriculumDocEditor.tsx:1-142` (`CurriculumDocEditor` 컴포넌트 하단, import)
- Modify: `app/admin/CurriculumDocEditor.test.tsx`
- Modify: `app/admin/CurriculumDocsTab.tsx:29-42` (`handleBackFromEditor`, `open` 렌더링부)
- Modify: `app/admin/CurriculumDocsTab.test.tsx` (없으면 신규 생성 — 아래서 확인)

**Interfaces:**
- Consumes: Task 3의 `deleteCurriculumDoc(docId): Promise<void>`.
- Produces: `CurriculumDocEditor`의 `onBack` prop에 더해 신규 `onDeleted: (docId: string) => void` prop — `CurriculumDocsTab.tsx`가 목록에서 제거하는 데 사용.

`SubjectTemplateTab.tsx`의 `SubjectDetailEditor`(`confirmingDelete`/`deleteError` state, 2단계 확인 UI)와 동일한 패턴을 그대로 따른다.

- [ ] **Step 1: `CurriculumDocsTab.test.tsx` 존재 여부 확인 후 없으면 골격 생성**

Run: `test -f app/admin/CurriculumDocsTab.test.tsx && echo exists || echo missing`

파일이 없다면(`missing`) `app/admin/CurriculumDocsTab.test.tsx`를 아래 내용으로 신규 생성:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CurriculumDocsTab from "./CurriculumDocsTab";
import type { DocEditorData } from "./curriculum-doc-data";
import type { AdminSubject } from "./subject-data";

vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  updateDocTitle: vi.fn(),
  setDocPublished: vi.fn(),
  addSection: vi.fn(),
  updateSection: vi.fn(),
  removeSection: vi.fn(),
  moveSection: vi.fn(),
  generateSectionProblems: vi.fn(),
  confirmSectionProblems: vi.fn(),
  removeSectionProblem: vi.fn(),
  deleteCurriculumDoc: vi.fn(),
}));

import * as docActions from "./curriculum-doc-actions";

const subjects: AdminSubject[] = [
  { subjectId: "sub1", subjectName: "SAT Math", units: [] },
];

const doc: DocEditorData = {
  id: "doc1",
  title: "이차방정식",
  subjectId: "sub1",
  subjectName: "SAT Math",
  unitId: null,
  unitTitle: null,
  status: "draft",
  sections: [],
};

describe("CurriculumDocsTab", () => {
  it("교재를 삭제하면 목록에서 사라진다", async () => {
    vi.mocked(docActions.deleteCurriculumDoc).mockResolvedValue(undefined);
    render(<CurriculumDocsTab initialDocs={[doc]} subjects={subjects} />);
    fireEvent.click(screen.getByText("편집"));
    fireEvent.click(screen.getByText("이 교재 삭제"));
    fireEvent.click(screen.getByText("삭제"));
    await waitFor(() =>
      expect(docActions.deleteCurriculumDoc).toHaveBeenCalledWith("doc1")
    );
    await waitFor(() => expect(screen.queryByText("이차방정식")).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: `CurriculumDocEditor.test.tsx`에 삭제 UI 테스트 추가**

`app/admin/CurriculumDocEditor.test.tsx` 상단 `vi.mock("./curriculum-doc-actions", ...)` 블록(`:7-18`)에 `deleteCurriculumDoc: vi.fn(),`을 추가:

```tsx
vi.mock("./curriculum-doc-actions", () => ({
  createCurriculumDoc: vi.fn(),
  updateDocTitle: vi.fn(),
  setDocPublished: vi.fn(),
  addSection: vi.fn(),
  updateSection: vi.fn(),
  removeSection: vi.fn(),
  moveSection: vi.fn(),
  generateSectionProblems: vi.fn(),
  confirmSectionProblems: vi.fn(),
  removeSectionProblem: vi.fn(),
  deleteCurriculumDoc: vi.fn(),
}));
```

파일 맨 아래(마지막 `it` 블록 뒤, `describe` 닫는 괄호 앞)에 추가:

```tsx

  it("초안 상태에서는 삭제 확인 후 onDeleted가 호출된다", async () => {
    vi.mocked(docActions.deleteCurriculumDoc).mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    render(<CurriculumDocEditor doc={doc} onBack={vi.fn()} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByText("이 교재 삭제"));
    expect(screen.getByText(/정말 "이차방정식 개념 정리" 교재를 삭제하시겠습니까/)).toBeInTheDocument();
    const deleteButtons = screen.getAllByText("삭제");
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(docActions.deleteCurriculumDoc).toHaveBeenCalledWith("doc1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("doc1"));
  });

  it("배포된 문서는 삭제 버튼이 비활성화된다", () => {
    render(
      <CurriculumDocEditor doc={{ ...doc, status: "published" }} onBack={vi.fn()} onDeleted={vi.fn()} />
    );
    expect(screen.getByText("이 교재 삭제")).toBeDisabled();
    expect(screen.getByText("배포 취소 후 삭제할 수 있습니다.")).toBeInTheDocument();
  });
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run app/admin/CurriculumDocEditor.test.tsx app/admin/CurriculumDocsTab.test.tsx`
Expected: FAIL — "이 교재 삭제" 텍스트를 찾을 수 없음, `onDeleted` prop 타입 에러

- [ ] **Step 4: `CurriculumDocEditor`에 삭제 UI 추가**

`app/admin/CurriculumDocEditor.tsx` 상단 import에 `deleteCurriculumDoc` 추가:

```tsx
import {
  updateDocTitle,
  setDocPublished,
  addSection,
  updateSection,
  removeSection,
  moveSection,
  generateSectionProblems,
  confirmSectionProblems,
  removeSectionProblem,
  deleteCurriculumDoc,
  type ProblemFormat,
  type ProblemDifficulty,
} from "./curriculum-doc-actions";
```

`export default function CurriculumDocEditor({ doc, onBack, }: { doc: DocEditorData; onBack: (updated: DocEditorData) => void; })` 시그니처를 교체:

```tsx
export default function CurriculumDocEditor({
  doc,
  onBack,
  onDeleted,
}: {
  doc: DocEditorData;
  onBack: (updated: DocEditorData) => void;
  onDeleted: (docId: string) => void;
}) {
```

state 선언부(Task 4에서 `pickingSectionType`을 추가한 자리)에 삭제 관련 state 추가:

```tsx
  const [title, setTitle] = useState(doc.title);
  const [status, setStatus] = useState(doc.status);
  const [sections, setSections] = useState(doc.sections);
  const [publishing, setPublishing] = useState(false);
  const [pickingSectionType, setPickingSectionType] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
```

삭제 핸들러를 `handleAddSection` 아래에 추가:

```tsx
  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteCurriculumDoc(doc.id);
      onDeleted(doc.id);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }
```

컴포넌트 최상위 반환 JSX의 맨 마지막(`"+ 섹션 추가"`/타입 선택 블록 바로 뒤, 닫는 `</div>` 앞)에 삭제 UI 블록 추가:

```tsx
      <div className="border-t border-grey-200 pt-5 mt-8">
        {confirmingDelete ? (
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] text-ink">
              정말 &quot;{title}&quot; 교재를 삭제하시겠습니까?
            </span>
            <button
              disabled={deleting}
              onClick={handleDelete}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-red text-white disabled:opacity-50"
            >
              삭제
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="text-[12px] font-semibold text-grey-500"
            >
              취소
            </button>
          </div>
        ) : (
          <>
            <button
              disabled={status === "published"}
              onClick={() => setConfirmingDelete(true)}
              className="text-[12.5px] font-semibold text-red disabled:opacity-30 disabled:cursor-not-allowed"
            >
              이 교재 삭제
            </button>
            {status === "published" && (
              <p className="text-[12px] text-grey-500 mt-1.5">
                배포 취소 후 삭제할 수 있습니다.
              </p>
            )}
          </>
        )}
        {deleteError && <p className="text-[12px] text-red mt-2">{deleteError}</p>}
      </div>
```

- [ ] **Step 5: `CurriculumDocsTab.tsx`가 `onDeleted`를 전달하도록 배선**

`app/admin/CurriculumDocsTab.tsx:29-32`(`handleBackFromEditor` 함수) 아래에 삭제 핸들러 추가:

```tsx
  function handleDocDeleted(docId: string) {
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    setOpenDocId(null);
  }
```

`app/admin/CurriculumDocsTab.tsx:40-42`를 교체:

```tsx
  if (open) {
    return (
      <CurriculumDocEditor doc={open} onBack={handleBackFromEditor} onDeleted={handleDocDeleted} />
    );
  }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run app/admin/CurriculumDocEditor.test.tsx app/admin/CurriculumDocsTab.test.tsx`
Expected: PASS (전체)

- [ ] **Step 7: 전체 관련 테스트 + 타입체크**

Run: `npx vitest run app/admin/ && npx tsc --noEmit`
Expected: 전부 PASS, 에러 없음

- [ ] **Step 8: `docs/tickets.md`에 항목 반영**

`docs/tickets.md`에서 052 티켓 항목을 찾아, 그 아래에 다음 줄 추가(기존 052 항목 형식을 따름 — 정확한 위치는 052 항목 위치를 확인 후 그 서브 항목으로):

```markdown
  - [x] 교재 문서 편집기 업그레이드: 섹션 타입(개념 설명/문제 생성) 구분, 문제 포맷별(객관식 5지선다/서술형/수학 화이트보드형) 전용 저작 UI, 표 삽입, 문서 삭제 기능 (2026-08-29)
```

- [ ] **Step 9: 커밋**

```bash
git add app/admin/CurriculumDocEditor.tsx app/admin/CurriculumDocEditor.test.tsx app/admin/CurriculumDocsTab.tsx app/admin/CurriculumDocsTab.test.tsx docs/tickets.md
git commit -m "feat(admin): 교재 문서 삭제 UI 추가(배포된 문서는 삭제 금지)"
```

---

## 전체 완료 확인

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npx vitest run`
Expected: 전부 PASS, 실패 0건

- [ ] **Step 2: 전체 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 0건

- [ ] **Step 3: 브라우저에서 수동 스모크 확인 (선택 — 로컬 Supabase/`npm run dev` 구동 중일 때)**

관리자 포털 → 교재 문서 탭 → 새 교재 만들기 → 섹션 추가 시 타입 선택 모달 확인 → 문제 생성 섹션에서 3개 포맷 각각 AI 생성 → 초안 편집 → 확정 → 본문에 표 삽입 → 문서 삭제(초안 상태) 확인 → 배포 후 삭제 버튼 비활성화 확인.
