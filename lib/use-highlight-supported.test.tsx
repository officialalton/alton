/** @vitest-environment jsdom */
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi, afterEach } from "vitest";
import { useHighlightSupported } from "./use-highlight-supported";

function Probe() {
  return <span>{useHighlightSupported() ? "supported" : "unsupported"}</span>;
}

describe("useHighlightSupported", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("지원 브라우저여도 서버 렌더 결과는 unsupported 라 하이드레이션 불일치가 없다", () => {
    vi.stubGlobal("CSS", { highlights: new Map() });
    expect(renderToString(<Probe />)).toContain("unsupported");
  });
});
