-- P4-2 — 교사 수취 계좌 + 교사 제출 서류 보관 창구 (2026-09-12)
--
-- 착수 정리: docs/2026-09-12-p4-2-teacher-settlement-plan.md
--
-- 확정 정책:
--  * 정산 금액의 원본은 기존 payout_items/payout_batches다 — 이 마이그레이션은
--    금액 계산에 전혀 관여하지 않는다(새 원장·새 집계 함수를 만들지 않는다).
--  * 교사 제출 서류는 **업로드·보관 창구일 뿐**이다. 제출 여부·검토 상태를
--    정산·매칭·수업의 게이트로 쓰지 않는다 — 그래서 이 스키마에는 승인·심사·
--    보완 상태 컬럼 자체를 두지 않는다(나중에 게이트로 오용될 여지를 없앤다).
--  * 실제 송금·paid 전이·외부 지급 제공자 연동은 범위 밖이다. 계좌 정보는
--    저장·조회만 하며 어떤 송금 경로도 이 값을 아직 읽지 않는다.
--
-- 전부 additive다.

-- =========================================================================
-- 1. 교사 수취 계좌 — 교사당 1행
-- =========================================================================

create table teacher_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null unique references profiles (id) on delete cascade,
  account_holder_name text not null,
  bank_name text not null,
  -- 전체 계좌번호는 여기에만 있고 앱은 절대 클라이언트로 내려보내지 않는다
  -- (서버가 마스킹해서 내려준다 — app/teacher/settlement-actions.ts 참고).
  account_number text not null,
  -- 목록·이력 표시용 비민감 파생값. 앱이 매번 전체 값을 읽지 않아도 되게 둔다.
  account_number_last4 text not null,
  currency text not null default 'KRW',
  country text,
  swift_or_routing text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  constraint teacher_payout_accounts_last4_len check (char_length(account_number_last4) between 1 and 4)
);
create index on teacher_payout_accounts (updated_at desc);

comment on table teacher_payout_accounts is
  'P4-2: 교사 본인이 등록·수정하는 수취 계좌. 교사 본인과 관리자(정산권한)만 조회할 수 있고, '
  '앱은 account_number 전체를 응답에 넣지 않는다(항상 마스킹). 실제 송금 경로는 아직 이 값을 읽지 않는다.';

alter table teacher_payout_accounts enable row level security;
create policy "본인·관리자 조회" on teacher_payout_accounts for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));
-- 쓰기는 서버 액션(service_role)만 — 마스킹·이력 기록을 서버가 반드시 함께 수행해야 하므로
-- 클라이언트 직접 쓰기 정책은 두지 않는다(정책 없음 = RLS 기본 거부).

-- =========================================================================
-- 2. 계좌 변경 이력(INSERT-only) — 전체 계좌번호를 복제하지 않는다
-- =========================================================================

create table teacher_payout_account_events (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id) on delete cascade,
  action text not null check (action in ('created', 'updated')),
  actor_id uuid references profiles (id),
  changed_fields text[] not null default '{}',
  previous_last4 text,
  new_last4 text,
  created_at timestamptz not null default now()
);
create index on teacher_payout_account_events (teacher_id, created_at desc);

comment on table teacher_payout_account_events is
  'P4-2: 수취 계좌 변경 이력. 민감정보 확산을 막기 위해 전체 계좌번호가 아니라 바뀐 필드 이름과 '
  '끝 4자리 전/후만 남긴다.';

create or replace function public.reject_teacher_payout_account_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'teacher_payout_account_events는 INSERT-only입니다.';
end;
$$;
create trigger teacher_payout_account_events_no_update
  before update or delete on teacher_payout_account_events
  for each row execute function public.reject_teacher_payout_account_event_mutation();
revoke execute on function public.reject_teacher_payout_account_event_mutation() from public, anon, authenticated, service_role;

alter table teacher_payout_account_events enable row level security;
create policy "본인·관리자 조회" on teacher_payout_account_events for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));

-- =========================================================================
-- 3. 교사 제출 서류 — 업로드·보관 창구 전용(게이트 아님)
-- =========================================================================

create table teacher_documents (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles (id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  content_type text,
  size_bytes bigint,
  note text,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references profiles (id)
);
create index on teacher_documents (teacher_id, uploaded_at desc);

comment on table teacher_documents is
  'P4-2: 교사가 제출한 파일의 메타데이터. **업로드·보관 창구 전용** — 제출 여부나 검토 상태를 '
  '정산·매칭·수업의 진행 조건으로 쓰지 않는다. 그래서 승인/심사/보완 상태 컬럼을 두지 않는다. '
  'P4-3 관리자 문서 탭이 이 테이블과 teacher-documents 버킷을 읽어 교사별 조회·다운로드를 붙인다.';

alter table teacher_documents enable row level security;
create policy "본인·관리자 조회" on teacher_documents for select
  using (teacher_id = auth.uid() or is_admin() or current_user_has_capability('정산권한'));
-- 쓰기는 서버 액션(service_role)만 — 실제 파일 업로드와 메타 행 생성이 짝을 이뤄야 한다.

-- =========================================================================
-- 4. 비공개 Storage 버킷 — 파일 본문
-- =========================================================================
-- 경로 규칙: <teacher_id>/<uuid>-<파일명>. 첫 세그먼트가 본인 id일 때만 접근 가능.
insert into storage.buckets (id, name, public)
values ('teacher-documents', 'teacher-documents', false)
on conflict (id) do nothing;

create policy "교사 본인 서류 조회" on storage.objects for select
  using (
    bucket_id = 'teacher-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or is_admin()
      or current_user_has_capability('정산권한')
    )
  );
-- 업로드·삭제는 service_role(서버 액션)만 — 메타 행과 파일이 따로 놀지 않게 한다.
