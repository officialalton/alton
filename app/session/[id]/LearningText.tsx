"use client";

import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePassageRefsRewrite, usePassageRefsStore } from "@/app/components/PassageRefs";
import { numberPassage, parsePassage, rowStartsFromTops, showsNumber, type LayoutRows, type PassageBlockModel } from "@/lib/ap-exam/passage-layout";
import { lineNumberLabels } from "@/lib/ap-exam/passage-lines";
import { splitLearningBlocks, splitLearningContent, type ContentPart } from "@/lib/render-learning-content";

/**
 * 교재·문제 본문 한 덩어리를 읽기 좋게 그린다. 글 줄바꿈은 그대로 살리고,
 * 섞여 있는 수식($...$, $$...$$)은 수식으로 그린다.
 *
 * 깨진 수식은 원문을 그대로 보여준다 — 학생 화면에서 내용이 사라지는 것이
 * 가장 나쁘고, 교사가 오타를 발견할 수 있어야 한다.
 */
// 2026-09-19(제품 오너 발견) — "200000"처럼 5자리 이상 정수가 천 단위 구분 쉼표 없이 그대로
// 나온 사례(옵션 텍스트: 지문·질문·선택지의 순수 텍스트 구간, 수식 $...$ 안은 건드리지 않는다 —
// 그건 KaTeX가 그대로 조판해야 하는 수식이다). 4자리 숫자(연도 등, 예: "2024")는 쉼표를 붙이면
// 오히려 어색해지므로 대상에서 뺀다. 소수의 소수부(".141592" 같은)는 정수가 아니므로 앞에 마침표가
// 있으면 건너뛴다.
function addThousandsSeparators(text: string): string {
  return text.replace(/(?<!\.)\b\d{5,}\b/g, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
}

// 2026-10-13(결과 화면 지연 점검): 수식 조판(KaTeX)이 렌더마다 동기 실행되므로 memo 로 감싸 text·className 이 그대로면 다시 계산하지 않는다
// (결과 화면에서 주석·필기 로드, 해설 언어 토글, 필터 전환 같은 부모 상태 변경이 문항 전체의 수식을 다시 조판하던 문제).
export default memo(function LearningText({ text, className }: { text: string; className?: string }) {
  // 2026-09-14 문제 템플릿 ②: 마크다운 파이프 표는 표로 그린다. 나머지 줄은 글·수식 조각.
  const blocks = splitLearningBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, b) =>
        block.kind === "table" ? (
          <div key={b} className="my-3 overflow-x-auto">
            <table className="learning-table text-[13.5px] border-collapse">
              <thead>
                <tr>
                  {block.header.map((h, i) => (
                    <th key={i} className="border border-grey-200 bg-grey-100 px-3 py-1.5 text-left font-bold">
                      <Inline parts={splitLearningContent(h)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td key={i} className="border border-grey-200 px-3 py-1.5">
                        <Inline parts={splitLearningContent(cell)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : block.kind === "code" ? (
          block.language === "passage" ? <PassageBlock key={b} lines={block.lines} /> : <CodeBlock key={b} language={block.language} lines={block.lines} />
        ) : block.kind === "list" ? (
          <ul key={b} className="my-2 pl-5 list-disc">
            {block.items.map((item, i) => (
              <li key={i} className="mb-1">
                <Inline parts={splitLearningContent(item)} />
              </li>
            ))}
          </ul>
        ) : (
          <Inline key={b} parts={splitLearningContent(block.text)} />
        )
      )}
    </div>
  );
});

/**
 * 코드 블록(2026-10-13, AP Computer Science A): 고정폭·줄 번호·가로 스크롤. 줄 번호는 선택·복사에 섞이지 않도록 `select-none`·aria-hidden 으로 두고,
 * 코드 글자는 이스케이프된 텍스트로만 그린다(dangerouslySetInnerHTML 없음 — `$`·`_`·`<` 가 수식·HTML 로 해석되지 않는다). 공백·들여쓰기는 그대로 보존한다.
 */
export function CodeBlock({ language, lines }: { language: string; lines: string[] }) {
  return (
    <pre data-testid="code-block" data-language={language} aria-label={`${language} code`} tabIndex={0} className="my-3 max-w-full overflow-x-auto rounded-lg border border-grey-200 bg-grey-50 py-2 text-[12.5px] leading-[1.55] text-ink">
      <code className="block min-w-max font-mono">
        {lines.map((ln, i) => (
          <span key={i} data-testid="code-line" className="flex whitespace-pre">
            <span aria-hidden="true" className="inline-block w-9 shrink-0 select-none pr-3 text-right text-grey-400">{i + 1}</span>
            <span className="pr-3">{ln === "" ? " " : ln}</span>
          </span>
        ))}
      </code>
    </pre>
  );
}

/**
 * 줄 번호가 있는 문학 지문(AP English Literature, 2026-10-14): ```passage 펜스. 빈 줄(연·문단 사이)은 줄로 세지 않고 번호는 5줄마다만 표시한다(lib/ap-exam/passage-lines.ts).
 * 시(원문 줄)는 줄마다 번호 열을 두고 긴 줄은 내어쓰기로 접는다(2026-10-15). 산문은 저장된 56자 접기를 문단으로 되돌려, 화면이 실제로 접은 행을 측정해 5행마다 번호를 붙인다
 * (2026-10-15 반응형 줄 번호: lib/ap-exam/passage-layout.ts). 측정 전(서버 렌더·JS 없음·측정 불가)에는 기존 56자 줄 표시를 그대로 쓴다. 글자는 이스케이프된 텍스트로만 그린다.
 */
export function PassageBlock({ lines }: { lines: string[] }) {
  const blocks = useMemo(() => parsePassage(lines), [lines]);
  const hasProse = blocks.some((b) => b.kind === "prose");
  const [live, setLive] = useState(false);
  const failed = useRef(false);
  useIsoLayoutEffect(() => { if (hasProse && canMeasure() && !failed.current) setLive(true); else setLive(false); }, [hasProse, lines]);
  if (!hasProse || !live) return <LegacyPassage lines={lines} />;
  return <LivePassage blocks={blocks} onFail={() => { failed.current = true; setLive(false); }} />;
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const canMeasure = () => typeof Range !== "undefined" && typeof Range.prototype.getClientRects === "function" && typeof document !== "undefined";
const NUM_LINE_HEIGHT = 23.8; // 14px × leading 1.7

function LegacyPassage({ lines }: { lines: string[] }) {
  const labels = lineNumberLabels(lines);
  return (
    <div data-testid="lit-passage" role="group" aria-label="Passage with line numbers" className="my-3 font-serif text-[14px] leading-[1.7] text-ink">
      {lines.map((ln, i) =>
        ln.trim() === "" ? <div key={i} className="h-3" aria-hidden="true" /> : (
          <div key={i} data-testid="passage-line" className="flex">
            <span aria-hidden="true" className="inline-block w-8 shrink-0 select-none pr-2 text-right font-sans text-[11px] text-grey-500">{labels[i] ?? ""}</span>
            <span className="min-w-0 whitespace-pre-wrap pl-6 -indent-6" data-testid="passage-line-text">{ln}</span>
          </div>
        ),
      )}
    </div>
  );
}

type Mark = { top: number; n: number };
type Measured = { layout: LayoutRows; marks: Mark[]; legacy: Array<{ from: number; to: number }>; sig: string };

/** 화면에 실제로 놓인 행을 읽는다: 산문은 단어마다 Range 상단 좌표로 행을 나누고, 번호는 문단 상단 + 행×줄높이에 둔다. 측정할 수 없으면 null. */
function measurePassage(root: HTMLElement, blocks: PassageBlockModel[]): Measured | null {
  const rootTop = root.getBoundingClientRect().top; const layout: LayoutRows = []; const pos: Array<number[]> = [];
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi]; layout.push(null); pos.push([]);
    if (b.kind === "blank") continue;
    const el = root.querySelector<HTMLElement>(`[data-b="${bi}"]`); if (!el) return null;
    const top = el.getBoundingClientRect().top - rootTop;
    if (b.kind === "poem") { pos[bi] = [top]; continue; }
    const node = el.firstChild; if (!node || node.nodeType !== 3) return null;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || NUM_LINE_HEIGHT; const tops: number[] = []; let off = 0; const r = document.createRange();
    for (const w of b.words) {
      r.setStart(node, off); r.setEnd(node, off + w.length); off += w.length + 1;
      const rect = r.getClientRects()[0]; if (!rect || rect.height === 0) return null; tops.push(rect.top);
    }
    const starts = rowStartsFromTops(tops); layout[bi] = starts; pos[bi] = starts.map((_s, k) => top + k * lh);
  }
  const num = numberPassage(blocks, layout); const marks: Mark[] = [];
  num.rows.forEach((rs, bi) => rs.forEach((n, k) => { if (showsNumber(n)) marks.push({ top: pos[bi][k], n }); }));
  return { layout, marks, legacy: num.legacy, sig: marks.map((m) => `${Math.round(m.top)}:${m.n}`).join("|") + "#" + JSON.stringify(layout) };
}

function LivePassage({ blocks, onFail }: { blocks: PassageBlockModel[]; onFail: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [m, setM] = useState<Measured | null>(null);
  const store = usePassageRefsStore(); const id = useId();
  const sig = useRef("");
  useIsoLayoutEffect(() => {
    const el = root.current; if (!el) return; let dead = false; let raf = 0;
    const run = (first: boolean) => {
      if (dead) return; const next = measurePassage(el, blocks);
      if (!next) { if (first) onFail(); return; }
      if (next.sig !== sig.current) { sig.current = next.sig; setM(next); }
    };
    run(true);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => run(false)); }) : null;
    ro?.observe(el);
    void document.fonts?.ready.then(() => run(false));
    return () => { dead = true; cancelAnimationFrame(raf); ro?.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);
  useEffect(() => { if (!store || !m) return; store.register(id, m.legacy); return () => store.unregister(id); }, [store, id, m]);
  return (
    <div ref={root} data-testid="lit-passage" data-live="1" role="group" aria-label="Passage with line numbers" className="relative my-3 pl-8 font-serif text-[14px] leading-[1.7] text-ink">
      {(m?.marks ?? []).map((k) => (
        <span key={k.n} data-testid="passage-number" aria-hidden="true" className="pointer-events-none absolute left-0 w-6 select-none text-right font-sans text-[11px] text-grey-500" style={{ top: k.top, lineHeight: `${NUM_LINE_HEIGHT}px` }}>{k.n}</span>
      ))}
      {blocks.map((b, bi) =>
        b.kind === "blank" ? <div key={bi} className="h-3" aria-hidden="true" />
        : b.kind === "poem" ? <div key={bi} data-b={bi} data-testid="passage-line" className="whitespace-pre-wrap pl-6 -indent-6">{b.line}</div>
        : <p key={bi} data-b={bi} data-testid="passage-para" className="m-0" style={{ textIndent: "1.5rem" }}>{b.words.join(" ")}</p>,
      )}
    </div>
  );
}

/** 한 줄 미리보기용: 블록(표·목록) 없이 글+수식만 그린다(truncate 안에서 수식이 원문 `$...$` 로 보이지 않게). */
export function InlineLearningText({ text }: { text: string }) {
  return <Inline parts={splitLearningContent(text)} />;
}

function Inline({ parts }: { parts: ContentPart[] }) {
  const refs = usePassageRefsRewrite();
  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === "text") {
          return (
            <span key={i} className="whitespace-pre-wrap">
              {refs(addThousandsSeparators(part.value))}
            </span>
          );
        }
        if (part.kind === "blank") {
          return (
            <span
              key={i}
              data-testid="rw-blank"
              aria-label="Blank"
              className="inline-block min-w-[7ch] border-b-[1.5px] border-ink align-baseline mx-0.5"
            >
              &nbsp;
            </span>
          );
        }
        if (part.kind === "underline") {
          return (
            <span key={i} className="underline decoration-ink underline-offset-4 whitespace-pre-wrap">
              {part.value}
            </span>
          );
        }
        if (part.kind === "code") {
          return (
            <code key={i} data-testid="code-inline" className="whitespace-pre-wrap rounded bg-grey-100 px-1 py-px font-mono text-[0.92em] text-ink">
              {part.value}
            </code>
          );
        }
        if (part.kind === "math-error") {
          return (
            <span
              key={i}
              title="Couldn't render this expression"
              className="whitespace-pre-wrap underline decoration-red decoration-dotted underline-offset-4"
            >
              {part.source}
            </span>
          );
        }
        return (
          <span
            key={i}
            // 블록 수식은 줄을 차지하고, 인라인 수식은 글 흐름에 붙는다.
            // 좁은 화면에서 긴 수식이 잘리지 않도록 블록 수식만 가로 스크롤을 허용한다.
            // 2026-09-19(제품 오너 발견) — 인라인 수식에도 overflow-x-auto를 걸어뒀더니
            // KaTeX가 만드는 strut(폭 없는 정렬용 요소)의 1px 미만 서브픽셀 오버플로만으로도
            // 브라우저가 항상 작은 스크롤바 알약을 그렸다(모든 인라인 수식 옆에 회색 캡슐이
            // 붙어 보이던 원인). 인라인 수식은 대부분 짧아 스크롤이 필요 없으므로 뺀다.
            className={part.display ? "block my-3 overflow-x-auto max-w-full" : "inline-block align-middle max-w-full"}
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        );
      })}
    </>
  );
}
