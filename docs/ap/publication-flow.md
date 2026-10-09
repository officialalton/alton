# AP 문항 게시·검수·출시 흐름 (오너 확정 2026-10-08)

원칙: **전문가 검수는 게시 후**에 한다(기존 모의고사 검수와 같음: 검수 환경에서 게시된 문항을 쓰고, 오류는 기존 오류 신고 흐름으로 접수). 따라서 전문가 승인은 문제은행 게시의 **차단 조건이 아니다**. 단, 학생이 보기 전의 **그래프 렌더링 + 학생 화면 검증은 필수 게이트**이고, 프로덕션 출시(launch)는 별도 게이트다.

## 1. 단계(release_tier)와 상태
| 단계 | 의미 | 진입 조건 |
|---|---|---|
| `candidate` | 후보 재고(`ap_candidate_items`, 학생 비노출) | 생성 + 자동 게이트 |
| `review_env` | 검수 환경에 **게시**(`problems` 공개, exam_system='ap') | `review_state = auto_passed` AND `render_verified` AND `screen_verified` (= `review_env_ready`) |
| `launch` | 프로덕션 공개 | `review_env` 에서 **최신 자동 게이트 통과(`auto_passed`) + 필수 그래프/자료 렌더링 + 학생 화면 검증(`review_env_ready`) + 미해결 launch 차단 결함 0**(오답 키·복수 정답·조건 누락·그림/표 오류 대장 `ap_launch_blockers`, 그리고 현재 버전의 미해결 `wrong_key`/`flawed_problem` 신고) — 뷰 `ap_launch_ready_v`(마이그레이션 395). 전문가 승인·검수 기간 만료는 조건이 아니다 |
- 검증 상태(review_state): candidate / rejected / needs_revalidation / auto_passed / exact_duplicate. 선택(`used_in_sample`)·`legacy_reserve`는 별개.
- 게시 후 검수 상태(expert_status): `unreviewed` / `in_review` / `approved` / `issues_reported`. 신고에서 자동 파생되는 값은 `ap_item_review_status_v.open_reports` 로 확인(수동 값과 함께 사용).
- 자동 게이트 통과(auto_passed)는 **게시 승인이 아니다**: 렌더링·학생 화면 검증을 끝내야 `review_env_ready`가 true 가 된다. 현재 두 검증 모두 미완료 → 검수 환경 게시 가능 0건.

## 2. 흐름: 후보 → 게시(검수 환경) → 신고 → 수정(새 버전) → 출시
1. 후보 생성·자동 검수(코드 게이트 → 독립 풀이 → 검토) → `auto_passed`.
2. 그래프/표 렌더링(`stimulus.data` → 그림) + 학생 화면(영어 UI, 계산기·타이머·접근성) 검증 → `render_verified`, `screen_verified` = true.
3. `problems`/`problem_versions`로 **게시**(exam_system='ap', ap_subject, 키워드·스킬, 해설 영어 포함). `ap_candidate_items.problem_id/problem_version_id` 연결, `release_tier='review_env'`. 기존 문제은행 게이트(영어 해설·render_check·정답 키 필수, 공개 버전 불변)가 그대로 적용된다.
4. 검수자(교사·외부 검수자)는 검수 환경에서 풀고, **기존 오류 신고 흐름**(마이그레이션 `20261940000000` 신고, `…360` 확인/수정됨 분류, 판정 verdict)으로 신고한다. 병렬 신고 시스템은 만들지 않는다.
5. 관리자가 신고를 확인(`problem_error_report_confirm`) → 문항 수정은 **새 `problem_versions`**(공개 버전 불변 규칙) → 신고는 '수정됨'으로 자동 분류. 해당 후보의 `problem_version_id`를 새 버전으로 갱신, `expert_status`는 `issues_reported` → 수정 후 `in_review`.
6. 최신 게이트 + 렌더·학생 화면 검증 + 미해결 차단 결함 0 → `ap_launch_ready_v` 에 나타남 → 관리자가 `release_tier='launch'` 로 올림(프로덕션 배포는 별도 오너 승인). **신고가 없다는 사실을 검수 완료의 증거로 쓰지 않는다**(검수 기한·알림 기능도 두지 않는다). 사후 전문가 검수와 오류 신고는 launch 이후에도 계속되며, 결함이 신고되면 `ap_launch_blockers` 로 분류해 새 버전으로 고친다.
7. 세트 구성: 세트 조립 시 N개를 고른다(칸 목표·공식 비중). 한 세트의 **look-alike 상한은 세트 단위**로 두고(은행 단위 아님), 같은 문항군에서 세트당 최대 2개.

