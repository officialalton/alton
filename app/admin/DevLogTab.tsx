function LogLine({ line }: { line: string }) {
  if (line.startsWith("## ")) {
    return <h2 className="text-[16px] font-extrabold text-ink mt-6 mb-2">{line.slice(3)}</h2>;
  }
  if (line.startsWith("# ")) {
    return <h1 className="text-[19px] font-extrabold text-ink mt-2 mb-3">{line.slice(2)}</h1>;
  }
  if (line.startsWith("- [x]") || line.startsWith("- [X]")) {
    return (
      <p className="text-[13px] leading-[1.7] text-grey-500 mb-1.5">
        <span className="text-green font-bold mr-1.5">✓</span>
        {line.slice(5).trim()}
      </p>
    );
  }
  if (line.startsWith("- [ ]")) {
    return (
      <p className="text-[13px] leading-[1.7] text-ink font-semibold mb-1.5">
        <span className="text-grey-300 font-bold mr-1.5">○</span>
        {line.slice(5).trim()}
      </p>
    );
  }
  if (!line.trim()) {
    return null;
  }
  return <p className="text-[13px] leading-[1.7] text-grey-500 mb-1.5">{line}</p>;
}

export default function DevLogTab({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="max-w-[860px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">개발 로그</h1>
      <p className="text-[13px] text-grey-500 mb-6">
        docs/tickets.md 기준 — 완료된 작업과 진행 예정 항목을 그대로 보여줍니다.
      </p>
      <div>
        {lines.map((line, i) => (
          <LogLine key={i} line={line} />
        ))}
      </div>
    </div>
  );
}
