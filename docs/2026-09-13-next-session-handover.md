# 다음 세션 인수인계 (2026-09-13)

이 문서 하나로 시작할 수 있게 정리했다. `docs/CURRENT.md`의 2026-09-12 항목들이
그 앞의 배경이다.

## 0. 기준선

| 항목 | 값 |
| --- | --- |
| 기준 커밋 | `e1a303e21a6e8480693d7adb469c63dc9e0f1673` |
| Preview | https://alton-8r0sbgydr-alton7.vercel.app |
| 최신 마이그레이션 | `20261316000000_p2_auto_link_next_unit.sql` |
| 공유 비프로덕션 | `worpsqwqgnspddnrtnvq` — `20261316`까지 적용 완료 |
| 테스트 기준선 | `npx supabase db reset --local && npx vitest run --no-file-parallelism` → 312 파일 / 2366 통과 |

Production 설정·Drive 자료는 이번 작업들에서 한 번도 건드리지 않았다.

## 1. 지금 할 일 (우선순위 순)

### (1) 선생님 '내 과목' 커리큘럼에 키워드가 없다 — **원인 특정 완료, 미수정**

관리자 과목 템플릿의 회차 키워드(`subject_template_unit_keywords`)가 교사 템플릿
(`teacher_curriculum_template_units`)으로 내려오지 않는다. 그 층에는 키워드 개념
자체가 없다. 그래서 교사가 배정받은 새 과목에서 키워드를 전부 새로 지정해야 한다.

학생 운영 커리큘럼(`curriculum_overlay_unit_keywords`)에는 상속이 동작한다
(`curriculum_overlay_units_inherit` 트리거, `20261309000000`). 교사 템플릿만 빠져 있다.

정할 것: 교사 템플릿에 키워드 층을 두고 상속시킬 것인가, 아니면 교사 템플릿을
표시 전용으로 두고 키워드는 학생 운영본에서만 다룰 것인가. 후자면 화면에서
"여기서는 키워드를 정하지 않는다"를 분명히 해야 한다.

### (2) 계약 발송이 막힌다 — 진단 경로 배포됨, 결과 확인 필요

관리자로 열면 어디서 막히는지 나온다(봉투를 만들지 않는다):

```
/api/admin/docusign-preflight
```

단계: `env`(설정 누락) → `real_calls_gate`(`DOCUSIGN_SANDBOX_ALLOW_REAL_CALLS`)
→ `jwt_token`(인증) → `account_read`(계정 접근). Preview에 DocuSign 환경변수는
8개 모두 설정돼 있고 값은 Secret이라 코드에서 읽을 수 없다.

### (3) 정리 대상 집계 재확인 — **보존 계정을 못 찾았다**

첫 집계에서 `official@alton.education`과 `teacher1@alton.education`이 **둘 다
`found:false`** 였다. 계정을 식별하지 못한 채로 정리를 시작하면 안 된다.

조회 로직을 고쳤다(auth 사용자 페이지를 끝까지 넘기고, 못 찾으면 드러나게
`preservedAllFound`·`staffAccounts`를 함께 돌려준다). 다시 열어야 한다:

```
/api/admin/cleanup-preview
```

이 경로는 읽기 전용이다(insert/update/delete를 부르지 않는 것을 정적 검사로 고정).

첫 집계 결과(참고): 사용자 109(교사 8·학부모 19·관리자 2·학생 80), 가구 19(아카이브 1),
과목 5(아카이브 4), 교재 1, 문제 0, 키워드 10, 운영 커리큘럼 23(활성 23),
매칭 v3 13·레거시 54, 미래 확정 예약 7, 수업 15(진행 중 0), 계약 32.

### (4) 데이터 정리 — **미착수**

선행조건 두 개가 남아 있다: (3)의 보존 계정 식별, 그리고 계약→수업권→정규 수업
**최소 점검**(정리 후에 새 UAT를 시작할 수단이 있는지 확인).

