-- M4(사용자 지시, 2026-09-05): 과목 수강 활성화(planned→active) 선행조건을
-- "기본계약 active"만으로 단순화한다. 기존(R5, 20260925000000)에는 결제완료
-- 수업권(entitlement_grants + purchases.status='succeeded') 보유도 함께
-- 요구했으나, 결제 없이는 예약(hold_entitlement)이 애초에 불가능해 이중
-- 게이트가 불필요하다는 판단(사용자 근거: "결제 완료 안 되면 예약을 못하잖아").
-- 이 변경으로 계약 서명 완료 시점에 바로(수업권 구매 전이라도) 자동 활성화가
-- 가능해진다.
create or replace function public.subject_enrollment_activation_ready(p_subject_enrollment_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from subject_enrollments se
      join contracts c on c.id = se.contract_id
      where se.id = p_subject_enrollment_id and c.status = 'active'
    );
$$;
comment on function public.subject_enrollment_activation_ready(uuid) is
  'M4: 정규 수강 활성화(planned→active)의 선행조건 — 이 아이의 contracts_v3가 active인지만
   본다(2026-09-05 단순화, 결제완료 수업권 조건 제거 — 예약 자체가 이미 결제완료 수업권을
   요구하므로 이중 게이트가 불필요했음).';
