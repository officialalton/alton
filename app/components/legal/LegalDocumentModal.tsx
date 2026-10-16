"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { LegalBlocks } from "@/app/components/public/LegalContent";
import { MODAL_LEGAL_DOCUMENTS, type LegalDocKey } from "@/lib/legal/modal-documents";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export default function LegalDocumentModal({ docKey, onClose }: { docKey: LegalDocKey; onClose: () => void }) {
  const doc = MODAL_LEGAL_DOCUMENTS[docKey];
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return createPortal(
    <div
      data-testid="legal-backdrop"
      className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-[#142240] shadow-2xl sm:h-auto sm:max-h-[85vh] sm:max-w-[760px] sm:rounded-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e5e7eb] bg-white px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
          <div>
            <h2 id={titleId} className="m-0 text-[18px] font-bold leading-tight">{doc.title}</h2>
            <p className="m-0 mt-1 text-[12px] text-[#6b7280]">{doc.meta}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg px-2 py-1 text-[20px] leading-none text-[#6b7280] hover:bg-[#f3f4f6]">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[14px] leading-[1.7] [&_a]:underline [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-[15px] [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
        >
          {doc.sections.map((s, i) => (
            <section key={s.id}>
              <h2>{i + 1}. {s.title}</h2>
              <LegalBlocks blocks={s.blocks} />
            </section>
          ))}
        </div>
        <footer className="flex justify-end border-t border-[#e5e7eb] bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-xl bg-[#142240] px-6 py-2.5 text-[14px] font-bold text-white">
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
