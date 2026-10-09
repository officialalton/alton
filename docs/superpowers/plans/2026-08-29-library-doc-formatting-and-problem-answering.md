# 교재 라이브러리 서식 보존 + 문제풀이 인터랙션 Implementation Plan

> **문서 상태: 과거 구현 이력·직접 재실행 금지.** 현재 결과를 이해할 때만 참고하고 신규 작업은 v3 문서를 따른다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 구글독스에서 붙여넣은 서식(색상/배경/표 테두리)이 저장 시 사라지지 않게 하고, (2) 교재 라이브러리 화면(`/materials/[id]`)의 문제를 세션뷰와 동일한 실제 풀이 UI(객관식 클릭채점/서술형 타이핑/수학 캔버스)로 교체하면서 학생에게 정답·해설이 유출되던 버그를 고치고, (3) 서술형 입력창을 자동 확장되게 하고, (4) 목차 마지막 섹션 스크롤 버그를 고친다.

**Architecture:** 세션뷰(`app/session/[id]/`)에 이미 있는 문제 답변 로직(`ProblemCard`, `MathCanvas`, `problemlog-actions.ts`의 세션 없는 재시도 액션)을 라이브러리 화면이 그대로 재사용한다. 새로 만드는 건 라이브러리 전용 `LibraryProblemCard`(뷰어 역할 3종 분기)와 공용 `AutoGrowTextarea` 뿐이다.

## Global Constraints

- 문제 답변 캡처(mc/essay/math)와 3회 재시도 로직은 새로 만들지 않는다 — `app/session/[id]/problemlog-actions.ts`의 `retryMcAttempt`/`retryEssayAttempt`/`retryMathAttempt`(모두 `session_id: null`)를 그대로 import해서 쓴다.
- 뷰어 역할은 `SessionViewViewer`("student"|"teacher"|"parent"|"admin") 타입을 그대로 재사용한다. 라이브러리 화면에서는: `teacher`/`admin` → 정답·해설 항상 노출(입력 불가), `student` → 인터랙티브 풀이(정답/해설은 완료 전까지 숨김), `parent` → 지문만 노출, 정답/입력 전부 숨김.
- `sanitize-doc-html.ts`의 `allowedAttributes: {}` 원칙은 유지하되(임의 속성 주입 방지), `style` 속성만 관련 태그에 한해 허용하고 `sanitize-html`의 `allowedStyles`로 속성값까지 검증한다 — `onclick` 등 다른 속성은 여전히 전부 제거된다.
- 관리자 에디터(`RichTextEditable.tsx`)의 툴바 UI는 건드리지 않는다.
- 완료 후: 관련 테스트 전체 통과 + `npx tsc --noEmit` 클린 → `docs/tickets.md` 반영 → git commit.

---

## Task 1: `sanitize-doc-html.ts` 서식 보존 확장

**Files:**
- Modify: `lib/sanitize-doc-html.ts`
- Test: `lib/sanitize-doc-html.test.ts`

**Interfaces:**
- 없음 — 다른 태스크와 독립적. 이 함수의 시그니처(`sanitizeDocHtml(html: string): string`)는 변하지 않는다.

- [ ] **Step 1: 실패하는 테스트 추가**

`lib/sanitize-doc-html.test.ts`에 아래 테스트를 추가(기존 테스트 파일 끝에):

```ts

  it("구글독스에서 붙여넣은 색상/배경 인라인 스타일을 보존한다", () => {
    const html = '<p style="color: #2e74b5; background-color: #eaf1fb; text-align: center;">안내</p>';
    expect(sanitizeDocHtml(html)).toBe(html);
  });

  it("표 셀의 테두리/패딩 스타일을 보존한다", () => {
    const html =
      '<table><tbody><tr><td style="border: 1px solid #bfbfbf; padding: 5px;">내용</td></tr></tbody></table>';
    expect(sanitizeDocHtml(html)).toBe(html);
  });

  it("h1과 blockquote 태그를 허용한다", () => {
    const html = "<h1>제목</h1><blockquote>인용문</blockquote>";
    expect(sanitizeDocHtml(html)).toBe(html);
  });

  it("style 안에 위험한 값(javascript: URL 등)이 있으면 그 속성만 제거한다", () => {
    const html = '<p style="color: red; background-image: url(javascript:alert(1))">위험</p>';
    const result = sanitizeDocHtml(html);
    expect(result).not.toContain("javascript:");
    expect(result).toContain("color");
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run lib/sanitize-doc-html.test.ts`
Expected: FAIL — 색상/배경 스타일이 사라진 결과와 불일치, `<h1>`/`<blockquote>`가 제거된 결과와 불일치

- [ ] **Step 3: `sanitize-doc-html.ts` 확장**

파일 전체를 아래로 교체:

