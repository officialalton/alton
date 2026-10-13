"use client";

// 파트별 손글씨 상태·자동 저장(ApExamTakeClient 전용). 로드 1회(획 포함), 획이 끝날 때마다 디바운스 저장, 문항 이동·제출 전 flush.
import { useCallback, useEffect, useRef, useState } from "react";
import { loadFrqHandwritingAction, saveFrqHandwritingAction } from "@/lib/mock-exam/attempt-actions";
import { INK_H, inkKey, inkSizeProblem, strokesToSvg, type InkStroke } from "@/lib/ap-exam/frq-ink";

const INK_AUTOSAVE_MS = 1200;

export function useFrqInk(attemptId: string, enabled: boolean, onStatus: (s: "saving" | "saved" | "error", error?: string) => void) {
  const [ink, setInk] = useState<Record<string, InkStroke[]>>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(enabled ? "loading" : "ready");
  const [heights, setHeights] = useState<Record<string, number>>({});
  const heightsRef = useRef(heights);
  const inkRef = useRef(ink);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirty = useRef<Set<string>>(new Set());
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadFrqHandwritingAction(attemptId, true).then((r) => {
      if (cancelled) return;
      if (!r.ok) { setLoadState("error"); return; }
      const next: Record<string, InkStroke[]> = {};
      const hs: Record<string, number> = {};
      for (const row of r.value) {
        const k = inkKey(row.setItemId, row.partLabel);
        if (row.strokes?.length) next[k] = row.strokes;
        if (row.boardHeight) hs[k] = row.boardHeight;
      }
      inkRef.current = { ...next, ...inkRef.current };
      heightsRef.current = { ...hs, ...heightsRef.current };
      setInk(inkRef.current); setHeights(heightsRef.current);
      setLoadState("ready");
    });
    return () => { cancelled = true; };
  }, [attemptId, enabled]);

  const saveKey = useCallback(async (key: string) => {
    if (timers.current[key]) { clearTimeout(timers.current[key]); delete timers.current[key]; }
    if (!dirty.current.has(key)) return;
    dirty.current.delete(key);
    const idx = key.lastIndexOf(":");
    const strokes = inkRef.current[key] ?? [];
    statusRef.current("saving");
    const r = await saveFrqHandwritingAction(attemptId, key.slice(0, idx), key.slice(idx + 1), strokes, strokes.length ? strokesToSvg(strokes, heightsRef.current[key] ?? INK_H) : "", heightsRef.current[key] ?? INK_H);
    if (r.ok) statusRef.current("saved");
    else { dirty.current.add(key); statusRef.current("error", r.error); }
  }, [attemptId]);

  const commit = useCallback((setItemId: string, label: string, strokes: InkStroke[]) => {
    const key = inkKey(setItemId, label);
    inkRef.current = { ...inkRef.current, [key]: strokes };
    setInk(inkRef.current);
    const problem = inkSizeProblem(strokes, heightsRef.current[key] ?? INK_H);
    if (problem) { statusRef.current("error", problem); return; }
    dirty.current.add(key);
    statusRef.current("saving");
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => { void saveKey(key); }, INK_AUTOSAVE_MS);
  }, [saveKey]);

  /** 보드 높이만 바꾼다(획은 그대로). 저장 경로는 획 저장과 같다. */
  const resize = useCallback((setItemId: string, label: string, height: number) => {
    const key = inkKey(setItemId, label);
    heightsRef.current = { ...heightsRef.current, [key]: height };
    setHeights(heightsRef.current);
    dirty.current.add(key);
    statusRef.current("saving");
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => { void saveKey(key); }, INK_AUTOSAVE_MS);
  }, [saveKey]);

  const flush = useCallback(async () => { await Promise.all([...dirty.current].map((k) => saveKey(k))); }, [saveKey]);
  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const hasInk = useCallback((setItemId: string) => Object.entries(ink).some(([k, v]) => k.startsWith(`${setItemId}:`) && v.length > 0), [ink]);
  return { ink, heights, loadState, commit, resize, flush, hasInk };
}
