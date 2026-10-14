import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/session/[id]/MockExamMathTools", () => ({ GraphingCalculator: () => <div data-testid="desmos-stub" /> }));

import SubjectToolPanels from "./SubjectToolPanels";
import StatsCalculator from "./StatsCalculator";
import { subjectToolsConfig } from "@/lib/exam-tools/subject-tools";
import { evalScientific } from "./PhysicsCalculator";
import { CHEMISTRY_REF_DISCLAIMER, CHEMISTRY_CONSTANTS, CHEMISTRY_ELEMENTS, elementPosition } from "@/lib/exam-tools/chemistry-reference";
import { PHYSICS_REF_DISCLAIMER, PHYSICS_CONSTANTS } from "@/lib/exam-tools/physics-reference";
import { JAVA_REF_DISCLAIMER, JAVA_GROUPS } from "@/lib/exam-tools/java-reference";
import { MICRO_REF_DISCLAIMER, MICRO_GROUPS } from "@/lib/exam-tools/micro-reference";
import { evalBasic } from "./BasicCalculator";
import { parseNum, STATS_MODES } from "@/lib/stats-calc/modes";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const stats = subjectToolsConfig("ap_statistics");

function setMode(id: string) { fireEvent.change(screen.getByTestId("stats-mode"), { target: { value: id } }); }
function fill(id: string, mode: string, key: string, value: string) { fireEvent.change(document.getElementById(`stats-${mode}-${key}`)!, { target: { value } }); void id; }
function calc() { fireEvent.click(screen.getByTestId("stats-calculate")); }

describe("과목 도구 구성", () => {
  it("통계는 계산기(Statistics+Desmos)와 Reference를 갖고, 다른 과목은 Desmos만", () => {
    expect(stats.calculatorTabs).toEqual(["statistics", "desmos"]);
    expect(stats.reference).toBe("statistics");
    expect(subjectToolsConfig("ap_calculus_ab")).toEqual({ calculatorTabs: ["desmos"], reference: null });
    expect(subjectToolsConfig(null).reference).toBeNull();
  });
  it("영어(English Language)는 계산기도 Reference 도 없다(기본값 Desmos 로 떨어지지 않는다)", () => {
    expect(subjectToolsConfig("ap_english_language")).toEqual({ calculatorTabs: [], reference: null });
  });
});

