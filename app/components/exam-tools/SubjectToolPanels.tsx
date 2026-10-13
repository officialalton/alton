"use client";

import { useEffect, useState, type ComponentType } from "react";
import { GraphingCalculator, type MathToolsOpen } from "@/app/session/[id]/MockExamMathTools";
import type { CalculatorTab, ReferenceKind, SubjectToolsConfig } from "@/lib/exam-tools/subject-tools";
import StatsCalculator from "./StatsCalculator";
import StatsReference from "./StatsReference";
import { TabBar } from "./Tabs";

// 과목별 도구 패널(계산기 팝업 + 참조 팝업). 과목 구성은 lib/exam-tools/subject-tools.ts.
// 새 과목(물리 참조 정보, 화학 주기율표 등)은 REFERENCE_PANELS / CALCULATOR_TABS에 컴포넌트를 추가한다.
const DesmosTab = () => <div className="h-full p-2"><GraphingCalculator heightClassName="h-full" /></div>;

const CALCULATOR_TABS: Record<CalculatorTab, { label: string; Component: ComponentType }> = {
  statistics: { label: "Statistics", Component: StatsCalculator },
  desmos: { label: "Graphing (Desmos)", Component: DesmosTab },
};
const REFERENCE_PANELS: Record<ReferenceKind, { title: string; Component: ComponentType }> = {
  statistics: { title: "Reference", Component: StatsReference },
};

function Modal({ label, show, onClose, closeTestId, children, header }: { label: string; show: boolean; onClose: () => void; closeTestId: string; children: React.ReactNode; header?: React.ReactNode }) {
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show, onClose]);
  return (
    <div className={`fixed inset-0 z-50 items-center justify-center bg-black/40 p-2 sm:p-4 ${show ? "flex" : "hidden"}`} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grey-200 px-3 py-2">
          <span className="text-[12px] font-extrabold text-grey-500">{label}</span>
          {header}
          <button type="button" onClick={onClose} className="min-h-[36px] px-2 text-[12px] font-bold text-grey-500 underline" data-testid={closeTestId}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function SubjectToolPanels({ config, calculatorAllowed, open, onClose }: { config: SubjectToolsConfig; calculatorAllowed: boolean; open: MathToolsOpen; onClose: () => void }) {
  const tabs = config.calculatorTabs;
  const [tab, setTab] = useState<CalculatorTab>(tabs[0]);
  const [visited, setVisited] = useState<CalculatorTab[]>([]);
  const [calcMounted, setCalcMounted] = useState(false);

  useEffect(() => {
    // 계산기는 처음 열 때 마운트하고 이후에는 CSS로만 숨긴다 — 입력한 값과 Desmos 수식이 유지된다.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 열림 상태에 맞춘 지연 마운트(관용 패턴)
    if (open === "calculator") setCalcMounted(true);
  }, [open]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 보고 있는 탭만 마운트
    if (open === "calculator") setVisited((v) => (v.includes(tab) ? v : [...v, tab]));
  }, [open, tab]);

  const Ref = config.reference ? REFERENCE_PANELS[config.reference] : null;
  return (
    <>
      {calculatorAllowed && calcMounted && (
        <Modal label="Calculator" show={open === "calculator"} onClose={onClose} closeTestId="close-calculator"
          header={tabs.length > 1 ? <TabBar tabs={tabs.map((t) => ({ id: t, label: CALCULATOR_TABS[t].label }))} value={tab} onChange={setTab} label="Calculator type" idPrefix="calc" /> : undefined}>
          <div className="min-h-0 flex-1">
            {tabs.map((t) => {
              const C = CALCULATOR_TABS[t].Component;
              return (
                <div key={t} role="tabpanel" id={`calc-panel-${t}`} aria-labelledby={`calc-tab-${t}`} className={`h-full ${tab === t ? "" : "hidden"}`}>
                  {visited.includes(t) || tab === t ? <C /> : null}
                </div>
              );
            })}
          </div>
        </Modal>
      )}
      {Ref && open === "reference" && (
        <Modal label={Ref.title} show onClose={onClose} closeTestId="close-reference">
          <Ref.Component />
        </Modal>
      )}
    </>
  );
}
