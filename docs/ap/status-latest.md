# 최신 상태표 (단일 문서, 2026-10-08 갱신 — 보고 대신 이 표를 갱신한다)

| 항목 | 상태 |
|---|---|
| 누적 비용 | $22.966 (무효 v8-bio-r $0.1146 포함), 중단선 $27, 여유 $4.034, 총 상한 $30 |
| AB 사용 가능 재고(자동 통과·결함 없음·중복 제외·렌더 통과) | MC 202 / FRQ 35 (그래프가 풀이에 필수인 MC 30, 화면 검증 206건 중 자동 Playwright 증거) |
| AB 풀 세트 | **선택 완료(정확 제약 선택, 제약 전부 통과)**: `docs/ap/ab-full-set-selection.md` / `data/ap/stock/ab-full-set-selection.json`. 48건 중 화면 검증 완료 40 · 대기 8. 그래프 필수 MC 10(내부 기준), 단원·스킬 공식 범위 통과, FRQ 6유형. 사용 이력(풀 모의고사 겹침 0·연습 재노출)은 `published-usage.json` 미제공 -> 미반영. 신규 생성 불필요, 예비 생성 미승인 |
| 알려진 결함 | planApSet 탐욕 선택은 `ab-select.ts` 로 대체(풀 세트용); 화면 검증 증거 0; Bio D 온도 방향 불일치 템플릿(v10 에서 수정) |
| Bio data_short 원형 | **재검증 대기(수정 후)** — v9 첫 통과 3/4(원래 버전 `v9-bio-data-short` 그대로 보존), v10 동결 구성 `config/ap-frozen/bio-data-short.v10.json` 기록, 유료 검증 미실행 |
| Bio v9 통과 항목 | k1 pepsin·k2 pepsin·k3 amylase: 온도 방향 결함 없음(무료 결정적 검사). 루브릭 문구는 구버전 — v10 문구 기준 재판정 필요하면 재검증 시 포함. k0 catalase: 결함 있음(실패 사유와 일치) |
| Bio v8 통과 | 4건 모두 amylase/pepsin, 방향 결함 없음. 원래 버전 보존 |
| 무효 측정 | v8-bio-r (승격 근거 제외) |
