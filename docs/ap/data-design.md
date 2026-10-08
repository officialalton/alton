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

---
# Phase 1b 갱신 (2026-10-08): 필드 분리 · 번들 · FRQ 파트 · 생성 계획 · 지표

## 8. 문항 메타데이터 필드 분리
| 그룹 | 컬럼 | 설명 |
|---|---|---|
| content | `ap_subject`, `ap_unit_id`, `ap_topic_id`, `learning_objective` | 공식 코드(`LIM-1.E`, `LO 8.3.A`) |
| skill | `primary_skill`, `secondary_skills[]`, `internal_tag`(선택) | 공식 코드 우선, 내부 분류는 공식에 매핑해 보조로만 |
| structure | `structure` enum(standalone / shared_stimulus_set / frq_multipart), `bundle_id`, `bundle_position` | |
| response | `response_mode` enum(select, calculate, explain, graph, code, essay), `option_count`(Micro 5, 그 외 4 등) | |
| scoring | `scoring_mode` enum(exact, partial, argument), `points` | |
| difficulty | `difficulty_provisional`(basic_learning/exam_prep/advanced_supplement), `difficulty_rationale`, `difficulty_evidence jsonb` | 근거 종류별 분리; 모델 일치는 근거 불가 |
| exam_context | `calculator_part`(allowed/not_allowed/required), `est_seconds` | |
| provenance | `generation_run_id`, `reference_notes_ref` | 공식 문항 텍스트 저장 금지 |

## 9. 번들·FRQ 파트 스키마
- `ap_bundles`(id, kind[mc_set|frq], subject, stimulus jsonb, stimulus_checked bool, status, total_points, calculator_part).
- `ap_bundle_items`(bundle_id, position, problem_version_id) — MC 자료 세트 구성원, 전 구성원 공개 전제.
- `ap_frq_parts`(id, bundle_id, label, points, task_type[assertion/explain/calculate/graph/code/essay], skill_codes[], response_mode, scoring_mode).
- `ap_frq_rubric_rows`(id, part_id, row_no, points, criterion, skill_code, accepted_answers jsonb, alt_solutions jsonb, common_errors jsonb, requires_units bool) — **파트당 ≥1행, 행 점수 합 = 파트 점수**(DB 제약).
- 학생 응답/피드백은 §5와 동일하되 `part_id` 단위로 저장, `ap_frq_feedback.kind='ai_reference'`는 전문가 비교 보고 승인 플래그(`ap_features.ai_frq_feedback_enabled`)가 켜진 뒤에만 노출.

## 10. 생성 계획 표현: 단원 × 스킬 × 구조 부족분
- 목표 재고(`ap_stock_targets`): 과목당 MC 50 + FRQ 번들 5(불변). 
- 분해: `ap_stock_cells(subject, unit, primary_skill, structure, target, adopted, pending, shortfall)`. 생성 지시는 **shortfall>0 셀**만 대상으로 만든다(비공식 임의 배분 금지, 공식 비중에 비례한 목표 배분은 `weight_source`로 표기).
- 뷰 `ap_stock_gap_v`: 단원×스킬×구조 히트맵(관리자).

## 11. 샘플 계획 반영 규칙
- 샘플 풀은 **과목별 주요 구조를 모두 포함**: 독립 MC, 자료 세트 MC(그림/그래프/표), 계산기 파트(해당 과목), 수치 문항, FRQ 유형들.
- 20 MC + 2 FRQ 번들로 부족하면 부족 수량을 계산해 보고(아래 표, schedule-and-cost.md 비용 반영).
| 과목 | 필요 구조 | 20 MC + FRQ 2로 가능? | 필요 추가분(권장) |
|---|---|---|---|
| Calc AB | 단원 8 × (P1/P2/P3), 파트 A/B(≈14/6), 그래프·표·식, FRQ 6유형(표/맥락, 그래프, 미방, 면적·부피, 입자, 함수) | MC 20 불가(스킬×단원 셀 24 중 일부만) → 핵심 단원×스킬 20셀만 커버 | MC **+10 (30)**, FRQ **+2 (4)** |
| Biology | 단원 8, 자료 세트(4문항), 시각·표, FRQ 긴 2+짧은 4유형 | MC 20 = 단독 12 + 세트 8(2세트); 8단원 커버 가능하나 SP5 계산·SP3 방법 얇음 | MC **+10 (30)**, FRQ **+2 (4)** |
| Micro | 단원 6, 5지선다, 그래프 세트, 수치 20–30%, FRQ 긴1·짧은2 | MC 20 가능(≈), FRQ 2는 긴/짧은 1개씩이라 짧은 유형(게임이론 등) 1개 부족 | MC **+10 (30)**, FRQ **+1 (3)** |
- 오너 선택지: **A안**(20 MC + 2 FRQ, 구조 일부 미검증) vs **B안(권장)**(30 MC + 4/4/3 FRQ, 주요 구조 전체).

## 12. 보고 지표(관리자 대시보드·수율 보고)
후보 수·채택 수·**수율**, 반려 사유 분포, **채택 1건당 비용·호출 수**, 전문가 검수 소요 시간, 오류 건수(정답 오류·자료 오류 분리), 재고(단원/스킬/구조별), 난이도 근거 분포(잠정/교사/학생 데이터), **중복 비율**(문항·번들·유사 변형). 수율 25%는 효율 점검(품질 기준과 독립): 기준을 낮춰 맞추지 않는다. 난이도는 학생 데이터가 충분해질 때까지 `provisional` 유지, 보정은 `difficulty_evidence`에 근거를 쌓는 방식.

---
# Phase 1c 갱신: FRQ 루브릭 행 스키마 (공개 채점 가이드 분석 반영)
`ap_frq_rubric_rows`(기존 §9)에 추가:
- `requires_row_id`(선행 행; 의존 사슬), `follow_through`(앞 파트 오답 이월 허용 규칙), `requires_both`(claim+explanation 동시 충족), `requires_numbers`(수치 인용 필수), `numeric_tolerance`(허용 범위 jsonb), `rounding_rule`(예: 문항당 최대 1점 감점), `required_elements[]` + `optional_phrases[]`(필수·선택 어구 분리), `graph_elements[]`(그래프 문항 요소별 행), `units_row bool`.
- `skill_code_source` enum(`official_ced`, `analyst_mapped`): 공개 SG에 스킬 코드가 없으므로 FRQ 행은 기본 `analyst_mapped`, 전문가 검수에서 확인.
- `reference_pattern_id`: 구조 템플릿(Calc 6유형, Micro 8~10유형, Bio 짧은 4유형) 참조(공식 문항 텍스트 아님).
- 번들 `stimulus_shared_across_parts bool` + 파트 간 의존(`part_inputs_from`): Micro 그래프 재사용·Calc 앞 파트 값 이월.