## 3. 표식(이전 적재, 삭제 없음) — 오너 실행용
마이그레이션 `20262100000394_ap_load_batches.sql`. 이전 구 형식 행 767은 삭제하지 않고 `is_current=false`로 표시, 현재 783행은 `is_current=true`. 키 접두어가 아니라 **적재 배치(`load_batch_id`)와 `created_at` 구간**으로 판정한다.
```sql
-- 1) created_at 군집으로 경계 확인(5분 단위 히스토그램)
select * from ap_candidate_load_histogram_v;
-- 2) dry-run: cutoff 이전 = 이전 적재(기대 767), 이후 = 현재(기대 783). 건수가 다르면 아무것도 바꾸지 않는다.
select * from ap_mark_load_batches('2026-10-08T12:00:00Z', 767, 783, false);
-- 3) 일치하면 적용(배치 2개 생성, is_current 갱신; 행 삭제 없음)
select * from ap_mark_load_batches('2026-10-08T12:00:00Z', 767, 783, true);
-- 4) 칸 집계 갱신(현재 배치만 반영)과 점검
select ap_refresh_stock_cells();
select * from ap_stock_summary_v;            -- 현재 집계(기본 조회)
select * from ap_stock_by_batch_v;           -- 현재 vs 이전 적재 대조
```
동등한 스크립트(dry-run 기본): `npx tsx scripts/ap-generation/mark-batches.ts --histogram` → `--cutoff <ts>`(dry-run) → `--cutoff <ts> --execute`. 새 783행은 `import-candidates.ts --execute` 가 `load_batch_id`·`is_current=true` 로 적재한다(배치 라벨 `current-stock-2026-10-08`). 현재 재고·부족분(`ap_refresh_stock_cells`, `ap_stock_shortfall_v`)·기본 조회 뷰(`ap_stock_current_v`, `ap_stock_summary_v`)는 `is_current` 행만 본다.
**주의**: 새 783행을 적재하기 전에 표식하면 건수가 달라 함수가 거부한다(`found 767 / 0`). 순서는 (a) 783 적재 → (b) 히스토그램으로 경계 확인 → (c) dry-run → (d) 적용.

## 4. 점검(파일 vs DB)
`npx tsx scripts/ap-generation/stock.ts && npx tsx scripts/ap-generation/stock-consistency.ts` (비프로덕션, 읽기 전용): `ap_stock_summary_v` 와 파일 집계를 과목×종류별로 비교, 불일치 시 종료 코드 1. 로컬 검증용 SQL 은 `--emit-sql`(트랜잭션+롤백).


## 5. 갱신(마이그레이션 395, 2026-10-08)
- `legacy_reserve`/`used_in_sample` 은 완전 중복·반려 행에서 false 로 정정하고 불변식(체크 제약)을 추가했다. 요약 뷰는 두 값을 `auto_passed`/`needs_revalidation` 행에서만 센다(파일 집계와 같은 정의).
- 재고·부족분(`ap_refresh_stock_cells`, `ap_stock_shortfall_v`)은 이 두 컬럼을 읽지 않으므로 영향이 없다. 로컬 전후 비교(783행 적재 → 395 적용): 요약 8행 중 변한 값은 AB MC `legacy_reserve` 93→89 한 곳뿐, ap_stock_cells 130칸 전후 동일(차집합 0/0). 로컬에는 부족분 목표(`ap_stock_targets`)가 없어 shortfall 뷰는 0행이므로 같은 비교를 비프로덕션에서 한 번 더 실행해야 한다(`stock-consistency` 후 shortfall 전후 diff).
- 394 가 추가했던 `review_period_ends_at`, `signoff_by`, `signoff_at` 컬럼은 제거(로컬에서만 존재, 비어 있음). `ap_launch_blockers` 대장 신설. RLS 는 켜고 정책은 두지 않아 서비스 롤만 접근한다.

### 검증 상태 구분(2026-10-08)
| 항목 | 상태 |
|---|---|
| 행 집계 8/8 일치(파일 vs `ap_stock_summary_v`, 로컬 783행) | 완료 |
| 부족분(shortfall) 검증 | **미완료** — `ap_stock_targets` 가 비어 있으면 `ap_stock_shortfall_v` 는 0행이라 검증이 성립하지 않는다. 목표(과목·토픽·스킬·구조별)는 오너가 합의한 값만 적재한다(임의 적재 금지). 적재 후 395 전후 shortfall diff 를 다시 실행한다. |

## 5. 용도(purpose) 분리와 변환·응시 구현 (2026-10-09, 마이그레이션 400·401 — 로컬 적용·검증, 원격 미적용)
**용도 결정(오너)**: AP 문항은 정확히 하나의 용도를 가진다 — `mock_exam`(모의고사 층: SAT 모의고사와 같은 수준의 독립 시험, 무료·과외 회원 공통, `access_tier` free/tutoring) 또는 `lesson`(수업·과제: 선생님이 과외 학생에게 쓰는 경로). 용도는 **변환 시점에 정해지고 바뀌지 않으며 공유되지 않는다**(두 용도를 겸하는 값·예외 없음).
- 저장: `ap_candidate_items.purpose` + `problems.usage_scope`(mock_exam→`mock_exam`, lesson→기존 수업·과제 값 `general`). 후보·문제 모두 변경 트리거로 잠긴다. AP 문제는 `problems_ap_purpose_check` 로 두 값만 허용.
- 격리: 세트 조립은 모의고사 용도만(`mock_exam_set_items` 가드 + `lib/ap-exam/assemble.ts`), 선생님 문제 선택(`problem_auto_composition_candidates`·회차 구성·과제 트리거)은 수업 용도만. 무료 회원은 문제·버전·세트 항목 원본을 직접 읽을 수 없고(RLS) 시험 RPC 로만 모의고사 문항을 받는다 → 수업 문항은 어떤 경로로도 보이지 않는다.
- 재고: 용도별 목표 `ap_stock_purpose_targets`, 뷰 `ap_stock_by_purpose_v`(용도별 변환·검수 환경·출시·부족), `ap_stock_pool_v`(미배정 풀 대비 순부족), 관리자 화면(한국어) `/admin/ap-items`(용도·단계·검수·준비 필터).

