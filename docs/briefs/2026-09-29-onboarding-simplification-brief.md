# 온보딩 간소화 남은 단계 — 하위 에이전트 브리핑

작성: 개발 총괄(2026-09-29). 기준: `docs/2026-09-26-consent-contract-simplification-implementation-plan.md`, `docs/CURRENT.md`. 충돌하면 제품 오너 결정 → CURRENT.md → 계획 문서 순.

## 현재 상태 (이미 통합 브랜치에 있음)
- 체험 Smart Notes 동의 게이트·화면 제거, 체험 예약 AI 기록 미적용, 상담 결과 기록의 동의·Smart Notes 조건 제거, "정규 진행 희망" 버튼 제거. 13세 미만 보호자 동의 시스템은 그대로 유지(변경 금지).
- 계약 자동 발송 outbox(`contract_dispatch_jobs`, 마이그레이션 `20261900000030`)와 워커(`lib/contract-dispatch/dispatcher.ts`), 관리자 큐 화면. 기본 비활성(`CONTRACT_AUTO_DISPATCH_ENABLED`).
- 정규 수업 AI 기록의 계약 서명(active) 게이트(`20261900000031`~`32`).
- 온보딩 함수 오버로드 정리(`19`,`20`,`33`), 체험수업권 즉시 지급.

## 확정된 발송 정책 (제품 오너)
계약은 다음 세 경우에 **자동 발송**한다.
1. 계정 생성 시(직접 생성 경로).
2. 상담 후 체험 수업을 진행한 경우: 체험 수업 종료 시.
3. 상담사가 "바로 정규로 진행"을 입력한 경우: 그 즉시.

## 코드 점검 결과 (총괄, 2026-09-29) — 이번 라운드의 첫 작업
| 조건 | 현재 |
|---|---|
| 계정 생성 | 구현(`direct_account_created`) |
| 체험 종료 | 구현(`sessions` 트리거 → `completed_trial`) |
| 상담사 정규 즉시 진행 | **없음** — `trigger_type` 체크가 위 두 값뿐. `consult_outcome='regular_recommended'` 기록 시 큐잉되지 않음 |
| 큐 자동 처리 | **없음** — 워커는 관리자 수동 버튼만. `vercel.json`에 크론 없음 |

### 작업 1 — 정규 즉시 진행 큐잉
- `admin_record_consultation_outcome`이 `regular_recommended`를 기록할 때 큐잉한다. 새 `trigger_type`(예: `regular_recommended`)은 새 마이그레이션으로 체크 제약을 확장한다(적용된 `30` 파일 수정 금지).
- **주의:** 상담 경로는 이 시점에 `consultations.child_id`가 없을 수 있다. 자녀 확정 시점에 큐잉하는 보완(예: 자녀 계정 생성·연결 시 `regular_recommended` 결과가 있으면 큐잉)까지 설계·테스트한다. 자녀당·trigger_type당 1건 유니크는 유지, 중복 이벤트·재시도는 no-op.
- DB 트리거 안에서 DocuSign 호출 금지. 큐잉만 한다.

### 작업 2 — 큐 자동 처리 크론
- `app/api/cron/` 아래 새 라우트 + `vercel.json` 크론 등록(기존 크론 패턴, `CRON_SECRET` 검증 재사용). 기본 동작은 `CONTRACT_AUTO_DISPATCH_ENABLED`가 "true"일 때만 발송. 워커 동시 실행은 `for update skip locked` 계열로 방지(계획 4단계 주의사항).
- 크론 등록은 코드만. **환경변수 설정·활성화는 총괄이 검증 후 수행한다.**

## 그 다음 (순서)
3. **5단계 — 회의록 자동 수집(transcript):** sandbox Workspace에서 transcript가 API로 실제 켜지는지 **먼저 검증**한다. 안 되면 "수동 설정 필요" 경고 UI로 축소(계획 §1 5단계, PRD §9-4·§10). 실증 전 완료 보고 금지. 실제 Google 쓰기가 필요한 검증은 하지 말고 총괄에게 요청한다.
4. **6단계 — UI 정리**, 7단계 — 보존 배치 확장(transcript 행/Drive 파일 삭제 포함, GW-14 인수 기준).

## 역할 경계
- 할 수 있는 것: 새 worktree(`~/Developer/ALTON-worktrees/onboarding-simplification`, `git worktree add -b feat/onboarding-simplification ... origin/preview/m4-integration-verification`, `npm ci`, `.env.local` 복사) 안의 코드·테스트·마이그레이션 **파일 작성**, 로컬 DB 검증, 로컬 커밋.
- 하지 않는 것: `git push`, 공유 개발 DB 마이그레이션 적용, Vercel 배포·환경변수, `supabase db reset`(공유 로컬 DB — 총괄 조율), 실제 DocuSign·이메일 발송, Preview 로그인·계정 생성, Google 실제 쓰기.
- 마이그레이션 번호는 `20261902000000` 대역. 다른 세션과 겹치지 않게 이 대역만 쓴다.

## 테스트·UAT
- 각 작업에 통합 테스트(세 조건 각각 큐잉 1건, 중복 이벤트 no-op, 자녀 미확정 시 지연 큐잉, 크론 미활성 시 발송 없음)를 포함한다. **재실행 안전성:** 초기화 없이 연속 3회 통과, `test/reservation-slots.ts`·전용 선생님 규칙 준수.
- UAT 데이터는 실행 ID가 붙은 전용 계정만 쓴다. 실제 발송은 총괄이 Preview·DocuSign 샌드박스·UAT 수신자로 한다.

## 보고 형식
CLAUDE.md 5항목 + 사용한 UAT 실행 ID·정리 결과·남은 레거시 경로. 마이그레이션은 파일 경로와 영향(기존 데이터·되돌리기)을 적용 전 보고에 포함.
