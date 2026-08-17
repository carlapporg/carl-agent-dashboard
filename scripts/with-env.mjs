import { spawn } from "node:child_process";
import { getEnvFilePath, loadEnvFile } from "./resolve-env.mjs";

const loadedPath = loadEnvFile();
const branchHint = process.env.ENV_FILE?.trim()
  ? `ENV_FILE=${process.env.ENV_FILE.trim()}`
  : loadedPath
    ? loadedPath
    : "(process env only)";

console.log(`[env] Using ${branchHint}`);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(1);
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
