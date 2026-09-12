-- R6 레거시 제거 — Calendly 기반 개별 회차 예약 컬럼 삭제(master-roadmap-v3.md "R6 레거시
-- 제거" 체크리스트, 실제 Google Sandbox 검증 통과 후 실행). ALTON은 아직 운영을 시작하지
-- 않았고 기존 예약·Calendly 링크 데이터는 개발·테스트 데이터이므로 이관 없이 그대로 삭제
-- 한다(product-architecture-v3.md §4.13). 상담(consult_requests) 예약은 이번 제거 범위가
-- 아니다 — 상담은 애초에 Calendly 없이도 ConsultForm/submitConsultRequest로 독립적으로
-- 동작해왔으므로 그 컬럼은 별도로 남긴다(scope 오인 방지를 위한 명시적 결정).

alter table teachers drop column if exists calendly_scheduling_url;
alter table legacy_sessions drop column if exists calendly_event_uri;