정리 방식은 비활성화·아카이브다. 삭제하지 않는다. `official@alton.education`과
`teacher1@alton.education`의 계정·로그인·권한은 유지하되, **그 계정에 걸린 오래된
테스트 배정·운영 커리큘럼·매칭도 정리 대상이다**(계정을 남긴다고 연결까지 활성으로
두지 않는다).

눈에 걸린다고 보고된 것들: `세온장`, `테스트 학생 7-1`, `테스트 과목 1`,
`테스트 학생 1`. 이 단계에서 한 번에 처리된다.

### (5) Drive — 로그인한 비관리자 차단 미확인

teacher1로 로그인해 `/api/admin/company-documents-preflight`가 403인지 확인.
미로그인 403은 이미 확인했고, 그건 "로그인한 비관리자도 막힌다"의 증거가 아니다.

Drive 나머지는 전부 확인 완료(폴더 목록·탐색·빈 폴더·파일 열기·다운로드·감사 기록).

## 2. 유지해야 할 확정 정책

- **자동 공개 없음**: 문제는 손으로 쓰든 AI가 만들든 draft로 들어오고, 검수 요청과
  공개를 사람이 누른다. 초안에는 공개 버튼이 렌더되지 않는다.
- **보관은 숨김이지 삭제가 아니다**: 신규 선택·자동 구성 후보에서만 빠지고, 기존
  연결과 과거 기록은 그대로 조회된다. 보관 때문에 과거 수업을 못 열면 안 된다.
- **초기 상속은 자동, 보정은 수동**: 회차를 처음 만들 때는 관리자 기준본이 자동으로
  내려온다. 이미 있는 회차를 나중에 채우는 것은 선생님이 눌러야 한다.
- **자동 갱신이 사람 손을 덮어쓰지 않는다**: `source=manual`과 제외 기록, 선생님이
  맞춘 순서는 자동 동기화가 건드리지 않는다.
- **과거 기록은 소급해 고치지 않는다**: 과거 수업의 `material_section` 매니페스트
  행은 그대로 읽는다. 정책이 바뀌었다고 과거의 사실을 바꾸지 않는다.
- **서버 액션은 예외를 던지지 않는다**: `{ ok, error }`로 돌려준다. 던진 예외는
  Production에서 Minified React error로 마스킹돼 사유가 사라진다.
- **내부 오류·ID·기술 상태값을 화면에 노출하지 않는다.**
- 관리자 문서 경로(회사 문서·preflight·교사 제출 서류)는 `requireAdmin()`.
  비관리자는 capability가 있어도 거부된다.
- Production 활성화, Wise 실송금, `CRON_SECRET` 설정은 하지 않는다.
- 다른 세션의 미커밋 변경을 대신 조작하지 않는다.

## 3. 상태 기록 (중요)

- teacher1 두 사례(보관 과목 해제 `#441`, 신규 담당 과목·교재 미반영)와
  **9월 14일 수업 사례**: 코드 수정과 회귀 테스트는 들어갔지만
  **'기존 사례 재검증 생략, 새 데이터 기반 전체 UAT로 대체'** 로 기록한다.
  해결·통과로 처리하지 않는다.
- 한 번 `homework-composition.integration.test.ts` 4건이 실패했다가 같은 기준선
  재실행에서 재현되지 않았다. 간헐 가능성을 배제하지 못했다.

## 4. 최근에 만든 것들 (어디를 보면 되는지)

| 기능 | 위치 |
| --- | --- |
| 문제은행 | `app/admin/ProblemBankTab.tsx`, `problem-bank-actions.ts`, `20261313000000` |
| 교재 단위 전환 | `20261314000000`, `20261315000000`, `app/session/[id]/session-content-data.ts` |
| 예약 자동 회차 연결 | `20261316000000`, `app/teacher/auto-link-next-unit.integration.test.ts` |
| 키워드 자동 구성 | `20261309000000`, `20261310000000` |
| 보관 분리 | `SubjectTemplateTab` / `CurriculumDocsTab` / `MySubjectsTab` |
| 집계·진단 경로 | `app/api/admin/cleanup-preview`, `docusign-preflight`, `company-documents-preflight` |
