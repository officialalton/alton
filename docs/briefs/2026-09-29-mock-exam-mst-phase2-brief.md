# 모의고사 적응형(MST) Phase 2~5 — 하위 에이전트 브리핑

작성: 개발 총괄(2026-09-29). 기준 문서: `docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md`(§6 Phase 계획, §3 데이터 모델, §9 확정 기본값). 이 브리핑은 그 문서의 실행 지시일 뿐이며, 충돌하면 계획 문서와 제품 오너 결정이 우선한다.

## 시작 조건 (총괄이 보장)
- Phase 1(`20261901000000`, `20261901000001`, 코드)은 총괄이 검증·개발 DB 적용·통합 브랜치 병합을 마친 뒤 이 브리핑을 준다. 시작 전 `git log`로 Phase 1이 베이스에 있는지 확인한다.
- 작업 폴더: `~/Developer/ALTON-worktrees/sat-adaptive-mock-exam`, 브랜치 `feat/sat-adaptive-mock-exam`(통합 브랜치를 병합해 최신으로 시작).

## 역할 경계 (권한 요청으로 멈추지 않기 위해)
- 할 수 있는 것: 이 worktree 안의 코드·테스트·마이그레이션 **파일 작성**, 로컬 DB 검증, 로컬 커밋.
- 하지 않는 것: `git push`, 공유 개발 DB(`worpsqwqgnspddnrtnvq`) 마이그레이션 적용, Vercel 배포·환경변수, `supabase db reset`(공유 로컬 DB — 총괄이 일정 조율. 격리가 필요하면 `config.toml`의 `project_id`와 포트를 임시로 545xx로 바꿔 격리 스택을 쓰고 커밋 전 원복), Preview 로그인·계정 생성.
- 마이그레이션 번호는 `20261901000002`부터 이 대역만 쓴다(`2026190xxxxxxx` 다른 대역과 충돌 금지). 적용된 마이그레이션 파일은 수정하지 않고 새 번호로 올린다.
- 정책·점수 표시·비용에 영향을 주는 결정이 필요하면 멈추고 총괄에게 보고한다.

## 새 기능 1장 정리 (CLAUDE.md 규칙)
각 Phase 착수 전 사용자 흐름, 데이터·권한, UAT 데이터(실행 ID 전용 계정), UI 기준, 검증·성능을 한 장으로 적고 시작한다.

## Phase 2 — 메타데이터 + 조립 강화 (이번 라운드)
- 문항 M1/M2(higher/lower) 배정 가능 플래그. 초기 규칙: easy·medium→M1/lower, medium·hard→higher (`difficulty` 라벨에서 파생, 계획 §2).
- 스냅샷: 응시 시점 문항 내용 고정(`mock_exam_attempt_item_snapshots` 또는 `set_items.content_snapshot`, 계획 §3 Phase 2). 공개 버전 불변 정책과 정합.
- 조립 강화: **skill 단위 정원·균형**(Phase 1 한계, 계획 §8.1), 부족분 시 조립 실패 처리, 유사문항 그룹·노출 이력 반영.
- 청사진 검증 RPC(`mock_exam_validate_mst_set` 확장 또는 `validate_mst_set`): 모듈·경로별 정원·중복·skill 균형을 검증해 `readiness_report`에 기록. 관리자 검수 화면에 M1/M2 배정 플래그 표시.
- 완료 기준: 계획 §7 테스트 계획 해당 항목 + 조립 통합 테스트(정원·중복 0·skill 균형), 재실행 안전성(초기화 없이 연속 3회 통과, `test/reservation-slots.ts` 규칙 준수), 관리자 화면 Preview UAT는 총괄이 담당.

## 이후 Phase (별도 지시 전까지 착수하지 않음)
- Phase 3 — 라우팅: `mock_exam_routing_policies`(section·threshold_type·value·version), M1 잠금 시 경로 결정, M2 higher/lower 변형(`set_items.route`), 학생 UI에 경로 비노출(감사 테스트).
- Phase 4 — 점수·진단: 난이도 분해, 예상 범위 모델, 스킬 진단, 교사용 모듈·문항별 약점 뷰.
  - **점수 표시 정책(제품 오너 승인 2026-09-29):** 총점 400-1600·섹션 200-800은 "예상 점수 범위(내부 추정)"로 표시하고 raw 결과와 분리한다. V1 사양의 "College Board 점수와 동등하다고 표시하지 않음" 면책 문구를 결과 화면에 유지한다.
- Phase 5 — 캘리브레이션: 응답 축적 후 모델 버전 재계산, 과거 attempt 점수 불변.

## 알려진 기존 이슈
- 관리자 세트 목록의 문항 수가 PostgREST 기본 1,000행 상한에 걸리면 0으로 표시된다(V1 기존, 계획 §8.1.1). Phase 2 화면 작업 때 함께 고친다.

## 보고 형식
CLAUDE.md 5항목(완료·검증·미완료·결정 필요·외부 변경) + 사용한 UAT 실행 ID·정리 결과·남은 레거시 경로. 마이그레이션 영향(테이블·기존 데이터·되돌리기)은 적용 전 보고에 반드시 포함.
