# 교재 문서 편집기 업그레이드 설계

## 배경

052 티켓(`app/admin/CurriculumDocEditor.tsx` 등)으로 교재 문서 편집기의 기본 골격(섹션 CRUD, AI 문제 생성 초안→확정 흐름)은 이미 구현되어 있다. 그러나 실제 사용에 필요한 다음 기능들이 빠져 있다:

1. 리치텍스트 본문에 표(table) 삽입 불가 (스펙 `functional-spec.md:106`에는 명시되어 있으나 052 티켓에서 의도적으로 스코프 제외됨)
2. 섹션이 "개념 설명"과 "문제 생성" 구분 없이 하나의 형태(본문+티칭팁+문제 목록)로만 존재
3. 문제 포맷(객관식/서술형/수학 화이트보드형)이 데이터상으로는 구분되지만, 저작 UI는 3개 포맷 모두 동일한 제네릭 카드(지문+옵션 리스트+해설)라 각 포맷의 목적에 맞는 입력 필드가 없음
4. 교재 문서 자체를 삭제하는 기능이 없음 (섹션·문제는 삭제 가능하나 문서 단위 삭제는 불가)
5. "중간 저장" 관련 명확한 정책 부재

## 결정 사항 (사용자 확인 완료)

- 섹션 타입은 생성 시 한 번만 선택하며 이후 변경 불가 (타입 전환 UI 없음).
- 문서 삭제는 확인 단계(2단계 확인, `SubjectDetailEditor.tsx`와 동일 패턴)를 거치며, `status === 'published'`인 문서는 삭제 불가(배포 취소 후에만 삭제 가능).
- 저장은 기존처럼 필드별 `onBlur` 자동저장을 그대로 유지한다. 별도의 "임시저장" 버튼은 추가하지 않는다.

## 1. 섹션 타입

### 데이터 모델

`curriculum_doc_sections`에 컬럼 추가:

```sql
alter table curriculum_doc_sections
  add column section_type text not null default 'concept'
    check (section_type in ('concept', 'problem'));
```

기존 행은 전부 `concept`으로 마이그레이션(문제가 붙어있던 섹션도 `concept`으로 유지 — 기존 데이터는 본문+문제가 섞여 있었으므로 강제 분리하지 않는다. 새로 만드는 섹션부터 타입이 적용된다).

`DocSection` 타입(`curriculum-doc-data.ts`)에 `sectionType: "concept" | "problem"` 필드 추가.

### UI

`CurriculumDocEditor.tsx`의 "+ 섹션 추가" 버튼 클릭 시, 기존처럼 바로 섹션이 생성되는 대신 타입 선택 모달(또는 인라인 2버튼 선택지: "개념 설명 섹션" / "문제 생성 섹션")이 먼저 뜬다. 선택 후 `addSection(docId, position, sectionType)`으로 생성.

- **`concept` 섹션**: 현재와 동일한 렌더링 (제목 입력 + 본문 `RichTextEditable` + 티칭팁 `RichTextEditable`). 문제 목록/추가 UI는 노출하지 않는다.
- **`problem` 섹션**: 제목 입력만 있고, 본문·티칭팁 입력 필드는 렌더링하지 않는다. 문제 목록 + "+ 문제 추가" 버튼(AI 생성 패널)이 섹션 바로 아래 표시된다. 신규 `problem` 섹션은 문제가 0개인 상태에서 AI 생성 패널이 기본으로 펼쳐진 채 시작한다(빈 섹션을 만들고 바로 닫아버리는 걸 막기 위함).

## 2. 문제 포맷별 전용 저작 UI

지금 `ProblemGenPanel`의 AI 초안 카드(`CurriculumDocEditor.tsx:338-374`)와 확정된 문제 표시(`:241-259`)는 포맷과 무관하게 `passage` + `options`(있으면 목록) + `explanation`만 보여준다. 이를 포맷별로 분리한다.

### 공통

세 포맷 모두 편집 가능한 초안 카드 단계에서 지문(`passage`)과 해설(`explanation`)은 공통 필드로 유지. 포맷별 전용 필드만 아래처럼 추가/대체.

### 객관식 (`mc`)

- 선택지는 정확히 5개 고정 입력 필드(`options[0..4]`, 빈 문자열 허용 안 함 — 확정 시 5개 모두 채워졌는지 검증).
- 정답은 라디오 버튼으로 5개 중 하나 선택 (`correctIndex`).
- 데이터 모델(`options: string[]`, `correctIndex: number`)은 기존 그대로 사용 — UI만 5개 고정 입력으로 렌더링.

### 서술형 (`essay`)

- 선택지 UI 없음 (`options`/`correctIndex`는 항상 `null`).
- "모범답안" 필드를 `RichTextEditable`로 추가 — 채점 기준을 겸한다. 이 필드는 `explanation` 컬럼에 저장한다(별도 컬럼 추가하지 않음 — 기존 스키마에 essay 전용 컬럼이 없고, `explanation`이 이미 "해설" 의미로 채점기준을 담기에 적합).

### 수학 풀이-화이트보드형 (`math`)

