// Wise는 폐기된 계획이다(2026-10-07 Mercury 전환). 과거 Wise 기록을 읽기 전용으로 구분하기 위해 이름만 남기고 호출은 전부 막는다.
import { ProviderDisabledError, type PayoutProvider } from "./types";

export const wiseRetiredProvider: PayoutProvider = {
  name: "wise",
  async requestPayout() {
    throw new ProviderDisabledError("Wise payouts are retired; use Mercury or the manual path");
  },
  async findExistingRequest() {
    return null;
  },
  async getTransaction() {
    return null;
  },
};
