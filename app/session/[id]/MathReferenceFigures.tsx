// Math 참조표 도형 — 표준 기하 도형을 직접 그린 SVG(외부 이미지·저작물 복제 없음).
// 모의고사 Math 모듈의 Reference Sheet 가 쓴다(2026-10-02 제품 오너 지시: 참조표에 도형 그림 포함).

type Fig = { key: string; title: string; formulas: string[]; svg: React.ReactNode; wide?: boolean };

const ink = "currentColor";
const t = { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 11, fill: ink } as const;
const line = { stroke: ink, strokeWidth: 1.4, fill: "none" } as const;
const dash = { ...line, strokeDasharray: "3 3", strokeWidth: 1 } as const;

export const REFERENCE_FIGURES: Fig[] = [
  {
    key: "circle",
    title: "Circle",
    formulas: ["A = πr²", "C = 2πr"],
    svg: (
      <>
        <circle cx="60" cy="45" r="32" {...line} />
        <line x1="60" y1="45" x2="92" y2="45" {...line} />
        <circle cx="60" cy="45" r="2.5" fill={ink} />
        <text x="74" y="40" {...t}>r</text>
      </>
    ),
  },
  {
    key: "rectangle",
    title: "Rectangle",
    formulas: ["A = ℓw"],
    svg: (
      <>
        <rect x="14" y="26" width="84" height="40" {...line} />
        <text x="52" y="20" {...t}>ℓ</text>
        <text x="104" y="49" {...t}>w</text>
      </>
    ),
  },
  {
    key: "triangle",
    title: "Triangle",
    formulas: ["A = ½bh"],
    svg: (
      <>
        <path d="M12 72 L108 72 L72 16 Z" {...line} />
        <line x1="72" y1="16" x2="72" y2="72" {...dash} />
        <path d="M72 64 L80 64 L80 72" {...line} />
        <text x="76" y="48" {...t}>h</text>
        <text x="58" y="85" {...t}>b</text>
      </>
    ),
  },
  {
    key: "right-triangle",
    title: "Right triangle",
    formulas: ["c² = a² + b²"],
    svg: (
      <>
        <path d="M18 72 L18 18 L100 72 Z" {...line} />
        <path d="M18 64 L26 64 L26 72" {...line} />
        <text x="8" y="48" {...t}>b</text>
        <text x="56" y="85" {...t}>a</text>
        <text x="64" y="38" {...t}>c</text>
      </>
    ),
  },
  {
    key: "special",
    title: "Special right triangles",
    formulas: ["30°–60°–90°: x, x√3, 2x", "45°–45°–90°: s, s, s√2"],
    wide: true,
    svg: (
      <>
        <path d="M8 74 L8 22 L68 74 Z" {...line} transform="translate(0 0)" />
        <path d="M8 66 L16 66 L16 74" {...line} />
        <text x="14" y="36" style={{ ...t, fontSize: 9 }}>60°</text>
        <text x="46" y="72" style={{ ...t, fontSize: 9 }}>30°</text>
        <text x="-2" y="52" {...t}>x</text>
        <text x="26" y="86" {...t}>x√3</text>
        <text x="42" y="42" {...t}>2x</text>
        <path d="M100 74 L100 22 L152 74 Z" {...line} transform="translate(0 0)" />
        <path d="M100 66 L108 66 L108 74" {...line} />
        <text x="90" y="52" {...t}>s</text>
        <text x="122" y="86" {...t}>s</text>
        <text x="132" y="42" {...t}>s√2</text>
        <text x="106" y="38" style={{ ...t, fontSize: 9 }}>45°</text>
        <text x="132" y="70" style={{ ...t, fontSize: 9 }}>45°</text>
      </>
    ),
  },
  {
    key: "box",
    title: "Rectangular solid",
    formulas: ["V = ℓwh"],
    svg: (
      <>
        <path d="M14 32 L74 32 L74 74 L14 74 Z" {...line} />
        <path d="M14 32 L34 16 L94 16 L74 32" {...line} />
        <path d="M94 16 L94 58 L74 74" {...line} />
        <path d="M34 16 L34 58 L14 74" {...dash} />
        <path d="M34 58 L94 58" {...dash} />
        <text x="40" y="86" {...t}>ℓ</text>
        <text x="100" y="40" {...t}>w</text>
        <text x="4" y="56" {...t}>h</text>
      </>
    ),
  },
  {
    key: "cylinder",
    title: "Right circular cylinder",
    formulas: ["V = πr²h"],
    svg: (
      <>
        <ellipse cx="60" cy="22" rx="32" ry="9" {...line} />
        <path d="M28 22 L28 70 M92 22 L92 70" {...line} />
        <path d="M28 70 A32 9 0 0 0 92 70" {...line} />
        <path d="M28 70 A32 9 0 0 1 92 70" {...dash} />
        <line x1="60" y1="22" x2="92" y2="22" {...line} />
        <circle cx="60" cy="22" r="2" fill={ink} />
        <text x="72" y="18" {...t}>r</text>
        <text x="98" y="50" {...t}>h</text>
      </>
    ),
  },
  {
    key: "sphere",
    title: "Sphere",
    formulas: ["V = (4/3)πr³"],
    svg: (
      <>
        <circle cx="60" cy="45" r="32" {...line} />
        <ellipse cx="60" cy="45" rx="32" ry="9" {...dash} />
        <line x1="60" y1="45" x2="92" y2="45" {...line} />
        <circle cx="60" cy="45" r="2" fill={ink} />
        <text x="72" y="41" {...t}>r</text>
      </>
    ),
  },
  {
    key: "cone",
    title: "Right circular cone",
    formulas: ["V = ⅓πr²h"],
    svg: (
      <>
        <path d="M28 70 L60 8 L92 70" {...line} />
        <path d="M28 70 A32 9 0 0 0 92 70" {...line} />
        <path d="M28 70 A32 9 0 0 1 92 70" {...dash} />
        <line x1="60" y1="8" x2="60" y2="70" {...dash} />
        <line x1="60" y1="70" x2="92" y2="70" {...dash} />
        <text x="64" y="44" {...t}>h</text>
        <text x="74" y="66" {...t}>r</text>
      </>
    ),
  },
  {
    key: "pyramid",
    title: "Rectangular pyramid",
    formulas: ["V = ⅓ℓwh"],
    svg: (
      <>
        <path d="M14 70 L74 70 L102 52 L42 52 Z" {...line} strokeDasharray="0" />
        <path d="M58 8 L14 70 M58 8 L74 70 M58 8 L102 52" {...line} />
        <path d="M58 8 L42 52" {...dash} />
        <line x1="58" y1="8" x2="58" y2="61" {...dash} />
        <text x="62" y="40" {...t}>h</text>
        <text x="40" y="84" {...t}>ℓ</text>
        <text x="96" y="68" {...t}>w</text>
      </>
    ),
  },
];

export function ReferenceFigureGrid() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3" data-testid="reference-figures">
      {REFERENCE_FIGURES.map((f) => (
        <figure key={f.key} className={`m-0 text-center ${f.wide ? "sm:col-span-2 col-span-2" : ""}`} data-testid={`ref-fig-${f.key}`}>
          <svg
            viewBox={f.wide ? "0 0 160 92" : "0 0 120 92"}
            role="img"
            aria-label={f.title}
            className={`mx-auto h-[84px] ${f.wide ? "w-[190px]" : "w-[110px]"} text-ink`}
          >
            {f.svg}
          </svg>
          <figcaption className="mt-1 text-[11.5px] leading-snug">
            <span className="block text-[10.5px] font-bold uppercase tracking-wide text-grey-500">{f.title}</span>
            {f.formulas.map((fm) => (
              <span key={fm} className="block font-serif">{fm}</span>
            ))}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