describe("SubjectToolPanels", () => {
  it("계산기: Statistics 탭이 기본, Desmos는 탭을 누를 때만 마운트, 입력값은 탭 전환 후에도 유지", () => {
    render(<SubjectToolPanels config={stats} calculatorAllowed open="calculator" onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Calculator" })).toBeInTheDocument();
    expect(screen.getByTestId("stats-calculator")).toBeInTheDocument();
    expect(screen.queryByTestId("desmos-stub")).toBeNull();
    setMode("invnorm");
    fill("", "invnorm", "area", "0.9");
    fireEvent.click(screen.getByTestId("calc-tab-desmos"));
    expect(screen.getByTestId("desmos-stub")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("calc-tab-statistics"));
    expect((document.getElementById("stats-invnorm-area") as HTMLInputElement).value).toBe("0.9");
  });
  it("탭은 화살표 키로 이동한다", () => {
    render(<SubjectToolPanels config={stats} calculatorAllowed open="calculator" onClose={() => {}} />);
    const first = screen.getByTestId("calc-tab-statistics");
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByTestId("calc-tab-desmos")).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(screen.getByTestId("calc-tab-desmos"));
    fireEvent.keyDown(screen.getByTestId("calc-tab-desmos"), { key: "Home" });
    expect(screen.getByTestId("calc-tab-statistics")).toHaveAttribute("aria-selected", "true");
  });
  it("닫기 버튼·Escape로 닫는다", () => {
    const onClose = vi.fn();
    render(<SubjectToolPanels config={stats} calculatorAllowed open="calculator" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("close-calculator"));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it("닫힌 상태에서는 아무것도 보이지 않고, 계산기가 허용되지 않으면 마운트하지 않는다", () => {
    const { rerender } = render(<SubjectToolPanels config={stats} calculatorAllowed open={null} onClose={() => {}} />);
    expect(screen.queryByTestId("stats-calculator")).toBeNull();
    rerender(<SubjectToolPanels config={stats} calculatorAllowed={false} open="calculator" onClose={() => {}} />);
    expect(screen.queryByTestId("stats-calculator")).toBeNull();
  });
  it("Reference: 면책 문구, Formulas/Tables 탭, 표 검색", () => {
    render(<SubjectToolPanels config={stats} calculatorAllowed open="reference" onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Reference" })).toBeInTheDocument();
    expect(screen.getByTestId("stats-reference-disclaimer")).toHaveTextContent("ALTON study reference — not the official College Board sheet");
    expect(screen.getByTestId("stats-formulas")).toHaveTextContent("Binomial probability");
    expect(screen.getByTestId("stats-formulas")).not.toHaveTextContent(/geometric/i);
    fireEvent.click(screen.getByTestId("stats-ref-tab-tables"));
    const z = screen.getByTestId("stats-table-z");
    expect(within(z).getByText("1.9")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Find row/), { target: { value: "1.9" } });
    expect(within(z).queryByText("0.5")).toBeNull();
    expect(within(z).getByText("0.9750")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("stats-tbl-tab-t"));
    fireEvent.change(screen.getByLabelText(/Find row/), { target: { value: "12" } });
    expect(within(screen.getByTestId("stats-table-t")).getByText("2.179")).toBeInTheDocument();
    expect(screen.getByTestId("stats-table-hint")).toHaveTextContent("Interpolate");
  });
});

describe("StatsCalculator", () => {
  it("invNorm(0.975)=1.959964, 결과는 복사할 수 있다", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<StatsCalculator />);
    setMode("invnorm");
    fill("", "invnorm", "area", "0.975");
    calc();
    expect(screen.getByTestId("stats-result")).toHaveTextContent("1.959964");
    fireEvent.click(screen.getByTestId("stats-copy"));
    await screen.findByText("Copied");
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("x: 1.959964"));
  });
  it("Enter(폼 제출)로 계산하고, 잘못된 입력은 오류 메시지를 보여 준다", () => {
    render(<StatsCalculator />);
    setMode("binompdf");
    calc();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a value for n.");
    fill("", "binompdf", "n", "10"); fill("", "binompdf", "p", "0.5"); fill("", "binompdf", "k", "5");
    fireEvent.submit(screen.getByTestId("stats-form"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("stats-result")).toHaveTextContent("0.246093");
    fill("", "binompdf", "p", "1.5"); calc();
    expect(screen.getByRole("alert")).toHaveTextContent("p must be between 0 and 1.");
  });
  it("normalcdf: ±inf 경계와 분수 입력", () => {
    render(<StatsCalculator />);
    fill("", "normalcdf", "lo", "-inf"); fill("", "normalcdf", "hi", "1.96");
    calc();
    expect(screen.getByTestId("stats-result")).toHaveTextContent("0.9750021");
  });
  it("1-Var Stats: 목록 입력 → 평균·SD·5수 요약", () => {
    render(<StatsCalculator />);
    setMode("onevar");
    fill("", "onevar", "x", "2 4 4 4 5 5 7 9");
    calc();
    const r = screen.getByTestId("stats-result");
    expect(r).toHaveTextContent("x̄ (mean)5");
    expect(r).toHaveTextContent("σₓ (population SD)2");
    fill("", "onevar", "x", "1 two"); calc();
    expect(screen.getByRole("alert")).toHaveTextContent('"two" is not a number.');
  });
  it("χ² 독립성: 행렬 입력, 기대도수 표와 가정 경고", () => {
    render(<StatsCalculator />);
    setMode("chi-ind");
    fill("", "chi-ind", "m", "30 20 25\n22 35 18");
    calc();
    const r = screen.getByTestId("stats-result");
    expect(r).toHaveTextContent("df2");
    expect(r).toHaveTextContent("Expected counts");
  });
  it("2-sample t: pooled/unpooled 규칙이 결과 설명에 드러난다", () => {
    render(<StatsCalculator />);
    setMode("t2");
    for (const [k, v] of Object.entries({ x1: "24.5", s1: "4.1", n1: "18", x2: "21.2", s2: "6.3", n2: "23" })) fill("", "t2", k, v);
    calc();
    expect(screen.getByTestId("stats-result")).toHaveTextContent("Unpooled (Welch)");
    fireEvent.change(document.getElementById("stats-t2-pooled")!, { target: { value: "yes" } });
    calc();
    expect(screen.getByTestId("stats-result")).toHaveTextContent("Pooled: assumes equal population variances");
  });
  it("2027 과정 밖 기능은 표시한다", () => {
    render(<StatsCalculator />);
    setMode("geompdf");
    expect(screen.getByText(/not part of the 2027 AP Statistics course content/)).toBeInTheDocument();
  });
  it("모든 모드가 필드 라벨을 가진다(키보드·스크린리더 접근)", () => {
    for (const m of STATS_MODES) {
      render(<StatsCalculator />);
      setMode(m.id);
      for (const f of m.fields) expect(document.getElementById(`stats-${m.id}-${f.key}`)).not.toBeNull();
      cleanup();
    }
  });
});

