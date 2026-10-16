-- 2026-09-16(제품 오너 지시) — 수업 리뷰를 5단계 버튼 평가 중심으로 재구성한다. 카테고리별로
-- 텍스트를 매번 쓰는 대신 클릭 한 번으로 평가를 남길 수 있게 rating을 추가(영어 5단계:
-- below/partial/average/excellent/outstanding). 텍스트는 선택으로 남긴다(final_text 그대로 유지,
-- not null 아니었으므로 이미 선택 항목).
set row_security = off;

alter table session_review_categories
  add column rating text check (rating in ('below', 'partial', 'average', 'excellent', 'outstanding'));
