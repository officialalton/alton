import type { AdminDashboardData } from "./dashboard-data";

export default function AdminHomeDashboard({ data }: { data: AdminDashboardData }) {
  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">
        {data.adminName}, 안녕하세요
      </h1>

      <div className="grid grid-cols-2 gap-4">
        <Card title={`상담 요청 대기 (${data.pendingConsults.length})`}>
          {data.pendingConsults.length === 0 ? (
            <Empty text="대기 중인 상담 요청이 없습니다." />
          ) : (
            data.pendingConsults.map((c) => (
              <Row key={c.id} primary={c.personName} secondary={c.email} />
            ))
          )}
        </Card>

        <Card title="확정된 상담 일정">
          {data.upcomingConsults.length === 0 ? (
            <Empty text="예정된 상담이 없습니다." />
          ) : (
            data.upcomingConsults.map((c) => (
              <Row
                key={c.id}
                primary={c.personName}
                secondary={formatKoreanDateTime(c.scheduledAt)}
              />
            ))
          )}
        </Card>

        <Card title={`학생 매칭 대기 (${data.pendingStudents.length})`}>
          {data.pendingStudents.length === 0 ? (
            <Empty text="매칭 대기 중인 학생이 없습니다." />
          ) : (
            data.pendingStudents.map((s) => <Row key={s.id} primary={s.name} />)
          )}
        </Card>

        <Card title={`선생님 승인 대기 (${data.pendingTeachers.length})`}>
          {data.pendingTeachers.length === 0 ? (
            <Empty text="승인 대기 중인 선생님이 없습니다." />
          ) : (
            data.pendingTeachers.map((t) => <Row key={t.id} primary={t.name} />)
          )}
        </Card>

        <Card title="QC 경고 현황">
          {data.qcWarnings.length === 0 ? (
            <Empty text="경고가 있는 선생님이 없습니다." />
          ) : (
            data.qcWarnings.map((q) => (
              <Row
                key={q.teacherId}
                primary={q.teacherName}
                secondary={`경고 ${q.count}회`}
                tone="warning"
              />
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4">
      <h2 className="text-[13.5px] font-bold text-ink mb-3">{title}</h2>
      {children}
    </div>
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
