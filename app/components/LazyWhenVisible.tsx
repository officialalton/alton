"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 긴 목록(AP 결과 48~70문항 등)에서 화면 근처에 올 때까지 무거운 본문을 그리지 않는다.
 * - eager: 서버 렌더·첫 렌더부터 그린다(맨 앞 몇 개).
 * - 그 밖은 자리표시(최소 높이)만 서버가 내보내고, 클라이언트에서 뷰포트 `rootMargin` 안에 들어오면 한 번 그린다. 한 번 그린 뒤에는 유지한다.
 * - IntersectionObserver 가 없는 환경(구형 브라우저·jsdom)은 즉시 그린다 — 내용이 영영 안 보이는 일이 없도록.
 */
export default function LazyWhenVisible({
  eager = false,
  minHeight = 200,
  rootMargin = "1200px 0px",
  children,
}: {
  eager?: boolean;
  minHeight?: number;
  rootMargin?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(eager);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (shown) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown, rootMargin]);
  if (shown) return <>{children}</>;
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" data-testid="lazy-placeholder" />;
}
