# 2026-09-18 — 문제은행 전수 감사 (모의고사 준비 Step 2)

비프로덕션(`worpsqwqgnspddnrtnvq`) `problems`/`problem_versions` 전 상태(검수/공개/보관) 대상
7개 기준 전수 감사. 읽기 전용 SQL(`npx supabase db query --linked`)로 데이터를 추출하고,
`lib/problem-generation/common-quality-gate.ts`의 `findBannedWords()` 금칙어 사전을 재사용한
Node 스크립트(`scripts/` 미보존, 스크래치패드 1회성)로 구조적 검사를 수행했다.

## 감사 대상

- 전체 `problems` 행: 528건 (draft 465 / confirmed 63)
- **이미 보관됨**(archived_at not null): 368건 — 305 draft + 63 confirmed. 전부
  `20261402000000_p5_archive_pre_language_fix_problems.sql`(2026-09-17, 컴파일러 언어 수정 이전
  일괄 보관)로 이미 보관 처리되어 있어 이번 감사의 재보관 대상이 아니다.
- **활성(archived_at is null) 감사 대상**: **160건, 전부 status=draft(검수 대기)**.
  활성 상태의 confirmed(공개) 문항은 **0건** — 즉 현재 공개 중인 문항이 없으므로
  공개 상태 관련 결정(기준 6)이 필요한 항목도 없다.

## 기준별 결과 (160건 기준)

| # | 기준 | 최초 자동탐지 실패 | 오탐 제외 후 실제 실패 | 비고 |
|---|------|-----------|-----------|------|
| 1 | 빈 초안 | 11 | **2** | 9건은 SPR(단답형) 문항의 `correct_index` null — SPR은 정답이 `correct_index`가 아닌 `answers` 필드에 저장되므로 정상. 오탐. |
| 2 | 원시 LaTeX | 3 | **3** | Math `linear_inequalities` 3건, 해설/영문해설에 `$x \le -2$` 형태 그대로 노출 |
| 3 | 금칙어·내부 용어 | 1 | **1** | `answer_rationale`에 스키마 필드명 `evidence_span`이 그대로 노출 |
| 4 | 중복 | 2 (1쌍) | **2 (1쌍)** | Math `circles` 2건 — 지문·해설·수치까지 완전 동일(템플릿 문구 재사용이 아니라 실제 동일 콘텐츠) |
| 5 | 태그 누락 | 0 | **0** | skill_code/sat_domain·ap_subject/difficulty/format 전부 채워짐 |
| 6 | 공개 상태 일관성 | — | **0** | 활성 공개(confirmed, archived_at null) 문항 0건. Sylvia Earle/지하철 노선 등 이번 세션에서 이미 보관 처리된 기존 결함 문항도 archived_at 설정 확인, 현재 어디에도 공개 노출 없음 |
| 7 | 정답·선택지·해설 불일치 | 2 | **2** | 위 "빈 초안" 2건과 동일 문항(선택지 0개인데 correct_index도 null) — 별개 신규 실패 아님 |

**중복 계산 제외한 실제 실패 문항 수: 8건** (모두 draft, 미공개).

## 보관 처리한 8건 (마이그레이션 `20261413000000_p6_problem_bank_full_audit_archive.sql`)

| id | skill_code | 사유 |
|----|-----------|------|
| `2a0779b0-1ebc-4ef5-bba2-357c20215faa` | linear_inequalities | 해설에 원시 LaTeX(`$x \le -2$`) 노출 |
| `0d5c1e37-91f9-4e2b-b2fe-c890ed3feb2b` | linear_inequalities | 해설에 원시 LaTeX 노출 |
| `7c74b222-16c6-4948-a3e5-7fed8cc97749` | linear_inequalities | 해설에 원시 LaTeX 노출 |
| `c5809139-15a4-4b04-8f48-6f4b9a18eb8f` | central_ideas_details | 빈 초안(지문/문항/선택지/해설/정답 전부 누락) |
| `631341f1-c2c5-4fd7-8568-eed6c7db9eab` | central_ideas_details | 빈 초안(지문/문항/선택지/해설/정답 전부 누락) |
| `83584a4e-1974-4723-93d8-7dd5ed7870be` | inferences | `answer_rationale`에 내부 스키마 필드명(`evidence_span`) 노출 |
| `0a2e6764-772e-487a-91e5-006e5564279b` | circles | 지문·해설·수치 완전 중복(짝: 아래) |
| `ee3606c2-1102-46ca-8348-b3cf9c496a83` | circles | 지문·해설·수치 완전 중복(짝: 위) |

전부 status=draft(검수 대기) — 공개 문항이 아니므로 승인 없이 통상 정리로 보관 처리.
(routine cleanup, no product-owner decision required per task scope.)

## 공개 상태 관련 플래그

없음. 활성 공개(confirmed) 문항이 0건이므로 이번 감사에서 "공개 중인데 결함 있는" 항목은
발견되지 않았다. 참고로 confirmed 63건은 전부 archived_at 설정되어 있어(2026-09-17 일괄 보관)
현재 학생/선생님 화면 어디에도 노출되지 않는다.

## 코드 버그

발견되지 않음. 이번 감사에서 나온 8건은 전부 **Step 6 공통 품질 게이트(`common-quality-gate.ts`)
도입(2026-09-17) 이전에 생성된 데이터**의 잔존 결함이며, 게이트 자체나 Math 컴파일러/렌더러 코드의
결함이 아니다. 코드 변경 없음.

## 검증

- 자동 테스트: `npx vitest run app/admin lib/problem-generation` — 결과는 아래 검증 로그 참고.
  데이터 전용 변경(코드 미변경)이므로 영향 없어야 함.
- 마이그레이션 적용 후 재조회로 보관 건수(8) 일치 확인 및 미보관 152건 중 표본 재검사 예정
  — **적용 자체는 보류 중(아래 상태 참고)**.

## 상태: 마이그레이션 작성 완료, 적용 보류 (go-ahead 대기)

동시 작업 중인 다른 세션의 배포와 충돌을 피하기 위해 제품 오너 지시로 **`db push --linked`
적용을 보류**한다. 마이그레이션 파일은 작성되어 있으며(`supabase/migrations/20261413000000_p6_problem_bank_full_audit_archive.sql`),
go-ahead 수신 즉시 `npx supabase db reset`(로컬 무영향 확인) → `npx supabase db push --linked`
→ 재조회 검증 순으로 진행한다.

## Production

Production 프로젝트는 조회·변경 모두 하지 않았다.
