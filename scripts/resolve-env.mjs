import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

const MAIN_ENV_FILE = ".env.production";
const OTHER_ENV_FILE = ".env.staging";

function getCurrentGitBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

function exitWithEnvError(message) {
  console.error(message);
  process.exit(1);
}

function resolveEnvFilePath(fileName, branchLabel) {
  const envPath = resolve(process.cwd(), fileName);
  if (!existsSync(envPath)) {
    exitWithEnvError(
      `ENV file "${fileName}" not found for ${branchLabel}. Create it in the project root or set ENV_FILE.`,
    );
  }
  return envPath;
}

export function resolveEnvFile() {
  if (process.env.ENV_FILE?.trim()) {
    return resolveEnvFilePath(
      process.env.ENV_FILE.trim(),
      `ENV_FILE="${process.env.ENV_FILE.trim()}"`,
    );
  }

  const branch = getCurrentGitBranch();

  if (branch === null) {
    if (process.env.API_BASE_URL || process.env.AUTH_STUB_MODE) {
      return null;
    }
    exitWithEnvError(
      'Not a git repository and required env is not set. Set ENV_FILE or create .env.staging / .env.production.',
    );
  }

  const fileName = branch === "main" ? MAIN_ENV_FILE : OTHER_ENV_FILE;
  return resolveEnvFilePath(fileName, `branch "${branch}"`);
}

export function getEnvFilePath() {
  return resolveEnvFile() ?? undefined;
}

export function loadEnvFile() {
  const envPath = resolveEnvFile();
  if (!envPath) {
    return null;
  }

  const result = loadDotenv({ path: envPath, override: false });
  if (result.error) {
    exitWithEnvError(
      `Failed to load env file "${envPath}": ${result.error.message}`,
    );
  }

  return envPath;
}
