import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";

// 공개 페이지 전용 폰트(2026-10-05 랜딩 v2: 영문 전용이라 KR 폰트는 뺀다). 루트 레이아웃이 아니라 공개 셸에서만 로드.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-bricolage" });
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-instrument" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const publicFontClass = `${bricolage.variable} ${instrument.variable} ${plexMono.variable}`;
