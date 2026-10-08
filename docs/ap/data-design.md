# AP 데이터 설계(초안, 마이그레이션 미작성·미적용)

원칙: additive 마이그레이션만. 기존 SAT 데이터·제약은 기본값으로 보존. 새 번호로만 추가(적용된 파일 수정 금지).

## 1. 과목·분류
- `ap_subjects`(code PK 예 `calc_ab`, name, exam_year 2027, section_layout jsonb[공식 구조: 섹션·문항수·분·계산기], ced_version, active).
- `ap_units`(subject_code, unit_no, title, exam_weight_min/max, retired boolean) — Statistics는 신 5단원.
- `ap_topics`(unit_id, code, title, retired) — 삭제 주제(예: 기하분포)는 `retired=true`로 생성 금지.
- 기존 `subjects`/`subject_template_units`(학원 커리큘럼)와 별개: 연결 필요 시 `ap_subjects.subject_id` nullable FK.

## 2. 문항
- `problems.exam_program text not null default 'sat' check (in ('sat','ap'))`, `problems.ap_subject text`, `ap_unit_id`, `ap_topic_id`, `ap_skill text`(CED 실습/스킬 코드). 체크: `exam_program='ap'`이면 ap_* not null, `sat_domain`은 null 허용(현재 컬럼 조건 완화).
- 형식: MC(`mc`), 다중선택 필요 시 `mc_multi`(Physics/Chem 해당 시 확인), FRQ는 별도 번들.
- **FRQ 번들** `ap_frq_bundles`(id, subject, unit_id, stem, stimulus jsonb[figure/table/code], parts jsonb[라벨·점수·유형], total_points, calculator_allowed, status) + `ap_frq_rubrics`(bundle_id, part_label, point_rules jsonb, sample_response, common_errors, scoring_notes) + 버전 불변 규칙은 `problem_versions` 게이트와 동일 패턴.
- 모든 AP 콘텐츠에 `explanation_en` 필수(오너 정책), 한국어 해설 토글 선택.

## 3. 검증·검수(정답 검증과 난이도 검수 분리)
- `ap_verifications`(item_id, item_kind[mc|frq], verifier[computation|data_check|graph_logic|code_exec|evidence_check|llm_solve|human], result[pass|fail|inconclusive], detail jsonb, model, cost_usd, created_at). 과목별 검증 방식은 generation-and-review-plan 참조.
- `ap_review_states`: 상태 `candidate → auto_verified → difficulty_reviewed → human_reviewed → adopted | rejected | needs_repair`. `rejection_reason` enum(wrong_key, ambiguous, out_of_scope[CED 밖/삭제 주제], copyrighted_resemblance, difficulty_mismatch, figure_error, duplicate, other).
- **난이도는 `difficulty_evidence` 별도**: 학생 정답률(응시 데이터), 인간 교사 판정, 다중모델 풀이 일치율은 *쉬움 판정 참고*로만 저장하고 "hard" 근거로 쓰지 못하게 DB 체크(근거 종류 `model_agreement`는 hard 승격 불가).
- 외부 검수자 계정·신고 이전 정책(POLICY 10-07)과 호환되도록 문항·세트 ID 유지.

## 4. 재고·비용·깔때기(관리자)
- `ap_generation_runs`(run_id, subject, model, role[generate|verify|review], items_in, items_out, tokens, cost_usd, started_at) → 깔때기: 후보→자동검증 통과→난이도 검수→인간 검수→채택, 반려 사유 분포.
- 뷰 `ap_inventory_v`(과목·단원·형식별 채택 수 vs 목표 50 MC + 5 FRQ, 단원 부족 표시).
- 샘플 수율 게이트: 채택/초기 후보 ≥ 25% AND 정답 오류율·비용이 승인선 이내여야 확대.

## 5. 세트·응시
- `mock_exam_sets`: `exam_program`, `ap_subject`, `format` 확장(`ap_fixed`), `label` 파생(`full_practice|mc_practice|frq_practice`), `section_layout jsonb`(공식 구조 복사). 섹션 체크 `rw|math` → 일반 섹션 코드 허용.
- `mock_exam_set_items`: `section` 체크 확장, `sat_domain` nullable + `ap_unit_id`, `bundle_id` nullable(FRQ).
- FRQ 응답 `ap_frq_responses`(attempt_id, bundle_id, part_label, text/imageRef, autosave_at) — 자동 저장·제출 후 잠금은 `mock_exam_annotations`/응시 패턴 재사용. RLS: 본인만, 채점 전 루브릭·모범답안 마스킹.
- FRQ 피드백 `ap_frq_feedback`(response_id, kind[self|ai_reference|teacher], body, model, disclaimer_version) — **AI는 `ai_reference` 라벨로만, 점수 환산·총점 합산 없음**. 검증 계획 승인 전 AP 1~5 점수 필드 만들지 않음.
- 세트 계열당 1회·멱등 시작은 기존 `mock_exam_open_start` 확장.

## 6. 노트·단어·상담
- 노트: `session_problem_work.source='mock_exam'` 기존 흐름에 AP 문항 연결(AP 컬럼 조인). 폴더·필터는 프로그램/과목/단원.
- 단어장: `vocab_library_*`에 `exam_program/ap_subject` 추가, 용어집 시드.
- 상담: `student_consult_interests`에 `context jsonb`(과목·약점 단원).

## 7. 보안·RLS 요지
공개 전 세트·미검수 문항 학생 접근 차단(세트 공개 게이트가 `adopted+human_reviewed` 요구), 정답 노출 RPC 마스킹 유지, 응시 데이터 교차 사용자 격리, 관리자·외부 검수자는 역할별 읽기.
