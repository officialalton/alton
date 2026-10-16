import { useEffect } from "react";

/**
 * 포털 셸의 계정 메뉴(프로필/로그아웃) 공통 닫힘 규칙.
 * - 바깥 클릭: 트리거(`data-account-menu-trigger`)와 패널(`data-account-menu`) 밖을 누르면 닫는다.
 *   (트리거 자체의 재클릭은 버튼의 토글이 처리한다.)
 * - Escape: 닫고 트리거로 포커스를 돌려준다.
 * - closeKey(활성 탭 등 "라우트" 값)가 바뀌면 닫는다.
 */
export function useAccountMenuDismiss(open: boolean, setOpen: (v: boolean) => void, closeKey: string) {
  useEffect(() => {
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeKey]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Element | null;
      if (t?.closest?.("[data-account-menu], [data-account-menu-trigger]")) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      const triggers = Array.from(document.querySelectorAll<HTMLElement>("[data-account-menu-trigger]"));
      const visible = triggers.find((el) => el.getClientRects().length > 0) ?? triggers[0];
      visible?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);
}
