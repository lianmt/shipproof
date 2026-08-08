import { readFile } from "node:fs/promises";
import path from "node:path";
import { createLock } from "./integrity.js";
import { verify } from "./verifier.js";
import type { VerificationRun } from "./types.js";

export interface CodexTaskResult {
  finalResponse: string;
  verification: VerificationRun;
}

export async function runCodexTask(options: {
  cwd: string;
  prompt?: string;
  promptFile?: string;
  configPath?: string;
  taskPath?: string;
}): Promise<CodexTaskResult> {
  const prompt = options.prompt ?? (options.promptFile ? await readFile(path.resolve(options.cwd, options.promptFile), "utf8") : "");
  if (!prompt.trim()) throw new Error("Codex prompt is empty");
  const taskPath = options.taskPath ?? options.promptFile;
  await createLock({
    cwd: options.cwd,
    ...(options.configPath ? { configPath: options.configPath } : {}),
    ...(taskPath ? { taskPath } : {}),
  });

  const moduleName = "@openai/codex-sdk";
  let sdk: any;
  try {
    sdk = await import(moduleName);
  } catch (error) {
    throw new Error(`@openai/codex-sdk is not installed: ${toMessage(error)}`);
  }
  const previousCwd = process.cwd();
  let finalResponse = "";
  try {
    process.chdir(options.cwd);
    const codex = new sdk.Codex();
    const thread = codex.startThread();
    const result = await thread.run(prompt);
    finalResponse = result.finalResponse ?? "";
  } finally {
    process.chdir(previousCwd);
  }
  const verification = await verify({
    cwd: options.cwd,
    ...(options.configPath ? { configPath: options.configPath } : {}),
    ...(taskPath ? { taskPath } : {}),
    requireLock: true,
  });
  return { finalResponse, verification };
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
