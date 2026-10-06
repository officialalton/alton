import Link from "next/link";
import LandingCtaLink from "@/app/LandingCtaLink";
import { FOOTER_LINKS, NAV_ITEMS } from "@/lib/landing/copy";
import type { LandingDestinations } from "@/lib/landing/cta";
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

const PRIMARY_BTN =
  "h-10 px-4 rounded-xl bg-[#C8102E] hover:bg-[#8F0B20] text-white text-[14px] font-semibold flex items-center whitespace-nowrap transition-colors";

export function PublicHeader({ dest }: { dest: LandingDestinations }) {
  const startLabel = dest.signedIn ? "Practice Tests" : "Start Free";
  return (
    <header className="sticky top-0 z-30 bg-[#F8F5EF]/90 backdrop-blur border-b border-[#E6E1D8]">
      <div className="max-w-[1440px] mx-auto px-5 md:px-12 lg:px-20 h-[68px] md:h-[76px] flex items-center justify-between gap-4">
        <Link href="/" aria-label="ALTON home" className="flex items-center gap-2.5 no-underline">
          <Logo />
          <span className="font-[family-name:var(--font-bricolage)] text-[19px] font-bold tracking-[-0.01em] text-[#142240]">ALTON</span>
        </Link>
        <nav aria-label="Main" className="hidden lg:flex items-center gap-8 text-[14px] font-medium text-[#4F5A6B]">
          {NAV_ITEMS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[#142240] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href={dest.account.href} className="hidden sm:block text-[14px] font-medium text-[#4F5A6B] hover:text-[#142240]">
            {dest.account.label}
          </Link>
          <LandingCtaLink href={dest.freeLearning} ctaName="free_learning" section="header" className={PRIMARY_BTN}>
            {startLabel}
          </LandingCtaLink>
          <details className="lg:hidden relative group">
            <summary
              aria-label="Menu"
              className="list-none cursor-pointer h-10 w-10 rounded-xl border border-[#DDD7CC] bg-white flex items-center justify-center [&::-webkit-details-marker]:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#142240" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M2 4.5h14M2 9h14M2 13.5h14" />
              </svg>
            </summary>
            <nav aria-label="Mobile" className="absolute right-0 top-12 w-[240px] rounded-2xl border border-[#E6E1D8] bg-white shadow-lg p-2 flex flex-col">
              {NAV_ITEMS.map((l) => (
                <Link key={l.href} href={l.href} className="px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#142240] hover:bg-[#F8F5EF]">
                  {l.label}
                </Link>
              ))}
              <Link href={dest.account.href} className="px-3 py-2.5 rounded-lg text-[14px] font-medium text-[#142240] hover:bg-[#F8F5EF] sm:hidden">
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
    <footer className="bg-[#0C1628] text-[#C3CFE2] px-5 md:px-12 lg:px-20 pt-14 pb-10">
      <div className="max-w-[1440px] mx-auto flex flex-col gap-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          <div className="flex flex-col gap-3 max-w-[340px]">
            <div className="flex items-center gap-2.5">
              <Logo dark size={26} />
              <span className="font-[family-name:var(--font-bricolage)] text-[17px] font-bold text-white">ALTON</span>
            </div>
            <p className="text-[13.5px] leading-[1.7] text-[#97A9C8]">
              Free SAT practice and learning tools, with premium tutoring and educational consulting when you need them.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-3 text-[13.5px]">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-[#C3CFE2] hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="pt-6 border-t border-white/10 text-[12.5px] text-[#97A9C8]">© 2026 Alton Education Inc.</div>
      </div>
    </footer>
  );
}

/** 공개 정적 페이지 공용 틀(헤더·푸터·폰트). */
export function PublicPage({ dest, children }: { dest: LandingDestinations; children: React.ReactNode }) {
  return (
    <div
      className={`${publicFontClass} bg-[#F8F5EF] min-h-screen flex flex-col`}
      style={{ fontFamily: "var(--font-instrument), system-ui, sans-serif" }}
    >
      <PublicHeader dest={dest} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <section className="max-w-[1440px] mx-auto px-5 md:px-12 lg:px-20 pt-14 pb-8">
      <div className="max-w-[760px] flex flex-col gap-4">
        <span className="font-mono text-[12px] font-medium tracking-[0.08em] text-[#C8102E]">{eyebrow}</span>
        <h1 className="m-0 font-[family-name:var(--font-bricolage)] font-semibold text-[34px] md:text-[42px] leading-[1.2] tracking-[-0.02em] text-[#142240]">{title}</h1>
        {intro && <p className="text-[16px] leading-[1.7] text-[#4F5A6B] m-0">{intro}</p>}
      </div>
    </section>
  );
}

export function CtaButton({ href, ctaName, section, variant = "primary", children }: { href: string; ctaName: string; section: string; variant?: "primary" | "secondary"; children: React.ReactNode }) {
  const cls =
    variant === "primary"
      ? "h-12 px-5 rounded-xl bg-[#C8102E] hover:bg-[#8F0B20] text-white text-[15px] font-semibold flex items-center transition-colors"
      : "h-12 px-5 rounded-xl border border-[#DDD7CC] bg-white text-[#142240] text-[15px] font-semibold flex items-center hover:border-[#142240] transition-colors";
  return (
    <LandingCtaLink href={href} ctaName={ctaName} section={section} className={cls}>
      {children}
    </LandingCtaLink>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <section className="max-w-[1440px] mx-auto px-5 md:px-12 lg:px-20 pb-20">
      <div className="max-w-[760px] flex flex-col gap-5 text-[15.5px] leading-[1.75] text-[#4F5A6B] [&_h2]:font-[family-name:var(--font-bricolage)] [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:text-[#142240] [&_h2]:mt-4 [&_h2]:mb-0 [&_ul]:m-0 [&_ul]:pl-5 [&_li]:mb-1.5 [&_a]:text-[#284DB0] [&_a]:font-semibold">
        {children}
      </div>
    </section>
  );
}
