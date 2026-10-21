# AI 에세이 비용 원장 마이그레이션 적용안 (2026-10-21, 2차 갱신) — 제출용, 미적용

상태: 공유 비프로덕션 DB(`worpsqwqgnspddnrtnvq`)에는 아무것도 적용하지 않았다(읽기 전용 `migration list`·`db push --dry-run` 만 실행). 검증은 격리 스택(`ALTON_ledger2`, PORT_OFFSET=2700)에서 했고, 종료·`config.toml` 원복·컨테이너 0 확인은 보고서 끝에 기록한다.

오너 결정(2026-10-21): (1) AI 월 예산 경계는 **UTC 유지**(교사 정산의 America/Los_Angeles 와 다름 — 아래 8절·런북에 명시). (2) 650·660 은 아래 조건 충족 후 공유 DB 적용 승인. 670(admin_attempt_facts)은 이 작업·적용에 포함하지 않는다. (3) 예약 만료·구형 코드 공존 보완.

## 0. 적용 가능 여부 판정 표

| 조건 | 판정 | 근거 |
|---|---|---|
| 드라이런에 650·660 두 파일만 포함 | **미충족(분리 필요)** | 공유 DB 드라이런은 650·660·**670** 세 개를 낸다. `db push` 는 모든 미적용을 적용하므로 5절의 "임시 작업 디렉터리(670 제외) + `db push --workdir`" 절차로 650·660 만 적용. 이 절차를 격리 DB 에서 실제로 재현해 검증(적용 후 드라이런에 670 만 남음) |
| 구형 Production 코드·뷰 호환 | 충족 | 3절. 기존 테이블·열 불변, 구형 코드는 원장·뷰를 읽지 않음 |
| 명시적 권한 | 충족 | 660: anon 전부 회수, authenticated 는 원장·unsettled 뷰 SELECT 만(RLS 로 관리자 행), service_role 은 SELECT/INSERT/UPDATE(DELETE·TRUNCATE 회수까지 실측), 함수 4개 service_role 전용 |
| 격리 DB 에 실제 이벤트를 넣어 관리자 행 조회·학생·익명 차단 | 충족 | 4절 실측(관리자 events 2행·unsettled 1행 조회, 학생 0행, 익명 거부) |
| 비용 예약 만료 문제 확인·수정 | 충족 | 2절(`call_started_at` 구분)·시나리오 표, PostgREST 경유 실측 포함 |
| 구형 코드 공존 대조 방법 | 충족 | 7절(스냅샷·식별 규칙·대조 쿼리, 격리 DB 에서 쿼리 실행 확인) |
| 마이그레이션 부재 시 조용한 운영 방지 | 충족 | 서버 로그 경고(프로세스당 1회) + `essay_ai_ledger_status()` + `getEssayLedgerStatus()` + 테스트 |
| 전체 테스트 | 충족 | `lib/essay-grading` 6파일·98건 통과(이 라운드 신규 약 10건 포함), `tsc --noEmit` 신규 오류 없음 |

**판정: 5절 절차(650·660 만 개별 적용)로 적용 가능.** `db push --linked` 를 그대로 쓰면 670 이 같이 나가므로 쓰지 말 것. Production 은 구형 코드 유지 단계에서는 원장 없이도 안전(3절).

## 1. 이 라운드에서 650·660 에 바꾼 것 (650 은 미적용이라 파일 자체를 수정, 이름·번호 유지)

650 변경:
1. `essay_ai_cost_events.call_started_at timestamptz` 열 추가(테이블 생성문에 포함).
2. `essay_ai_month_spend()` 예약 포함 조건: 이전 "30분 이내인 예약만" → **"호출 시작 표시가 있거나 30분 이내인 예약"**.
3. 신규 함수 `start_essay_ai_call(uuid)`: 예약이 유효(30분 이내)하거나 이미 표시된 경우에만 `call_started_at` 을 남기고 true, 만료된 미시작 예약이면 false. 예산 예약과 같은 advisory lock 으로 직렬화(만료 경계의 경합 방지).
4. 신규 뷰 `essay_ai_unsettled`(호출 시작·정산 없음 예약, security_invoker).
5. 신규 함수 `essay_ai_ledger_status(timestamptz)`: 한 줄 jsonb 헬스(UTC 월 지출, unsettled 건수·금액·가장 오래된 시각, 만료된 미시작 예약 수, 행 누적↔원장 불일치 행 수, 행 합·원장 합).
6. 새 함수 2개에 EXECUTE 권한(PUBLIC·anon·authenticated 회수, service_role 부여).

