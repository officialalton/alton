"use client";

// 루트 레이아웃 자체가 실패했을 때의 마지막 방어선(자체 <html>/<body> 필요, 전역 CSS 없음 → 인라인 스타일).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F8F5EF", color: "#142240" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div role="alert" style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>Something went wrong</h1>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "#4F5A6B", margin: "0 0 16px" }}>
              Please try again. If the problem continues, email official@alton.education.
            </p>
            <button type="button" onClick={reset} style={{ height: 44, padding: "0 20px", borderRadius: 12, border: 0, background: "#C8102E", color: "#fff", fontSize: 14, fontWeight: 600, marginRight: 8 }}>
              Try again
            </button>
            <a href="/login" style={{ display: "inline-block", lineHeight: "42px", height: 44, padding: "0 20px", borderRadius: 12, border: "1px solid #142240", color: "#142240", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
              Back to sign in
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
