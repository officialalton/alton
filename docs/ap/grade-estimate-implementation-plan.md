# AP 예상 등급 — 표시 및 버전 관리 구현 계획 (2026-10-21)

> **2026-10-21 정책 정정:** 교사 채점·유료 인센티브·고정 모집 없음. 파일럿 v3와 최신 오너 지시가 우선하며 이전의 일률적 범위 폭 2등급 상한은 미확정이며 현재 표의 데이터 기반 제안을 따른다. AI 채점 검증과 AP 등급 검증은 별개다. 새 환산표 활성화는 오너 승인, 실제 성적은 결과·응시 기록에서 선택 입력(이미지 필수 아님). 관리자 AP 결과 읽기 경로는 db7b78b91로 이미 구현됐으나 환산 근거 패널과 환산 테이블 구현을 완료한 것은 아니다.

상태: **계획만.** 예상 등급은 숨김 유지. 마이그레이션 초안은 `docs/ap/grade-estimate-schema-draft.sql`(적용 금지, `supabase/migrations` 밖). 활성화는 파일럿 판정(`grade-estimate-pilot-plan.md` §5)과 오너 승인 뒤 과목별로만.

## 1. 표시 정책

| 항목 | 정책 |
|---|---|
| 표시 대상 | 공식 풀 구성(`isOfficialFullLayout`) 모의고사 응시 중 **MC·FRQ 채점이 모두 완료**된 것만. 부분 연습 세트(Non-Calculator·Calculator·Free-Response·짧은 FRQ 연습 등)는 제외 |
| 제외 | 테스트 계정, FRQ `unavailable`·`in_progress`, 문항 누락 응시, 검증 상태가 `active` 아닌 환산 기준 과목 |
| 표기 | 근거가 뒷받침될 때만 잠정 **범위**: `Estimated AP Score: 3–4`, 바로 아래 `Preliminary estimate based on this ALTON practice exam. Actual AP results may differ.` |
| 금지 | 임의 ±1 확장(범위는 환산 기준이 담은 데이터 기반 구간만), 합격 확률·신뢰도 수치, 단일 숫자 확정 표기, 가중 합산 점수가 없는 상태의 등급 |
| 범위 폭 | 한도는 일률 지정하지 않는다. 파일럿 검증 결과를 보고 오너가 환산 기준별 `range_policy` 에 정한 한도를 넘으면 표시하지 않고 "Section scores only" 안내 |
| 학생·학부모 | 같은 컴포넌트·같은 정책. 학부모 화면은 읽기 전용 `ApExamResultView readOnly`(이번 작업에서 학부모 AP 결과 라우트가 이 컴포넌트를 쓰도록 연결) |
| 관리자 | 응시 상세에 환산 근거 패널: 환산 기준 버전·값 성격(공식/외부 추정/내부 임시/내부 검증됨)·검증 상태·파일럿 ID·구성 요소별 점수·합산·범위·표시 여부·숨긴 이유 코드 |
| 숨김 사유 | 표시 불가 시 학생에게는 현재의 섹션별 원점수 + `WITHHELD_TEXT` 안내만. 이유 코드는 스냅샷에 저장(관리자용) |
| 영어 UI | 학생·학부모 화면 영어(미국 타겟 정책), 관리자 패널은 한국어 |

게이트 함수(`lib/ap-exam/grade-display.ts`, 신규): `canShowGradeEstimate({ summary, scale, attempt, layout })` — 순수 함수. 조건: `summary.weighted.status==='available'` ∧ 풀 구성 ∧ 환산 기준 `status='active'` ∧ 해당 과목·연도 일치 ∧ 구성 버전 일치 ∧ 테스트 계정 아님 ∧ 범위 폭 ≤ 환산 기준의 range_policy 한도 ∧ 환경 플래그 `AP_GRADE_ESTIMATE_ENABLED` 가 과목 허용 목록에 포함. 기본값 전부 false → 현재 동작(숨김) 유지. 단위 테스트에 "활성 기준 없음·부분 세트·진행 중·실패·테스트 계정 → 숨김" 전부 포함.

