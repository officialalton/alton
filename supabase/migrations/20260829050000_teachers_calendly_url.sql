-- 개별 회차 예약(학생↔담당 선생님)을 Calendly로 처리하기 위해, 선생님별
-- 개인 예약 링크(Calendly 팀원 개별 이벤트 타입의 scheduling_url)를 저장한다.
-- 관리자가 054(사용자 관리) 화면에서 설정한다.

alter table teachers add column calendly_scheduling_url text;
