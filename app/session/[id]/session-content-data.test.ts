import { describe, expect, it, vi } from "vitest";
import { loadSessionContentManifest } from "./session-content-data";

// R9(레슨 준비 Task 2) — session-content-data.ts의 리더는 session_content_manifest만
// 읽고, curriculum_doc_section_keywords_selectable/problem_keywords_selectable에
// "존재하는가"만 확인하는 표시 시점 가시성 게이트를 건다. 이 유닛 테스트는 그
// 필터링 로직 자체를 mocked 클라이언트로 검증한다(실제 RLS/트리거/pin
// 불변식은 session-content-manifest.integration.test.ts가 psql로 검증한다).

function buildMockSupabase(options: {
  manifestRows: Array<{
    id: string;
    content_type: "material_section" | "problem";
    content_id: string;
    source_overlay_unit_id: string | null;
    display_position: number;
    published_doc_version_at_pin: string | null;
  }>;
  visibleSectionIds: string[];
  visibleProblemIds: string[];
}) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      from: vi.fn((table: string) => {
        calls.push(table);
        if (table === "session_content_manifest") {
          return {
            select: () => ({
              eq: () => ({
                order: () => Promise.resolve({ data: options.manifestRows, error: null }),
              }),
            }),
          };
        }
        if (table === "curriculum_doc_section_keywords_selectable") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: options.visibleSectionIds.map((section_id) => ({ section_id })),
                  error: null,
                }),
            }),
          };
        }
        if (table === "problem_keywords_selectable") {
          return {
            select: () => ({
              in: () =>
                Promise.resolve({
                  data: options.visibleProblemIds.map((problem_id) => ({ problem_id })),
                  error: null,
                }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    },
  };
}

describe("loadSessionContentManifest — 표시 시점 가시성 게이트", () => {
  it("매니페스트를 읽되, 선택 가능 뷰에 없는(=발행 취소/미확정된) 행은 숨긴다", async () => {
    const { client } = buildMockSupabase({
      manifestRows: [
        {
          id: "m1",
          content_type: "material_section",
          content_id: "sec1",
          source_overlay_unit_id: "unit1",
          display_position: 1,
          published_doc_version_at_pin: "2026-01-01T00:00:00Z",
        },
        {
          id: "m2",
          content_type: "material_section",
          content_id: "sec2-unpublished",
          source_overlay_unit_id: "unit1",
          display_position: 2,
          published_doc_version_at_pin: "2026-01-01T00:00:00Z",
        },
        {
          id: "m3",
          content_type: "problem",
          content_id: "prob1",
          source_overlay_unit_id: "unit1",
          display_position: 3,
          published_doc_version_at_pin: null,
        },
      ],
      visibleSectionIds: ["sec1"], // sec2-unpublished는 빠짐
      visibleProblemIds: ["prob1"],
    });

    const result = await loadSessionContentManifest(client as never, "session1");
    expect(result.map((r) => r.id)).toEqual(["m1", "m3"]);
  });

  it("매니페스트가 비어있으면 selectable 뷰를 조회하지 않고 빈 배열을 반환한다", async () => {
    const { client, calls } = buildMockSupabase({
      manifestRows: [],
      visibleSectionIds: [],
      visibleProblemIds: [],
    });

    const result = await loadSessionContentManifest(client as never, "session1");
    expect(result).toEqual([]);
    expect(calls).toEqual(["session_content_manifest"]);
  });
});
