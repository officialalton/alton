# 온보딩 전 과정 시나리오 감사 (2026-09-29)

범위: 홈페이지 신청 → 관리자 컨설턴트 배정 → 예약 링크 → 상담 → 결과 → 체험 확정 → 온보딩 링크 → 계정 → 체험수업권 → 체험 → 계약 자동 큐잉·발송 → 정규 예약·활성화.
기준: `docs/CURRENT.md`, `docs/2026-09-26-consent-contract-simplification-implementation-plan.md`, `docs/briefs/2026-09-29-onboarding-simplification-brief.md`, 오너 결정(2026-09-26~29).
방법: 로컬 DB(psql, `127.0.0.1:54422`)·코드 정독·통합 테스트. 외부 호출(Google·DocuSign·메일)은 하지 않았다(모두 mock 또는 미실행). 원격은 SELECT만.
마이그레이션: `20261922000000_onboarding_scenario_audit_fixes.sql`(추가 전용, 로컬만 적용). 회귀 테스트: `app/consult/onboarding-scenario-audit.integration.test.ts`(20건) 외 단위 테스트 4개 파일.

판정 표기: **OK** / **BUG-수정** / **BUG-미수정** / **POLICY GAP**(오너 결정 필요) / **미검증**. 심각도 H·M·L.

## 원격 실측(SELECT)
- consultations: requested 3, scheduled 2, completed 12, trial_planned 1, cancelled 4 — **cancelled 중 2건에 outcome 이 기록돼 있다**(B14와 일치하는 증거).
- trial_recommended 14건 중 체험권 지급 `failed` 8, `granted` 4, `not_applicable` 2(동의 게이트 시절 잔재).
- contract_dispatch_jobs 0건(게이트 OFF·트리거 이후 이벤트 없음). 살아 있는 예약 링크 0건. consultant_time_off 0건.
- 담당 컨설턴트 없는 상담 16건. 온보딩 링크 pending 8 / redeemed 22 / revoked 2.
- `is_child_onboarding_card` 7건, 컨설턴트 미상속 백필 대상 0건(로컬은 0건 갱신).

## (a) 정상 경로

