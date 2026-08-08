import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBenchmark } from "../src/benchmark.js";

describe("controlled benchmark", () => {
  it("classifies all 20 cases without a false VERIFIED verdict", async () => {
    const output = await mkdtemp(path.join(tmpdir(), "shipproof-benchmark-test-"));
    try {
      const result = await runBenchmark(output);
      expect(result.total).toBe(20);
      expect(result.passed).toBe(20);
      expect(result.falseVerified).toBe(0);
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  }, 30_000);
});