- 지문과 모범풀이(`explanation`) 입력창 옆에 LaTeX 삽입 helper 버튼 3개: 위첨자(`x^2`), 분수(`\frac{}{}`), 근호(`\sqrt{}`) — 클릭 시 커서 위치에 해당 LaTeX 스니펫 텍스트를 삽입. 완전한 수식 렌더링(KaTeX 등)은 이번 스코프에 포함하지 않는다 — 저작자가 읽을 수 있는 텍스트 스니펫 삽입까지만.
- 선택지 UI 없음.
- (선택) 이미지 업로드 버튼 — 그래프/도형이 필요한 경우. 업로드된 이미지 URL은 `passage` 끝에 마크다운 이미지 문법(`![]()`)으로 덧붙이는 간단한 방식 사용(기존 이미지 업로드 인프라가 있으면 재사용, 없으면 이번 스코프에서 제외 가능 — 구현 태스크에서 기존 스토리지 유틸 존재 여부 확인 후 없으면 이 항목만 스킵).
- 안내 문구 고정 표시: "학생은 세션뷰의 화이트보드에서 직접 풀이를 작성합니다. 여기서는 문제와 모범풀이만 입력하세요." (스펙 `functional-spec.md:110`과 일치 — 화이트보드 자체는 저작 대상이 아님)

### AI 생성 초안

`generateSectionProblems`가 반환하는 초안(`Omit<DocProblem, "id">[]`)의 렌더링(`ProblemGenPanel`의 `drafts` 표시 블록)도 위 포맷별 구조로 분리한다. AI가 생성한 초안이라도 확정 전에 위 포맷별 입력 UI로 수정 가능해야 한다(현재는 읽기 전용 미리보기만 있고 수정 불가 — 이번 업그레이드로 초안 단계에서도 편집 가능하게 만든다).

## 3. 표(table) 삽입

`RichTextEditable.tsx` 툴바에 "표 삽입" 버튼 추가:
- 클릭 시 3행×3열 기본 표를 `document.execCommand('insertHTML', false, <table>...)`로 커서 위치에 삽입 (테두리 있는 `<table><tbody><tr><td>` 구조, 각 셀은 빈 내용에 placeholder 없이 편집 가능 상태).
- 표 자체에 행/열 추가·삭제 같은 고급 편집 UI는 만들지 않는다 — `contenteditable` 표 안에서 브라우저 기본 동작(탭 이동, 텍스트 입력)만 지원하고, 행/열 추가가 필요하면 저작자가 표를 지우고 다시 삽입.
- 서버 측 sanitize 허용 태그 목록(052 티켓에서 도입한 `sanitize-html` 설정, `lib/sanitize.ts` 또는 유사 파일)에 `table`, `thead`, `tbody`, `tr`, `th`, `td`를 추가.
- 최소 표 CSS(테두리, 패딩)를 전역 스타일 또는 `RichTextEditable.tsx`의 `.rte-editable` 스코프에 추가.

## 4. 문서 삭제

`curriculum-doc-actions.ts`에 `deleteCurriculumDoc(docId: string): Promise<void>` 추가:
- `status === 'published'`인 문서는 호출 시 에러 throw(`"배포된 교재는 삭제할 수 없습니다. 먼저 배포를 취소하세요."`) — UI에서도 버튼 자체를 비활성화하지만 서버에서도 재검증.
- 정상 삭제 시 `curriculum_doc_sections`(및 그 하위 `problems`)는 기존 FK `on delete cascade` 여부를 마이그레이션에서 확인 — cascade가 걸려 있으면 문서 행만 삭제, 없으면 섹션→문제 순으로 명시적 삭제 후 문서 삭제.

`CurriculumDocEditor.tsx` 하단(뒤로가기 버튼 반대편 또는 별도 하단 영역)에 "이 교재 삭제" 버튼:
- `SubjectDetailEditor.tsx`의 `confirmingDelete` 패턴과 동일하게 클릭 시 "정말 '{title}' 교재를 삭제하시겠습니까?" 확인 UI로 전환, 삭제/취소 버튼.
- `status === 'published'`이면 버튼 자체가 비활성화되고 "배포 취소 후 삭제할 수 있습니다" 안내 문구 표시.
- 삭제 성공 시 목록 화면(`CurriculumDocsTab.tsx`)으로 돌아가고 목록에서 제거.

## 5. 저장 정책

변경 없음 — 기존 필드별 `onBlur` 자동저장(제목, 본문, 티칭팁, 섹션 제목 등)을 그대로 유지한다. 신규 필드(문제 포맷별 입력, 표 삽입)도 동일한 자동저장 패턴을 따른다.

## 영향받는 파일 (구현 태스크에서 상세화 예정)

- `supabase/migrations/` — `section_type` 컬럼 추가 마이그레이션 (신규 파일)
- `app/admin/curriculum-doc-data.ts` — `DocSection.sectionType` 필드 추가, 로드 쿼리에 컬럼 추가
- `app/admin/curriculum-doc-actions.ts` — `addSection`에 `sectionType` 파라미터 추가, `deleteCurriculumDoc` 신규, 문제 CRUD를 포맷별 필드에 맞게 조정(essay는 `explanation`에 모범답안 저장 — 필드 의미만 UI 라벨로 구분, 스키마 변경 없음)
- `app/admin/CurriculumDocEditor.tsx` — 섹션 타입 선택 UI, 포맷별 문제 저작 UI 분리, 문서 삭제 UI
- `app/admin/RichTextEditable.tsx` — 표 삽입 버튼, LaTeX helper 버튼(문제 저작 패널 쪽에 별도로 필요하면 새 컴포넌트로 분리 검토)
- sanitize 허용 태그 설정 파일 — table 관련 태그 추가
- 관련 테스트: `CurriculumDocEditor.test.tsx`, `curriculum-doc-actions.test.ts`(있다면) 갱신

## 스코프 제외 (이번 업그레이드에 포함하지 않음)

- 완전한 LaTeX 렌더링(KaTeX/MathJax) — 텍스트 스니펫 삽입까지만
- 표 안에서 행/열 추가·삭제 등 고급 표 편집 UI
- 섹션 타입 사후 변경
- 문서 상태에 승인대기/반려 추가(052 티켓에서 이미 스코프 제외된 사항, 이번에도 유지)
