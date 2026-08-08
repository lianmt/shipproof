import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "./config.js";
import { hashFile, hashFiles, hashFilesAtGitRef, sha256, workspaceFingerprint, } from "./hash.js";
export const STATE_DIR = ".shipproof";
export const LOCK_FILE = ".shipproof/lock.json";
export async function createLock(options) {
    const loaded = await loadConfig(options.cwd, options.configPath);
    const patterns = withConfig(loaded.config, loaded.relativePath);
    const protectedResult = options.ref
        ? await hashFilesAtGitRef(options.cwd, patterns, options.ref)
        : await hashFiles(options.cwd, patterns);
    const taskAbsolute = options.taskPath ? path.resolve(options.cwd, options.taskPath) : null;
    const lock = {
        version: 1,
        createdAt: new Date().toISOString(),
        cwd: options.cwd,
        configPath: loaded.relativePath,
        source: options.ref ? "git-ref" : "working-tree",
        ...(options.ref ? { sourceRef: options.ref } : {}),
        configHash: sha256(loaded.raw),
        protectedHash: protectedResult.hash,
        protectedFiles: protectedResult.files,
        taskPath: options.taskPath ?? null,
        taskHash: taskAbsolute ? await hashFile(taskAbsolute) : null,
    };
    await mkdir(path.join(options.cwd, STATE_DIR), { recursive: true });
    await writeFile(path.join(options.cwd, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`, "utf8");
    return lock;
}
export async function readLock(cwd) {
    try {
        const raw = await readFile(path.join(cwd, LOCK_FILE), "utf8");
        return JSON.parse(raw);
    }
    catch (error) {
        if (error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}
export async function takeSnapshot(options) {
    const loaded = await loadConfig(options.cwd, options.configPath);
    const patterns = withConfig(loaded.config, loaded.relativePath);
    const protectedResult = await hashFiles(options.cwd, patterns);
    const workspace = await workspaceFingerprint(options.cwd);
    const taskAbsolute = options.taskPath ? path.resolve(options.cwd, options.taskPath) : null;
    return {
        configHash: sha256(loaded.raw),
        protectedHash: protectedResult.hash,
        protectedFiles: protectedResult.files,
        workspaceHash: workspace.hash,
        gitCommit: workspace.commit,
        gitDirty: workspace.dirty,
        taskHash: taskAbsolute ? await hashFile(taskAbsolute) : null,
    };
}
export function validateIntegrity(lock, before, after, requireLock) {
    const reasons = [];
    if (!lock && requireLock)
        reasons.push("verification lock is missing; run shipproof lock before implementation");
    if (lock) {
        if (lock.configHash !== before.configHash)
            reasons.push("configuration changed after the lock was created");
        if (lock.protectedHash !== before.protectedHash)
            reasons.push("protected acceptance files changed after the lock was created");
        if (lock.taskHash !== before.taskHash)
            reasons.push("task specification changed after the lock was created");
    }
    if (before.configHash !== after.configHash)
        reasons.push("configuration changed during verification");
    if (before.protectedHash !== after.protectedHash)
        reasons.push("protected files changed during verification");
    if (before.taskHash !== after.taskHash)
        reasons.push("task specification changed during verification");
    return { valid: reasons.length === 0, reasons };
}
function withConfig(config, configPath) {
    return [...new Set([...config.protected, configPath])];
}
//# sourceMappingURL=integrity.js.map