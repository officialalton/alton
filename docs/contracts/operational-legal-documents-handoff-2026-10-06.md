# Operational Legal Document Set — Developer Handoff

Internal handoff only. Do not include this file in customer or teacher documents.

## Authoritative English text

- Parent agreement: parent-education-services-agreement-v0.3-en-california-draft.md (filename retained; no draft disclaimer in contract).
- California teacher: teacher-california-employment-agreement-v0.2-en.md.
- Overseas teacher: teacher-non-us-services-agreement-v0.2-en.md.
- Under-13 direct notice and parental consent: under-13-parental-notice-and-consent-en.md.
- Website terms: terms-of-use-en.md.
- Privacy Policy: privacy-policy-en.md.

The owner's October 6 instruction supersedes the prior exclusion of retained audio/video recordings. Regular paid lessons require explicit consent covering video recording, audio recording, transcription and storage, and AI meeting notes and storage. Consultations and trials remain excluded. Free learning does not require lesson-recording consent. Existing teacher compensation and local classification distinctions remain intact.

## Actual implementation gaps found

The current lib/contracts/family-contract-template.ts still contains Korean Smart Notes-only language. app/terms/page.tsx and app/privacy/page.tsx still contain the old under-13 parent-led-only rule and omit the complete media-processing disclosure. lib/legal.ts governing-law text must be synchronized. The older migration 20261001000000 explicitly excluded video, original audio, and separate transcription. Document consent does not implement these features or establish that they are currently enabled.

The parental consent UI reads consent_policy_versions through app/parent/consent-data.ts and records acceptance through consent_as_guardian. The live database policy body was not queried or changed in this documentation task. Treat the database text as unverified until compared with the new notice, not as automatically updated.

## Required integration

Replace live document text from the authoritative files, with all contract fields populated. Publish matching Terms/Privacy versions. Add a new parental policy version as a material change and require renewed verified consent before newly covered collection. Do not edit historical signed versions or backdate authorization. Existing contracts must receive an executed amendment or replacement covering newly added recording; old Smart Notes signatures do not authorize it.

Persist participant consent version, scope, identity, timestamp, and withdrawal. Obtain teacher consent through the correct employment/service form, verify parent authority for under-13 students, and provide meeting notices and any required student/additional-attendee consent. Block capture if a prerequisite is absent. Stop affected future capture after withdrawal. Preserve privacy rights and refund handling.

Configure actual capture, restricted storage/access, retention and deletion separately; implement the published purpose-limited retention rules without inventing a fixed period in user-facing text. Match vendor descriptions to actual providers. Do not activate recording or send contracts merely because these documents exist. Check video/audio, transcripts, and AI notes independently, and regression-test consultation/trial exclusion and free-learning access.

Internal legal analysis and release discussion remain outside signature envelopes and public pages. Normal executed fields for identity, address, payroll or commercial terms remain necessary; overseas nonlesson rates, bank fee allocation, and termination notice must be completed rather than invented.

## Reference used for children's data

FTC COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
FTC rule: https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa
