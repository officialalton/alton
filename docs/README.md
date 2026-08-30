# ALTON 문서 지도

기준일: 2026-08-29

## 1. 현재 유효한 문서

충돌 시 아래 순서와 최신 버전을 우선한다.

1. `../CONTEXT.md` — 공통 용어와 개념 경계
2. `2026-08-29-product-architecture-v3.md` — 제품 정책과 도메인 기준
3. `2026-08-29-r0-approval-and-technical-validation-package.md` — Gate A 승인 기록, 상태·권한, Gate B·C 요구사항
4. `2026-08-29-developer-handoff-v3.md` — 개발 구현 기준
5. `2026-08-29-master-roadmap-v3.md` — 실행 순서와 출시 게이트

`research/`의 두 문서는 Google 기능의 기술 근거다. 정책을 변경하지 않으며 실제 Workspace Sandbox 결과가 나오면 갱신한다.

다음 Claude Code 작업 요청은 `2026-08-29-claude-code-gate-b-c-request.md`에 있다. 이 요청서는 정책 원본이 아니라 위 문서들을 기준으로 Gate B·C 제출물을 받기 위한 실행 문서다.

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
- R1: 진행 중. Gate C에서 이관한 R8/R9/R12 인수 기준은 해당 R 단계 완료 조건으로 반드시 통과해야 함
