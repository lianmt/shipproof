#!/usr/bin/env node

import { access, appendFile, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Command } from "commander";
import YAML from "yaml";
import { runBenchmark } from "./benchmark.js";
import { handleCodexHook, installCodexHooks, type CodexHookInput } from "./codex-hook.js";
import { runCodexTask } from "./codex-sdk.js";
import { DEFAULT_CONFIG_FILE } from "./config.js";
import { createLock } from "./integrity.js";
import { readLatestRun, refreshRunFreshness, renderMarkdown } from "./report.js";
import { statusExitCode } from "./status.js";
import type { CheckDefinition, ShipProofConfig } from "./types.js";
import { verify } from "./verifier.js";

const packageVersion = (createRequire(import.meta.url)("../package.json") as { version: string }).version;

const program = new Command()
  .name("shipproof")
  .description("Deterministic acceptance evidence for AI coding agents")
  .version(packageVersion);

program
  .command("init")
  .description("Create a starter acceptance contract")
  .option("-c, --config <path>", "configuration path", DEFAULT_CONFIG_FILE)
  .option("--force", "overwrite an existing configuration", false)
  .action(async (options: { config: string; force: boolean }) => {
    const cwd = process.cwd();
    const destination = path.resolve(cwd, options.config);
    if ((await exists(destination)) && !options.force) {
      throw new Error(`${options.config} already exists; use --force to replace it`);
    }
    const config = await inferConfig(cwd, options.config);
    await writeFile(destination, YAML.stringify(config), "utf8");
    await ensureGitIgnore(cwd);
    console.log(`Created ${path.relative(cwd, destination)}`);
    console.log("Next: review the checks, then run `shipproof lock --task <task-file>`.");
  });

program
  .command("lock")
  .description("Lock the acceptance contract before implementation")
  .option("-c, --config <path>", "configuration path", DEFAULT_CONFIG_FILE)
  .option("-t, --task <path>", "task specification to hash")
  .option("--ref <git-ref>", "read protected files from a Git ref")
  .action(async (options: { config: string; task?: string; ref?: string }) => {
    const lock = await createLock({
      cwd: process.cwd(),
      configPath: options.config,
      ...(options.task ? { taskPath: options.task } : {}),
      ...(options.ref ? { ref: options.ref } : {}),
    });
    console.log(`Locked ${lock.protectedFiles.length} protected files.`);
    console.log(`Contract: ${lock.protectedHash}`);
  });

program
  .command("verify")
  .description("Run all acceptance checks and write tamper-aware evidence")
  .option("-c, --config <path>", "configuration path", DEFAULT_CONFIG_FILE)
  .option("-t, --task <path>", "task specification that was locked")
  .option("--allow-unlocked", "permit a run without a pre-existing lock", false)
  .option("--json", "print the complete JSON result", false)
  .action(
    async (options: {
      config: string;
      task?: string;
      allowUnlocked: boolean;
      json: boolean;
    }) => {
      const run = await verify({
        cwd: process.cwd(),
        configPath: options.config,
        ...(options.task ? { taskPath: options.task } : {}),
        requireLock: !options.allowUnlocked,
      });
      if (options.json) console.log(JSON.stringify(run, null, 2));
      else printRunSummary(run.status, run.reportPath, run.reasons);
      process.exitCode = statusExitCode(run.status);
    },
  );

program
  .command("report")
  .description("Read evidence and invalidate it if the workspace has changed")
  .option("-c, --config <path>", "configuration path", DEFAULT_CONFIG_FILE)
  .option("--run <path>", "path to a run.json instead of latest.json")
  .option("--json", "print JSON instead of Markdown", false)
  .action(async (options: { config: string; run?: string; json: boolean }) => {
    const recorded = await readLatestRun({
      cwd: process.cwd(),
      configPath: options.config,
      ...(options.run ? { runPath: options.run } : {}),
    });
    const refreshed = await refreshRunFreshness(recorded);
    console.log(options.json ? JSON.stringify(refreshed, null, 2) : renderMarkdown(refreshed));
    process.exitCode = statusExitCode(refreshed.status);
  });

