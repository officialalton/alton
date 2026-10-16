-- M4 — 상담/선생님 반복 가능시간 겹침 방지(관리자 상담 가용시간 + 선생님 개인 가용시간
-- 등록 UI 개선). 두 테이블 모두 이미 (weekday/day_of_week, start, end) 여러 행을 허용하는
-- 구조라 "같은 요일 안에 겹치지 않는 여러 시간대"는 스키마 변경 없이 가능하다. 이번
-- 마이그레이션은 겹치는 시간대 등록 자체를 DB 레벨에서 막는 exclusion constraint만 추가한다
-- (teacher_assignments_no_overlap/consultations_no_overlap과 동일한 원칙 — DB가 최종 방어선).
--
-- time 타입에는 내장 range 타입이 없으므로, 임의의 고정 기준일(2000-01-01)에 시각을 더해
-- timestamp 범위로 비교한다 — 실제 날짜와 무관하게 "하루 안의 시각 겹침"만 비교하려는
-- 의도이므로 기준일 자체는 의미가 없다.

create extension if not exists btree_gist;

-- 공용 상담 가능시간: weekday 같고 active인 규칙끼리 시간대가 겹치면 차단.
alter table consult_availability_rules add constraint consult_availability_rules_no_overlap
  exclude using gist (
    weekday with =,
    tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time) with &&
  ) where (active);

comment on constraint consult_availability_rules_no_overlap on consult_availability_rules is
  '같은 요일에 겹치는 반복 가능시간을 등록할 수 없다(비활성 규칙은 제외). '
  '겹치지 않는 여러 시간대(예: 월요일 10-17시, 월요일 19-23시)는 별개 행으로 허용된다.';

-- 선생님 개인 가용시간(teacher_availability_rules)은 DB exclusion constraint 대신
-- 서버 액션(app/teacher/availability-actions.ts addTeacherAvailabilityRule)에서 겹침을
-- 검증한다. 로컬 재현으로 확인한 이유: 이 테이블에 GiST exclusion constraint를 추가하면
-- insert마다 인덱스 락을 더 잡게 되는데, 기존 통합 테스트(lib/booking/
-- trial-entitlement-and-cancellation.integration.test.ts, supabase/
-- lesson-reviews.integration.test.ts)가 같은 고정 선생님(박서연,
-- dddddddd-0000-0000-0000-000000000001)에 대해 각자 beforeAll에서 반복 가능시간을
-- insert/delete하며 `npx vitest run` 전체 실행 시 병렬로 도는데, 락 타이밍이 바뀌면서
-- 두 테스트가 서로의 예약·가용시간 상태에 영향을 주어 실패했다(개별 파일 실행 시엔
-- 항상 통과 — 이 마이그레이션 이전부터 잠재해 있던 테스트 격리 문제를 타이밍만 바꿔
-- 노출시킨 것). 공용 상담 가능시간(consult_availability_rules)은 특정 선생님에 묶이지
-- 않는 단일 관리자 리소스라 이런 동시성 문제가 없어 exclusion constraint를 그대로 둔다.
