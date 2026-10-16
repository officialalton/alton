import type { ReactNode } from "react";
import { parseInline } from "@/lib/legal/inline";
import type { LegalBlock } from "@/lib/legal/types";

export function LegalInline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i): ReactNode => {
        if (part.kind === "bold") return <strong key={i}>{part.text}</strong>;
        if (part.kind === "link") return (
          <a key={i} href={part.href}>
            {part.text}
          </a>
        );
        return <span key={i}>{part.text}</span>;
      })}
    </>
  );
}

export function LegalBlocks({ blocks }: { blocks: readonly LegalBlock[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === "ul")
          return (
            <ul key={i}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <LegalInline text={item} />
                </li>
              ))}
            </ul>
          );
        if (b.t === "h3") return <h3 key={i}>{b.text}</h3>;
        return (
          <p key={i}>
            <LegalInline text={b.text} />
          </p>
        );
      })}
    </>
  );
}
