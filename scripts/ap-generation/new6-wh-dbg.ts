import { loadWhPool } from "./wh-pool";
const { pool } = loadWhPool({ requireScreen: false });
for (const c of pool.filter((p) => p.batch.includes("r19")).sort((a, b) => a.key.localeCompare(b.key))) console.log(c.key.split(":")[1], c.kind, "keyUnit", (c as unknown as { keyUnit: string }).keyUnit, c.members?.map((m) => `${m.unit}/${m.skill}`).join(" "), c.stim, c.fam, "era" in c ? (c as unknown as { era: number }).era : "", c.template);
