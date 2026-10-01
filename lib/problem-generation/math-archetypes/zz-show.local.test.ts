import { it } from "vitest";
import { figureArchetypes } from "@/lib/problem-generation/math-archetypes/figure-coverage-gate";
import { generateOne } from "@/lib/problem-generation/math-archetypes/sweep";
it("show", () => { for (const id of process.env.IDS!.split(",")) { const a = figureArchetypes().find((x) => x.id === id)!; const g = generateOne(a, Number(process.env.SEED ?? 5)); if (!g.ok) { console.log(id, g); continue; } const i = g.inst; console.log(`== ${id}\n${i.stimulus}\nQ: ${i.question}\nO: ${i.options.join(" | ")} [${i.correctIndex}]\nFIG: ${JSON.stringify(i.figure)}\nEXP: ${i.explanation}\n`); } });
