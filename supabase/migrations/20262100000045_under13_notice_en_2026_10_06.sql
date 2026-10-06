-- Under-13 parental notice and consent, English text version U13-EN-2026-10-06
-- (docs/contracts/under-13-parental-notice-and-consent-en.md; content_hash = sha256 of that file).
-- This is a material change (adds regular-lesson video/audio recording, transcription and AI lesson notes),
-- so requires_reconsent = true: has_valid_guardian_consent() treats earlier-version consents as superseded and
-- guardians record verified consent again through consent_as_guardian(). Earlier policy rows and recorded
-- consents are left untouched. The full text is served at /under-13-notice (document_url).
insert into consent_policy_versions (version, title, document_url, content_hash, effective_from, requires_reconsent)
values (
  'U13-EN-2026-10-06',
  'Parent Notice and Consent for a Child Under 13',
  '/under-13-notice',
  '0184c9f6ec0ad7a9918ca82aa906a5b72a42771885d0a2f238e4a3a75e9c15de',
  now(),
  true
)
on conflict (version) do nothing;
