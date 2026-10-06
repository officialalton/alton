# California Agreement Review and Developer Handoff

October 6, 2026 | Planning only; no code, database, dispatch, or deployment changes.

## Draft and Release Status

Use `parent-education-services-agreement-v0.3-en-california-draft.md` as the English planning draft. Preserve v0.2 as history. Do not replace the live signing template until the items below are resolved and the text is approved. No organizational legal playbook was located for this task; review uses owner policy and general commercial principles. Qualified California counsel must review before reliance.

## Material Changes from v0.2

- Uses Alton Education LLC; removes the pre-formation individual contracting alternative. Verify registration and representative authority.
- Removes automatic exclusion of under-13 registration; preserves parental verification and operational review as distinct conditions.
- Separates free learning from paid tutoring and permits direct enrollment without a completed trial.
- Excludes consultation/trial AI processing; describes planned regular-lesson notes and dialogue transcription.
- Distinguishes speech processing from retained audio/video recording; no retained recording authorization is silently added.
- Replaces obsolete staff-only artifact access with permission-controlled student/parent access, subject to actual feature verification.
- Preserves standard 120-minute lessons, cancellation windows and existing refund policy while flagging prepaid expiry and discount recapture for counsel.
- Avoids unverified deletion deadlines, e-signature sufficiency claims, arbitrary liability caps, arbitration and rights waivers.
- Uses California law with applicable federal and mandatory local protections.

## Legal and Operational Review Items

1. **Entity and service geography:** verify LLC registration, notice address, signatory and permitted customer locations. The v0.2 California-resident-only rollout restriction remains an unresolved launch scope; California governing law does not by itself authorize nationwide/international sales.
2. **Recording and transcription:** California confidential-communication rules require participant-consent analysis. Validate parent authority, student and teacher participation, additional attendees, notice timing and proof. One customer signature is the product goal, not a conclusion that all-party requirements are satisfied.
3. **COPPA:** review age-screen ordering, pre-consent collection, direct notice, verification method, purpose-specific retention, parent rights and necessary disclosures. Do not rely on ordinary DocuSign plus email without validating the whole process. No blanket AI-contract consent for earlier free-account collection.
4. **Privacy:** assess CCPA/CPRA applicability rather than assuming coverage or exemption. Verify sale/share, analytics, service-provider contracts and actual settings. The contract does not authorize children's information for advertising.
5. **Prepaid lessons:** validate 12-month expiry against the legal classification of lesson credits, the refund recapture formula, promotional credits and payment fees. These are retained product proposals, not approved legal conclusions.
6. **Electronic records:** validate DocuSign disclosures and federal/California electronic-record requirements for this consumer flow.
7. **Venue and minors:** review Santa Clara venue, mandatory consumer protections and minors' rights; no automatic waiver is added.
8. **Retention:** confirm approved periods and actual deletion capabilities for transcripts, notes, reviews, contracts, logs and backups before publishing fixed durations. Earlier v0.2 1/3/7-year and 35-day claims are not silently adopted.

## Developer Tasks After Text Approval

- Replace `lib/contracts/family-contract-template.ts` with the approved English text, preserving necessary signature anchors and variable mapping. Do not invent signer identity.
- Ensure source Markdown, rendered HTML, envelope version, customer copy and signed archive refer to the same approved version.
- `lib/legal.ts` currently contains an unconfirmed governing-law placeholder. Set the approved California wording when updating Terms.
- `app/terms/page.tsx` and `app/privacy/page.tsx` currently prohibit under-13 self-registration except a parent-led consultation route. Replace conflicting wording with the companion proposed clauses after the parent-verification path is confirmed.
- Verify regular-only contract/signature and parental-consent prerequisites without relying on contract status alone for all participant consent.
- Confirm enabled artifact types and student/parent access. No retained audio/video recording without separately approved scope.
- Synchronize Privacy disclosures and retention settings; do not publish aspirational behavior as implemented.
- Verify rendered English, signature fields, version binding, direct vs trial enrollment, under-13 pending/verified states and consultation/trial AI exclusion. Existing code behavior is not certified by this planning review.

## Proposed Terms Replacement: Eligibility

“Students may enter ALTON's registration process, including students under 13. Availability of services is subject to operational review and required parental verification and consent. Students under 13 must follow the designated parent-verification process before ALTON collects or processes information that requires prior parental consent. Registration does not guarantee immediate access to all features or acceptance for tutoring. A parent or legal guardian must execute the tutoring agreement for a minor Student.”

## Proposed Privacy Replacement: Children

“ALTON provides a registration pathway for students under 13 with required parental involvement. Where COPPA applies, we provide direct notice and obtain verifiable parental consent before covered collection, use or disclosure, unless an applicable exception permits otherwise. Account creation, operational approval and parental-consent completion are separate steps. Parents may contact official@alton.education to request access to their child's information, deletion, or cessation of further collection, subject to applicable law. We do not treat a future tutoring agreement as retroactive consent to information collected earlier.”

These clauses require the corresponding implementation. Insert a complete operator notice and actual verification description before release; they are not a complete COPPA direct notice.

## Sources Checked

- FTC COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC parental consent guidance: https://www.ftc.gov/business-guidance/privacy-security/verifiable-parental-consent-childrens-online-privacy-rule
- California Courts 2026 civil jury instructions, instruction 1809 (recording confidential communications): https://courts.ca.gov/system/files/file/judicial_council_of_california_civil_jury_instructions_2026.pdf
- California Attorney General CCPA guidance (applicability and children's sale/share rights): https://oag.ca.gov/privacy/ccpa
- California statutory references for counsel: Penal Code 632; Family Code 6710; Civil Code 1668. Direct legislative pages returned access errors in this session; their current text requires counsel verification.

## October 6 — Customer-facing presentation correction

Removed the planning disclaimer and internal counsel, validation, release, and implementation instructions from the agreement itself. Converted Company address and representative entries into ordinary execution fields. Review and release concerns remain in this companion memo. Keep this memo outside customer signature envelopes. The document filename retains its existing draft suffix for link compatibility; the rendered contract has no draft disclaimer. Documentation changes do not replace the deployed HTML template or authorize dispatch. Complete actual execution details before use.

Teacher agreements are separately provided as California employment and outside-US services forms, with internal review in `teacher-agreements-v0.2-internal-review-and-handoff.md`.


## October 6 owner update — media processing

The owner now requires regular-lesson video recording, audio recording, speech transcription and storage, and AI meeting notes and storage. Prior statements excluding retained media are superseded. See operational-legal-documents-handoff-2026-10-06.md for versioned consent and live integration requirements. This update is not evidence that capture is deployed.
