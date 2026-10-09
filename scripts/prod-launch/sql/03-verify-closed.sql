-- 읽기 전용: DB 측 "실제 사람·돈에 작용하는" 스위치가 전부 닫혔는지 한 화면에 출력. 하나라도 f 가 아닌 true 면 중단하고 보고.
select 'contract_dispatch_settings.auto_dispatch_enabled' as switch, (select auto_dispatch_enabled from public.contract_dispatch_settings limit 1) as value, 'expect false' as expected
union all select 'payout_auto_dispatch_settings.enabled', (select enabled from public.payout_auto_dispatch_settings limit 1), 'expect false'
union all select 'payout_disbursement_gate.real_disbursement_enabled', (select real_disbursement_enabled from public.payout_disbursement_gate limit 1), 'expect false'
union all select 'consultant_assignment_settings.auto_assign_enabled', (select auto_assign_enabled from public.consultant_assignment_settings limit 1), 'expect false';
-- 신규 DB 에 사용자·계약·결제 데이터가 없는지(콘텐츠 복사 전 기준선)
select (select count(*) from auth.users) as auth_users, (select count(*) from public.profiles) as profiles,
       (select count(*) from public.payout_batches) as payout_batches, (select count(*) from public.contract_dispatch_jobs) as contract_jobs;