| ID | 단계 | 정책 근거 | 실제(검증 방법) | 판정 |
|---|---|---|---|---|
| A1 | 홈페이지 신청 접수(`submit_homepage_consult_request`) | 신청 시 시간 지정 불가, 대기 중 같은 이메일 중복 거부, 자동배정 토글 | 시간 전달 시 거부, 대기 중 중복 거부, 자동배정 시 컨설턴트 즉시 배정(코드+기존 `consultation-assigned-consultant-only` 테스트) | OK |
| A2 | 관리자 배정 → "링크 보내기" → 고객이 `/schedule/[token]`에서 슬롯 선택 → scheduled | 상담은 배정된 컨설턴트와 고객 사이에만 존재, 컨설턴트별 겹침 규칙 | 배정·링크·확정 정상. 감사 중 결함 4건 발견·수정(B3·B9·B15·C2, 아래) | OK(수정 후) |
| A3 | 컨설턴트가 결과 `trial_recommended` 기록 → 자녀가 있으면 체험수업권 자동 지급 | 2026-09-28 자동 지급 | 지급·멱등(자녀당 1건) 확인(통합 테스트 T-체험수업권) | OK |
| A4 | 결과 기록 시 자녀 없음(잠재고객 단계) | 지급 실패가 결과 기록을 막지 않음 | `failed` 로 남고, 자녀 연결 후 `admin_retry_trial_entitlement_grant` 로 `granted`(테스트). 재처리 버튼은 관리자 전용 → F3 | OK |
| A5 | 보호자 체험 진행 확정(`confirm_trial_intent`) → 온보딩 링크 발급·발송 → 보호자+자녀 계정 | 링크는 체험 확정 또는 regular_recommended 이후 | 기존 `multichild-trial-onboarding`, `regular-recommended-*`, `existing-guardian-reconsult` 통합 테스트 통과(3회 연속) | OK |
| A6 | 계정 생성 → 학생별 카드(다자녀 분기) + 체험권 지급 | "상담은 배정된 컨설턴트가 이어받는다"(20261473 주석: 상담 경로는 `admissions_consultant_id` 그대로) | 카드에 `admissions_consultant_id` 가 **복사되지 않아 컨설턴트 칸반에서 카드가 사라지고 "카드로 이동"이 '담당 상담이 아닙니다'** | BUG-수정 **H** (B8) |
| A7 | 체험 예약 → 체험 수업 완료 → `completed_trial` 큐잉 | 오너 결정: 체험 종료 시 자동 큐잉 | `sessions` INSERT(trial, completed) 시 1건 큐잉, 정규 수업 완료는 큐잉 없음(신규 통합 테스트). UPDATE 경로(scheduled→completed)는 세션 불변식 토큰 때문에 미실행 | OK(부분 미검증) |
| A8 | 계약 큐 → 발송(게이트 ON) → 서명 → active → 정규 예약 게이팅 | 정규 예약은 계약 active 필요, AI 기록은 서명 후만 | 게이팅(`lesson-booking-data`: contract_pending)·AI 기록 스냅샷(`confirm_lesson_booking`)은 코드·기존 테스트 확인. 실제 DocuSign 발송·서명은 실행하지 않음(게이트 OFF 유지) | OK(코드) / 발송 미검증 |
| A9 | regular_recommended 지름길: 자녀 없이 기록 → 링크 → 자녀 생성 | 오너 결정: 기록 즉시 큐잉, 자녀 확정 시점 보완 | 자녀 없음 → 큐잉 없음, 자녀 연결(root UPDATE 또는 카드 INSERT) 순간 1건, 재기록·무관 UPDATE·다른 상담이 같은 자녀 지목해도 중복 없음(신규 테스트) | OK |
| A10 | 관리자 직접 계정 생성(담당 컨설턴트 필수) | 계정 생성 시 자동 큐잉 | `create_direct_onboarding_link_multi` 전수 검증, 계정 생성 시 담당 상속·체험권·`direct_account_created` 큐잉(코드). 체험권 지급이 실패해도 큐잉은 재시도 지급 시점에 이뤄짐 | OK |
| A11 | 기존 보호자에게 둘째 자녀 추가 | 재상담·형제 추가는 정상 흐름 | 기존 통합 테스트 통과 | OK |
| A12 | 다자녀 가족의 계약 | 계약은 자녀(child_id)당 1건 | 자녀 N명이면 봉투·메일 N통이 거의 동시에 보호자에게 감(정책 문서 확정 사항, 의도) | POLICY GAP **L** — 오너가 "가족 1통"을 원하는지 확인 |

## (b) 인수인계·소유권

