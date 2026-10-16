-- Under-13 parental notice and consent, English text version U13-EN-2026-10-07.2
-- (docs/contracts/under-13-parental-notice-and-consent-en.md; content_hash = sha256 of that file).
-- Execution rule restated: trial lessons are always excluded; a first consultation is excluded from video/audio recording and
-- retained transcripts, and its AI meeting notes are covered by the guardian's consent given when requesting the consultation.
-- Material change => requires_reconsent = true. Earlier rows (U13-EN-2026-10-06, U13-EN-2026-10-07) stay as history; no notice
-- is sent by this migration.
insert into consent_policy_versions (version, title, document_url, content_hash, effective_from, requires_reconsent)
values (
  'U13-EN-2026-10-07.2',
  'Parent Notice and Consent for a Child Under 13',
  '/under-13-notice',
  'e3d4ab51070b659b88b4f8bd88263b496495677c42e56d2fd3661274602ea4a0',
  now() + interval '1 second',
  true
)
on conflict (version) do nothing;
