"use client";

import { useEffect, useRef } from "react";

// 영상 자료 — 같은 교재 영역에서 재생한다. 다른 자료로 이동하면 이 컴포넌트가 내려가며
// 정지한다(언마운트 때 pause). 영상 위 필기와 교사·학생 동시 재생 제어는 첫 버전에서
// 제외한다(2026-09-14).
export default function VideoMaterialPlayer({ url, mimeType, title }: { url: string; mimeType: string; title: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    return () => {
      try {
        el?.pause();
      } catch {
        // 이미 내려간 요소
      }
    };
  }, [url]);
  return (
    <div className="w-full">
      <video
        ref={ref}
        data-testid="video-material"
        controls
        preload="metadata"
        playsInline
        className="w-full max-h-[70vh] bg-black rounded-lg"
        aria-label={title}
      >
        <source src={url} type={mimeType} />
        이 브라우저는 영상을 재생하지 못합니다.
      </video>
    </div>
  );
}
