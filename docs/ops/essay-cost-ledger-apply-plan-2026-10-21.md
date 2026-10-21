# AI 에세이 비용 원장 마이그레이션 적용안 (2026-10-21) — 제출용, 미적용

상태: 공유 비프로덕션 DB(`worpsqwqgnspddnrtnvq`)에는 아무것도 적용하지 않았다(읽기 전용 SELECT만 실행). 검증은 격리 스택(`ALTON_ledger`, PORT_OFFSET=2400)에서 했고 종료·`config.toml` 원복·컨테이너 0 확인했다.

## 0. 이 점검에서 고친 것 (적용 전 필수 반영)

1. **파일 이름(버전) 정정 — 치명적 결함 수정.** 원래 `20261101100000` 은 이미 적용된 `20262100000600`(`mock_exam_essay_scores` 생성)보다 숫자가 작았다. 결과: (a) `db reset`/신규 스택에서 600보다 먼저 실행돼 `relation "public.mock_exam_essay_scores" does not exist` 로 **전체 체인이 실패**(재현함), (b) 공유 DB(최신 640)에는 `db push` 가 "out of order" 로 거부하거나 `--include-all` 이 필요. 아직 미적용이므로 `20262100000650_essay_ai_cost_events.sql` 로 이름만 바꿨고(내용 동일), 이를 가리키던 코드 주석·문서 참조도 모두 갱신했다. 공유 DB 의 미적용 목록은 이제 정확히 650·660 두 개다(로컬 602개 vs 원격 600개, 차이 = 이 두 파일).
2. **일별 뷰 값 동일성 보정.** 새 `essay_ai_cost_daily` 는 비용이 없는 그룹(건너뜀 2행)의 토큰·비용이 NULL 이었다(600 정의는 0). `coalesce(…, 0)` 로 맞춰 600 정의와 행 단위 일치(`EXCEPT` 양방향 0건, backfill 전·후 모두)를 확인.
3. **명시적 grant 보강** `20262100000660_essay_ai_cost_ledger_grants.sql` 신규(적용 금지 상태). 아래 2절.

## 1. 추가 구조와 additive 판정

| 구분 | 객체 | 신규/변경 |
|---|---|---|
| 테이블 | `essay_ai_cost_events` (+ 인덱스 2개, RLS ON, 정책 `essay_ai_cost_events_admin_read` select·is_admin) | 신규 |
| 뷰 | `essay_ai_cost_effective` (security_invoker) | 신규 |
| 함수 | `essay_ai_month_spend(timestamptz)`, `reserve_essay_ai_budget(uuid,uuid,numeric,numeric,timestamptz)` | 신규 |
| 뷰 | `essay_ai_cost_daily` | **재정의**(`create or replace`) — 열 이름·순서·타입 동일(day date, model text, essays/done/failed/input_tokens/output_tokens bigint, cost_usd numeric), 기존 ACL 유지, 값 동일(2절·4절 검증) |

- `settle`/`release` 함수는 **없다.** 정산·해제는 서버 코드가 service_role 로 `essay_ai_cost_events` 를 UPDATE 한다(비용 0 이면 해제). 따라서 필요한 권한은 테이블 UPDATE.
- 기존 테이블·열·데이터 변경 없음(`mock_exam_essay_scores` 불변). 데이터 이동 없음(backfill 은 별도 파일, 미실행).
- **판정: 추가형(additive).** 변경은 `essay_ai_cost_daily` 뷰 정의 하나뿐이며 열 계약이 동일하다. 단 이 뷰는 의존하는 앱·구형 코드가 없다(3절).

## 2. 접근 권한 점검

**현재 공유 DB:** 2026-10-30 이전이라 `postgres` 의 기본 권한(`pg_default_acl`)이 새 테이블·뷰에 anon/authenticated/service_role 전권을 자동 부여한다(실측: 기존 `mock_exam_essay_scores`·`essay_ai_cost_daily` 모두 그렇다). 650 만 적용해도 지금은 동작하지만, 10-30 이후 `db reset`/신규 프로젝트/프리뷰 브랜치에서는 650 이 만든 테이블·뷰에 **권한이 전혀 없다**(`relacl` 없음).

