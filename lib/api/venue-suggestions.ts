import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  venueRefreshResultSchema,
  venueSendResultSchema,
  type VenueRefreshResult,
  type VenueSendResult,
} from "@/types/venue";

export const venueSuggestionsApi = {
  /** POST refresh — Nest fills task.metadata.venueSuggestions (Google or Nominatim). */
  async refresh(taskId: string): Promise<VenueRefreshResult> {
    const data = await apiRequest(
      API_ENDPOINTS.agents.taskVenueSuggestionsRefresh(taskId),
      {
        method: "POST",
        schema: venueRefreshResultSchema,
        looseEnvelope: true,
        dedupe: false,
      },
    );
    return data;
  },

  async search(taskId: string, query: string): Promise<VenueRefreshResult> {
    return apiRequest(API_ENDPOINTS.agents.taskVenueSuggestionsSearch(taskId), {
      method: "POST",
      body: { query },
      schema: venueRefreshResultSchema,
      looseEnvelope: true,
      dedupe: false,
    });
  },

  async send(
    taskId: string,
    suggestionIds: string[],
  ): Promise<VenueSendResult> {
    return apiRequest(API_ENDPOINTS.agents.taskVenueSuggestionsSend(taskId), {
      method: "POST",
      body: { suggestionIds },
      schema: venueSendResultSchema,
      looseEnvelope: true,
      dedupe: false,
    });
  },
};
