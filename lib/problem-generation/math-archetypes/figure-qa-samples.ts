// 시각 검수용 조합 샘플 선택 — 조합(항목)마다 고정 시드로 대표 문항을 뽑는다. figure 종류(type·kind·선택지/복수 자료의 자식 종류)가 다른 hard 원형은 서로 다른 샘플로 하나씩 더 뽑는다.
// 선택지형은 figure_choice 가 4개 선택지 그림을 모두 한 화면에 그린다. 이 샘플을 앱 렌더 경로(ProblemFigure)로 그려 PNG 로 만들고(figure-qa-render.mjs), 검수자가 판정한다.
import { figureArchetypes } from "./figure-coverage-gate";
import { generateOne } from "./sweep";
import type { LArch } from "./levels-d";
import type { Instance } from "./types";

export const QA_SEED = 11;
export type QaSample = { a: LArch; seed: number; inst: Instance; signature: string; types: string[]; file: string };

export function figureSignature(fig: unknown): { signature: string; types: string[] } {
  const f = fig as { type?: string; kind?: string; choices?: { type?: string; kind?: string }[]; figures?: { spec: { type?: string; kind?: string } }[] } | null;
  if (!f) return { signature: "none", types: [] };
  const one = (x: { type?: string; kind?: string }) => `${x.type}${x.kind ? `:${x.kind}` : ""}`;
  if (f.type === "figure_choice") return { signature: `figure_choice[${one(f.choices![0])}]`, types: ["figure_choice", ...new Set(f.choices!.map((c) => c.type!))] };
  if (f.type === "figure_set") return { signature: `figure_set[${one(f.figures![0].spec)}]`, types: ["figure_set", ...new Set(f.figures!.map((c) => c.spec.type!))] };
  return { signature: one(f), types: [f.type!] };
}
export function qaSamples(itemId: string): QaSample[] {
  const hard = figureArchetypes().filter((a) => a.figureItem === itemId && a.level === "hard"); const out: QaSample[] = []; const seen = new Set<string>();
  for (const a of hard) {
    let found: { seed: number; inst: Instance } | null = null;
    for (let s = QA_SEED; s < QA_SEED + 60 && !found; s++) { const g = generateOne(a, s); if (g.ok) found = { seed: s, inst: g.inst }; }
    if (!found) continue; const sig = figureSignature(found.inst.figure); if (seen.has(sig.signature)) continue; seen.add(sig.signature);
    out.push({ a, seed: found.seed, inst: found.inst, signature: sig.signature, types: sig.types, file: out.length === 0 ? `${itemId}.png` : `${itemId}~${a.operator}.png` });
  }
  return out;
}
export const qaItemIds = (): string[] => [...new Set(figureArchetypes().map((a) => a.figureItem!))];
