// 주입 결함 탐지 시험(무료 계층). launch 차단 결함 4종(오답 키 / 복수 정답 / 조건 누락 / 그림·표 오류)을 정상 문항에 주입하고
// 코드 게이트가 문항별로 잡는지 기록한다. 코드 게이트로 못 잡는 결함은 "미탐지"로 그대로 보고하고 유료 계층(독립 풀이·동결 검토기)에서 측정한다.
import { gateMc, type McPack } from "./gates";

export type DefectKind = "wrong_key" | "multiple_correct" | "missing_condition" | "wrong_figure";
export const DEFECT_KINDS: DefectKind[] = ["wrong_key", "multiple_correct", "missing_condition", "wrong_figure"];
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** 원형별로 "있어야 풀이·키가 성립하는 조건"을 지우는 규칙(검토 거친 목록). 조건이 불필요한 삭제는 결함이 아니므로 규칙이 없는 원형은 적용 불가(null). */
const MISSING_RULES: Record<string, (stem: string) => string> = {
  ivt: (t) => t.replace(/is continuous on/, "is defined on"),
  cont_piece: (t) => t.replace(/x\\ge\s*(\d)/, "x>$1"),
  diff_cont: (t) => t.replace(/x\\ge\s*(\d)/, "x>$1"),
  ftc_accum: (t) => t.replace(/is continuous, and/, "is defined, and"),
  separable_particular: (t) => t.replace(/\s+with \$f\(0\)=[^$]+\$/, ""),
  accum_context_calc: (t) => t.replace(/\s*At \$t=0\$ the tank contains \$[^$]+\$ gallons\./, ""),
  prop_integrals: (t) => t.replace(/\$\\int_2\^6 f\(x\)\\,dx=[^$]+\$,?\s*/, ""),
  area_setup: (t) => t.replace(/\s+and \$y=x\^2\$/, ""),
  related_rates: (t) => t.replace(/At the instant the radius is \$[^$]+\$ centimeters, h/, "H"),
  linearization: (t) => t.replace(/ at \$x=49\$/, ""),
  implicit_slope: (t) => t.replace(/\s+at the point \$\([^$]+\)\$/, ""),
  avg_value_calc: (t) => t.replace(/\s+on the interval \$\[[^$]+\]\$/, ""),
  product_table: (t) => t.replace(/If \$h\(x\)=[^$]+\$, w/, "W"),
};
export function injectMissingCondition(q: McPack): McPack | null {
  const rule = MISSING_RULES[q.archetype]; if (!rule) return null;
  const next = rule(q.stem); if (next === q.stem) return null;
  q.stem = next; return q;
}
export const MISSING_CONDITION_ARCHETYPES = Object.keys(MISSING_RULES);

/** 결함을 주입한다. 적용할 수 없는 문항(예: 표가 없음)이면 null. */
export function inject(p: McPack, kind: DefectKind): McPack | null {
  const q = clone(p);
  if (kind === "wrong_key") { q.key_index = (p.key_index + 1) % p.options.length; return q; }
  if (kind === "multiple_correct") {
    const d = p.options.findIndex((_, i) => i !== p.key_index); if (d < 0) return null;
    q.options[d].text = p.options[p.key_index].text; q.options[d].value = p.options[p.key_index].value; return q;
  }
  if (kind === "missing_condition") return injectMissingCondition(q);
  const rows = (q.stimulus?.data as { rows?: string[][] } | undefined)?.rows; if (!rows?.length) return null;
  const cell = rows[0][rows[0].length - 1]; const n = Number(cell); if (!Number.isFinite(n)) return null;
  rows[0][rows[0].length - 1] = String(Math.round((n * 1.5 + 1) * 1e4) / 1e4); return q;
}

export type InjectionRecord = { key: string; defect: DefectKind | "none"; applicable: boolean; detected: boolean; gates: string[] };
export function runInjection(items: { key: string; subject: string; pack: McPack }[]): InjectionRecord[] {
  const out: InjectionRecord[] = [];
  for (const it of items) {
    const base = gateMc(it.subject, it.pack);
    out.push({ key: it.key, defect: "none", applicable: true, detected: base.length > 0, gates: base }); // 정상 문항이 걸리면 오탐(false reject)
    for (const k of DEFECT_KINDS) {
      const q = inject(it.pack, k);
      if (!q) { out.push({ key: it.key, defect: k, applicable: false, detected: false, gates: [] }); continue; }
      const g = gateMc(it.subject, q).filter((x) => !base.includes(x));
      out.push({ key: it.key, defect: k, applicable: true, detected: g.length > 0, gates: g });
    }
  }
  return out;
}
export function summarizeInjection(rs: InjectionRecord[]) {
  const by = (d: string) => rs.filter((r) => r.defect === d && r.applicable);
  const res: Record<string, { applicable: number; detected: number; missed: string[] }> = {};
  for (const k of DEFECT_KINDS) { const a = by(k); res[k] = { applicable: a.length, detected: a.filter((r) => r.detected).length, missed: a.filter((r) => !r.detected).map((r) => r.key) }; }
  const good = by("none");
  return { byDefect: res, goodItems: good.length, falseRejects: good.filter((r) => r.detected).length, falseRejectKeys: good.filter((r) => r.detected).map((r) => r.key) };
}