```ts
import sanitizeHtml from "sanitize-html";

// 052(교재 편집기)의 리치 텍스트 툴바가 만들어내는 태그 + 구글독스 등 외부에서
// 붙여넣은 서식(색상/배경/표 테두리)을 허용한다. contenteditable(execCommand)로
// 만들어진 HTML이나 붙여넣기로 들어온 HTML을 그대로 저장하지 않고, 서버
// 액션에서 저장 직전 한 번 거른다 — 렌더링 쪽(dangerouslySetInnerHTML)은 여러
// 곳(학생 세션뷰, 교재 라이브러리)에 흩어져 있어 매번 거르기보다 쓰기 경계
// 한 곳에서 막는 게 안전하다.
//
// allowedAttributes는 여전히 태그 공통 {}(즉 style 외 다른 속성은 전부 제거)를
// 기본으로 하되, style만 관련 태그에 한해 허용한다. style 값 자체는
// allowedStyles가 속성별로 화이트리스트 정규식 검증하므로, onclick 같은 다른
// 속성 주입이나 style 안의 위험한 값(javascript: URL 등)은 여전히 막힌다.
const STYLED_TAGS = [
  "p",
  "div",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "blockquote",
];

const COLOR_PATTERN = /^#(0x)?[0-9a-f]+$|^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i;
const LENGTH_PATTERN = /^\d+(\.\d+)?(px|em|rem|%)$/;

export function sanitizeDocHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "br",
      "hr",
      "div",
      "span",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "blockquote",
    ],
    allowedAttributes: Object.fromEntries(STYLED_TAGS.map((tag) => [tag, ["style"]])),
    allowedStyles: {
      "*": {
        color: [COLOR_PATTERN],
        "background-color": [COLOR_PATTERN],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^(none|underline|line-through)$/],
        "text-align": [/^(left|center|right|justify)$/],
        border: [/^[\d.]+(px|em) (solid|dashed|dotted) #[0-9a-f]+$/i],
        "border-color": [COLOR_PATTERN],
        "border-width": [LENGTH_PATTERN],
        "border-style": [/^(solid|dashed|dotted|none)$/],
        padding: [LENGTH_PATTERN],
        margin: [LENGTH_PATTERN],
        width: [LENGTH_PATTERN],
      },
    },
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run lib/sanitize-doc-html.test.ts`
Expected: PASS (전체) — 단, "style 안에 위험한 값" 테스트는 `sanitize-html`이 `background-image` 속성 자체를 화이트리스트에 안 넣었으므로 통째로 제거되는 것으로 통과한다(허용 안 한 속성은 값과 무관하게 제거되는 것도 안전한 결과이므로 정상).

- [ ] **Step 5: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add lib/sanitize-doc-html.ts lib/sanitize-doc-html.test.ts
git commit -m "feat(lib): 붙여넣은 색상/배경/표 서식이 저장 시 사라지지 않도록 sanitizer 확장"
```

---

## Task 2: `AutoGrowTextarea` 공용 컴포넌트 + 세션뷰 서술형/목차/제목 서식 적용

**Files:**
- Create: `app/session/[id]/AutoGrowTextarea.tsx`
- Create: `app/session/[id]/AutoGrowTextarea.test.tsx`
- Modify: `app/session/[id]/MaterialTab.tsx`
- Modify: `app/session/[id]/MaterialTab.test.tsx`

**Interfaces:**
- Produces: `AutoGrowTextarea` 컴포넌트 — `{ value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean; className?: string }` props. Task 5(`LibraryDocView.tsx`)가 `@/app/session/[id]/AutoGrowTextarea`로 import해서 사용.

- [ ] **Step 1: `AutoGrowTextarea` 실패하는 테스트 작성**

`app/session/[id]/AutoGrowTextarea.test.tsx` 신규 생성:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AutoGrowTextarea from "./AutoGrowTextarea";

describe("AutoGrowTextarea", () => {
  it("입력값을 표시하고 변경 시 onChange를 호출한다", () => {
    const onChange = vi.fn();
    render(<AutoGrowTextarea value="초기값" onChange={onChange} placeholder="입력하세요" />);
    const textarea = screen.getByPlaceholderText("입력하세요") as HTMLTextAreaElement;
    expect(textarea.value).toBe("초기값");
    fireEvent.change(textarea, { target: { value: "새 값" } });
    expect(onChange).toHaveBeenCalledWith("새 값");
  });

  it("내용이 늘어나면 높이를 scrollHeight에 맞춰 늘린다", () => {
    render(<AutoGrowTextarea value="" onChange={vi.fn()} placeholder="입력하세요" />);
    const textarea = screen.getByPlaceholderText("입력하세요") as HTMLTextAreaElement;
    Object.defineProperty(textarea, "scrollHeight", { value: 240, configurable: true });
    fireEvent.change(textarea, { target: { value: "여러 줄\n텍스트\n입니다" } });
    expect(textarea.style.height).toBe("240px");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run app/session/\[id\]/AutoGrowTextarea.test.tsx`
Expected: FAIL — 모듈 `./AutoGrowTextarea`를 찾을 수 없음

- [ ] **Step 3: `AutoGrowTextarea.tsx` 작성**

