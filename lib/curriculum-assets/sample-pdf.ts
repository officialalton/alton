// 검증용 최소 PDF — 비민감한 n페이지 문서를 바이트로 만든다.
//
// 2026-09-14 제품 오너: "비민감한 2페이지 PDF를 이용해 자료 등록·고정 버전 저장·페이지
// 표시"부터 검증한다. 외부 파일을 저장소에 넣지 않고 테스트가 스스로 만든다.
// PDF 1.4 최소 구조(카탈로그·페이지 트리·페이지·내용 스트림·표준 글꼴)이며,
// xref 오프셋을 실제 바이트 길이로 계산해 pdf.js 가 그대로 읽는다.

export function buildSamplePdf(pageTexts: string[]): Uint8Array {
  if (pageTexts.length === 0) throw new Error("페이지가 하나 이상 있어야 합니다.");
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  const catalogNo = add(""); // 자리만 — 페이지 트리 번호가 정해진 뒤 채운다
  const pagesNo = add("");
  const fontNo = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const pageNos: number[] = [];
  pageTexts.forEach((text, i) => {
    const safe = text.replace(/[\\()]/g, (c) => `\\${c}`);
    const stream = `BT /F1 24 Tf 72 720 Td (${safe}) Tj ET`;
    const contentNo = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageNo = add(
      `<< /Type /Page /Parent ${pagesNo} 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 ${fontNo} 0 R >> >> /Contents ${contentNo} 0 R >>`
    );
    pageNos.push(pageNo);
    void i;
  });

  objects[catalogNo - 1] = `<< /Type /Catalog /Pages ${pagesNo} 0 R >>`;
  objects[pagesNo - 1] =
    `<< /Type /Pages /Kids [${pageNos.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNos.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNo} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}
