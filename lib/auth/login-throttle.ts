import { ApiError } from "@/lib/api/errors";
import { USER_MESSAGES } from "@/lib/api/public-messages";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = {
  count: number;
  windowStart: number;
};

const attempts = new Map<string, Bucket>();

function prune(now: number) {
  for (const [key, bucket] of attempts) {
    if (now - bucket.windowStart > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export function throttleKey(ip: string, email: string): string {
  return `${ip}|${email.trim().toLowerCase()}`;
}

export function assertLoginAllowed(key: string): void {
  const now = Date.now();
  prune(now);
  const bucket = attempts.get(key);
  if (!bucket) return;
  if (now - bucket.windowStart > WINDOW_MS) {
    attempts.delete(key);
    return;
  }
  if (bucket.count >= MAX_ATTEMPTS) {
    throw new ApiError(
      {
        code: "RATE_LIMITED",
        message: USER_MESSAGES.rateLimited,
      },
      429,
      true,
    );
  }
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  prune(now);
  const existing = attempts.get(key);
  if (!existing || now - existing.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return;
  }
  existing.count += 1;
}

export function recordLoginSuccess(key: string): void {
  attempts.delete(key);
}
