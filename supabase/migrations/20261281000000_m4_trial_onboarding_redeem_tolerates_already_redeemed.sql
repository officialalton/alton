-- 2026-09-11(제품 오너 재검토, 실제 브라우저 E2E로 재현) — claim/lease
-- 기반 재사용 처리(20261279000000/20261280000000)를 lib/trial-onboarding-finalize.ts
-- 안에 구현했지만, app/api/trial-onboarding/confirm-email/route.ts가 그 함수를
-- 호출하기 전에 자기 자신의 redeem_trial_onboarding_link() 호출로 먼저
-- 막고 있었다 — 이 함수는 status='redeemed'면 무조건 예외를 던지므로,
-- 이미 성공적으로 완료된 링크를 다시 열면 claim 로직에 도달하기도 전에
-- "이미 사용된 온보딩 링크입니다"(route.ts에서 "유효하지 않거나 만료된..."로
-- 뭉뚱그려짐) 예외로 끝나버렸다 — 이번 라운드에서 고쳤다고 보고했던 증상이
-- 실제 브라우저로는 재현됐다(공유 non-prod, 실행 ID onboarding-e2e-20260911).
--
-- redeemed 상태는 더 이상 이 함수의 실패 조건이 아니다 — 실제 게이트는
-- createGuardianAndStudentThenRedirect() 안의 claim_trial_onboarding_link_finalize()가
-- 담당한다(이미 redeemed면 그쪽에서 "already_redeemed"로 계정 재사용/로그인
-- 안내를 처리). revoked·expired는 여전히 진짜 실패로 막는다(재발급 없이는
-- 진행할 수 없는 상태이므로).
create or replace function public.redeem_trial_onboarding_link(p_token text)
returns table (link_id uuid, consultation_id uuid, guardian_email text, guardian_name text, student_name text, student_email text, student_grade text)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_token_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  select * into v_row from trial_onboarding_links where token_hash = v_token_hash for update;
  if not found then
    raise exception '유효하지 않은 온보딩 링크입니다.';
  end if;
  if v_row.status = 'revoked' then
    raise exception '취소된 온보딩 링크입니다.';
  end if;
  if v_row.status = 'pending' and v_row.expires_at <= now() then
    update trial_onboarding_links set status = 'expired' where id = v_row.id;
    raise exception '만료된 온보딩 링크입니다.';
  end if;
  -- status가 'redeemed'여도(=이미 성공적으로 완료된 링크를 다시 여는 경우)
  -- 여기서는 막지 않는다 — 아래에서 그대로 데이터를 돌려주고, 실제 재사용
  -- 가능 여부 판정은 claim_trial_onboarding_link_finalize()에 맡긴다.

  return query select v_row.id, v_row.consultation_id, v_row.guardian_email, v_row.guardian_name,
    v_row.student_name, v_row.student_email, v_row.student_grade;
end;
$$;
comment on function public.redeem_trial_onboarding_link(text) is
  '온보딩 링크 토큰 검증 — revoked/expired/invalid만 진짜 실패로 막는다.
   redeemed(이미 완료)는 실패가 아니다 — 그 판정과 계정 재사용/재시도 처리는
   claim_trial_onboarding_link_finalize()·createGuardianAndStudentThenRedirect()가
   전담한다(2026-09-11, 실제 브라우저 재현으로 발견해 수정).';
