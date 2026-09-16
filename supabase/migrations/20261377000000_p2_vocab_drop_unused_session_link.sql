-- 2026-09-15 제품 오너 정정 — "세션뷰는 연결된 단어만 보여주는 게 아니라, 학생 단어장을
-- 그대로 보여주고 교사가 거기서 '시험보기'를 선택하게 하자"는 것이었다(20261376의
-- vocab_session_links/link_vocab_words_to_session 은 "일부만 골라 연결" 해석으로 잘못
-- 구현한 것 — 아직 로컬에만 적용돼 있고 공유 non-prod에는 올라간 적이 없어 그냥 지운다).
drop function if exists public.link_vocab_words_to_session(uuid, uuid, uuid[], uuid[]);
drop table if exists vocab_session_links;
