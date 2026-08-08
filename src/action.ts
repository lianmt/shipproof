import * as core from "@actions/core";
import path from "node:path";
import { createLock } from "./integrity.js";
import { renderMarkdown } from "./report.js";
import { verify } from "./verifier.js";

async function run(): Promise<void> {
  try {
    const cwd = path.resolve(core.getInput("cwd") || process.env.GITHUB_WORKSPACE || process.cwd());
    const configPath = core.getInput("config") || "shipproof.yml";
    const taskPath = core.getInput("task") || undefined;
    const baselineRef = core.getInput("baseline-ref") || undefined;
    await createLock({
      cwd,
      configPath,
      ...(taskPath ? { taskPath } : {}),
      ...(baselineRef ? { ref: baselineRef } : {}),
    });
    const result = await verify({
      cwd,
      configPath,
      ...(taskPath ? { taskPath } : {}),
      requireLock: true,
    });
    core.setOutput("status", result.status);
    core.setOutput("report", result.reportPath ?? "");
    await core.summary.addRaw(renderMarkdown(result)).write();
    if (result.status !== "VERIFIED") {
      core.setFailed(`ShipProof ${result.status}: ${result.reasons.join("; ")}`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

await run();
