-- P0(2026-09-10, 제품 오너 지적 2차) — 직접 계정 생성 다자녀 가구에서 계정
-- 생성 직후 곧바로 "보호자 동의" 화면에 3자녀 전원이 "동의 필요"로 뜬다.
--
-- 원인: is_under_13(p_student_id)는 date_of_birth가 null이면 fail-closed로
-- "13세 미만"으로 취급한다(20260904000000 주석: "학생인데 date_of_birth가
-- 없으면 fail-closed(13세 미만으로 취급 — 차단)"). 이 판정은 원래
-- current_account_access_allowed()의 로그인 차단 게이트용으로는 의도된
-- 보수적 동작이 맞다(불확실하면 막는다). 하지만 app/parent/consent-data.ts가
-- 같은 함수를 보호자 대시보드의 "동의 필요" 배지/카드 노출 조건으로도
-- 재사용하면서, 아직 한 번도 로그인해 생년월일을 입력하지 않은(=계정 생성
-- 직후인) 모든 자녀가 실제 나이와 무관하게 즉시 "동의 필요"로 표시된다 —
-- 매칭도, 로그인도 하지 않은 형제자매 전원에게 즉시 경고성 UI가 뜨는 원인이다.
--
-- 수정: 로그인 차단 게이트(is_under_13/current_account_access_allowed)는
-- 손대지 않는다(보안적으로 보수적인 게 맞음). 대신 "생년월일이 아직
-- 입력되지 않았다"를 별도로 판정할 수 있는 함수를 추가해, 보호자 화면이
-- "미성년 확정(생년월일 입력됨 + 13세 미만)"과 "아직 모름(생년월일 미입력)"을
-- 구분해 후자는 동의 카드/배지를 띄우지 않도록 한다(코드 수정은 별도).

create or replace function public.student_date_of_birth_known(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.date_of_birth is not null from profiles p where p.id = p_student_id and p.role = 'student'),
    false
  );
$$;
revoke execute on function public.student_date_of_birth_known(uuid) from public;
grant execute on function public.student_date_of_birth_known(uuid) to authenticated, anon;

comment on function public.student_date_of_birth_known(uuid) is
  '2026-09-10: is_under_13()과 달리 fail-closed하지 않는다 — 생년월일이 실제로 입력됐는지만 boolean으로 반환. 보호자 화면이 "미성년 확정" vs "아직 모름"을 구분해 후자에는 동의 요구 UI를 띄우지 않도록 하기 위함(is_under_13/current_account_access_allowed의 로그인 차단 게이트는 fail-closed로 그대로 유지).';
