-- M4: 20261023000000에서 subject_enrollment_activation_ready()를 "계약 active"
-- 단일 조건으로 단순화했지만, 이 트리거의 에러 메시지는 여전히 "결제완료
-- 수업권 부여가 먼저 필요합니다"라고 말해 실제 조건과 어긋나 있었다(고쳐야
-- 할 상황이 되면 관리자에게 틀린 이유를 보여줄 뻔함) — 메시지만 정정한다.
create or replace function public.enforce_subject_enrollment_activation_preconditions()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (old.status is null or old.status is distinct from 'active') then
    if not subject_enrollment_activation_ready(new.id) then
      raise exception '과목 수강(%)을 active로 전환하려면 기본계약이 먼저 active여야 합니다.', new.id;
    end if;
  end if;
  return new;
end;
$$;
