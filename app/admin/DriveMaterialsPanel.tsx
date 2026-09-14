"use client";

import { useState } from "react";
import type { AdminSubject } from "./subject-data";
import {
  importDriveFileAction,
  listKeywordDriveFilesAction,
  publishAssetDocAction,
  registerLocalSampleAssetAction,
  runCurriculumDriveFolderSyncAction,
  type DriveMaterialCandidate,
  type DriveMaterialListResult,
  type FolderSyncResult,
} from "./curriculum-asset-actions";

// Drive 자료 — 관리자 화면.
//
// 흐름: 과목 → 단원 → 키워드를 고르면 그 키워드 폴더의 파일이 후보로 뜬다.
//   등록   파일 하나 = 자료 한 건(초안). 공개되지 않는다.
//   공개   원본을 지금 내려받아 고정 사본을 만들고 공개한다. 실패하면 공개되지 않는다.
// 폴더 동기화는 ALTON 분류를 Drive 폴더로 반영한다(실제 쓰기 플래그가 꺼져 있으면 계획만).
// Drive 접근이 없을 때는 "로컬 표본"으로 PDF·영상을 올려 뷰어·필기를 검증할 수 있다.

export default function DriveMaterialsPanel({ subjects }: { subjects: AdminSubject[] }) {
  const [subjectId, setSubjectId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [keywordId, setKeywordId] = useState("");
  const [list, setList] = useState<DriveMaterialListResult | "loading" | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sync, setSync] = useState<FolderSyncResult | "running" | null>(null);

  const subject = subjects.find((s) => s.subjectId === subjectId);
  const unit = subject?.units.find((u) => u.id === unitId);
  // 키워드는 단원 하나에 속한다. 단원의 키워드 목록(keywordIds)을 후보로 쓴다.
  const keywords = (subject?.keywords ?? []).filter((k) => !unit || (unit.keywordIds ?? []).includes(k.id));

  // 과목이 바뀌면 단원·키워드·목록을 비운다 — 이벤트에서 함께 바꾼다(효과 안 setState 금지).
  function changeSubject(next: string) {
    setSubjectId(next);
    setUnitId("");
    setKeywordId("");
    setList(null);
  }

  async function refresh() {
    if (!keywordId) return;
    setList("loading");
    setNotice(null);
    setList(await listKeywordDriveFilesAction(keywordId));
  }

  async function importFile(f: DriveMaterialCandidate) {
    setBusyFile(f.fileId);
    setNotice(null);
    try {
      const r = await importDriveFileAction(keywordId, f.fileId);
      if (r.ok) await refresh(); // 목록을 새로 읽는다(등록됨 표시). 알림은 그 뒤에 남긴다.
      setNotice(r.ok ? `등록했습니다(초안): ${f.name}` : `등록하지 않았습니다 — ${r.error}`);
    } finally {
      setBusyFile(null);
    }
  }

  async function publish(f: DriveMaterialCandidate) {
    if (!f.registeredDocId) return;
    setBusyFile(f.fileId);
    setNotice(null);
    try {
      const r = await publishAssetDocAction(f.registeredDocId);
      setNotice(
        r.ok
          ? `공개했습니다: ${f.name} — 고정 사본 ${Math.round(r.bytes / 1024)}KB${r.pageCount ? ` · ${r.pageCount}쪽` : ""}`
          : `공개하지 않았습니다 — ${r.error}`
      );
    } finally {
      setBusyFile(null);
    }
  }

  async function runSync() {
    setSync("running");
    setSync(await runCurriculumDriveFolderSyncAction());
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">Drive 자료</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        Drive 의 키워드 폴더에 올린 PDF·영상을 자료로 가져옵니다. 업로드만으로는 공개되지 않고,
        공개할 때 그 시점의 파일을 고정 사본으로 확보합니다. 원본이 바뀌어도 공개 버전과 과거 수업은 그대로입니다.
      </p>

      <section className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3.5 mb-5">
        <h2 className="text-[13px] font-bold text-ink mb-1">폴더 동기화</h2>
        <p className="text-[12px] text-grey-500 mb-2">
          과목 → 단원 → 키워드 분류를 Drive 폴더로 반영합니다. 실제 쓰기 플래그가 꺼져 있으면 드라이브 접근만 확인하고 무엇을 만들지 계획만 보여줍니다.
          한 번에 한 계층씩 만들어지므로 과목 → 단원 → 키워드까지 세 번 실행합니다.
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
                : `연결됨: ${sync.driveName} · ${sync.outcome.dryRun ? "계획만(실제 쓰기 꺼짐)" : "반영"} — 만들 폴더 ${sync.outcome.created}개 · 이름 변경 ${sync.outcome.renamed}개 · 건너뜀 ${sync.outcome.skipped.length}개 · 실패 ${sync.outcome.failed.length}개 · 남은 대기 ${sync.pendingAfter}개`}
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

      <section className="mb-5">
        <h2 className="text-[13px] font-bold text-ink mb-2">키워드 폴더에서 불러오기</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          <select aria-label="과목" value={subjectId} onChange={(e) => changeSubject(e.target.value)} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5">
            <option value="">과목 고르기…</option>
            {subjects.filter((s) => !s.archivedAt).map((s) => (
              <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>
            ))}
          </select>
          <select aria-label="단원" value={unitId} onChange={(e) => { setUnitId(e.target.value); setKeywordId(""); setList(null); }} disabled={!subject} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 disabled:bg-grey-100">
            <option value="">단원 전체</option>
            {(subject?.units ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.position}. {u.unitTitle}</option>
            ))}
          </select>
          <select aria-label="키워드" value={keywordId} onChange={(e) => { setKeywordId(e.target.value); setList(null); }} disabled={!subject} className="text-[12.5px] border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 disabled:bg-grey-100">
            <option value="">키워드 고르기…</option>
            {keywords.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
          <button disabled={!keywordId || list === "loading"} onClick={() => void refresh()} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50">
            Drive 에서 불러오기 / 새로고침
          </button>
        </div>

        {notice && <p className="text-[12.5px] text-ink bg-grey-100 rounded-lg px-3 py-2 mb-2" data-testid="drive-notice">{notice}</p>}

        {list === "loading" && <p className="text-[12.5px] text-grey-500">Drive 를 읽는 중…</p>}
        {list && list !== "loading" && list.state === "not_configured" && (
          <p className="text-[12.5px] text-grey-500">교재 Drive 연결이 설정되지 않았습니다. 아래 로컬 표본으로 뷰어·필기를 검증할 수 있습니다.</p>
        )}
        {list && list !== "loading" && list.state === "folder_not_linked" && (
          <p className="text-[12.5px] text-red">{list.reason}</p>
        )}
        {list && list !== "loading" && list.state === "fetch_failed" && (
          <p className="text-[12.5px] text-red">Drive 를 읽지 못했습니다 — {list.reason}</p>
        )}
        {list && list !== "loading" && list.state === "ok" && (
          list.files.length === 0 ? (
            <p className="text-[12.5px] text-grey-500">이 키워드 폴더에 파일이 없습니다.</p>
          ) : (
            <ul>
              {list.files.map((f) => (
                <li key={f.fileId} className="flex items-center justify-between gap-3 border-[1.5px] border-grey-200 rounded-xl px-4 py-2.5 mb-2">
                  <div>
                    <div className="text-[13px] font-bold text-ink">
                      <span className="text-[10.5px] font-bold text-grey-500 border border-grey-200 rounded-full px-1.5 py-0.5 mr-1.5 align-middle">
                        {f.kind === "pdf" ? "PDF" : f.kind === "video" ? "영상" : "지원 안 함"}
                      </span>
                      {f.name}
                    </div>
                    <div className="text-[11.5px] text-grey-500">
                      {f.sizeBytes ? `${Math.round(f.sizeBytes / 1024)}KB` : ""}
                      {f.modifiedAt ? ` · 수정 ${new Date(f.modifiedAt).toLocaleString("ko-KR")}` : ""}
                      {f.registeredDocId ? " · 등록됨" : ""}
                    </div>
                  </div>
                  {f.kind && (
                    f.registeredDocId ? (
                      <button disabled={busyFile === f.fileId} onClick={() => void publish(f)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50 whitespace-nowrap">
                        {busyFile === f.fileId ? "사본 확보 중…" : "공개 (고정 사본)"}
                      </button>
                    ) : (
                      <button disabled={busyFile === f.fileId} onClick={() => void importFile(f)} className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50 whitespace-nowrap">
                        {busyFile === f.fileId ? "등록 중…" : "자료로 등록"}
                      </button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )
        )}
      </section>

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
