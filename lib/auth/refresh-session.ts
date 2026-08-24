import {
  refreshBackendTokens,
  type RefreshOutcome,
} from "@/lib/auth/backend-refresh";
import { updateSessionTokens } from "@/lib/auth/session";

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Single-flight refresh. Concurrent 401s share one Nest /auth/refresh call.
 */
export async function refreshSessionAccessToken(
  refreshToken: string,
): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const result = await refreshBackendTokens(refreshToken);
    if (!result.ok) return result;

    try {
      await updateSessionTokens(result.accessToken, result.refreshToken);
    } catch {
      /* RSC cannot always Set-Cookie; middleware persists on the next navigation. */
    }

    return result;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}
