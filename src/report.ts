import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import { takeSnapshot } from "./integrity.js";
import type { VerificationRun } from "./types.js";

export async function writeRunArtifacts(
  run: VerificationRun,
  evidenceRoot: string,
): Promise<{ jsonPath: string; markdownPath: string }> {
  const runDir = path.join(evidenceRoot, run.runId);
  await mkdir(runDir, { recursive: true });
  const jsonPath = path.join(runDir, "run.json");
  const markdownPath = path.join(runDir, "report.md");
  await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdown(run), "utf8");
  await writeFile(path.join(evidenceRoot, "latest.json"), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  await writeFile(path.join(evidenceRoot, "latest.md"), renderMarkdown(run), "utf8");
  return { jsonPath, markdownPath };
}

export function renderMarkdown(run: VerificationRun): string {
  const icon = statusIcon(run.status);
  const lines = [
    `# ShipProof verification report`,
    "",
    `**${icon} ${run.status}**`,
    "",
    `- Run: \`${run.runId}\``,
    `- Started: ${run.startedAt}`,
    `- Finished: ${run.endedAt}`,
    `- Duration: ${run.durationMs} ms`,
    `- Git commit: ${run.integrityAfter.gitCommit ? `\`${run.integrityAfter.gitCommit}\`` : "not available"}`,
    `- Working tree dirty: ${String(run.integrityAfter.gitDirty)}`,
    `- Integrity: ${run.integrityValid ? "valid" : "invalid"}`,
    `- Evidence freshness: ${run.stale ? "stale" : "fresh"}`,
    "",
  ];
  if (run.reasons.length > 0) {
    lines.push("## Reasons", "");
    for (const reason of run.reasons) lines.push(`- ${reason}`);
    lines.push("");
  }
  lines.push(
    "## Checks",
    "",
    "| Check | Type | Required | Result | Duration | Summary |",
    "|---|---|---:|---|---:|---|",
  );
  for (const check of run.checks) {
    lines.push(
      `| ${escapeCell(check.name)} | ${check.type} | ${check.required ? "yes" : "no"} | ${check.status} | ${check.durationMs} ms | ${escapeCell(check.summary)} |`,
    );
  }
  lines.push(
    "",
    "## Integrity",
    "",
    `- Configuration SHA-256: \`${run.integrityAfter.configHash}\``,
    `- Protected set SHA-256: \`${run.integrityAfter.protectedHash}\``,
    `- Workspace SHA-256: \`${run.integrityAfter.workspaceHash}\``,
    `- Task SHA-256: ${run.integrityAfter.taskHash ? `\`${run.integrityAfter.taskHash}\`` : "not supplied"}`,
    "",
    "> A VERIFIED result is valid only for the recorded workspace and acceptance hashes.",
    "",
  );
  return lines.join("\n");
}

export async function readLatestRun(options: {
  cwd: string;
  configPath?: string;
  runPath?: string;
}): Promise<VerificationRun> {
  if (options.runPath) {
    return JSON.parse(await readFile(path.resolve(options.cwd, options.runPath), "utf8")) as VerificationRun;
  }
  const loaded = await loadConfig(options.cwd, options.configPath);
  const latest = path.resolve(options.cwd, loaded.config.evidenceDir, "latest.json");
  return JSON.parse(await readFile(latest, "utf8")) as VerificationRun;
}

export async function refreshRunFreshness(
  run: VerificationRun,
): Promise<VerificationRun> {
  const snapshot = await takeSnapshot({
    cwd: run.cwd,
    configPath: run.configPath,
    ...(run.taskPath ? { taskPath: run.taskPath } : {}),
  });
  const stale = snapshot.workspaceHash !== run.integrityAfter.workspaceHash;
  if (!stale) return run;
  return {
    ...run,
    status: "UNVERIFIED",
    stale: true,
    reasons: [...run.reasons, "workspace changed after evidence was recorded"],
  };
}

export async function listRunIds(evidenceRoot: string): Promise<string[]> {
  try {
    const entries = await readdir(evidenceRoot, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function statusIcon(status: VerificationRun["status"]): string {
  return {
    VERIFIED: "✅",
    FAILED: "❌",
    BLOCKED: "⛔",
    UNVERIFIED: "⚠️",
  }[status];
}
