-- Signed agreements are archived into one Drive subfolder per person; keep that folder id next to the file id.
alter table drive_artifacts add column drive_folder_id text;
alter table teacher_contracts add column drive_folder_id text;

-- Signed teacher records stay immutable except archive bookkeeping (now including the folder id) and the document reference.
create or replace function public.protect_signed_teacher_contract()
returns trigger language plpgsql as $$
declare
  v_mutable text[] := array['drive_sync_status', 'drive_file_id', 'drive_folder_id', 'drive_retry_count', 'drive_synced_at', 'drive_last_error', 'document_url'];
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
