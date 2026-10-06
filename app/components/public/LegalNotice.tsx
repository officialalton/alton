import { STUDENT_TERMS_VERSION } from "@/lib/free-member-signup";

/** 법무 검토 전 초안 표시. 오너/법무 확인 후 제거한다. */
export default function LegalNotice() {
  return (
    <p className="p-mono m-0 border border-[var(--p-line)] bg-white px-4 py-3 text-[12.5px] text-[var(--p-mute)]">
      Version {STUDENT_TERMS_VERSION}. This summary is a draft pending legal review and may change before it is finalized.
    </p>
  );
}
