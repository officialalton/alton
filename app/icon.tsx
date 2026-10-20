import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// ALTON 로고의 'A' 만 쓴 파비콘(진한 남색 바탕에 흰 A, 가로선만 포인트 레드).
export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#142240", borderRadius: 14 }}>
        <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
          <path d="M23 5 L39 41 M23 5 L7 41" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M14 29 H32" stroke="#C8102E" strokeWidth="5" strokeLinecap="square" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
