-- 072(DocuSign): contracts에 created_at이 없어 "발송된 계약" 목록을 시간순으로 정렬할 수 없었음
-- (id는 gen_random_uuid()라 정렬 기준으로 쓸 수 없음). 최신 발송 순으로 보여주기 위해 추가.
alter table contracts add column created_at timestamptz not null default now();
