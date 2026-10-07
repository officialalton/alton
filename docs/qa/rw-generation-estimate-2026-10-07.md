# R&W 추가 생성 견적 (2026-10-07, 읽기 전용 산출)

필요량(plan-report, unique-sets 워크트리): EI easy 12 / medium 38, SE easy 7 / medium 69 = 126건. +30% 여유 = 약 164건 채택 목표.

## 근거 로그 (과거 실측)
- `data/mock-exam-generation/mockgen-20260929/rw-supplement/ledger.json`: 지출 $6.2413, 후보 58(easy-1 14, medium-1 26, medium-2 8, medium-3 10), 채택 33(easy 12/14, medium 16/26, 5/8) → 후보당 약 $0.108, 채택당 약 $0.19, 채택률 약 57%.
- `.../se-topup/ledger.json`: SE medium 지출 $1.3382, 채택 7 → 채택당 약 $0.19.
- 단계: gen(Sonnet 계열 sync) → review-fable → review-opus 교차 검증 → cross.json → adopted.json (각 run 폴더).

## 견적
- 채택 126건 기준: 126 x $0.19 = 약 $24 (후보 약 221).
- 여유 +30%(채택 164건 목표): 후보 약 288 x $0.108 = **약 $31** (범위 $27~35).
- 통과율 가정 57%(medium 62%, easy 85% 수준 편차), 소요 시간: 과거 run 1개 배치(8~26건)가 gen+review 약 3~6분 → 약 288건 동시성 4로 1.5~2.5시간.

## 명령(실행 안 함)
`npx tsx scripts/mock-exam-generation/generate.ts --run rw-stock-20261007 --plan <plan.json> --only expression_ideas계열skill,standard_english계열skill --concurrency 4` 후 `review.ts`(fable/opus) → `merge-adopted.ts`/`gap-audit.ts`. plan.json 은 cells[{system,domain,skill,difficulty,generate}] 형식이며 skill 별 수량은 repair-plan.json 의 skill 분배에 맞춰 +30% 로 채운다.

## 사람 눈에 보이는 게이트
정답 독립 채점(runGenerationPipeline), 영어 전용, explanation_en 필수(mock-exam-content-guidelines.md), 보기 중복 없음, 지문 재사용·근접 중복 점검(gap-audit/diversity).

## 위험
- 근접 중복 거절로 채택률이 57% 아래로 내려갈 수 있음(세트 간 중복 0 정책, SE medium 은 문형이 한정되어 특히 높음).
- 지문 재사용: 같은 지문에서 여러 문항이 나오면 세트 간 중복 판정 위험.
- 환경: 키 변수명 `ANTHROPIC_API_KEY`(.env.local). 이 세션에서는 .env.local 복사 명령이 분류기에 막혀 실행 가능 여부 미확인.
