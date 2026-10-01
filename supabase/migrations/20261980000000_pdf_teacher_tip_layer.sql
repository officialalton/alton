-- PDF 교사용 팁 레이어 (2026-10-01)
--
-- 교재가 Drive PDF 고정 사본으로 바뀌어 옛 섹션 teaching_tip 칸을 쓸 수 없다. 관리자가 PDF 페이지
-- 위에 기존 필기 도구로 쓴 "교사용 팁"을 선생님에게만 보여준다.
--
-- 저장 기준은 (공개 버전, 페이지) — 수업과 무관하다. session_annotation_events 는 수업 귀속이라
-- 쓰지 않는다. 같은 이벤트 모양(stroke/clear_all, payload, eventId 중복 방지)을 따른다.
--
-- 권한: 쓰기는 관리자만(정의자 RPC, 테이블에는 쓰기 정책이 없다). 읽기는 관리자 + 그 버전을
-- 쓰는 수업의 담당 선생님. 학생·보호자·타 선생님·익명은 REST 로도 RPC 로도 읽지 못한다.
-- 이전 버전에서 가져온 팁은 페이지 단위 '검토 전' 상태로 들어와, 관리자가 확인하기 전에는 선생님
-- 읽기 대상에서 서버가 제외한다(바뀐 레이아웃에서 좌표 팁이 엉뚱한 곳에 뜨는 것 방지).

-- =========================================================================
-- 1. 이벤트 테이블 (append-only)
-- =========================================================================
create table if not exists public.pdf_tip_events (
  seq bigint generated always as identity primary key,
  curriculum_doc_version_id uuid not null references public.curriculum_doc_versions (id),
  page_number int not null check (page_number >= 1),
  event_type text not null check (event_type in ('stroke', 'clear_all')),
  payload jsonb not null,
  client_event_id uuid not null,
  author_id uuid not null references public.profiles (id),
  copied_from_version_id uuid references public.curriculum_doc_versions (id),
  created_at timestamptz not null default now(),
  unique (curriculum_doc_version_id, client_event_id)
);
create index if not exists pdf_tip_events_page_idx
  on public.pdf_tip_events (curriculum_doc_version_id, page_number, seq);

comment on table public.pdf_tip_events is
  '2026-10-01: PDF 교사용 팁 필기. (공개 버전, 페이지) 기준, append-only. 쓰기는 관리자 RPC 만.';

-- 버전 가져오기 기록 + 검토 필요 표시.
create table if not exists public.pdf_tip_page_copies (
  curriculum_doc_version_id uuid not null references public.curriculum_doc_versions (id),
  page_number int not null check (page_number >= 1),
  copied_from_version_id uuid not null references public.curriculum_doc_versions (id),
  copied_from_page int not null check (copied_from_page >= 1),
  needs_review boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (curriculum_doc_version_id, page_number)
);

comment on table public.pdf_tip_page_copies is
  '2026-10-01: 이전 버전에서 가져온 쪽 기록. 같은 원본에서 다시 가져오면 건너뛴다(멱등). '
  '가져온 쪽은 needs_review=true(검토 전)로 들어오고, 그동안 선생님에게 보이지 않는다. '
  '관리자가 확인(mark_*)하거나 그 쪽을 고치면(append) 확인 처리되어 공개된다.';

