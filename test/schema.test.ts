import { describe, expect, it } from "vitest";
import { configSchema } from "../src/schema.js";

describe("acceptance contract schema", () => {
  it("fills safe defaults", () => {
    const config = configSchema.parse({
      version: 1,
      checks: [{ id: "tests", type: "command", run: "npm test" }],
    });
    expect(config.checks[0]).toMatchObject({ required: true, timeoutMs: 120_000 });
    expect(config.evidenceDir).toBe(".shipproof/runs");
  });

  it("rejects duplicate identifiers", () => {
    expect(() =>
      configSchema.parse({
        version: 1,
        checks: [
          { id: "same", type: "file", path: "a" },
          { id: "same", type: "file", path: "b" },
        ],
      }),
    ).toThrow(/duplicate check id/);
  });

  it("requires exactly one Playwright mode", () => {
    expect(() =>
      configSchema.parse({
        version: 1,
        checks: [{ id: "ui", type: "playwright", url: "http://127.0.0.1:3000", script: "ui.spec.ts" }],
      }),
    ).toThrow(/exactly one/);
  });
});
