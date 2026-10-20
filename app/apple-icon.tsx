import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#142240" }}>
        <svg width="128" height="128" viewBox="0 0 46 46" fill="none">
          <path d="M23 5 L39 41 M23 5 L7 41" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
          <path d="M14 29 H32" stroke="#C8102E" strokeWidth="5" strokeLinecap="square" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