**변환 경로(병렬 게시 경로 없음)**: 후보(`review_env_ready`) → `ap_create_bank_problem`(후보 검사, `create_bank_problem` 우회 차단 트리거) → `save_problem_draft_version` → `set_problem_render_check` → `confirm_and_publish_problem_version`(기존 게이트: 영어 해설·render_check·정답 키·공개 버전 불변) → `ap_finalize_conversion`(`release_tier=review_env`, 키워드 연결; 검수 기간 개념 없음). 공개 단계에서도 후보가 여전히 `review_env_ready` 여야 한다(`problem_versions_ap_publish_guard`). 오류 신고 후 수정은 새 버전 공개 뒤 `ap_attach_new_version`. 실행기: `lib/ap-exam/convert-run.ts`, `scripts/ap-generation/publish-to-bank.ts`(기본 dry-run, 로컬만 --execute).
**세트·응시**: `mock_exam_sets.exam_program='ap'`, `format='ap_fixed'`, `ap_label`(full_practice | mc_practice | frq_practice, 공식 구조를 다 채울 때만 Full Practice Exam — 공개 게이트), `section_layout`(공식 섹션 시간·계산기·문항 수 복사본, `lib/ap-exam/layouts.ts`). 기존 `mock_exam_open_start`·재응시(attempt_no)·`save_answer`·`submit`(MC 자동 채점) 재사용, 카탈로그·요약·상세 RPC 는 얇은 래퍼로 AP 필드만 추가(SAT 응답은 `examProgram:'sat'` 외 변화 없음). FRQ 는 문제 하나 = 번들 하나, 파트별 타이핑 응답을 JSON 한 칸에 자동 저장하고 제출 뒤 **참고 답안·채점 노트(공식 채점 아님)** 만 공개한다. AP 1~5·FRQ 점수는 만들지 않는다.
**검증 게이트**: `render_verified` 는 `lib/ap-figures/gate.ts`(결정적 검사, `scripts/ap-generation/render-check.ts`·`mark-verified.ts --render`), `screen_verified` 는 학생 화면 확인 증거가 있을 때만 `mark-verified.ts --screen --evidence`. 증거 스크린샷: `docs/ap/screen-evidence/`.

## 6. 2026-10-09 추가: 생성기 결함 플래그(마이그레이션 403)와 S1a 보조 적재
- 403: `ap_candidate_items.defect_flags text[]`(+`defect_scanned_at`)와 `review_env_ready` 식 교체(`... and cardinality(defect_flags)=0`, PG17 `SET EXPRESSION`). 플래그가 있으면 이전에 auto_passed 였어도 문제 변환·게시·launch 경로(400 의 가드)가 막힌다. "렌더링이 되는가"(`render_verified`)와 "자료가 정확한가"(`defect_flags`)는 별개 컬럼이다. 플래그는 `scripts/ap-generation/defect-scan.ts`(→ `data/ap/stock/defect-scan.json`)가 계산하고 `import-candidates.ts` 가 적재한다. 현재 auto_passed 에는 결함 0건, needs_revalidation 30건·반려 105건이 해당.
- S1a 신규 후보(관리자 후보 표 한정, **게시·확정 재고 승격이 아님**):
  - 선정 근거: 최초 후보 68 중 **60 = 최초 통과 55 + 수선 후 통과 5**(한 건은 근사 중복 게이트에 걸렸으나 재고 정책상 변형이라 통과로 유지). 나머지 **8건은 반려**로 적재하며 사유·수선 시도 이력을 `ap_candidate_review_history`(run `s1a`, `s1a-final`)에 보존: m06-k0·m23-k0·m30-k0(해설 기준 불통과, 수선 후에도), m23-k1(범위·해설), m24-k0·m24-k1(해설 → 수선 후 지문 길이 범위), m26-k1(자료 표현·조건 누락), m17-k0(독립 풀이가 전제 모순 지적). 통과 60 중 **3건은 기존 재고와 완전 중복**(m27-k1→run2 m27-k3, m29-k1→m29-k3, m30-k1→m30-k2)이라 `exact_duplicate` 로 적재 → **새 고유 57**(문항군 31).
  - 중복·검토 버전·렌더·학생 화면 상태 보존: 중복은 `duplicate_of`·`item_family_id`, 검토 버전은 history 의 gate_version(v2-code-first-final), 렌더·화면은 `render_verified=false`, `screen_verified=false` 로 시작 → `mark-verified.ts --render` / `--screen` 으로만 변경.
  - 명령(오너 실행; 로컬/공유 비프로덕션만, 기본 dry-run):
    1. `npx tsx scripts/ap-generation/s1a-export.ts && npx tsx scripts/ap-generation/stock.ts --with-s1a` → `data/ap/stock/s1a-items.json`(851행 기준 중복·문항군 계산)
    2. `npx tsx scripts/ap-generation/defect-scan.ts --extra data/ap/stock/s1a-items.json`
    3. 마이그레이션 403 적용 후: `npx tsx scripts/ap-generation/import-candidates.ts --items data/ap/stock/s1a-items.json --batch s1a-ab-2026-10-09 --supplement` (dry-run) → 같은 명령에 `--execute`.
  - 배치 의미: `--supplement` 배치 행은 `is_current=false`(기본 현재 배치는 `current-stock-2026-10-08` 하나로 유지), 이 배치의 후보 행은 `is_current=true` 로 적재되어 현재 재고 뷰·부족분 계산에 포함된다. 기본 현재 배치 표식(`ap_mark_load_batches`)에는 영향이 없다.
  - 기준선 783행도 변경 사항(파서 재판정 18건 확정, 결함 플래그)이 있으므로 `stock.ts` 후 `import-candidates.ts`(기본 배치)를 다시 실행하면 같은 키로 upsert 된다.