660 변경: `essay_ai_unsettled` 뷰 권한, 새 함수 2개 revoke/grant, 그리고 **원장 테이블·집계 뷰 4개에서 service_role 의 자동 부여까지 회수한 뒤 필요한 권한만 재부여**(이전 판은 anon·authenticated 만 회수해, 2026-10-30 이전 환경에서 service_role 이 DELETE 가능했음 — 이번 실측에서 발견·수정).

앱 코드: `queue.ts`(호출 직전 `markCallStarted`, grade() 중 예외는 `costUnknown`), `store.ts`(`start_essay_ai_call` RPC, 정산을 `state='reserved'` 조건부 UPDATE + 0행/오류 시 행 누적 중단, 미적용 경고), `ledger-status.ts`(신규).

## 2. 예약 만료 설계와 시나리오

| 구분 | 상태 | 월 합계 | 비고 |
|---|---|---|---|
| a) 호출 시작 안 한 예약 | reserved, `call_started_at` 없음 | 30분 뒤 제외(해제) | 만료 뒤에는 `start_essay_ai_call` 이 false → 모델 호출 금지, 예약 0 으로 정리(`reservation_expired`, 시도 횟수 소모 없음) |
| b) 호출 시작했는데 정산 없음 | reserved + `call_started_at` | **계속 포함(unsettled)** | `essay_ai_unsettled`·`essay_ai_ledger_status()` 로 관리자 확인. grade() 중 타임아웃·예외 = 비용 미확정 → 정산·해제 안 함(`costUnknown`), 행 비용도 안 건드림 |
| c) 실비 확인된 호출 | settled | 발생 월에 **영구** | 예약 만료와 무관, 늦은 정산(만료 후 도착)도 reserved→settled 로 반영, 같은 예약 중복 정산은 0행 갱신으로 무시(행 누적도 중복 증가 없음) |

격리 DB 시나리오(SQL 직접 실행; 예약 최악액 1.0, 예산 1.5):

| # | 시나리오 | 결과 | 기대 |
|---|---|---|---|
| S1 | 예약 A → 호출 시작 → 2시간 정산 없음 → 새 예약 B(1.0) | 월 지출 1.00000, **B 거절** | 거절 |
| S1b | (대조) 예약 C 호출 시작 없이 2시간 → 새 예약 D | 월 지출 0, **D 허용** | 허용 |
| S4 | 만료된 미시작 C 에 `start_essay_ai_call` | false, 표시 안 남음 | false |
| S2 | A 호출 시작 후 2시간 뒤 정산 도착(실비 0.4) | 정산 전 1.0(unsettled 포함) → 정산 후 **0.4** | 0.4 |
| S3 | 같은 예약 두 번째 정산 | 갱신 0행, 월 지출 0.4 유지, 이벤트 1건 | 무시 |
| S5 | 호출 시작 후 5시간·정산 없음(타임아웃) | `essay_ai_unsettled` 1행(0.9, 5시간 경과), 월 지출 0.9 유지, 헬스 `unsettled_count=1` | 확인 대상으로 남음 |
| S6 | 3시간 전 settled 0.3 + 전월 settled 0.2 | 이번 달 0.3 | 영구·월 귀속 |
| S7 | 응답 행 0.10 + 원장 0.04 인 행 | 헬스 `row_ledger_mismatch_rows=1` | 불일치 감지 |

같은 흐름을 **실제 PostgREST(service_role 키)로 `createSupabaseEssayStore`** 를 호출해서도 확인했다(`tmp/ledger-live.ts`, 미커밋): 예약 A 성공 → `markCallStarted` true → B 거절 → 정산 → 같은 예약 중복 정산(월 지출·행 누적 불변) → 호출 시작 후 `costUnknown` finish → 월 지출에 최악액 유지·`getEssayLedgerStatus` 가 `needsAttention=true` 와 안내 문구 반환. 자동 테스트(`store.test.ts`)는 같은 규칙의 메모리 모델로 A·C·늦은 정산·중복 정산·타임아웃·정산 실패·`reservation_expired` 를 검증한다.

