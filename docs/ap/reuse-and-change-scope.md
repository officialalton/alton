# AP 기존 코드 재사용 / 조정 / 신규 분류 (코드 근거)

기준: `preview/m4-integration-verification` @5037a8d4. 분류 = **재사용**(그대로) / **조정**(소폭 수정) / **신규**.

## A. 문제은행
| 대상 | 근거 | 분류 |
|---|---|---|
| `problems`(format enum `mc`/`essay`/`math`, `spr` 추가됨), `problem_versions`(passage·options·correct_index·answers·explanation_en·figure·render_check·quality·statements·review_kind) | `20260827120000_initial_schema.sql:326`, `20261293…p2_problem_versions.sql`, `…360_spr…`, `…365_figure_render_check…` | **재사용**. `essay`가 FRQ 서술 형식의 출발점 |
| SAT 전용 필드: `problems.sat_domain`, `skill_code`→`problem_skill_codes`(SAT 30개 스킬), `mock_exam_set_items.sat_domain`(not null) | `20261367…p3_problem_taxonomy.sql:51-54`, `20261415…:55-62`, `lib/problem-taxonomy.ts`(SAT_DOMAINS 하드코딩) | **조정**: AP는 `exam_program`(sat/ap)·`ap_subject`·`ap_unit`·`ap_topic` 추가. `sat_domain` not null 제약을 AP 문항에선 null 허용(체크 제약 확장) |
| 난이도 enum easy/medium/hard, 난이도 검토(`app/admin/DifficultyReviewPanel`·`problem-difficulty-review`) | `20260827…:20`, `app/admin/difficulty-review-actions.ts` | **재사용**(정답 검증과 분리 원칙은 data-design의 `ap_verification` 별도 컬럼으로) |
| 공개 게이트(영어 해설·render_check·정답 키·공개 버전 불변·세트 공개 시 재검증) | `…240` 마이그레이션, CURRENT "문제은행·게이트 보강" | **재사용** — AP도 같은 경로. FRQ는 루브릭 존재 게이트 추가(조정) |
| 그림(데이터 spec→SVG, `lib/problem-figures`), 표(마크다운), 수식 KaTeX | `lib/problem-figures/spec.ts`, `docs/2026-09-14-problem-template-design.md` | **재사용 + 신규 템플릿**: 미적분 그래프, 통계(히스토그램·박스플롯·산점도), 경제 곡선(수요·공급·AD-AS), 생물 실험 그래프, 코드 블록 |
| 생성 파이프라인(`lib/problem-generation/*`, `scripts/mock-exam-generation/*`, 배치·단가표 `batch-lib.ts`, 모델 설정 `models.ts`) | `lib/problem-generation/models.ts`, `scripts/mock-exam-generation/batch-lib.ts:12` | **재사용(골격)**, 과목별 프롬프트·검증기는 **신규**(`lib/ap-generation/*`) |
| 생성기 고정 SAT 검증기(근거모델·문법구조·전이·수사종합·math 컴파일러) | `lib/problem-generation/*-check.ts`, `math-compilers` | **AP 비대상**(SAT 전용). 일반 품질 게이트 `common-quality-gate.ts`만 재사용 |

