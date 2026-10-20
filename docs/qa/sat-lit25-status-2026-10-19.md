# SAT R&W 문학 25% 조정 — 완료 보고 (2026-10-19)

오너 지시: 세트당 R&W 문학(literature_fiction) 약 20/81(±2). 원격은 읽기 SELECT 만, 공개 없음(초안까지).

## 세트별 문학 문항 수 (전 → 후, R&W 81 중)
| 세트 | 전 | 후 | 방식 |
|---|---|---|---|
| T4 | 32 | 20 | 새 세트 버전 초안(12칸 교체) |
| T5 | 32 | 20 | 12칸 |
| T6 | 31 | 20 | 11칸 |
| T7 | 30 | 20 | 10칸 |
| T8 | 40 | 20 | 20칸 |
| T9 | 35 | 20 | 15칸 |
| T27 | 34 | 21 | 초안 재구성 |
| T28 | 35 | 21 | 〃 |
| T29 | 38 | 21 | 〃 |
| T30 | 40 | 22 | 〃 |
T1~T3·T10~T26 은 변경 없음(오너 지시: OK). 모든 교체는 같은 영역·skill·난이도·형식 칸, 소재 상한(모듈당 cluster 1, 경로당 2, family 4) 위반 0, 세트 간 문항 중복 0, 유사문항 그룹 공유 한도 위반 0, 세트당 hard 17 유지.

## 필요량·생성
- 현 재고: 비문학 미사용 30건 + 해제될 T27~30 옛 초안의 비문학 177건. 필요 비문학 330건 대비 부족 약 122건(칸 단위).
- 생성: Opus 5.5 배치 생성 + Fable 5.1·Opus 5.5 독립 블라인드 풀이·감사 교차 검수, 정답 누설 게이트, 정답 위치 균형(A34 B36 C36 D35), 후보 213+12 → 채택 152(141+11), 임포트 게이트 거절 1(빈칸 중복) → 임포트 151, 실제 사용 140.
- 채택 기준·절차는 기존 파이프라인과 동일(`batch-pipeline.ts cross --cands-file --batch`). 지문 160단어 초과 10건(최대 190, 규격 220 이내)은 선호 위반으로 남음.
- 소재: 기존 은행·분류표의 포화 소재 회피 + 이전 씨앗 1,871개 제외. 분류는 `rw-topics-20261015/classified.json` 에 병합.

## 비용
생성·검수 장부 $16.07 + 소재 브레인스토밍·분류 약 $0.12 = **약 $16.2 / 상한 $30** (장부 `data/mock-exam-generation/sat-lit25-20261019/ledger.json`).

## 원격 반영 SQL — `data/prod-open/sat-expand-sql/` (생성: `SAT_LIT25=1 npx tsx scripts/prod-open/sat-expand-sql.ts`)
순서(각 `npx supabase db query --linked -f <파일>`): `16_preflight`(읽기) → `17_release_old_drafts_27_30`(옛 구성 T27~30 초안 삭제, 문항은 은행에 유지) → `18_import_lit25`(R&W 151 임포트+공개) → `19_keywords_lit25` → `20_new_sets_27_30_lit25`(새 구성 초안 4개) → `21_old_set_versions_lit25`(T4~T9 새 세트 버전 초안 6개) → `22_verify_lit25`(읽기).
전부 멱등(17 은 새 문항이 없는 초안만 지우므로 20 이후 재실행해도 안전). 되돌리기 `99_rollback_lit25`(새 초안 삭제, 임포트 문항 보관; 옛 T27~30 초안 복원은 `14_new_sets_27_30.sql` 재실행). 공개는 관리자 화면에서(새 버전 공개 시 이전 공개본 보관).

## 로컬 격리 스택 리허설 (project_id ALTON_lit25, 포트 581xx, `--workdir tmp/sb-lit25` 로 띄워 tracked config.toml 은 건드리지 않음, 종료 완료)
원격 읽기 복사(`lit25-rehearsal-seed.ts`: 살아 있는 SAT 세트·문항·문항 버전) 후 `lit25-rehearsal-run.sh`: 17 삭제 4 → 18 created=151 → 19 링크 151 → 20 초안 4개 → 21 초안 6개(readiness ready, 다른 라이브 세트와 공유 0) → 재실행 시 전부 skipped → 99 롤백(T4~9 초안 6·T27~30 초안 4 삭제, 임포트 151 보관) 확인.

## 검증
tsc 새 오류 없음(기존 `app/layout.tsx LayoutProps` 1건), vitest `scripts/mock-exam-generation` 12파일 115건 통과(문학 상한 테스트 2건 추가).

## 변경 코드
`assemble-unique.ts`(planUnique `litCap`: 문학 상한 하드, 못 맞추면 `litRelaxed` 기록), `rebalance-sets.ts`(`--lit-max/--lit-target/--lit-pct/--lit-sets/--release-sets/--force-plan`, 사유 `lit_excess`), `rw-lit25-need.ts`(생성 필요량 산정), `prod-open/sat-expand-sql.ts`(SAT_LIT25 모드), `lit25-resolve.ts`, `lit25-rehearsal-seed.ts`, `lit25-rehearsal-run.sh`.

## 한계
사람 검수 없음(모델 교차 검수만). 화면 브라우저 확인 없음(임포트 render_check 만). T27~T30 문학이 21~22(상한 22 이내), T4~T9 는 정확히 20.
