# 키워드 폴더 관리 설계 (2026-10-08)

## 현재 구조 (조사 결과)
- 키워드 원본: `subject_keywords`(과목별, `label`·`normalized_label`·`status`·`domain_code`·`skill_code`). 회차/교재/문제/오버레이는 모두 keyword **id**로 참조한다.
- 폴더(INFORMATION AND IDEAS 등)는 DB 테이블이 아니라 코드 하드코딩이다: `lib/problem-taxonomy.ts`의 `SAT_DOMAINS` 8개 + `lib/sat-keywords/group.ts`(`groupKeywordsByDomain`)가 `domain_code`(없으면 `skill_code`→도메인)로 묶고, 도메인이 없으면 "기타/Other". 그래서 관리자가 바꿀 수 없다.
- 선택 UI(`GroupedKeywordList`/`GroupedKeywordOptions`)는 `group.ts`만 거치고, 키워드를 읽는 로더 7곳(admin subject-data, curriculum-doc-data, teacher student-curriculum-data/homework-composition-data/homework-direct-data/mysubjects-data, lib/unit-composition)이 `domain_code, skill_code`를 select한다.

## 데이터 모델 (additive)
- 신규 `subject_keyword_folders(id, subject_id → subjects on delete cascade, name, position, created_at)`; unique(subject_id, lower(btrim(name))).
- `subject_keywords`에 `folder_id uuid null → subject_keyword_folders on delete set null`, `sort_order int not null default 0` 추가.
  폴더 삭제 = `folder_id`가 null이 되어 "기타"로 떨어질 뿐 키워드·회차 연결은 그대로.
- 트리거: (1) 키워드의 폴더는 같은 과목 폴더여야 한다. (2) 새 키워드가 `domain_code`를 갖고 `folder_id`가 비어 있으면 그 과목의 기본 도메인 폴더(없으면 생성)에 자동 배정 → 기존 SAT 키워드 시드 스크립트가 그대로 동작.
- 시드: 기존 `domain_code` 키워드를 (과목, 도메인) 폴더로 만들어 배정(영역 순서대로 position). 도메인 없는 키워드는 폴더 없음(=기타).
- 회차 연결 테이블은 건드리지 않는다.

## 그룹핑 규칙 (`lib/sat-keywords/group.ts`)
- 로더가 `folderId`(없으면 null)를 내려주면 **폴더 모드**: 폴더 position 순 → 폴더 안은 `sort_order`, 스킬 사전 순, 이름 순; folderId null은 마지막 "기타". `folderId`가 undefined인 구 데이터(테스트 등)는 기존 도메인 모드 유지.

## 권한 (RLS)
- 신규 테이블: `인증된 사용자 전체 조회`(SELECT, `auth.uid() is not null`) + `관리자만 쓰기`(ALL, `is_admin()`) — `subject_keywords`와 동일. 쓰기 서버 액션은 `requireAdmin()` 후 사용자 세션 클라이언트(RLS가 최종 방어선).

## 서버 액션 (`app/admin/keyword-folder-actions.ts`)
- 폴더: 생성/이름 변경/삭제/순서 저장. 키워드: 폴더 이동(null=기타)·폴더 안 순서 저장·삭제.
- 키워드 삭제는 어떤 곳에서도 참조되지 않을 때만 허용(문제·회차·교재 태그가 cascade로 사라지는 것을 막음); 참조 중이면 거부 메시지.
- 이름 중복은 DB 제약 코드(23505)를 "이미 있는 폴더 이름" 메시지로 변환.

## UI: 과목 키워드 사전 (관리자 > Curriculum > 과목 템플릿 > 과목 상세)
- 상단: 검색 입력(이름 필터) + "폴더 추가" + "키워드 추가(이름 + 폴더 선택)". 접이식 폴더 섹션(제목 + 개수), 안쪽은 정돈된 칩 행.
- 폴더 헤더: 이름 바꾸기·삭제(확인: "키워드는 기타로 이동")·위/아래 이동. 칩: 클릭=이름 바꾸기, 이동 select(폴더 선택/기타), 위/아래, 삭제.
- 상태: 로딩(버튼 disabled + "저장 중…"), 오류(`role="alert"`), 빈 폴더/빈 과목/검색 결과 없음 안내, 키보드(버튼·select·details 기본 포커스), 모바일 폭에서 줄바꿈.
- 관리자 포털은 한국어 유지.
