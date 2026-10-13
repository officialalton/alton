# AP Statistics S3-b 보고 (2026-10-13)

오너 지시("ST2 진행", standing "기다리지 말고 진행"): ST1 v2 와 겹치지 않는 두 번째 풀 세트(ST2)를 가상 칸 0 으로 조립. 이번 작업 하드 한도 $2.60(누적 하드 스톱 $42.93), 자동 수선 없음. 키는 파일에 쓰지 않았다(유료 호출은 조정 세션의 `.env.local` 값을 프로세스 환경변수로만 읽음). 원격·비프로덕션 DB, push, 프로덕션, 공유 ALTON 스택 무접촉.

## 1. 부족분 계산 (무료)
- ST1 v2(`assembled/stats-st1-s3a-prefer-ep.json`)의 항목을 막고(`stats-assign.ts --block-file`) 남은 재고(단독 59·세트 3·FRQ 4)로 ST2 를 풀면 **가상 20칸**: 단독 13(단원1 6·단원2 3·단원3 3·단원5 1), 단원 5 회귀 공유 세트 1, FRQ 4(유형 전부). 예비로 남은 재고는 단독 23·이항 세트 1 이 전부 ST2 에 쓰였다.
- `stats-st2-shortfall.ts`(신규, 무료): 신규 시드 후보(원형당 1, 같은 문항군)를 비용 100 으로 더해 정수계획이 신규 문항을 **최소**로 쓰게 하고 어느 원형이 필요한지 산출 → 단독 13원형.

## 2. 유료 런 (동결 → 커밋 → `--check-only` 일치 → 실행)
| 런 | 구성 | 비용 | 첫 통과 |
|---|---|---|---|
| `stats-s3b-a` (seed0 9600) | 13원형 x 시드 2 = 단독 26 | $0.8687 | 23/26 (88%) |
| `stats-s3b-b` (seed0 9700) | 단원 5 회귀 세트 x 3 | $0.3086 | 3/3 |
| `stats-s3b-c` (seed0 9800) | FRQ 4유형 x 3 = 12 | $0.6668 | 5/12 (42%, 4유형 모두 1개 이상) |
| `stats-s3b-d` (seed0 9900) | 단원·exam_prep 보강 11원형 x 1 | $0.3957 | 11/11 |
합계 **$2.2398 / 한도 $2.60**. 누적 $40.3301 -> **$42.5699**(하드 스톱 $42.93, 중단선 $45 여유 $2.4301, 총 상한 $50 여유 $7.43). 후보 52 중 **통과 42 = 81%**(단독 34/37 = 92%). d 런은 a·b·c 결과를 보고 ST2 단원 목표(10/9/9/7/7)·exam_prep 를 맞추려고 추가했다(예산 안). 난이도 감사: 판정기-구조 일치 10/10.
단가: 단독 $0.039~0.042/후보, 세트 $0.103/세트, FRQ $0.056/후보.
반려 10건: FRQ 7(근접·완전 중복 4, 채점 기준·범위 3) · 단독 3(풀이자 불일치 1, 오답 설명 1, 근접 중복 1). 모두 수선하지 않았다. 코드 수정(`stats_s3_p.py` 에 단계 목록만 추가) 때문에 a·b·c 동결 구성의 생성기 해시는 지금 코드와 다르다(런의 해시는 각 `run_manifest.json`).

## 3. 렌더·화면 증거
- 렌더: 이번 배치 52행 중 그림·표 필요 31행 전부 pass, 해당 없음 21, **fail 0**.
- 화면(격리 스택 `ALTON_apst2`, 하드닝 가드 통과): 통과 42개 전부 390x844·1280x800 = 96항목, 점검 672건(pass 552 · 해당 없음 120 · **fail 0**). 스크린샷 `docs/ap/screen-evidence/stats-s3b/`. 연습 세트 20문항 단위 쪼개기 때문에 마지막 3문항은 두 번째 시드·검사로 보충해 증거 파일에 병합.

## 4. ST2 조립 (게시본·ST1 v2 미변경)
`stats-assign.ts --sets ST2 --prefer-exam-prep --block-file <ST1 v2>` → `data/ap/stock/assembled/stats-st2-s3b.json`(+`-verifier.txt`), 관리자 목록용 복사본 `data/ap/stock/exact-assign-stats-st2-s3b.json`.
- **가상 칸 0**, 독립 검증기 위반 0, **ST1 v2 와 겹침 0**, 구조 문항군 38/38 서로 다름.
- 단원 10/9/9/7/7 · 스킬 4/10/14/14 정확 일치. MC **exam_prep 21/42 = 50%**(ST1 v2 17/42 = 40%).
- 공유 세트: 단원 2 이항(`st_set_binomial`), 단원 5 회귀(`st_set_regression`, 문항별 exam_prep 1/3). FRQ 4유형 각 1: Q1 조사 질문 포함(q1_multifocus) · Q2 회귀 · Q3 추론 · Q4 통합, 전부 S3-b 신규·exam_prep.
- 출처 배치: stats-s3b 22문항 · s3a 8 · s2b 4 · s1 2 · s2a 2 (MC 단독 36 + 세트 2). 관리자 목록 노출: `ST` 접두는 `SET_PREFIX_SUBJECT`·`saveable` 정규식이 이미 처리(코드 변경 없음). 적재 필요 배치는 `stats-s1`·`s2a`·`s2b`·`s3a`·**`stats-s3b`**(신규 등록).

## 5. 코드·테스트
`lib/ap-admin/batches.ts`(stats-s3b 등록), `stats-assign.ts`(`--block-file`, `cost`, `unitWeight` 옵션 — 기본 동작 불변), `stats-st2-shortfall.ts`(신규), `stats-st2-stock.test.ts`(신규, ST2 가상 0·겹침 0·검증기·exam_prep>=35%), 재고 파일 목록 3곳에 `stats-s3b-items` 추가, `stats_s3_p.py` 단계 목록 4개. 격리 스택에서 `vitest`(stats-*·`lib/ap-admin`·`lib/ap-exam`·`lib/ap-generation`) **62 파일·516 테스트 통과**, `tsc --noEmit` 오류 0.

## 6. 외부 변경과 정리
Anthropic API 호출만(원장 기록). 격리 스택 `ALTON_apst2` 정지·`config.toml` 원복·락 삭제, 개발 서버 종료, 로컬 데모 시드는 스택과 함께 소멸, 워크트리 `node_modules`·`.next`·`.venv-ap` 정리. DB 적재 없음(조정 세션이 관리자 화면에서 적재 후 ST2 초안 저장).
