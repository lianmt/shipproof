import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import YAML from "yaml";
import { createLock } from "./integrity.js";
import { refreshRunFreshness } from "./report.js";
import type { VerificationRun, VerificationStatus } from "./types.js";
import { verify } from "./verifier.js";

interface BenchmarkCase {
  id: string;
  expected: VerificationStatus;
  check: Record<string, unknown>;
  noLock?: boolean;
  mutate?: (cwd: string) => Promise<void>;
  beforeVerify?: () => Promise<() => Promise<void>>;
  staleAfter?: boolean;
}

export interface BenchmarkResult {
  generatedAt: string;
  total: number;
  passed: number;
  falseVerified: number;
  cases: Array<{
    id: string;
    expected: VerificationStatus;
    actual: VerificationStatus;
    passed: boolean;
    reasons: string[];
  }>;
}

export async function runBenchmark(outputDir: string): Promise<BenchmarkResult> {
  const cases = await makeCases();
  const results: BenchmarkResult["cases"] = [];
  for (const benchmarkCase of cases) {
    const cwd = await mkdtemp(path.join(tmpdir(), `shipproof-${benchmarkCase.id}-`));
    let cleanupExternal: (() => Promise<void>) | undefined;
    try {
      await writeFile(path.join(cwd, "task.md"), "Implement the controlled benchmark task.\n");
      await writeFile(path.join(cwd, "source.txt"), "initial\n");
      await writeFile(
        path.join(cwd, "shipproof.yml"),
        YAML.stringify({
          version: 1,
          evidenceDir: ".shipproof/runs",
          protected: ["shipproof.yml", "protected/**"],
          checks: [benchmarkCase.check],
        }),
      );
      await mkdir(path.join(cwd, "protected"), { recursive: true });
      await writeFile(path.join(cwd, "protected", "acceptance.txt"), "do-not-weaken\n");
      if (!benchmarkCase.noLock) {
        await createLock({ cwd, taskPath: "task.md" });
      }
      if (benchmarkCase.mutate) await benchmarkCase.mutate(cwd);
      if (benchmarkCase.beforeVerify) cleanupExternal = await benchmarkCase.beforeVerify();
      let run: VerificationRun = await verify({ cwd, taskPath: "task.md", requireLock: true });
      if (benchmarkCase.staleAfter) {
        await writeFile(path.join(cwd, "source.txt"), "changed after verification\n");
        run = await refreshRunFreshness(run);
      }
      results.push({
        id: benchmarkCase.id,
        expected: benchmarkCase.expected,
        actual: run.status,
        passed: run.status === benchmarkCase.expected,
        reasons: run.reasons,
      });
    } finally {
      await cleanupExternal?.();
      await rm(cwd, { recursive: true, force: true });
    }
  }
  const result: BenchmarkResult = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    falseVerified: results.filter(
      (item) => item.actual === "VERIFIED" && item.expected !== "VERIFIED",
    ).length,
    cases: results,
  };
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "latest.json"), `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(path.join(outputDir, "latest.md"), renderBenchmark(result));
  return result;
}

function renderBenchmark(result: BenchmarkResult): string {
  return [
    "# ShipProof controlled benchmark",
    "",
    `- Generated: ${result.generatedAt}`,
    `- Correct verdicts: ${result.passed}/${result.total}`,
    `- False VERIFIED verdicts: ${result.falseVerified}`,
    "",
    "| Case | Expected | Actual | Result |",
    "|---|---|---|---|",
    ...result.cases.map(
      (item) => `| ${item.id} | ${item.expected} | ${item.actual} | ${item.passed ? "PASS" : "FAIL"} |`,
    ),
    "",
  ].join("\n");
}

async function makeCases(): Promise<BenchmarkCase[]> {
  const httpPassPort = await freePort();
  const httpStatusPort = await freePort();
  const httpBodyPort = await freePort();
  const stalePort = await freePort();
  return [
    commandCase("clean-command", "VERIFIED", "node -e \"console.log('ok')\""),
    commandCase("nonzero-exit", "FAILED", "node -e \"process.exit(7)\""),
    {
      ...commandCase("command-timeout", "BLOCKED", "node -e \"setTimeout(()=>{}, 5000)\""),
      check: commandCheck("node -e \"setTimeout(()=>{}, 5000)\"", { timeoutMs: 200 }),
    },
    {
      id: "missing-required-output",
      expected: "FAILED",
      check: commandCheck("node -e \"console.log('actual')\"", { contains: "expected" }),
    },
    {
      id: "forbidden-output",
      expected: "FAILED",
      check: commandCheck("node -e \"console.log('SECRET')\"", { notContains: "SECRET" }),
    },
    {
      id: "optional-failure",
      expected: "VERIFIED",
      check: commandCheck("node -e \"process.exit(1)\"", { required: false }),
    },
    fileCase("existing-file", "VERIFIED", { path: "source.txt", exists: true }),
    fileCase("missing-file", "FAILED", { path: "missing.txt", exists: true }),
    fileCase("forbidden-file-text", "FAILED", {
      path: "source.txt",
      exists: true,
      notContains: "initial",
    }),
    fileCase("minimum-size", "FAILED", { path: "source.txt", exists: true, minBytes: 1_000 }),
    { ...commandCase("missing-lock", "UNVERIFIED", "node -e \"process.exit(0)\""), noLock: true },
    {
      ...commandCase("protected-test-changed", "UNVERIFIED", "node -e \"process.exit(0)\""),
      mutate: async (cwd) => {
        await writeFile(path.join(cwd, "protected", "acceptance.txt"), "weakened\n");
      },
    },
    {
      ...commandCase("config-changed", "UNVERIFIED", "node -e \"process.exit(0)\""),
      mutate: async (cwd) => {
        const raw = await import("node:fs/promises").then((fs) => fs.readFile(path.join(cwd, "shipproof.yml"), "utf8"));
        await writeFile(path.join(cwd, "shipproof.yml"), `${raw}\n# changed after lock\n`);
      },
    },
    {
      ...commandCase("task-changed", "UNVERIFIED", "node -e \"process.exit(0)\""),
      mutate: async (cwd) => {
        await writeFile(path.join(cwd, "task.md"), "weakened task\n");
      },
    },
    httpCase("http-pass", "VERIFIED", httpPassPort, 200, "ready", 200, "ready"),
    httpCase("http-status-fail", "FAILED", httpStatusPort, 503, "down", 200, "down"),
    httpCase("http-body-fail", "FAILED", httpBodyPort, 200, "actual", 200, "expected"),
    {
      id: "http-start-crash",
      expected: "BLOCKED",
      check: {
        id: "check",
        type: "http",
        url: "http://127.0.0.1:1/",
        start: "node -e \"process.exit(1)\"",
        readyTimeoutMs: 500,
        timeoutMs: 500,
        required: true,
      },
    },
    {
      id: "stale-service-refused",
      expected: "BLOCKED",
      check: {
        id: "check",
        type: "http",
        url: `http://127.0.0.1:${stalePort}/`,
        start: "node -e \"setTimeout(()=>{}, 5000)\"",
        allowExisting: false,
        readyTimeoutMs: 500,
        required: true,
      },
      beforeVerify: async () => await startServer(stalePort, 200, "old"),
    },
    {
      ...commandCase("stale-evidence", "UNVERIFIED", "node -e \"process.exit(0)\""),
      staleAfter: true,
    },
  ];
}

