# AP 문항 게시·검수·출시 흐름 (오너 확정 2026-10-08)

원칙: **전문가 검수는 게시 후**에 한다(기존 모의고사 검수와 같음: 검수 환경에서 게시된 문항을 쓰고, 오류는 기존 오류 신고 흐름으로 접수). 따라서 전문가 승인은 문제은행 게시의 **차단 조건이 아니다**. 단, 학생이 보기 전의 **그래프 렌더링 + 학생 화면 검증은 필수 게이트**이고, 프로덕션 출시(launch)는 별도 게이트다.

## 1. 단계(release_tier)와 상태
| 단계 | 의미 | 진입 조건 |
|---|---|---|
| `candidate` | 후보 재고(`ap_candidate_items`, 학생 비노출) | 생성 + 자동 게이트 |
| `review_env` | 검수 환경에 **게시**(`problems` 공개, exam_system='ap') | `review_state = auto_passed` AND `render_verified` AND `screen_verified` (= `review_env_ready`) |
| `launch` | 프로덕션 공개 | `review_env` 에서 (승인 서명 `expert_status=approved`) 또는 (검수 기간 종료 AND 미해결 신고 0 AND `issues_reported` 아님) — 뷰 `ap_launch_ready_v` |
- 검증 상태(review_state): candidate / rejected / needs_revalidation / auto_passed / exact_duplicate. 선택(`used_in_sample`)·`legacy_reserve`는 별개.
- 게시 후 검수 상태(expert_status): `unreviewed` / `in_review` / `approved` / `issues_reported`. 신고에서 자동 파생되는 값은 `ap_item_review_status_v.open_reports` 로 확인(수동 값과 함께 사용).
- 자동 게이트 통과(auto_passed)는 **게시 승인이 아니다**: 렌더링·학생 화면 검증을 끝내야 `review_env_ready`가 true 가 된다. 현재 두 검증 모두 미완료 → 검수 환경 게시 가능 0건.

## 2. 흐름: 후보 → 게시(검수 환경) → 신고 → 수정(새 버전) → 출시
1. 후보 생성·자동 검수(코드 게이트 → 독립 풀이 → 검토) → `auto_passed`.
2. 그래프/표 렌더링(`stimulus.data` → 그림) + 학생 화면(영어 UI, 계산기·타이머·접근성) 검증 → `render_verified`, `screen_verified` = true.
3. `problems`/`problem_versions`로 **게시**(exam_system='ap', ap_subject, 키워드·스킬, 해설 영어 포함). `ap_candidate_items.problem_id/problem_version_id` 연결, `release_tier='review_env'`, `review_period_ends_at` 설정. 기존 문제은행 게이트(영어 해설·render_check·정답 키 필수, 공개 버전 불변)가 그대로 적용된다.
4. 검수자(교사·외부 검수자)는 검수 환경에서 풀고, **기존 오류 신고 흐름**(마이그레이션 `20261940000000` 신고, `…360` 확인/수정됨 분류, 판정 verdict)으로 신고한다. 병렬 신고 시스템은 만들지 않는다.
5. 관리자가 신고를 확인(`problem_error_report_confirm`) → 문항 수정은 **새 `problem_versions`**(공개 버전 불변 규칙) → 신고는 '수정됨'으로 자동 분류. 해당 후보의 `problem_version_id`를 새 버전으로 갱신, `expert_status`는 `issues_reported` → 수정 후 `in_review`.
6. 표본 승인(서명) 또는 검수 기간 종료 + 미해결 신고 0 → `ap_launch_ready_v` 에 나타남 → 관리자가 `release_tier='launch'` 로 올림(프로덕션 배포는 별도 오너 승인).
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
