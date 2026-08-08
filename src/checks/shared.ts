import path from "node:path";
import type { CheckDefinition, CheckResult, CheckStatus } from "../types.js";

export function createResult(
  check: CheckDefinition,
  startedAtMs: number,
  status: CheckStatus,
  summary: string,
  evidence: object = {},
): CheckResult {
  const endedAtMs = Date.now();
  return {
    id: check.id,
    name: check.name ?? check.id,
    type: check.type,
    required: check.required,
    status,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs: endedAtMs - startedAtMs,
    summary,
    evidence: { ...evidence },
  };
}

export function resolveCheckCwd(root: string, relative?: string): string {
  return relative ? path.resolve(root, relative) : root;
}

export async function isHttpReachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1_000), redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

export async function waitForHttp(
  url: string,
  timeoutMs: number,
  exited?: () => boolean,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited?.()) return false;
    if (await isHttpReachable(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}