남는 한계: unsettled 는 보수적이라 **한도를 영구히 점유**한다(관리자가 정산하기 전까지). 실제 과금 여부는 Anthropic 콘솔로만 확인 가능.

## 3. 구형 Production 코드(origin/main) 호환성

- `essay_ai_cost_daily` 를 읽는 코드: 없음(코드·테스트·앱 검색; 문서의 수동 SQL 예시뿐). 660 이 이 뷰의 authenticated 읽기를 회수하므로 관리자는 대시보드 SQL 로 조회.
- `mock_exam_essay_scores` 를 쓰는 경로(`store.ts`·`view.ts`)는 테이블이 불변이라 깨지지 않는다. 구형 코드는 원장·함수를 모르고 호출하지 않는다.
- 새 코드 + 마이그레이션 미적용: `PGRST202/42883` 을 감지해 구형 방식(행 `updated_at` 근사·예약 없음)으로 동작 — **호환성일 뿐 정상 운영이 아니다**. 조용히 지나가지 않도록 서버 로그에 `[essay-ledger] WARNING …`(프로세스당 1회)를 남기고, `getEssayLedgerStatus()` 는 `ledgerPresent=false`(`migration_not_applied`)를, 런북은 `select public.essay_ai_ledger_status();` 함수 부재를 신호로 쓴다.

## 4. 접근 권한 실측 (격리 스택, 실제 이벤트 행 포함)

준비 데이터: 원장 2행(settled 0.04 + 호출 시작한 reserved 0.9) + 응답 행. 관리자 = `profiles.role='admin'` 사용자의 JWT(`set local role authenticated` + `request.jwt.claims`), 학생 = 비관리자 authenticated.

| 역할 | 원장 SELECT | unsettled 뷰 | effective·daily 뷰 | 4개 함수 | 원장 INSERT/UPDATE/DELETE |
|---|---|---|---|---|---|
| anon | 거부 | 거부 | 거부 | 거부 | 거부 |
| 학생(비관리자) | **0행**(RLS) | **0행** | 거부 | 거부 | 거부 |
| 관리자 | **2행 조회됨** | **1행 조회됨** | 거부(SQL 사용) | 거부 | 거부 |
| service_role | 2행 | 1행 | 허용 | 허용 | INSERT·UPDATE 허용, **DELETE 거부(수정 후)** |

ACL(적용 후): events `{authenticated=r, service_role=arw}`, unsettled `{authenticated=r, service_role=r}`, effective·daily `{service_role=r}`, 함수 4개 `{postgres=X, service_role=X}`. 이 환경은 2026-10-30 이전 기본 부여(자동 grant)가 켜져 있으므로 "회수 후 재부여"가 실제로 동작함을 확인한 것이고, 자동 부여가 꺼진 환경에서는 660 의 명시적 grant 가 서버 경로를 보장한다(이전 라운드 격리 실측).

## 5. 적용 절차 — 650·660 만 개별 적용 (670 제외)

**왜 `db push --linked` 를 그대로 쓰면 안 되나:** 공유 DB 드라이런 결과가 650·660·670 이다(2026-10-21 확인). `db push` 는 미적용 전부를 적용한다. `db query -f` 로 파일을 개별 실행하는 방법은 `--db-url` 에서 "cannot insert multiple commands into a prepared statement" 로 **실패**했다(다중 문장 불가, 격리 DB 에서 확인). 그래서 CLI 가 버전 기록까지 하는 `db push` 를 쓰되, **670 이 없는 임시 프로젝트 디렉터리**를 `--workdir` 로 지정한다.

