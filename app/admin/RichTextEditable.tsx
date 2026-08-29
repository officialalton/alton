"use client";

import { useRef } from "react";

const TOOLBAR_BUTTONS: { label: string; command: string; value?: string }[] = [
  { label: "B", command: "bold" },
  { label: "I", command: "italic" },
  { label: "U", command: "underline" },
  { label: "H2", command: "formatBlock", value: "h2" },
  { label: "H3", command: "formatBlock", value: "h3" },
  { label: "본문", command: "formatBlock", value: "p" },
  { label: "•목록", command: "insertUnorderedList" },
  { label: "1.목록", command: "insertOrderedList" },
];

const TABLE_HTML =
  "<table><tbody>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>" +
  "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>" +
  "</tbody></table>";

export default function RichTextEditable({
  initialHtml,
  onChange,
  placeholder,
  minHeight = "100px",
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function setInitialContent(el: HTMLDivElement | null) {
    if (el && ref.current !== el) {
      el.innerHTML = initialHtml;
      ref.current = el;
    }
  }

  function exec(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
  }

  function insertTable() {
    ref.current?.focus();
    document.execCommand("insertHTML", false, TABLE_HTML);
  }

  function handleBlur() {
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap gap-1 px-2 py-1.5 bg-grey-100 border-b border-grey-200">
        {TOOLBAR_BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              exec(b.command, b.value);
            }}
            className="text-[11.5px] font-bold px-2 py-1 rounded hover:bg-white text-ink"
          >
            {b.label}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            insertTable();
          }}
          className="text-[11.5px] font-bold px-2 py-1 rounded hover:bg-white text-ink"
        >
          표
        </button>
      </div>
      <div
        ref={setInitialContent}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        data-placeholder={placeholder}
        className="rte-editable px-3 py-2.5 text-[13.5px] leading-[1.6] outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-grey-300"
        style={{ minHeight }}
      />
    </div>
  );
}
