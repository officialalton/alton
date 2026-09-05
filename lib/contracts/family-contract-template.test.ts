import { describe, expect, it } from "vitest";
import { renderFamilyContractHtml } from "./family-contract-template";

const testCompanyApproval = {
  companyEntityName: "Alton Education Inc.",
  approverName: "테스트 관리자",
  approverTitle: "CEO",
  approvedAtLabel: "2026. 9. 5. 오전 9:00",
  documentIdentifier: "cv1",
};

describe("renderFamilyContractHtml", () => {
  it("미성년 학생 계약에 보호자·학생 이름과 단일 서명 anchor를 포함한다", () => {
    const html = renderFamilyContractHtml({ parentName: "김민지", studentName: "지훈", companyApproval: testCompanyApproval });

    expect(html).toContain("김민지");
    expect(html).toContain("지훈");
    expect(html.match(/\/sig1\//g)).toHaveLength(1);
    expect(html).toContain("미성년 학생의 보호자");
    expect(html).toContain("AI 수업 회의록 및 개인정보 처리");
    expect(html).toContain("Smart Notes는 정규수업의 필수 조건");
    expect(html).toContain("체험수업이 완료된 뒤 정규수업 이용관계에 적용");
    expect(html).not.toContain("제4조 체험수업");
    expect(html).not.toContain("체험수업은 원칙적으로 학생 1명당");
    expect(html).toContain("계약 단계 또는 Google Meet 입장 단계");
    expect(html).toContain("텍스트 형태의 처리 결과");
    expect(html).toContain("수업권 구매일부터 7일 이내");
    expect(html).toContain("유료수업이 시작되지도, 수업권이 소진되지도 않았다면 실제 결제금액 전액");
    expect(html).toContain("유료수업이 시작된 경우 또는 구매일부터 7일이 지난 경우");
    expect(html).toContain("구매 당시 할인 전 실제 단건 판매가");
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain("전사");
    expect(html).not.toContain("$3,500");
    expect(html).not.toContain("20회 패키지");
    expect(html).toContain("제1조");
    expect(html).toContain("제18조");
    expect(html).not.toContain("제19조");
  });

  it("성년 학생은 본인을 계약 당사자이자 서명자로 표시한다", () => {
    const html = renderFamilyContractHtml({
      signerType: "adult_student",
      signerName: "이성인",
      studentName: "이성인",
      companyApproval: testCompanyApproval,
    });

    expect(html).toContain("성년 학생 본인");
    expect(html).toContain("성년 학생은 학생 본인이 계약 당사자이자 서명자가 됩니다");
    expect(html.match(/\/sig1\//g)).toHaveLength(1);
  });

  it("계약자·학생 이름을 HTML escape한다", () => {
    const html = renderFamilyContractHtml({ parentName: '<부모 & "A">', studentName: "<학생>", companyApproval: testCompanyApproval });

    expect(html).toContain("&lt;부모 &amp; &quot;A&quot;&gt;");
    expect(html).toContain("&lt;학생&gt;");
    expect(html).not.toContain("<학생>");
  });
});