```
# 0) 읽기 전용 확인 — 공유 DB 가 640 까지 적용, 650·660·670 이 미적용인지
npx supabase migration list --linked
npx supabase db query --linked -o table "select to_regclass('public.essay_ai_cost_events')::text, to_regclass('public.mock_exam_essay_scores')::text, to_regproc('public.is_admin')::text"   # NULL, 값, is_admin
npx supabase db query --linked -o table "select now() as snap_at, count(*), coalesce(sum(cost_usd),0) as sum_cost, max(updated_at) from public.mock_exam_essay_scores"   # 7절 스냅샷 — 기록해 둔다

# 1) 임시 프로젝트(670 제외) 만들기 — 저장소 밖 임시 디렉터리
P=$(mktemp -d)
mkdir -p $P/supabase/migrations $P/supabase/.temp
cp supabase/config.toml $P/supabase/ && cp -R supabase/templates $P/supabase/
cp supabase/migrations/*.sql $P/supabase/migrations/
rm $P/supabase/migrations/20262100000670_admin_attempt_facts_ap_item_count.sql
cp supabase/.temp/linked-project.json supabase/.temp/project-ref supabase/.temp/pooler-url $P/supabase/.temp/   # 링크 정보

# 2) 드라이런 — 650·660 두 개만 나와야 한다(670 이 보이면 중단)
npx supabase db push --linked --workdir $P --dry-run

# 3) 적용(각 파일은 CLI 가 파일 단위 트랜잭션으로 실행하고 버전을 기록한다)
npx supabase db push --linked --workdir $P

# 4) 확인 — 저장소 기준 드라이런에 이제 670 만 남아야 한다(670 은 별도 승인 후 적용)
npx supabase db push --linked --dry-run
npx supabase migration list --linked
```
이 절차(`--linked` 대신 `--db-url '…?sslmode=disable'`)를 격리 DB 에서 그대로 실행했고, 3)의 결과 `schema_migrations` 에 650·660 이 기록되었으며 4)의 드라이런이 `20262100000670…` 한 개만 냈다. `db push --linked` 가 CLI 버전 차이로 `--workdir` 를 무시한다면(2)에서 670 이 보임) **적용하지 말고** 중단한다. 대안은 총괄이 670 파일을 일시적으로 임시 브랜치에서만 제거한 체크아웃에서 `db push --linked` 를 실행하는 것이다.

**적용 후 확인(읽기 전용)**
```
npx supabase db query --linked -o table "select relname, relrowsecurity, relacl::text from pg_class where relnamespace='public'::regnamespace and relname like 'essay_ai_%' order by 1"
  # events: RLS true, ACL = {authenticated=r, service_role=arw}; unsettled {authenticated=r, service_role=r}; effective·daily {service_role=r}
npx supabase db query --linked -o table "select public.essay_ai_ledger_status()"      # 이벤트 0행: unsettled 0, 월 지출 = 기존 행 0.06206(10월), row_ledger_mismatch_rows 0
npx supabase db query --linked -o table "select * from public.essay_ai_cost_daily order by 1,2"   # 600 정의와 같은 2행
```
service_role 접근 자체는 PostgREST 로: `essay_ai_cost_events?select=id&limit=1` 를 secret 키로 GET → 200, anon 키로 GET → 거부.

backfill 은 필수 아님(`docs/ap/essay-ai-cost-events-backfill.sql`, 멱등, 총괄 승인 후).

**코드 배포 순서(권장):** ① 650→660 적용 + 확인 → ② Preview 에 새 코드 배포 → ③ AI 채점 꺼진 상태에서 화면 확인, 실호출은 유료 승인 후 → ④ Production 은 구형 코드 유지(안전). Production DB 에 적용할 때는 같은 절차·같은 순서로 하고 새 코드를 그 뒤에 올린다.

