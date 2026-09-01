"use client";

import { useState } from "react";
import { inviteChild } from "./invite-actions";

// R2 잔여 항목(Task 4에서 서버 액션만 만들고 화면이 없었던 부분) — 보호자가
// 이미 연결된 자녀 외에 추가로 자녀를 초대하는 화면. §4.19: "가입한 보호자는
// 자기 화면에서 자녀를 추가로 초대·연결할 수 있다."
export default function FamilyTab() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSentTo(null);
    setSubmitting(true);
    const result = await inviteChild({ name, email, grade: grade || undefined });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSentTo(email);
    setName("");
    setEmail("");
    setGrade("");
  }

  return (
    <div className="max-w-[520px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-4">자녀 추가 초대</h2>

      {error && (
        <div className="bg-red/10 text-red text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}
      {sentTo && (
        <div className="bg-green/10 text-green text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          초대 이메일이 발송되었습니다: {sentTo}
        </div>
      )}

      <div className="space-y-2 mb-3">
        <input
          placeholder="이름"
          aria-label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
        <input
          placeholder="이메일"
          aria-label="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
        <input
          placeholder="학년(선택)"
          aria-label="학년"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px]"
        />
      </div>
      <button
        disabled={submitting || !name || !email}
        onClick={handleSubmit}
        className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2 disabled:opacity-50"
      >
        {submitting ? "처리 중..." : "초대 보내기"}
      </button>
    </div>
  );
}
