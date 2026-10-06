-- Teacher agreement archiving also stores the DocuSign Certificate of Completion; keep its Drive file id.
alter table teacher_contracts add column drive_certificate_file_id text;

create or replace function public.protect_signed_teacher_contract()
returns trigger language plpgsql as $$
declare
  v_mutable text[] := array['drive_sync_status', 'drive_file_id', 'drive_folder_id', 'drive_certificate_file_id', 'drive_retry_count', 'drive_synced_at', 'drive_last_error', 'document_url'];
  v_old jsonb;
  v_new jsonb;
  k text;
begin
  if tg_op = 'DELETE' then
    if old.status = 'signed' then raise exception '서명 완료된 선생님 계약 기록은 삭제할 수 없습니다.'; end if;
    return old;
  end if;
  if old.status = 'signed' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    foreach k in array v_mutable loop
      v_old := v_old - k;
      v_new := v_new - k;
    end loop;
    if v_old is distinct from v_new then
      raise exception '서명 완료된 선생님 계약 기록은 수정할 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;
