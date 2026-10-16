# SAT 모의고사 확장 인계 (2026-10-15)

결과: 게시 13세트(T1~T13) + **신규 13세트(SAT Practice Test 14~26)** 계획 완료 → 총 26세트. 목표 35에는 미달(예산 상한 $70: 지출 $66.44).
DB·Production 변경 없음. 은행 임포트·세트 조립·게시는 총괄이 한다(아래 순서).

## 산출물 (`data/mock-exam-generation/sat-expand-20261015/`)
- `final/adopted-all.json` — 신규 R&W 채택 645건(비문학 8개 과목, easy 151·medium 447·hard 47, Fable+Opus 교차 검수 통과·정답 누설 게이트·정답 위치 A161/B148/C165/D171). gid 접두사 sx/sy/sz.
- `final/classified-all.json` — 위 지문의 과목·소재 분류(소재 상한 계산용).
- `final/new-sets.json`, `new-sets-meta.json`, `plan-report.json`, `shortfall.json` — 14~26 계획(투영 id `proj:<gid>` + 기존 은행 id 혼합).
- `final/exact-assign-sat-14-26.json` — 세트별 정확 배정 검증(147문항·모듈 구성·중복 0·소재 상한·영역×난이도×형식 분포). allOk=true, 신규 간 중복 0, 게시 13세트와 중복 0.
- `final/set-copies.json`(선택) — T2 소재 상한 1건 교체 사본. 기존 세트 비변경 원칙에 따라 적용하지 않아도 된다.
- 계획 보고서 `docs/qa/sat-expand-26-sets-plan-2026-10-15.md`, 생성 원본 `gen/`·`top2/gen/`·`top3/gen/`(run/ 에 gens·cross·review 결과).
- 스크립트: `scripts/mock-exam-generation/sat-expand-verify.ts`(검증), `batch-pipeline.ts cross` 에 `--batch` 추가(Message Batches, 단가 1/2), `rw-rebalance-cands.ts` 분류 경로를 20261015로 변경·호출 로그 추가.

## 총괄 적용 순서
1. `npx tsx scripts/mock-exam-generation/import.ts --file data/mock-exam-generation/sat-expand-20261015/final/adopted-all.json --publish --dry-run` 로 확인 후 비프로덕션에 `--publish` 임포트, 이어서 `scripts/keywords/link-imported.ts --file <같은 파일> --execute`.
2. 새 덤프(`dump-bank.ts`)·`rw-topics.ts` 로 은행을 다시 읽고 같은 인자로 `rebalance-sets.ts --total 26 --first-index 14 --max-per-module 1 --max-per-exam 2 --max-family-per-exam 4` 재실행 → 실제 id 의 `new-sets.json`.
3. `mock_exam_validate_mst_set`·`mock_exam_set_item_issues` 검증 후 free 게시(기존 세트 이름 중복에 주의: 보관된 옛 'SAT Practice Test 14~16' 이 있다).

## 제외·한계
- 목표 35 중 9세트 미생성: 14세트째 추가에는 R&W 약 26건(약 $5)이 더 필요한데 남은 예산이 부족했다. 이어서 하려면 `need3.ts` 방식으로 부족 칸(II medium 9, SE medium 5, EI/CS 일부)만 소량 생성.
- `command_of_evidence_quant`(표·그래프) 문항은 이 파이프라인이 텍스트 전용이라 생성하지 않았다 — 계획의 skill fallback 은 0건.
- 신규 R&W 10건은 지문 160단어 초과(최대 192단어, 규격 220 이내).
- 사람 검수 없음(모델 교차 검수만).
- 설계표 `final/design-table-sat-14-26.json`(세트별 내용·기능·표현·추론·중복). 세트 내 같은 풀이 틀(유사 그룹 3회 초과) 0건. hard 는 적응형 구조상 2모듈(higher)에 17문항씩. 정답 유일성: R&W 는 Fable·Opus 독립 블라인드 풀이 일치+복수정답 없음만 채택, Math 는 컴파일러 독립 재계산.
