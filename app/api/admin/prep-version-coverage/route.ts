import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { adminGateDenied } from "@/lib/admin-route-gate";
import { createAdminClient } from "@/lib/supabase-admin";

// 준비안·매니페스트가 "어떤 버전을 쓰는지" 기록됐는지 세는 **읽기 전용** 집계.
//
// 2026-09-13 지시: "미기록 건수는 계층별·교재/문제별로 집계하고, '참조 자체가 없음 /
// 참조한 버전이 없음 / 스냅샷 내용이 불완전함'을 구분해주세요."
//
// 아무것도 바꾸지 않는다. insert/update/delete 를 부르지 않는다.
//
// **집계 단위는 교재 수가 아니라 '구성 행 수'다.** 같은 교재가 여러 회차에 담겨
// 있으면 각각 센다 — 보완해야 할 대상이 회차별 항목이기 때문이다.
//
// 비프로덕션 전용이다. Production 에서는 아무 숫자도 돌려주지 않는다.
export const dynamic = "force-dynamic";

type CoverageRow = { layer: string; kind: string; state: string; rows: number };

const LAYER_LABEL: Record<string, string> = {
  catalog: "관리자 기준본",
  teacher: "선생님 기본 구성",
  student: "학생별 구성",
  session: "수업 고정 기록",
};

