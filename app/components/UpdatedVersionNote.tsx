import { UPDATED_VERSION_BADGE, UPDATED_VERSION_RETAKE_NOTE, updatedVersionAnsweredText } from "@/lib/mock-exam/new-version";

// 'Updated version' 안내(학생·학부모 공용). 새 버전은 이전 응시와 겹치는 문항이 있는 재응시 회차로 센다(독립된 새 시험 아님).
export function UpdatedVersionBadge() {
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800" data-testid="updated-version-badge">{UPDATED_VERSION_BADGE}</span>;
}

export default function UpdatedVersionNote({ info, withRetakeNote = true }: { info: { itemTotal: number; sharedAnswered: number }; withRetakeNote?: boolean }) {
  const answered = updatedVersionAnsweredText(info);
  return (
    <div className="mt-1 text-[12px] text-grey-600" data-testid="updated-version-note">
      {answered && <p data-testid="updated-version-answered">{answered}</p>}
      {withRetakeNote && <p className="text-grey-500">{UPDATED_VERSION_RETAKE_NOTE}</p>}
    </div>
  );
}
