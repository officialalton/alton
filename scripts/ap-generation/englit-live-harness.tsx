// 브라우저에서 실행되는 하네스(englit-live-layout.ts 가 번들해 Chromium 에 올린다): 실제 LearningText + PassageRefsScope 를 클라이언트 렌더링한다.
import { createRoot } from "react-dom/client";
import LearningText from "../../app/session/[id]/LearningText";
import { PassageRefsScope } from "../../app/components/PassageRefs";

type Case = { passage: string; stems: string[] };
declare global { interface Window { __mount: (c: Case, legacy: boolean) => void; __origRects: Range["getClientRects"] } }
window.__origRects = Range.prototype.getClientRects;
let root: ReturnType<typeof createRoot> | null = null;
window.__mount = (c, legacy) => {
  if (legacy) (Range.prototype as { getClientRects?: unknown }).getClientRects = undefined; else Range.prototype.getClientRects = window.__origRects;
  const el = document.getElementById("app")!; root?.unmount(); root = createRoot(el);
  root.render(<PassageRefsScope><LearningText text={c.passage} className="text-[13.5px]" />{c.stems.map((s, i) => <div key={i} className="stem mt-2 text-[14px] font-semibold"><LearningText text={s} /></div>)}</PassageRefsScope>);
};
