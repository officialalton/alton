import Link from "next/link";
import LandingCtaLink from "@/app/LandingCtaLink";
import { FOOTER_LINKS, NAV_ITEMS } from "@/lib/landing/copy";
import type { LandingDestinations } from "@/lib/landing/cta";
import LegalLink from "@/app/components/legal/LegalLink";
import { publicFontClass } from "./fonts";

export function Logo({ dark = false, size = 30 }: { dark?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <rect x="3" y="15" width="24" height="9" rx="2.5" fill={dark ? "#fff" : "#142240"} opacity={dark ? 0.9 : 1} />
      <rect x="6" y="7" width="18" height="9" rx="2.5" fill={dark ? "#fff" : "#142240"} opacity={dark ? 0.55 : 0.65} />
      <rect x="9" y="1" width="12" height="7.5" rx="2.5" fill="#C8102E" />
    </svg>
  );
}

export function PublicHeader({ dest }: { dest: LandingDestinations }) {
  const startLabel = dest.signedIn ? "Practice Tests" : "Start Free";
  return (
    <header className="sticky top-0 z-30 bg-[var(--p-paper)] border-b border-[var(--p-line)]">
      <div className="p-wrap h-[64px] md:h-[72px] flex items-center justify-between gap-4">
        <Link href="/" aria-label="ALTON home" className="flex items-center gap-2.5 no-underline">
          <Logo />
          <span className="p-serif text-[26px] leading-none tracking-[-0.01em]">ALTON</span>
        </Link>
        <nav aria-label="Main" className="hidden lg:flex items-center gap-8 text-[14px] font-medium text-[var(--p-slate)]">
          {NAV_ITEMS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[var(--p-red)] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 md:gap-5">
          <Link href={dest.account.href} className="hidden sm:block text-[14px] font-medium text-[var(--p-slate)] hover:text-[var(--p-red)]">
            {dest.account.label}
          </Link>
          <LandingCtaLink href={dest.freeLearning} ctaName="free_learning" section="header" className="p-btn p-btn-secondary p-btn-sm">
            {startLabel}
          </LandingCtaLink>
          <details className="lg:hidden relative">
            <summary
              aria-label="Menu"
              className="list-none cursor-pointer h-10 w-10 border border-[var(--p-ink)] flex items-center justify-center [&::-webkit-details-marker]:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2 4.5h14M2 9h14M2 13.5h14" />
              </svg>
            </summary>
            <nav aria-label="Mobile" className="absolute right-0 top-12 w-[240px] border border-[var(--p-ink)] bg-[var(--p-paper)] p-2 flex flex-col">
              {NAV_ITEMS.map((l) => (
                <Link key={l.href} href={l.href} className="px-3 py-3 text-[14px] font-medium hover:text-[var(--p-red)]">
                  {l.label}
                </Link>
              ))}
              <Link href={dest.account.href} className="px-3 py-3 text-[14px] font-medium hover:text-[var(--p-red)] sm:hidden">
                {dest.account.label}
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--p-line)] py-14">
      <div className="p-wrap flex flex-col gap-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          <div className="flex flex-col gap-3 max-w-[340px]">
            <div className="flex items-center gap-2.5">
              <Logo size={26} />
              <span className="p-serif text-[24px] leading-none">ALTON</span>
            </div>
            <p className="m-0 text-[14px] leading-[1.7] text-[var(--p-slate)]">
              Free SAT practice and learning tools, with premium tutoring and educational consulting when you need them.
            </p>
          </div>
          <nav aria-label="Footer" className="p-mono grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-3 text-[12.5px] text-[var(--p-slate)]">
            {FOOTER_LINKS.map((l) =>
              l.href === "/privacy" || l.href === "/terms" ? (
                <LegalLink key={l.href} doc={l.href === "/privacy" ? "privacy" : "terms"} className="hover:text-[var(--p-red)]">
                  {l.label}
                </LegalLink>
              ) : (
              <Link key={l.href} href={l.href} className="hover:text-[var(--p-red)]">
                {l.label}
              </Link>
              ),
            )}
          </nav>
        </div>
        <div className="p-mono pt-6 border-t border-[var(--p-line)] text-[12px] text-[var(--p-mute)]">© 2026 Alton Education LLC</div>
      </div>
    </footer>
  );
}

/** 공개 정적 페이지 공용 틀(헤더·푸터·폰트). */
export function PublicPage({ dest, children }: { dest: LandingDestinations; children: React.ReactNode }) {
  return (
    <div className={`${publicFontClass} min-h-screen flex flex-col`}>
      <PublicHeader dest={dest} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-eyebrow">
      <span className="p-rule" aria-hidden="true" />
      <span className="p-eyebrow-text">{children}</span>
    </div>
  );
}

/** 문장형 대소문자 모노 아이브로우용(원문이 전부 대문자인 카피를 문장형으로 보이게 한다). */
export function sentenceCase(s: string): string {
  const t = s.toLowerCase().replace(/\b(alton|sat|ap)\b/g, (m) => m.toUpperCase());
  return t.replace(/(^|\. )([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

/** 제목을 첫 문장/쉼표 경계에서 나눠 둘째 줄을 이탤릭으로 렌더한다(카피 문자열은 그대로). */
export function SplitTitle({ text }: { text: string }) {
  const m = text.match(/^(.+?[.,])\s+(.+)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <br />
      <em>{m[2]}</em>
    </>
  );
}

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="p-wrap pt-14 md:pt-20 pb-10">
      <div className="max-w-[760px] flex flex-col gap-6">
        <Eyebrow>{sentenceCase(eyebrow)}</Eyebrow>
        <h1 className="p-h1" style={{ fontSize: "clamp(40px, 9vw, 68px)" }}>{title}</h1>
        {intro && <p className="p-lede">{intro}</p>}
      </div>
    </section>
  );
}

export function CtaButton({ href, ctaName, section, variant = "primary", children }: { href: string; ctaName: string; section: string; variant?: "primary" | "secondary"; children: React.ReactNode }) {
  return (
    <LandingCtaLink href={href} ctaName={ctaName} section={section} className={`p-btn ${variant === "primary" ? "p-btn-primary" : "p-btn-secondary"}`}>
      {children}
    </LandingCtaLink>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <section className="p-wrap pb-24">
      <div className="max-w-[760px] p-prose">{children}</div>
    </section>
  );
}