-- =========================================================================
-- 2. 읽기 권한 — 관리자, 또는 이 버전을 쓰는 수업의 담당 선생님
-- =========================================================================
create or replace function public.can_read_pdf_tips(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select public.is_admin()
    or exists (
      select 1
      from public.sessions s
      where s.teacher_id = auth.uid()
        and (
          -- 시작한 수업: 고정된 매니페스트의 버전
          exists (
            select 1 from public.session_content_manifest cm
            where cm.session_id = s.id
              and cm.content_type = 'material_doc'
              and cm.curriculum_doc_version_id = p_version_id
          )
          -- 시작 전 수업: 회차 구성이 들고 있는 버전(없으면 지금 공개본)
          or exists (
            select 1
            from public.session_curriculum_units scu
            join public.curriculum_overlay_unit_materials m on m.overlay_unit_id = scu.overlay_unit_id
            join public.curriculum_doc_versions v on v.id = p_version_id and v.curriculum_doc_id = m.curriculum_doc_id
            where scu.session_id = s.id
              and coalesce(m.curriculum_doc_version_id, public.current_curriculum_doc_version_id(m.curriculum_doc_id)) = p_version_id
          )
        )
    );
$$;

revoke all on function public.can_read_pdf_tips(uuid) from public, anon;
grant execute on function public.can_read_pdf_tips(uuid) to authenticated;

alter table public.pdf_tip_events enable row level security;
alter table public.pdf_tip_page_copies enable row level security;

-- 가져온 뒤 아직 확인하지 않은 쪽인가. 선생님은 가져오기 기록을 볼 수 없으므로(RLS) 정의자 함수로 본다.
create or replace function public.pdf_tip_page_pending_review(p_version_id uuid, p_page int)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select exists (
    select 1 from pdf_tip_page_copies c
    where c.curriculum_doc_version_id = p_version_id and c.page_number = p_page and c.needs_review
  );
$$;
revoke all on function public.pdf_tip_page_pending_review(uuid, int) from public, anon;
grant execute on function public.pdf_tip_page_pending_review(uuid, int) to authenticated;

create or replace function public.can_read_pdf_tip_page(p_version_id uuid, p_page int)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select public.is_admin()
    or (public.can_read_pdf_tips(p_version_id) and not public.pdf_tip_page_pending_review(p_version_id, p_page));
$$;
revoke all on function public.can_read_pdf_tip_page(uuid, int) from public, anon;
grant execute on function public.can_read_pdf_tip_page(uuid, int) to authenticated;

drop policy if exists "팁은 관리자와 담당 선생님만 조회" on public.pdf_tip_events;
create policy "팁은 관리자와 담당 선생님만 조회" on public.pdf_tip_events for select
  using (public.can_read_pdf_tip_page(curriculum_doc_version_id, page_number));

drop policy if exists "가져오기 기록은 관리자만 조회" on public.pdf_tip_page_copies;
create policy "가져오기 기록은 관리자만 조회" on public.pdf_tip_page_copies for select
  using (public.is_admin());

-- 쓰기 정책은 없다. 권한도 회수해 RLS 가 꺼져도 직접 쓰기가 안 되게 한다.
revoke all on public.pdf_tip_events from public, anon, authenticated;
revoke all on public.pdf_tip_page_copies from public, anon, authenticated;
grant select on public.pdf_tip_events to authenticated;
grant select on public.pdf_tip_page_copies to authenticated;

-- =========================================================================
-- 3. 공통 검사 — PDF 공개 버전과 페이지 범위
-- =========================================================================
create or replace function public.pdf_tip_page_count(p_version_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public as $$
declare
  v_snapshot jsonb;
begin
  select v.snapshot into v_snapshot from curriculum_doc_versions v where v.id = p_version_id;
  if v_snapshot is null then
    raise exception '공개 버전을 찾을 수 없습니다.';
  end if;
  if coalesce(v_snapshot->>'kind', 'html') <> 'pdf' then
    raise exception 'PDF 자료에만 팁을 남길 수 있습니다.';
  end if;
  return coalesce((v_snapshot->'asset'->>'pageCount')::int, 0);
end;
$$;
revoke all on function public.pdf_tip_page_count(uuid) from public, anon, authenticated;

-- 마지막 전체 지우기 이후에 남은 획이 있는가.
create or replace function public.pdf_tip_page_has_tips(p_version_id uuid, p_page int)
returns boolean
language sql
stable
security definer
set search_path = public as $$
  select exists (
    select 1 from pdf_tip_events e
    where e.curriculum_doc_version_id = p_version_id and e.page_number = p_page
      and e.event_type = 'stroke'
      and e.seq > coalesce((
        select max(c.seq) from pdf_tip_events c
        where c.curriculum_doc_version_id = p_version_id and c.page_number = p_page and c.event_type = 'clear_all'
      ), 0)
  );
$$;
revoke all on function public.pdf_tip_page_has_tips(uuid, int) from public, anon, authenticated;

-- =========================================================================
-- 4. 저장 (관리자 전용)
-- =========================================================================
create or replace function public.append_pdf_tip_events(
  p_version_id uuid,
  p_page_number int,
  p_segments jsonb
)
returns setof public.pdf_tip_events
language plpgsql
security definer
set search_path = public as $$
declare
  v_author uuid := auth.uid();
  v_page_count int;
  v_seg jsonb;
  v_type text;
  v_client_id uuid;
  v_row pdf_tip_events;
begin
  if v_author is null or not public.is_admin() then
    raise exception '팁은 관리자만 작성할 수 있습니다.';
  end if;
  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments는 비어있지 않은 jsonb 배열이어야 합니다.';
  end if;
  v_page_count := public.pdf_tip_page_count(p_version_id);
  if p_page_number is null or p_page_number < 1 or p_page_number > v_page_count then
    raise exception '페이지 %는 이 자료(%쪽)에 없습니다.', p_page_number, v_page_count;
  end if;

  for v_seg in
    select value from jsonb_array_elements(p_segments) with ordinality as t(value, ord) order by ord
  loop
    if v_seg->>'tool' = 'clear' then
      v_type := 'clear_all';
    else
      v_type := 'stroke';
      if not (v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1'
              and v_seg ? 'color' and v_seg ? 'tool') then
        raise exception 'stroke 세그먼트 payload에 필수 필드(x0,y0,x1,y1,color,tool)가 없습니다: %', v_seg;
      end if;
      if v_seg->>'tool' = 'text' and coalesce(btrim(v_seg->>'text'), '') = '' then
        raise exception '텍스트 필기에 글이 없습니다.';
      end if;
    end if;
    begin
      v_client_id := (v_seg->>'eventId')::uuid;
    exception when others then
      v_client_id := null;
    end;
    if v_client_id is null then
      raise exception '팁 세그먼트에는 eventId(uuid)가 필요합니다.';
    end if;

    v_row := null;
    insert into pdf_tip_events
      (curriculum_doc_version_id, page_number, event_type, payload, client_event_id, author_id)
    values
      (p_version_id, p_page_number, v_type, v_seg - 'eventId', v_client_id, v_author)
    on conflict (curriculum_doc_version_id, client_event_id) do nothing
    returning * into v_row;

    -- 같은 eventId 가 이미 있으면(재시도) 조용히 넘어간다.
    if v_row.seq is not null then
      return next v_row;
      -- 가져온 뒤 검토 전인 쪽을 관리자가 고쳤으면 그 쪽은 확인 처리(선생님에게 공개)한다.
      update pdf_tip_page_copies
      set needs_review = false, reviewed_at = now()
      where curriculum_doc_version_id = p_version_id and page_number = p_page_number and needs_review;
    end if;
  end loop;
  return;
end;
$$;
revoke all on function public.append_pdf_tip_events(uuid, int, jsonb) from public, anon;
grant execute on function public.append_pdf_tip_events(uuid, int, jsonb) to authenticated;

-- =========================================================================
-- 5. 이전 버전에서 팁 가져오기 — 쪽 매핑 (관리자 전용, 멱등, 트랜잭션)
-- =========================================================================
-- p_mapping: [{"from": 옛 쪽, "to": 새 쪽 | null}]. to 가 null 이면 건너뛴다. 같은 새 쪽을 두 번 가리키면
-- 아무것도 쓰기 전에 오류다. 옛 쪽에 남은 획이 없으면(팁 없음) 그 행은 무시한다.
-- 대상 쪽에 이미 팁이 있으면 p_overwrite=false 일 때 아무것도 바꾸지 않고 conflicts 만 돌려준다
-- (덮어쓰기 전 확인). 같은 (원본 버전·원본 쪽)에서 이미 가져온 쪽은 건너뛴다 — 그 뒤 관리자가 고친
-- 내용을 재실행이 되돌리지 않는다. 복사된 획의 eventId 는 (대상 쪽, 원본 쪽, 원본 eventId)로 정해져
-- 재실행해도 중복되지 않는다. 덮어쓰기는 지우기(clear_all)를 남기는 방식이라 append-only 를 지킨다.
-- 가져온 쪽은 모두 '검토 전'이라 관리자가 확인하기 전에는 선생님에게 보이지 않는다.
create or replace function public.copy_pdf_tips_mapped(
  p_from_version_id uuid,
  p_to_version_id uuid,
  p_mapping jsonb,
  p_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_author uuid := auth.uid();
  v_from_doc uuid;
  v_to_doc uuid;
  v_from_count int;
  v_to_count int;
  v_row record;
  v_conflicts int[] := '{}';
  v_copied int[] := '{}';
  v_skipped int[] := '{}';
  v_ev record;
  v_dup int;
begin
  if v_author is null or not public.is_admin() then
    raise exception '팁은 관리자만 가져올 수 있습니다.';
  end if;
  if p_from_version_id = p_to_version_id then
    raise exception '같은 버전에서는 가져올 수 없습니다.';
  end if;
  if jsonb_typeof(p_mapping) is distinct from 'array' then
    raise exception 'p_mapping은 jsonb 배열이어야 합니다.';
  end if;
  select curriculum_doc_id into v_from_doc from curriculum_doc_versions where id = p_from_version_id;
  select curriculum_doc_id into v_to_doc from curriculum_doc_versions where id = p_to_version_id;
  if v_from_doc is null or v_to_doc is null or v_from_doc <> v_to_doc then
    raise exception '같은 자료의 버전끼리만 가져올 수 있습니다.';
  end if;
  v_from_count := public.pdf_tip_page_count(p_from_version_id);
  v_to_count := public.pdf_tip_page_count(p_to_version_id);

  perform pg_advisory_xact_lock(hashtextextended(p_to_version_id::text, 91));

  if to_regclass('pg_temp._tip_map') is not null then
    drop table _tip_map;
  end if;
  create temp table _tip_map (from_page int not null, to_page int not null) on commit drop;
  insert into _tip_map (from_page, to_page)
  select (m->>'from')::int, (m->>'to')::int
  from jsonb_array_elements(p_mapping) m
  where m ? 'from' and m->>'to' is not null and jsonb_typeof(m->'to') = 'number';

  if exists (select 1 from _tip_map where from_page < 1 or from_page > v_from_count) then
    raise exception '옛 버전(%쪽)에 없는 쪽을 지정했습니다.', v_from_count;
  end if;
  if exists (select 1 from _tip_map where to_page < 1 or to_page > v_to_count) then
    raise exception '새 버전(%쪽)에 없는 쪽을 지정했습니다.', v_to_count;
  end if;
  select to_page into v_dup from _tip_map group by to_page having count(*) > 1 order by to_page limit 1;
  if v_dup is not null then
    raise exception '같은 대상 쪽(%쪽)으로 두 번 지정할 수 없습니다.', v_dup;
  end if;
  if exists (select 1 from (select from_page from _tip_map group by from_page having count(*) > 1) d) then
    raise exception '같은 옛 쪽을 두 번 지정할 수 없습니다.';
  end if;

  -- 1단계: 충돌 확인(아무것도 쓰지 않는다). 옛 쪽에 팁이 없는 행은 무시한다.
  for v_row in
    select t.from_page, t.to_page from _tip_map t
    where public.pdf_tip_page_has_tips(p_from_version_id, t.from_page)
    order by t.to_page
  loop
    if exists (
      select 1 from pdf_tip_page_copies c
      where c.curriculum_doc_version_id = p_to_version_id and c.page_number = v_row.to_page
        and c.copied_from_version_id = p_from_version_id and c.copied_from_page = v_row.from_page
    ) then
      v_skipped := v_skipped || v_row.to_page;
    elsif public.pdf_tip_page_has_tips(p_to_version_id, v_row.to_page) then
      v_conflicts := v_conflicts || v_row.to_page;
    end if;
  end loop;

  if array_length(v_conflicts, 1) is not null and not p_overwrite then
    return jsonb_build_object(
      'status', 'needs_confirmation',
      'copied', '[]'::jsonb,
      'skipped', to_jsonb(v_skipped),
      'conflicts', to_jsonb(v_conflicts),
      'pageCountChanged', v_from_count <> v_to_count,
      'fromPageCount', v_from_count,
      'toPageCount', v_to_count
    );
  end if;

  -- 2단계: 복사.
  for v_row in
    select t.from_page, t.to_page from _tip_map t
    where public.pdf_tip_page_has_tips(p_from_version_id, t.from_page)
    order by t.to_page
  loop
    if v_row.to_page = any (v_skipped) then
      continue;
    end if;

    if public.pdf_tip_page_has_tips(p_to_version_id, v_row.to_page) then
      insert into pdf_tip_events
        (curriculum_doc_version_id, page_number, event_type, payload, client_event_id, author_id, copied_from_version_id)
      values
        (p_to_version_id, v_row.to_page, 'clear_all',
         '{"x0":0,"y0":0,"x1":0,"y1":0,"color":"#000","tool":"clear"}'::jsonb,
         md5('clear:' || p_to_version_id::text || ':' || v_row.to_page::text || ':' || p_from_version_id::text || ':' || v_row.from_page::text)::uuid,
         v_author, p_from_version_id)
      on conflict (curriculum_doc_version_id, client_event_id) do nothing;
    end if;

    for v_ev in
      select e.payload, e.client_event_id
      from pdf_tip_events e
      where e.curriculum_doc_version_id = p_from_version_id and e.page_number = v_row.from_page
        and e.event_type = 'stroke'
        and e.seq > coalesce((
          select max(c.seq) from pdf_tip_events c
          where c.curriculum_doc_version_id = p_from_version_id and c.page_number = v_row.from_page and c.event_type = 'clear_all'
        ), 0)
      order by e.seq
    loop
      insert into pdf_tip_events
        (curriculum_doc_version_id, page_number, event_type, payload, client_event_id, author_id, copied_from_version_id)
      values
        (p_to_version_id, v_row.to_page, 'stroke', v_ev.payload,
         md5(p_to_version_id::text || ':' || v_row.to_page::text || ':' || p_from_version_id::text || ':' || v_row.from_page::text || ':' || v_ev.client_event_id::text)::uuid,
         v_author, p_from_version_id)
      on conflict (curriculum_doc_version_id, client_event_id) do nothing;
    end loop;

    insert into pdf_tip_page_copies
      (curriculum_doc_version_id, page_number, copied_from_version_id, copied_from_page, needs_review)
    values
      (p_to_version_id, v_row.to_page, p_from_version_id, v_row.from_page, true)
    on conflict (curriculum_doc_version_id, page_number) do update
      set copied_from_version_id = excluded.copied_from_version_id,
          copied_from_page = excluded.copied_from_page,
          needs_review = true,
          reviewed_at = null,
          created_at = now();

    v_copied := v_copied || v_row.to_page;
  end loop;

  return jsonb_build_object(
    'status', 'done',
    'copied', to_jsonb(v_copied),
    'skipped', to_jsonb(v_skipped),
    'conflicts', to_jsonb(v_conflicts),
    'pageCountChanged', v_from_count <> v_to_count,
    'fromPageCount', v_from_count,
    'toPageCount', v_to_count
  );
end;
$$;
revoke all on function public.copy_pdf_tips_mapped(uuid, uuid, jsonb, boolean) from public, anon;
grant execute on function public.copy_pdf_tips_mapped(uuid, uuid, jsonb, boolean) to authenticated;

-- 같은 쪽수 그대로 가져오는 기본 매핑 — 새 버전에 없는 쪽은 dropped 로 알린다.
create or replace function public.copy_pdf_tips_from_version(
  p_from_version_id uuid,
  p_to_version_id uuid,
  p_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_to_count int;
  v_mapping jsonb;
  v_dropped jsonb;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '팁은 관리자만 가져올 수 있습니다.';
  end if;
  v_to_count := public.pdf_tip_page_count(p_to_version_id);
  select coalesce(jsonb_agg(jsonb_build_object('from', p, 'to', p) order by p), '[]'::jsonb)
  into v_mapping
  from (
    select distinct e.page_number as p from pdf_tip_events e
    where e.curriculum_doc_version_id = p_from_version_id and e.page_number <= v_to_count
  ) t;
  select coalesce(jsonb_agg(p order by p), '[]'::jsonb)
  into v_dropped
  from (
    select distinct e.page_number as p from pdf_tip_events e
    where e.curriculum_doc_version_id = p_from_version_id and e.page_number > v_to_count
      and public.pdf_tip_page_has_tips(p_from_version_id, e.page_number)
  ) t;
  v_result := public.copy_pdf_tips_mapped(p_from_version_id, p_to_version_id, v_mapping, p_overwrite);
  return v_result || jsonb_build_object('dropped', v_dropped);
end;
$$;
revoke all on function public.copy_pdf_tips_from_version(uuid, uuid, boolean) from public, anon;
grant execute on function public.copy_pdf_tips_from_version(uuid, uuid, boolean) to authenticated;

-- 같은 버전 안에서 한 쪽의 팁을 다른 쪽으로 복사·이동한다(편집 화면). 대상 쪽에 이미 팁이 있으면
-- p_overwrite=false 일 때 확인을 요구한다. 관리자가 직접 고르는 작업이라 결과는 바로 공개(확인 처리)한다.
create or replace function public.copy_pdf_tip_page(
  p_version_id uuid,
  p_from_page int,
  p_to_page int,
  p_move boolean default false,
  p_overwrite boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public as $$
declare
  v_author uuid := auth.uid();
  v_count int;
  v_ev record;
  v_clear constant jsonb := '{"x0":0,"y0":0,"x1":0,"y1":0,"color":"#000","tool":"clear"}';
begin
  if v_author is null or not public.is_admin() then
    raise exception '팁은 관리자만 옮길 수 있습니다.';
  end if;
  v_count := public.pdf_tip_page_count(p_version_id);
  if p_from_page is null or p_to_page is null or p_from_page < 1 or p_to_page < 1
     or p_from_page > v_count or p_to_page > v_count then
    raise exception '이 자료(%쪽)에 없는 쪽을 지정했습니다.', v_count;
  end if;
  if p_from_page = p_to_page then
    raise exception '같은 쪽으로는 옮길 수 없습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_version_id::text, 91));

  if not public.pdf_tip_page_has_tips(p_version_id, p_from_page) then
    return jsonb_build_object('status', 'empty');
  end if;
  if public.pdf_tip_page_has_tips(p_version_id, p_to_page) then
    if not p_overwrite then
      return jsonb_build_object('status', 'needs_confirmation', 'conflicts', jsonb_build_array(p_to_page));
    end if;
    insert into pdf_tip_events (curriculum_doc_version_id, page_number, event_type, payload, client_event_id, author_id)
    values (p_version_id, p_to_page, 'clear_all', v_clear, gen_random_uuid(), v_author);
  end if;

  for v_ev in
    select e.payload from pdf_tip_events e
    where e.curriculum_doc_version_id = p_version_id and e.page_number = p_from_page and e.event_type = 'stroke'
      and e.seq > coalesce((
        select max(c.seq) from pdf_tip_events c
        where c.curriculum_doc_version_id = p_version_id and c.page_number = p_from_page and c.event_type = 'clear_all'
      ), 0)
    order by e.seq
  loop
    insert into pdf_tip_events (curriculum_doc_version_id, page_number, event_type, payload, client_event_id, author_id, copied_from_version_id)
    values (p_version_id, p_to_page, 'stroke', v_ev.payload, gen_random_uuid(), v_author, p_version_id);
  end loop;

  if p_move then
    insert into pdf_tip_events (curriculum_doc_version_id, page_number, event_type, payload, client_event_id, author_id)
    values (p_version_id, p_from_page, 'clear_all', v_clear, gen_random_uuid(), v_author);
  end if;

  -- 관리자가 직접 만든 쪽이라 검토 전 상태였다면 확인 처리한다(이동이면 원래 쪽도).
  update pdf_tip_page_copies set needs_review = false, reviewed_at = now()
  where curriculum_doc_version_id = p_version_id and needs_review
    and (page_number = p_to_page or (p_move and page_number = p_from_page));

  return jsonb_build_object('status', 'done', 'moved', p_move, 'from', p_from_page, 'to', p_to_page);
end;
$$;
revoke all on function public.copy_pdf_tip_page(uuid, int, int, boolean, boolean) from public, anon;
grant execute on function public.copy_pdf_tip_page(uuid, int, int, boolean, boolean) to authenticated;

-- 검토 완료 표시.
create or replace function public.mark_pdf_tip_page_reviewed(p_version_id uuid, p_page_number int)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '팁은 관리자만 검토 처리할 수 있습니다.';
  end if;
  update pdf_tip_page_copies
  set needs_review = false, reviewed_at = now()
  where curriculum_doc_version_id = p_version_id and page_number = p_page_number;
end;
$$;
revoke all on function public.mark_pdf_tip_page_reviewed(uuid, int) from public, anon;
grant execute on function public.mark_pdf_tip_page_reviewed(uuid, int) to authenticated;

-- 전체 확인 — 이 버전의 검토 전 쪽을 전부 공개한다. 확인한 쪽 수를 돌려준다.
create or replace function public.mark_pdf_tip_version_reviewed(p_version_id uuid)
returns int
language plpgsql
security definer
set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '팁은 관리자만 검토 처리할 수 있습니다.';
  end if;
  update pdf_tip_page_copies
  set needs_review = false, reviewed_at = now()
  where curriculum_doc_version_id = p_version_id and needs_review;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.mark_pdf_tip_version_reviewed(uuid) from public, anon;
grant execute on function public.mark_pdf_tip_version_reviewed(uuid) to authenticated;

-- 편집 화면용 검토 상태 — 검토 전 쪽 목록, 가져온 원본 버전과 두 버전의 쪽수(경고용).
create or replace function public.pdf_tip_review_state(p_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public as $$
declare
  v_from uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '팁은 관리자만 볼 수 있습니다.';
  end if;
  select c.copied_from_version_id into v_from
  from pdf_tip_page_copies c where c.curriculum_doc_version_id = p_version_id
  order by c.created_at desc limit 1;
  return jsonb_build_object(
    'pendingPages', coalesce((
      select jsonb_agg(c.page_number order by c.page_number)
      from pdf_tip_page_copies c where c.curriculum_doc_version_id = p_version_id and c.needs_review
    ), '[]'::jsonb),
    'tipPages', coalesce((
      select jsonb_agg(p order by p) from (
        select distinct e.page_number as p from pdf_tip_events e
        where e.curriculum_doc_version_id = p_version_id
          and public.pdf_tip_page_has_tips(p_version_id, e.page_number)
      ) t
    ), '[]'::jsonb),
    'copiedFromVersionId', v_from,
    'fromPageCount', case when v_from is null then null else public.pdf_tip_page_count(v_from) end,
    'toPageCount', public.pdf_tip_page_count(p_version_id)
  );
end;
$$;
revoke all on function public.pdf_tip_review_state(uuid) from public, anon;
grant execute on function public.pdf_tip_review_state(uuid) to authenticated;
