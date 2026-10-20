-- AP 신규 과목(2026-10-20): FRQ 종이(하이브리드) 과목 목록에 Physics 2·Physics C(Mechanics, E&M)·Precalculus 추가.
-- 목록은 lib/ap-exam/frq-delivery.ts 와 같다(frq-handwriting.integration.test.ts 가 일치를 검사). 나머지 신규 과목은 완전 디지털이라 false.
-- 재실행 안전: create or replace(어느 시점 버전이 적용돼 있어도 같은 결과). 되돌리기: 20262100000570 의 7과목 정의로 create or replace.
create or replace function public._ap_frq_paper_subject(p_subject text) returns boolean
language sql immutable as $$
  select p_subject in ('ap_calculus_ab', 'ap_calculus_bc', 'ap_physics_1', 'ap_biology', 'ap_chemistry', 'ap_microeconomics', 'ap_macroeconomics',
                       'ap_physics_2', 'ap_physics_c_mechanics', 'ap_physics_c_electricity_and_magnetism', 'ap_precalculus')
$$;
