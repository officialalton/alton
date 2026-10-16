"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { MODAL_LEGAL_DOCUMENT_HREFS, type LegalDocKey } from "@/lib/legal/modal-hrefs";

// The document text is only fetched when a user opens it, so forms and the footer stay light.
const LegalDocumentModal = dynamic(() => import("./LegalDocumentModal"), { ssr: false });

/**
 * Real <a href="/terms"> (works with middle-click, ctrl/cmd-click, new tab and without JS);
 * a plain left click opens the document in a popup instead so the user keeps what they typed.
 */
export default function LegalLink({ doc, children, className }: { doc: LegalDocKey; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  return (
    <>
      <a
        ref={triggerRef}
        href={MODAL_LEGAL_DOCUMENT_HREFS[doc]}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={(e) => {
          if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </a>
      {open && (
        <LegalDocumentModal
          docKey={doc}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}
