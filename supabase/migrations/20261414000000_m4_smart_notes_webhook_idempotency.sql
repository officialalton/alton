-- 2026-09-18(제품 오너 피드백) — 순차 재전송(같은 pubsub_message_id를 시간차를
-- 두고 다시 보냄)에 대한 멱등성은 upsert onConflict로 확인했지만, "동시(concurrent)"
-- 배달 경합에는 안전하지 않았다: route.ts가 "select existing → (없으면) 처리 →
-- upsert" 순서였는데, 두 요청이 거의 동시에 도착하면 둘 다 select에서 "기존 행
-- 없음"을 보고 그대로 진행해 select-then-act 경쟁 조건이 남는다(upsert 자체는
-- 나중에 막아주지만, 그 사이에 이미 session_drive_tasks insert 같은 부수효과가
-- 두 번 실행될 수 있었다).
--
-- 원자적 INSERT ... ON CONFLICT DO NOTHING RETURNING으로 "클레임"하는 SECURITY
-- DEFINER 함수로 교체한다 — 이 두 함수가 route.ts와 통합 테스트 양쪽이 호출하는
-- 단일 진실 소스다(테스트가 SQL을 별도로 베껴 쓰면 드리프트한다는 지적 반영,
-- route.ts도 이 함수를 실제로 호출하도록 고친다).

-- =========================================================================
-- 1. smart_notes_generation_events 클레임 — pubsub_message_id 유니크 인덱스는
--    이미 있다(20261009000000, partial: where pubsub_message_id is not null).
--    이 함수는 그 인덱스에 기대 INSERT ... ON CONFLICT DO NOTHING RETURNING id로
--    "이 메시지를 내가 처음 처리하는지"를 원자적으로 확정한다. 반환값이 null이면
--    이미 다른 요청(또는 이전 배달)이 먼저 처리했다는 뜻 — 호출부는 이후 Smart
--    Notes/Drive 관련 작업을 전부 건너뛰어야 한다. pubsub_message_id가 null이면
--    (이론상만 가능, 실제 Pub/Sub는 항상 채움) 멱등성을 판단할 수 없으므로 매번
--    새 행을 만든다(partial index 조건 자체가 null에는 적용되지 않아 항상 삽입됨).
create or replace function public.claim_smart_notes_generation_event(
  p_pubsub_message_id text,
  p_session_id uuid,
  p_consultation_id uuid,
  p_google_meeting_code text,
  p_google_conference_record_name text,
  p_drive_file_id text,
  p_event_type text,
  p_linked boolean,
  p_raw_payload jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into smart_notes_generation_events (
    session_id, consultation_id, google_meeting_code, google_conference_record_name,
    drive_file_id, event_type, linked, raw_payload, pubsub_message_id
  )
  values (
    p_session_id, p_consultation_id, p_google_meeting_code, p_google_conference_record_name,
    p_drive_file_id, p_event_type, p_linked, coalesce(p_raw_payload, '{}'::jsonb), p_pubsub_message_id
  )
  on conflict (pubsub_message_id) where pubsub_message_id is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.claim_smart_notes_generation_event(text, uuid, uuid, text, text, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.claim_smart_notes_generation_event(text, uuid, uuid, text, text, text, text, boolean, jsonb) to service_role;

-- =========================================================================
-- 2. session_drive_tasks(smart_notes_reader_grant) 중복 방지 — "동일 세션·동일
--    원본(drive_file_id)·동일 권한 부여 대상(studentEmail)·동일 작업 유형"의
--    작업이 아직 처리 중(queued/processing/retryable_failed)인 동안에는 중복
--    생성이 불가능해야 한다. 다만 이미 끝난(succeeded) 작업이나 사람이 봐야
--    하는(manual_review/reconciliation_needed) 작업 이후에 나중에 정말로 다시
--    권한을 부여해야 하는 정당한 사유(예: 권한 회수 후 재부여)까지 막으면 안
--    되므로, 유니크 인덱스를 "아직 끝나지 않은 작업"에만 걸리는 partial index로
--    한정한다 — 이후 재권한 부여를 막지 않는다.
create unique index if not exists session_drive_tasks_smart_notes_reader_grant_active_uq
  on session_drive_tasks (session_id, (payload->>'fileId'), (payload->>'studentEmail'))
  where task_type = 'smart_notes_reader_grant' and status in ('queued', 'processing', 'retryable_failed');

create or replace function public.enqueue_smart_notes_reader_grant_task(
  p_session_id uuid,
  p_drive_file_id text,
  p_student_email text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into session_drive_tasks (session_id, task_type, payload)
  values (p_session_id, 'smart_notes_reader_grant', jsonb_build_object('fileId', p_drive_file_id, 'studentEmail', p_student_email))
  on conflict (session_id, (payload->>'fileId'), (payload->>'studentEmail'))
    where task_type = 'smart_notes_reader_grant' and status in ('queued', 'processing', 'retryable_failed')
  do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.enqueue_smart_notes_reader_grant_task(uuid, text, text) from public, anon, authenticated;
grant execute on function public.enqueue_smart_notes_reader_grant_task(uuid, text, text) to service_role;
