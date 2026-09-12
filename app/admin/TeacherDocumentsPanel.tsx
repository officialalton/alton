"use client";

import { useEffect, useState } from "react";
import {
  listTeacherDocumentSummariesAction,
  listTeacherDocumentsAction,
  getTeacherDocumentDownloadUrlAction,
  type TeacherDocumentSummary,
  type TeacherDocumentItem,
} from "./teacher-documents-actions";

// P4-3 3단계 — `문서 > 교사 서류`. 읽기 전용 보관함이다.
//
// 업로드·삭제 버튼을 두지 않는다(창구는 교사 포털 `정산` 탭 하나뿐).
// 제출 여부를 업무 조건으로 쓰지 않으므로 "미제출"·"검토 필요"·"승인됨" 같은
// 상태 배지를 만들지 않는다 — 제출 건수와 시각만 보여준다.

function formatBytes(size: number | null): string {
  if (!size) return "—";
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function messageForReason(reason: string): string {
  switch (reason) {
    case "not_found":
      return "서류를 찾을 수 없습니다.";
    case "link_failed":
      return "지금은 링크를 만들 수 없습니다. 잠시 뒤 다시 시도해 주세요.";
    default:
      return "링크를 만들지 못했습니다.";
  }
}

export default function TeacherDocumentsPanel() {
  const [summaries, setSummaries] = useState<TeacherDocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTeacherId, setOpenTeacherId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<TeacherDocumentItem[] | null>(null);
  const [linkState, setLinkState] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    listTeacherDocumentSummariesAction()
      .then((next) => {
        if (!cancelled) setSummaries(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openTeacher(teacherId: string) {
    if (openTeacherId === teacherId) {
      setOpenTeacherId(null);
      return;
    }
    setOpenTeacherId(teacherId);
    setDocuments(null);
    setError(null);
    try {
      setDocuments(await listTeacherDocumentsAction(teacherId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "서류를 불러오지 못했습니다.");
    }
  }

  async function openDocument(doc: TeacherDocumentItem) {
    setLinkState((prev) => ({ ...prev, [doc.id]: "링크를 만드는 중…" }));
    try {
      const result = await getTeacherDocumentDownloadUrlAction(doc.id);
      if (!result.ok) {
        setLinkState((prev) => ({ ...prev, [doc.id]: messageForReason(result.reason) }));
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
      // 링크를 열어준 것까지가 이 화면이 아는 전부다.
      setLinkState((prev) => ({ ...prev, [doc.id]: "새 창에서 열었습니다." }));
    } catch (e) {
      setLinkState((prev) => ({
        ...prev,
        [doc.id]: e instanceof Error ? e.message : "링크를 만들지 못했습니다.",
      }));
    }
  }

  return (
    <div>
      <p className="text-[12.5px] text-grey-500 mb-4">
        교사가 제출한 서류를 모아 봅니다. 여기서는 조회만 하고, 업로드·삭제는 교사
        본인이 자기 포털에서 합니다. 제출 여부는 정산·매칭·수업 어느 것의 조건도 아닙니다.
      </p>

      {error && <p className="text-[13px] text-red mb-3">{error}</p>}
      {summaries === null && !error && <p className="text-[13px] text-grey-500">불러오는 중…</p>}
      {summaries?.length === 0 && (
        <p className="text-[13px] text-grey-500">아직 제출된 서류가 없습니다.</p>
      )}

      {summaries?.map((s) => {
        const isOpen = openTeacherId === s.teacherId;
        return (
          <div
            key={s.teacherId}
            className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold text-ink">{s.teacherName || "이름 없음"}</span>
              <span className="text-[12px] text-grey-500">{s.documentCount}건</span>
              <span className="text-[11.5px] text-grey-500">
                최근 제출 {formatDate(s.lastUploadedAt)}
              </span>
              <button
                onClick={() => void openTeacher(s.teacherId)}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink ml-auto"
              >
                {isOpen ? "접기" : "서류 보기"}
              </button>
            </div>

            {isOpen && (
              <div className="mt-3 pt-3 border-t border-grey-100">
                {documents === null ? (
                  <p className="text-[12.5px] text-grey-500">불러오는 중…</p>
                ) : documents.length === 0 ? (
                  <p className="text-[12.5px] text-grey-500">제출한 서류가 없습니다.</p>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center gap-2 text-[12.5px] py-1.5"
                    >
                      <span className="text-ink truncate max-w-[320px]">{doc.fileName}</span>
                      <span className="text-[11.5px] text-grey-500">{formatBytes(doc.sizeBytes)}</span>
                      <span className="text-[11.5px] text-grey-500">{formatDate(doc.uploadedAt)}</span>
                      {doc.note && (
                        <span className="text-[11.5px] text-grey-500">· {doc.note}</span>
                      )}
                      <button
                        onClick={() => void openDocument(doc)}
                        className="text-[11.5px] font-bold text-ink ml-auto"
                      >
                        열기
                      </button>
                      {linkState[doc.id] && (
                        <span className="text-[11px] text-grey-500 w-full">{linkState[doc.id]}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
