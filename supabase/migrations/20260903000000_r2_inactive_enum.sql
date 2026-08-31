-- R2 Task 5 — merge_accounts()/anonymize_merged_account()가 방어적으로 확인할
-- 'inactive' 값을 teacher_status/parent_status에 추가한다. student_status는
-- 이미 R0 스키마에 'inactive'가 있다(R2 Task 2에서 레거시로 사용 중단 표시만
-- 했을 뿐 enum 값 자체는 남아있다).
--
-- 이 마이그레이션은 enum 값만 추가하며 상태 머신(transition_account_status()의
-- 허용 전이 목록, 로그인 게이트, reactivate_account())에는 연결하지 않는다 —
-- 실제 inactive 흐름 전체 구현(장기 복귀 정책, 보관 자동화, 스케줄러)은
-- master-roadmap-v3.md R12 인수 조건으로 이관돼 있다. 여기서는 오직
-- merge_accounts()/anonymize_merged_account()가 "이 계정은 inactive라 병합
-- 대상이 아니다"를 판정할 수 있도록 값만 미리 만들어둔다(ALTER TYPE ADD VALUE는
-- 같은 트랜잭션 내에서 바로 쓸 수 없어 사용하는 마이그레이션과 분리해야 한다).
alter type teacher_status add value if not exists 'inactive';
alter type parent_status add value if not exists 'inactive';