**검증 게이트**: `render_verified` 는 `lib/ap-figures/gate.ts`(결정적 검사, `scripts/ap-generation/render-check.ts`·`mark-verified.ts --render`), `screen_verified` 는 학생 화면 확인 증거가 있을 때만 `mark-verified.ts --screen --evidence`.

**검증 기록 실행 범위(2026-10-08 오너 결정)**: `mark-verified.ts` 는 기본 dry-run, 대상은 로컬(기본) 또는 비프로덕션 `worpsqwqgnspddnrtnvq` 뿐이며 후자는 `--target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq` 가 모두 있어야 한다(그 외 호스트·프로덕션 거부, 키는 환경변수에서만 읽고 출력하지 않음). `--render` 는 렌더 보고서(`data/ap/render-check/report.json`)의 `contentHash`(자료+선지+정답)가 DB 후보 payload 해시와 같은 후보만 기록하고 불일치는 건너뛴다. `--screen` 증거 파일은 `entries[{candidate_key, viewport, screenshot(저장소 기준 경로, 실존 필수), timestamp, checker}]` 를 갖춰야 하며 없으면 기록하지 않는다. 증거 스크린샷: `docs/ap/screen-evidence/`.

## 7. S1a 중복 불일치 해소(2026-10-09)
보고는 "S1a 완전 중복 3건"이었고 DB 에는 4건이 적재됐다. 원인: **S1a 내보내기 이후 run2 m25-k0 가 파서 오류 재판정으로 rejected → auto_passed 가 되면서**, 같은 내용인 S1a m25-k0 이 완전 중복으로 바뀌었다(items.json 과 s1a-items.json 을 서로 다른 시점에 계산한 탓). 후보 ID: `s1a-final:ap_calculus_ab-m25-k0`(정본 `run2:ap_calculus_ab-m25-k0`, 재판정 반영 후), `s1a-final:ap_calculus_ab-m27-k1`(정본 run2 m27-k3), `…m29-k1`(정본 m29-k3), `…m30-k1`(정본 m30-k2). 수정: `stock.ts` 가 한 번의 계산으로 두 파일을 함께 쓰도록 바꿔 **단일 재고 표**를 유지한다(보조 배치 포함 파일 합계 = DB 합계, `stock-consistency.ts` 가 두 파일을 합쳐 비교). 최신 S1a: 68행 = auto_passed 56 / rejected 8 / exact_duplicate 4.


## 화면 검증은 자동 점검이다 (2026-10-09 오너 결정)
- 증거 항목에는 `checker_kind`(`automated`|`human`)가 필수이고 자동 도구의 점검자 이름은 `automated-<도구>`(예: `automated-playwright/<버전>`)다. 자동 점검을 사람 검토로 기록할 수 없다. DB `screen_evidence` 에는 `checkerKind`·`limitations` 가 함께 남는다(이미 검증된 후보를 다시 `--screen --execute` 하면 해시는 그대로 두고 라벨만 갱신, 변환 전 후보에 한함).
- **한계**: 자동 화면 점검은 표시·입력·정답/해설 노출·잘림만 확인한다. 그래프의 의미·그림의 정확성·문장의 자연스러움은 확인하지 않으며 사람 검토가 별도로 필요하다(스키마 설명·증거 파일 `limitations`·관리자 문항 화면에 같은 문구).

## 부분 연습 세트(첫 제품 형태, AB·BC) (2026-10-09)
- 세트 이름: `AP Calculus AB — Non-Calculator Practice`(Part A MC 29문항·62분) / `AP Calculus AB — Calculator Practice`(Part B MC 13문항·38분) / `AP Calculus AB — Free-Response Practice`(FRQ 6문항·90분: A 2·30분 + B 4·60분). BC 도 같은 구조.
- 공식 파트의 문항 수와 시간을 모두 채운 세트만 이 이름을 쓴다(DB 공개 게이트가 섹션별 문항 수를 강제). 현재 재고를 완전한 모의고사로 부르지 않는다(`full_practice` 는 모든 섹션 충족 때만).
- 조립 규칙: 모의고사 용도(`mock_exam`) 변환 문항만. 세트 안 중복 없음. 문항군당 MC 2개·FRQ 1개, FRQ 는 유형(archetype)당 2개까지·6문항이면 서로 다른 유형 4개 이상. 세트 간 겹침은 아래 "문항 겹침(재노출) 정책"이 단일 기준. 못 채우면 패딩 없이 부족 칸(문항 수·문항군·유형·단원 비중)을 보고한다.
- 가능성 점검: `npx tsx scripts/ap-generation/partial-feasibility.ts`(결과 `data/ap/stock/partial-feasibility.json`). 비프로덕션 실행 명령은 `scripts/ap-generation/assemble-ap-set.ts`·`publish-to-bank.ts` 머리 주석(둘 다 `--target <ref> --i-know-nonprod <ref>` 허용 목록, 기본 dry-run).

