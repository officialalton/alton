// Parses the authoritative English legal source files in docs/contracts/ into
// plain structured data. Pure function (no I/O) so the generator and the drift
// test share exactly the same parsing.
export const RECORDING_HEADING = "Video Recording, Audio Recording, Transcription, and AI Lesson Notes";

/** @returns {{ title: string, versionLine: string | null, sections: { heading: string | null, blocks: ({t:'p',text:string}|{t:'h3',text:string}|{t:'ul',items:string[]})[] }[] }} */
export function parseContractMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let title = "";
  const sections = [{ heading: null, blocks: [] }];
  let current = sections[0];
  let bullets = null;
  const flush = () => {
    if (bullets) {
      current.blocks.push({ t: "ul", items: bullets });
      bullets = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      current = { heading: line.slice(3).trim(), blocks: [] };
      sections.push(current);
      continue;
    }
    if (line.startsWith("- ")) {
      bullets ??= [];
      bullets.push(line.slice(2).trim());
      continue;
    }
    flush();
    current.blocks.push(line === RECORDING_HEADING ? { t: "h3", text: line } : { t: "p", text: line });
  }
  flush();
  const pre = sections[0].blocks;
  const versionLine = pre.length > 0 && pre[0].t === "p" ? pre[0].text : null;
  if (versionLine) pre.shift();
  if (sections[0].blocks.length === 0) sections.shift();
  return { title, versionLine, sections };
}
