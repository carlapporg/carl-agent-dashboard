import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

export const STAGING_ENV_FILE = ".env.staging";
export const PRODUCTION_ENV_FILE = ".env.production";

function exitWithEnvError(message) {
  console.error(message);
  process.exit(1);
}

function commandTokens(commandArgs = []) {
  return commandArgs.map((token) => String(token).toLowerCase());
}

/**
 * Command-based env selection (not git branch).
 * - next dev  → staging
 * - next build / next start → production
 */
export function detectEnvMode(commandArgs = []) {
  if (process.env.ENV_FILE?.trim()) {
    return {
      mode: "override",
      fileName: process.env.ENV_FILE.trim(),
    };
  }

  const tokens = commandTokens(commandArgs);
  const isDevCommand =
    tokens.includes("dev") &&
    !tokens.includes("build") &&
    !tokens.includes("start");
  const isProductionCommand =
    tokens.includes("build") || tokens.includes("start");

  if (isDevCommand) {
    return { mode: "staging", fileName: STAGING_ENV_FILE };
  }

  if (isProductionCommand) {
    return { mode: "production", fileName: PRODUCTION_ENV_FILE };
  }

  if (process.env.NODE_ENV === "production") {
    return { mode: "production", fileName: PRODUCTION_ENV_FILE };
  }

  return { mode: "staging", fileName: STAGING_ENV_FILE };
}

export function resolveEnvFile(commandArgs = []) {
  const { mode, fileName } = detectEnvMode(commandArgs);
  const envPath = resolve(process.cwd(), fileName);

  if (existsSync(envPath)) {
    return { mode, fileName, envPath };
  }

  const platformUrl = process.env.API_BASE_URL?.trim();
  if (platformUrl) {
    return { mode, fileName, envPath: null };
  }

  if (mode === "override") {
    exitWithEnvError(
      `ENV file "${fileName}" not found. Create it from .env.example or fix ENV_FILE.`,
    );
  }

  exitWithEnvError(
    `ENV file "${fileName}" not found for ${mode}. Copy .env.example to ${fileName} and set API_BASE_URL.`,
  );
}

export function getEnvFilePath(commandArgs = []) {
  return resolveEnvFile(commandArgs).envPath ?? undefined;
}

export function loadEnvFile(commandArgs = []) {
  const { mode, fileName, envPath } = resolveEnvFile(commandArgs);

  if (!envPath) {
    validateLoadedEnv(mode, fileName);
    return { mode, fileName, envPath: null };
  }

  const result = loadDotenv({ path: envPath, override: false });
  if (result.error) {
    exitWithEnvError(
      `Failed to load env file "${envPath}": ${result.error.message}`,
    );
  }

  validateLoadedEnv(mode, fileName);
  return { mode, fileName, envPath };
}

function validateLoadedEnv(mode, fileName) {
  const stub =
    process.env.AUTH_STUB_MODE === "true" ||
    process.env.AUTH_STUB_MODE === "1";
  const apiBaseUrl = (process.env.API_BASE_URL ?? "").trim();

  if (stub && !apiBaseUrl) {
    return;
  }

  if (!apiBaseUrl) {
    exitWithEnvError(
      `Missing API_BASE_URL in ${fileName} (${mode}). Copy .env.example, set a full http(s) URL including /api/v1, then retry.`,
    );
  }

  try {
    const parsed = new URL(apiBaseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("protocol");
    }
  } catch {
    exitWithEnvError(
      `Invalid API_BASE_URL "${apiBaseUrl}" in ${fileName}. Use a full http(s) URL including /api/v1.`,
    );
  }
}

export function printEnvMap() {
  console.log("npm run dev            → Loading staging environment (.env.staging)");
  console.log("npm run build          → Loading production environment (.env.production)");
  console.log("npm run start          → Loading production environment (.env.production)");
  console.log("production deployment  → .env.production if present, else platform env vars");
  console.log("override               → ENV_FILE=.env.local npm run dev");
}
