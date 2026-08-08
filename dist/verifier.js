import { randomUUID } from "node:crypto";
import path from "node:path";
import { runCheck } from "./checks/index.js";
import { loadConfig } from "./config.js";
import { readLock, takeSnapshot, validateIntegrity } from "./integrity.js";
import { writeRunArtifacts } from "./report.js";
import { determineStatus } from "./status.js";
export async function verify(options) {
    const startedAtMs = Date.now();
    const loaded = await loadConfig(options.cwd, options.configPath);
    const taskPath = options.taskPath ?? null;
    const snapshotOptions = {
        cwd: options.cwd,
        configPath: loaded.relativePath,
        ...(taskPath ? { taskPath } : {}),
    };
    const lock = await readLock(options.cwd);
    const integrityBefore = await takeSnapshot(snapshotOptions);
    const runId = `${timestampId()}-${randomUUID().slice(0, 8)}`;
    const evidenceRoot = path.resolve(options.cwd, loaded.config.evidenceDir);
    const evidenceDir = path.join(evidenceRoot, runId);
    const checks = [];
    for (const check of loaded.config.checks) {
        checks.push(await runCheck(check, options.cwd, evidenceDir));
    }
    const integrityAfter = await takeSnapshot(snapshotOptions);
    const integrity = validateIntegrity(lock, integrityBefore, integrityAfter, options.requireLock ?? true);
    const determination = determineStatus(checks, integrity.valid);
    const endedAtMs = Date.now();
    const run = {
        version: 1,
        runId,
        status: determination.status,
        cwd: options.cwd,
        configPath: loaded.relativePath,
        taskPath,
        startedAt: new Date(startedAtMs).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
        durationMs: endedAtMs - startedAtMs,
        lock,
        integrityBefore,
        integrityAfter,
        integrityValid: integrity.valid,
        stale: false,
        reasons: [...integrity.reasons, ...determination.reasons],
        checks,
        reportPath: path.relative(options.cwd, path.join(evidenceDir, "report.md")),
    };
    await writeRunArtifacts(run, evidenceRoot);
    return run;
}
function timestampId() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}
//# sourceMappingURL=verifier.js.map