import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/site-url";
import { PageHero, Prose, PublicPage } from "@/app/components/public/PublicShell";
import { loadPublicDest } from "@/lib/landing/public-dest";

export const metadata: Metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact — ALTON",
  description: "Contact ALTON Education by email or request a tutoring consultation.",
  openGraph: { images: OG_IMAGES, title: "Contact — ALTON", description: "Contact ALTON Education by email or request a tutoring consultation." },
};

export default async function ContactPage() {
  const dest = await loadPublicDest();
  return (
    <PublicPage dest={dest}>
      <PageHero eyebrow="CONTACT" title="Get in touch" />
      <Prose>
        <p>
          Questions about your account or ALTON? Email <a href="mailto:official@alton.education">official@alton.education</a>.
        </p>
        <p>
          Interested in tutoring or educational consulting? <a href={dest.consult}>Request a consultation</a>.
        </p>
      </Prose>
    </PublicPage>
  );
}