const STATE_LABEL: Record<string, string> = {
  ok: "버전 기록됨",
  no_reference: "참조 자체가 없음",
  version_missing: "참조한 버전이 없음",
  snapshot_incomplete: "스냅샷 내용이 불완전함",
};

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    return adminGateDenied(e);
  }

  // 공유 비프로덕션에서만 쓴다. Production 에서 열리면 숫자 대신 거절을 돌려준다.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.includes("worpsqwqgnspddnrtnvq") && !url.includes("127.0.0.1")) {
    return NextResponse.json(
      { error: "이 진단은 비프로덕션에서만 사용합니다." },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  const { data, error } = await admin.from("prep_version_coverage").select("*");
  if (error) {
    console.error(
      JSON.stringify({ event: "prep_version_coverage_failed", message: error.message })
    );
    return NextResponse.json({ error: "집계하지 못했습니다.", detail: error.message });
  }

  const rows = (data ?? []) as CoverageRow[];

  // 계층 × 종류로 묶고, 상태별 건수의 합이 그 묶음의 전체와 맞는지 확인한다.
  const grouped: Record<
    string,
    { layer: string; kind: string; total: number; byState: Record<string, number> }
  > = {};
  for (const r of rows) {
    const key = `${r.layer}:${r.kind}`;
    grouped[key] = grouped[key] ?? {
      layer: LAYER_LABEL[r.layer] ?? r.layer,
      kind: r.kind === "material" ? "교재" : "문제",
      total: 0,
      byState: {},
    };
    grouped[key].total += Number(r.rows);
    const label = STATE_LABEL[r.state] ?? r.state;
    grouped[key].byState[label] = (grouped[key].byState[label] ?? 0) + Number(r.rows);
  }

  const groups = Object.values(grouped).map((g) => ({
    ...g,
    // 상태별 합과 전체가 어긋나면 집계 자체를 믿을 수 없다 — 드러낸다.
    stateSumMatchesTotal:
      Object.values(g.byState).reduce((a, b) => a + b, 0) === g.total,
  }));

  // 집계가 대상을 빠뜨리거나 겹쳐 세지 않았는지 원본 행 수와 대조한다.
  // stateSumMatchesTotal 은 "조회된 대상 안에서" 합이 맞는다는 뜻일 뿐이다 —
  // 대상 자체가 누락됐는지는 이 대조로만 알 수 있다(2026-09-13 지시 2번).
  const rawCount = async (table: string, apply?: (q: never) => never) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let q: any = admin.from(table).select("*", { count: "exact", head: true });
    if (apply) q = (apply as any)(q);
    const { count, error: countError } = await q;
    return countError ? null : (count ?? 0);
  };

  const rawTotals = {
    catalogMaterials: await rawCount("subject_template_unit_materials"),
    teacherMaterials: await rawCount("teacher_curriculum_template_unit_materials"),
    studentMaterials: await rawCount("curriculum_overlay_unit_materials"),
    sessionMaterials: await rawCount("session_content_manifest", ((q: any) =>
      q.in("content_type", ["material_doc", "material_section"])) as never),
    catalogProblems: await rawCount("subject_template_unit_problems"),
    teacherProblems: await rawCount("teacher_curriculum_template_unit_problems"),
    studentProblems: await rawCount("curriculum_unit_prep_items", ((q: any) =>
      q.eq("content_type", "problem")) as never),
    sessionProblems: await rawCount("session_content_manifest", ((q: any) =>
      q.eq("content_type", "problem")) as never),
  };

  const coveredTotal = groups.reduce((sum, g) => sum + g.total, 0);
  const rawTotal = Object.values(rawTotals).reduce<number>(
    (sum, v) => sum + (v ?? 0),
    0
  );

  // 본문이 실제로 무엇을 참조하는지. "업로드 경로가 없으니 전부 외부 참조"라고
  // 단정하지 않고 세어 본다(2026-09-13 지시 3번).
  const { data: sectionRows } = await admin
    .from("curriculum_doc_sections")
    .select("id, body");

  const refs = { images: 0, pdfLinks: 0, otherEmbeds: 0, plainLinks: 0 };
  const hosts = new Map<string, number>();
  for (const row of sectionRows ?? []) {
    const body = (row.body as string | null) ?? "";
    refs.images += (body.match(/<img\b/gi) ?? []).length;
    refs.otherEmbeds += (body.match(/<(iframe|video|audio|embed|object)\b/gi) ?? []).length;
    for (const m of body.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const url = m[1];
      if (/\.pdf(\?|#|$)/i.test(url)) refs.pdfLinks += 1;
      else if (m[0].toLowerCase().startsWith("href")) refs.plainLinks += 1;
      try {
        const host = new URL(url, "https://example.invalid").host;
        if (host && host !== "example.invalid") hosts.set(host, (hosts.get(host) ?? 0) + 1);
      } catch {
        // 상대 경로 등 — 호스트가 없다. 세지 않는다.
      }
    }
  }

  // 현재 내용 기준 생성본과 정식 공개 스냅샷을 나눠 센다. 앞엣것은 과거 공개 내용을
  // 입증하는 자료가 아니다.
  const [{ count: publishCount }, { count: baselineCount }] = await Promise.all([
    admin
      .from("curriculum_doc_versions")
      .select("*", { count: "exact", head: true })
      .eq("origin", "publish"),
    admin
      .from("curriculum_doc_versions")
      .select("*", { count: "exact", head: true })
      .eq("origin", "current_content_baseline"),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    note: "읽기 전용 집계입니다. 이 경로는 아무것도 바꾸지 않습니다.",
    countingUnit:
      "교재 수가 아니라 구성 행 수입니다. 같은 교재가 여러 회차에 담겨 있으면 각각 셉니다.",
    groups,
    reconciliation: {
      note:
        "stateSumMatchesTotal 은 조회된 대상 안에서만 합이 맞는다는 뜻입니다. " +
        "대상 누락·중복은 아래 원본 행 수 대조로 확인합니다.",
      rawTotals,
      rawTotal,
      coveredTotal,
      matches: rawTotal === coveredTotal,
    },
    bodyReferences: {
      note:
        "교재 본문(HTML)이 실제로 참조하는 것. 수업 내용에 포함되는 파일과 단순 " +
        "참고 링크를 구분하려면 이 실태부터 확인해야 합니다.",
      sectionsScanned: (sectionRows ?? []).length,
      ...refs,
      hosts: Object.fromEntries([...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)),
    },
    docVersions: {
      publish: publishCount ?? 0,
      currentContentBaseline: baselineCount ?? 0,
      baselineNote:
        "current_content_baseline 은 현재 내용으로 만든 기준본입니다. 과거 공개 내용을 " +
        "입증하는 자료가 아니며, 기존 준비안·과거 매니페스트에 연결하지 않았습니다. " +
        "새 준비안에서는 그 교재의 최신 버전 행으로서 그대로 사용됩니다 — 정식 재공개를 " +
        "따로 요구하지 않습니다.",
    },
  });
}
