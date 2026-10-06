import type { Metadata } from "next";
import LegalNotice, { LegalSection } from "@/app/components/public/LegalNotice";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { resolveLandingDestinations } from "@/lib/landing/cta";
import { loadLandingViewer } from "@/lib/landing/viewer";
import { CONTACT_EMAIL, GOVERNING_LAW } from "@/lib/legal";

const DESCRIPTION = "The terms that apply when you use ALTON Education's website, free learning accounts and services.";

export const metadata: Metadata = {
  title: "Terms of Use — ALTON",
  description: DESCRIPTION,
  openGraph: { title: "Terms of Use — ALTON", description: DESCRIPTION },
};

export const TERMS_SECTIONS = [
  { id: "agreement", title: "Agreement and who we are" },
  { id: "eligibility", title: "Eligibility" },
  { id: "accounts", title: "Your account" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "content", title: "Content and intellectual property" },
  { id: "educational-disclaimer", title: "Educational disclaimer" },
  { id: "tutoring", title: "Tutoring and consulting services" },
  { id: "payments", title: "Payments and refunds" },
  { id: "privacy", title: "Privacy and children" },
  { id: "termination", title: "Suspension and termination" },
  { id: "disclaimers", title: "Disclaimers and limitation of liability" },
  { id: "governing-law", title: "Governing law" },
  { id: "changes", title: "Changes to these terms" },
  { id: "contact", title: "Contact us" },
];

export default async function TermsPage() {
  const dest = resolveLandingDestinations(await loadLandingViewer());
  const S = TERMS_SECTIONS;
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="LEGAL" title="Terms of Use" />
      <Prose>
        <LegalNotice sections={S} />
        <LegalSection id={S[0].id} n={1} title={S[0].title}>
          <p>
            These Terms of Use apply to your use of the ALTON website and portals, provided by Alton Education LLC, a United States company (&quot;ALTON,&quot; &quot;we,&quot; &quot;us&quot;). ALTON
            offers an online SAT and AP practice platform, premium one-on-one tutoring, and educational consulting for middle and high school students. By creating an account
            or using ALTON, you agree to these terms and to our <a href="/privacy">Privacy Policy</a>.
          </p>
        </LegalSection>
        <LegalSection id={S[1].id} n={2} title={S[1].title}>
          <p>
            You must be at least 13 years old to create an ALTON account yourself. Students under 13 may use ALTON only through a consultation route led by a parent or guardian.
            If you are under the age of majority where you live, a parent or guardian must agree to these terms and to any paid service on your behalf.
          </p>
        </LegalSection>
        <LegalSection id={S[2].id} n={3} title={S[2].title}>
          <p>
            A free learning account includes practice tests, the mistake notebook, the vocabulary builder, and study materials approved for free access. It does not include tutoring
            or consulting. Provide accurate information, keep your login private, and tell us promptly if you think your account has been used without permission. You are responsible
            for activity under your account.
          </p>
        </LegalSection>
        <LegalSection id={S[3].id} n={4} title={S[3].title}>
          <p>You agree not to:</p>
          <ul>
            <li>share your login, or let someone else use your account;</li>
            <li>copy, redistribute, resell or publish ALTON materials, questions or explanations;</li>
            <li>use scripts, bots or scraping to access or extract content;</li>
            <li>attempt to gain unauthorized access to ALTON, other accounts, or other users&apos; data;</li>
            <li>upload unlawful, harmful or infringing content, or harass teachers, staff or other users;</li>
            <li>interfere with or disrupt the service.</li>
          </ul>
        </LegalSection>
        <LegalSection id={S[4].id} n={5} title={S[4].title}>
          <p>
            ALTON and its licensors own the platform, practice tests, questions, explanations, study materials and branding. We give you a limited, personal, non-transferable right
            to use them for your own study. You keep ownership of the notes, scratch work and other content you create, and you give ALTON the permission needed to host it and show it to
            the teachers, administrators and linked parents or guardians described in the Privacy Policy so we can provide the service.
          </p>
        </LegalSection>
        <LegalSection id={S[5].id} n={6} title={S[5].title}>
          <p>
            ALTON does not guarantee any score, score improvement, admission or other outcome. Practice scores and estimates in ALTON are internal learning estimates. They are not
            official College Board scores and may differ from results on the actual SAT or AP exams. SAT and AP are trademarks of their respective owners, and ALTON is not affiliated
            with or endorsed by them unless we say so.
          </p>
        </LegalSection>
        <LegalSection id={S[6].id} n={7} title={S[6].title}>
          <p>
            Premium tutoring and educational consulting are separate services governed by their own written agreement, signed electronically through DocuSign. If that agreement
            conflicts with these terms for those services, the agreement controls. Lessons and consultations may be held using Google Workspace and Google Meet.
          </p>
        </LegalSection>
        <LegalSection id={S[7].id} n={8} title={S[7].title}>
          <p>
            Lesson credits are purchased through Stripe. Prices, payment terms, cancellation, rescheduling, expiry and refunds are set out in your tutoring agreement and at checkout. We do
            not store your card details; Stripe handles them under its own terms.
          </p>
        </LegalSection>
        <LegalSection id={S[8].id} n={9} title={S[8].title}>
          <p>
            Our <a href="/privacy">Privacy Policy</a> explains how we handle personal information, including our commitment not to knowingly collect personal information from children
            under 13 without verifiable parental involvement.
          </p>
        </LegalSection>
        <LegalSection id={S[9].id} n={10} title={S[9].title}>
          <p>
            You may stop using ALTON and ask to close your account at any time; closure follows a 30-day pending period and then deactivation, as described in the Privacy Policy. We may
            suspend or end access if you breach these terms, put others or the service at risk, or where required by law. Sections that by their nature should survive termination
            (including content ownership, disclaimers, limitation of liability and governing law) will survive.
          </p>
        </LegalSection>
        <LegalSection id={S[10].id} n={11} title={S[10].title}>
          <p>
            ALTON is provided &quot;as is&quot; and &quot;as available.&quot; To the fullest extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness
            for a particular purpose and non-infringement, and we do not promise that the service will be uninterrupted or error-free.
          </p>
          <p>
            To the fullest extent permitted by law, ALTON will not be liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, data or
            opportunities. Our total liability for any claim is limited to the amount you paid ALTON for the service giving rise to the claim in the 12 months before it arose (and
            is zero for free features, to the extent the law allows). Nothing in these terms limits liability that cannot be limited by law.
          </p>
        </LegalSection>
        <LegalSection id={S[11].id} n={12} title={S[11].title}>
          <p>These terms are governed by {GOVERNING_LAW}, without regard to its conflict-of-laws rules.</p>
        </LegalSection>
        <LegalSection id={S[12].id} n={13} title={S[12].title}>
          <p>
            We may update these terms. We will change the &quot;Last updated&quot; date and version above and, for material changes, notify account holders through ALTON or by email.
            Continued use after changes take effect means you accept the updated terms.
          </p>
        </LegalSection>
        <LegalSection id={S[13].id} n={14} title={S[13].title}>
          <p>
            Alton Education LLC — <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </LegalSection>
      </Prose>
    </PublicPage>
  );
}