function commandCheck(run: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "check", type: "command", run, required: true, ...extra };
}

function commandCase(id: string, expected: VerificationStatus, run: string): BenchmarkCase {
  return { id, expected, check: commandCheck(run) };
}

function fileCase(
  id: string,
  expected: VerificationStatus,
  extra: Record<string, unknown>,
): BenchmarkCase {
  return { id, expected, check: { id: "check", type: "file", required: true, ...extra } };
}

function httpCase(
  id: string,
  expected: VerificationStatus,
  port: number,
  actualStatus: number,
  actualBody: string,
  expectStatus: number,
  contains: string,
): BenchmarkCase {
  const script = `require('http').createServer((q,r)=>{r.statusCode=${actualStatus};r.end(${JSON.stringify(actualBody)})}).listen(${port},'127.0.0.1')`;
  return {
    id,
    expected,
    check: {
      id: "check",
      type: "http",
      url: `http://127.0.0.1:${port}/`,
      start: `node -e ${JSON.stringify(script)}`,
      readyTimeoutMs: 2_000,
      timeoutMs: 2_000,
      expectStatus,
      contains,
      required: true,
    },
  };
}

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function startServer(
  port: number,
  status: number,
  body: string,
): Promise<() => Promise<void>> {
  const server: Server = createServer((_request, response) => {
    response.statusCode = status;
    response.end(body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  return async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  };
}