## 2. 버전 연결 (스냅샷에 기록되는 값)

응시 결과에 예상 등급·합산 점수를 계산할 때마다 **불변 스냅샷 행**을 추가한다(수정 금지, 새 행으로 대체).

- 시험 구성 버전: `mock_exam_sets.id`(버전 행)·`set_group_id`·`version_no`·`section_layout` 해시.
- 문항 버전: 응시 문항의 `problem_version_id` 목록 해시(`content_snapshot` 기준).
- 루브릭 버전: 사용된 `rubric_version` 값들(`englang-v2`·`englit-v1`·`ushistory-v1`·`whap-v1`·`euro-v1`) + 과제 유형.
- AI 채점 구성: 모델명, 프롬프트/루브릭 해시, 채점 횟수(현재 2회 중 낮은 값), 상한 설정, 보정 샘플 세트 ID.
- 환산 기준 버전: `ap_grade_scales.id`(과목·시험 연도·scale_version·값 성격·경계점·검증 참조).
- 응시 구분: `attempt_no`, `is_updated_version_retake`, 사전 노출 여부, `is_test_account`.

## 3. 기준 변경 시 영향·재계산

1. 새 `scale_version` 은 `draft` 로 생성 → **드라이런**: 해당 과목의 기존 스냅샷을 새 기준으로 재계산해 `ap_grade_scale_impacts`(과목·버전·영향 응시 수·등급이 바뀌는 수·범위가 바뀌는 수)만 기록. 학생 화면은 변하지 않는다.
2. **영향 보고를 오너에게 먼저 올린다**(건수·방향 분포·경계 이동). 승인 전 활성화 금지.
3. 승인되면 `active` 로 전환(과목·연도당 active 하나 — 부분 유니크 인덱스). 기존 스냅샷은 보존하고, 새 스냅샷 행을 `supersedes_id` 로 연결해 추가한다(과거 표시 값 재현 가능).
4. 학생 화면은 최신 스냅샷을 보이고, 값이 바뀐 경우 기존 `UpdatedVersionNote` 패턴으로 "Your estimate was updated because the scoring scale was revised." 안내.
5. 예상 등급 수정은 **파생 데이터만** 바꾼다. 답안(`mock_exam_attempt_*`), FRQ 점수 행, 학습 기록은 건드리지 않는다. 스냅샷 테이블에만 쓰기, 응시·점수 원본 테이블에 등급 컬럼을 추가하지 않는다.
6. 롤백: 이전 scale 을 `active` 로 되돌리면(영향 보고 포함) 같은 절차로 새 스냅샷이 쌓인다. 삭제 없음.

## 4. 데이터 구분·추적

- 테스트 계정(`students.is_test_account`)·내부·교사 계정·재응시·사전 노출 문항은 스냅샷 컬럼으로 구분하고, 파일럿·정확도 집계 쿼리의 기본 조건에서 제외한다.
- **실제 AP 성적 대조**: `ap_official_score_reports`(과목·시험 연도·성적·제출일·`self_reported`·연결 모의 응시 id). 제출은 **결과 화면·응시 기록에서 접근 가능한 선택 입력**이며 성적표 이미지는 기본 필수가 아니다(새 동의 체크박스 없음, `POLICY-DECISIONS.md`). 장기 추적: 모의 응시일·본시험 연도·그 사이 학습 기록은 날짜 범위로 조회(복사 없음). 뷰 `ap_estimate_error_v` 가 학생·과목·연도로 최신 스냅샷과 실제 등급을 연결해 오차(예상 하한·상한 대비)를 집계한다. 개인 식별 정보 최소화: 성적표 이미지는 저장하지 않고 확인 여부만 기록(저장이 필요하면 별도 결정).
- 보관: 스냅샷·성적 제출은 학습 이력 보관기간(3년) 정책을 따른다(확인 필요: 정책 대장의 "출결·학습 이력 3년").

## 5. 구현 순서 (마일스톤)

