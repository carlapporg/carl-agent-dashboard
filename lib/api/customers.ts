import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { env } from "@/lib/config/env";
import { getCustomerHistory, mockCustomers } from "@/mocks/data";
import {
  customerHistoryItemSchema,
  customerProfileSchema,
  type CustomerHistoryItem,
  type CustomerProfile,
} from "@/types/customer";
import { z } from "zod";

export const customersApi = {
  async getProfile(customerId: string): Promise<CustomerProfile> {
    if (!env.isApiConfigured) {
      const profile = mockCustomers[customerId];
      if (!profile) throw new Error("NOT_FOUND");
      return profile;
    }

    return apiRequest(API_ENDPOINTS.customers.profile(customerId), {
      schema: customerProfileSchema,
    });
  },

  async getHistory(customerId: string): Promise<CustomerHistoryItem[]> {
    if (!env.isApiConfigured) {
      return getCustomerHistory(customerId);
    }

    return apiRequest(API_ENDPOINTS.customers.history(customerId), {
      schema: z.array(customerHistoryItemSchema),
    });
  },
};