`app/session/[id]/AutoGrowTextarea.tsx` 신규 생성:

```tsx
"use client";

export default function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => {
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
        onChange(el.value);
      }}
      rows={1}
      className={
        className ??
        "w-full min-h-[90px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] resize-none overflow-hidden"
      }
    />
  );
}
```

- [ ] **Step 4: `AutoGrowTextarea` 테스트 통과 확인**

Run: `npx vitest run app/session/\[id\]/AutoGrowTextarea.test.tsx`
Expected: PASS

- [ ] **Step 5: `MaterialTab.tsx`의 서술형 입력을 `AutoGrowTextarea`로 교체하는 테스트 추가**

`app/session/[id]/MaterialTab.test.tsx`에서 essay 포맷 문제를 다루는 기존 테스트를 찾아(없다면 `describe` 블록 끝에) 아래 테스트 추가:

```tsx

  it("서술형 입력창은 내용이 늘어나면 높이가 자동으로 커진다", () => {
    const essayMaterial: MaterialData = {
      ...material,
      sections: [
        {
          ...material!.sections[0],
          problems: [
            {
              id: "prob-essay",
              format: "essay",
              passage: "이 문장을 서술하세요.",
              options: null,
              correctIndex: null,
              explanation: "모범답안",
              difficulty: "medium",
              skillType: null,
              priorWrongCount: 0,
              correct: null,
              done: false,
              submittedResponse: null,
            },
          ],
        },
      ],
    };
    render(
      <MaterialTab
        sessionId="session-1"
        studentId="student-1"
        material={essayMaterial}
        viewerRole="student"
        tipsVisible={false}
      />
    );
    const textarea = screen.getByPlaceholderText("답안을 입력하세요") as HTMLTextAreaElement;
    Object.defineProperty(textarea, "scrollHeight", { value: 200, configurable: true });
    fireEvent.change(textarea, { target: { value: "긴 답안입니다" } });
    expect(textarea.style.height).toBe("200px");
  });
```

(위 테스트가 참조하는 `material` 변수는 이 파일 상단에 이미 정의된 기존 픽스처를 그대로 쓴다 — `material!.sections[0]`로 첫 섹션의 다른 필드를 재사용.)

- [ ] **Step 6: 테스트가 실패하는지 확인**

Run: `npx vitest run app/session/\[id\]/MaterialTab.test.tsx`
Expected: FAIL — `textarea.style.height`가 `""`(빈 문자열)이라 `"200px"`와 불일치(현재 고정 높이 textarea라 자동 확장 로직이 없음)

- [ ] **Step 7: `MaterialTab.tsx`에서 서술형 textarea를 `AutoGrowTextarea`로 교체 + 목차 스크롤 스페이서 + 섹션 제목 서식**

`app/session/[id]/MaterialTab.tsx` 상단 import에 추가:

```tsx
import AutoGrowTextarea from "./AutoGrowTextarea";
```

기존 essay 블록(`ProblemCard` 함수 안, `{problem.format === "essay" && (...)}`)의 `<textarea .../>` 부분을 교체:

```tsx
              <AutoGrowTextarea
                value={essayText}
                onChange={setEssayText}
                placeholder="답안을 입력하세요"
              />
```

섹션 제목 `<h2>` 스타일을 교체(`{material.sections.map((s) => ( <div key={s.id} id={\`sec-${s.id}\`} ...>` 블록 안):

```tsx
                <h2 className="text-[22px] font-extrabold text-[#0b2545] mb-3">
                  {s.title}
                </h2>
```

`material.sections.map(...)`가 끝나는 지점(`VocabClickLayer`의 마지막 자식, `))}` 바로 뒤) 뒤에 스크롤 스페이서 추가:

```tsx
            ))}
            <div className="h-[60vh]" aria-hidden />
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npx vitest run app/session/\[id\]/MaterialTab.test.tsx app/session/\[id\]/AutoGrowTextarea.test.tsx`
Expected: PASS (전체)

- [ ] **Step 9: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 10: 커밋**

```bash
git add app/session/\[id\]/AutoGrowTextarea.tsx app/session/\[id\]/AutoGrowTextarea.test.tsx app/session/\[id\]/MaterialTab.tsx app/session/\[id\]/MaterialTab.test.tsx
git commit -m "feat(session): 서술형 입력창 자동 확장 + 목차 마지막 섹션 스크롤 스페이서 + 섹션 제목 서식 다듬기"
```

---

## Task 3: `materials-data.ts` — `LibraryProblem`에 시도 상태 추가, `loadLibraryDoc`에 studentId 반영

**Files:**
- Modify: `app/student/materials-data.ts`
- Test: `app/student/materials-data.test.ts` (신규 파일)