| ID | 시나리오 | 정책 근거 | 실제 | 판정 |
|---|---|---|---|---|
| B1 | 컨설턴트가 자기 칸반 카드에서 수락·거절·결과 기록·체험 진행 확정 | 배정 후엔 컨설턴트가 흐름을 소유(RPC 는 이미 "관리자 또는 담당 컨설턴트") | 서버 액션이 `requireAdmin`/capability 라 **컨설턴트 화면의 같은 버튼이 항상 '관리자만 사용할 수 있습니다'**. 결과 기록(=regular_recommended 큐잉 트리거)이 컨설턴트에게 막혀 있었다 | BUG-수정 **H** |
| B2 | 컨설턴트가 체험 확정 후 온보딩 안내 발송·재발급 | R15-A 결정: 실제 이메일 발송 지점은 컨설턴트에게 열지 않음 | 카드에 "온보딩 안내 발송은 관리자가 처리합니다"만 표시. 관리자에게 가는 알림·대기 큐가 없어 **아무도 모르면 멈춘다** | POLICY GAP **M** |
| B3 | 시간 없는 requested 를 "수락"(관리자 화면·칸반 버튼) | 시간은 고객이 링크에서 정함 | `admin_accept_consultation` 이 **시간 없는 scheduled 유령 행**을 만들고 고객 링크(requested 만 허용)도 죽었다. 캘린더 동기화 대상도 아님 | BUG-수정 **H** |
| B4 | 링크 발송 후 담당자 변경 | 링크는 그 컨설턴트 전용 | 옛 링크가 옛 컨설턴트의 빈 슬롯을 보여주고 고객이 고른 뒤에야 '담당 컨설턴트가 변경되어…' 오류. 이미 처리·취소된 상담의 링크도 슬롯 조회는 성공 | BUG-수정 **L** (조회 단계에서 무효) |
| B5 | 슬롯 선택 후(scheduled, Google 일정 있음) 담당자 변경 | organizer 는 담당 컨설턴트여야 함(스펙) | `assign_consultation_owner` 는 상태와 무관하게 변경. 이후 PATCH·삭제가 **새 컨설턴트를 organizer 로 풀어 옛 컨설턴트 캘린더의 일정에 접근**→404/403, 새 컨설턴트에는 일정 없음. UI 경로는 없고(RPC 직접 호출만) 배정 탭은 미확정 건만 다룸 | POLICY GAP **M** — 권고: 확정+이벤트 있는 상담의 재배정은 거절하고 "취소 후 새 링크"로 유도 |
| B6 | 결과 기록 후 루트 상담의 담당자 변경 | 카드는 루트 상담 소유를 따른다 | 루트만 바뀌고 이미 생성된 학생 카드는 예전 담당자 그대로 | POLICY GAP **L** |
| B7 | 컨설턴트 비활성·삭제·이직 | (정의 없음) | 진행 중 상담·링크·카드를 회수/재배정하는 코드 없음. 비활성 컨설턴트에게 배정·링크 발송도 막지 않음 | POLICY GAP **M** — 권고: 비활성화 시 미확정 상담 자동 미배정 + 관리자 큐 표시 |
| B8 | 두 관리자가 같은 상담을 동시에 다른 컨설턴트에게 배정 | 컨설턴트별 겹침·이력 보존 | 행 락으로 직렬화, 이력의 이전 담당자 사슬 정상, 둘 다 성공(마지막이 유효)(신규 동시성 테스트) | OK |
| B9 | 컨설턴트가 휴무를 등록한 뒤 슬롯 | Schedule > Time Off UI 는 "휴무" | `consultant_time_off` 가 **슬롯 목록·확정 어디에서도 쓰이지 않았다**(UI 는 등록만). 미팅 슬롯 목록은 닫힌 예외(`consult_availability_exceptions`)도 무시 | BUG-수정 **M** |
| B10 | 발송된 링크의 컨설턴트가 가능시간 규칙을 지우거나 전부 휴무 | — | 슬롯 0개 → 고객은 빈 화면. 컨설턴트·관리자에게 경고 없음 | POLICY GAP **L** |
| B11 | 컨설턴트의 미팅과 상담 겹침 | 대칭 겹침 금지(20261913) | 트리거·슬롯 제외 확인, 기존 테스트 통과 | OK |
| B12 | 컨설턴트 없는 고객이 시간 요청 | 미배정은 시간 보유 불가 | DB 강제(20261910)·기존 테스트 | OK |
| B13 | 이미 완료(completed)된 상담을 취소·거절 | — | 결과·체험수업권이 남은 채 cancelled 가 되고 Calendar 삭제 대기가 다시 걸렸다(원격에도 cancelled+outcome 2건) | BUG-수정 **M** |
| B14 | requested(일정 전)·cancelled 상담에 결과 기록 | 결과는 진행된 상담에 | requested 에 기록되면 스케줄 없이 outcome 만 생기고, **cancelled 에 trial_recommended 를 기록하면 체험수업권이 실제 지급**됐다. previous_status 이력도 항상 새 상태와 같았음 | BUG-수정 **H** |
| B15 | 확정 상담 거절(컨설턴트 결정) | 거절은 취소와 같은 후처리 | Google 일정은 일 1회 크론까지 고객 캘린더에 남았다(취소 액션과 달리 즉시 삭제 호출 없음). 거절 메일 + Google 취소 알림 2통은 의도된 이중 채널 | BUG-수정 **L** |
| B16 | 컨설턴트 거절·취소 | — | 거절은 B1 수정 후 컨설턴트 가능(requested/scheduled). 취소(`admin_cancel`)는 관리자 전용 유지 | OK |
| B17 | 보호자 노쇼 | (정의 없음) | `markConsultationNoShow` 는 어떤 화면에도 연결돼 있지 않고, no_show 카드는 칸반에서 사라진다. 컨설턴트는 `on_hold`/`closed` 결과로 처리 가능하나 지난 시간 경과 알림 없음 | POLICY GAP **L** |
| B18 | 담당자로 컨설턴트 아닌 계정 지정 | 담당은 컨설턴트 | RPC 가 역할을 검사하지 않았다(UI 는 컨설턴트만 나열) | BUG-수정 **L** |
| B19 | 취소·종료된 상담에 예약 링크 메일 | — | 링크가 생성되고 메일이 나갔다(열면 무효) | BUG-수정 **L** |
| B20 | 링크를 여러 번 발송 | 관리자 명시 클릭 | 링크마다 유효, 사용 후 나머지는 '이미 처리됨'. 메일 중복은 관리자 의도 | OK |
| B21 | 미팅 취소·재예약 Calendar 재동기화 | 20261914 | 기존 `meeting-cancel-resync` 테스트 통과 | OK |

