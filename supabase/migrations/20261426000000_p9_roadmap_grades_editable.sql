-- P9 로드맵 V1 — 학년/학교/GPA를 로드맵 프로필 화면에서 직접 수정 가능하게(2026-09-19 제품 오너 지시).
--
-- 배경: RoadmapView는 지금까지 students.grade/school_name/gpa를 읽기 전용으로만 보여주고
-- "계정 설정 화면에서 수정"이라고 안내했는데, 실제로는 그런 화면이 없다(단 한 번만 쓰는
-- complete_student_profile() RPC만 있고, 이건 auth.uid() 본인(학생)만 호출 가능해 보호자·
-- 관리자가 로드맵 화면에서 대신 쓸 수 없다). 로드맵의 다른 모든 섹션과 같은 다중 주체
-- 쓰기 모델(_roadmap_can_write: 학생 본인/보호자/관리자)로 통일한다.
--
-- 추가: CollegeVine Grades 탭과 동등하게 학급 등수·학급 인원(선택)도 추가한다.

alter table students
  add column if not exists class_rank integer check (class_rank is null or class_rank > 0),
  add column if not exists class_size integer check (class_size is null or class_size > 0);
comment on column students.class_rank is 'P9 로드맵 V1 확장(2026-09-19): CollegeVine Grades 탭 동등 항목, 선택 입력.';
comment on column students.class_size is 'P9 로드맵 V1 확장(2026-09-19): class_rank와 짝. 선택 입력.';

create or replace function public.roadmap_save_grades(
  p_student_id uuid,
  p_grade text,
  p_school_name text,
  p_gpa numeric,
  p_gpa_scale text,
  p_class_rank integer,
  p_class_size integer
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _roadmap_can_write(p_student_id) then
    raise exception '권한이 없습니다.';
  end if;
  if p_gpa is not null and p_gpa_scale is null then
    raise exception 'GPA를 입력하려면 GPA 척도를 함께 선택해야 합니다.';
  end if;
  if p_gpa is not null and p_gpa_scale is not null and p_gpa > p_gpa_scale::numeric then
    raise exception 'GPA 값(%)이 선택한 척도(%)를 초과할 수 없습니다.', p_gpa, p_gpa_scale;
  end if;
  if p_gpa_scale is not null and p_gpa_scale not in ('4.0', '4.3', '4.5', '5.0') then
    raise exception '허용되지 않는 GPA 척도입니다: %', p_gpa_scale;
  end if;

  update students
  set grade = p_grade,
      school_name = p_school_name,
      gpa = p_gpa,
      gpa_scale = p_gpa_scale,
      class_rank = p_class_rank,
      class_size = p_class_size
  where id = p_student_id;
end;
$$;
comment on function public.roadmap_save_grades is
  'P9 로드맵 V1 확장(2026-09-19): 로드맵 프로필 화면에서 학년/학교/GPA/등수를 학생 본인·보호자·관리자가 직접 수정. _roadmap_can_write와 동일한 권한 모델.';

revoke all on function public.roadmap_save_grades(uuid, text, text, numeric, text, integer, integer) from public;
grant execute on function public.roadmap_save_grades(uuid, text, text, numeric, text, integer, integer) to authenticated;
