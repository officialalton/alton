-- Add application cycle opening date (Common App / school-specific application opens),
-- so the full timeline (opens -> ED/EA/ED2 deadlines -> notifications -> RD deadline -> RD notification)
-- can be recorded per cycle. Additive column only; no data touched.
alter table university_admission_cycles
  add column if not exists application_opens_date date;

comment on column university_admission_cycles.application_opens_date is
  'Date the application for this cycle opens (e.g. Common App opens Aug 1). Source: CDS C14 note or admissions "Important Dates" page.';
