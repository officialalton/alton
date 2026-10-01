"use client";

import { useState } from "react";
import type { AdminSubject } from "./subject-data";
import {
  archiveNonDriveDocsAction,
  registerLocalSampleAssetAction,
  runCurriculumDriveFolderSyncAction,
  syncSubjectDriveMaterialsAction,
  type ArchiveNonDriveResult,
  type FolderSyncResult,
  type SubjectDriveSyncResult,
} from "./curriculum-asset-actions";

// Drive 자료 — 관리자 화면.
//
// 2026-09-14 제품 오너: 키워드를 골라 파일을 하나씩 등록·공개하는 흐름은 없앤다. 과목 하나를 고르면
// 그 과목의 모든 키워드 폴더를 읽어 미등록은 등록하고 미공개는 고정 사본으로 공개한다(과목 자료 동기화).
// 폴더 동기화는 ALTON 분류를 Drive 폴더로 반영한다(실제 쓰기 플래그가 꺼져 있으면 계획만).
// Drive 접근이 없을 때는 "로컬 표본"으로 PDF·영상을 올려 뷰어·필기를 검증할 수 있다.

export default function DriveMaterialsPanel({ subjects }: { subjects: AdminSubject[] }) {
  const [subjectId, setSubjectId] = useState("");
  const [sync, setSync] = useState<FolderSyncResult | "running" | null>(null);
  const [materialSync, setMaterialSync] = useState<SubjectDriveSyncResult | "running" | null>(null);
  const [archive, setArchive] = useState<ArchiveNonDriveResult | "running" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const subject = subjects.find((s) => s.subjectId === subjectId);

  async function runSync() {
    setSync("running");
    setSync(await runCurriculumDriveFolderSyncAction());
  }

  async function runMaterialSync() {
    if (!subjectId) return;
    setMaterialSync("running");
    setMaterialSync(await syncSubjectDriveMaterialsAction(subjectId));
  }

  async function runArchive() {
    const scopeLabel = subjectId ? `${subject?.subjectName ?? "이 과목"}에서` : "모든 과목에서";
    if (typeof window !== "undefined" && !window.confirm(`${scopeLabel} Drive 원본이 없는 공개 교재를 모두 보관할까요? 과거 수업 기록은 남고, 새로 담는 목록에서만 빠집니다.`)) return;
    setArchive("running");
    setArchive(await archiveNonDriveDocsAction(subjectId || null));
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">Drive 자료</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        Drive 구조는 과목 → 키워드 → 파일입니다. 키워드 폴더에 올린 PDF·영상은 <b>과목 자료 동기화</b> 한 번으로 모두 자료가 되고
        그 시점의 파일이 고정 사본으로 공개됩니다. 이미 공개된 자료는 원본이 바뀌어도 그대로입니다(공개 버전은 고정).
        영상도 교재와 같은 자료입니다 — 회차 구성의 교재 담기 목록에 함께 나옵니다.
      </p>

      <section className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-5">
        <h2 className="text-[13px] font-bold text-ink mb-1">폴더 동기화</h2>
        <p className="text-[12px] text-grey-500 mb-2">
          과목 → 키워드 분류를 Drive 폴더로 반영합니다(단원·회차는 폴더를 만들지 않습니다). 실제 쓰기 플래그가 꺼져 있으면 드라이브 접근만 확인하고 계획만 보여줍니다.
          한 번에 한 계층씩 만들어지므로 과목 → 키워드까지 두 번 실행합니다. Drive 에서 지운 폴더는 다음 실행에서 다시 만듭니다.
        </p>
        <button
          disabled={sync === "running"}
          onClick={() => void runSync()}
          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50"
        >
          {sync === "running" ? "확인 중…" : "폴더 동기화 실행"}
        </button>
        {sync && sync !== "running" && (
          <p className="text-[12px] text-ink mt-2" data-testid="folder-sync-result">
            {sync.state === "not_configured"
              ? "교재 Drive 연결이 설정되지 않았습니다(CURRICULUM_DRIVE_ENABLED)."
              : sync.state === "drive_unreachable"
                ? `드라이브에 접근하지 못했습니다 — ${sync.reason}`
                : `연결됨: ${sync.driveName} · ${sync.outcome.dryRun ? "계획만(실제 쓰기 꺼짐)" : "반영"} — 만들 폴더 ${sync.outcome.created}개 · 이름 변경 ${sync.outcome.renamed}개 · 건너뜀 ${sync.outcome.skipped.length}개 · 실패 ${sync.outcome.failed.length}개 · 남은 대기 ${sync.pendingAfter}개${sync.outcome.missingRecreated ? ` · Drive 에서 사라진 폴더 ${sync.outcome.missingRecreated}개는 다시 만들 대상` : ""}`}
          </p>
        )}
        {sync && sync !== "running" && sync.state === "ok" && sync.outcome.failed.length > 0 && (
          <ul className="text-[11.5px] text-red mt-1 list-disc pl-4">
            {sync.outcome.failed.map((f) => (
              <li key={f.rowId}>{f.error}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-5">
        <h2 className="text-[13px] font-bold text-ink mb-1">과목 자료 동기화</h2>
        <p className="text-[12px] text-grey-500 mb-2">
          과목의 모든 키워드 폴더를 읽어 아직 자료가 아닌 파일은 등록하고, 아직 공개되지 않은 자료는 고정 사본으로 공개합니다.
          이미 공개된 자료는 건너뜁니다. PDF·영상 외 파일은 건너뜁니다.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          <select aria-label="과목" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setMaterialSync(null); setArchive(null); }} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
            <option value="">과목 고르기…</option>
            {subjects.filter((s) => !s.archivedAt).map((s) => (
              <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
            ))}
          </select>
          <button disabled={!subjectId || materialSync === "running"} onClick={() => void runMaterialSync()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">
            {materialSync === "running" ? "Drive 를 읽고 공개하는 중…" : "과목 자료 동기화 실행"}
          </button>
          <button disabled={archive === "running"} onClick={() => void runArchive()} title="HTML 교재·로컬 표본처럼 Drive 원본이 없는 공개 교재를 보관합니다. 과목을 고르지 않으면 전체." className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-red disabled:opacity-50">
            {archive === "running" ? "보관 중…" : subjectId ? "Drive 원본 없는 교재 보관" : "Drive 원본 없는 교재 보관 (전체)"}
          </button>
        </div>

        {materialSync && materialSync !== "running" && (
          <div data-testid="material-sync-result" className="text-[12px] text-ink">
            {materialSync.state === "not_configured" ? (
              <p>교재 Drive 연결이 설정되지 않았습니다.</p>
            ) : materialSync.state === "no_folders" ? (
              <p className="text-red">{materialSync.reason}</p>
            ) : (
              <>
                <p className="font-bold mb-1">
                  키워드 폴더 {materialSync.keywordFolders}개 — 새로 공개 {materialSync.published}개 · 이미 공개 {materialSync.alreadyPublished}개 · 건너뜀 {materialSync.skipped}개 · 실패 {materialSync.failed}개
                </p>
                <ul>
                  {materialSync.items.map((it, i) => (
                    <li key={i} className={"flex flex-wrap items-center gap-1.5 py-1 border-t border-grey-100 " + (it.outcome === "failed" ? "text-red" : it.outcome === "skipped_unsupported" ? "text-grey-500" : "")}>
                      <span className="text-[10.5px] font-bold border border-grey-200 rounded-full px-1.5 py-0.5">{it.kind === "pdf" ? "PDF" : it.kind === "video" ? "영상" : "지원 안 함"}</span>
                      <span className="text-grey-500">{it.keywordLabel} /</span>
                      <span className="font-semibold">{it.name}</span>
                      <span className="ml-auto">
                        {it.outcome === "published" ? `공개됨${it.detail ? ` · ${it.detail}` : ""}` : it.outcome === "already_published" ? "이미 공개" : it.outcome === "skipped_unsupported" ? "건너뜀" : `실패 — ${it.detail ?? ""}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {archive && archive !== "running" && (
          <p data-testid="archive-result" className={"text-[12px] mt-2 " + (archive.ok ? "text-ink" : "text-red")}>
            {archive.ok
              ? archive.archived.length === 0
                ? "보관할 교재가 없습니다 — Drive 원본 없는 공개 교재가 없습니다."
                : `보관했습니다 (${archive.archived.length}개): ${archive.archived.map((a) => a.title).join(", ")}`
              : `보관하지 못했습니다 — ${archive.error}`}
          </p>
        )}
      </section>

      {notice && <p className="text-[12.5px] text-ink bg-grey-100 rounded-lg px-3 py-2 mb-2" data-testid="drive-notice">{notice}</p>}

      <LocalSampleForm subjects={subjects} onDone={(m) => setNotice(m)} />
    </div>
  );
}

/** Drive 없이 뷰어·필기를 검증하는 경로 — 로컬 PDF·영상을 올려 곧바로 공개한다. */
function LocalSampleForm({ subjects, onDone }: { subjects: AdminSubject[]; onDone: (message: string) => void }) {
  const [subjectId, setSubjectId] = useState("");
  const [keywordId, setKeywordId] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subject = subjects.find((s) => s.subjectId === subjectId);

  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData(form);
      fd.set("subjectId", subjectId);
      fd.set("keywordId", keywordId);
      fd.set("title", title);
      const r = await registerLocalSampleAssetAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onDone(`로컬 표본을 공개했습니다${r.pageCount ? ` · ${r.pageCount}쪽` : ""} — 교재 문서 목록과 회차 구성 후보에 나타납니다.`);
      form.reset();
      setTitle("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border-[1.5px] border-dashed border-grey-200 rounded-xl px-4 py-3.5">
      <h2 className="text-[13px] font-bold text-ink mb-1">로컬 표본으로 검증</h2>
      <p className="text-[12px] text-grey-500 mb-2">
        Drive 접근이 없을 때 PDF·영상 파일을 직접 올려 고정 사본으로 공개합니다. 검증용 경로이며 Drive 원본은 남지 않습니다.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <select aria-label="표본 과목" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setKeywordId(""); }} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
          <option value="">과목…</option>
          {subjects.filter((s) => !s.archivedAt).map((s) => (
            <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
          ))}
        </select>
        <select aria-label="표본 대표 키워드" value={keywordId} onChange={(e) => setKeywordId(e.target.value)} disabled={!subject} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 disabled:bg-grey-100">
          <option value="">대표 키워드(선택)…</option>
          {(subject?.keywords ?? []).map((k) => (
            <option key={k.id} value={k.id}>{k.label}</option>
          ))}
        </select>
        <input aria-label="표본 제목" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목(비우면 파일명)" className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5" />
        <input aria-label="표본 파일" name="file" type="file" accept="application/pdf,video/*" required className="text-[12.5px]" />
        <button type="submit" disabled={busy || !subjectId} className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
          {busy ? "올리는 중…" : "표본 등록·공개"}
        </button>
      </form>
      {error && <p className="text-[12.5px] text-red mt-2">{error}</p>}
    </section>
  );
}
