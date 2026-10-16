-- 배치 1-3 — bypass_trial_session_auto_complete GUC 제거, 결과 조건 재검증으로 교체
--
-- 배경(docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md §7,
-- 3차 개정): 유일 호출자·단일 캐스케이드(sessions AFTER UPDATE → trial_sessions
-- UPDATE 1회)라 토큰 인프라는 과설계다. 대신 "누가 호출했는가"가 아니라
-- "이 UPDATE를 정당화하는 조건이 지금 실제로 참인가"로 검사 축을 바꾼다:
--   (1) 연결된 sessions 행의 final_status가 실제로 'completed'인가(직접 재조회,
--       role/게이트 무관 — 관리자·service_role도 예외 없음).
--   (2) 이 UPDATE 문 자체가 completed_at을 동시에 non-null로 채우는가.
-- 둘 다 참이어야 통과 — 하나라도 거짓이면 거부. GUC(app.bypass_trial_session_auto_complete)
-- 참조를 완전히 제거한다.

create or replace function public.reject_direct_trial_session_completion()
returns trigger language plpgsql as $$
declare
  v_linked_final_status text;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if new.session_id is not null then
      select final_status into v_linked_final_status
      from sessions where id = new.session_id;
    end if;

    if v_linked_final_status is distinct from 'completed' then
      raise exception 'trial_sessions.status는 실제 v3 세션이 완료됐을 때만 completed가 됩니다 — 연결된 세션이 완료 상태가 아닙니다.'
        using errcode = 'P0001';
    end if;

    if new.completed_at is null then
      raise exception 'trial_sessions.status를 completed로 바꾸려면 같은 UPDATE에서 completed_at도 함께 채워야 합니다.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.reject_direct_trial_session_completion() is
  '(corrective, 3차 개정) app.bypass_trial_session_auto_complete GUC 분기를
  완전히 제거하고 결과 조건 재검증으로 교체 — status를 completed로 바꾸는
  모든 경로(캐스케이드든 직접 UPDATE든, 역할 무관)에서 (1) 연결된
  sessions.final_status가 실제로 completed이고 (2) 같은 UPDATE에서
  completed_at도 non-null로 함께 채워질 때만 통과한다.';

-- auto_complete_linked_trial_session(): 캐스케이드 트리거 자체는 이미 status와
-- completed_at을 같은 UPDATE 문에서 함께 채우고 있었다(20261125000000 원본
-- 그대로) — set_config()로 GUC를 켜고 끄던 부분만 제거한다. 새 트리거 조건은
-- 이 UPDATE가 만드는 상태(연결 세션 completed + completed_at non-null)를
-- 그대로 충족하므로 캐스케이드 정상 동작에는 영향이 없다.
create or replace function public.auto_complete_linked_trial_session()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.final_status = 'completed' and old.final_status is distinct from 'completed' then
    update trial_sessions
      set status = 'completed', completed_at = now()
      where session_id = new.id and status <> 'completed';
  end if;
  return new;
end;
$$;

comment on trigger sessions_auto_complete_linked_trial_session on sessions is
  '2026-09-06: 실제 v3 세션이 completed로 확정되면 연결된 trial_sessions(있다면)도
  자동으로 completed 처리한다 — 관리자의 "체험 결과 기록"은 이 자동 완료 이후에만
  허용된다(app 레이어에서 sessions.final_status를 재확인). (corrective, 3차 개정)
  app.bypass_trial_session_auto_complete GUC 없이도 통과한다 — status/completed_at을
  같은 UPDATE에서 함께 채우고, 연결 세션이 실제로 completed이기 때문에
  reject_direct_trial_session_completion()의 결과 조건 재검증을 그대로 만족한다.';
