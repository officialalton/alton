// 072(DocuSign): 학부모/학생 표준 계약서 문구. 나중에 문구를 고치고 싶으면
// 이 파일만 수정하면 된다(DocuSign 콘솔에는 템플릿을 따로 만들지 않았음).
// 이 초안은 법적 검토를 거치지 않은 플레이스홀더 문구다 — 실제 고객 발송 전
// 반드시 변호사 검토가 필요하다.
export function renderFamilyContractHtml(params: {
  parentName: string;
  studentName: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: sans-serif; line-height: 1.6; color: #111;">
  <h2>서비스 이용 계약서</h2>
  <p>계약 당사자: Alton Education Inc. (이하 "회사")와 ${params.parentName} (이하 "학부모")</p>
  <p>학생: ${params.studentName}</p>

  <h3>제1조 (목적)</h3>
  <p>본 계약은 회사가 제공하는 온라인 SAT/AP 개인 교습 서비스의 이용 조건을 정함을 목적으로 한다.</p>

  <h3>제2조 (수업권)</h3>
  <p>학부모는 수업권을 구매하여 자녀의 수업에 사용하며, 수업권은 구매일로부터 12개월간 유효하다.</p>

  <h3>제3조 (취소 정책)</h3>
  <p>수업 24시간 전 취소 시 수업권이 전액 보존되며, 그 외 취소는 회사 정책에 따른다.</p>

  <p style="margin-top: 48px;">학부모 서명: /sig1/</p>
</body>
</html>`;
}