격리 스택에 자동 부여를 끄고(기본 권한 회수) 650 만 적용한 결과:
- anon·authenticated·service_role 모두 원장 테이블·뷰 접근 불가. **service_role 도 `permission denied for table essay_ai_cost_events` / `…view essay_ai_cost_effective`** — 월 합계 RPC·예약·정산이 전부 실패한다. 즉 서버가 쓰는 경로가 막힌다(보안상 안전하지만 기능 정지).
- 함수는 650 자체에 `revoke … from public, anon, authenticated` + `grant execute … to service_role` 가 있어 정상(ACL `{postgres=X, service_role=X}`).

650 의 RLS: 테이블 RLS ON, select 정책 관리자 한 개, insert/update/delete 정책 없음(= service_role 만 쓴다). 뷰는 security_invoker.

**보강 마이그레이션 `20262100000660_essay_ai_cost_ledger_grants.sql`(미적용):**
- 원장 테이블: anon·authenticated 전부 회수 → authenticated SELECT 만(RLS 로 관리자 행만), service_role SELECT·INSERT·UPDATE(DELETE 없음).
- 집계 뷰 2개: anon·authenticated 회수, service_role SELECT 만. 앱·구형 코드가 뷰를 읽지 않으며, authenticated 에 열어두면 학생이 호출자 RLS 로 본인 에세이 비용을 보게 된다(실측으로 확인해 닫음). 관리자는 SQL(대시보드)로 조회.
- `mock_exam_essay_scores`: 자동 부여가 없는 환경에서 재생성돼도 되도록 authenticated SELECT·service_role SELECT/INSERT/UPDATE grant 만 추가(기존 권한은 줄이지 않음).
- 함수: revoke(public·anon·authenticated)·grant(service_role) 재확인(멱등).

격리 스택(자동 부여 OFF + 650 + 660) 역할별 실측:

| 역할 | 원장 SELECT | 원장 INSERT/UPDATE/DELETE | 집계 뷰 | `reserve_…`/`month_spend` |
|---|---|---|---|---|
| anon | 거부 | 거부 | 거부 | 거부 |
| 학생(authenticated, 비관리자) | 0행(RLS) | 거부 | 거부 | 거부 |
| 관리자(authenticated) | 허용(권한 통과, 시험 시점 이벤트 0행이라 행 노출은 미시험) | 거부 | 거부(SQL 사용) | 거부 |
| service_role | 허용 | INSERT·UPDATE 허용, DELETE 거부 | 허용 | 허용(`month_spend`=0.06206, 예약 성공) |

→ 일반 학생·미인증은 원장을 조회·변경할 수 없고 예약 함수를 호출할 수 없다. 서버(service_role)만 쓴다.

## 3. 구형 Production 코드(origin/main) 호환성

- `essay_ai_cost_daily` 뷰를 읽는 코드: **없음**(origin/main 의 코드·테스트·앱 전체 검색; 문서 `docs/ap/essay-ai-grading.md` 의 수동 SQL 예시뿐).
- `mock_exam_essay_scores` 를 쓰는 경로: `lib/essay-grading/store.ts`(claim upsert/update, usage select, finish update)와 `view.ts`(select). 새 마이그레이션은 이 테이블을 바꾸지 않는다 → **구형 코드는 깨지지 않는다.** 구형 코드는 원장·함수를 모르고 호출하지 않는다.
- 두 코드가 **같은 DB**에 쓰면: 구형 `finish` 는 `cost_usd` 를 실행값으로 덮어쓰고(1차 결함) 원장은 모른다. 이미 원장 이벤트(settled/legacy)가 있는 행에 구형 코드가 쓰면 그 증분은 원장에서 빠진다(과소 집계, 이중 합산 아님). 행에 이벤트가 없으면 뷰의 legacy 규칙이 구형 값을 updated_at 시점으로 집계한다. 공유 비프로덕션 DB 는 Preview(신 코드)만 쓰므로 해당 없음. Production DB 에 적용할 때는 새 코드 배포와 같은 단계로 한다.
- 새 코드 + 마이그레이션 미적용: `store.ts` 가 `noRpc`(PGRST202/42883) 로 월 합계를 구형 방식 폴백, 예약은 소프트 한도로 진행, 원장 insert/update 오류는 무시 → 깨지지 않음. 따라서 **어느 순서든 안전**하나 아래 순서를 권장.

