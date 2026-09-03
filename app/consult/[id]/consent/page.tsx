import { getConsultConsentView } from "@/app/consult-actions";
import ConsentConfirmButton from "./ConsentConfirmButton";

// M1 요구사항 4 — 상담용 AI 회의록·비밀유지·이용 안내 동의 확인 화면. 상담 전 1회만
// 확인하면 되고(반복 체크 없음), 법률 문구는 별도 계약 문서 세션 확정 전까지
// consult_consent_versions의 placeholder를 그대로 노출한다.

export default async function ConsultConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getConsultConsentView(id);

  if (!view) {
    return (
      <main className="max-w-xl mx-auto px-6 py-16">
        <p className="text-[15px] text-ink">상담 신청을 찾을 수 없습니다.</p>
      </main>
    );
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-[20px] font-extrabold text-ink mb-2">상담 안내 및 동의 확인</h1>
      <p className="text-[13px] text-grey-500 mb-6">
        {view.contactName}님, 상담을 시작하기 전 아래 내용을 확인해 주세요.
      </p>

      {view.consentVersion?.isPlaceholder && (
        <div className="rounded-xl border-[1.5px] border-red bg-white px-4 py-3 mb-4">
          <p className="text-[12.5px] font-bold text-red">
            아직 최종 법률 문구가 확정되지 않았습니다 — 아래 내용은 placeholder입니다.
          </p>
        </div>
      )}

      <div className="rounded-2xl border-[1.5px] border-grey-200 bg-white px-6 py-6 mb-6 whitespace-pre-wrap text-[13.5px] text-ink">
        <p className="font-bold mb-3">{view.consentVersion?.title ?? "동의 문구를 불러올 수 없습니다."}</p>
        <p>{view.consentVersion?.bodyMarkdown}</p>
      </div>

      <ConsentConfirmButton consultationId={view.consultationId} alreadyConfirmedAt={view.alreadyConfirmedAt} />
    </main>
  );
}
