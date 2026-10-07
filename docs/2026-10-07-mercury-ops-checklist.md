# Mercury·Books·Stripe 운영 체크리스트 (오너 작업) — 2026-10-07

이 문서는 **이름과 순서만** 적는다. 토큰·키·계좌 값은 어디에도 적지 않는다. 실제 송금은 별도 승인 전까지 하지 않는다.

## 1. 현재 스위치 상태 (전부 닫힘)
| 스위치 | 위치 | 상태 | 여는 조건 |
|---|---|---|---|
| `MERCURY_PAYOUTS_ENABLED` | Vercel env | 미설정(=닫힘). 정확히 `true`일 때만 API 클라이언트가 호출 | 샌드박스 검증 완료 + 오너 승인 |
| `real_disbursement_enabled()` | DB `payout_disbursement_gate` | false | 법인·Mercury 계정 확인 + 오너 승인(프로덕션은 별도 승인) |
| `PAYOUT_CRON_ENABLED` | Vercel env | 미설정 | 크론이 시도 모델과 연동된 뒤. 지금은 **열지 않는다**(크론은 표식만 남기는 레거시) |
| `payout_auto_dispatch_settings.enabled` | DB | 환경별(로컬 true) | 위와 동일 |
| 웹훅 수신 | `/api/webhooks/mercury` | 서명 방식 미확정 → 열려도 501 거부 | Mercury에서 서명 검증 방식 확인 후 구현 |

## 2. Mercury (오너)
1. 계정: 회사 계정 개설 확인(10-05). 지급용 계좌 지정(운영 계좌와 분리 권장) → `MERCURY_PAYOUT_ACCOUNT_ID`.
2. API 토큰: 설정 > API에서 발급(권한은 최소: 거래 읽기 + 지급 요청). **Approval Queue(request-send-money)를 쓸 수 있는 토큰 종류인지 Mercury에 확인.** IP allowlist 없이 쓸 수 있는지 확인(Vercel은 고정 IP 없음). 값은 Vercel env `MERCURY_API_TOKEN`(Preview/Production 분리).
3. 승인 규칙: Mercury 대시보드에서 송금 승인자·한도 설정. ALTON의 지급 승인자와 Mercury 승인자를 가능하면 다른 사람으로.
4. 수취인: Mercury **수취인 초대**로 교사·컨설턴트가 직접 입력(USD=ACH, 한국=국제송금). 한국 수취인 폼의 필수 항목 캡처 → 설계 문서 미해결 항목에 기록.
5. 웹훅: 거래 이벤트(`transaction.created/updated`) 엔드포인트 등록은 서명 검증 구현 후. 서명 방식·재시도 정책을 Mercury에 문의(문서 미기재).
6. **KRW 첫 거래(소액) 확인 항목**: UI에서 수취 KRW 금액 지정 가능 여부, 견적 환율 고정 시간, 1% 환전 수수료 외 추가 수수료, 수취 KRW 실제 도착액, 소요 시간, 받는 은행 수수료, 거래 객체의 환율·수수료 필드.
7. 한국 은행 휴일표: 2026·2027 공식 월력요항 대조 완료, 2028~2030은 산출값(공식 발표 후 재대조), 임시공휴일·선거일 추가 절차는 `docs/2026-10-07-kr-bank-holidays.md`.

## 3. Mercury Books (오너/회계사)
1. Books 구독(2026-12-31까지 면제 조건 확인), Mercury 은행 계정 연결 확인.
2. 계정과목표: `docs/2026-10-07-mercury-books-reconciliation.md` 2절 항목을 회계사와 검토해 Books에서 설정하고, 결정된 이름을 ALTON `accounting_account_map`에 기록(검토 표시).
3. Stripe 연결: Books의 Stripe 연결에서 설정. Stripe payout(Mercury 입금)이 이중 기록되지 않는지 첫 달에 점검.
4. ALTON→Books 쓰기 API가 있는지 Mercury에 문의(없으면 월 대사는 CSV 대조).

## 4. Stripe (오너)
변경 없음: 고객 결제·환불·수수료는 기존 ALTON 웹훅(권한·수업권용) + Books 공식 연결(회계용). ALTON은 Stripe 거래를 대사 파일에 넣지 않는다.

## 5. 환경변수(이름만)
`MERCURY_PAYOUTS_ENABLED`, `MERCURY_API_TOKEN`, `MERCURY_PAYOUT_ACCOUNT_ID`, `MERCURY_API_BASE_URL`(선택, 샌드박스용), `PAYOUT_CRON_ENABLED`, `CRON_SECRET`(기존).

## 6. 검증 순서
1. 샌드박스(`MERCURY_API_BASE_URL`을 샌드박스로, 별도 토큰): 수취인 초대 → request-send-money(ACH) → 거래 조회 응답 형태 확인(목록·단건 경로, `requestId`↔거래 연결, 웹훅 지원 여부). 실제 돈 없음. 결과로 `lib/payout/providers/mercury.ts`의 미확정 경로 보정.
2. **소액 실거래(별도 오너 승인 필요)**: USD ACH 1건(예: 수취인 본인 동의 하의 소액) → 반환·수취 확인 절차까지, 이어서 KRW 국제송금 1건(소액) → 위 2-6 항목 실측.
3. 실측값으로 `transfer_lead_business_days_krw`(현재 5), 문구(전액 수령 여부) 확인. 수취 확인 입력은 없으므로 실제 도착액·수수료는 Mercury 거래·은행 화면에서 실측 후 문서에만 기록.
4. 그 뒤에만 `MERCURY_PAYOUTS_ENABLED`·게이트를 순서대로 열고(Preview → 소액 → 정기), 각 단계 오너 승인.

## 7. 미결 결정
- (확정 10-07) KRW 송금 앞당김 5 한·미 공통 영업일, 수취 확인 단계 폐지(sent=지급 완료, 반환 시에만 반환 기록·재송금). ACH 반환이 늦게(최대 60일) 와도 반환 기록+재송금으로 처리.
- 기존 암호화 계좌 저장소 유지 vs Mercury 초대로 일원화 후 폐기(설계 문서 2절 권장: 당분간 참조원 유지).
- 정산 권한 부여 대상자(`payout_settlement_edit/approve`, `payout_request_mercury`, `payout_approve_mercury`, `accounting_reconcile`) 지정 — 마스터 1명이 정산 승인과 지급 승인을 모두 할 수 있다(직무 분리 설정 `payout_dual_control_required` 기본 꺼짐, 필요 시 마스터가 켬). 승인자는 항상 감사 기록.
- 컨설턴트 정산 paid 마감은 현재 기존 화면에서 수동(시도의 settlement_not_marked_paid 플래그).
- 지급 시도 자동 생성 여부(현재 없음 — 사람이 승인된 정산에서 생성).
- 계약 문구 제안(`docs/2026-10-07-contract-wording-changes.md`) 법무 검토.
- 비US 교사 계약서 Schedule A 지급 방식 빈칸.
