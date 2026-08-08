import { runShell } from "../process.js";
import type { CheckResult, CommandCheck } from "../types.js";
import { createResult, resolveCheckCwd } from "./shared.js";

export async function runCommandCheck(
  check: CommandCheck,
  root: string,
): Promise<CheckResult> {
  const startedAt = Date.now();
  const cwd = resolveCheckCwd(root, check.cwd);
  const evidence = await runShell(check.run, cwd, check.timeoutMs);
  if (evidence.timedOut) {
    return createResult(check, startedAt, "BLOCKED", "command timed out", evidence);
  }
  const combined = `${evidence.stdout}\n${evidence.stderr}`;
  const errors: string[] = [];
  if (evidence.exitCode !== check.expectExit) {
    errors.push(`exit code ${evidence.exitCode}; expected ${check.expectExit}`);
  }
  if (check.contains !== undefined && !combined.includes(check.contains)) {
    errors.push(`output did not contain ${JSON.stringify(check.contains)}`);
  }
  if (check.notContains !== undefined && combined.includes(check.notContains)) {
    errors.push(`output contained forbidden text ${JSON.stringify(check.notContains)}`);
  }
  return createResult(
    check,
    startedAt,
    errors.length === 0 ? "PASSED" : "FAILED",
    errors.length === 0 ? "command passed" : errors.join("; "),
    evidence,
  );
}
