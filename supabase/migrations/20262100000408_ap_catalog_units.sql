-- AP 세트의 목록·시작 화면에 "Covers Units 4, 5, 6, 8" 을 보이려고 공개 카탈로그에 세트가 다루는 단원(apUnits)을 싣는다.
-- 단원 = 세트 문항의 sat_domain('ap:<키워드 코드>', 예 'ap:4.3' → 단원 4) 의 앞자리. 정답·해설과 무관한 공개 메타라 학생에게 열어도 된다.
-- 되돌리기: 20262100000401 의 mock_exam_open_catalog 정의로 create or replace.
create or replace function public.mock_exam_open_catalog(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  v := _mock_exam_open_catalog_v1(p_student_id);
  return coalesce((
    select jsonb_agg(t.row || jsonb_build_object(
        'examProgram', s.exam_program, 'apSubject', s.ap_subject, 'apLabel', s.ap_label,
        'accessTier', s.access_tier,
        'apSections', case when s.exam_program = 'ap' then s.section_layout->'sections' else null end,
        'apUnits', case when s.exam_program = 'ap' then (
            select coalesce(jsonb_agg(u order by u::int), '[]'::jsonb) from (
              select distinct split_part(regexp_replace(i.sat_domain, '^ap:', ''), '.', 1) as u
              from mock_exam_set_items i where i.exam_set_id = s.id and i.sat_domain ~ '^ap:[0-9]+\.') x) else null end)
      order by t.ord)
    from jsonb_array_elements(coalesce(v, '[]'::jsonb)) with ordinality as t(row, ord)
    left join mock_exam_sets s on s.id = (t.row->>'examSetId')::uuid
  ), '[]'::jsonb);
end $$;
