# ALTON 문서 지도

기준일: 2026-09-01

## 1. 현재 유효한 문서

새 세션은 이 문서를 먼저 읽지 않는다. `../CLAUDE.md`와 `CURRENT.md`로 시작하고, 문서 위치를 찾을 때만 이 지도를 사용한다. 충돌 시 아래 순서와 최신 버전을 우선한다.

1. `CURRENT.md` — 완료 단계, 현재 구조, 최신 migration, 배포·외부 플래그, blocker
2. `2026-08-29-master-roadmap-v3.md`의 현재 R 섹션 — 실행 범위와 완료 기준
3. `2026-08-29-product-architecture-v3.md`의 관련 절 — 제품 정책과 도메인 기준
4. 해당 Gate·R 원본 정책 문서 — 충돌 확인과 세부 근거가 필요할 때만
5. `../CONTEXT.md` — 공통 용어와 개념 경계

`research/`의 두 문서는 Google 기능의 기술 근거다. 정책을 변경하지 않으며 실제 Workspace Sandbox 결과가 나오면 갱신한다.

`2026-08-29-claude-code-gate-b-c-request.md`는 완료된 Gate B·C의 과거 실행 요청서이며 신규 작업 지시로 사용하지 않는다.

## 2. 참고만 가능한 문서

- `spec/mockups/`: 승인된 화면 구조 참고. 데이터·정책은 v3가 우선한다.
- `spec/functional-spec.md`: 사업 배경, 포털 역할, 교재·세션 분리 원칙만 유효하다.
- `2026-08-29-진행내역-정리.md`: 현재 개발본이 어떻게 만들어졌는지 확인하는 현황 기록이다.
- `2026-08-29-gate-c-sandbox-infra-log.md`: Gate C Sandbox 프로비저닝 실행 기록(프로젝트 ID, 서비스 계정, Pub/Sub, DWD 등록 상태). 정책 문서가 아니라 실제로 무엇을 만들었는지의 로그다.
- `tickets.md`: 기존 구현과 완료 티켓을 추적하는 이력이다.
- `superpowers/plans/`, `superpowers/specs/`: 이미 수행한 기능의 설계·구현 이력이다.

## 3. 신규 구현에 사용하지 않는 문서

- `2026-08-29-최종-기능-명세서.md`
- `2026-08-29-변경계획.md`
- `2026-08-29-architecture-decisions-v2.md`
- `2026-08-29-developer-handoff.md`
- `2026-08-29-work-plan-v2.md`
- `spec/schema-draft.md`
- `prompts/00-init-project.md`부터 `04-portals-recurring-pattern.md`까지

이 문서들의 Calendly, Zoom, 크레딧, 파일럿 우선순위, 기존 결합 스키마를 신규 설계에 복사하지 않는다. **(2026-08-30 정정)** DocuSign은 예외다 — 전자서명 서비스로 계속 사용하며 R3에서 신규 계약 구조(자녀별 계약·버전·Drive 장기보관)에 재연결한다(`product-architecture-v3.md` §5.5 참고). 다만 이 문서들 속 옛 DocuSign 구현(레거시 `contracts` 스키마, 템플릿 미사용 anchor 방식, Drive 연동 없음)은 그대로 재사용하지 않는다 — R3는 새 스키마·흐름을 기준으로 다시 설계한다.

## 4. 현재 실행 게이트

- Gate A: 승인 완료
- Gate B: **승인 완료(2026-08-29)** — `2026-08-29-gate-b-migration-and-permission-design.md`(v5)
- Gate C: **완료(2026-08-30)** — `2026-08-29-gate-c-google-workspace-validation.md`. Google 기술 검증(GW-01~13)에서 데이터 모델 blocker 없음 확인. GW-10/12/14의 ALTON 앱 워크플로우 부분은 R8/R9/R12 인수 기준으로 이관(삭제 아님)
- Gate D: **완료(2026-08-30)** — Gate C 작업용 임시 조직 권한 회수·검증 포함. R1 착수.
- R1: **완료** — 데이터 기반 재설계
- R2: **완료(2026-09-01)** — 계정·가족·권한 수명주기
- R3 이후의 현재 진행 상태와 blocker는 `CURRENT.md`를 기준으로 확인한다. Gate C에서 이관한 R8/R9/R12 인수 기준은 해당 R 단계 완료 조건으로 반드시 통과해야 한다.
