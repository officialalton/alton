// 직선·곡선 라벨 규칙(제품 오너 승인 2026-10-05): 직선·곡선의 `label`(ℓ, l1, y 등)은 그 글자가 문제 텍스트(지문·질문·선택지)에
// 실제로 나올 때만 그린다 — 본문이 가리키지 않는 라벨은 학생에게 의미 없는 장식이므로 렌더 전에 뺀다.
// 순수 함수. 점·다각형·원 등 다른 객체의 라벨은 건드리지 않는다(꼭짓점·점 이름은 풀이에 필요하다).

/** 라벨 비교용 정규화: LaTeX 기호를 풀고 공백·$ 를 없앤다(`$\ell$` ≈ ℓ). */
const norm = (s: string) => s.replace(/\$/g, "").replace(/\\ell\b/g, "ℓ").replace(/\\(?:mathit|text|mathrm)\{([^{}]*)\}/g, "$1").replace(/[{}\\]/g, "").replace(/\s+/g, "");

/** 라벨이 문제 텍스트에 나오는가. 영숫자 라벨은 단어 경계(앞뒤가 글자·숫자가 아님)로만 센다 — "y" 가 "yes" 에 걸리지 않게. */
export function labelMentioned(label: string, text: string): boolean {
  const l = norm(label); if (!l) return false;
  // 라벨 글자 사이의 공백은 있어도 없어도 된다("y=x+1" ≈ "y = x + 1").
  const body = [...l].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "u");
  const loose = text.replace(/\$/g, " ").replace(/\\ell\b/g, "ℓ").replace(/\\(?:mathit|text|mathrm)\{([^{}]*)\}/g, "$1").replace(/[{}\\]/g, " ");
  return re.test(loose);
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function pruneObject(o: Json, text: string): Json {
  const out: Json = { ...o };
  const kind = out.kind;
  const lineLike = kind === "line" || kind === "function" || kind === "inequality" || kind === "piecewise" || kind === "polyline";
  if (lineLike && typeof out.label === "string" && !labelMentioned(out.label, text)) delete out.label;
  if (kind === "scatter" && isObj(out.fitLine) && typeof out.fitLine.label === "string" && !labelMentioned(out.fitLine.label, text)) {
    const fit = { ...out.fitLine }; delete fit.label; out.fitLine = fit;
  }
  return out;
}

/** 그림 데이터(spec)에서 문제 텍스트에 안 나오는 직선·곡선 라벨을 뺀 사본을 돌려준다. 바뀐 게 없으면 같은 객체를 돌려준다. */
export function pruneUnmentionedLineLabels<T>(spec: T, text: string): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) { let ch = false; const r = v.map((x) => { const y = walk(x); if (y !== x) ch = true; return y; }); return ch ? r : v; }
    if (!isObj(v)) return v;
    let cur: Json = v; let ch = false;
    const set = (k: string, nv: unknown) => { if (nv !== cur[k]) { if (!ch) { cur = { ...cur }; ch = true; } cur[k] = nv; } };
    if ((v.type === "plane" && Array.isArray(v.objects)) || (v.type === "coordinate_plane" && Array.isArray(v.items))) {
      const key = v.type === "plane" ? "objects" : "items";
      const arr = v[key] as unknown[]; let any = false;
      const mapped = arr.map((it) => { if (!isObj(it)) return it; const p = pruneObject(it, text); if (JSON.stringify(p) === JSON.stringify(it)) return it; any = true; return p; });
      if (any) set(key, mapped);
    } else {
      for (const k of Object.keys(v)) if (k === "choices" || k === "figures" || k === "spec" || k === "stem") set(k, walk(v[k]));
    }
    return cur;
  };
  return walk(spec) as T;
}

/** 지문·질문·선택지(문자열 또는 문자열 목록, 없을 수 있음)를 이어 문제 텍스트 하나로 만든다. */
export function problemText(...parts: (string | readonly string[] | null | undefined)[]): string {
  return parts.flatMap((p) => (p == null ? [] : typeof p === "string" ? [p] : p)).join("\n");
}
