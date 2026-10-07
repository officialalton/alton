// 세션뷰 같은 "여러 패널을 한 번에 로드하는 화면"용 — 비필수 패널의 권한 거부(RPC의 '…볼 권한이 없습니다')는
// 빈 값으로 낮추고, 그 외 오류(DB 장애 등)는 그대로 던진다. 권한 자체는 넓히지 않는다(RPC가 여전히 거부).
// 예: 담당이 끝난 선생님이 자기 과거 수업을 열 때 그 학생의 모의고사·과제 RPC는 거부되지만 페이지는 열려야 한다.

export function isPermissionDeniedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  // 2026-10-07: DB 메시지가 영어로 바뀌었다('You do not have permission …'). 마이그레이션 적용 전 환경을 위해 한국어도 함께 받는다.
  return message.includes("권한이 없습니다") || /do not have permission/i.test(message);
}

export async function emptyOnPermissionDenied<T>(load: Promise<T>, fallback: T): Promise<T> {
  try {
    return await load;
  } catch (err) {
    if (isPermissionDeniedError(err)) return fallback;
    throw err;
  }
}
