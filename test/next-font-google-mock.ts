// vitest는 Next.js의 next/font 웹팩 로더를 거치지 않으므로, 실제 폰트 로더를
// 흉내 낸 가벼운 스텁으로 대체한다(app/page.tsx, app/layout.tsx의 next/font/google 사용 대응).
function makeFontLoader() {
  return () => ({
    className: "mock-font-class",
    variable: "mock-font-variable",
    style: { fontFamily: "mock-font" },
  });
}

export const Inter = makeFontLoader();
export const Noto_Sans_KR = makeFontLoader();
export const Bricolage_Grotesque = makeFontLoader();
export const Instrument_Sans = makeFontLoader();
export const IBM_Plex_Mono = makeFontLoader();
export const IBM_Plex_Sans_KR = makeFontLoader();
