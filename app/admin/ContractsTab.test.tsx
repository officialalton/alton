import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ContractsTab from "./ContractsTab";
import {
  createContractFromProposal,
  companySignOffContractVersion,
  voidContractVersion,
} from "./consultation-actions";

vi.mock("./consultation-actions", () => ({
  createContractFromProposal: vi.fn(),
  companySignOffContractVersion: vi.fn(),
  sendContractForSignature: vi.fn(),
  createNewContractVersionForResend: vi.fn(),
  voidContractVersion: vi.fn(),
  reconcileDocusignStatus: vi.fn(),
}));

describe("ContractsTab", () => {
  it("계약 생성 대기(수락된 제안서)와 계약 목록을 보여준다", () => {
    render(
      <ContractsTab
        acceptedProposals={[
          { proposalId: "p1", consultationId: "cons1", householdId: "h1", childId: "s1", contactName: "김민지" },
        ]}
        contracts={[
          {
            id: "ct1",
            householdId: "h1",
            childId: "s1",
            parentName: "최유진",
            studentName: "최하은",
            status: "signed",
            voidReason: null,
            voidedAt: null,
            signedAt: "2026-08-02",
            versions: [
              {
                id: "cv1",
                versionNumber: 1,
                versionStatus: "active",
                companySignedAt: "2026-08-01T00:00:00Z",
                docusignEnvelopeId: "env1",
                docusignEnvelopeStatus: "completed",
                docusignStatusUpdatedAt: "2026-08-02T00:00:00Z",
                proposalId: "prop1",
                createdAt: "2026-08-01T00:00:00Z",
              },
            ],
            driveArtifacts: [],
          },
        ]}
      />
    );

    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.getByText("최유진 · 최하은")).toBeInTheDocument();
  });

  it("계약 생성 버튼을 누르면 createContractFromProposal이 호출된다", async () => {
    vi.mocked(createContractFromProposal).mockResolvedValue({
      contractId: "ct2",
      contractVersionId: "cv2",
    });
    render(
      <ContractsTab
        acceptedProposals={[
          { proposalId: "p1", consultationId: "cons1", householdId: "h1", childId: "s1", contactName: "김민지" },
        ]}
        contracts={[]}
      />
    );

    fireEvent.click(screen.getByText("계약 생성"));

    await waitFor(() => {
      expect(createContractFromProposal).toHaveBeenCalledWith({
        householdId: "h1",
        childId: "s1",
        proposalId: "p1",
      });
    });
  });

  it("household/child가 없는 제안서는 계약 생성 버튼이 비활성화된다", () => {
    render(
      <ContractsTab
        acceptedProposals={[
          { proposalId: "p1", consultationId: "cons1", householdId: null, childId: null, contactName: "김민지" },
        ]}
        contracts={[]}
      />
    );
    expect(screen.getByText("계약 생성")).toBeDisabled();
  });

  it("회사 선서명 전에는 발송 버튼 대신 안내 문구를 보여준다", () => {
    render(
      <ContractsTab
        acceptedProposals={[]}
        contracts={[
          {
            id: "ct1",
            householdId: "h1",
            childId: "s1",
            parentName: "최유진",
            studentName: "최하은",
            status: "draft",
            voidReason: null,
            voidedAt: null,
            signedAt: null,
            versions: [
              {
                id: "cv1",
                versionNumber: 1,
                versionStatus: "active",
                companySignedAt: null,
                docusignEnvelopeId: null,
                docusignEnvelopeStatus: null,
                docusignStatusUpdatedAt: null,
                proposalId: null,
                createdAt: "2026-08-01T00:00:00Z",
              },
            ],
            driveArtifacts: [],
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText("관리"));
    expect(screen.getByText("회사 선서명 승인")).toBeInTheDocument();
    expect(
      screen.getByText("발송 버튼은 회사 선서명이 완료되어야 활성화됩니다.")
    ).toBeInTheDocument();
  });

  it("회사 선서명 승인 버튼을 누르면 companySignOffContractVersion이 호출된다", async () => {
    vi.mocked(companySignOffContractVersion).mockResolvedValue(undefined);
    render(
      <ContractsTab
        acceptedProposals={[]}
        contracts={[
          {
            id: "ct1",
            householdId: "h1",
            childId: "s1",
            parentName: "최유진",
            studentName: "최하은",
            status: "draft",
            voidReason: null,
            voidedAt: null,
            signedAt: null,
            versions: [
              {
                id: "cv1",
                versionNumber: 1,
                versionStatus: "active",
                companySignedAt: null,
                docusignEnvelopeId: null,
                docusignEnvelopeStatus: null,
                docusignStatusUpdatedAt: null,
                proposalId: null,
                createdAt: "2026-08-01T00:00:00Z",
              },
            ],
            driveArtifacts: [],
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText("관리"));
    fireEvent.click(screen.getByText("회사 선서명 승인"));

    await waitFor(() => {
      expect(companySignOffContractVersion).toHaveBeenCalledWith("cv1");
    });
  });

  it("무효화 사유를 입력하고 계약 무효화를 누르면 voidContractVersion이 호출된다", async () => {
    vi.mocked(voidContractVersion).mockResolvedValue(undefined);
    render(
      <ContractsTab
        acceptedProposals={[]}
        contracts={[
          {
            id: "ct1",
            householdId: "h1",
            childId: "s1",
            parentName: "최유진",
            studentName: "최하은",
            status: "draft",
            voidReason: null,
            voidedAt: null,
            signedAt: null,
            versions: [
              {
                id: "cv1",
                versionNumber: 1,
                versionStatus: "active",
                companySignedAt: null,
                docusignEnvelopeId: null,
                docusignEnvelopeStatus: null,
                docusignStatusUpdatedAt: null,
                proposalId: null,
                createdAt: "2026-08-01T00:00:00Z",
              },
            ],
            driveArtifacts: [],
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText("관리"));
    fireEvent.change(screen.getByPlaceholderText("무효화 사유(필수)"), {
      target: { value: "가족 철회 요청" },
    });
    fireEvent.click(screen.getByText("계약 무효화"));

    await waitFor(() => {
      expect(voidContractVersion).toHaveBeenCalledWith("cv1", "가족 철회 요청");
    });
  });

  it("계약이 없으면 안내 문구를 보여준다", () => {
    render(<ContractsTab acceptedProposals={[]} contracts={[]} />);
    expect(screen.getByText("등록된 계약이 없습니다.")).toBeInTheDocument();
  });
});
