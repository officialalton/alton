import { ImageResponse } from "next/og";

// 텍스트 기반 대표 이미지(외부 폰트·이미지 없음).
export const alt = "ALTON — Free SAT & AP Practice Tests";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#142240", color: "#ffffff" }}>
        <div style={{ display: "flex", width: 120, height: 8, background: "#C8102E", marginBottom: 40 }} />
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: -2 }}>ALTON</div>
        <div style={{ fontSize: 52, marginTop: 24, lineHeight: 1.2 }}>Free SAT &amp; AP Practice Tests</div>
        <div style={{ fontSize: 30, marginTop: 28, opacity: 0.75 }}>Learning tools and premium tutoring when you need more support</div>
      </div>
    ),
    size,
  );
}