## 8. import 재적재 안전(2026-10-09)
`import-candidates.ts` 는 이미 DB 에 있는 키의 `render_verified`·`screen_verified`·`render/screen_evidence`·`release_tier`·`problem_id`·`purpose`·`converted_*`·`expert_status` 를 **절대 덮어쓰지 않는다**. 기존 행은 검증 판정 필드(review_state, rejection_reason, gate_version, 문항군·중복·defect_flags, is_current/load_batch_id 등)만 갱신하고, 변환된 행은 판정 **승격**(예: needs_revalidation→auto_passed)에 딸린 3필드(review_state, gate_version, rejection_reason)만 갱신한다. 검증·변환된 행의 판정은 강등하지 않는다. payload 는 내용(stimulus·stem·options·key_index·key_index_final·parts)이 바뀌고 검증·변환되지 않은 행에서만 쓴다(402 트리거가 검증을 푸는 것을 피함). 새 키만 전체 행 insert. 규칙은 순수 함수 `lib/ap-generation/import-merge.ts`(테스트 8건). `--report` 는 dry-run 에서도 보존/갱신 건수와 키 목록을 `data/ap/stock/import-merge-report.json` 에 쓴다. 시뮬레이션(증거 153개 키가 검증·변환된 상태로 있다고 가정): 새 키 68(S1a), 기존 갱신 633, 검증·변환 보존 153(보호 필드 patch 0건), 판정 승격 143(그중 검증·변환 행 3건 — 실제 DB 에서 이 3건이 이미 auto_passed 면 승격 0). 승격 143건은 미검증·미변환 행에 적용되고, 검증·변환 행에 걸리는 키는 `--report` 의 `upgradeOnVerifiedKeys` 로 확인한다.


## 문항 겹침(재노출) 정책 — 단일 기준 (2026-10-09 오너 결정)
이 절이 AP 의 겹침 정책 기준이다(다른 문서의 겹침 언급은 이 절을 따른다). 코드 상수는 `lib/ap-exam/assemble.ts` 의 `OVERLAP_DEFAULT`·`partialOverlapMax`·`exposureKindOf` 이고 테스트가 값을 대조한다.

| 구분 | 다른 세트와의 겹침 | 비고 |
|---|---|---|
| **풀 모의고사**(공식 구성 전체) | 원칙적으로 **0**(기본값). 문항 하나는 한 세트에만 | 재고 부족 시 세트 수를 줄이거나 문항을 추가 생성. 겹침을 허용하려면 오너 결정으로 `--overlap-max` 를 명시 |
| **부분 연습 세트**(Non-Calculator / Calculator / Free-Response) | 세트당 문항 수의 **20%(내림)까지**: Non-Calculator 29문항 → 5, Calculator 13 → 2, FRQ 6 → 1 | 새 문항을 먼저 쓰고 부족할 때만 겹침 문항을 쓴다. `--overlap-max N` 으로 조정 |
| **복습·재응시** | 재사용 **허용** | 오답 복습·같은 시험 재응시는 같은 문항을 다시 본다 |
| 한 세트 안 | 어떤 경우에도 **중복 없음** | |

- **최초 노출 vs 재노출**: 학생이 어떤 문항을 처음 보는 것이 최초 노출, 이전에 본 문항을 다시 보는 것(재응시·복습·부분 세트 간 겹침으로 다시 만남)이 재노출이다. 약점·난이도 통계와 "새 문제 풀이" 지표는 **최초 노출만** 새 근거로 센다(`exposureKindOf`). 재노출 결과는 복습 성과로만 본다.
- SAT 모의고사의 "세트 간 문항 중복 0"(`docs/POLICY-DECISIONS.md`)은 그대로이며, 이 표의 풀 모의고사 기본값 0 과 같은 방향이다.

## 부분 연습 세트의 화면 문구 (2026-10-09)
- 제목은 세트 이름 그대로(`AP Calculus AB — Non-Calculator Practice` / `— Calculator Practice` / `— Free-Response Practice`). 배지는 세트의 섹션 구성에서 읽어 `Non-Calculator Practice` / `Calculator Practice` / `Free-Response Practice`(`lib/ap-exam/layouts.ts` `apBadgeText`). DB `ap_label` 은 그대로(`mc_practice`/`frq_practice`)라 마이그레이션 없음.
- 시작 안내(목록·응시·결과 화면): 파트·계산기 규칙·문항 수·시간(`apGuidanceLines`). Non-Calculator = Section I Part A 29문항·62분·계산기 불가, Calculator = Part B 13문항·38분·그래핑 계산기 필수, FRQ = 6문항·90분이며 Part A(2문항·30분) 계산기 허용 / Part B(4문항·60분) 계산기 불가를 각각 표시.
- `Full Practice Exam` 배지는 세트 구성이 공식 섹션·문항 수·시간과 정확히 같을 때만(`isOfficialFullLayout`). 구성을 알 수 없으면(보관된 지난 응시 행 등) 풀 시험이라고 말하지 않는다(`Practice Set`).

