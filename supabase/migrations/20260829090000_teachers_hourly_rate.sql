-- 086(정산): 선생님별 시급(원). 정산 금액 = hourly_rate_krw * 완료 세션 시간(분)/60.
-- 기존에 이미 초대된 선생님은 NULL로 남고, 관리자가 TeacherDetailPanel에서 나중에 채운다.
-- 이제부터 새로 초대되는 선생님은 초대 폼에서 필수 입력이라 NULL이 생기지 않는다.
alter table teachers add column hourly_rate_krw int;
