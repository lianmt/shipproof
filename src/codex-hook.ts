import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG_FILE } from "./config.js";
import { createLock, readLock } from "./integrity.js";
import { statusExitCode } from "./status.js";
import { verify } from "./verifier.js";

export interface CodexHookInput {
  cwd?: string;
  hook_event_name?: string;
  stop_hook_active?: boolean;
  [key: string]: unknown;
}

export type CodexHookOutput = Record<string, unknown>;

export async function handleCodexHook(
  input: CodexHookInput,
  configPath = DEFAULT_CONFIG_FILE,
): Promise<CodexHookOutput> {
  const cwd = input.cwd ? path.resolve(input.cwd) : process.cwd();
  if (!(await fileExists(path.resolve(cwd, configPath)))) return { continue: true };

  if (input.hook_event_name === "SessionStart") {
    try {
      await createLock({ cwd, configPath });
      return {
        continue: true,
        systemMessage: "ShipProof locked the acceptance contract for this session.",
      };
    } catch (error) {
      return {
        continue: true,
        systemMessage: `ShipProof could not create a verification lock: ${toMessage(error)}`,
      };
    }
  }

  if (input.hook_event_name !== "Stop") return { continue: true };

  try {
    const lock = await readLock(cwd);
    const run = await verify({
      cwd,
      configPath,
      ...(lock?.taskPath ? { taskPath: lock.taskPath } : {}),
      requireLock: true,
    });
    if (run.status === "VERIFIED") {
      return {
        continue: true,
        systemMessage: `ShipProof VERIFIED this turn. Evidence: ${run.reportPath ?? run.runId}`,
      };
    }
    const reason = [
      `ShipProof status is ${run.status}.`,
      ...run.reasons,
      `Evidence: ${run.reportPath ?? run.runId}`,
      "Fix the failing checks or report the exact BLOCKED/UNVERIFIED boundary; do not claim completion.",
    ].join(" ");
    if (input.stop_hook_active) {
      return {
        continue: false,
        stopReason: reason,
        systemMessage: reason,
      };
    }
    return { decision: "block", reason };
  } catch (error) {
    const reason = `ShipProof could not run: ${toMessage(error)}. Do not claim verified completion.`;
    if (input.stop_hook_active) {
      return { continue: false, stopReason: reason, systemMessage: reason };
    }
    return { decision: "block", reason };
  }
}

export async function installCodexHooks(options: {
  cwd: string;
  configPath?: string;
}): Promise<string> {
  const codexDir = path.join(options.cwd, ".codex");
  const hooksPath = path.join(codexDir, "hooks.json");
  await mkdir(codexDir, { recursive: true });
  let existing: Record<string, any> = {};
  try {
    existing = JSON.parse(await readFile(hooksPath, "utf8")) as Record<string, any>;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
  const hooks = (existing.hooks ?? {}) as Record<string, any[]>;
  const config = options.configPath ?? DEFAULT_CONFIG_FILE;
  const command = `npx --no-install shipproof hook --config ${shellQuote(config)}`;
  hooks.SessionStart = mergeHook(hooks.SessionStart, command);
  hooks.Stop = mergeHook(hooks.Stop, command);
  const output = {
    description: existing.description ?? "Repository lifecycle hooks",
    ...existing,
    hooks,
  };
  await writeFile(hooksPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return hooksPath;
}

function mergeHook(existing: any[] | undefined, command: string): any[] {
  const values = existing ?? [];
  const alreadyInstalled = values.some((group) =>
    Array.isArray(group?.hooks)
      ? group.hooks.some((hook: any) => hook?.command === command)
      : false,
  );
  if (alreadyInstalled) return values;
  return [
    ...values,
    {
      hooks: [
        {
          type: "command",
          command,
          timeout: 600,
          statusMessage: "Running ShipProof verification",
        },
      ],
    },
  ];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT",
  );
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export { statusExitCode };
