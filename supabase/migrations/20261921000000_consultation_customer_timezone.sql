-- 고객이 예약 링크에서 고른 표시 시간대를 상담 행에 남긴다. 지금까지는 첫 Calendar 동기화 호출에만
-- 메모리로 전달돼 재시도·크론·관리자 재동기화·시간 변경 PATCH는 기본값(LA)으로 돌아갔다.
-- null = 기본값(America/Los_Angeles). 값은 앱의 TIMEZONE_OPTIONS와 같은 목록만 허용.
--
-- 롤백: alter table consultations drop constraint consultations_customer_timezone_check,
--       drop column customer_timezone;   (전부 null 허용·추가 전용이라 데이터 손실은 이 값뿐)

alter table consultations add column if not exists customer_timezone text;

alter table consultations drop constraint if exists consultations_customer_timezone_check;
alter table consultations add constraint consultations_customer_timezone_check
  check (customer_timezone is null or customer_timezone in (
    'Asia/Seoul','America/New_York','America/Chicago','America/Denver','America/Phoenix',
    'America/Los_Angeles','America/Anchorage','Pacific/Honolulu'
  ));

comment on column consultations.customer_timezone is '고객이 예약 링크에서 고른 표시 시간대(IANA, 지원 목록만). null이면 앱 기본값. Calendar 이벤트·안내 메일 표시에 모든 동기화 경로가 읽는다.';