**Interfaces:**
- Consumes: 없음(독립).
- Produces: `LibraryProblem`에 `priorWrongCount: number`, `correct: boolean | null`, `done: boolean`, `submittedResponse: string | null` 필드 추가. `loadLibraryDoc(supabase, docId, studentId: string | null): Promise<LibraryDocDetail | null>` — `studentId`가 있으면 `session_problem_attempts`(session_id가 null인 것만)를 조회해 시도 상태를 재구성한다. Task 4(`page.tsx`)와 Task 5(`LibraryDocView.tsx`)가 사용.

`app/session/[id]/material-data.ts`의 `loadMaterialData`가 이미 쓰는 패턴(문제별 시도 목록 → wrongCount/correct/done/submittedResponse 재구성)을 그대로 가져오되, `session_id`를 특정 세션으로 필터링하는 대신 `is("session_id", null)`로 필터링한다.

- [ ] **Step 1: 실패하는 테스트 추가**

`app/student/materials-data.test.ts` 신규 생성:

```ts
import { describe, expect, it, vi } from "vitest";
import { loadLibraryDoc } from "./materials-data";

function makeSupabaseMock(attempts: { problem_id: string; correct: boolean | null; response: unknown }[]) {
  const tables: Record<string, unknown> = {
    curriculum_docs: [{ id: "doc1", title: "이차방정식", status: "published" }],
    curriculum_doc_sections: [
      { id: "sec1", position: 1, title: "개념", body: "<p>본문</p>" },
    ],
    problems: [
      {
        id: "prob1",
        format: "mc",
        passage: "판별식이 0이면?",
        options: ["A", "B"],
        correct_index: 1,
        explanation: "해설",
        difficulty: "easy",
        skill_type: null,
        section_id: "sec1",
      },
    ],
  };

  return {
    from: (table: string) => {
      if (table === "session_problem_attempts") {
        const builder = {
          select: () => builder,
          is: () => builder,
          eq: () => builder,
          in: () => Promise.resolve({ data: attempts }),
          order: () => Promise.resolve({ data: attempts }),
        };
        return builder;
      }
      const rows = (tables[table] as unknown[]) ?? [];
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => Promise.resolve({ data: rows }),
        order: () => Promise.resolve({ data: rows }),
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null }),
      };
      return builder;
    },
  } as never;
}

describe("loadLibraryDoc", () => {
  it("studentId가 있으면 이전 시도 기록으로 done/correct 상태를 재구성한다", async () => {
    const supabase = makeSupabaseMock([
      { problem_id: "prob1", correct: true, response: 1 },
    ]);
    const doc = await loadLibraryDoc(supabase, "doc1", "student1");
    const problem = doc!.sections[0].problems[0];
    expect(problem.done).toBe(true);
    expect(problem.correct).toBe(true);
  });

  it("studentId가 없으면(교사/학부모 등) 시도 상태를 조회하지 않고 done=false로 반환한다", async () => {
    const supabase = makeSupabaseMock([]);
    const doc = await loadLibraryDoc(supabase, "doc1", null);
    const problem = doc!.sections[0].problems[0];
    expect(problem.done).toBe(false);
    expect(problem.correct).toBe(null);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run app/student/materials-data.test.ts`
Expected: FAIL — `loadLibraryDoc`이 아직 2개 인자만 받고, `problem.done`/`problem.correct`가 `undefined`

- [ ] **Step 3: `LibraryProblem` 타입 확장**

`app/student/materials-data.ts`의 `LibraryProblem` 타입(현재)을 교체:

```ts
export type LibraryProblem = {
  id: string;
  format: "mc" | "essay" | "math";
  passage: string;
  options: string[] | null;
  correctIndex: number | null;
  explanation: string;
  difficulty: string | null;
  skillType: string | null;
  priorWrongCount: number;
  correct: boolean | null;
  done: boolean;
  submittedResponse: string | null;
};
```

- [ ] **Step 4: `loadLibraryDoc`에 `studentId` 파라미터와 시도 상태 재구성 반영**

`app/student/materials-data.ts`의 `loadLibraryDoc` 함수 전체를 교체:

