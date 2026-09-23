import { apiRequest } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  venueRefreshResultSchema,
  type VenueRefreshResult,
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
};
