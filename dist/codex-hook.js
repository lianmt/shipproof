import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG_FILE } from "./config.js";
import { createLock, readLock } from "./integrity.js";
import { statusExitCode } from "./status.js";
import { verify } from "./verifier.js";
export async function handleCodexHook(input, configPath = DEFAULT_CONFIG_FILE) {
    const cwd = input.cwd ? path.resolve(input.cwd) : process.cwd();
    if (!(await fileExists(path.resolve(cwd, configPath))))
        return { continue: true };
    if (input.hook_event_name === "SessionStart") {
        try {
            await createLock({ cwd, configPath });
            return {
                continue: true,
                systemMessage: "ShipProof locked the acceptance contract for this session.",
            };
        }
        catch (error) {
            return {
                continue: true,
                systemMessage: `ShipProof could not create a verification lock: ${toMessage(error)}`,
            };
        }
    }
    if (input.hook_event_name !== "Stop")
        return { continue: true };
    try {
        const lock = await readLock(cwd);
        const run = await verify({
            cwd,
            configPath,
            ...(lock?.taskPath ? { taskPath: lock.taskPath } : {}),
            requireLock: true,
        });
        if (run.status === "VERIFIED") {
            return {
                continue: true,
                systemMessage: `ShipProof VERIFIED this turn. Evidence: ${run.reportPath ?? run.runId}`,
            };
        }
        const reason = [
            `ShipProof status is ${run.status}.`,
            ...run.reasons,
            `Evidence: ${run.reportPath ?? run.runId}`,
            "Fix the failing checks or report the exact BLOCKED/UNVERIFIED boundary; do not claim completion.",
        ].join(" ");
        if (input.stop_hook_active) {
            return {
                continue: false,
                stopReason: reason,
                systemMessage: reason,
            };
        }
        return { decision: "block", reason };
    }
    catch (error) {
        const reason = `ShipProof could not run: ${toMessage(error)}. Do not claim verified completion.`;
        if (input.stop_hook_active) {
            return { continue: false, stopReason: reason, systemMessage: reason };
        }
        return { decision: "block", reason };
    }
}
export async function installCodexHooks(options) {
    const codexDir = path.join(options.cwd, ".codex");
    const hooksPath = path.join(codexDir, "hooks.json");
    await mkdir(codexDir, { recursive: true });
    let existing = {};
    try {
        existing = JSON.parse(await readFile(hooksPath, "utf8"));
    }
    catch (error) {
        if (!isNotFound(error))
            throw error;
    }
    const hooks = (existing.hooks ?? {});
    const config = options.configPath ?? DEFAULT_CONFIG_FILE;
    const command = `npx --no-install shipproof hook --config ${shellQuote(config)}`;
    hooks.SessionStart = mergeHook(hooks.SessionStart, command);
    hooks.Stop = mergeHook(hooks.Stop, command);
    const output = {
        description: existing.description ?? "Repository lifecycle hooks",
        ...existing,
        hooks,
    };
    await writeFile(hooksPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    return hooksPath;
}
function mergeHook(existing, command) {
    const values = existing ?? [];
    const alreadyInstalled = values.some((group) => Array.isArray(group?.hooks)
        ? group.hooks.some((hook) => hook?.command === command)
        : false);
    if (alreadyInstalled)
        return values;
    return [
        ...values,
        {
            hooks: [
                {
                    type: "command",
                    command,
                    timeout: 600,
                    statusMessage: "Running ShipProof verification",
                },
            ],
        },
    ];
}
async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function isNotFound(error) {
    return Boolean(error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT");
}
function shellQuote(value) {
    return `'${value.replaceAll("'", `'\\''`)}'`;
}
function toMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
export { statusExitCode };
//# sourceMappingURL=codex-hook.js.map