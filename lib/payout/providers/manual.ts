// 수동 경로: 관리자가 은행/Mercury 화면에서 직접 송금하고 ALTON에는 거래 ID·증빙만 기록한다. 외부 호출 없음.
import { ProviderUnsupportedError, type PayoutProvider } from "./types";

export const manualProvider: PayoutProvider = {
  name: "manual",
  async requestPayout() {
    throw new ProviderUnsupportedError("Manual payouts have no API request; record the transfer id with evidence instead");
  },
  async findExistingRequest() {
    return null;
  },
  async getTransaction() {
    return null;
  },
};
