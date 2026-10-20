# SAT Practice Test 27~30 신규 4세트 — 완료 보고 (2026-10-19)

결과: 4세트(각 147문항 = R&W 81 + Math 66) 정확 배정 완료, 목표 30세트 달성 가능. 원격 쓰기 없음(읽기 SELECT 만), 공개 없음(초안까지).

## 비용
SAT 장부 $26.14(생성 Opus 배치 + Fable·Opus 검수 배치, 4단계) + 소재 브레인스토밍·분류 약 $0.25 = **약 $26.4 / 상한 $30**. 채택 263건 중 게이트 거절 3건 제외, 261건 임포트 대상.
단계: gen1 243후보→169채택, gen2 118후보→82채택, gen3 10→8, gen4 7→5(보충). 수율은 약 69%.

## 배정
- `data/mock-exam-generation/sat-expand-20261019/final/exact-assign-sat-27-30.json` (allOk, 신규 간 중복 0, 기존 공개 세트와 중복 0), `design-table-sat-27-30.json`(세트 내 같은 풀이 틀 반복 0).
- 세트별 신규 R&W 58~63건 + 기존 은행 Math/R&W 재고. hard 17문항(적응형 2모듈), easy 34 / medium 96.
- 입력: `final/adopted-all.json`(261, gid 접두사 sw/sv/st/sq), `final/new-sets-resolved.json`.
- Math 는 기존 은행 재고(신규 생성 없음). 외부 오류 신고(1018) 결함 규칙에 걸리는 미사용 Math 40건(그래프+식 G-manual 21, 'in terms of π' 보기 혼재 11, 기타 8)은 후보에서 제외(`math-exclude.json`).

## 원격 반영 SQL — `data/prod-open/sat-expand-sql/`
순서: `12_preflight`(읽기) → `12_import`(R&W 261 임포트+공개, 1.2MB) → `13_keywords` → `14_new_sets_27_30`(초안 4개, 세트별 검증, 실패 세트만 건너뜀) → `15_verify`(읽기). 되돌리기 `99_rollback_27_30`. 각 `npx supabase db query --linked -f <파일>`. 전부 멱등. 생성: `SAT_30=1 npx tsx scripts/prod-open/sat-expand-sql.ts`.
선행 조건: 10·11번 SQL(π 보기 패치) 적용 여부와 무관(해당 문항은 후보에서 제외).

## 로컬 격리 리허설(project_id ALTON_sat30, 포트 571xx, config.toml 원복·stack 종료 완료)
원격 읽기 복사(`sat30-rehearsal-seed.ts`)로 시작 상태 구성 후 `sat30-rehearsal-run.sh`: 12_import created=261, 13_keywords 261 링크, 14 세트 4개 draft·`ready`(147문항, 문항 이슈 0, 다른 라이브 세트와 공유 0), 재실행 시 import skipped 261 / 세트 4개 "already exists - skipped", 롤백 시 초안 4개 삭제·임포트 261 보관. tsc 새 오류 없음(기존 `app/layout.tsx LayoutProps` 1건), vitest 11파일 106건 통과.

## 한계·미달 (숨기지 않음)
- **문학(literature_fiction) 비중**: 세트별 R&W 81 중 34~40건(42~49%), 목표 22%에서 크게 벗어남. 문학 재고가 남아 채우기 쉬운 반면 비문학 보충에 $30 이 부족해 소프트 목표(mixTol)를 이번 4세트에는 적용하지 못함(하드 규칙은 전부 충족: 소재 상한, 중복 0, 30 skill 커버). 완화가 아니라 소프트 분포 미달로 보고.
- Math 는 신규 컴파일 없이 재고 사용 — 풀이 틀 겹침은 기존 상한(두 세트 간 유사문항 그룹 15 이하)만 보장.
- R&W 게이트가 3건 거절(빈칸 뒤 지문이 선택지와 겹침) — 제외하고 재배정. 이 유형(boundaries 빈칸 중복)은 생성 단계 필터가 없어 수율 저하 요인.
- 화면 스크린 점검은 임포트 `render_check`(261건 모두 통과·confirmed)까지, 브라우저 스크린 확인은 하지 않음. `command_of_evidence_quant` 신규 생성 없음. 사람 검수 없음(모델 교차 검수만).
- `rebalance-sets.ts` 가 만든 기존 T2 소재 상한 사본 1건(set-copies.json)은 적용하지 않음(기존 세트 비변경).

## 파일
`scripts/prod-open/`: `dump-bank-cli.ts`, `sat30-math-scan.ts`, `sat30-resolve.ts`, `sat30-rehearsal-seed.ts`, `sat30-rehearsal-run.sh`, `build-topics-offline.ts`(CLI 폴백), `sat-expand-sql.ts`(SAT_30 모드). 계획 보고서 `docs/qa/sat-expand-30-sets-plan-2026-10-19.md`. 생성 원본 `data/mock-exam-generation/sat-expand-20261019/gen1~gen4`.