## 결과 화면·응시 흐름 보강 (2026-10-09, 실제 리뷰 환경 점검 반영)
- 해설 수식: 해설(explanation_en)이 `$...$` 없이 TeX·평문 수식을 섞어 쓴 경우를 렌더 직전에 `$...$` 로 감싸 본문처럼 KaTeX 로 그린다(`lib/ap-exam/explanation-math.ts`; 저장 데이터는 불변). 생성 프롬프트는 이후 해설도 `$...$` 를 요구한다. 자동 화면 점검(증거 v2)에 제출 후 결과 화면 점검 `result_no_raw_tex` 가 필수로 들어가, 해설에 `\\frac`·`\\pi`·`\\int`·`\\displaystyle`·`^{` 가 보이면 실패한다.
- My Notebook 목록 미리보기도 수식을 그린다. Topics to review 는 코드와 토픽 이름(`Topic 1.4 · …`). MC 전용 세트에는 Free response 탭이 없다. 재응시 뒤 결과 화면에 `Attempt 1 | Attempt 2` 전환이 있다.
- 시간 소진: 마지막(단일) 섹션이 끝나면 자동 제출, 중간 섹션은 "Go to next section" 버튼(SAT 고정형은 해당 섹션만 잠그고 모든 섹션이 잠기거나 직접 제출할 때 마감 — 단일 섹션인 AP 부분 세트는 자동 제출로 맞춘다).
- 목록 상태: 카탈로그의 진행 상태를 신뢰해 `In progress — Continue` 로 보인다. AP 는 화면을 여는 순간 타이머가 돌므로 섹션 시간 저장이 'assigned' 응시를 'in_progress' 로 올린다(마이그레이션 `20262100000405`, AP 섹션만, SAT 불변).

## 9. 보조 배치와 칸 목표 명령(2026-10-09 3차)
**18개(AB 계산기 필수 MC 3원형) 보조 배치**: 라벨 `ab-calc-mc-2026-10-09`. 18행 = auto_passed 16 + exact_duplicate 2(diffeq_value_calc 의 작은 매개변수 공간에서 동일 문항 발생), 문항군 3(원형당 1; 군당 유효 2개 상한 → 유효 6). 렌더·학생 화면 검증 전에는 사용하지 않는다.
1. `npx tsx scripts/ap-generation/stock.ts`(한 번의 계산으로 items.json·s1a-items.json·v1ab-items.json·v45ab-items.json 동시 갱신) → `npx tsx scripts/ap-generation/defect-scan.ts --extra data/ap/stock/s1a-items.json --extra data/ap/stock/v1ab-items.json --extra data/ap/stock/v45ab-items.json`
2. 안전 병합 importer(기존 검증·변환 필드 보존): `npx tsx scripts/ap-generation/import-candidates.ts --items data/ap/stock/v1ab-items.json --batch ab-calc-mc-2026-10-09 --supplement --report`(dry-run) → 같은 명령에 `--execute`.
3. (선택, AB 보강 15개) `--items data/ap/stock/v45ab-items.json --batch ab-reinforce-2026-10-09 --supplement`.
4. 점검: `npx tsx scripts/ap-generation/stock-consistency.ts`(보조 파일 3개를 합쳐 DB 현재 배치와 비교).
**재고 목표(마이그레이션 404 적용 후)**: `npx tsx scripts/ap-generation/stock-targets.ts`(파일 생성·합계/칸별 부족 출력) → `--load`(dry-run) → `--load --execute` → 적재 후 `--verify`(파일 칸별 부족 = DB `ap_stock_cell_shortfall_v`). 합계는 `ap_stock_total_v`. 로컬 롤백 트랜잭션(402~404 + 851행 재현)에서 파일과 뷰의 28개 칸 목표가 전부 일치함을 확인했다.

## 시간 제한은 서버가 정한다 (2026-10-09, 마이그레이션 `20262100000406`)
- 섹션 시계는 그 섹션에 **처음 들어간 시각**(`mock_exam_attempts.ap_section_entered`)부터 공식 분이다. 들어가기는 `mock_exam_ap_enter_section`(응시 화면이 섹션 진입 때 호출) 또는 첫 답 저장이다. 화면의 남은 시간은 서버가 계산해 상세(`timeRemainingSeconds`)로 준다. 클라이언트가 보낸 남은 시간은 저장하지 않는다(`mock_exam_save_section_time` 은 AP 에서 무시).
- 만료(+5초 유예) 뒤 그 섹션의 답 저장·변경은 거절된다(`Time is up for this section…`). 마지막 섹션이 만료되면 `mock_exam_ap_settle` 이 응시를 채점 완료로 마감한다(멱등). 화면을 닫은 채 만료돼도 서버 페이지가 다음에 열 때 settle 을 호출해 결과 화면을 연다. 클라이언트는 마지막 섹션 소진 때 제출(멱등)을 호출한다.
- `mock_exam_submit` 은 AP 에서 멱등이다(이미 제출·채점된 응시에 재시도·더블클릭·두 탭이 다시 불러도 오류·행 추가·시각 변경 없음). SAT 는 기존처럼 오류. 회귀 테스트: `lib/ap-exam/ap-exam.integration.test.ts` "AP 시간 제한은 서버가 정한다".
- 되돌리기: 파일 머리 주석.

