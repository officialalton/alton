# SAT R&W Hard 보강 C안 — 실행 기록 (2026-10-22)

오너 지시: 공개 SAT 30세트의 R&W Module 1 · Module 2 쉬운(lower)에 같은 기술의 Hard 를 모듈당 약 3개(약 11%) 넣는다. Module 2 어려운 버전은 그대로. 라벨만 바꾸기 금지.

## 결과 (DB 집계, 2026-10-22)
| 구간 | 전 | 후 |
|---|---|---|
| M1 (810문항) | Easy 270 · Medium 540 · Hard 0 | Easy 269 · Medium 456 · **Hard 85 (10.5%)** |
| M2 쉬운 (810) | Easy 270 · Medium 540 · Hard 0 | Easy 268 · Medium 456 · **Hard 86 (10.6%)** |
| M2 어려운 (810) | Medium 540 · Hard 270 | 동일 |

- 교체 문항 171개(Medium 168 → Hard, Easy 3 → Hard), 모듈당 3개 51모듈 · 2개 9모듈(Hard 재고 171개가 180에 모자람). 재고 소진, 예비 Hard 0.
- 영역·기술별 문항 수는 모듈마다 교체 전과 동일(같은 기술만 교체, 30세트 전수 대조). M2 어려운 경로 문항은 전 세트 불변.
- 공개 SAT 세트 30개 · 이름 중복 0 · 2,430문항 전부 서로 다른 문항. 새 버전 30개 모두 공개(5개씩 6배치, 배치마다 DB 검증), 이전 버전은 archived 로 보존. 공개 시점 응시 2건은 이전 버전에 그대로 연결.
- 교체돼 빠진 Medium/Easy 문항 171개는 미배정 재고로 돌아감(삭제 없음).

## Hard 후보
- 기존 미배정 Hard 71개(구조·답 누설·한글·렌더·해설 점검 통과 전수) + 신규 생성 채택 100개(후보 158 → Fable hard 적합 + 정답 정확성 두 모델 통과 103, 3개 제외).
- 제외: `recipe-inferences-09`(공개 inferences 문항 f0f334c4 와 지문 도입·전제가 비슷), ALMA 노트 소재 4건 중 2건(`recipe-rhetorical_synthesis-15`, `-21`).
- 구조 판정: 이름·주제만으로 탈락시키지 않고 지문·질문·추론 비교. 5-gram 지문 Jaccard(대 공개 R&W 2,430문항·풀 내부) 0.12 초과는 공개 대비 1건·풀 내부 2쌍(전부 위 제외 대상), 대표 4쌍 직접 읽어 독립 확인. 답 누설 게이트(`lib/rw-answer-leak`) 신규·기존 174개 모두 통과(자가 점검: 공개 400문항에서 1건 플래그되어 게이트 작동 확인).
- gid 는 `rwh1022-` 접두로 새로 부여(`recipe-…` 는 예전 런과 겹칠 수 있어 임포트가 건너뜀).

## 비용
- SAT 장부(별도): 생성 Opus + 검수 Fable·Opus **$23.607**(진행 중 호출 0, 예약 0). 예산 상한 $30 대비 잔여 $6.39 — 사용하지 않음(2차 보충 생략).
- AP 생성 원장(`data/ap/sample-2027/ledger-summary.json` cumulative $532.6859)에는 포함되지 않는 SAT 장부다. 두 장부를 합산한 총액 관리가 필요하면 오너 지정.
- 기준 시각: 생성 종료 후(2026-10-22 UTC), 이후 유료 호출 없음.

## DB 변경 (공유 DB)
1. 임포트 100건(`62_import_rw_hard.sql`; confirmed·publish, render OK 100, explanation_en 100) + 키워드 링크(`63`).
2. **마이그레이션 `20262100000680_rw_hard_in_m1_and_lower.sql`**: `mock_exam_set_items.m1_eligible`·`m2_lower_eligible` 생성 열을 easy·medium·hard 로 완화(R&W Hard 가 M1/lower 에 들어가려면 검증 함수가 읽는 열을 바꿔야 함; 20262100000630 이 수학에만 했던 규칙을 R&W 로 확장). 라우팅 임계값·점수 앵커는 안 건드림. 롤백: 630 의 식으로 복귀(그 전에 R&W Hard 가 M1/lower 에 있는 세트 버전을 먼저 없애야 함).
3. 세트 새 버전 30개(`64`; 검증 `mock_exam_validate_mst_set` 모두 ready, 다른 라이브 세트와 공유 문항 0)를 관리자 화면 "이 세트 공개하기"로 공개.
- 산출 SQL: `data/prod-open/sat-rw-hard-sql/`, 입력: `data/mock-exam-generation/rw-hard-topup-20261022/`, 생성 원본: `data/mock-exam-generation/mockgen-20260929/hardtopup-20261022/`.
- 스크립트: `scripts/mock-exam-generation/hard-topup-gate.ts`, `scripts/prod-open/sat-rw-hard-alloc.py`, `scripts/prod-open/sat-rw-hard-sql.ts`.
- 통합 테스트 기대값 갱신: `lib/mock-exam/mock-exam-mst-phase2.integration.test.ts`(R&W hard 도 m1/lower eligible). 이 테스트는 로컬 DB가 필요해 이번에 실행하지 못함.

## 한계·주의 (숨기지 않음)
- **난이도 라벨은 생성 목표 + AI 감사(Fable hard 적합·두 모델 정답 검수)이고 학생 응시 데이터로 보정되지 않았다.** 실제 시험의 모듈별 Hard 비율은 공개 문서로 확인하지 못했다(약 11%는 보수적 시작값).
- **라우팅 영향 미평가**: M1 에 Hard 가 들어가 M1 정답 수가 낮아져 쉬운 경로로 가는 학생이 늘 수 있다. 임계값·점수 환산은 그대로이므로, 학생 응시 데이터 확보 후 보정(정책 2026-10-15).
- 신규 Hard 문항 사람 검수 없음(모델 교차 검수만). 일부 기술은 Hard 가 적다(`command_of_evidence_quant` 신규 0, transitions 10 · words_in_context 10 · inferences 9).
- **학생 화면 확인 범위**: 공개 전 관리자 미리보기(Test 1 초안의 R&W 8번 Hard, `cross_text_connections`)와, 공개 후 Production 학생 화면(학생 테스트22)에서 **Test 1 의 R&W Module 1 문항 8번**(새 Hard)을 확인했다. 나머지 29세트와 다른 교체 문항은 화면 확인 안 함(DB·검증 함수 기준만).
- 테스트 응시 1건 생성(정리 대기): 학생 테스트22 · `28ddc49c-67a9-4009-9701-f05974191237` (SAT Practice Test 1, R&W Module 1 진행 중, 제출 안 함). 테스트 계정이라 이용 통계 제외 대상이어야 한다.
- 적용 SQL 은 NOTICE 를 볼 수 없는 `supabase db query` 로 실행해 세트별 건너뜀 사유가 보이지 않았다(첫 시도에서 30세트 모두 건너뜀 → 원인은 R&W Hard 의 M1/lower 배정 금지 규칙, 마이그레이션 680 으로 해결 후 재실행해 30개 생성).