program
  .command("hook")
  .description("Handle a Codex lifecycle hook (JSON stdin/stdout)")
  .option("-c, --config <path>", "configuration path", DEFAULT_CONFIG_FILE)
  .action(async (options: { config: string }) => {
    try {
      const input = JSON.parse(await readStdin()) as CodexHookInput;
      const output = await handleCodexHook(input, options.config);
      process.stdout.write(`${JSON.stringify(output)}\n`);
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({ continue: false, stopReason: `ShipProof hook error: ${message(error)}` })}\n`,
      );
      process.exitCode = 1;
    }
  });

program
  .command("install-codex-hooks")
  .description("Install SessionStart and Stop hooks into .codex/hooks.json")
  .option("-c, --config <path>", "configuration path", DEFAULT_CONFIG_FILE)
  .action(async (options: { config: string }) => {
    const installed = await installCodexHooks({ cwd: process.cwd(), configPath: options.config });
    console.log(`Installed Codex hooks: ${path.relative(process.cwd(), installed)}`);
  });

program
  .command("codex")
  .description("Run a Codex SDK task, then independently verify the result")
  .option("-p, --prompt <text>", "task prompt")
  .option("--prompt-file <path>", "read task prompt from a file")
  .option("-c, --config <path>", "configuration path", DEFAULT_CONFIG_FILE)
  .option("-t, --task <path>", "task specification to lock")
  .action(
    async (options: {
      prompt?: string;
      promptFile?: string;
      config: string;
      task?: string;
    }) => {
      if (Boolean(options.prompt) === Boolean(options.promptFile)) {
        throw new Error("provide exactly one of --prompt or --prompt-file");
      }
      const prompt = options.prompt ?? (await readFile(path.resolve(options.promptFile!), "utf8"));
      const result = await runCodexTask({
        cwd: process.cwd(),
        prompt,
        configPath: options.config,
        ...(options.task ? { taskPath: options.task } : {}),
      });
      if (result.finalResponse) console.log(result.finalResponse);
      printRunSummary(result.verification.status, result.verification.reportPath, result.verification.reasons);
      process.exitCode = statusExitCode(result.verification.status);
    },
  );

program
  .command("benchmark")
  .description("Run the controlled 20-case false-success benchmark")
  .option("-o, --output <path>", "benchmark evidence directory", "benchmark/results")
  .action(async (options: { output: string }) => {
    const output = path.resolve(process.cwd(), options.output);
    const result = await runBenchmark(output);
    console.log(`Correct verdicts: ${result.passed}/${result.total}`);
    console.log(`False VERIFIED verdicts: ${result.falseVerified}`);
    console.log(`Report: ${path.relative(process.cwd(), path.join(output, "latest.md"))}`);
    process.exitCode = result.passed === result.total && result.falseVerified === 0 ? 0 : 1;
  });

await program.parseAsync().catch((error: unknown) => {
  console.error(`shipproof: ${message(error)}`);
  process.exitCode = 1;
});

async function inferConfig(cwd: string, configPath: string): Promise<ShipProofConfig> {
  const scripts = await readPackageScripts(cwd);
  const checks: CheckDefinition[] = [];
  for (const [id, script, timeoutMs] of [
    ["tests", "test", 120_000],
    ["typecheck", "typecheck", 120_000],
    ["lint", "lint", 120_000],
    ["build", "build", 180_000],
  ] as const) {
    if (!scripts.has(script)) continue;
    checks.push({
      id,
      type: "command",
      run: `npm run ${script}`,
      required: true,
      timeoutMs,
      expectExit: 0,
    });
  }
  if (checks.length === 0) {
    checks.push({
      id: "replace-me",
      type: "command",
      run: "node -e \"console.error('Configure a real acceptance check'); process.exit(1)\"",
      required: true,
      timeoutMs: 120_000,
      expectExit: 0,
    });
  }
  return {
    version: 1,
    evidenceDir: ".shipproof/runs",
    protected: [configPath, "test/**", "tests/**"],
    checks,
  };
}

async function readPackageScripts(cwd: string): Promise<Set<string>> {
  try {
    const pkg = JSON.parse(await readFile(path.join(cwd, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return new Set(Object.keys(pkg.scripts ?? {}));
  } catch {
    return new Set();
  }
}

async function ensureGitIgnore(cwd: string): Promise<void> {
  const file = path.join(cwd, ".gitignore");
  let current = "";
  try {
    current = await readFile(file, "utf8");
  } catch {
    // A missing .gitignore is normal for a new project.
  }
  if (current.split(/\r?\n/).includes(".shipproof/")) return;
  const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  await appendFile(file, `${prefix}.shipproof/\n`, "utf8");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function printRunSummary(status: string, reportPath: string | undefined, reasons: string[]): void {
  console.log(`ShipProof: ${status}`);
  for (const reason of reasons) console.log(`- ${reason}`);
  if (reportPath) console.log(`Evidence: ${reportPath}`);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