## (c) 링크·토큰

| ID | 시나리오 | 실제 | 판정 |
|---|---|---|---|
| C1 | 예약 링크 만료·재사용 | 조회·확정 모두 '유효하지 않거나 만료된 링크'(테스트) | OK |
| C2 | 예약 링크로 지난 시각 확정(오래 열어 둔 화면·조작된 요청) | 지난 시각도 확정됐다 → 미래만 허용 | BUG-수정 **L** |
| C3 | 온보딩 링크 72h 만료 | 만료는 열어 볼 때 `expired` 로 바뀜. 안 열었으면 pending 이라 "안내 발송"은 `already_sent` 를 돌려주고 재발급 액션으로만 새 링크가 나간다(화면에는 재발급 경로 존재) | OK(UX 주의) |
| C4 | 재발송 | 원 토큰은 재조회 불가 → 재발급(기존 링크 revoke)로 대체, 실패 시 재시도 | OK |
| C5 | 잘못된 이메일 정정 | `overrides` 로 보호자·학생 이메일 수정 후 재발급 | OK |
| C6 | 중복 이메일·이미 계정 있는 보호자 | 학생 이메일 충돌은 발급 전 차단, 보호자는 기존 계정 재사용(재상담·형제) | OK |
| C7 | 다른 브라우저·기기에서 링크 열기 | GET 부작용 없음, 확인 버튼으로만 계정 생성 | OK |
| C8 | 다른 시간대의 고객 | 저장은 UTC, 슬롯 규칙은 America/Los_Angeles, 표시 시간대 선택은 최근 병합. 단위 테스트만, 화면 미검증 | 미검증(UI) |
| C9 | 취소된 상담에 온보딩 링크 발급 | 발급됐다 → 거절 | BUG-수정 **L** |

## (d) 계약 발송

| ID | 시나리오 | 실제 | 판정 |
|---|---|---|---|
| D1 | 큐잉됐지만 보호자·가구 없음 | `retryable_failed` 로 남아 매일 재시도(attempt_count 는 1 고정이라 영구 실패로 가지 않음) | OK(주의) |
| D2 | DocuSign 실패·재시도·영구 실패 | 5회 후 permanent, 관리자 재시도 가능(단위 테스트) | OK |
| D3 | 중복 트리거(체험 완료 + regular_recommended + 재기록) | 자녀×trigger_type 1건 유지(테스트). 서로 다른 type 은 별개 행이지만 발송은 `already_sent` 로 흡수 | OK |
| D3b | 크론과 즉시 호출이 **서로 다른 job 행**(같은 자녀)을 동시에 집는 경우 | 발송 멱등성이 check-then-act 라 이론상 봉투 2개 가능(발생 창은 매우 좁음) | BUG-미수정 **L** — 권고: 발송 직전 자녀 단위 advisory lock |
| D4 | regular_recommended 후 자녀 생성 | 자녀 확정 순간 큐잉(테스트) | OK |
| D5 | 게이트 OFF 상태에서 무엇이 보이는가 | 관리자 "계약" 탭 큐 화면에만 배너·대기 건수. 컨설턴트는 큐를 볼 수 없고, 자녀·수강 계획이 없는 regular_recommended 카드에는 계약 블록 자체가 없다(고객·컨설턴트에게는 "안 보임") | POLICY GAP **M** — 권고: 카드에 "계약 대기(자동 발송 준비 중)" 배지 |
| D6 | 서명 거부(declined)·만료 | declined → contract void 로 끝나고 job 은 `sent` 그대로, 재큐잉·알림 없음. 만료(voided envelope)는 contract 가 sent 로 남음 | POLICY GAP **M** — 권고: 거부/만료 시 관리자 알림 + 재발송 큐잉 정책 |
| D7 | 큐 화면 "재시도"를 게이트 OFF 에서 클릭 | 아무 피드백 없이 무동작 | BUG-미수정 **L** |
| D8 | 크론 백스톱 | `vercel.json` 에 하루 1회 등록, `CRON_SECRET` 없으면 503, 게이트 OFF 면 큐 미접촉(기존 route 테스트) | OK |

