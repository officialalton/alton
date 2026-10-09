-- Per-teacher engagement type selecting the agreement form (additive). Default is contractor (owner decision 2026-10-06);
-- 'employee' keeps the California employment agreement selectable.
alter table teacher_agreement_inputs
  add column engagement_type text not null default 'contractor' check (engagement_type in ('contractor', 'employee'));
