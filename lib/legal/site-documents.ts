// Terms of Use and Privacy Policy content (English, Alton Education LLC, effective October 6, 2026).
// Authoritative source: docs/contracts/terms-of-use-en.md and privacy-policy-en.md. A drift test
// (lib/legal/site-documents.test.ts) fails if any source paragraph is missing from this content.
// Inline markup: **bold** and [label](href).
import { CONTACT_EMAIL } from "@/lib/legal";
import { RECORDING_CLAUSE_HEADING, RECORDING_CLAUSE_PARAGRAPHS } from "./recording-clause";

export type SiteBlock = { t: "p"; text: string } | { t: "ul"; items: string[] } | { t: "h3"; text: string };
export type SiteSection = { id: string; title: string; blocks: SiteBlock[] };

const MAIL = `[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`;
const p = (text: string): SiteBlock => ({ t: "p", text });
const ul = (...items: string[]): SiteBlock => ({ t: "ul", items });

const MEDIA_BLOCKS: SiteBlock[] = [{ t: "h3", text: RECORDING_CLAUSE_HEADING }, ...RECORDING_CLAUSE_PARAGRAPHS.map((text) => p(text))];

export const RETENTION_INTRO =
  "Retention schedule. ALTON keeps records for these periods, and longer only where required by law, an active dispute or legal hold, or an accounting or safety need:";
export const RETENTION_ITEMS: string[] = [
  "Contracts, pricing, and consent records; payments, refunds, and the lesson-credit ledger; and teacher and consultant payout and pay records: 7 years after the contract or transaction ends.",
  "Attendance, bookings, lesson-credit history, and learning history (homework, note results, reviews, confirmed attendance, and quality-review outcomes): 3 years after the last lesson. Free-member learning records: 3 years after last activity.",
  "Lesson recordings (video and audio), transcripts, AI lesson notes and summaries, and lesson materials: 1 year after the last lesson. This also applies if recordings are later offered on demand.",
  "Chat and consultation records: 2 years after the matter ends.",
  "Security and access audit logs: 1 year after creation. Notifications: 90 days.",
  "Account closure: a 30-day period in which a closure request can be cancelled; deleted data in backups is removed within 35 days. A closed account keeps only what a retention basis above requires, with restricted access.",
];
const RETENTION_BLOCKS: SiteBlock[] = [p(RETENTION_INTRO), ul(...RETENTION_ITEMS)];

const REQUESTS_PARAGRAPH = p(
  `Contact ${MAIL} for access, correction, deletion, account closure, or withdrawal requests. Applicable statutory rights and response deadlines prevail. Account deactivation is not a promise that all records have been deleted. Required records and legal holds are retained only as needed. Material processing changes require renewed consent when applicable; continued website use alone does not authorize a new recording practice.`
);

