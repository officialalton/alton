-- P2 — 교재는 조각이 아니라 교재 전체 단위로 다룬다.
--
-- 지금 수업에 담기는 교재는 섹션 하나(material_section)다. 회차 교재 구성은
-- 이미 교재 단위인데(curriculum_overlay_unit_materials) 수업으로 넘어가는 순간
-- 조각으로 쪼개지니, 같은 것을 두 층에서 다르게 센다.
--
-- **기존 기록은 바꾸지 않는다.** enum에 값을 더하고 과거 material_section 행은
-- 그대로 읽는다. 과거 수업이 무엇을 보여줬는지는 그때의 사실이고, 지금 정책이
-- 바뀌었다고 소급해 고칠 값이 아니다.
alter type session_prepared_selection_content_type add value if not exists 'material_doc';