describe("parseNum", () => {
  it("소수·분수·퍼센트·무한대", () => {
    expect(parseNum("1/4", "x")).toBe(0.25);
    expect(parseNum("95%", "x")).toBeCloseTo(0.95, 12);
    expect(parseNum("−3", "x")).toBe(-3);
    expect(parseNum("inf", "x", true)).toBe(Infinity);
    expect(() => parseNum("inf", "x")).toThrow();
    expect(() => parseNum("abc", "x")).toThrow();
    expect(() => parseNum("", "x")).toThrow("Enter a value for x.");
  });
});

describe("390px 모바일 사용성(코드 기준)", () => {
  it("입력·선택·탭·닫기·계산 버튼은 모바일에서 44px 이상, 입력 글자 16px(iOS 확대 방지)", () => {
    render(<SubjectToolPanels config={stats} calculatorAllowed open="calculator" onClose={() => {}} />);
    expect(screen.getByTestId("close-calculator").className).toContain("min-h-[44px]");
    expect(screen.getByTestId("calc-tab-statistics").className).toContain("min-h-[44px]");
    expect(screen.getByTestId("stats-calculate").className).toContain("min-h-[44px]");
    expect(screen.getByTestId("stats-mode").className).toContain("min-h-[44px]");
    expect(screen.getByTestId("stats-mode").className).toContain("text-[16px]");
    expect(screen.getByRole("tablist", { name: "Calculator type" }).className).toContain("flex-wrap");
  });
});

describe("AP Physics 1 도구", () => {
  const phys = subjectToolsConfig("ap_physics_1");
  it("공학용 계산기 + Reference, Desmos 없음", () => {
    expect(phys.calculatorTabs).toEqual(["scientific"]);
    expect(phys.reference).toBe("physics");
  });
  it("Reference 는 자체 문구 고지와 상수를 보인다", () => {
    render(<SubjectToolPanels config={phys} calculatorAllowed open="reference" onClose={() => {}} />);
    expect(screen.getByTestId("physics-reference-disclaimer").textContent).toBe(PHYSICS_REF_DISCLAIMER);
    expect(PHYSICS_REF_DISCLAIMER).toMatch(/not the official College Board sheet/);
    expect(screen.getByText(PHYSICS_CONSTANTS[0].value)).toBeInTheDocument();
  });
  it("계산기: 탭 하나(Desmos 없음), 식을 계산한다", () => {
    render(<SubjectToolPanels config={phys} calculatorAllowed open="calculator" onClose={() => {}} />);
    expect(screen.queryByTestId("desmos-stub")).toBeNull();
    fireEvent.change(document.getElementById("phys-calc-input")!, { target: { value: "2*3^2" } });
    expect(screen.getByTestId("physics-calc-result").textContent).toBe("= 18");
  });
  it("evalScientific: 각도 상수·오류", () => {
    expect(evalScientific("sin(30*deg)")).toEqual({ ok: true, value: "0.5" });
    expect(evalScientific("1/0").ok).toBe(false);
    expect(evalScientific("2+").ok).toBe(false);
  });
});

