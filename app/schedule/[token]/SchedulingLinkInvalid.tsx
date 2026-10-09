import { SCHEDULING_LINK_INVALID_MESSAGE } from "@/lib/consultation/scheduling-link";

// 무효·만료된 예약 링크 안내(서버·클라이언트 공용, 상태 없음).
export default function SchedulingLinkInvalid() {
  return (
    <div role="alert" className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-8 py-14 text-center">
      <p className="text-[18px] font-extrabold text-ink mb-2">{SCHEDULING_LINK_INVALID_MESSAGE}</p>
      <p className="text-[14px] text-grey-500">
        If you need a new scheduling link, contact your consultant or the ALTON EDUCATION team.
      </p>
    </div>
  );
}