```ts
export async function loadLibraryDoc(
  supabase: SupabaseClient,
  docId: string,
  studentId: string | null
): Promise<LibraryDocDetail | null> {
  const { data: doc } = await supabase
    .from("curriculum_docs")
    .select("id, title")
    .eq("id", docId)
    .eq("status", "published")
    .maybeSingle();
  if (!doc) return null;

  const { data: sections } = await supabase
    .from("curriculum_doc_sections")
    .select("id, position, title, body")
    .eq("curriculum_doc_id", docId)
    .order("position", { ascending: true });

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: problems } = sectionIds.length
    ? await supabase
        .from("problems")
        .select(
          "id, format, passage, options, correct_index, explanation, difficulty, skill_type, section_id"
        )
        .in("section_id", sectionIds)
        .eq("status", "confirmed")
    : { data: [] as never[] };

  const problemIds = (problems ?? []).map((p) => p.id);

  const { data: attempts } = studentId && problemIds.length
    ? await supabase
        .from("session_problem_attempts")
        .select("problem_id, correct, response")
        .is("session_id", null)
        .eq("student_id", studentId)
        .in("problem_id", problemIds)
    : { data: [] as { problem_id: string; correct: boolean | null; response: unknown }[] };

  function buildProblem(p: NonNullable<typeof problems>[number]): LibraryProblem {
    const attemptsForProblem = (attempts ?? []).filter(
      (a) => a.problem_id === p.id
    );
    const wrongCount = attemptsForProblem.filter((a) => a.correct === false).length;
    const correctAttempt = attemptsForProblem.find((a) => a.correct === true);
    const correct = correctAttempt ? true : wrongCount >= 3 ? false : null;
    const done = correct !== null;
    const lastResponse = attemptsForProblem.at(-1)?.response ?? null;

    return {
      id: p.id,
      format: p.format,
      passage: p.passage,
      options: p.options,
      correctIndex: p.correct_index,
      explanation: p.explanation,
      difficulty: p.difficulty,
      skillType: p.skill_type,
      priorWrongCount: wrongCount,
      correct,
      done,
      submittedResponse:
        p.format !== "mc" && typeof lastResponse === "string" ? lastResponse : null,
    };
  }

  const problemsBySection = new Map<string, LibraryProblem[]>();
  (problems ?? []).forEach((p) => {
    const list = problemsBySection.get(p.section_id) ?? [];
    list.push(buildProblem(p));
    problemsBySection.set(p.section_id, list);
  });

  return {
    id: doc.id,
    title: doc.title,
    sections: (sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      body: s.body ?? "",
      problems: problemsBySection.get(s.id) ?? [],
    })),
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run app/student/materials-data.test.ts`
Expected: PASS

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit`
Expected: `app/materials/[id]/page.tsx`(Task 4에서 고침)와 `LibraryDocView.tsx`(Task 5에서 고침)에서 `loadLibraryDoc` 인자 개수/타입 불일치 에러가 나는 게 정상. 이 태스크에서 건드린 두 파일 자체는 에러가 없어야 한다.

- [ ] **Step 7: 커밋**

```bash
git add app/student/materials-data.ts app/student/materials-data.test.ts
git commit -m "feat(student): LibraryProblem에 시도 상태 추가, loadLibraryDoc이 studentId로 이전 시도 재구성"
```

---

## Task 4: `app/materials/[id]/page.tsx` — 뷰어 역할/studentId 배선

**Files:**
- Modify: `app/materials/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3의 `loadLibraryDoc(supabase, docId, studentId)`.
- Produces: `LibraryDocView`에 `viewerRole: SessionViewViewer`, `studentId: string | null` prop 전달 — Task 5가 사용.

이 파일은 서버 컴포넌트라 이 플랜의 다른 파일들과 달리 직접 테스트하는 관례가 이 repo에는 없다(`app/admin/page.tsx` 등도 테스트 없음) — 이 태스크는 테스트 없이 진행하고, Task 5의 `LibraryDocView.test.tsx`가 실제 동작을 검증한다.

- [ ] **Step 1: `page.tsx` 전체 교체**

`app/materials/[id]/page.tsx` 파일 전체를 아래로 교체:

```tsx
import { requireUser } from "@/lib/auth";
import { loadLibraryDoc } from "@/app/student/materials-data";
import LibraryDocView from "./LibraryDocView";
import type { SessionViewViewer } from "@/lib/session-view";

export default async function MaterialsLibraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile, supabase } = await requireUser();

  const role = (profile?.role ?? "parent") as SessionViewViewer;
  const studentId = role === "student" ? user.id : null;

  const doc = await loadLibraryDoc(supabase, id, studentId);

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <p className="text-[14px] text-grey-500">
          교재를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  return <LibraryDocView doc={doc} viewerRole={role} studentId={studentId} />;
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: `LibraryDocView`가 아직 `viewerRole`/`studentId` props를 안 받으므로(Task 5 전) 에러 발생 — 이 태스크에서는 정상. `page.tsx` 자체 문법 에러만 없으면 된다(즉 `requireUser`/`SessionViewViewer`/`loadLibraryDoc` import 관련 에러가 없는지만 확인).

- [ ] **Step 3: 커밋**

```bash
git add app/materials/\[id\]/page.tsx
git commit -m "feat(materials): 라이브러리 페이지가 뷰어 역할과 studentId를 조회해 전달"
```

---

## Task 5: `LibraryDocView.tsx` — `LibraryProblemCard`로 교체 (핵심 버그 수정)

**Files:**
- Modify: `app/materials/[id]/LibraryDocView.tsx`
- Modify: `app/materials/[id]/LibraryDocView.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `AutoGrowTextarea`(`@/app/session/[id]/AutoGrowTextarea`), Task 3의 `LibraryProblem`(시도 상태 필드 포함), Task 4의 `viewerRole`/`studentId` props, `app/session/[id]/MathCanvas.tsx`(`{ onSubmit: (dataUrl: string) => void; submitting: boolean }`), `app/session/[id]/problemlog-actions.ts`의 `retryMcAttempt(problemId, selectedIndex)`/`retryEssayAttempt(problemId, text)`/`retryMathAttempt(problemId, dataUrl)`.

