"use server";

import { isApiError } from "@/lib/api/errors";
import { toUserMessage } from "@/lib/api/error-handler";
import { payoutSettingsApi } from "@/lib/api/payout-settings";
import type {
  PayoutConnectLink,
  PayoutLoginLink,
  PayoutSettings,
  UpsertManualBankInput,
} from "@/types/payout-settings";

type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

function fail(error: unknown): ActionResult<never> {
  return { ok: false, message: toUserMessage(error) };
}

function validateBankInput(input: UpsertManualBankInput): string | null {
  const holderName = input.holderName.trim();
  if (holderName.length < 2 || holderName.length > 120) {
    return "Account holder name must be 2–120 characters.";
  }
  const routing = input.routingNumber.replace(/\s+/g, "");
  if (!/^\d{9}$/.test(routing)) {
    return "Routing number must be exactly 9 digits.";
  }
  const account = input.accountNumber.replace(/\s+/g, "");
  if (!/^\d{4,17}$/.test(account)) {
    return "Account number must be 4–17 digits.";
  }
  if (input.accountType !== "checking" && input.accountType !== "savings") {
    return "Account type must be checking or savings.";
  }
  if (input.bankName && input.bankName.trim().length > 80) {
    return "Bank name must be 80 characters or fewer.";
  }
  if (
    input.preferredPayoutMethod &&
    input.preferredPayoutMethod !== "manual_bank" &&
    input.preferredPayoutMethod !== "stripe_connect"
  ) {
    return "Preferred payout method is invalid.";
  }
  return null;
}

export async function getPayoutSettingsAction(): Promise<
  ActionResult<PayoutSettings>
> {
  try {
    return { ok: true, data: await payoutSettingsApi.get() };
  } catch (error) {
    if (isApiError(error)) return fail(error);
    return fail(error);
  }
}

export async function createPayoutConnectLinkAction(
  country = "US",
): Promise<ActionResult<PayoutConnectLink>> {
  try {
    return {
      ok: true,
      data: await payoutSettingsApi.createConnectLink(country),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function createPayoutLoginLinkAction(): Promise<
  ActionResult<PayoutLoginLink>
> {
  try {
    return { ok: true, data: await payoutSettingsApi.createLoginLink() };
  } catch (error) {
    return fail(error);
  }
}

export async function saveManualBankAction(
  input: UpsertManualBankInput,
): Promise<ActionResult<PayoutSettings>> {
  const message = validateBankInput(input);
  if (message) return { ok: false, message };
  try {
    return {
      ok: true,
      data: await payoutSettingsApi.saveBank({
        ...input,
        holderName: input.holderName.trim(),
        routingNumber: input.routingNumber.replace(/\s+/g, ""),
        accountNumber: input.accountNumber.replace(/\s+/g, ""),
        bankName: input.bankName?.trim() || undefined,
      }),
    };
  } catch (error) {
    return fail(error);
  }
}

export async function clearManualBankAction(): Promise<
  ActionResult<PayoutSettings>
> {
  try {
    return { ok: true, data: await payoutSettingsApi.clearBank() };
  } catch (error) {
    return fail(error);
  }
}

export async function disconnectStripeAction(): Promise<
  ActionResult<PayoutSettings>
> {
  try {
    return { ok: true, data: await payoutSettingsApi.disconnect() };
  } catch (error) {
    return fail(error);
  }
}
