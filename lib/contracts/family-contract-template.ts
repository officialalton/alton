// R3 DocuSign 학생별 교육서비스 이용계약서 원문.
// DocuSign 콘솔에는 별도 템플릿을 만들지 않고 이 HTML 전체를 문서 1개로 발송한다.
// 법률 검토 전 초안이며 Production 발송에 사용하지 않는다.
export const SIGNATURE_ANCHOR = "/sig1/";
export const DATE_SIGNED_ANCHOR = "/date1/";

// 회사 측 처리 방식 확정(사용자 지시, 2026-09-05): DocuSign 전자서명이 아니라
// "인증된 관리자의 전자승인 기록을 계약서에 삽입 후 발송"이다. 아래 필드는
// DocuSign 서명 필드가 아니라 문서 본문에 그대로 인쇄되는 텍스트다 — 발송 전
// contract_company_approvals(변경 불가능한 감사 이력)에서 그대로 가져와야
// 실제 저장된 값과 문서가 항상 일치한다.
export type CompanyApprovalForTemplate = {
  companyEntityName: string;
  approverName: string;
  approverTitle: string | null;
  approvedAtLabel: string;
  documentIdentifier: string;
};

export type FamilyContractTemplateParams = {
  studentName: string;
  /** 기존 미성년자 발송 호출부와의 호환을 위해 유지한다. */
  parentName?: string;
  signerName?: string;
  signerType?: "guardian" | "adult_student";
  contractId?: string;
  contractVersion?: string;
  companyApproval: CompanyApprovalForTemplate;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderFamilyContractHtml(params: FamilyContractTemplateParams): string {
  const signerType = params.signerType ?? "guardian";
  const studentName = escapeHtml(params.studentName.trim());
  const signerName = escapeHtml(
    (params.signerName ?? params.parentName ?? (signerType === "adult_student" ? params.studentName : "")).trim()
  );
  const signerTypeLabel = signerType === "adult_student" ? "성년 학생 본인" : "미성년 학생의 보호자";
  const relationshipLabel = signerType === "adult_student" ? "본인" : "부모 또는 법정대리인";
  const contractId = escapeHtml(params.contractId?.trim() || "[자동 입력]");
  const contractVersion = escapeHtml(params.contractVersion?.trim() || "v0.2-draft");
  const companyApproval = params.companyApproval;
  const companyEntityName = escapeHtml(companyApproval.companyEntityName);
  const approverName = escapeHtml(companyApproval.approverName);
  const approverTitle = companyApproval.approverTitle ? escapeHtml(companyApproval.approverTitle) : null;
  const companyApprovedAtLabel = escapeHtml(companyApproval.approvedAtLabel);
  const companyDocumentIdentifier = escapeHtml(companyApproval.documentIdentifier);

  if (!studentName || !signerName) {
    throw new Error("계약서 생성에는 학생명과 계약자명이 필요합니다.");
  }

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>ALTON 학생별 교육서비스 이용계약서</title>
  <style>
    body { font-family: Arial, "Noto Sans KR", sans-serif; line-height: 1.65; color: #111; margin: 36px; font-size: 12px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 26px 0 8px; page-break-after: avoid; }
    p { margin: 6px 0; }
    ol { margin: 6px 0 8px 22px; padding: 0; }
    li { margin: 4px 0; }
    .notice { border: 2px solid #111; padding: 12px; margin: 16px 0; }
    .meta { width: 100%; border-collapse: collapse; margin: 12px 0; }
    .meta th, .meta td { border: 1px solid #bbb; padding: 7px; text-align: left; vertical-align: top; }
    .meta th { width: 28%; background: #f5f5f5; }
    .formula { padding: 8px; background: #f5f5f5; font-weight: 700; }
    .signature { margin-top: 46px; page-break-inside: avoid; }
    .draft { color: #8a1c1c; font-weight: 700; }
  </style>
</head>
<body>
  <h1>ALTON 학생별 교육서비스 이용계약서</h1>
  <p class="draft">제품·운영정책 반영 초안 / 미국·캘리포니아 변호사 검토 전 실제 발송·서명 금지</p>
  <p>본 교육서비스 이용계약서(이하 “본 계약”)는 아래 표시된 회사(이하 “회사”)와 계약자 사이에 체결됩니다. 학생이 미성년자인 경우 계약자는 학생을 위하여 계약할 권한이 있는 부모 또는 법정대리인이고, 학생이 성년자인 경우 계약자는 학생 본인입니다.</p>

  <h2>제1조 계약 당사자와 대상 학생</h2>
  <table class="meta">
    <tr><th>설립 전 계약 당사자</th><td>Do Kyung Kim, project name “Alton Education”</td></tr>
    <tr><th>설립 후 신규 계약 당사자</th><td>Alton Education LLC [설립 후 등록명 확인]</td></tr>
    <tr><th>주소·연락처</th><td>1055 Stewart Drive, Apt. 537, Sunnyvale, CA 94085, United States / official@alton.education</td></tr>
    <tr><th>계약자</th><td>${signerName} / ${signerTypeLabel}</td></tr>
    <tr><th>학생</th><td>${studentName}</td></tr>
    <tr><th>학생과의 관계</th><td>${relationshipLabel}</td></tr>
    <tr><th>계약 ID·버전</th><td>${contractId} / ${contractVersion}</td></tr>
  </table>
  <ol>
    <li>본 계약은 위 학생 1명에게만 적용됩니다. 다른 학생이 서비스를 이용하려면 별도 계약을 체결합니다.</li>
    <li>미성년 학생은 보호자 1명이 학생을 위하여 서명하고 필요한 동의를 제공할 권한이 있음을 확인합니다. 권한 분쟁이 있거나 회사가 합리적인 확인을 요청하면 필요한 증빙을 제공합니다.</li>
    <li>성년 학생은 학생 본인이 계약 당사자이자 서명자가 됩니다.</li>
    <li>계약자는 캘리포니아에 주로 거주함을 확인하고 거주지 변경을 회사에 알립니다.</li>
  </ol>

  <h2>제2조 계약 문서의 구성과 계속적 이용관계</h2>
  <ol>
    <li>본 계약은 학생에게 공통으로 적용되는 교육서비스 조건을 정합니다.</li>
    <li>개별 구매의 상품, 수량, 수업시간, 가격, 할인, 세금·수수료를 포함한 최종 결제금액, 통화, 유효기간과 정책 버전은 영수증·주문확인서에 기록됩니다.</li>
    <li>본 계약과 영수증·주문확인서가 충돌하면 개별 거래의 상품, 수량, 가격, 할인, 통화 및 유효기간에는 해당 영수증·주문확인서가 우선합니다.</li>
    <li>회사는 계약, 가격, 환불정책과 필수 처리 조건의 버전을 보관하고 이미 서명되거나 완료된 구매 조건을 소급 변경하지 않습니다.</li>
    <li>가격, 환불 또는 수업 형태 등 중요한 조건이 바뀌면 다음 구매 전에 계약자의 재동의를 받습니다.</li>
    <li>본 계약은 DocuSign에서 요구되는 서명이 모두 완료된 때 효력이 발생하지만, 서명만으로 수업권이나 결제가 발생하지 않습니다.</li>
    <li>본 계약은 특정 기간의 수업 제공을 약정하는 기간제 계약이 아닙니다. 고정 만료일, 자동 갱신, 자동 결제 또는 수업권 구매 의무가 없으며 정규수업 이용관계 동안 계속 적용됩니다.</li>
    <li>유효한 수업권과 예정 수업이 모두 없으면 서비스 이용관계는 비활성 상태로 관리될 수 있습니다.</li>
    <li>본 계약은 체험수업이 완료된 뒤 정규수업 이용관계에 적용되며 이미 완료된 체험수업에 소급 적용되지 않습니다.</li>
  </ol>

  <h2>제3조 서비스의 내용과 한계</h2>
  <ol>
    <li>회사는 1:1 정규수업, 학습 지도, 학습자료, 과제, 수업 리뷰와 부수 서비스를 제공할 수 있습니다.</li>
    <li>기본 정규수업은 1회 120분 1:1 수업입니다. 다른 형태는 구매 전에 표시합니다.</li>
    <li>과목, 선생님, 일정, 목표와 교재는 필요와 가용성에 따라 추가·변경·종료될 수 있습니다.</li>
    <li>회사는 특정 시험점수, 성적 향상, 학교 입학 또는 다른 학업 결과를 보장하지 않습니다.</li>
    <li>과목 추가·변경·종료는 원칙적으로 새 계약 사유가 아니지만 수업시간, 그룹 형태, 환불조건 등 중요한 조건이 달라지는 상품은 구매 전 별도 조건과 필요한 재동의를 적용합니다.</li>
  </ol>

  <h2>제4조 선생님 배정과 변경</h2>
  <ol>
    <li>선생님은 학생·과목별로 배정되며 특정 선생님의 계속 배정은 보장되지 않습니다.</li>
    <li>계약자 또는 회사는 적합성, 품질, 가용성, 일정 또는 운영상 사유로 변경을 요청·실시할 수 있습니다.</li>
    <li>한 과목의 선생님 변경은 다른 과목 또는 전체 이용관계를 자동 종료하지 않습니다.</li>
    <li>기존 이력은 당시 선생님에 연결해 보관하고 새 선생님에게는 필요한 진도와 자료만 인계합니다.</li>
    <li>확정된 미래 예약은 새 선생님에게 자동 이전되지 않으며 취소 안내 후 일반 예약 절차로 다시 예약합니다.</li>
  </ol>

  <h2>제5조 수업권과 유효기간</h2>
  <ol>
    <li>수업권은 영수증·주문확인서에 표시된 수업 이용 권리이며 현재 1장은 120분 정규수업 1회에 사용됩니다.</li>
    <li>예약 확정 시 수업권을 보류하고 정상 완료 시 소진합니다.</li>
    <li>기본 수업권은 구매일부터 12개월간 유효합니다. 다른 기간은 구매 전에 표시합니다.</li>
    <li>예약 수업의 시작 시각이 수업권 만료 시각 이내여야 합니다.</li>
    <li>만료가 가까운 수업권부터, 같으면 먼저 지급된 수업권부터 사용합니다.</li>
    <li>만료 30일 전과 7일 전에 학생과 계약자에게 알립니다.</li>
    <li>만료 수업권은 사용할 수 없지만 거래 이력에 남습니다.</li>
  </ol>

  <h2>제6조 예약, 학생 취소·지각·노쇼</h2>
  <ol>
    <li>학생은 서비스에서 담당 선생님이 공개한 가능 시간 안에서 예약합니다.</li>
    <li>수업 시작 24시간 전까지 취소하면 보류가 해제되고 원래 만료일로 복원됩니다.</li>
    <li>24시간 미만 취소는 늦은 취소로 수업권 1장이 소진됩니다.</li>
    <li>수업 시작 후 15분까지 접속하지 않아 노쇼로 최종 확정되면 수업권 1장이 소진됩니다.</li>
    <li>늦은 취소·노쇼 소진분은 환불 계산의 사용 횟수에 포함됩니다.</li>
    <li>학생 지각 시 원래 종료 시각에 끝나며 수업권 1장이 소진되고 지각만으로 보충시간이 발생하지 않습니다.</li>
    <li>회사는 질병·장기 입원 등 특별 사유가 확인되면 사유와 결과를 기록하고 예외 처리할 수 있으나 보장하지 않습니다.</li>
  </ol>

  <h2>제7조 선생님 또는 회사 사유의 취소·지각·장애</h2>
  <ol>
    <li>선생님 또는 회사 사유 취소 시 수업권은 소진되지 않고 보류가 해제됩니다. 만료까지 30일 미만이면 취소일부터 30일까지 연장됩니다.</li>
    <li>선생님이 10분 이상 지각하면 미제공 시간을 보충시간으로 처리하며 당사자 동의와 일정 여유가 있으면 같은 날 이어서 진행할 수 있습니다.</li>
    <li>같은 날 모두 제공하지 못하면 미제공 분만 기록합니다. 보충시간은 별도 수업권이 아니며 향후 해당 선생님 수업에 가용성과 충돌 여부를 확인해 사용할 수 있습니다.</li>
    <li>회사 시스템 또는 지정 화상회의 서비스 장애로 시작하지 못하면 수업권을 소진하지 않고 새로 예약합니다. 도중 중단되면 미제공 시간을 보충시간으로 처리합니다.</li>
  </ol>

  <h2>제8조 구매와 추가 구매</h2>
  <ol>
    <li>자동 갱신·자동 결제는 없고 수업권 추가 구매 의무도 없습니다. 추가 구매는 계약 갱신이 아닌 선택적 신규 거래입니다.</li>
    <li>구매 전 수업권 유형·수량·시간·단건가·패키지가·할인·세금·수수료·최종 결제금액·통화·유효기간·환불정책 버전을 표시합니다.</li>
    <li>기본 통화는 USD이고 다른 지원 통화는 해당 구매 표시를 따릅니다.</li>
    <li>상품 구성과 가격은 별도 제품 결정 사항이므로 계약에 고정하지 않습니다. 실제 상품 수량, 할인 전 단건 판매가, 할인, 결제금액과 통화는 결제 직전 화면과 거래별 영수증에 저장된 내용에 따릅니다.</li>
    <li>결제처리 수수료는 회사가 부담하고, 세금이 있으면 최종 결제금액에 항목별로 표시합니다.</li>
    <li>가격 변경은 새 버전과 적용일을 정해 최소 30일 전에 고지하고 적용일 이후 신규 구매에만 적용합니다.</li>
    <li>기존 수업권의 가격·유효기간·환불 기준은 변경되지 않으며 견적은 표시된 유효기간까지만 보장됩니다.</li>
    <li>새 가격 구매 시 결제 직전에 가격과 환불 기준을 확인합니다. 과목 추가나 계속 이용만으로 계약을 다시 서명하지 않습니다.</li>
  </ol>

  <h2>제9조 계약자의 이용중단과 환불</h2>
  <ol>
    <li>계약자는 추가 구매를 하지 않거나 특정 과목·정규수업 이용중단을 요청할 수 있습니다. 한 과목의 중단만으로 다른 과목이나 전체 이용관계가 자동 종료되지 않습니다.</li>
    <li>별도 위약금은 없으나 미래 예약에는 제6조가 적용됩니다.</li>
    <li>환불 대상은 사용되지 않았고 예약에 보류되지 않은 유료 수업권입니다. 무료·프로모션·관리자 보상 수업권은 제외되며 보류 중인 예약은 제6조에 따라 먼저 취소·정리합니다.</li>
    <li>수업권 구매일부터 7일 이내이고 해당 구매분으로 유료수업이 시작되지도, 수업권이 소진되지도 않았다면 실제 결제금액 전액을 환불합니다.</li>
    <li>해당 구매분으로 유료수업이 시작된 경우 또는 구매일부터 7일이 지난 경우에는 다음 산식을 적용합니다.</li>
    <li class="formula">환불액 = 해당 구매의 실제 결제금액 − (소진된 수업 횟수 × 구매 당시 할인 전 실제 단건 판매가)</li>
    <li>계산 결과가 음수이면 0이고, 늦은 취소와 확정 노쇼도 소진 횟수에 포함됩니다. 환불 확정 시 해당 구매분의 잔여 수업권은 더 이상 사용할 수 없습니다.</li>
    <li>환불은 원 결제 통화와 원 결제수단으로 처리하고 회사는 승인 후 5영업일 이내 결제대행사에 요청합니다. 실제 입금 시점은 결제수단과 대행사 일정에 따릅니다.</li>
    <li>더 유리한 강행법규상 청약철회·환불 권리는 제한되지 않습니다. 이 문구는 판매 대상 국가별 변호사 검토 후 확정합니다.</li>
  </ol>

  <h2>제10조 회사에 의한 중단 또는 종료</h2>
  <ol>
    <li>회사 사유 종료 시 미사용 유료 수업권은 해당 구매의 실제 결제단가로 환불하고 할인을 회수하지 않습니다.</li>
    <li>중대한 위반, 안전 위험, 결제 부정, 불법행위 또는 서비스 방해가 있으면 조사에 필요한 범위에서 이용을 제한할 수 있으며 종료·환불은 적용 법령과 확정 정책에 따릅니다.</li>
    <li>유효 수업권과 예정 수업이 모두 없으면 이용관계를 비활성화할 수 있으며 이는 기간제 계약 만료나 개인정보 즉시 삭제를 의미하지 않습니다.</li>
    <li>이용관계 종료는 그 전에 발생한 결제, 환불, 수업권 처리, 분쟁 또는 법정 보관 의무에 영향을 주지 않습니다.</li>
  </ol>

  <h2>제11조 계정 중단·복귀와 계정 폐쇄</h2>
  <ol>
    <li>수업 중단이나 비활성화는 개인정보 삭제가 아닙니다. 회사는 보관정책에 따라 이력을 보존할 수 있습니다.</li>
    <li>복귀 시 과거 계약, 사용·만료 수업권 또는 종료된 선생님 배정이 자동 복원되지 않습니다.</li>
    <li>계정 폐쇄·삭제 요청에는 본인확인, 30일 철회 유예, 법적 보관 및 순차 삭제 절차가 적용될 수 있습니다.</li>
  </ol>

  <div class="notice">
    <h2>제12조 AI 수업 회의록 및 개인정보 처리 — 정규수업 필수 조항</h2>
    <ol>
      <li>회사는 계약·계정·예약·수업·결제·환불·고객지원·안전·품질관리·분쟁·법적 의무에 필요한 개인정보를 처리합니다.</li>
      <li>정규수업의 진도관리, 품질관리, 수업 리뷰 작성과 선생님 인수인계를 위해 Google Meet의 Gemini “Take notes for me”(“Smart Notes”)를 필수로 사용합니다.</li>
      <li>Google AI는 수업 중 발화를 처리하여 요약 회의록을 만들며 이 과정에서 발언 내용이 글로 표현된 텍스트 형태의 처리 결과가 생성될 수 있습니다. 현재 별도의 영상 녹화, 원본 음성 녹음 또는 발화를 글로 옮기는 별도 Google Meet 기능은 사용하지 않습니다.</li>
      <li>처리 항목에는 성명·계정·이메일·역할, 수업 일시·과목·회차·회의 식별정보, 발언·질문·답변·진도·과제·피드백, 텍스트 형태의 처리 결과·AI 요약·확정 리뷰와 처리 이력이 포함될 수 있습니다.</li>
      <li>Google 및 실제 계약 관계에 따른 계열사·승인된 하위처리업체가 Workspace, Meet, Gemini, Drive를 통해 이를 처리·저장하며 미국 등 거주국 밖에서 처리할 수 있습니다.</li>
      <li>Google이 만든 요약 회의록 원본과 텍스트 형태의 처리 결과에는 담당 선생님과 권한 있는 관리자·품질관리 담당자만 접근합니다. Google 원본은 학생·계약자에게 공유하지 않고 선생님이 검토·수정한 확정 리뷰만 제공합니다.</li>
      <li>AI는 오류·누락·화자 혼동을 일으킬 수 있어 선생님이 검토합니다. AI 결과만으로 출석, 수업권, 환불, 정산 또는 분쟁을 자동 확정하지 않습니다.</li>
      <li>Google이 만든 요약 회의록 원본과 텍스트 형태의 처리 결과는 마지막 수업 후 1년, 확정 리뷰·학습 이력은 3년, 계약·버전·서명 기록은 이용관계 종료 후 7년, 보안·접근 로그는 생성 후 1년 보관합니다. 법적 보존 자료는 필요 해제 시까지, 삭제 정보의 백업은 최대 35일 이내 순차 삭제합니다.</li>
      <li><strong>Smart Notes는 정규수업의 필수 조건입니다. 계약자는 계약 단계 또는 Google Meet 입장 단계에서 AI 처리에 관한 별도 체크박스·별도 서명을 하지 않고 이 계약에 한 번 서명하여 이 조항을 포함한 계약 전체에 동의합니다. 동의하지 않으면 계약 체결과 정규수업 고객 활성화가 불가능하며 수업마다 재동의하지 않습니다.</strong></li>
      <li>Smart Notes만 끄고 정규수업을 계속하는 선택지는 없습니다. 계약 후 앞으로 AI 처리에 더 이상 동의하지 않는다고 명시적으로 요청하면 확인 후 향후 정규수업을 진행하지 않고, 예약과 잔여 수업권은 제6조·제9조 및 구매 당시 정책에 따라 정리합니다. 이는 기간제 계약의 즉시 해지나 별도 위약금 발생을 뜻하지 않습니다.</li>
      <li>만 13세 미만 학생은 검증 가능한 보호자 동의 확인 전 정규수업을 이용할 수 없습니다. 개인정보 조회·정정·삭제·향후 처리 중단 요청과 예외는 개인정보처리방침(https://app.alton.education/privacy)에 따릅니다.</li>
    </ol>
  </div>

  <h2>제13조 학습자료와 지식재산권</h2>
  <ol>
    <li>회사·제3자가 제공하는 교재, 문제, 해설, 수업자료, 소프트웨어와 브랜드의 권리는 회사 또는 정당한 권리자에게 있습니다.</li>
    <li>학생·계약자는 개인 학습 목적으로만 이용하고 사전 허가 없이 복제·판매·공개 배포하지 않습니다.</li>
    <li>학생 창작물의 권리는 학생에게 남지만 서비스 제공·복습·품질관리·기록 보관에 필요한 저장·표시를 허용합니다.</li>
  </ol>

  <h2>제14조 이용자 행동과 안전</h2>
  <ol>
    <li>계약자와 학생은 계정을 안전하게 관리하고 제3자와 공유하지 않습니다.</li>
    <li>학생, 계약자와 선생님은 괴롭힘, 차별, 위협, 성적으로 부적절한 행위, 무단 녹화, 저작권 침해, 수업 방해 또는 보안 침해를 해서는 안 됩니다.</li>
    <li>회사는 안전·법적 위험을 조사하고 필요한 보호조치를 취할 수 있습니다.</li>
  </ol>

  <h2>제15조 전자문서, 서명과 통지</h2>
  <ol>
    <li>당사자는 DocuSign 전자서명과 전자문서 수신에 동의하며 관련 법률이 달리 정하지 않는 한 완료본을 종이 원본과 동일하게 취급합니다.</li>
    <li>계약 버전 하나는 봉투 하나와 연결되고 새 버전은 기존 완료본을 덮어쓰지 않습니다.</li>
    <li>완료본과 감사증명은 회사 Shared Drive에 보관하고 계약자에게 완료본을 제공합니다.</li>
    <li>회사는 계약·영수증·중요 정책 변경·예약·서비스 통지를 등록 이메일 또는 서비스 내 알림으로 제공할 수 있고 계약자는 연락처를 갱신합니다.</li>
    <li>미성년 학생은 보호자가, 성년 학생은 학생 본인이 계약자이자 서명자입니다. 아래 한 번의 서명은 제12조를 포함한 계약 전체에 적용되며 계약 단계·Google Meet 입장 단계의 AI 관련 별도 체크박스·별도 서명 또는 수업별 재동의는 없습니다.</li>
    <li>회사 서명권자는 Do Kyung Kim, CEO이고 연락처는 official@alton.education입니다. 승인된 계약 버전에 대한 회사 승인 또는 선서명 기록은 DocuSign 감사기록에 남깁니다.</li>
  </ol>

  <h2>제16조 책임 제한</h2>
  <ol>
    <li>본 계약은 포기할 수 없는 소비자·학생 권리를 제한하지 않습니다.</li>
    <li>책임 범위, 책임 한도, 간접손해 배제와 불가항력 조항은 서비스 지역과 변호사 검토 후 확정합니다.</li>
    <li>확정 조항은 회사의 고의·중과실 또는 법률상 제한할 수 없는 책임을 배제하지 않습니다.</li>
  </ol>

  <h2>제17조 준거법과 분쟁 해결 — 초기 운영안</h2>
  <ol>
    <li>연방법 적용 사항을 제외하고 캘리포니아주 법률을 준거법으로 하며 강행적 소비자 권리를 제한하지 않습니다.</li>
    <li>분쟁은 official@alton.education과 계약상 주소로 내용·희망 해결책을 통지한 뒤 30일간 성실히 협의합니다.</li>
    <li>해결되지 않으면 관할 요건을 갖춘 캘리포니아 소액사건법원 또는 Santa Clara County의 관할 주·연방법원에서 해결합니다.</li>
    <li>초기 운영안에는 강제 중재, 집단청구 포기 또는 배심재판 포기를 두지 않습니다.</li>
  </ol>

  <h2>제18조 계약 변경과 전체 합의</h2>
  <ol>
    <li>본 계약, 영수증·주문확인서, 편입 정책과 서명된 변경합의서가 전체 합의를 구성합니다.</li>
    <li>중요 변경은 사전 고지하고 필요한 경우 새 계약 버전 또는 재동의를 받습니다.</li>
    <li>과목·선생님·일정 변경이나 선택적 추가 구매는 그 자체로 계약 갱신이 아닙니다.</li>
    <li>일부 조항이 무효·집행불능이어도 나머지는 가능한 범위에서 유지됩니다.</li>
  </ol>

  <h2>부속서 A — 학생·계약자 정보 및 미성년자 보호자 확인</h2>
  <p>계약자: ${signerName} (${signerTypeLabel}) / 학생: ${studentName} / 관계: ${relationshipLabel}</p>
  <p>학생 생년월일: [DocuSign 입력] / 계약자 주소: [DocuSign 입력] / 계약자 이메일: [DocuSign 기록]</p>
  <p>미성년 학생의 보호자는 본 계약에 서명함으로써 학생을 위하여 계약하고 개인정보 처리에 동의할 권한이 있음을 확인합니다. 만 13세 미만 학생의 보호자 확인은 본 계약 DocuSign 서명·이메일 확인과 해당 시 최초 결제 거래기록으로 남깁니다. 정부 신분증은 별도 필요가 확인되지 않는 한 수집하지 않습니다. 이 부속서에는 별도 체크박스나 별도 서명란이 없습니다.</p>

  <div class="signature">
    <h2>회사 전자승인</h2>
    <p>계약 주체: ${companyEntityName}</p>
    <p>승인자: ${approverName}${approverTitle ? ` (${approverTitle})` : ""}</p>
    <p>회사 승인 일시: ${companyApprovedAtLabel}</p>
    <p>문서 식별값: ${companyDocumentIdentifier}</p>
    <p class="draft">회사 전자승인의 계약 효력 발생 시점 등 관련 법률 문구는 별도 법률 검토 후 확정 예정입니다(R10 blocker).</p>
  </div>

  <div class="signature">
    <h2>계약자 전자서명</h2>
    <p>본인은 구매·취소·환불 조건과 제12조의 필수 AI 수업 회의록·개인정보 처리를 포함한 계약 전체를 읽고 이해했습니다.</p>
    <p>계약자 유형: ${signerTypeLabel}</p>
    <p>계약자 성명: ${signerName}</p>
    <p style="margin-top: 42px;">전자서명: ${SIGNATURE_ANCHOR}</p>
    <p>서명일시 및 시간대: ${DATE_SIGNED_ANCHOR}</p>
  </div>
</body>
</html>`;
}
