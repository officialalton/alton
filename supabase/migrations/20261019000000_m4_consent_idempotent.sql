-- M4 후속 버그 수정(실사용 발견) — consent_as_guardian()에 중복 방지가 없어서
-- 같은 학생에게 활성(미철회) 동의가 이미 있어도 계속 새 행을 insert할 수 있었다.
-- 화면에서 이중 클릭/재요청이 일어나면 활성 동의가 2개 이상 쌓이는데,
-- revoke_guardian_consent()는 넘어온 consent_id 하나만 철회하므로 최신 건을
-- 철회해도 더 오래된 활성 동의가 남아 has_valid_guardian_consent()가 계속
-- true를 반환한다("철회 버튼을 눌러도 그대로"). 학생당 활성 동의는 항상
-- 최대 1건이어야 하므로, 이미 활성 동의가 있으면 새로 insert하지 않고 그
-- id를 그대로 반환하도록 멱등하게 바꾼다(같은 정책이든 다른 정책이든 —
-- 정책이 바뀌면 관리자/보호자가 먼저 기존 동의를 철회하고 다시 동의해야 함).

create or replace function public.consent_as_guardian(p_student_id uuid, p_policy_version_id uuid, p_notice_delivered_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_existing_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if auth.uid() = p_student_id then
    raise exception '학생 본인은 동의할 수 없습니다.';
  end if;
  if not exists (
    select 1 from household_members hm
    join household_members child
      on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = p_student_id
    where hm.role = 'guardian' and hm.profile_id = auth.uid()
  ) then
    raise exception '해당 학생의 보호자만 동의할 수 있습니다.';
  end if;
  if not exists (select 1 from consent_policy_versions where id = p_policy_version_id and retired_at is null) then
    raise exception '유효하지 않은 정책 버전입니다.';
  end if;

  select id into v_existing_id
  from guardian_consents
  where student_id = p_student_id and policy_version_id = p_policy_version_id and revoked_at is null
  limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into guardian_consents (
    student_id, policy_version_id, consented_by, verification_method, notice_delivered_at
  ) values (
    p_student_id, p_policy_version_id, auth.uid(), 'household_guardian_session', p_notice_delivered_at
  )
  returning id into v_id;

  return v_id;
end;
$function$;