**롤백(추가형, 손실은 원장 이벤트뿐)** — 새 코드가 이미 원장에 썼다면 먼저 `select * from essay_ai_cost_events` 를 보존한다.
```sql
begin;
drop view if exists public.essay_ai_cost_daily;
drop view if exists public.essay_ai_unsettled;
drop function if exists public.essay_ai_ledger_status(timestamptz);
drop function if exists public.start_essay_ai_call(uuid);
drop view if exists public.essay_ai_cost_effective;
drop function if exists public.reserve_essay_ai_budget(uuid, uuid, numeric, numeric, timestamptz);
drop function if exists public.essay_ai_month_spend(timestamptz);
drop table if exists public.essay_ai_cost_events;
create or replace view public.essay_ai_cost_daily with (security_invoker = true) as   -- 600 정의 복원
  select (created_at at time zone 'utc')::date as day, model,
         count(*) as essays, count(*) filter (where status = 'done') as done, count(*) filter (where status in ('failed','dead')) as failed,
         sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens, sum(cost_usd) as cost_usd
    from public.mock_exam_essay_scores group by 1, 2;
grant select on public.essay_ai_cost_daily to authenticated, service_role;           -- 660 이 회수한 읽기 복원
delete from supabase_migrations.schema_migrations where version in ('20262100000650','20262100000660');
commit;
```
롤백 후 새 코드는 미적용 폴백으로 계속 동작한다(월 한도는 사전 검사만, 서버 로그 경고).

## 6. 기존 비용 이관·이중 합산 방지 (이전 라운드 격리 시나리오 — 이번 변경은 합산 뷰·backfill 로직을 바꾸지 않음)

공유 DB 읽기 전용 값: `mock_exam_essay_scores` 3행, `0ab14d59…` done $0.06206(updated_at 2026-10-19 23:32:33Z), 나머지 2행 skipped $0. 원장 테이블 없음. 격리 DB 시딩 시나리오(적용 직후·backfill 1·2회·재시도 10-21/11-02·월 경계 정확히 10-31 23:59:59Z/11-01 00:00:00Z·마이그레이션 재적용)에서 합계는 항상 0.06206(+재시도분)이고 원장·행 이중 합산은 없었다(뷰가 이벤트가 있는 행의 `cost_usd` 를 버리고 이벤트만 센다; 일별 뷰는 600 정의와 행 단위 일치). 이번 라운드의 새 정산 로직(`state='reserved'` 조건부 UPDATE)도 PostgREST 경유 실측에서 행 누적과 원장 합이 일치(`rowLedgerMismatchRows=0`)함을 확인했다.

## 7. 구형 Production 코드와의 공존 — 누락분 대조 방법

**표현 규칙:** 구형 코드가 같은 DB 에 AI 채점 비용을 쓰는 동안(= Production 에 새 코드가 올라가기 전까지, 또는 일부 인스턴스가 구형인 배포 전환 중) 문서·화면·주석에 "원장 기반 예산이 전체 서비스 지출을 통제한다"고 쓰지 않는다. 원장은 **이 앱 코드(새 버전)가 호출한 채점 비용만** 안다. 구형 코드는 예약도 원장도 모르므로 (a) 구형이 쓰는 호출은 예산 사전 검사 없이(소프트) 나가고, (b) 비용은 응답 행 `cost_usd` 에만 남는다(구형 `finish` 는 행 값을 덮어쓴다 — 1차 결함).

**구형 비용이 원장에 어떻게 보이는가:** 구형이 쓴 행 중 이벤트가 없는 행은 `essay_ai_cost_effective` 가 `updated_at` 시점의 legacy 비용으로 집계한다(월 합계에 포함됨, 월은 마지막 갱신 시각 기준 근사). 이미 이벤트가 있는 행을 구형이 덮어쓰면 그 증분은 원장에서 빠진다(과소 집계). 이중 합산은 없다.

**전환 시점 스냅샷(적용 직전, 읽기 전용 — 5절 0 단계):**
```sql
select now() as snap_at, count(*), coalesce(sum(cost_usd),0) as sum_cost, max(updated_at) from public.mock_exam_essay_scores;
```
`snap_at` 을 `T_apply` 로 기록한다. 5절 3) 적용이 끝난 뒤 이 시점부터 새 코드와 구형 코드가 같은 DB 에 동시에 쓰면 아래로 대조한다.

**구형 코드가 쓴 행 식별 규칙**
- A. `T_apply` 이후 갱신됐고 비용이 있는데 원장 이벤트(settled·legacy)가 없는 행 → 구형 코드(또는 원장 도입 전) 쓰기. 새 코드는 비용이 생기면 반드시 이벤트를 남기기 때문.
- B. 이벤트가 있는데 행 누적 `cost_usd` ≠ 이벤트 합인 행 → 구형이 덮어썼거나 중복 finish. `essay_ai_ledger_status()` 의 `row_ledger_mismatch_rows` 가 이 개수.