describe("AP Chemistry 도구", () => {
  const chem = subjectToolsConfig("ap_chemistry");
  it("공학용 계산기 + Reference, Desmos 없음", () => {
    expect(chem.calculatorTabs).toEqual(["scientific"]);
    expect(chem.reference).toBe("chemistry");
  });
  it("Reference 는 자체 문구 고지·상수·주기율표를 보인다", () => {
    render(<SubjectToolPanels config={chem} calculatorAllowed open="reference" onClose={() => {}} />);
    expect(screen.getByTestId("chemistry-reference-disclaimer").textContent).toBe(CHEMISTRY_REF_DISCLAIMER);
    expect(CHEMISTRY_REF_DISCLAIMER).toMatch(/not the official College Board sheet/);
    expect(screen.getByText(CHEMISTRY_CONSTANTS[0].value)).toBeInTheDocument();
    expect(screen.getByTestId("periodic-table").children.length).toBe(CHEMISTRY_ELEMENTS.filter(([z]) => elementPosition(z).group !== 0).length);
  });
  it("주기율표 위치: 원소마다 (주기, 족) 한 칸, 겹침 없음", () => {
    const seen = new Set<string>();
    for (const [z] of CHEMISTRY_ELEMENTS) { const p = elementPosition(z); if (p.group === 0) continue; const k = `${p.period}-${p.group}`; expect(seen.has(k)).toBe(false); seen.add(k); }
    expect(elementPosition(26)).toEqual({ period: 4, group: 8 });
    expect(elementPosition(17)).toEqual({ period: 3, group: 17 });
    expect(elementPosition(79)).toEqual({ period: 6, group: 11 });
    expect(CHEMISTRY_ELEMENTS).toHaveLength(86);
  });
});

describe("AP Computer Science A 도구", () => {
  const cs = subjectToolsConfig("ap_computer_science_a");
  it("계산기 탭 없음 + Java Reference", () => {
    expect(cs.calculatorTabs).toEqual([]);
    expect(cs.reference).toBe("java");
  });
  it("Reference 는 자체 문구 고지와 String·ArrayList 항목을 보인다", () => {
    render(<SubjectToolPanels config={cs} calculatorAllowed={false} open="reference" onClose={() => {}} />);
    expect(screen.getByTestId("java-reference-disclaimer").textContent).toBe(JAVA_REF_DISCLAIMER);
    expect(JAVA_REF_DISCLAIMER).toMatch(/not the official College Board sheet/);
    expect(screen.getByText("int length()")).toBeInTheDocument();
    expect(screen.getByText("E remove(int index)")).toBeInTheDocument();
    expect(JAVA_GROUPS.map((g) => g.id)).toEqual(["string", "math", "integer", "arraylist", "array", "note"]);
  });
  it("계산기를 열어도 아무것도 그리지 않는다(계산기 없음)", () => {
    render(<SubjectToolPanels config={cs} calculatorAllowed open="calculator" onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("AP Microeconomics 도구", () => {
  const micro = subjectToolsConfig("ap_microeconomics");
  it("사칙 계산기 + Reference, Desmos·공학용 없음", () => {
    expect(micro.calculatorTabs).toEqual(["basic"]);
    expect(micro.reference).toBe("microeconomics");
  });
  it("Reference 는 자체 문구 고지와 식 묶음을 보인다(공식 시트라고 주장하지 않음)", () => {
    render(<SubjectToolPanels config={micro} calculatorAllowed open="reference" onClose={() => {}} />);
    expect(screen.getByTestId("micro-reference-disclaimer").textContent).toBe(MICRO_REF_DISCLAIMER);
    expect(MICRO_REF_DISCLAIMER).toMatch(/not the official College Board sheet/);
    expect(MICRO_GROUPS.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText(MICRO_GROUPS[0].items[0].expr)).toBeInTheDocument();
  });
  it("사칙 계산기는 사칙·괄호·소수만 계산하고 함수·거듭제곱은 거부한다", () => {
    expect(evalBasic("(60 - 40) / 2")).toEqual({ ok: true, value: "10" });
    expect(evalBasic("0.5 * 80 * 20")).toEqual({ ok: true, value: "800" });
    expect(evalBasic("sqrt(9)").ok).toBe(false);
    expect(evalBasic("2^3").ok).toBe(false);
    expect(evalBasic("1/0").ok).toBe(false);
  });
});
