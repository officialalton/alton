"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listCompanyDocumentsAction,
  openCompanyDocumentAction,
  type CompanyDocumentEntry,
} from "./company-documents-actions";

// P4-3 4단계 — `문서 > 회사 문서`. 읽기 전용이다.
//
// 빈 상태를 뭉개지 않는다 — 권한 없음 / 아직 연결되지 않음 / 폴더가 비어 있음을
// 각각 다른 문구로 보여준다. 셋을 같은 말로 묶으면 운영자가 설정 문제인지
// 자료가 없는 건지 알 수 없다.

type Crumb = { id: string | null; name: string };

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

export default function CompanyDocumentsPanel() {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "회사 문서" }]);
  const [entries, setEntries] = useState<CompanyDocumentEntry[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "not_configured" | "fetch_failed" | "denied">(
    "loading"
  );
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);
  const [openState, setOpenState] = useState<Record<string, string>>({});

  const current = crumbs[crumbs.length - 1];

  const load = useCallback(async (folderId: string | null) => {
    setState("loading");
    setEntries(null);
    try {
      const result = await listCompanyDocumentsAction(folderId ?? undefined);
      if (result.state === "ok") {
        setEntries(result.entries);
        setState("ok");
      } else {
        setState(result.state);
      }
    } catch (e) {
      // 권한 부족은 게이트가 던진다 — 설정 문제와 구분해 보여준다.
      setDeniedMessage(e instanceof Error ? e.message : "권한이 없습니다.");
      setState("denied");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 데이터 로드 시작 시 상태 초기화(관용적 패턴)
    void load(current.id);
  }, [current.id, load]);

  async function openFile(entry: CompanyDocumentEntry) {
    setOpenState((prev) => ({ ...prev, [entry.id]: "여는 중…" }));
    const result = await openCompanyDocumentAction(entry.id);
    if (!result.ok) {
      const message =
        result.reason === "not_configured"
          ? "아직 연결되지 않았습니다."
          : result.reason === "not_found"
            ? "파일을 찾을 수 없습니다."
            : "지금은 열 수 없습니다. 잠시 뒤 다시 시도해 주세요.";
      setOpenState((prev) => ({ ...prev, [entry.id]: message }));
      return;
    }
    const blob = new Blob(
      [Uint8Array.from(atob(result.contentBase64), (c) => c.charCodeAt(0))],
      { type: result.contentType }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.name;
    a.click();
    URL.revokeObjectURL(url);
    setOpenState((prev) => ({ ...prev, [entry.id]: "내려받기를 시작했습니다." }));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-4 text-[12.5px]">
        {crumbs.map((c, i) => (
          <span key={`${c.id ?? "root"}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span className="text-grey-300">›</span>}
            <button
              onClick={() => setCrumbs(crumbs.slice(0, i + 1))}
              disabled={i === crumbs.length - 1}
              className={
                i === crumbs.length - 1 ? "font-bold text-ink" : "text-grey-500 hover:text-ink"
              }
            >
              {c.name}
            </button>
          </span>
        ))}
      </div>

      {state === "loading" && <p className="text-[13px] text-grey-500">불러오는 중…</p>}

      {state === "denied" && (
        <p className="text-[13px] text-grey-500">
          {deniedMessage ?? "회사 문서를 볼 권한이 없습니다."}
        </p>
      )}

      {state === "not_configured" && (
        <div className="text-[13px] text-grey-500">
          <p className="mb-1">회사 문서 드라이브가 아직 연결되지 않았습니다.</p>
          <p className="text-[12px]">
            전용 드라이브 생성과 연결 설정이 끝나면 이 자리에 폴더와 파일이 나타납니다.
          </p>
        </div>
      )}

      {state === "fetch_failed" && (
        <div className="text-[13px] text-grey-500">
          <p className="mb-2">회사 문서 드라이브에 연결하지 못했습니다.</p>
          <button
            onClick={() => void load(current.id)}
            className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink"
          >
            다시 시도
          </button>
        </div>
      )}

      {state === "ok" && entries?.length === 0 && (
        <p className="text-[13px] text-grey-500">이 폴더는 비어 있습니다.</p>
      )}

      {state === "ok" &&
        entries?.map((entry) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-center gap-2 border-b border-grey-100 py-2.5 text-[12.5px]"
          >
            <span>{entry.isFolder ? "📁" : "📄"}</span>
            {entry.isFolder ? (
              <button
                onClick={() => setCrumbs([...crumbs, { id: entry.id, name: entry.name }])}
                className="font-bold text-ink"
              >
                {entry.name}
              </button>
            ) : (
              <span className="text-ink truncate max-w-[360px]">{entry.name}</span>
            )}
            <span className="text-[11.5px] text-grey-500">
              {entry.isFolder ? "" : formatBytes(entry.sizeBytes)}
            </span>
            <span className="text-[11.5px] text-grey-500">{formatDate(entry.modifiedAt)}</span>
            {!entry.isFolder && (
              <button
                onClick={() => void openFile(entry)}
                className="text-[11.5px] font-bold text-ink ml-auto"
              >
                내려받기
              </button>
            )}
            {openState[entry.id] && (
              <span className="text-[11px] text-grey-500 w-full">{openState[entry.id]}</span>
            )}
          </div>
        ))}
    </div>
  );
}