## 4. 기존 비용 이관·이중 합산 방지 (격리 DB 시나리오)

공유 DB 읽기 전용 확인: `mock_exam_essay_scores` 3행 — `0ab14d59…` done, claude-sonnet-5-5, 14998/1138 토큰, **$0.06206**, updated_at 2026-10-19 23:32:33.752Z; `071e7ead…`, `50b6099b…` skipped($0, `last_error=empty`). 공유 DB 에 `essay_ai_cost_events` 없음(to_regclass NULL). 격리 DB 에 같은 값으로 시딩하고, `store.ts` 의 `reserve → legacy 고정 → settle → 행 누적` 순서를 그대로 옮긴 SQL 로 실행했다. 월 지출은 `essay_ai_month_spend`(UTC 월), "전체 합"은 `essay_ai_cost_effective` 전체 합.

| 시나리오 | 10월 지출 | 11월 지출 | 원장 뷰 전체 합 | 행 cost_usd | 이벤트 |
|---|---|---|---|---|---|
| a 적용 직후(이벤트 0) | 0.06206 | 0 | 0.06206 | 0.06206 | 없음(뷰가 행을 legacy 로 집계) |
| b1 backfill 1회 | 0.06206 | 0 | 0.06206 | 0.06206 | legacy 0.06206 |
| b2 backfill 2회 | 0.06206 | 0 | 0.06206 | 0.06206 | legacy 0.06206(멱등) |
| c1 backfill 없이 10-21 재시도 +0.04 | 0.10206 | 0 | 0.10206 | 0.10206 | legacy 0.06206 + settled 0.04 |
| c2 backfill 후 10-21 재시도 +0.04 | 0.10206 | 0 | 0.10206 | 0.10206 | legacy 0.06206 + settled 0.04 |
| d1 backfill 없이 11-02 재시도 +0.04 | 0.06206 | 0.04 | 0.10206 | 0.10206 | 위와 같음, 월만 분리 |
| d2 backfill 후 11-02 재시도 +0.04 | 0.06206 | 0.04 | 0.10206 | 0.10206 | 위와 같음 |
| d3 행 updated_at=10-31 23:59:59Z | 0.06206 | 0 | 0.06206 | 0.06206 | 없음 |
| d4 행 updated_at=11-01 00:00:00Z | 0 | 0.06206 | 0.06206 | 0.06206 | 없음(경계 정확히 11월) |
| d5 재시도 정확히 11-01 00:00:00Z | 0.06206 | 0.04 | 0.10206 | 0.10206 | legacy(10월)+settled(11월) |
| e0 650×3 + 660×2 재적용 | 0.06206 | 0 | 0.06206 | 0.06206 | 없음 |
| e1 backfill 후 650 재적용 | 0.06206 | 0 | 0.06206 | 0.06206 | legacy 0.06206 |

모든 행에서 합계는 0.06206(+재시도분)이고 원장·행 이중 합산은 없다. 이유: 뷰는 이벤트가 하나라도 있는(settled/legacy) 행의 `cost_usd` 를 버리고 이벤트만 센다. 일별 뷰도 600 정의와 행 단위 일치(`EXCEPT` 양방향 0건, backfill 전·후).

주의(코드 쪽 전제, 변경 없음): 재시도로 `finish` 가 행을 갱신하기 직전에 legacy 이벤트를 `updated_at` 시점으로 고정하므로 월이 이동하지 않는다. backfill 은 그 고정을 미리 대신할 뿐이며 필수가 아니다(c1 = c2).

## 5. 적용 순서·명령·롤백

전제: 마이그레이션 파일 650·660 이 `preview/m4-integration-verification` 에 있고, 공유 DB 가 640 까지 적용돼 있다(확인함).

