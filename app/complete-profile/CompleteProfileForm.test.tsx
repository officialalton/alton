import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CompleteProfileForm from "./CompleteProfileForm";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const submitCompleteProfileMock = vi.fn();
const addApCourseMock = vi.fn();
const removeApCourseMock = vi.fn();
const addExtracurricularActivityMock = vi.fn();
const removeExtracurricularActivityMock = vi.fn();

vi.mock("./actions", () => ({
  submitCompleteProfile: (...args: unknown[]) => submitCompleteProfileMock(...args),
  addApCourse: (...args: unknown[]) => addApCourseMock(...args),
  removeApCourse: (...args: unknown[]) => removeApCourseMock(...args),
  addExtracurricularActivity: (...args: unknown[]) => addExtracurricularActivityMock(...args),
  removeExtracurricularActivity: (...args: unknown[]) =>
    removeExtracurricularActivityMock(...args),
}));

function baseProps(overrides: Partial<Parameters<typeof CompleteProfileForm>[0]> = {}) {
  return {
    hasDateOfBirth: false,
    initialSchoolName: "",
    initialGrade: "",
    initialSatScore: null,
    initialGpa: null,
    initialTargetColleges: [],
    initialIntendedMajors: [],
    initialApCourses: [],
    initialActivities: [],
    ...overrides,
  };
}

describe("CompleteProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitCompleteProfileMock.mockResolvedValue(undefined);
    addApCourseMock.mockResolvedValue(undefined);
    addExtracurricularActivityMock.mockResolvedValue(undefined);
  });

  it("생년월일 미등록이면 필수 표시와 입력칸을 보여준다", () => {
    render(<CompleteProfileForm {...baseProps()} />);
    expect(screen.getByLabelText(/생년월일/)).toBeInTheDocument();
  });

  it("생년월일이 이미 등록돼 있으면 입력칸 대신 안내 문구를 보여준다(자가수정 차단 정책 유지)", () => {
    render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);
    expect(
      screen.getByText(/이미 등록되어 있습니다. 변경이 필요하면 보호자 또는 관리자에게/)
    ).toBeInTheDocument();
  });

  it("필수 항목(학교명/학년) 미입력 시 제출을 막고 에러를 보여준다", async () => {
    const { container } = render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);
    // 버튼 클릭은 jsdom의 required 속성 기본 검증에 막혀 onSubmit까지 도달하지
    // 못하므로, 폼 submit 이벤트를 직접 디스패치해 컴포넌트 자체의 유효성
    // 검사 로직(handleSubmit)을 확인한다.
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("학교명은 필수 항목입니다.")).toBeInTheDocument();
    });
    expect(submitCompleteProfileMock).not.toHaveBeenCalled();
  });

  it("필수 항목을 채우면 submitCompleteProfile을 호출하고 /student로 이동한다", async () => {
    const { container } = render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);

    fireEvent.change(screen.getByLabelText(/학교명/), { target: { value: "OO국제학교" } });
    fireEvent.change(screen.getByLabelText(/학년/), { target: { value: "10학년" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(submitCompleteProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dateOfBirth: null,
          schoolName: "OO국제학교",
          grade: "10학년",
        })
      );
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/student"));
  });

  it("AP 과목 추가 버튼이 addApCourse를 호출한다", async () => {
    render(<CompleteProfileForm {...baseProps()} />);

    fireEvent.change(screen.getByPlaceholderText("과목명 (예: AP Calculus BC)"), {
      target: { value: "AP Physics" },
    });
    fireEvent.click(screen.getAllByText("추가")[0]);

    await waitFor(() => {
      expect(addApCourseMock).toHaveBeenCalledWith(
        expect.objectContaining({ courseName: "AP Physics", status: "planned" })
      );
    });
  });

  it("목표 대학 태그를 Enter로 추가할 수 있다", () => {
    render(<CompleteProfileForm {...baseProps()} />);
    const input = screen.getByPlaceholderText("대학명을 입력 후 Enter");
    fireEvent.change(input, { target: { value: "Stanford" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Stanford")).toBeInTheDocument();
  });

  it("SAT가 400 미만이면 제출을 막는다", async () => {
    const { container } = render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);
    fireEvent.change(screen.getByLabelText(/학교명/), { target: { value: "OO국제학교" } });
    fireEvent.change(screen.getByLabelText(/학년/), { target: { value: "10학년" } });
    fireEvent.change(screen.getByLabelText(/기존 SAT 점수/), { target: { value: "399" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("SAT 점수는 400~1600 사이여야 합니다.")).toBeInTheDocument();
    });
    expect(submitCompleteProfileMock).not.toHaveBeenCalled();
  });

  it("SAT가 1600 초과면 제출을 막는다", async () => {
    const { container } = render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);
    fireEvent.change(screen.getByLabelText(/학교명/), { target: { value: "OO국제학교" } });
    fireEvent.change(screen.getByLabelText(/학년/), { target: { value: "10학년" } });
    fireEvent.change(screen.getByLabelText(/기존 SAT 점수/), { target: { value: "1601" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("SAT 점수는 400~1600 사이여야 합니다.")).toBeInTheDocument();
    });
    expect(submitCompleteProfileMock).not.toHaveBeenCalled();
  });

  it("SAT 유효 범위(400~1600) 내 값은 그대로 통과한다", async () => {
    const { container } = render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);
    fireEvent.change(screen.getByLabelText(/학교명/), { target: { value: "OO국제학교" } });
    fireEvent.change(screen.getByLabelText(/학년/), { target: { value: "10학년" } });
    fireEvent.change(screen.getByLabelText(/기존 SAT 점수/), { target: { value: "1200" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(submitCompleteProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({ satScore: 1200 })
      );
    });
  });

  it("GPA가 선택한 척도(기본 4.0)를 초과하면 제출을 막는다", async () => {
    const { container } = render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);
    fireEvent.change(screen.getByLabelText(/학교명/), { target: { value: "OO국제학교" } });
    fireEvent.change(screen.getByLabelText(/학년/), { target: { value: "10학년" } });
    fireEvent.change(screen.getByLabelText(/^GPA/), { target: { value: "4.3" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(screen.getByText("GPA 값이 선택한 척도(4.0)를 초과할 수 없습니다.")).toBeInTheDocument();
    });
    expect(submitCompleteProfileMock).not.toHaveBeenCalled();
  });

  it("GPA와 척도를 함께 선택하면 gpaScale과 함께 제출한다", async () => {
    const { container } = render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);
    fireEvent.change(screen.getByLabelText(/학교명/), { target: { value: "OO국제학교" } });
    fireEvent.change(screen.getByLabelText(/학년/), { target: { value: "10학년" } });
    fireEvent.change(screen.getByLabelText(/^GPA/), { target: { value: "3.9" } });
    fireEvent.change(container.querySelector("#gpaScale")!, { target: { value: "4.3" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(submitCompleteProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({ gpa: 3.9, gpaScale: "4.3" })
      );
    });
  });

  it("GPA를 비워두면 gpaScale도 null로 제출한다(척도만 남는 상태 방지)", async () => {
    const { container } = render(<CompleteProfileForm {...baseProps({ hasDateOfBirth: true })} />);
    fireEvent.change(screen.getByLabelText(/학교명/), { target: { value: "OO국제학교" } });
    fireEvent.change(screen.getByLabelText(/학년/), { target: { value: "10학년" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(submitCompleteProfileMock).toHaveBeenCalledWith(
        expect.objectContaining({ gpa: null, gpaScale: null })
      );
    });
  });
});
