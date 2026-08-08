import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { handleCodexHook } from "../src/codex-hook.js";
import { createLock } from "../src/integrity.js";
import { readLatestRun, refreshRunFreshness } from "../src/report.js";
import { verify } from "../src/verifier.js";

const temporary: string[] = [];

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((entry) => rm(entry, { recursive: true, force: true })));
});

describe("verification lifecycle", () => {
  it("records a VERIFIED run with durable evidence", async () => {
    const cwd = await fixture();
    await createLock({ cwd, taskPath: "task.md" });
    const run = await verify({ cwd, taskPath: "task.md" });
    expect(run.status).toBe("VERIFIED");
    expect(run.reportPath).toBeTruthy();
    const recorded = await readLatestRun({ cwd });
    expect(recorded.reportPath).toBe(run.reportPath);
    expect(await readFile(path.join(cwd, run.reportPath!), "utf8")).toContain("VERIFIED");
  });

  it("does not certify weakened acceptance files", async () => {
    const cwd = await fixture();
    await createLock({ cwd, taskPath: "task.md" });
    await writeFile(path.join(cwd, "tests", "acceptance.txt"), "weakened\n");
    const run = await verify({ cwd, taskPath: "task.md" });
    expect(run.status).toBe("UNVERIFIED");
    expect(run.reasons.join(" ")).toContain("protected acceptance files changed");
  });

  it("invalidates old evidence after source changes", async () => {
    const cwd = await fixture();
    await createLock({ cwd, taskPath: "task.md" });
    const run = await verify({ cwd, taskPath: "task.md" });
    await writeFile(path.join(cwd, "source.txt"), "changed\n");
    const refreshed = await refreshRunFreshness(run);
    expect(refreshed.status).toBe("UNVERIFIED");
    expect(refreshed.stale).toBe(true);
  });

  it("blocks Codex completion once and avoids an infinite Stop loop", async () => {
    const cwd = await fixture("node -e \"process.exit(9)\"");
    await handleCodexHook({ cwd, hook_event_name: "SessionStart" });
    const first = await handleCodexHook({ cwd, hook_event_name: "Stop" });
    expect(first.decision).toBe("block");
    const second = await handleCodexHook({ cwd, hook_event_name: "Stop", stop_hook_active: true });
    expect(second.continue).toBe(false);
  });

  it("can anchor a nested project to a trusted Git ref", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "shipproof-git-test-"));
    temporary.push(root);
    const cwd = path.join(root, "packages", "app");
    await mkdir(cwd, { recursive: true });
    await mkdir(path.join(cwd, "tests"));
    await writeFile(path.join(cwd, "task.md"), "Task contract\n");
    await writeFile(path.join(cwd, "source.txt"), "initial\n");
    await writeFile(path.join(cwd, "tests", "acceptance.txt"), "fixed acceptance\n");
    await writeFile(
      path.join(cwd, "shipproof.yml"),
      YAML.stringify({
        version: 1,
        evidenceDir: ".shipproof/runs",
        protected: ["shipproof.yml", "tests/**"],
        checks: [{ id: "command", type: "command", run: "node -e \"process.exit(0)\"" }],
      }),
    );
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync(
      "git",
      ["-c", "user.name=ShipProof", "-c", "user.email=shipproof@example.invalid", "commit", "--quiet", "-m", "fixture"],
      { cwd: root },
    );
    await createLock({ cwd, taskPath: "task.md", ref: "HEAD" });
    const run = await verify({ cwd, taskPath: "task.md" });
    expect(
      run.status,
      JSON.stringify(
        {
          reasons: run.reasons,
          locked: run.lock?.protectedFiles,
          current: run.integrityBefore.protectedFiles,
          lockedHash: run.lock?.protectedHash,
          currentHash: run.integrityBefore.protectedHash,
        },
        null,
        2,
      ),
    ).toBe("VERIFIED");
    expect(run.lock?.source).toBe("git-ref");
  });
});

async function fixture(command = "node -e \"console.log('ok')\""): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "shipproof-test-"));
  temporary.push(cwd);
  await mkdir(path.join(cwd, "tests"));
  await writeFile(path.join(cwd, "task.md"), "Task contract\n");
  await writeFile(path.join(cwd, "source.txt"), "initial\n");
  await writeFile(path.join(cwd, "tests", "acceptance.txt"), "fixed acceptance\n");
  await writeFile(
    path.join(cwd, "shipproof.yml"),
    YAML.stringify({
      version: 1,
      evidenceDir: ".shipproof/runs",
      protected: ["shipproof.yml", "tests/**"],
      checks: [{ id: "command", type: "command", run: command, required: true }],
    }),
  );
  return cwd;
}
