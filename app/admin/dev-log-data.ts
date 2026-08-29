import fs from "fs";
import path from "path";

export function loadDevLog(): string {
  return fs.readFileSync(path.join(process.cwd(), "docs/tickets.md"), "utf-8");
}
