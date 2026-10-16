-- 2026-09-15 제품 오너 — 과목별 전체 교재 보기: 읽던 위치 저장(사용자별).
--   HTML 교재는 마지막으로 보던 섹션을, PDF/영상은 이번 라운드 범위 밖(뷰어 쪽 페이지 추적을
--   따로 손대지 않는다 — docs/2026-09-15-subject-material-library.md 참고).
-- 편집 권한과 무관한 개인 열람 상태라 본인만 읽고 쓴다(관리자도 접근하지 않는다).

create table material_reading_positions (
  user_id uuid not null references profiles (id) on delete cascade,
  curriculum_doc_id uuid not null references curriculum_docs (id) on delete cascade,
  section_id uuid references curriculum_doc_sections (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (user_id, curriculum_doc_id)
);
create index on material_reading_positions (curriculum_doc_id);

comment on table material_reading_positions is
  '2026-09-15: 과목 전체 교재 보기에서 사용자가 마지막으로 읽던 섹션(HTML 교재만). 본인 것만 조회·저장한다.';

alter table material_reading_positions enable row level security;

create policy "본인 읽던 위치 조회" on material_reading_positions
  for select using (user_id = auth.uid());
create policy "본인 읽던 위치 저장" on material_reading_positions
  for insert with check (user_id = auth.uid());
create policy "본인 읽던 위치 갱신" on material_reading_positions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "본인 읽던 위치 삭제" on material_reading_positions
  for delete using (user_id = auth.uid());

-- 저장 시 section_id가 실제로 그 교재 소속인지 클라이언트를 믿지 않고 서버에서 확인한다.
create or replace function public.save_material_reading_position(p_doc_id uuid, p_section_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_section_id is not null and not exists (
    select 1 from curriculum_doc_sections where id = p_section_id and curriculum_doc_id = p_doc_id
  ) then
    raise exception '그 섹션은 이 교재 소속이 아닙니다.';
  end if;
  insert into material_reading_positions (user_id, curriculum_doc_id, section_id, updated_at)
  values (auth.uid(), p_doc_id, p_section_id, now())
  on conflict (user_id, curriculum_doc_id)
  do update set section_id = excluded.section_id, updated_at = excluded.updated_at;
end; $$;
revoke execute on function public.save_material_reading_position(uuid, uuid) from public, anon;
grant execute on function public.save_material_reading_position(uuid, uuid) to authenticated;
