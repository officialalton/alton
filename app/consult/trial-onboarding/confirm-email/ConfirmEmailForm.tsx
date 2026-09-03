"use client";

import { useState } from "react";
import { requestLoginEmailChangeAction } from "@/app/consult/trial-onboarding-email-actions";

export default function ConfirmEmailForm({
  token,
  linkId,
  defaultEmail,
}: {
  token: string;
  linkId: string;
  defaultEmail: string;
}) {
  const [mode, setMode] = useState<"default" | "editing">("default");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"sent" | "conflict" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (result === "sent") {
    return (
      <div className="bg-grey-100 rounded-lg px-4 py-4 text-[13px] text-ink">
        <p className="font-bold mb-1">확인 메일을 보냈습니다</p>
        <p>
          {newEmail}로 확인 메일을 보냈습니다. 메일함에서 링크를 클릭하면 계정 생성이
          이어집니다. 메일이 오지 않으면 스팸함도 확인해주세요.
        </p>
      </div>
    );
  }

  if (result === "conflict") {
    return (
      <div className="bg-red/5 rounded-lg px-4 py-4 text-[13px] text-ink">
        <p className="font-bold mb-1 text-red">이미 사용 중인 이메일입니다</p>
        <p>
          입력하신 이메일은 이미 다른 Alton Education 계정에서 사용 중입니다. 자동으로
          연결하지 않습니다 — 기존 계정으로 로그인해 진행하시거나, 관리자에게 문의해주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="onboarding-email" className="block text-[11.5px] font-semibold text-grey-500 mb-1">
        로그인 이메일
      </label>
      <input
        id="onboarding-email"
        type="email"
        className="w-full border border-grey-300 rounded px-3 py-2 text-[13.5px] mb-2"
        value={mode === "default" ? defaultEmail : newEmail}
        readOnly={mode === "default"}
        onChange={(e) => setNewEmail(e.target.value)}
      />
      {mode === "default" ? (
        <button
          type="button"
          onClick={() => {
            setMode("editing");
            setNewEmail(defaultEmail);
          }}
          className="text-[12px] font-semibold text-ink underline mb-4"
        >
          다른 이메일 사용하기
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setMode("default")}
          className="text-[12px] font-semibold text-grey-500 mb-4"
        >
          {defaultEmail}로 되돌리기
        </button>
      )}

      {error && (
        <div className="text-[12px] text-red mb-2" role="alert">
          {error}
        </div>
      )}

      {mode === "default" ? (
        <a
          href={`/api/trial-onboarding/confirm-email?token=${encodeURIComponent(token)}`}
          className="inline-block text-[13px] font-bold px-4 py-2 rounded-lg bg-ink text-white"
        >
          이 이메일로 계속
        </a>
      ) : (
        <button
          type="button"
          disabled={busy || !newEmail || newEmail.toLowerCase() === defaultEmail.toLowerCase()}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const outcome = await requestLoginEmailChangeAction(linkId, newEmail);
              if (outcome.status === "error") {
                setError(outcome.error);
              } else {
                setResult(outcome.status);
              }
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
            setBusy(false);
          }}
          className="text-[13px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {busy ? "확인 메일 발송 중..." : "이 이메일로 확인 메일 받기"}
        </button>
      )}
    </div>
  );
}
