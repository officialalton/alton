"use client";

import { useState } from "react";
import {
  createContractFromProposal,
  companySignOffContractVersion,
  sendContractForSignature,
  createNewContractVersionForResend,
  voidContractVersion,
  reconcileDocusignStatus,
} from "./consultation-actions";
import type { AcceptedProposalForContract, FamilyContract } from "./contracts-data";

const btnPrimary =
  "text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50";
const btnSecondary =
  "text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50";
const card = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  ready: "준비됨",
  sent: "발송됨",
  awaiting_signature: "서명 대기",
  signed: "서명완료",
  active: "활성",
  termination_pending: "해지 대기",
  terminated: "해지됨",
  void: "무효",
  superseded: "대체됨",
  expired: "만료",
};

export default function ContractsTab({
  contracts,
  acceptedProposals,
}: {
  contracts: FamilyContract[];
  acceptedProposals: AcceptedProposalForContract[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="max-w-[880px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">계약</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        수락된 제안서로부터 계약을 생성하고, 회사 선서명 → 발송 → 서명 상태를 관리합니다.
      </p>

      {error && <p className="text-[12px] text-red mb-3">{error}</p>}

      <h2 className="text-[14px] font-bold text-ink mb-3">계약 생성 대기 (수락된 제안서)</h2>
      <div className="mb-8">
        {acceptedProposals.length === 0 ? (
          <p className="text-[13px] text-grey-500">계약을 생성할 수 있는 수락된 제안서가 없습니다.</p>
        ) : (
          acceptedProposals.map((p) => (
            <NewContractRow
              key={p.proposalId}
              proposal={p}
              onError={setError}
              open={creating === true}
            />
          ))
        )}
      </div>

      <h2 className="text-[14px] font-bold text-ink mb-3">계약 목록</h2>
      {contracts.length === 0 ? (
        <p className="text-[13px] text-grey-500">등록된 계약이 없습니다.</p>
      ) : (
        contracts.map((c) => {
          const open = openId === c.id;
          const latest = c.versions[c.versions.length - 1];
          return (
            <div key={c.id} className={card} data-testid={`contract-card-${c.id}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-bold text-ink">
                    {c.parentName} · {c.studentName}{" "}
                    <span className="text-[11px] font-semibold text-grey-500">
                      ({STATUS_LABEL[c.status] ?? c.status})
                    </span>
                  </div>
                  <div className="text-[12px] text-grey-500">
                    버전 {c.versions.length}개
                    {c.voidedAt ? ` · 무효화: ${c.voidReason}` : ""}
                  </div>
                </div>
                <button className={btnSecondary} onClick={() => setOpenId(open ? null : c.id)}>
                  {open ? "닫기" : "관리"}
                </button>
              </div>

              {open && latest && (
                <ContractDetail contract={c} latestVersion={latest} onError={setError} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function NewContractRow({
  proposal,
  onError,
}: {
  proposal: AcceptedProposalForContract;
  onError: (e: string | null) => void;
  open: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return null;

  const missingIds = !proposal.householdId || !proposal.childId;

  return (
    <div
      className={card + " flex items-center justify-between"}
      data-testid={`new-contract-row-${proposal.proposalId}`}
    >
      <div>
        <div className="text-[14px] font-bold text-ink">{proposal.contactName}</div>
        <div className="text-[12px] text-grey-500">
          {missingIds
            ? "이 상담에는 household/child가 아직 연결되지 않아 계약을 생성할 수 없습니다."
            : "수락된 제안서 — 계약 생성 가능"}
        </div>
      </div>
      <button
        disabled={busy || missingIds}
        className={btnPrimary}
        onClick={async () => {
          setBusy(true);
          onError(null);
          try {
            await createContractFromProposal({
              householdId: proposal.householdId!,
              childId: proposal.childId!,
              proposalId: proposal.proposalId,
            });
            setDone(true);
          } catch (e) {
            onError(e instanceof Error ? e.message : "계약 생성에 실패했습니다.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "생성 중…" : "계약 생성"}
      </button>
    </div>
  );
}

function ContractDetail({
  contract,
  latestVersion,
  onError,
}: {
  contract: FamilyContract;
  latestVersion: FamilyContract["versions"][number];
  onError: (e: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState(contract.parentName);

  const signedOff = !!latestVersion.companySignedAt;
  const canSend = signedOff && !latestVersion.docusignEnvelopeId;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    onError(null);
    try {
      await fn();
    } catch (e) {
      onError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-grey-200 space-y-4">
      <div>
        <div className="text-[12px] font-bold text-ink mb-1">
          최신 버전 (v{latestVersion.versionNumber})
        </div>
        <div className="text-[12px] text-grey-500 mb-2">
          회사 선서명: {signedOff ? `완료 (${new Date(latestVersion.companySignedAt!).toLocaleString("ko-KR")})` : "대기"}
          {" · "}
          Envelope: {latestVersion.docusignEnvelopeStatus ?? "미발송"}
        </div>

        {!signedOff && (
          <button
            disabled={busy}
            className={btnSecondary}
            onClick={() => run(() => companySignOffContractVersion(latestVersion.id))}
          >
            회사 선서명 승인
          </button>
        )}

        <div className="mt-2">
          {!signedOff ? (
            <p className="text-[11.5px] text-grey-500">
              발송 버튼은 회사 선서명이 완료되어야 활성화됩니다.
            </p>
          ) : latestVersion.docusignEnvelopeId ? (
            <p className="text-[11.5px] text-grey-500">이미 발송된 버전입니다. 상태를 새로고침하거나 재발송(새 버전 생성)하세요.</p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="수신자 이름"
                className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
              />
              <input
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="수신자 이메일"
                className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px]"
              />
              <button
                disabled={busy || !canSend || !recipientEmail}
                className={btnPrimary}
                title={!signedOff ? "회사 선서명이 완료되어야 발송할 수 있습니다." : undefined}
                onClick={() =>
                  run(async () => {
                    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
                    await sendContractForSignature({
                      contractVersionId: latestVersion.id,
                      recipientEmail,
                      recipientName,
                      childName: contract.studentName,
                      webhookUrl: `${siteUrl}/api/webhooks/docusign`,
                    });
                  })
                }
              >
                발송
              </button>
            </div>
          )}
        </div>

        {latestVersion.docusignEnvelopeId && (
          <button
            disabled={busy}
            className={btnSecondary + " mt-2"}
            onClick={() =>
              run(async () => {
                await reconcileDocusignStatus(latestVersion.id);
              })
            }
          >
            상태 새로고침
          </button>
        )}
      </div>

      <div>
        <div className="text-[12px] font-bold text-ink mb-1">재발송(새 버전)</div>
        <p className="text-[11.5px] text-grey-500 mb-1.5">
          재발송은 기존 서명 상태를 덮어쓰지 않고 새 계약 버전을 만듭니다. 새 버전도 회사 선서명을 다시 거쳐야 발송할 수 있습니다.
        </p>
        <button
          disabled={busy}
          className={btnSecondary}
          onClick={() =>
            run(async () => {
              await createNewContractVersionForResend({
                contractId: contract.id,
                proposalId: latestVersion.proposalId ?? undefined,
              });
            })
          }
        >
          새 버전으로 재발송 준비
        </button>
      </div>

      <div>
        <div className="text-[12px] font-bold text-ink mb-1">무효화</div>
        <div className="flex items-center gap-2">
          <input
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="무효화 사유(필수)"
            className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[12px] flex-1"
          />
          <button
            disabled={busy || !voidReason}
            className={btnSecondary}
            onClick={() => run(() => voidContractVersion(latestVersion.id, voidReason))}
          >
            계약 무효화
          </button>
        </div>
      </div>

      <div>
        <div className="text-[12px] font-bold text-ink mb-1.5">문서 보관 (Google Drive)</div>
        {contract.driveArtifacts.length === 0 ? (
          <p className="text-[11.5px] text-grey-500">보관된 문서가 없습니다.</p>
        ) : (
          contract.driveArtifacts.map((a) => (
            <div key={a.id} className="text-[12px] text-ink flex items-center justify-between py-1">
              <span>{a.artifactType}</span>
              {a.driveFileId ? (
                <a
                  href={`https://drive.google.com/file/d/${a.driveFileId}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink underline"
                >
                  보기
                </a>
              ) : (
                <span className="text-grey-500">보관 대기 중 ({a.syncStatus})</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
