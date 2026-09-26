import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  loadComposition,
  loadKeywordProblems,
  loadPickableMaterials,
  type PrepLayer,
} from "@/lib/unit-composition";
import CompositionPanel from "../../CompositionPanel";

// 2026-09-21(UAT 지적) — 이 화면은 AdminShell/TeacherShell 밖의 독립 라우트라 왼쪽
// 사이드바가 사라지고, 뒤로 갈 방법도 없었다. 사이드바까지 통째로 다시 넣는 건(이
// 화면이 admin/teacher 양쪽에서 쓰이는 공용 화면이라 두 Shell의 상태·데이터 요구사항이
// 다름) 이번 범위 밖이라 우선 명시적 뒤로가기 링크만 붙인다. student 레이어는 이미
// SessionShell 탭 안에서만 쓰여(Shell 안, 이 라우트로 오지 않음) 대상이 아니다.
const BACK_HREF: Record<PrepLayer, string> = {
  catalog: "/admin?tab=catalog",
  teacher: "/teacher?tab=curriculum",
  student: "/teacher?tab=curriculum",
};

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

  // 2026-09-17(실제 브라우저 UAT 지적) — 학생의 /unit-preview 경로는 이미 "실제로
  // 시작·완료된(취소 아닌) 세션이 있으면 그 세션뷰로 들어간다"를 지원한다
  // (unit_preview_for_viewer RPC). 교사가 여기(학생 사본 편집, layer=student)로
  // 들어올 때도 같은 규칙을 적용한다 — 이미 시작된 수업은 준비 화면이 아니라
  // 실제 수업 화면에서 다뤄야 한다. catalog(관리자 기준본)·teacher(폐지된 레이어)는
  // 특정 세션에 묶이지 않으므로 대상이 아니다.
  if (layer === "student") {
    const { data: linkedRows } = await supabase
      .from("session_curriculum_units")
      .select("session_id, sessions(final_status, actual_start_at)")
      .eq("overlay_unit_id", unitId);
    const NOT_FROZEN = new Set(["scheduled", "student_cancelled", "teacher_cancelled", "company_cancelled"]);
    const frozenSessions = (linkedRows ?? [])
      .map((r) => {
        const s = Array.isArray(r.sessions) ? r.sessions[0] : r.sessions;
        return {
          sessionId: r.session_id as string,
          finalStatus: (s as { final_status?: string } | null)?.final_status,
          actualStartAt: (s as { actual_start_at?: string | null } | null)?.actual_start_at ?? null,
        };
      })
      .filter((r): r is { sessionId: string; finalStatus: string; actualStartAt: string | null } =>
        Boolean(r.finalStatus) && !NOT_FROZEN.has(r.finalStatus as string)
      )
      .sort((a, b) => (b.actualStartAt ?? "").localeCompare(a.actualStartAt ?? ""));
    if (frozenSessions[0]) redirect(`/session/${frozenSessions[0].sessionId}`);
  }

  // 2026-09-14 — 단계별 소요를 서버 로그에 남긴다(Vercel 함수 로그에서 어디가 느린지 볼 수 있게).
  const t0 = Date.now();
  const composition = await loadComposition(supabase, layer, unitId);
  const tComposition = Date.now() - t0;
  // 없는 회차와 볼 수 없는 회차를 화면에서 구분하지 않는다 — 어느 쪽인지 알려주면
  // 남의 회차가 존재한다는 사실이 새어 나간다.
  if (!composition) notFound();

  const t1 = Date.now();
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

  console.log(
    JSON.stringify({
      event: "lesson_prep_timing",
      layer,
      compositionMs: tComposition,
      candidatesMs: Date.now() - t1,
      totalMs: Date.now() - t0,
    })
  );

  return (
    <div>
      <div className="max-w-[720px] mx-auto px-8 pt-6">
        <Link
          href={BACK_HREF[layer]}
          className="inline-block text-[13px] text-grey-600 font-semibold border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
        >
          ← 뒤로
        </Link>
      </div>
      <CompositionPanel
        composition={composition}
        pickable={pickable}
        problems={problems}
        scopeNotice={
          fromSessionId
            ? "예약된 수업에서 들어왔습니다. 여기서 고치는 것이 그 수업의 준비안이며, 아래에서 수업을 시작할 때 지금 내용이 고정됩니다."
            : null
        }
      />
    </div>
  );
}

