-- Under-13 parental notice and consent, English text version U13-EN-2026-10-07
-- (docs/contracts/under-13-parental-notice-and-consent-en.md; content_hash = sha256 of that file).
-- The shared recording/transcription/AI-notes clause now states: four consent items (video recording, audio recording,
-- transcription, AI notes, each with retention); first consultation and all trial lessons are always excluded from
-- execution; retention of one year after the end date of each lesson or consultation. This is a material change, so
-- requires_reconsent = true: has_valid_guardian_consent() treats earlier-version consents as superseded and guardians
-- record verified consent again through consent_as_guardian(). Earlier policy rows and recorded consents are left
-- untouched (U13-EN-2026-10-06 stays as history). No notice is sent by this migration.
insert into consent_policy_versions (version, title, document_url, content_hash, effective_from, requires_reconsent)
values (
  'U13-EN-2026-10-07',
  'Parent Notice and Consent for a Child Under 13',
  '/under-13-notice',
  'd717f9ae4d9d5b68f28ba91dde3e9ade17bc1c9a0b991c49ed5a59709b632e1a',
  now(),
  true
)
on conflict (version) do nothing;