**대조 쿼리(격리 DB 에서 구형 행·덮어쓴 행을 시딩해 실행 확인: A 1건, B 1건(diff 0.04), `row_ledger_mismatch_rows=1`)**
```sql
-- A) 구형 코드가 T_apply 이후에 쓴 행(원장 이벤트 없음)  — :t_apply = 스냅샷 시각
select s.id, s.cost_usd, s.updated_at from public.mock_exam_essay_scores s
 where s.cost_usd > 0 and s.updated_at >= :t_apply
   and not exists (select 1 from public.essay_ai_cost_events e where e.essay_score_id = s.id and e.state in ('settled','legacy'));
-- B) 행 누적과 원장 합이 다른 행(덮어쓰기·중복) — diff>0 이면 원장에 없는 지출, diff<0 이면 행이 줄어든 것
select s.id, s.cost_usd as row_cost, l.ledger_cost, s.cost_usd - l.ledger_cost as diff, s.updated_at from public.mock_exam_essay_scores s
 join (select essay_score_id, sum(cost_usd) as ledger_cost from public.essay_ai_cost_events where state in ('settled','legacy') group by 1) l on l.essay_score_id = s.id
 where abs(s.cost_usd - l.ledger_cost) > 0.000005;
-- 요약: 행 합 vs 원장 합 (스냅샷 대비 증분도 같은 방식으로 비교)
select public.essay_ai_ledger_status();  -- rows_cost_total_usd, ledger_settled_legacy_total_usd, row_ledger_mismatch_rows, unsettled_*
```
원장에 없는 지출의 하한 = B 의 `sum(greatest(diff,0))`. A 의 비용은 월 합계에 이미 포함(legacy 근사)되나 예약 없이 나간 호출이므로 동시 초과 위험 구간이다. 최종 진실은 **Anthropic 콘솔 월 청구액**이다: 콘솔 월 합계 − `essay_ai_month_spend(now())` 가 크게 양수면 구형 코드·원장 밖 호출을 의심한다(콘솔 월 한도는 별도 **[오너]**).

## 8. 시간 기준(UTC)과 남은 위험

- **AI 월 예산·일 한도·원장 월 귀속은 UTC 기준**(오너 결정). 교사 정산은 America/Los_Angeles 라서 두 월 경계가 다르다(UTC 월 1일 00:00 = 미 서부 전월 말일 17:00 PDT / 16:00 PST). 관리자 화면에 AI 비용·예산을 보여주는 곳이 아직 없어(조회는 SQL) 화면 문구는 없고, 대신 `docs/ap/essay-ai-grading.md` 의 관리자 비용 런북, `lib/essay-grading/costs.ts`·`ledger-status.ts` 주석, 이 문서에 'UTC 기준'을 명시했다. 화면이 생기면 같은 문구를 라벨에 넣을 것.
- 남은 위험
  1. unsettled 예약은 정산 전까지 한도를 점유한다(보수적). 관리자가 `essay_ai_unsettled` 를 주기적으로 확인해야 한다(헬스 `needsAttention`).
  2. 구형·신 코드가 동시에 쓰는 구간은 7절 대조로만 보정된다. 새 코드가 Production 에 올라가면 해소.
  3. 단가 환경값이 실제보다 낮으면 어긋난다(콘솔 한도 병행).
  4. 660 이 `essay_ai_cost_daily` 의 authenticated 읽기를 회수한다(앱·구형 코드는 안 읽음).
  5. 5절의 `--workdir` 절차는 격리 DB(`--db-url`)에서 적용까지, 공유 DB(`--linked`)에서는 드라이런만(쓰기 금지) 실행해 검증했다: `--linked --workdir <670 제외 임시 디렉터리> --dry-run` 이 650·660 두 개만 냈다(2026-10-21). 적용 단계에서도 2)의 드라이런이 두 개만 내는지가 최종 관문.
  6. 실제 Anthropic 호출·Preview 화면 경로는 이 작업에서 검증하지 않았다(유료 호출 금지).