## (e) 체험 예외

| ID | 시나리오 | 실제 | 판정 |
|---|---|---|---|
| E1 | 체험 24시간 이내 학생 취소·노쇼 | 체험권 1회가 소진(consumed)되고 **재지급 경로가 없다**(`grant_trial_entitlement_*` 는 기존 지급이 있으면 소진 여부와 무관하게 그것을 돌려줌) | POLICY GAP **M** |
| E2 | 체험권 90일 만료 | 만료 후 재지급 경로 없음(E1과 동일 원인) | POLICY GAP **M** |
| E3 | 체험 중 선생님 변경 | `trial_teacher_succession_eligibility` 기존 정책 | OK |
| E4 | 같은 자녀의 두 번째 trial_recommended | 새 체험권 없이 첫 체험권을 가리키며 상태는 `granted` — 소진·만료여도 화면상 성공(테스트로 특성 고정) | POLICY GAP **M** (E1과 함께 결정) |
| E5 | regular_recommended 후 보호자가 체험 희망 | RPC 는 결과 재기록을 허용(UI 는 숨김). 이미 큐잉된 계약이 나갈 수 있다 | POLICY GAP **L** |

## (f) 권한·가시성

| ID | 시나리오 | 실제 | 판정 |
|---|---|---|---|
| F1 | 보호자·학생(자녀)이 REST 로 `consultations` 조회 | RLS 가 자녀 연결된 행 전체를 허용 → **admin_review_summary·outcome_notes·closure_review_text·google_sync_last_error 등 내부 메모가 노출**(실제 보호자 JWT 로 확인). 카드·구 단일 경로 루트가 child_id 를 가짐 | BUG-미수정 **M–H(개인정보/내부 정보)** — 다른 정책(`trial_sessions`·`contract_versions`·`drive_artifacts`·`proposals` 가족 조회)이 이 정책에 서브쿼리로 의존해 단순 컬럼 REVOKE·정책 삭제가 불가. 권고: 내부 메모를 스태프 전용 별도 테이블로 분리하거나, 가족 조회를 `SECURITY DEFINER` 헬퍼로 바꾼 뒤 자녀·보호자 SELECT 정책 제거 |
| F2 | 상담 경로로 만든 자녀의 `consultant_assignments` | 직접 생성 경로만 담당 상속(20261473). 상담 경로 자녀는 없다 → 컨설턴트가 학생 탭·메신저·계약 문서 탭에서 못 봄 | POLICY GAP **M** — 권고: 카드 상속(B8)에 더해 학생 단위 배정도 이어받게 할지 오너 확인(열람 범위 확대) |
| F3 | 아무도 진행 못 하는 상태(막다른 길) | (i) 시간 없는 requested 수락 → 유령(수정) (ii) 컨설턴트 화면 버튼 전부 admin 전용(수정) (iii) 카드에서 컨설턴트가 사라짐(수정) (iv) 컨설턴트 체험 확정 후 온보딩 발송·체험권 재처리는 관리자 전용인데 관리자 알림 없음(B2) (v) 컨설턴트 비활성(B7) (vi) 보호자 노쇼·시간 경과 후 결과 미기록(B17) | (iv)~(vi) POLICY GAP |
| F4 | `confirm_trial_intent` 류 서버 함수 실행권한 | 문제의 함수들(`confirm_trial_intent`, 링크 발급, finalize, grant, enqueue, claim)은 anon/authenticated 실행 불가(service_role 전용) 확인. `assign_consultation_owner`·`admin_record_consultation_outcome` 은 내부에서 관리자/담당 검사 | OK |
| F5 | 담당 컨설턴트 외 컨설턴트의 카드·결과 기록 | RLS·RPC 모두 거절(테스트) | OK |
| F6 | 컨설턴트 칸반 범위 | `admissions_consultant_id` 또는 `consultant_assignments` 일치 카드만(B8 수정 후 카드 포함) | OK |