- [ ] **Step 1: 기존 테스트를 새 동작(정답 유출 금지)에 맞게 전면 교체**

`app/materials/[id]/LibraryDocView.test.tsx` 파일 전체를 아래로 교체:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LibraryDocView from "./LibraryDocView";
import * as problemlogActions from "@/app/session/[id]/problemlog-actions";
import type { LibraryDocDetail } from "@/app/student/materials-data";

vi.mock("@/app/session/[id]/problemlog-actions", () => ({
  retryMcAttempt: vi.fn(),
  retryEssayAttempt: vi.fn(),
  retryMathAttempt: vi.fn(),
}));

const doc: LibraryDocDetail = {
  id: "doc1",
  title: "이차방정식 개념 정리",
  sections: [
    {
      id: "sec1",
      title: "Lesson Overview",
      body: "<p>판별식을 이용하면 실근의 개수를 알 수 있습니다.</p>",
      problems: [
        {
          id: "p1",
          format: "mc",
          passage: "판별식이 0이면?",
          options: ["서로 다른 두 실근", "중근"],
          correctIndex: 1,
          explanation: "D=0이면 중근을 가집니다.",
          difficulty: "easy",
          skillType: "개념 문제",
          priorWrongCount: 0,
          correct: null,
          done: false,
          submittedResponse: null,
        },
      ],
    },
  ],
};