export const TERMS_SECTIONS: SiteSection[] = [
  {
    id: "agreement",
    title: "Agreement and who we are",
    blocks: [
      p(
        'These Terms of Use apply to your use of the ALTON website and portals, provided by Alton Education LLC, a United States company ("ALTON," "we," "us"). ALTON offers an online SAT and AP practice platform, premium one-on-one tutoring, and educational consulting for middle and high school students. By creating an account or using ALTON, you agree to these terms and to our [Privacy Policy](/privacy).'
      ),
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    blocks: [
      p(
        "Students under 13 may enter registration pathways, subject to operational acceptance and required parental verification and consent before covered collection or access. Registration alone does not authorize collection or guarantee service availability. If you are under the age of majority where you live, a parent or guardian must agree to these terms and to any paid service on your behalf."
      ),
    ],
  },
  {
    id: "accounts",
    title: "Your account",
    blocks: [
      p(
        "A free learning account includes practice tests, the mistake notebook, the vocabulary builder, and study materials approved for free access. It does not include tutoring or consulting. Provide accurate information, keep your login private, and tell us promptly if you think your account has been used without permission. You are responsible for activity under your account."
      ),
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    blocks: [
      p("You agree not to:"),
      ul(
        "share your login, or let someone else use your account;",
        "copy, redistribute, resell or publish ALTON materials, questions or explanations;",
        "use scripts, bots or scraping to access or extract content;",
        "attempt to gain unauthorized access to ALTON, other accounts, or other users' data;",
        "upload unlawful, harmful or infringing content, or harass teachers, staff or other users;",
        "interfere with or disrupt the service."
      ),
    ],
  },
  {
    id: "content",
    title: "Content and intellectual property",
    blocks: [
      p(
        "ALTON and its licensors own the platform, practice tests, questions, explanations, study materials and branding. We give you a limited, personal, non-transferable right to use them for your own study. You keep ownership of the notes, scratch work and other content you create, and you give ALTON permission to host and process it for the service under the Privacy Policy. Linked guardians may view permitted results, individual answers and lesson artifacts, but not your private personal notes or whiteboard work."
      ),
    ],
  },
  {
    id: "educational-disclaimer",
    title: "Educational disclaimer",
    blocks: [
      p(
        "ALTON does not guarantee any score, score improvement, admission or other outcome. Practice scores and estimates in ALTON are internal learning estimates. They are not official College Board scores and may differ from results on the actual SAT or AP exams. SAT and AP are trademarks of their respective owners, and ALTON is not affiliated with or endorsed by them unless we say so."
      ),
    ],
  },
  {
    id: "tutoring",
    title: "Tutoring and consulting services",
    blocks: [
      p(
        "Premium tutoring and educational consulting are separate services governed by their own written agreement, signed electronically through DocuSign. If that agreement conflicts with these terms for those services, the agreement controls. Lessons and consultations may be held using Google Workspace and Google Meet."
      ),
    ],
  },
  {
    id: "payments",
    title: "Payments and refunds",
    blocks: [
      p(
        "Lesson credits are purchased through Stripe. Prices, payment terms, cancellation, rescheduling, expiry and refunds are set out in your tutoring agreement and at checkout. We do not store your card details; Stripe handles them under its own terms."
      ),
    ],
  },
  {
    id: "privacy",
    title: "Privacy and children",
    blocks: [
      p(
        "Our [Privacy Policy](/privacy) explains how we handle personal information, including our commitment not to knowingly collect personal information from children under 13 without verifiable parental consent where required by law."
      ),
    ],
  },
  {
    id: "termination",
    title: "Suspension and termination",
    blocks: [
      p(
        "You may stop using ALTON and ask to close your account at any time; closure follows a 30-day pending period and then deactivation, as described in the Privacy Policy. We may suspend or end access if you breach these terms, put others or the service at risk, or where required by law. Sections that by their nature should survive termination (including content ownership, disclaimers, limitation of liability and governing law) will survive."
      ),
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers and limitation of liability",
    blocks: [
      p(
        'ALTON is provided "as is" and "as available." To the fullest extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose and non-infringement, and we do not promise that the service will be uninterrupted or error-free.'
      ),
      p(
        "To the fullest extent permitted by law, ALTON will not be liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, data or opportunities. Our total liability for any claim is limited to the amount you paid ALTON for the service giving rise to the claim in the 12 months before it arose (and is zero for free features, to the extent the law allows). Nothing in these terms limits liability that cannot be limited by law."
      ),
    ],
  },
  {
    id: "governing-law",
    title: "Governing law",
    blocks: [
      p(
        "California law and applicable federal law govern, subject to mandatory protections of other applicable jurisdictions. Disputes may be brought in a competent court subject to mandatory jurisdiction and venue rules. These terms do not require arbitration or waive nonwaivable rights."
      ),
    ],
  },
  {
    id: "changes",
    title: "Changes to these terms",
    blocks: [
      p(
        'We may update these terms. We will change the "Last updated" date and version above and, for material changes, notify account holders through ALTON or by email. Continued use after changes take effect means you accept the updated terms.'
      ),
    ],
  },
  { id: "lesson-media", title: "Regular-lesson media and AI records", blocks: MEDIA_BLOCKS },
  { id: "retention-schedule", title: "Retention schedule", blocks: RETENTION_BLOCKS },
  { id: "privacy-requests", title: "Privacy requests", blocks: [REQUESTS_PARAGRAPH] },
  { id: "contact", title: "Contact us", blocks: [p(`Alton Education LLC — ${MAIL}`)] },
];

export const PRIVACY_SECTIONS: SiteSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    blocks: [
      p(
        'ALTON is operated by Alton Education LLC, a United States company ("ALTON," "we," "us"). We provide an online SAT and AP practice platform, premium one-on-one tutoring, and educational consulting for middle and high school students. This policy explains what personal information we collect through the ALTON website and student, parent/guardian, teacher and consultant portals, how we use it, and the choices you have.'
      ),
    ],
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    blocks: [
      p("Depending on how you use ALTON, we collect:"),
      ul(
        "**Account information:** name, email address, date of birth, grade, and (optionally) school.",
        "**Learning data:** practice test attempts, answers, scores and results; saved questions; vocabulary lists; and your mistake notebook.",
        "**Study work:** notes, whiteboard scratch work and highlights you create while studying.",
        "**Usage data:** activity information such as the last day you were active.",
        "**Consultation and family information:** consultation requests and the contact information of a parent or guardian.",
        "**Tutoring records:** lesson records and communications between you, your family, your teacher and ALTON staff.",
        "**Contract and payment records:** signed agreements and records of lesson-credit purchases. Card details are entered with Stripe and are not stored by ALTON."
      ),
      p("Practice scores shown in ALTON are internal learning estimates. They are not official College Board scores."),
    ],
  },
  {
    id: "how-we-use",
    title: "How we use information",
    blocks: [
      ul(
        "To create and run your account, grade practice tests, and show your results, mistake notebook and vocabulary builder.",
        "To provide tutoring and consulting, including scheduling, lessons held over Google Meet, and lesson records.",
        "To manage contracts, lesson credits and payments.",
        "To communicate with you and your family about your account, lessons and service updates.",
        "To maintain, secure and improve ALTON, prevent misuse, and meet legal obligations."
      ),
      p("A free learning account does not start tutoring, a contract, or any payment."),
    ],
  },
  {
    id: "who-can-see",
    title: "Who can see your information",
    blocks: [
      ul(
        "**You:** your own account data.",
        "**Your teachers and ALTON administrators:** your notes, whiteboard work and highlights are private to you and the teachers and administrators who work with you.",
        "**Linked parents or guardians:** once a parent or guardian is linked to your account, they can view your practice results, scores, and individual answers and explanations. They cannot see your private notes or whiteboard work.",
        "**ALTON consultants:** consultants see an aggregated learning summary only, not individual answers, notes or whiteboard work."
      ),
      p("We may also disclose information when required by law or to protect the safety, rights or property of ALTON, our users or others."),
    ],
  },
  {
    id: "service-providers",
    title: "Service providers",
    blocks: [
      p("We use trusted providers to operate ALTON. They process personal information only on our behalf and for the purposes described here:"),
      ul(
        "Supabase — database and authentication.",
        "Vercel — website hosting.",
        "Google — Workspace, Calendar and Meet, used for lessons and consultations.",
        "DocuSign — electronic signature of tutoring contracts.",
        "Stripe — payment processing for lesson credits.",
        "An email delivery provider — account, scheduling and service emails."
      ),
    ],
  },
  {
    id: "no-sale",
    title: "No sale of data, no advertising profiling",
    blocks: [p("We do not sell personal information, and we do not use it for advertising profiling or share it with advertisers for that purpose.")],
  },
  {
    id: "children",
    title: "Children and COPPA",
    blocks: [
      p(
        `Students under 13 may enter registration pathways. Covered collection, use, and disclosure require prior direct parent notice and verifiable parental consent unless a lawful exception applies. Operational acceptance is separate from age verification and consent. If you believe a child under 13 has given us personal information without a parent or guardian's involvement, contact us at ${MAIL} and we will take steps to delete it. A parent or guardian may ask to review, correct or delete their child's information at any time. The direct notice and consent form for a child under 13 is available at [Parent Notice and Consent for a Child Under 13](/under-13-notice).`
      ),
    ],
  },
  {
    id: "retention",
    title: "Retention and account closure",
    blocks: [
      p(
        "We keep account and learning records while your account is active. If an account is closed, it first enters a 30-day pending period and is then deactivated. Retention periods are set out in the Retention Schedule below."
      ),
    ],
  },
  {
    id: "security",
    title: "Security",
    blocks: [
      p(
        "We use access controls, role-based permissions and encrypted connections to protect information. No online service can be perfectly secure, so we cannot guarantee absolute security."
      ),
    ],
  },
  {
    id: "your-rights",
    title: "Your choices and rights",
    blocks: [
      p(
        `You may ask us to access, correct or delete your personal information, or to close your account. Parents and guardians can make these requests for their child. Depending on where you live, you may have additional rights under local law. We may need to verify your identity first, and we may keep information we are required by law to retain. Send requests to ${MAIL}.`
      ),
    ],
  },
  {
    id: "changes",
    title: "Changes to this policy",
    blocks: [
      p('We may update this policy. When we do, we will change the "Last updated" date above and, for material changes, notify account holders through ALTON or by email.'),
    ],
  },
  { id: "lesson-media", title: "Regular-lesson media and AI records", blocks: MEDIA_BLOCKS },
  { id: "retention-schedule", title: "Retention schedule", blocks: RETENTION_BLOCKS },
  { id: "privacy-requests", title: "Privacy requests", blocks: [REQUESTS_PARAGRAPH] },
  { id: "contact", title: "Contact us", blocks: [p(`Alton Education LLC — ${MAIL}`)] },
];