**적용 전 확인(읽기 전용)**
```
npx supabase migration list --linked          # 650·660 만 Local 에 있고 Remote 비어 있어야 함
npx supabase db query --linked -o table "select to_regclass('public.essay_ai_cost_events')::text, to_regclass('public.mock_exam_essay_scores')::text, to_regproc('public.is_admin')::text"   # NULL, 값, is_admin
npx supabase db query --linked -o table "select count(*), coalesce(sum(cost_usd),0) from public.mock_exam_essay_scores"   # 현재 3행 / 0.06206 (변하면 기록)
```
**적용**
```
npx supabase db push --linked --dry-run      # 650·660 두 개만 나오는지 확인
npx supabase db push --linked
```
**적용 후 확인**
```
npx supabase migration list --linked
npx supabase db query --linked -o table "select public.essay_ai_month_spend(now())"   # service 권한 필요 시 SQL 편집기(postgres)에서: 0.06206 (10월)
npx supabase db query --linked -o table "select relname, relrowsecurity, relacl::text from pg_class where relnamespace='public'::regnamespace and relname like 'essay_ai_cost%' order by 1"
  # events: RLS true, ACL 에 anon 없음·authenticated=r·service_role=arw. 뷰: service_role=r (+postgres)
npx supabase db query --linked -o table "select * from public.essay_ai_cost_daily order by 1,2"   # 600 정의와 같은 2행(0.06206 / 0)
```
(`db query` 는 postgres 권한이라 service_role 접근 자체는 PostgREST 로 확인: `essay_ai_cost_events?select=id&limit=1` 를 secret 키로 GET → 200, anon 키로 GET → 거부 또는 빈 결과.)

backfill 은 필수 아님(필요 시 총괄 승인 후 `docs/ap/essay-ai-cost-events-backfill.sql` 1회, 멱등).

**코드 배포 순서(권장):** ① 650→660 적용 + 확인 → ② Preview 에 새 코드 배포 → ③ Preview 에서 AI 채점이 꺼진 상태(`AI_ESSAY_GRADING_ENABLED` 기본 꺼짐)로 화면 정상 확인, 실호출은 유료 승인 후 → ④ Production 은 구형 코드 유지(안전, 3절). Production DB 에 적용할 때는 같은 파일을 같은 순서로 적용하고 새 코드를 그 뒤에 올린다. 코드 먼저/마이그레이션 먼저 어느 쪽도 깨지지 않지만 원장 정확도는 마이그레이션 먼저가 높다.

**롤백(추가형이므로 데이터 손실은 원장 이벤트뿐)** — 새 코드가 이미 원장에 썼다면 이벤트가 사라지므로 먼저 `select * from essay_ai_cost_events` 를 보존한다.
```sql
begin;
drop view if exists public.essay_ai_cost_daily;
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
롤백 후 새 코드는 `noRpc` 폴백으로 계속 동작한다(월 한도는 사전 검사만).

## 6. 남은 위험

1. 660 은 `essay_ai_cost_daily` 의 authenticated 읽기를 회수한다(앱·구형 코드는 읽지 않음). 관리자가 JWT 로 그 뷰를 직접 읽는 도구가 있다면 막힌다 — 현재 문서상 조회는 SQL 뿐.
2. 같은 DB 에 구형·신 코드가 동시에 쓰면 구형 증분이 원장에서 빠진다(3절). 비프로덕션 공유 DB 는 해당 없음.
3. 예약 후 정산 못 한 비정상 종료는 30분 뒤 월 합계에서 빠진다(설계). 그 사이 예약분만큼 한도가 일시적으로 빡빡해질 수 있다.
4. 월 경계는 UTC 기준(오너 정책의 월 예산이 KST 달력이면 9시간 어긋남 — 정책 확인 필요).
5. 격리 검증은 `store.ts` 동작을 SQL 로 옮긴 것이다. 실제 PostgREST·실호출 경로는 적용 후 Preview 에서 확인해야 한다(유료 호출은 하지 않음).
