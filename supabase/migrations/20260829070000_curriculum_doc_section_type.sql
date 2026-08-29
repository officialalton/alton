-- 교재 문서 편집기 업그레이드: 섹션을 "개념 설명"과 "문제 생성"으로 구분하고,
-- 관리자가 교재 문서 자체를 삭제할 수 있게 한다.

alter table curriculum_doc_sections
  add column section_type text not null default 'concept'
    check (section_type in ('concept', 'problem'));

create policy "관리자 삭제" on curriculum_docs for delete using (is_admin());
