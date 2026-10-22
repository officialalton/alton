# 비용 원장 실제 경로 검증 (격리 스택, 2026-10-22)

**범위**: 실제 `createSupabaseEssayStore` + `processEssay` + 격리 DB(원장 RPC·테이블, 마이그레이션 650/660 포함 전체 적용)를 실행했다. **모델 클라이언트만 스텁**(Anthropic 호출 0, 비용 $0). 격리 스택 `ALTON_ledgerv`(API 57421·DB 57422), 학생·응시·세트 항목은 테스트 행(FK 우회 시드), 종료 후 스택 정지·`config.toml` 원복. 스크립트: `scripts/essay-ledger-verify.ts`(57421/57422 이외 대상이면 실행 거부).
**검증한 코드**: `lib/essay-grading/{store,costs,queue,ledger-status}.ts` — `origin/main`(499bdf7f1 이후)과 diff 0(동일 파일).

| 시나리오 | 결과 | 근거(격리 DB) |
|---|---|---|
| S1 예약→정산 | PASS | 호출 2회, `essay_ai_cost_events` settled 0.048, 행 cost 0.048, 월 지출 0.048 |
| S2a 호출 중 예외(unsettled) | PASS | 예약이 reserved + call_started 로 남고 월 지출에 최악 비용 0.234 포함 |
| S2b 재시도 대기 | PASS | next_retry_at 이전 재요청은 `already`(모델 호출 없음) |
| S2c 재시도 비용 누적 | PASS | 잘못된 출력 실패(0.048 정산) 후 재시도 성공 → 행 0.096(덮어쓰기 없음), settled 이벤트 2건 |
| S3 일일 상한 | PASS | (격리에서만 상한 2) 세 번째는 `failed·daily_cap`·시도 0·다음 UTC 자정 대기, 모델 호출 없음, 다음 날 처리됨 |
| S4 월 예산 | PASS | (격리에서만 예산 최악비용+0.01) 첫 건 완료 후 둘째는 `failed·monthly_budget`·다음 UTC 월 시작(2026-11-01) 대기, 모델 호출 없음 |
| S5 기준 답안 <3 | PASS | `failed·no_reference_answers`, 호출 0, 시도 횟수 0, 원장 이벤트 0 |
| S6 동시 요청 | PASS | 두 요청을 동시에 실행: 완료 1·`monthly_budget` 1, 모델 호출 2회(한 건분), 정산 합계 0.048 ≤ 예산 |
| S7 UTC 월 경계 | PASS | 9/30 23:59:30Z 정산분은 9월 지출(0.048), 10/1 00:00:10Z 월 지출 0 |

`essay_ai_ledger_status()`는 시나리오 종료 후 월 지출 0·미정산 0·행/원장 불일치 0.

## 검증하지 않은 것(정직한 한계)
- **Production 실제 요청 경로**(Next.js 서버 액션·인증·실제 응시 제출 → 큐)는 확인하지 않았다. 이 검증은 저장소·큐 계층까지다.
- 실제 Anthropic 응답·실단가: 스텁이라 입력 5000·출력 600 토큰 가정(단가 3/15 USD per M)이다.
- 격리 시드는 FK 검사를 우회한 최소 행이다(실제 응시·세트 항목 그래프 아님).
- Production 한도·환경변수는 어떤 것도 바꾸지 않았다(상한은 격리 프로세스 안 환경변수만 변경).
- 공유 Production DB의 원장 상태(`essay_ai_ledger_status()` ledger_present, month 0.06206)는 배포 시 읽기 전용으로 확인한 값뿐이다.