## 테스트 계정은 통계에서 제외한다 (2026-10-09, 마이그레이션 `20262100000407`)
- 기존 규약 재사용: `students.is_test_account`(이메일이 `example.com`·`.test`·`uat-`/`e2e-`/`qa-`/`test-` 로 시작하면 자동 표식, 관리자가 `admin_set_test_account` 로 지정·해제). 비프로덕션에서 사람이 눌러 본 계정은 이 표식을 붙인다.
- 제외 대상: Free Accounts 목록·분석(이미 기본 제외), 문항 노출 횟수 `mock_exam_problem_exposure_counts`(교체 필요 판단), 난이도 변경 영향 `problem_difficulty_set_impact`(407 에서 제외로 변경). 학생 개인 통계(`student_stats_aggregate` 등)는 학생 단위라 영향 없음. 관리자 응시 내역 목록은 테스트 계정 응시도 보이되 "테스트" 배지를 붙인다.

## 단원 안내 (2026-10-09, 마이그레이션 `20262100000408`)
- 부분 세트의 목록·응시·결과 화면에 `Covers Units 4, 5, 6, 8.` 와 "과목 전체 성취로 읽지 말라"는 안내를 보인다(공식 풀 구성에는 생략). 단원 = 문항 `sat_domain`(`ap:4.3` → 4). 카탈로그에 `apUnits` 를 싣는다. 단원 불균형은 내부 부족 목록으로만 두고 화면에서 전범위를 주장하지 않는다.

## 짧은 Free-Response 연습 (2026-10-09)
- 서로 다른 문항군의 검증된 FRQ 묶음 **2~4개**로 만든다(`planFrqShortSet`). 시간은 묶음당 15분(공식 환산), 계산기 허용 묶음은 Part A·불가 묶음은 Part B. 화면은 실제 문항 수·시간·파트별 계산기를 말하고 "공식 6문항·90분 시험이 아님"을 명시한다. 이름은 `AP Calculus AB — Free-Response Practice`(번호는 `--seq`).
- 제공 조건 = FRQ 흐름 점검 통과: `scripts/ap-generation/frq-flow-check.ts`(입력·자동 저장·새로고침 복원·제출 전 비노출·제출·답안+채점 가이드 열람(참고 피드백, 공식 채점 아님)·AP 점수 없음·이중 제출 멱등·재응시). 공식 6문항 세트(Part A 2 + Part B 4)는 별도로 `--partial frq`.

## 원문 수식 점검은 토큰 단위다 (2026-10-09)
- `lib/ap-exam/raw-math-scan.ts`: 렌더된 DOM 의 텍스트 노드에서 TeX 명령·`^{`·산문 부등호 `<=`·평문 거듭제곱·렌더 안 된 `$…$`·`\uXXXX` 를 찾는다. KaTeX 출력, `<code>`/`<pre>`/`<kbd>`, 이스케이프된 달러(`\$`), 통화 표기, `[data-raw-math-ok]` 영역은 제외(양성·음성 픽스처 테스트). 자동 화면 점검 증거 v3 는 제출 전 문제 영역(`stimulus_no_raw_tex`)과 제출 후 해설(`result_no_raw_tex`) 모두 필수.
- 표 칸의 평문 수식(`m^2`, `t>=0`, `e^(-0.3 t)`)은 표 렌더가 위첨자·≤≥ 로 그린다. 본문과 겹치는 자료 텍스트는 숨긴다(`stimulus-display.ts`).

## 테스트 계정 제외 감사 (2026-10-09)
교차 학생 집계 경로별 상태(테스트 계정 = `students.is_test_account`):
| 경로 | 상태 |
|---|---|
| Free Accounts 목록·분석·전환 퍼널(`admin_free_accounts_list/analytics`) | 제외(기본 `p_include_test=false`, 제외 건수 `testAccountsExcluded` 별도 표기) — `app/admin/free-accounts.integration.test.ts` |
| 문항 노출 횟수 `mock_exam_problem_exposure_counts` | 제외(407) |
| 난이도 변경 영향 `problem_difficulty_set_impact`(시작된 응시 수) | 제외(407) |
| 관리자 응시 내역(목록) | 포함하되 "테스트" 배지 |
| 오류 신고 영향 `problem_error_report_detail`(채점/진행 응시 수) | **전체 포함 — 의도**: 재채점 영향 범위는 테스트 계정 응시도 재채점되므로 전부 세야 한다(학습 통계 아님) |
| 학생 단위(학습 요약·약점·통계·학부모/상담사 보기: `student_stats_aggregate`, `mock_exam_weakness_summary`, `free_member_learning_summary`, `admin_student_mock_attempt_facts` …) | 한 학생만 읽는 경로라 교차 집계 아님 — 해당 없음 |
| 상담 전환(`register_consult_interest`·상담 요청) | 쓰기 경로, 집계는 Free Accounts 분석 scope 안에서만 — 제외됨 |
교차 학생으로 응시를 세는 다른 경로는 찾지 못했다(DB 함수 전수 + 앱 코드 `mock_exam_attempts` 조회 전수 확인).

