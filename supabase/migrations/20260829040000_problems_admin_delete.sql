-- 052(교재 편집기): 관리자가 교재 섹션에 잘못 생성된 AI 문제를 제거할 수 있어야
-- 하는데, problems 테이블에 delete 정책이 아예 없었다(RLS 기본값=거부).
-- 관리자 전용으로 삭제 정책을 추가한다.

create policy "관리자 삭제" on problems for delete using (is_admin());
