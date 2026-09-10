import type { AdminDashboardData } from "./dashboard-data";

type AdminNavTarget = "consult" | "matching" | "users";

type CardRow = { id: string; primary: string; secondary?: string; tone?: "warning" };

// 2026-09-10(UI/UX 정리 1차) — 관리자 홈이 클릭 불가한 통계 나열이었던 문제를
// 고친다. 새 쿼리·데이터는 추가하지 않는다(이미 있는 카운트에 이동만 연결).
// 카드는 "오늘 처리할 업무" 우선순위(대기 건수 많은 순)로 정렬한다. 이동
// 대상은 실제 구현된 탭만 허용 — QC 경고는 전용 화면이 아직 없으므로
// 교사 상세에서 QC 이력을 볼 수 있는 "사용자" 탭으로 보낸다.
export default function AdminHomeDashboard({
  data,
  onNavigate,
}: {
  data: AdminDashboardData;
  onNavigate: (tab: AdminNavTarget) => void;
}) {
  const cards = [
    {
      key: "pendingConsults",
      count: data.pendingConsults.length,
      target: "consult" as const,
      title: `상담 요청 대기 (${data.pendingConsults.length})`,
      empty: "대기 중인 상담 요청이 없습니다.",
      rows: data.pendingConsults.map((c) => ({ id: c.id, primary: c.personName, secondary: c.email })) as CardRow[],
    },
    {
      key: "pendingTeachers",
      count: data.pendingTeachers.length,
      target: "users" as const,
      title: `선생님 승인 대기 (${data.pendingTeachers.length})`,
      empty: "승인 대기 중인 선생님이 없습니다.",
      rows: data.pendingTeachers.map((t) => ({ id: t.id, primary: t.name })) as CardRow[],
    },
    {
      key: "pendingStudents",
      count: data.pendingStudents.length,
      target: "matching" as const,
      title: `학생 매칭 대기 (${data.pendingStudents.length})`,
      empty: "매칭 대기 중인 학생이 없습니다.",
      rows: data.pendingStudents.map((s) => ({ id: s.id, primary: s.name })) as CardRow[],
    },
    {
      key: "qcWarnings",
      count: data.qcWarnings.length,
      target: "users" as const,
      title: "QC 경고 현황",
      empty: "경고가 있는 선생님이 없습니다.",
      rows: data.qcWarnings.map((q) => ({
        id: q.teacherId,
        primary: q.teacherName,
        secondary: `경고 ${q.count}회`,
        tone: "warning" as const,
      })) as CardRow[],
    },
    {
      key: "upcomingConsults",
      count: 0,
      target: "consult" as const,
      title: "확정된 상담 일정",
      empty: "예정된 상담이 없습니다.",
      rows: data.upcomingConsults.map((c) => ({
        id: c.id,
        primary: c.personName,
        secondary: formatKoreanDateTime(c.scheduledAt),
      })) as CardRow[],
    },
  ].sort((a, b) => b.count - a.count);

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">
        {data.adminName}, 안녕하세요
      </h1>
      <p className="text-[13px] text-grey-500 mb-5">
        오늘 처리할 업무가 대기 건수 많은 순으로 정렬돼 있어요. 카드를 누르면
        해당 화면으로 이동합니다.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <Card key={card.key} title={card.title} onClick={() => onNavigate(card.target)}>
            {card.rows.length === 0 ? (
              <Empty text={card.empty} />
            ) : (
              card.rows.map((r) => (
                <Row key={r.id} primary={r.primary} secondary={r.secondary} tone={r.tone} />
              ))
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Card({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left border-[1.5px] border-grey-200 rounded-xl px-5 py-4 hover:border-ink transition-colors"
    >
      <h2 className="text-[13.5px] font-bold text-ink mb-3">{title}</h2>
      {children}
    </button>
  );
}

function Row({
  primary,
  secondary,
  tone,
}: {
  primary: string;
  secondary?: string;
  tone?: "warning";
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[13px]">
      <span className="font-semibold text-ink">{primary}</span>
      {secondary && (
        <span
          className={
            "text-[12px] " + (tone === "warning" ? "font-bold text-red" : "text-grey-500")
          }
        >
          {secondary}
        </span>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[12.5px] text-grey-500">{text}</p>;
}

function formatKoreanDateTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
