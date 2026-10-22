import { AVAILABILITY_COPY as C } from "@/lib/landing/claims";
import { AP_SUBJECT_NAME } from "@/lib/ap-exam/layouts";
import { apSubjectLabel, type LandingAvailability } from "@/lib/landing/practice-test-count";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** 히어로 우측 가용성 비주얼. 실제 게시 수만 표시. 데이터가 비면 null(정적 히어로). */
export default function AvailabilityCard({ data }: { data: LandingAvailability }) {
  if (data.sat <= 0 && data.ap.length === 0) return null;
  const have = new Set(data.ap.map((a) => a.subject));
  const coming = Object.keys(AP_SUBJECT_NAME).filter((c) => !have.has(c)).map((c) => apSubjectLabel(c)).filter((l): l is string => !!l);
  return (
    <section aria-label="Practice test availability" className="relative w-full max-w-[520px] lg:ml-auto">
      <div className="p-doc !gap-5 sm:!gap-6 !p-5 sm:!p-6">
        <div className="flex items-center justify-between border-b border-[var(--p-line)] pb-4 gap-3">
          <strong className="p-serif text-[22px] font-normal">{C.title}</strong>
          <span className="p-label !text-[10.5px] flex items-center gap-1.5"><span aria-hidden="true" className="p-live-dot" />{C.updated}</span>
        </div>

        {data.sat > 0 && (
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="p-label">{C.satLabel}</span>
              <span className="text-[14.5px] text-[var(--p-slate)]">{C.satUnit}</span>
            </div>
            <span className="p-serif text-[56px] leading-none text-[var(--p-red)]" aria-label={`${data.sat} ${C.satUnit}`}>{data.sat}</span>
          </div>
        )}

        {data.ap.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="p-label">{C.apLabel}</span>
            <ul className="list-none m-0 p-0 flex flex-col gap-2 sm:gap-2.5">
              {data.ap.map((a) => (
                <li key={a.subject} className="flex items-baseline justify-between gap-3">
                  <span className="text-[14.5px] font-semibold">{a.label}</span>
                  <span className="p-mono text-[12px] text-[var(--p-slate)] text-right">{plural(a.sets, "set")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-coming flex flex-col gap-2.5">
          <span className="p-label">{C.comingSoon}</span>
          {coming.length > 0 && <p className="m-0 text-[13px] leading-[1.7] text-[var(--p-mute)]">{coming.join(" · ")}</p>}
          <p className="m-0 text-[13px] italic text-[var(--p-slate)]">{C.roadmap}</p>
        </div>
        <details className="md:hidden border-t border-[var(--p-line)] pt-4"><summary className="cursor-pointer list-none flex items-center justify-between p-label">{C.visionLabel}<span aria-hidden="true">+</span></summary><div className="flex flex-col gap-3 pt-3">
                    <p className="m-0 p-serif text-[20px] leading-[1.25]">{C.visionHeadline}</p>
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            {C.vision.map((v) => (
              <li key={v.t} className="flex gap-2.5 text-[13px] leading-[1.6]">
                <span aria-hidden="true" className="p-live-dot mt-[7px] shrink-0" />
                <span><strong className="font-semibold">{v.t}.</strong> <span className="text-[var(--p-slate)]">{v.d}</span></span>
              </li>
            ))}
          </ul>
        </div></details>
        <div className="hidden md:flex flex-col gap-3 border-t border-[var(--p-line)] pt-5">
          <span className="p-label">{C.visionLabel}</span>
          <p className="m-0 p-serif text-[20px] leading-[1.25]">{C.visionHeadline}</p>
          <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
            {C.vision.map((v) => (
              <li key={v.t} className="flex gap-2.5 text-[13px] leading-[1.6]">
                <span aria-hidden="true" className="p-live-dot mt-[7px] shrink-0" />
                <span><strong className="font-semibold">{v.t}.</strong> <span className="text-[var(--p-slate)]">{v.d}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="m-0 p-mono text-[11.5px] text-[var(--p-mute)]">{C.regularly}</p>
      </div>
    </section>
  );
}