describe("LibraryDocView", () => {
  it("제목, 목차, 본문을 보여준다", () => {
    render(<LibraryDocView doc={doc} viewerRole="student" studentId="student1" />);
    expect(screen.getByText("이차방정식 개념 정리")).toBeInTheDocument();
    expect(screen.getByText("목차")).toBeInTheDocument();
    expect(
      screen.getByText(/판별식을 이용하면 실근의 개수를 알 수 있습니다/)
    ).toBeInTheDocument();
  });

  it("학생에게는 정답과 해설이 풀기 전까지 보이지 않는다", () => {
    render(<LibraryDocView doc={doc} viewerRole="student" studentId="student1" />);
    expect(screen.getByText("판별식이 0이면?")).toBeInTheDocument();
    expect(screen.queryByText("D=0이면 중근을 가집니다.")).not.toBeInTheDocument();
    expect(screen.queryByText(/border-green|bg-green-bg/)).not.toBeInTheDocument();
  });

  it("학생이 객관식을 클릭하고 채점하면 정답을 맞혔을 때만 해설이 보인다", async () => {
    vi.mocked(problemlogActions.retryMcAttempt).mockResolvedValue({
      correct: true,
      attemptNumber: 1,
      done: true,
      correctIndex: 1,
    });
    render(<LibraryDocView doc={doc} viewerRole="student" studentId="student1" />);
    fireEvent.click(screen.getByText("중근"));
    fireEvent.click(screen.getByText("채점하기"));
    await waitFor(() =>
      expect(problemlogActions.retryMcAttempt).toHaveBeenCalledWith("p1", 1)
    );
    await waitFor(() =>
      expect(screen.getByText("D=0이면 중근을 가집니다.")).toBeInTheDocument()
    );
  });

  it("선생님/관리자에게는 정답과 해설이 항상 보이고 입력은 불가능하다", () => {
    render(<LibraryDocView doc={doc} viewerRole="teacher" studentId={null} />);
    expect(screen.getByText("D=0이면 중근을 가집니다.")).toBeInTheDocument();
    expect(screen.queryByText("채점하기")).not.toBeInTheDocument();
  });

  it("학부모에게는 정답/해설/선택지가 전부 숨겨지고 안내 문구만 보인다", () => {
    render(<LibraryDocView doc={doc} viewerRole="parent" studentId={null} />);
    expect(screen.getByText("판별식이 0이면?")).toBeInTheDocument();
    expect(screen.queryByText("중근")).not.toBeInTheDocument();
    expect(screen.queryByText("D=0이면 중근을 가집니다.")).not.toBeInTheDocument();
    expect(
      screen.getByText("이 문제는 학생 계정으로 로그인해야 풀 수 있습니다.")
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run app/materials/\[id\]/LibraryDocView.test.tsx`
Expected: FAIL — `LibraryDocView`가 아직 `viewerRole`/`studentId` props를 받지 않고, 현재 구현은 정답을 항상 노출

- [ ] **Step 3: `LibraryDocView.tsx` 전체 교체**

`app/materials/[id]/LibraryDocView.tsx` 파일 전체를 아래로 교체:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { LibraryDocDetail, LibraryProblem } from "@/app/student/materials-data";
import type { SessionViewViewer } from "@/lib/session-view";
import {
  retryEssayAttempt,
  retryMathAttempt,
  retryMcAttempt,
} from "@/app/session/[id]/problemlog-actions";
import MathCanvas from "@/app/session/[id]/MathCanvas";
import AutoGrowTextarea from "@/app/session/[id]/AutoGrowTextarea";

const DIFF_LABEL: Record<string, string> = {
  easy: "쉬움",
  medium: "보통",
  hard: "어려움",
};

export default function LibraryDocView({
  doc,
  viewerRole,
  studentId,
}: {
  doc: LibraryDocDetail;
  viewerRole: SessionViewViewer;
  studentId: string | null;
}) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    doc.sections[0]?.id ?? null
  );
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    observerRef.current?.disconnect();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSectionId(entry.target.id.replace("sec-", ""));
          }
        });
      },
      { rootMargin: "-15% 0px -70% 0px" }
    );
    doc.sections.forEach((s) => {
      const el = document.getElementById(`sec-${s.id}`);
      if (el) observer.observe(el);
    });
    observerRef.current = observer;
    return () => observer.disconnect();
  }, [doc]);

  function scrollToSection(id: string) {
    document
      .getElementById(`sec-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-grey-200 px-6 py-3">
        <div className="text-[11px] font-bold text-grey-500 mb-0.5">
          📖 교재 라이브러리
        </div>
        <div className="text-[15px] font-bold text-ink">{doc.title}</div>
      </div>

      <div className="grid grid-cols-[220px_1fr]">
        <nav className="border-r border-grey-200 p-4 sticky top-0 self-start h-[calc(100vh-56px)] overflow-y-auto">
          <div className="text-[10.5px] font-extrabold text-grey-300 uppercase tracking-wider px-2 mb-1">
            목차
          </div>
          {doc.sections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={
                "w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] mb-0.5 " +
                (activeSectionId === s.id
                  ? "bg-red-bg text-red font-bold"
                  : "text-grey-500 hover:bg-grey-100")
              }
            >
              <span
                className={
                  "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 " +
                  (activeSectionId === s.id ? "bg-red" : "bg-grey-300")
                }
              />
              {s.title}
            </button>
          ))}
        </nav>

        <div className="max-w-[720px] px-8 py-8">
          {doc.sections.map((s) => (
            <div key={s.id} id={`sec-${s.id}`} className="mb-11 scroll-mt-[72px]">
              <h2 className="text-[22px] font-extrabold text-[#0b2545] mb-3">
                {s.title}
              </h2>
              <div
                className="text-[14px] leading-[1.75] text-ink [&_b]:font-bold"
                dangerouslySetInnerHTML={{ __html: s.body }}
              />
              {s.problems.map((p) => (
                <LibraryProblemCard
                  key={p.id}
                  problem={p}
                  viewerRole={viewerRole}
                  studentId={studentId}
                />
              ))}
            </div>
          ))}
          <div className="h-[60vh]" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function LibraryProblemCard({
  problem,
  viewerRole,
}: {
  problem: LibraryProblem;
  viewerRole: SessionViewViewer;
  studentId: string | null;
}) {
  const isStudent = viewerRole === "student";
  const isTeacherLike = viewerRole === "teacher" || viewerRole === "admin";

  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(problem.done);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [essayText, setEssayText] = useState("");
  const [submittedResponse, setSubmittedResponse] = useState(
    problem.submittedResponse
  );

  const tags = [
    problem.skillType,
    problem.difficulty ? DIFF_LABEL[problem.difficulty] : null,
  ].filter((v): v is string => !!v);

  async function handleGradeMc() {
    if (selected === null || submitting) return;
    setSubmitting(true);
    try {
      const result = await retryMcAttempt(problem.id, selected);
      if (!result.done) {
        setMessage("오답입니다. 다시 선택해보세요.");
        setTimeout(() => {
          setSelected(null);
          setMessage(null);
        }, 1200);
      } else {
        setDone(true);
        setMessage(result.correct ? "정답입니다!" : "정답을 확인하세요.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "채점 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitEssay() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await retryEssayAttempt(problem.id, essayText);
      setSubmittedResponse(essayText.trim());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "제출 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitMath(dataUrl: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await retryMathAttempt(problem.id, dataUrl);
      setSubmittedResponse(dataUrl);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "제출 중 오류가 발생했어요.");
    } finally {
      setSubmitting(false);
    }
  }

  const showAnswer = isTeacherLike || done || !!submittedResponse;

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 my-4">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-grey-100 text-grey-500"
          >
            {t}
          </span>
        ))}
      </div>

      {isTeacherLike && problem.format === "mc" && problem.correctIndex !== null && (
        <div className="inline-block mb-2 text-[11px] font-bold px-2.5 py-1 rounded-md bg-ink text-white">
          정답: {String.fromCharCode(65 + problem.correctIndex)}
        </div>
      )}

      <p className="text-[14px] leading-[1.75] text-ink mb-3.5 whitespace-pre-wrap">
        {problem.passage}
      </p>

      {!isStudent && !isTeacherLike && (
        <p className="text-[12.5px] text-grey-500">
          이 문제는 학생 계정으로 로그인해야 풀 수 있습니다.
        </p>
      )}

      {isStudent && problem.format === "mc" && problem.options && (
        <>
          <div className="flex flex-col gap-2 mb-1.5">
            {problem.options.map((opt, i) => {
              const isSelected = selected === i;
              const isCorrectChoice = done && i === problem.correctIndex;
              const isWrongChoice = done && isSelected && !isCorrectChoice;
              return (
                <button
                  key={i}
                  disabled={done}
                  onClick={() => setSelected(i)}
                  className={
                    "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[13.5px] text-left " +
                    (isCorrectChoice
                      ? "border-green bg-green-bg text-green"
                      : isWrongChoice
                        ? "border-red bg-red-bg text-red"
                        : isSelected
                          ? "border-ink bg-grey-100"
                          : "border-grey-200") +
                    (done ? " cursor-default opacity-90" : " cursor-pointer")
                  }
                >
                  <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-grey-300 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
          {!done && (
            <div className="flex items-center gap-2.5 mt-3">
              <button
                disabled={selected === null || submitting}
                onClick={handleGradeMc}
                className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
              >
                채점하기
              </button>
              {message && (
                <span className="text-[12.5px] text-grey-500">{message}</span>
              )}
            </div>
          )}
        </>
      )}

      {isTeacherLike && problem.format === "mc" && problem.options && (
        <div className="flex flex-col gap-2 mb-1.5">
          {problem.options.map((opt, i) => (
            <div
              key={i}
              className={
                "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] border-[1.5px] text-[13.5px] " +
                (i === problem.correctIndex
                  ? "border-green bg-green-bg text-green"
                  : "border-grey-200")
              }
            >
              <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-grey-300 flex items-center justify-center text-[11px] font-extrabold flex-shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}

      {isStudent && problem.format === "essay" && (
        <>
          {!submittedResponse && (
            <>
              <AutoGrowTextarea
                value={essayText}
                onChange={setEssayText}
                placeholder="답안을 입력하세요"
              />
              <div className="mt-3">
                <button
                  disabled={submitting}
                  onClick={handleSubmitEssay}
                  className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
                >
                  제출하기
                </button>
              </div>
            </>
          )}
          {submittedResponse && (
            <div className="bg-grey-100 rounded-lg px-3.5 py-3 text-[13px] text-ink whitespace-pre-wrap">
              {submittedResponse}
            </div>
          )}
        </>
      )}

      {isStudent && problem.format === "math" && (
        <>
          {!submittedResponse && (
            <MathCanvas onSubmit={handleSubmitMath} submitting={submitting} />
          )}
          {submittedResponse && submittedResponse.startsWith("data:") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={submittedResponse}
              alt="제출한 풀이"
              className="border border-grey-200 rounded-lg max-w-full"
            />
          )}
        </>
      )}

      {showAnswer && (
        <div className="bg-grey-100 rounded-lg px-3.5 py-3 text-[13px] text-grey-700 leading-[1.6] mt-3">
          <b className="text-ink">해설</b>
          <br />
          {problem.explanation}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run app/materials/\[id\]/LibraryDocView.test.tsx`
Expected: PASS (전체)

- [ ] **Step 5: 전체 관련 테스트 + 타입체크**

Run: `npx vitest run app/materials/ app/session/\[id\]/ app/student/ lib/sanitize-doc-html.test.ts && npx tsc --noEmit`
Expected: 전부 PASS, tsc 에러 없음

- [ ] **Step 6: `docs/tickets.md`에 항목 반영**

`docs/tickets.md`에서 052/070 관련 티켓(교재 편집기/세션뷰) 근처에 아래 줄 추가:

```markdown
  - [x] 교재 라이브러리 화면의 문제 답 유출 버그 수정 + 실제 풀이 UI(객관식 클릭채점/서술형 자동확장 타이핑/수학 캔버스) 적용, 붙여넣기 서식(색상/배경/표) 보존, 목차 마지막 섹션 스크롤 버그 수정 (2026-08-29)
```

- [ ] **Step 7: 커밋**

```bash
git add app/materials/\[id\]/LibraryDocView.tsx app/materials/\[id\]/LibraryDocView.test.tsx docs/tickets.md
git commit -m "fix(materials): 교재 라이브러리 문제 답 유출 버그 수정 + 실제 풀이 UI 적용"
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

관리자로 로그인해 교재를 만들고 구글독스에서 색상/표가 있는 내용을 복사해 섹션 본문에 붙여넣기 → 배포 → 학생 계정으로 `/materials/[교재ID]` 열어서: 서식이 유지되는지, 객관식 문제를 클릭해서 채점되는지(정답 전엔 안 보임), 서술형 입력창이 늘어나는지, 수학 문제에 캔버스가 뜨는지, 목차 마지막 항목 클릭 시 정확히 스크롤되는지 확인. 이어서 관리자/교사 계정으로 같은 페이지 열어서 정답/해설이 바로 보이는지 확인.
