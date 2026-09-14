import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  loadComposition,
  loadKeywordProblems,
  loadPickableMaterials,
  type PrepLayer,
} from "@/lib/unit-composition";
import CompositionPanel from "../../CompositionPanel";

// 수업 준비 — 회차 기준으로 연다.
//
// 2026-09-13 지시 6절: "실제 session ID나 예약이 없어도 회차 기준으로 수업 준비를
// 열 수 있어야 한다. 화면 진입을 위해 임시 예약이나 실제 수업 기록을 생성하지 않는다."
//
// 그래서 주소가 회차를 가리킨다. 이 화면은 아무것도 만들지 않는다 — 읽고 고칠 뿐이다.
// 수업 시작과 내용 고정은 실제 수업(/session/[id])에서만 일어난다.
export const dynamic = "force-dynamic";

const LAYER_VALUES: PrepLayer[] = ["catalog", "teacher", "student"];

function isLayer(value: string): value is PrepLayer {
  return (LAYER_VALUES as string[]).includes(value);
}

export default async function LessonPrepPage({
  params,
  searchParams,
}: {
  params: Promise<{ layer: string; unitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { layer, unitId } = await params;
  const query = await searchParams;
  // 예약된 수업에서 들어왔는지. 같은 화면이지만 "지금 어느 수업을 위해 준비하는
  // 중인지"는 말해 줘야 한다.
  const fromSessionId = typeof query.session === "string" ? query.session : null;
  if (!isLayer(layer)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role as string | undefined;

  // 앱 레벨 선인가. 실제 방어선은 RLS다 — 여기를 지나도 읽기 자체가 정책에서
  // 다시 걸리고, 그때는 아래 loadComposition이 null을 돌려준다.
  const allowed =
    layer === "catalog" ? role === "admin" : role === "teacher" || role === "admin";
  if (!allowed) {
    return (
      <div className="max-w-[720px] px-8 py-16">
        <h1 className="text-[18px] font-extrabold text-ink mb-2">수업 준비</h1>
        <p className="text-[13px] text-grey-500">이 회차를 열 권한이 없습니다.</p>
      </div>
    );
  }

  const composition = await loadComposition(supabase, layer, unitId);
  // 없는 회차와 볼 수 없는 회차를 화면에서 구분하지 않는다 — 어느 쪽인지 알려주면
  // 남의 회차가 존재한다는 사실이 새어 나간다.
  if (!composition) notFound();

  const [pickable, problems] = await Promise.all([
    loadPickableMaterials(
      supabase,
      composition.subjectId,
      composition.materials.map((m) => m.curriculumDocId)
    ),
    loadKeywordProblems(
      supabase,
      composition.keywords.map((k) => k.id)
    ),
  ]);

  return (
    <CompositionPanel
      composition={composition}
      pickable={pickable}
      problems={problems}
      scopeNotice={
        fromSessionId
          ? "예약된 수업에서 들어왔습니다. 여기서 고치는 것은 이 회차의 준비안이며, 수업을 시작할 때 그 시점의 준비안이 고정됩니다."
          : null
      }
      backHref={fromSessionId ? `/session/${fromSessionId}` : null}
      backLabel={fromSessionId ? "수업 열기" : null}
    />
  );
}
