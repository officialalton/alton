import type { Metadata } from "next";
import LegalNotice, { LegalSection } from "@/app/components/public/LegalNotice";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";
import { CONTACT_EMAIL } from "@/lib/legal";

const DESCRIPTION = "How ALTON Education collects, uses, shares and protects personal information.";

export const metadata: Metadata = {
  title: "Privacy Policy — ALTON",
  description: DESCRIPTION,
  openGraph: { title: "Privacy Policy — ALTON", description: DESCRIPTION },
};

export const PRIVACY_SECTIONS = [
  { id: "who-we-are", title: "Who we are" },
  { id: "information-we-collect", title: "Information we collect" },
  { id: "how-we-use", title: "How we use information" },
  { id: "who-can-see", title: "Who can see your information" },
  { id: "service-providers", title: "Service providers" },
  { id: "no-sale", title: "No sale of data, no advertising profiling" },
  { id: "children", title: "Children and COPPA" },
  { id: "retention", title: "Retention and account closure" },
  { id: "security", title: "Security" },
  { id: "your-rights", title: "Your choices and rights" },
  { id: "changes", title: "Changes to this policy" },
  { id: "contact", title: "Contact us" },
];

export default async function PrivacyPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  const S = PRIVACY_SECTIONS;
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="LEGAL" title="Privacy Policy" />
      <Prose>
        <LegalNotice sections={S} />
        <LegalSection id={S[0].id} n={1} title={S[0].title}>
          <p>
            ALTON is operated by Alton Education LLC, a United States company (&quot;ALTON,&quot; &quot;we,&quot; &quot;us&quot;). We provide an online SAT and AP practice platform, premium
            one-on-one tutoring, and educational consulting for middle and high school students. This policy explains what personal information we collect through the
            ALTON website and student, parent/guardian, teacher and consultant portals, how we use it, and the choices you have.
          </p>
        </LegalSection>
        <LegalSection id={S[1].id} n={2} title={S[1].title}>
          <p>Depending on how you use ALTON, we collect:</p>
          <ul>
            <li>
              <strong>Account information:</strong> name, email address, date of birth, grade, and (optionally) school.
            </li>
            <li>
              <strong>Learning data:</strong> practice test attempts, answers, scores and results; saved questions; vocabulary lists; and your mistake notebook.
            </li>
            <li>
              <strong>Study work:</strong> notes, whiteboard scratch work and highlights you create while studying.
            </li>
            <li>
              <strong>Usage data:</strong> activity information such as the last day you were active.
            </li>
            <li>
              <strong>Consultation and family information:</strong> consultation requests and the contact information of a parent or guardian.
            </li>
            <li>
              <strong>Tutoring records:</strong> lesson records and communications between you, your family, your teacher and ALTON staff.
            </li>
            <li>
              <strong>Contract and payment records:</strong> signed agreements and records of lesson-credit purchases. Card details are entered with Stripe and are not stored by
              ALTON.
            </li>
          </ul>
          <p>
            Practice scores shown in ALTON are internal learning estimates. They are not official College Board scores.
          </p>
        </LegalSection>
        <LegalSection id={S[2].id} n={3} title={S[2].title}>
          <ul>
            <li>To create and run your account, grade practice tests, and show your results, mistake notebook and vocabulary builder.</li>
            <li>To provide tutoring and consulting, including scheduling, lessons held over Google Meet, and lesson records.</li>
            <li>To manage contracts, lesson credits and payments.</li>
            <li>To communicate with you and your family about your account, lessons and service updates.</li>
            <li>To maintain, secure and improve ALTON, prevent misuse, and meet legal obligations.</li>
          </ul>
          <p>A free learning account does not start tutoring, a contract, or any payment.</p>
        </LegalSection>
        <LegalSection id={S[3].id} n={4} title={S[3].title}>
          <ul>
            <li>
              <strong>You:</strong> your own account data.
            </li>
            <li>
              <strong>Your teachers and ALTON administrators:</strong> your notes, whiteboard work and highlights are private to you and the teachers and administrators who
              work with you.
            </li>
            <li>
              <strong>Linked parents or guardians:</strong> once a parent or guardian is linked to your account, they can view your practice results, scores, and individual
              answers and explanations. They cannot see your private notes or whiteboard work.
            </li>
            <li>
              <strong>ALTON consultants:</strong> consultants see an aggregated learning summary only, not individual answers, notes or whiteboard work.
            </li>
          </ul>
          <p>We may also disclose information when required by law or to protect the safety, rights or property of ALTON, our users or others.</p>
        </LegalSection>
        <LegalSection id={S[4].id} n={5} title={S[4].title}>
          <p>We use trusted providers to operate ALTON. They process personal information only on our behalf and for the purposes described here:</p>
          <ul>
            <li>Supabase — database and authentication.</li>
            <li>Vercel — website hosting.</li>
            <li>Google — Workspace, Calendar and Meet, used for lessons and consultations.</li>
            <li>DocuSign — electronic signature of tutoring contracts.</li>
            <li>Stripe — payment processing for lesson credits.</li>
            <li>An email delivery provider — account, scheduling and service emails.</li>
          </ul>
        </LegalSection>
        <LegalSection id={S[5].id} n={6} title={S[5].title}>
          <p>
            We do not sell personal information, and we do not use it for advertising profiling or share it with advertisers for that purpose.
          </p>
        </LegalSection>
        <LegalSection id={S[6].id} n={7} title={S[6].title}>
          <p>
            Students must be 13 or older to create an ALTON account on their own. We do not knowingly collect personal information from children under 13 without verifiable
            parental involvement. Students under 13 can use ALTON only through a consultation route led by a parent or guardian.
          </p>
          <p>
            If you believe a child under 13 has given us personal information without a parent or guardian&apos;s involvement, contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will take steps to delete it. A parent or guardian may ask to review, correct or delete their child&apos;s
            information at any time.
          </p>
        </LegalSection>
        <LegalSection id={S[7].id} n={8} title={S[7].title}>
          <p>
            We keep account and learning records while your account is active. If an account is closed, it first enters a 30-day pending period and is then deactivated.
            Contract and payment records are kept for as long as the law requires.
          </p>
        </LegalSection>
        <LegalSection id={S[8].id} n={9} title={S[8].title}>
          <p>
            We use access controls, role-based permissions and encrypted connections to protect information. No online service can be perfectly secure, so we cannot guarantee
            absolute security.
          </p>
        </LegalSection>
        <LegalSection id={S[9].id} n={10} title={S[9].title}>
          <p>
            You may ask us to access, correct or delete your personal information, or to close your account. Parents and guardians can make these requests for their child. Depending
            on where you live, you may have additional rights under local law. We may need to verify your identity first, and we may keep information we are required by law to retain.
            Send requests to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </LegalSection>
        <LegalSection id={S[10].id} n={11} title={S[10].title}>
          <p>
            We may update this policy. When we do, we will change the &quot;Last updated&quot; date above and, for material changes, notify account holders through ALTON or by email.
          </p>
        </LegalSection>
        <LegalSection id={S[11].id} n={12} title={S[11].title}>
          <p>
            Alton Education LLC — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </LegalSection>
      </Prose>
    </PublicPage>
  );
}
