-- R2 — Task 2 (1/2): 공통 계정 수명주기 enum 확장
-- (product-architecture-v3.md §5.7 확정: pending → active → suspended(복구 가능)
-- → closure_pending → closed(복구 불가, 인증 차단·보존기간 후 삭제/익명화))
--
-- 호환·전환 전략: 기존 teacher_status/student_status enum 타입을 새로 만들지
-- 않고 값만 추가한다(ALTER TYPE ... ADD VALUE). 이유:
--   1. 이미 여러 RLS 정책·서버 액션이 이 타입 이름 자체를 참조하고 있어(예:
--      teachers.status, students.status 컬럼), 타입을 통째로 교체하면 그
--      컬럼을 참조하는 모든 곳을 다시 만들어야 한다 — 이번엔 값만 넓히는
--      쪽이 안전하다.
--   2. student_status의 기존 'inactive' 값은 조사 결과 실제로 쓰는 코드가
--      없다(어떤 서버 액션도 이 값으로 전이시키지 않음, 실 데이터에도 없음).
--      Postgres는 enum 값을 안전하게 제거할 수 없으므로 'inactive'는 타입에
--      그대로 남기되 사용을 중단한다 — 새 코드는 전부 5단계
--      (pending/active/suspended/closure_pending/closed)만 쓰고, 'inactive'는
--      과거 값과의 호환을 위해서만 남겨진 폐기 예정 값으로 취급한다.
--   3. teacher_status는 기존에 pending/active 2개뿐이었으므로 3개만 추가하면
--      정확히 5단계가 된다.
--   4. parents는 status 컬럼 자체가 없었으므로 처음부터 5단계로 신규 생성한다
--      (레거시 값 문제가 없다).
--
-- Postgres 제약: 새로 추가한 enum 값은 추가한 트랜잭션이 커밋되기 전까지
-- 캐스팅/비교에 쓸 수 없다. 이 파일은 ADD VALUE만 하고, 그 값을 실제로 쓰는
-- 다음 마이그레이션(20260831011000)과 분리한다.

alter type teacher_status add value if not exists 'suspended';
alter type teacher_status add value if not exists 'closure_pending';
alter type teacher_status add value if not exists 'closed';

alter type student_status add value if not exists 'suspended';
alter type student_status add value if not exists 'closure_pending';
alter type student_status add value if not exists 'closed';

create type parent_status as enum ('pending', 'active', 'suspended', 'closure_pending', 'closed');

comment on type parent_status is 'R2 §5.7: 공통 계정 수명주기(pending→active→suspended↔active, active/suspended→closure_pending→closed). teacher_status/student_status도 같은 5개 값을 갖도록 확장됐다(레거시 student_status.inactive는 폐기 예정, 사용 중단).';
