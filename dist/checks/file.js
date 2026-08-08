import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { hashFile } from "../hash.js";
import { createResult } from "./shared.js";
export async function runFileCheck(check, root) {
    const startedAt = Date.now();
    const absolutePath = path.resolve(root, check.path);
    try {
        const fileStat = await stat(absolutePath);
        if (!check.exists) {
            return createResult(check, startedAt, "FAILED", "file exists but must not", {
                path: check.path,
            });
        }
        if (!fileStat.isFile()) {
            return createResult(check, startedAt, "FAILED", "path is not a file", {
                path: check.path,
            });
        }
        const contents = await readFile(absolutePath, "utf8");
        const errors = [];
        if (check.minBytes !== undefined && fileStat.size < check.minBytes) {
            errors.push(`file has ${fileStat.size} bytes; expected at least ${check.minBytes}`);
        }
        if (check.contains !== undefined && !contents.includes(check.contains)) {
            errors.push(`file did not contain ${JSON.stringify(check.contains)}`);
        }
        if (check.notContains !== undefined && contents.includes(check.notContains)) {
            errors.push(`file contained forbidden text ${JSON.stringify(check.notContains)}`);
        }
        return createResult(check, startedAt, errors.length === 0 ? "PASSED" : "FAILED", errors.length === 0 ? "file check passed" : errors.join("; "), { path: check.path, size: fileStat.size, sha256: await hashFile(absolutePath) });
    }
    catch (error) {
        if (!check.exists && isNotFound(error)) {
            return createResult(check, startedAt, "PASSED", "file is absent as required", {
                path: check.path,
            });
        }
        return createResult(check, startedAt, isNotFound(error) ? "FAILED" : "BLOCKED", isNotFound(error) ? "required file is missing" : `cannot inspect file: ${toMessage(error)}`, { path: check.path });
    }
}
function isNotFound(error) {
    return Boolean(error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT");
}
function toMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=file.js.map