| M | 내용 | 검증 |
|---|---|---|
| M0(완료) | 결과 화면 점수 표시 수정, 가중치 레지스트리, 테스트(`result-score.test.ts`, `ApExamResultScore.test.tsx`) | 단위 테스트 |
| M1 | 마이그레이션 적용(비프로덕션)·RLS·스냅샷 기록 함수(`record_ap_score_snapshot`, SECURITY DEFINER, 서버 액션에서만 호출)·`grade-display.ts` 게이트 | 통합 테스트: 역할별 접근, 불변성(update·delete 거부), 멱등(같은 입력 같은 스냅샷 하나), 부분 실패 |
| M2 | 그림자 모드: 채점 완료 시 스냅샷 `hidden` 기록(표시 코드 없음), 관리자 근거 패널 | Preview UAT(전용 테스트 계정, 실행 ID 정리) |
| M3 | 환산 기준 CRUD 관리자 화면(초안·드라이런·영향 보고·활성화, 활성화는 오너 승인 기록 필수) | 통합 테스트 + UAT |
| M4 | 학생·학부모 표시 컴포넌트(게이트 뒤, 기본 꺼짐) | 컴포넌트 테스트(표기 문구·금지 항목 부재), Preview 스크린샷 |
| M5 | 실제 성적 제출 입력·오차 추적 뷰·파일럿 리포트 쿼리 | 통합 테스트 |
| M6 | 과목별 활성화(오너 승인 후) | 활성화 전 영향 보고, 활성화 후 모니터링 |

성능: 스냅샷 조회는 응시당 1행(최신, `attempt_id` 인덱스) — 결과 페이지에 쿼리 1건 추가. 계산은 채점 완료 시점 1회(서버), 결과 화면 렌더에서는 계산하지 않는다(현재 `summarizeApResult` 는 화면 표시용 순수 계산이며 스냅샷 기록 시 같은 함수를 서버에서 재사용).

## 6. 테이블·컬럼 초안 (요약, 전체 SQL은 별도 파일)

- `ap_grade_scales`: `id, subject, exam_year, scale_version, status(draft|validated|active|retired), exam_composition_version, component_weights jsonb, cut_points jsonb, cut_basis(official|external_estimate|internal_provisional|internal_validated|none), source_note, validation_id, range_policy jsonb, created_by/at, activated_by/at, retired_at` — `(subject, exam_year, scale_version)` 유니크, 활성 1개 부분 유니크.
- `ap_grade_scale_validations`: `id, scale_id, pilot_id, sample_n, metrics jsonb, criteria jsonb(실행 전 고정), verdict(pass|fail|insufficient), reviewed_by/at`.
- `ap_attempt_score_snapshots`: `id, attempt_id, scale_id null, exam_set_id, set_group_id, set_version_no, layout_hash, item_version_hash, rubric_versions jsonb, ai_config jsonb, component_scores jsonb, weighted_points numeric, estimate_low smallint null, estimate_high smallint null, display_state(hidden|shown), hidden_reason, attempt_no, is_retake, prior_exposure, is_test_account, supersedes_id, computed_at` — 불변(update·delete 트리거 거부).
- `ap_grade_scale_impacts`: 드라이런 영향 보고.
- `ap_official_score_reports`: `student_id, subject, exam_year, official_grade 1..5, verification, submitted_at`.
- RLS: 학생=본인 스냅샷 읽기(`display_state='shown'` 만), 보호자=연결 학생 동일, 관리자=전체 읽기, 쓰기는 서비스 롤/SECURITY DEFINER 함수만.

## 7. 오너 결정 필요

1. 실제 AP 성적 선택 입력의 문구(위치는 결과·응시 기록으로 설계).
2. 환산 기준 활성화는 오너 승인(영향 보고 선제출, 승인자·시각·버전 기록)이며 승인 없는 경로는 만들지 않는다 — 학생에게 보일와 학생에게 보일 "scale updated" 안내 문구 확정.
3. 범위 폭 한도는 검증 결과를 본 뒤 정한다(지금 확정하지 않음).
4. M1 이후 비프로덕션 마이그레이션 적용 시점(총괄과 협의: 공유 DB).
