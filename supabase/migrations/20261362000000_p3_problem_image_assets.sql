-- 2026-09-14 문제 템플릿 ④ — 문제 그림 파일(PNG/JPG/SVG) 첨부. 기출 도형·교사가 그린 그림처럼 데이터로 못 그리는 것.
-- 비공개 버킷 + 서명 URL. 참조는 problem_versions.figure = {type:'image', bucket, path, alt}.
insert into storage.buckets (id, name, public)
values ('problem-assets', 'problem-assets', false)
on conflict (id) do nothing;

create policy "관리자만 문제 그림 직접 조회" on storage.objects for select
  using (bucket_id = 'problem-assets' and is_admin());
-- 업로드·삭제는 service_role(서버 액션)만. 학생·교사는 서명 URL 로 본다(문제 버전을 읽을 수 있을 때만 발급).
