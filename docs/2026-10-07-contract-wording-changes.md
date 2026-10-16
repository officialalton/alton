# 계약·화면 문구 변경 제안 (Mercury 전환) — 2026-10-07

범위 점검: `docs/contracts/*`, `lib/legal/documents/generated.ts`, `lib/contracts/*`, 지급 관련 UI 문구, 문서. 서명된 문서·법적 문구는 이 작업에서 **수정하지 않았다.**

## 1. Wise 전용 문구 검색 결과
- 계약서(교사 US·비US, 컨설턴트), `generated.ts`, `lib/contracts`: **Wise 문구 없음.** 계약은 "Bank transfer (wire) to the recipient account on file"와 회사 부담 수수료만 말한다. 계약 문안 수정 불필요(Mercury 전환이 계약 변경 사유가 아님).
- 개발자 화면/주석의 Wise 문구(명백히 틀려진 문구 → 이 작업에서 중립 문구로 정정, 법적 텍스트 아님): `app/admin/PayoutBatchesTab.tsx`(버튼 "지금 송금 요청 — Wise 연동 전에는 사용할 수 없습니다", 토스트 "Wise 송금 요청을 보냈습니다.", "Wise API를 호출하지 않고…", "Wise 송금 요청 뒤 실패한 건…"), 해당 테스트 `PayoutBatchesTab.test.tsx`, 주석 `lib/payout/auto-dispatch.ts`, `payout-batches-actions.ts`.
- 정책 대장 1줄(`POLICY-DECISIONS.md` "Wise 연동 때 재조정")은 "Mercury 지급 통합"으로 갱신.
- 기존 로드맵 v3·P4-2 정산 계획 문서의 Wise 경로는 역사 문서이므로 그대로 두고, 최신 기준은 `CURRENT.md`/설계 문서가 가리킨다.

## 2. 계약에서 유지할 것 (변경 없음)
은행 송금, 합의된 통화(US=USD, KR=KRW), 송금·중개·환전 수수료 회사 부담, 26일/10일 기한(LA, 주말·미국 연방 은행 휴일은 직전 영업일), 수취인·은행명·계좌 끝 4자리 기록.

## 3. 법무/기획자 검토가 필요한 제안 (적용하지 않음)
| # | 위치 | 현재 | 문제 | 제안 |
|---|---|---|---|---|
| 1 | 교사 US 계약 §5, 컨설턴트 §5, Schedule A | "received in the designated recipient account no later than the 26th/10th" | 한국 교사·컨설턴트에게 KRW 국제송금이면 **수취 계좌 입금 기준**은 Mercury 1–3영업일+한국 은행 시간에 달림. 첫 지급 실측 전에는 약속 가능 여부 미확인. 시스템도 기한을 "지급 완료(수취)" 기준으로 두고 송금일을 앞당김 | 문구 유지(회사가 더 엄격). 대신 운영에서 KRW 송금 앞당김 영업일(기본 5)을 실측 후 조정. 입금 지연 위험이 크면 "sent by" + 최대 N영업일 도착으로 완화하는 안은 오너 결정 |
| 2 | 교사 비US 계약 §5 | "paid no later than" | US/컨설턴트 계약("received")과 기준이 다름(수취 vs 지급). 시스템 정책은 수취 기준 | 한 기준으로 통일 여부를 기획자가 결정 |
| 3 | 비US Schedule A "Payment method and recipient details: ____" | 빈칸 | US 계약은 "Bank transfer (wire)…" 문구가 채워져 있고 비US는 빈칸 | 동일 문구(은행 송금, 계약 통화, 수취인·은행·끝 4자리) 추가 제안 |
| 4 | §5 "the Teacher receives the full statement amount" | 수취인이 정산 금액 전액 수령 | KRW는 환율·수신 은행 수수료로 수취 KRW가 달라질 수 있음. **첫 지급 전 "전액 KRW 수령" 확인 불가.** 수신 은행 차감 수수료는 회사가 보전해야 한다는 해석이 될 수 있음 | 문구 유지 + 운영 절차에 "부족 수취 시 보충 지급(top-up)" 반영(설계 문서 4절 구현). 문구 변경은 법무 검토 |
| 5 | 통화 표기 | KRW/USD 시급·월정액 | USD 정산 중 미국 교사는 ACH(USD)이므로 환전 없음 | 변경 없음 |
| 6 | Smart Notes/기타 | 해당 없음 | — | — |

## 4. 서명된 계약
과거 서명본(`teacher_contracts`, 변경합의서 포함)은 수정하지 않는다. 지급 방식 변경(Wise→Mercury)은 은행 송금이라는 계약 조건 안에서의 운영 수단 변경이므로 변경합의서 불필요(법무 확인 권장).
