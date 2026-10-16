// 랜딩 페이지 리디자인(2026-09-25) — 디자인 목업의 인라인 SVG 아이콘 경로를
// 그대로 옮겨온 것. 목업이 여러 섹션(How it works·Roles·Trust·College)에서
// 같은 아이콘을 재사용하길래 한 곳에 모았다.
export const ICONS = {
  match:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M16 4.6a3.5 3.5 0 0 1 0 6.8 M18.5 14a6.5 6.5 0 0 1 3 6",
  lesson: "M3 5h18v11H3z M8 20h8 M12 16v4",
  feedback:
    "M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4V5.5Z",
  growth: "M4 19h16 M5 15l4-4 3 3 7-7 M15 7h4v4",
  homework:
    "M7 3h7l5 5v11.5a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 3Z M14 3v5h5 M9 13l2 2 4-4",
  goal: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M12 12h.01",
  cal: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12Z M4 10h16 M8 3v4 M16 3v4",
  report: "M6 3h12v18H6z M9 8h6 M9 12h6 M9 16h3",
  folder:
    "M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2h8A1.5 1.5 0 0 1 20.5 9v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V7Z",
  explore: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M15.5 8.5l-2 5-5 2 2-5 5-2Z",
  essay:
    "M7 3h7l5 5v11.5a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 3Z M14 3v5h5 M9 13h6 M9 17h4",
  lock: "M5.5 11h13v9h-13z M8.5 11V8a3.5 3.5 0 0 1 7 0v3",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, stroke = "#142240" }: { name: IconName; size?: number; stroke?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
