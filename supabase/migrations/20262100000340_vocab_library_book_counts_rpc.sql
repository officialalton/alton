-- 2026-10-08 학생 포털 단어장 속도 — 권별 단어 수를 권 수만큼의 head count 쿼리(N+1) 대신 한 번에 센다.
-- security invoker: 기존 "로그인 사용자 전체 조회" RLS 를 그대로 따른다(새 노출 없음).
create or replace function public.vocab_library_book_word_counts()
returns table (book_id uuid, word_count bigint)
language sql
stable
security invoker
set search_path = public as $$
  select w.book_id, count(*)::bigint from vocab_library_words w group by w.book_id;
$$;
revoke all on function public.vocab_library_book_word_counts() from public, anon;
grant execute on function public.vocab_library_book_word_counts() to authenticated;
