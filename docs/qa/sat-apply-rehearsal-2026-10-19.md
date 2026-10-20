# SAT 신규 13세트 + 오류 신고 수정본 반영 — 실행 안내와 리허설 결과 (2026-10-19)

## 오너/총괄 실행 안내 (맨 위)

반영 대상: 원격 공유 비프로덕션 `worpsqwqgnspddnrtnvq`. 두 경로가 있고 결과는 같다(리허설에서 행 수까지 일치 확인). **공개는 어느 쪽도 하지 않는다 — 전부 초안(draft)까지, 공개는 관리자 화면에서.**

### 경로 A — SQL 파일(서비스 키 불필요, 총괄 CLI 로그인으로 실행) — 권장
파일은 `data/prod-open/sat-expand-sql/` (각 3MB 이하). 순서대로 실행, 각 파일은 멱등이라 중간에 끊겨도 같은 파일을 다시 실행하면 된다.

```
D=data/prod-open/sat-expand-sql
npx supabase db query --linked -f $D/00_preflight.sql        # 상태 확인(공개 T1~13 13개 등). 예외가 나면 중단
npx supabase db query --linked -f $D/01_import.sql           # 신규 R&W 637건 임포트+공개(게이트 거절 8건 제외)
npx supabase db query --linked -f $D/02_keywords.sql         # 키워드 연결 637건
npx supabase db query --linked -f $D/03_slot_import.sql      # 오류 신고 교체용 Math 18건 임포트
npx supabase db query --linked -f $D/04_patches.sql          # 문항 새 버전 25건(신고 패치 20 + 새 세트 Math 결함 5), 한 트랜잭션
npx supabase db query --linked -f $D/05_new_sets.sql         # Practice Test 14~26 초안 13개(세트별 검증, 실패 세트만 건너뜀)
npx supabase db query --linked -f $D/06_old_set_versions.sql # Test 1~13 중 11개의 새 세트 버전 초안(문항 새 버전 반영 + 20칸 교체)
npx supabase db query --linked -f $D/07_verify.sql           # 읽기 전용 확인
```
되돌리기: `99_rollback.sql`(초안 세트 삭제·임포트 문항 보관·패치 문항 옛 공개 버전 복원. 공개 세트·응시·옛 버전은 건드리지 않음).
`NOTICE` 에 `SKIPPED`/`skipped` 가 보이면 그 세트만 건너뛴 것이다(사유 표시). 파일 재생성: `npx tsx scripts/prod-open/sat-expand-sql.ts`(원격은 읽기 SELECT 만).

### 경로 B — 키로 REST 스크립트(한 줄)
키: Supabase 대시보드 → 프로젝트 `worpsqwqgnspddnrtnvq` → Project Settings → API Keys → `service_role`(또는 Secret key) 복사.
```
NEXT_PUBLIC_SUPABASE_URL=https://worpsqwqgnspddnrtnvq.supabase.co SUPABASE_SECRET_KEY=<복사한 키> npx tsx scripts/prod-open/apply-sat-expansion.ts --apply
```
`--apply` 를 빼면 dry-run(읽기만, 단계별 행 수·변경 목록 출력). 대상이 `worpsqwqgnspddnrtnvq.supabase.co` 가 아니면 중단하고 키는 출력되지 않는다.

## 반영 내용 (리허설 결과, 두 경로 동일)
| 항목 | 결과 |
|---|---|
| 신규 R&W 임포트(공개) | 637건(645 중 게이트 거절 8건 제외), 키워드 연결 637 |
| 오류 신고 패치 | 20건 새 problem_versions(공개 버전) |
| 새 세트 Math 결함 패치 | 5건 새 버전(같은 규칙: 차수 문구·표본 성질·식만 등) · 자동 불가 2건은 경고(공개 전 관리자 화면에서 교체) |
| 교체 20칸 | 컴파일러 문항 18건 임포트(칸과 같은 skill·형식·난이도, 세트 안 유사문항 그룹 겹침 없음) + 컴파일러 미지원 SPR 2칸(T1 #30, T2 #4)은 같은 칸의 은행 미사용 문항 |
| 새 세트 | Practice Test 14~26 초안 13개 × 147문항, `mock_exam_validate_mst_set` ready · `mock_exam_set_item_issues` 0건 |
| Test 1~13 | 11개 세트(1~8, 10, 12, 13)에 새 세트 버전 초안(147문항, 검증 통과). 문항 새 버전 반영 20칸 + 교체 20칸. 기존 공개본·응시·옛 버전 그대로 |
| 보관된 옛 'Test 14~16' | 이름 같지만 그대로 둔다(이름 유일 제약 없음, 개명·삭제 안 함) |

공개: 관리자 화면에서 새 세트(14~26)와 Test 1~13 새 버전 초안을 확인 후 공개(새 버전 공개 시 이전 공개본 보관·무료 티어 승계).

## 리허설 방법
- 로컬 격리 스택(`project_id=ALTON_sat1019`, 포트 571xx, config.toml 임시 변경 후 원복, 검증 후 `supabase stop`)에 원격의 SAT 데이터(문항 6,320·버전 6,524·세트 80·문항행 11,760·키워드)를 읽기 SELECT 로 복사해 원격과 같은 시작 상태를 만들었다(로컬에 없는 프로필 FK 는 로컬 관리자로 치환 — 리허설 한정).
- 경로 B: dry-run → `--apply` → `--apply` 재실행(임포트 skippedExisting 637, 패치 already 20, 세트 "이미 초안 있음", 새로 쓴 행 0) 모두 확인.
- 경로 A: 같은 시작 상태로 복원 후 `psql -f` 로 00~07 순서 적용(결과 위 표와 동일) → 01·02·04·05·06 재실행(전부 skipped) → `99_rollback.sql`(초안 24개 삭제, 임포트 655건 보관, 패치 25건 옛 버전 복원, 공개 세트 13개 불변) 확인.
- 리허설 중 발견·수정: 컴파일러 그래프형 문항은 지문·질문 문구가 같아 import.ts 의 문구 중복 검사에 걸려 건너뛰어짐 → `--no-text-dedupe` 추가; 같은 세트에 같은 유사문항 그룹(`c:<skill>:<subpattern>`)이 둘 생겨 검증 실패 → 슬롯별 교체 문항을 그룹 겹침 없게 재생성; 재실행 시 패치가 `needs_owner` 로 나오던 것을 `already` 로.
- 단위 테스트(`lib/audit-fix`, assemble-unique 등 11파일 105건) 통과, `tsc` 새 오류 없음(기존 `app/layout.tsx LayoutProps` 1건은 이 작업과 무관).

## 파일
- `scripts/prod-open/apply-sat-expansion.ts`(경로 B), `scripts/prod-open/sat-expand-sql.ts`(경로 A 생성기), `build-topics-offline.ts`(소재 분류, API 없음), `gen-slot-replacements.ts`
- 데이터: `data/audit/2026-10-18-sat-error-report-patches.json`, `data/mock-exam-generation/sat-error-report-1018/slot-replacements.json`·`slot-bank-fallbacks.json`, `.../sat-expand-20261015/final/new-sets-resolved.json`(리허설 재계획 결과: 새 문항은 gid, 기존 은행은 id 로 참조)
- 제한: 경로 A 의 새 세트 구성은 리허설 시점 원격 은행 기준 재계획 결과를 고정한 것이다(실행 시 사용 불가 문항이면 그 세트만 건너뜀). 경로 B 는 실행 시점 은행으로 다시 계획한다.
