import { spawn } from "node:child_process";
import { loadEnvFile, printEnvMap } from "./resolve-env.mjs";

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--which") {
  printEnvMap();
  if (args[0] === "--which") {
    process.exit(0);
  }
  console.error("\nUsage: node scripts/with-env.mjs <command> [args...]");
  process.exit(1);
}

const { mode, fileName, envPath } = loadEnvFile(args);

if (mode === "staging") {
  console.log("Loading staging environment");
} else if (mode === "production") {
  console.log("Loading production environment");
} else {
  console.log(`Loading override environment (${fileName})`);
}

if (envPath) {
  console.log(`[env] ${envPath}`);
} else {
  console.log(
    `[env] ${fileName} not on disk — using platform environment variables`,
  );
}

function stripApiVersionPrefix(baseUrl) {
  return baseUrl.trim().replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
}

if (process.env.API_BASE_URL && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  process.env.NEXT_PUBLIC_API_BASE_URL = process.env.API_BASE_URL;
}

if (
  process.env.API_BASE_URL &&
  !process.env.NEXT_PUBLIC_SOCKET_URL?.trim()
) {
  process.env.NEXT_PUBLIC_SOCKET_URL = stripApiVersionPrefix(
    process.env.API_BASE_URL,
  );
}

const [command, ...commandArgs] = args;
const child = spawn(command, commandArgs, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