## 결함·활성화 차단: SAT 고정형(비 MST·비 AP) 서버 시간 제한 미구현 (2026-10-09, 마이그레이션 `20262100000410`)
- **결함**: 고정형 SAT 응시(`format='fixed'`)는 시간 제한이 **클라이언트 타이머뿐**이다. 서버(`mock_exam_save_answer`·`mock_exam_submit`)는 만료 뒤 저장·제출을 막지 않는다(MST 는 모듈 시계, AP 는 406 서버 시계가 있음). "Time is up… Answers can no longer be changed." 문구는 이 경로에서 서버 강제가 아니다.
- **현재 영향 없음**: 비프로덕션 점검(2026-10-09)에서 공개된 고정형 SAT 세트는 0개(`Test Set 1` draft 만), MST 13개·ap_fixed 2개 공개. 비활성 경로다.
- **활성화 차단 가드(410)**: 비 AP 고정형 세트는 **공개 불가**(`mock_exam_sets` 트리거)이고 이미 공개돼 있어도 **새 응시 시작 불가**(`mock_exam_attempts` 트리거). 관리자 화면에 보이는 오류는 한·영 병기. MST·AP 는 영향 없음. 레거시 테스트 픽스처만 세션 설정 `alton.allow_fixed_sat_without_time_limit=on`(vitest 통합 설정)으로 우회한다.
- **해제 조건**: 고정형에 서버 기준 섹션 시계(406 과 같은 방식)와 만료 뒤 저장 거절·마감 settle 을 구현하고 테스트한 뒤, 410 의 트리거 2개·함수 2개를 제거한다(되돌리기 SQL 은 파일 머리 주석). 그 전까지 어떤 화면·문서도 클라이언트 타이머를 "강제되는 시간 제한"으로 표현하지 않는다.
- 회귀 테스트: `lib/mock-exam/fixed-sat-guard.integration.test.ts`.

## AB 풀 모의고사 선택 목록 검증 절차 (2026-10-09)
선택 목록(JSON 배열 또는 줄 단위 `stockKey`, 예: 설계 에이전트의 `docs/ap/ab-full-set-selection.md` 목록)이 임의로 주어져도 같은 도구로 검증한다.
1. 로컬 격리 DB 에 풀 레이아웃 세트 만들기: `local-demo-seed.ts seed --keys-file <목록>` — 목록으로 공식 풀 구성(AB: MC Part A 29 계산기 불가 + Part B 13 필수, FRQ A 2 계산기 + B 4 불가)을 채우고 공개 게이트가 구성 불충족을 보고한다.
2. 화면 증거: `screen-evidence.ts --shots-dir … --out …`(390x844·1280x800, 공식 레이아웃 순서, 마지막 섹션에서 제출해 결과 화면 점검) → 증거 v3(`checker_kind=automated`). 요약: `screen-evidence-summary.ts <증거.json>`.
3. 흐름: `full-flow-check.ts` — 파트별 계산기 조건 안내·타이머·계산기 도구, FRQ 다문항 저장·복원, 섹션별 만료(서버), 제출·결과, 노트북 저장, 재응시(15단계).
4. 탈락 항목(증거에 fail)은 리드에게 보고해 재고에서 교체한다.
5. 비프로덕션 기록(목록 한정): `mark-verified.ts --render --keys-file <목록> $T`, `mark-verified.ts --screen --evidence <증거.json> --keys-file <목록> $T` (둘 다 dry-run 기본, `$T` = `--target worpsqwqgnspddnrtnvq --i-know-nonprod worpsqwqgnspddnrtnvq`).
- 짧은 FRQ 연습 세트의 구간 이름은 공식 Part A/B 로 보이지 않게 `Practice Section (N questions, M min): …`, 탭은 `Practice Section: Free Response (calculator allowed|no calculator)`(공식 6문항 세트는 `Section II, Part A/B` 그대로). 단원 표기 `Covers Units 5, 6, 7` 의 번호는 재고 키워드 코드의 앞자리이고 CED 단원 번호와 일치함을 `lib/ap-exam/unit-codes.test.ts` 가 전수 확인한다.

## 응시 화면 통일과 결과 시각화 (2026-10-09)
- **AP 응시 화면 = SAT 응시 화면 구조**: 위 막대(제목·가운데 큰 타이머·Submit) / 왼쪽 번호판(`x/N answered`) / 번호 막대(Eliminate·Whiteboard 아이콘, 오류 신고, ★ My Notebook 저장) / 지문(자료·그림·문제)|선택지 두 칸(좁은 화면은 위아래) / 아래 막대(← · Solve Later · Guessed · →/Next section/Review & submit). 공용 조각은 `take-ui.tsx`(`ScrollPanes`·`ToolIconButton`·`NAV_BTN`)로 뽑아 SAT 4모듈 화면과 같이 쓴다. AP 고유: 섹션 탭·섹션별 타이머·계산기 규칙·계산기 도구·"About this set"(안내·Covers Units)·FRQ 다파트 입력(자동 저장)·4/5지선다. 서버 동작·RPC 변경 없음. 하이라이트(주석) 도구는 AP 에 넣지 않았다.
- **Results by Domain·AP 토픽 시각화**: `app/components/AccuracyBars.tsx` — 막대 + 색 눈금(빨강 <40%, 노랑 40~70%, 초록 >70%, 회색 0문항) + 상태 글자 + `n/m (p%)` 글자(색만으로 구분하지 않음), 표본 n<3 은 흐리게 "few questions", 영역은 큰 막대, "Skills to Focus On" 은 약한 순·첫 행 강조 + "Review mistakes" 이동. SAT 결과(학부모 읽기 전용 포함)와 AP 결과 토픽이 같은 컴포넌트를 쓴다. 새 쿼리 없음.
- 증거: `data/ap/screen-evidence/evidence-ui-unify.json`(풀 세트 48 + 연습 세트 3개, 후보 78, 390x844·1280x800, automated, 해시 결속), 전후 스크린샷 `docs/ap/screen-evidence/ui-unify/`.
