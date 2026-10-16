-- 2026-10-12 — 관리자 'AP 재고 관리' 화면 작업 이력(감사 로그). additive, 재실행 안전, 삭제·갱신 없음(append-only).
-- 누가·언제·무엇을·어떤 대상(Supabase ref)에·dry-run 인지 execute 인지·건수와 함께 남긴다. 서버 액션(service role)만 INSERT 하고
-- 관리자는 조회만 한다. 게시 세트·응시·답안·결과 테이블은 이 마이그레이션이 건드리지 않는다.
create table if not exists ap_stock_admin_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null check (action in ('load_check', 'import', 'render_verify', 'screen_verify', 'convert', 'assemble_draft')),
  mode text not null check (mode in ('dry_run', 'execute')),
  status text not null check (status in ('ok', 'refused', 'error')),
  target_ref text not null,
  scope jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  plan_hash text,
  note text
);
create index if not exists ap_stock_admin_runs_created_idx on ap_stock_admin_runs (created_at desc);
alter table ap_stock_admin_runs enable row level security;
drop policy if exists "관리자만 조회" on ap_stock_admin_runs;
create policy "관리자만 조회" on ap_stock_admin_runs for select using (is_admin());
-- 쓰기 정책 없음: 서버 액션의 service role 만 기록(RLS 우회). 수정·삭제는 어떤 역할에도 열지 않는다.
revoke update, delete on ap_stock_admin_runs from anon, authenticated;
comment on table ap_stock_admin_runs is 'AP 재고 관리 화면 작업 이력(append-only). 문서: docs/ap/admin-stock-screen.md';
