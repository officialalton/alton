-- 2026-09-21(사용자 지시) — 수업 세션뷰의 단어 클릭 저장 기능을 "특정 폴더(없으면 생성)"까지
-- 고를 수 있게 부활시킨다. vocab_word_folders는 "본인 학생 쓰기"만 허용해(교사 insert 정책 없음)
-- 선생님이 학생 화면에서 단어를 저장할 때 새 폴더를 만들 수 없었다 — ensure_default_vocab_folder()와
-- 같은 패턴(본인 또는 담당 선생님)의 RPC로 우회한다.

create or replace function public.create_named_vocab_folder(p_student_id uuid, p_name text)
returns vocab_word_folders
language plpgsql security definer set search_path = public as $$
declare v_row vocab_word_folders%rowtype; v_name text;
begin
  if not (p_student_id = auth.uid() or teaches_student(p_student_id) or is_admin()) then
    raise exception '본인 또는 담당 학생만 폴더를 만들 수 있습니다.';
  end if;
  v_name := trim(p_name);
  if v_name = '' then raise exception '폴더 이름을 입력하세요.'; end if;

  select * into v_row from vocab_word_folders where student_id = p_student_id and name = v_name;
  if v_row.id is not null then
    return v_row;
  end if;

  insert into vocab_word_folders (student_id, name, position)
  values (p_student_id, v_name, coalesce((select max(position) + 1 from vocab_word_folders where student_id = p_student_id), 0))
  returning * into v_row;
  return v_row;
end $$;
