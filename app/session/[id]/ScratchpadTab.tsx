"use client";

import { useState } from "react";
import type { SessionViewViewer } from "@/lib/session-view";
import { addDocLink, removeDocLink } from "./scratchpad-actions";
import type { DocLink } from "./scratchpad-data";
import type { CanvasStroke } from "./material-data";
import WhiteboardCanvas from "./WhiteboardCanvas";

const SUBTABS = [
  { id: "docs", label: "Docs" },
  { id: "whiteboard", label: "화이트보드" },
] as const;

type SubtabId = (typeof SUBTABS)[number]["id"];

export default function ScratchpadTab({
  sessionId,
  viewerRole,
  initialDocLinks,
  initialWhiteboardStrokes,
}: {
  sessionId: string;
  viewerRole: SessionViewViewer;
  initialDocLinks: DocLink[];
  initialWhiteboardStrokes: CanvasStroke[];
}) {
  const [subtab, setSubtab] = useState<SubtabId>("docs");
  const isTeacher = viewerRole === "teacher";
  const canDraw = viewerRole === "student" || viewerRole === "teacher";

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">연습장</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        수업 중 함께 기록하는 공간입니다.
      </p>

      <div className="flex gap-4 mb-5 border-b border-grey-200">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubtab(t.id)}
            className={
              "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
              (subtab === t.id
                ? "text-ink border-ink"
                : "text-grey-500 border-transparent")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subtab === "docs" ? (
        <DocsPanel
          sessionId={sessionId}
          initialDocLinks={initialDocLinks}
          isTeacher={isTeacher}
        />
      ) : (
        <WhiteboardCanvas
          sessionId={sessionId}
          initialStrokes={initialWhiteboardStrokes}
          canDraw={canDraw}
        />
      )}
    </div>
  );
}

function DocsPanel({
  sessionId,
  initialDocLinks,
  isTeacher,
}: {
  sessionId: string;
  initialDocLinks: DocLink[];
  isTeacher: boolean;
}) {
  const [links, setLinks] = useState(initialDocLinks);

  async function handleRemove(id: string) {
    await removeDocLink(id);
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  return (
    <div>
      <h2 className="text-[14px] font-bold text-ink mb-3">📄 Google Docs</h2>

      {links.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center mb-4">
          등록된 문서가 없습니다.
        </div>
      ) : (
        links.map((link) => (
          <div
            key={link.id}
            className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-5 py-3.5 mb-2.5"
          >
            <span className="text-[13.5px] font-semibold text-ink">
              {link.title}
            </span>
            <div className="flex items-center gap-3">
              <a
                href={link.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] font-bold text-blue"
              >
                열기 →
              </a>
              {isTeacher && (
                <button
                  onClick={() => handleRemove(link.id)}
                  className="text-[12px] font-semibold text-red"
                >
                  삭제
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {isTeacher && (
        <AddDocLinkForm
          sessionId={sessionId}
          onAdded={(link) => setLinks((prev) => [...prev, link])}
        />
      )}
    </div>
  );
}

function AddDocLinkForm({
  sessionId,
  onAdded,
}: {
  sessionId: string;
  onAdded: (link: DocLink) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || !url.trim() || submitting) return;
    setSubmitting(true);
    try {
      const link = await addDocLink(sessionId, title.trim(), url.trim());
      onAdded(link);
      setTitle("");
      setUrl("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] font-bold px-4 py-2 rounded-lg border border-grey-200"
      >
        + 문서 추가
      </button>
    );
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <label className="block text-[12px] font-bold text-ink mb-1.5">
        제목
      </label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full mb-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        placeholder="예: 8회차 수업 기록"
      />
      <label className="block text-[12px] font-bold text-ink mb-1.5">
        Google Docs 링크
      </label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full mb-3 px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        placeholder="https://docs.google.com/..."
      />
      <div className="flex gap-2">
        <button
          disabled={!title.trim() || !url.trim() || submitting}
          onClick={handleSubmit}
          className="text-[12px] font-bold px-4 py-2 rounded-lg bg-green text-white disabled:opacity-50"
        >
          추가하기
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] font-semibold px-4 py-2 rounded-lg text-grey-500"
        >
          취소
        </button>
      </div>
    </div>
  );
}
