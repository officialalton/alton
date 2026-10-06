-- 승인이 기한 이후이거나 늦어 '기한 위험'이 되면 선생님에게 인앱 알림 기록(영문)을 자동으로 남긴다.
-- 묶음당 사유별 1건만(멱등) — 부분 유니크 인덱스 + on conflict do nothing. 이메일은 보내지 않는다(기록만).

create unique index if not exists payout_teacher_notices_late_once
  on public.payout_teacher_notices (batch_id, kind) where kind = 'payout_delayed_late';

-- 기준일에서 영업일 n개 뒤(주말·미국 연방 은행 휴일 제외)
create or replace function public.payout_business_day_plus(p_date date, p_n int)
returns date language plpgsql stable as $$
declare d date := p_date; i int := 0;
begin
  while i < p_n loop
    d := d + 1;
    if public.payout_is_business_day(d) then i := i + 1; end if;
  end loop;
  return d;
end;
$$;

create or replace function public.payout_refresh_deadline_risk(p_batch_id uuid)
returns boolean language plpgsql as $$
declare
  v_batch payout_batches%rowtype;
  v_risk boolean;
  v_expected date;
begin
  select * into v_batch from payout_batches where id = p_batch_id for update;
  if not found or v_batch.status <> 'approved' then return false; end if;
  v_risk := public.payout_deadline_at_risk(v_batch.scheduled_payout_date, now());
  if v_risk is distinct from v_batch.deadline_at_risk then
    update payout_batches set deadline_at_risk = v_risk, deadline_at_risk_at = case when v_risk then now() else null end where id = p_batch_id;
    if v_risk then
      insert into payout_batch_audit_log (batch_id, action, note)
      values (p_batch_id, 'deadline_at_risk',
              '지급 기한(' || v_batch.scheduled_payout_date::text || ') 위험 — 계획된 송금 요청일('
              || public.payout_transfer_request_date(v_batch.scheduled_payout_date)::text || ')을 지키기엔 승인이 늦었습니다. 가장 이른 송금 요청일: '
              || public.payout_earliest_request_date(now())::text);
    end if;
  end if;
  if v_risk then
    -- 예상 입금일 = 가장 이른 송금 요청일 + N영업일(기한보다 빠를 수는 없다).
    v_expected := greatest(
      public.payout_business_day_plus(public.payout_earliest_request_date(now()), public.payout_lead_business_days()),
      v_batch.scheduled_payout_date);
    insert into payout_teacher_notices (teacher_id, batch_id, kind, message)
    values (v_batch.teacher_id, p_batch_id, 'payout_delayed_late',
            'Your payout for ' || to_char(v_batch.period_start, 'Mon FMDD') || '–' || to_char(v_batch.period_end, 'Mon FMDD, YYYY')
            || ' is delayed. It is now expected to arrive by ' || to_char(v_expected, 'Mon FMDD, YYYY')
            || ' (original deadline: ' || to_char(v_batch.scheduled_payout_date, 'Mon FMDD, YYYY') || ').')
    on conflict (batch_id, kind) where kind = 'payout_delayed_late' do nothing;
  end if;
  return v_risk;
end;
$$;
revoke execute on function public.payout_refresh_deadline_risk(uuid) from public, anon, authenticated;