## (g) 알림·메일

| ID | 시나리오 | 실제 | 판정 |
|---|---|---|---|
| G1 | 상담 확정·시간 변경 | Google 네이티브 초대 1회(`sendUpdates=all`), 시간 변경은 PATCH, 커스텀 메일은 초대가 영구 실패한 경우 fallback 1회(지문 중복 방지) | OK |
| G2 | 예약 링크 메일 | 명시 클릭 시에만 발송, 취소 상담은 이제 거절(B19) | OK(수정 후) |
| G3 | 온보딩 안내 메일 | 이미 발송된 링크는 `already_sent`(중복 방지), 재발급 시에만 새 메일 | OK |
| G4 | 계약 메일 | DocuSign 1통, 재시도는 `already_sent` 흡수, 게이트 OFF 면 미발송 | OK |
| G5 | 거절 | 거절 메일 + Google 취소 알림(이중 채널, 의도) | OK |
| G6 | 테스트가 실제 고객에게 발송하는가 | 이번 감사·테스트는 메일·Google·DocuSign 호출 0(전부 psql 또는 mock) | OK |

## (h) 데이터·보존

| ID | 시나리오 | 실제 | 판정 |
|---|---|---|---|
| H1 | append-only 이력 | 상태·배정 이력은 삽입 전용, 결과 기록 이벤트의 previous_status 가 부정확했던 점만 수정(B14) | OK |
| H2 | 보존 배치와의 관계 | `retention_anonymize_expired_consult_requests` 는 **구 `consult_requests` 테이블만** 처리한다. 현재 흐름의 `consultations`(이름·이메일·전화·고민·검토 메모)·`prospect_contacts` 는 어떤 보존 배치도 다루지 않는다 | POLICY GAP **M**(개인정보 보존) — 권고: 2년 익명화 대상에 두 테이블 추가(오너의 보존 기간 확인 후) |
| H3 | 테스트 데이터 정리 | 새 테스트는 실행 ID 행만 만들고 정리, 체험권 원장 등 append-only 잔여물은 실행 ID 자녀에 한정 | OK |

## 이번 라운드에서 고친 것(요약)
- DB(`20261922000000`): B3 수락 시간 필수 / B14 결과 기록 상태 검사 / B13 거절·취소 상태 검사 / B9 휴무·닫힌 예외 슬롯 제외(공용 `consultant_slot_blocked`) / C2 지난 시각 거부 / B4 옛 링크 조회 무효화 / C9 취소 상담 링크 발급 거절 / B8 학생 카드 담당자 상속 + 백필 / B18 담당자 역할 검사.
- 앱: 컨설턴트가 수락·거절·결과 기록·체험 확정을 실제로 할 수 있게(`requireAdminOrConsultant`, `requireAdminCapabilityOrAssignedConsultant`), 시간 없는 신청은 수락 버튼 대신 안내, 확정 상담 거절 시 Google 일정 즉시 정리, 취소 상담에는 예약 링크 메일 미발송.

## 원격 반영 시 유의
- 마이그레이션은 로컬에만 적용했다. 원격 적용 시 B8 백필은 조건(원 상담에 담당자 있고 카드에 없음)에 맞는 행이 0건이라 실제 변경은 없다.
- B14 는 이미 `cancelled` 인 2건의 outcome 은 건드리지 않는다(데이터 정정은 하지 않음).
