import { getCustomerHistory, mockCustomers } from "@/mocks/data";
import type { CustomerHistoryItem, CustomerProfile } from "@/types/customer";

/** Customer APIs are not live yet — always mock. */
export const customersApi = {
  async getProfile(customerId: string): Promise<CustomerProfile> {
    const profile = mockCustomers[customerId];
    if (!profile) throw new Error("NOT_FOUND");
    return profile;
  },

  async getHistory(customerId: string): Promise<CustomerHistoryItem[]> {
    return getCustomerHistory(customerId);
  },
};
