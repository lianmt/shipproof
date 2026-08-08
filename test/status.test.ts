import { describe, expect, it } from "vitest";
import { determineStatus, statusExitCode } from "../src/status.js";
import type { CheckResult } from "../src/types.js";

describe("verification status", () => {
  it("uses the required severity precedence", () => {
    expect(determineStatus([result("FAILED")], true).status).toBe("FAILED");
    expect(determineStatus([result("BLOCKED")], true).status).toBe("BLOCKED");
    expect(determineStatus([result("PASSED")], false).status).toBe("UNVERIFIED");
    expect(determineStatus([result("PASSED")], true).status).toBe("VERIFIED");
  });

  it("maps verdicts to stable CLI exit codes", () => {
    expect(statusExitCode("VERIFIED")).toBe(0);
    expect(statusExitCode("FAILED")).toBe(1);
    expect(statusExitCode("BLOCKED")).toBe(2);
    expect(statusExitCode("UNVERIFIED")).toBe(3);
  });
});

function result(status: CheckResult["status"]): CheckResult {
  return {
    id: "acceptance",
    name: "acceptance",
    type: "command",
    required: true,
    status,
    startedAt: new Date(0).toISOString(),
    endedAt: new Date(0).toISOString(),
    durationMs: 0,
    summary: status,
    evidence: {},
  };
}
