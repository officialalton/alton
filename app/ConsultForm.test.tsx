import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsultForm from "./ConsultForm";
import * as actions from "./consult-actions";

vi.mock("./consult-actions", () => ({
  listOpenHomepageConsultSlots: vi.fn(),
  submitHomepageConsultRequest: vi.fn(),
}));

// 2026-09-06 — 드롭다운이 캘린더+시간버튼 공용 컴포넌트(ConsultSlotPicker)로
// 교체됨에 따라 슬롯 선택 흐름도 "날짜 클릭 → 시간 버튼 클릭"으로 갱신한다.
// "내일" 오후 5시로 슬롯을 잡아 초기 캘린더 뷰(이번 달, 월말 자정 부근의 아주 드문
// 예외 제외)에서 바로 보이게 한다 — 실제 시각을 고정하는 fake timer는 testing-library
// waitFor와 상호작용이 까다로워 피한다.
const SLOT_DATE = new Date();
SLOT_DATE.setDate(SLOT_DATE.getDate() + 1);
SLOT_DATE.setHours(17, 0, 0, 0);
const SLOT_ISO = SLOT_DATE.toISOString();
const SLOT_DAY = String(SLOT_DATE.getDate());

function mockSlots() {
  vi.mocked(actions.listOpenHomepageConsultSlots).mockResolvedValue([{ startsAt: SLOT_ISO }]);
}

async function fillAndSelectSlot() {
  fireEvent.change(screen.getByLabelText("학부모 이름"), { target: { value: "김민지" } });
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "minji@example.com" } });

  // 캘린더에 배지가 뜰 때까지 대기 후 해당 날짜 클릭 → 시간 버튼 목록 노출 → 클릭.
  await waitFor(() => expect(screen.queryByText("가능한 시간을 불러오는 중...")).not.toBeInTheDocument());
  const dayButtons = await screen.findAllByRole("button", { name: `${SLOT_DAY}일` });
  fireEvent.click(dayButtons[0]);

  const timeGroup = await screen.findByRole("group", { name: "상담 희망 시간 선택" });
  const timeButtons = timeGroup.querySelectorAll("button");
  expect(timeButtons.length).toBeGreaterThan(0);
  fireEvent.click(timeButtons[0]);
}

describe("ConsultForm", () => {
  it("동의 없이 제출하면 에러 문구를 보여주고 서버 액션을 호출하지 않는다", async () => {
    mockSlots();
    render(<ConsultForm />);
    await fillAndSelectSlot();
    fireEvent.click(screen.getByText("상담 신청하기"));
    expect(
      await screen.findByText("개인정보 수집·이용에 동의해주세요.")
    ).toBeInTheDocument();
    expect(actions.submitHomepageConsultRequest).not.toHaveBeenCalled();
  });

  it("시간을 선택하지 않으면 에러 문구를 보여준다", async () => {
    mockSlots();
    render(<ConsultForm />);
    fireEvent.change(screen.getByLabelText("학부모 이름"), { target: { value: "김민지" } });
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "minji@example.com" } });
    fireEvent.click(
      screen.getByText(/개인정보 수집·이용에 동의합니다/).closest("label")!.querySelector("input")!
    );
    fireEvent.click(screen.getByText("상담 신청하기"));
    expect(await screen.findByText("상담 희망 시간을 선택해주세요.")).toBeInTheDocument();
  });

  it("필수 항목을 채우고 동의·시간선택 후 제출하면 서버 액션이 호출되고 완료 문구가 보인다", async () => {
    mockSlots();
    vi.mocked(actions.submitHomepageConsultRequest).mockResolvedValue({ id: "c1", status: "requested" });
    render(<ConsultForm />);
    await fillAndSelectSlot();

    expect(await screen.findByTestId("consult-slot-confirmation")).toBeInTheDocument();

    fireEvent.click(
      screen.getByText(/개인정보 수집·이용에 동의합니다/).closest("label")!.querySelector("input")!
    );
    fireEvent.click(screen.getByText("상담 신청하기"));

    await waitFor(() =>
      expect(actions.submitHomepageConsultRequest).toHaveBeenCalledWith(
        expect.objectContaining({ parentName: "김민지", email: "minji@example.com", slotStartsAtIso: SLOT_ISO })
      )
    );
    expect(await screen.findByText("상담 신청이 접수되었습니다.")).toBeInTheDocument();
  });

  it("서버 액션이 실패하면 에러 메시지를 보여주고 슬롯을 재조회한다(충돌 대응)", async () => {
    mockSlots();
    vi.mocked(actions.submitHomepageConsultRequest).mockRejectedValue(
      new Error("이미 다른 상담이 신청되었거나 확정된 시간입니다. 다른 시간을 선택해 주세요.")
    );
    render(<ConsultForm />);
    await fillAndSelectSlot();
    const callsBeforeSubmit = vi.mocked(actions.listOpenHomepageConsultSlots).mock.calls.length;
    fireEvent.click(
      screen.getByText(/개인정보 수집·이용에 동의합니다/).closest("label")!.querySelector("input")!
    );
    fireEvent.click(screen.getByText("상담 신청하기"));

    expect(
      await screen.findByText("이미 다른 상담이 신청되었거나 확정된 시간입니다. 다른 시간을 선택해 주세요.")
    ).toBeInTheDocument();
    // 충돌 후 재조회가 일어난다(제출 전 대비 호출 횟수가 늘어난다).
    await waitFor(() =>
      expect(vi.mocked(actions.listOpenHomepageConsultSlots).mock.calls.length).toBeGreaterThan(callsBeforeSubmit)
    );
  });
});
