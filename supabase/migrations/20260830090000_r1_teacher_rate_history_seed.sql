-- R1 — v3 스키마 10/12(추가): teacher_rate_history 최초 데이터 생성
-- (Gate B §9-1 결정 실행: "과거 시급 이력이 없으므로 소급 생성하지 않는다. v3 전환일을
-- effective_from으로 하는 최초 1행만 현재 teachers.hourly_rate_krw 값으로 생성한다.")
--
-- (2026-08-30 정정, 사용자 지시) 최초 검토 시 teachers 2행 중 김도경(d8fe6918-...)
-- 선생님은 hourly_rate_krw가 NULL이라 대상에서 제외했었다. 사용자가 두 선생님 모두
-- 시급 이력을 만들기로 확정하고, 이번 테스트 데이터에서는 김도경 선생님도 장세준
-- 선생님과 동일한 50,000 KRW로 처리하라고 지시했다. 이 UPDATE는 특정 프로필 id 1건에
-- 대한 명시적 지시이며, "50000으로 설정"은 재실행해도 결과가 같은 자연 멱등 연산이다.
update teachers
set hourly_rate_krw = 50000
where id = 'd8fe6918-e886-49d3-9b59-b9fe639fcbf2' and hourly_rate_krw is null;

-- hourly_rate_krw가 NULL이거나 0 이하인 선생님(아직 시급이 정해지지 않은 pending 상태
-- 등)은 대상에서 제외한다 — amount_minor는 NOT NULL + CHECK(amount_minor > 0)이라
-- 애초에 행을 만들 수 없고, 임의의 값을 대신 채워 넣는 것은 실제 정책 결정(관리자가
-- 시급을 정하는 것)을 앞지르는 것이라 하지 않는다. 이런 선생님은 관리자가 실제 시급을
-- 정할 때 `set_teacher_rate()`(§20260830100000)로 별도 생성한다.
--
-- 재실행 안전성(사용자 요청): teacher_rate_history_one_current_per_teacher(teacher_id
-- WHERE effective_until IS NULL) 부분 유니크 인덱스를 ON CONFLICT 대상으로 지정해,
-- 이미 "현재" 행이 있는 선생님은 건너뛴다 — 이 파일을 다시 실행해도 중복 생성되지 않는다.
-- (위 UPDATE도 `WHERE hourly_rate_krw IS NULL` 조건이라 재실행 시 이미 50000으로
-- 설정된 행은 다시 건드리지 않는다.)
insert into teacher_rate_history (teacher_id, amount_minor, currency, effective_from)
select t.id, t.hourly_rate_krw, 'KRW', now()
from teachers t
where t.hourly_rate_krw is not null and t.hourly_rate_krw > 0
on conflict (teacher_id) where effective_until is null do nothing;
