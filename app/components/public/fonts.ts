import { DM_Sans, IBM_Plex_Mono, Instrument_Serif } from "next/font/google";
import "./public-theme.css";

// 공개 페이지 전용 폰트(랜딩 v3, 2026-10-05): 에디토리얼 세리프(Instrument Serif, 이탤릭 포함) + DM Sans + IBM Plex Mono.
// 영문 전용이라 KR 폰트는 뺀다. 루트 레이아웃이 아니라 공개 셸에서만 로드한다.
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-p-serif" });
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-p-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-p-mono" });

export const publicFontClass = `public-theme ${serif.variable} ${sans.variable} ${mono.variable}`;