## B. 모의고사 엔진
| 대상 | 근거 | 분류 |
|---|---|---|
| 세트 `mock_exam_sets`: `format in ('fixed','mst')`, `rw_time_limit_minutes`, `math_time_limit_minutes`, `math_calculator_allowed`, `difficulty_tier` | `…415…:17-30`, `…901000000…:18` | **조정**: `format`에 `ap_fixed` 추가(MST 아님), 세션(섹션) 스키마를 `rw`/`math` 고정에서 **섹션 배열**(예: `mc_a`,`mc_b`,`frq_a`,`frq_b`)로 일반화. AP는 SAT MST/4모듈 분기 미적용 |
| 세트 항목 `section in ('rw','math')`, `sat_domain not null` | `…415…:51,55` | **조정**: section 체크 확장 + AP 단원 컬럼 |
| 응시 `mock_exam_attempts`(상태·남은 시간 jsonb, 세트 계열당 1회 유니크), 시작 RPC `mock_exam_open_start`, 모의고사 배정 폐지 구조 | `…415…:118`, `…995000000_mock_exam_open_access.sql` | **재사용**(시작·멱등·자동저장·타이머) |
| 채점 `lib/mock-exam/grading.ts`, `_answer_auto_grade`(mc/spr) | `…901…:290-312` | MC **재사용**. FRQ는 **신규**(자동 채점 불가→자기채점·AI 참고 피드백 별도 테이블) |
| 점수 추정 `score-estimate.ts`(SAT 앵커 구간) | `lib/mock-exam/score-estimate.ts:12-65` | **AP 비적용**(AP 1~5 미표시). 학생 화면에서 SAT 점수 경로 분기 필요 |
| 응시 화면(`MockExamTakeClient`, 하이라이트·소거·화이트보드·메모, 번호 막대) | `app/student/mock-exam/[attemptId]/*` | **재사용 + 조정**: 섹션 전환 UI, 계산기 파트 안내, FRQ 타이핑 입력(essay) 컴포넌트 신규(`session`의 essay 입력 재사용 후보) |
| 정답 노출 차단(채점 확정 전 마스킹 RPC), 응시자 격리 RLS | `20261429…p0_lock…`, `mock-exam-mst-nondisclosure.integration.test.ts` | **재사용**, AP 세트에도 회귀 테스트 |
| 학생 목록(번호순·5개씩·To do/Completed) | `lib/mock-exam/open-list.ts`, `StudentMockExamTab.tsx` | **조정**: 과목 선택 단계 추가(AP 과목 → 세트 목록) |

## C. 결과·약점·노트·단어·상담
| 대상 | 근거 | 분류 |
|---|---|---|
| 결과(`report.ts`, `MockExamResultView.tsx` Summary/Results by Domain/Review Mistakes) | `lib/mock-exam/report.ts` | **조정**: "Domain"→과목 단원, R&W/Math 분리를 섹션 일반화. 점수 환산 영역 숨김 |
| 약점 `weakness.ts`(loadMockExamWeaknessSummary, topWeaknesses) | `lib/mock-exam/weakness.ts:24,37` | **조정**(키 = `ap_unit`/`ap_topic`) |
| My Notebook(`lib/notebook/model.ts`: `NotebookSection = rw|math`, SAT DOMAIN 필터) | `lib/notebook/model.ts:5-45`, `app/student/ProblemHistoryTab.tsx` | **조정**: 섹션·도메인 필터를 프로그램/과목/단원으로 일반화, 오답 판정 `isMistake` 재사용 |
| 단어장(`vocab_library_*`, `lib/vocab`) | `…vocab_library…` 마이그레이션 | **조정/신규 데이터**: SAT 어휘 중심. AP는 과목별 용어집(Biology·Chem·Econ·Stats 용어, CS 키워드). 테이블 구조는 재사용, `subject` 컬럼·콘텐츠 신규 |
| 상담 연결(`student_consult_interests`, `app/student/tutoring-actions.ts`, `TutoringInterestPanel`) | `20262100000004…`, `app/student/tutoring-actions.ts:17` | **재사용**: 결과 화면 CTA에 AP 과목·약점 컨텍스트를 `interest` 메타로 전달(컬럼 `source_context jsonb` 조정) |
| 무료 회원 접근(`free-member-access`, 시작 상한 폐기) | `lib/free-member-access.integration.test.ts`, POLICY 10-08 | **재사용**(공개 세트 전부 무료) |

## D. 관리자 화면
| 대상 | 근거 | 분류 |
|---|---|---|
| 문제은행 탭(`ProblemBankTab`, `ProblemDraftEditor`), 신고 패널, 난이도 검토 패널 | `app/admin/*` | **조정**: AP 과목 필터·FRQ 편집(파트·루브릭)·검수 상태 |
| 모의고사 세트 관리(`app/admin/mock-exam/MockExamSetsPanel`, `ReplacementNeeds`) | 동 | **조정**: AP 세트 조립(섹션 구성·라벨 자동 판정) |
| AP 재고·검수·비용·깔때기 대시보드 | 없음 | **신규**(data-design §4) |

## E. 신규 작업 요약
AP 과목 선택 화면·AP 분류 스키마·섹션 일반화·FRQ(문항 번들, 루브릭, 자기채점) 모델·AP 생성·검증 파이프라인(과목별 검증기)·재고/검수 관리자 화면·AP 용어집·결과 라벨링 규칙·AP 회귀 테스트.

## 유지 원칙
SAT 경로는 `exam_program='sat'` 기본값으로 완전 불변. AP는 새 분기, SAT의 MST·점수 추정은 건드리지 않는다(SAT 회귀 테스트 필수).
