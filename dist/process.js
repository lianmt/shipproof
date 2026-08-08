import { spawn } from "node:child_process";
import { redactText } from "./redact.js";
const MAX_CAPTURE_BYTES = 256 * 1024;
export async function runGit(args, cwd, binary = false) {
    return await new Promise((resolve) => {
        const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
        const stdout = [];
        const stderr = [];
        child.stdout.on("data", (chunk) => stdout.push(chunk));
        child.stderr.on("data", (chunk) => stderr.push(chunk));
        child.on("error", (error) => {
            resolve({
                exitCode: 127,
                stdout: "",
                stderr: error.message,
                stdoutBuffer: Buffer.alloc(0),
            });
        });
        child.on("close", (code) => {
            const stdoutBuffer = Buffer.concat(stdout);
            const stderrBuffer = Buffer.concat(stderr);
            resolve({
                exitCode: code ?? 1,
                stdout: binary ? stdoutBuffer.toString("latin1") : stdoutBuffer.toString("utf8"),
                stderr: stderrBuffer.toString("utf8"),
                stdoutBuffer,
            });
        });
    });
}
export async function runShell(command, cwd, timeoutMs) {
    return await new Promise((resolve) => {
        const child = spawn(command, {
            cwd,
            shell: true,
            detached: process.platform !== "win32",
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        let settled = false;
        child.stdout.on("data", (chunk) => {
            if (stdout.length < MAX_CAPTURE_BYTES)
                stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk) => {
            if (stderr.length < MAX_CAPTURE_BYTES)
                stderr += chunk.toString("utf8");
        });
        const timer = setTimeout(() => {
            timedOut = true;
            terminateProcess(child.pid);
        }, timeoutMs);
        const finish = (exitCode, signal) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve({
                command,
                cwd,
                exitCode,
                signal,
                timedOut,
                stdout: redactText(stdout.slice(0, MAX_CAPTURE_BYTES)),
                stderr: redactText(stderr.slice(0, MAX_CAPTURE_BYTES)),
            });
        };
        child.on("error", (error) => {
            stderr += error.message;
            finish(127, null);
        });
        child.on("close", finish);
    });
}
export function startBackground(command, cwd) {
    const child = spawn(command, {
        cwd,
        shell: true,
        detached: process.platform !== "win32",
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let hasExited = false;
    child.stdout.on("data", (chunk) => {
        if (stdout.length < MAX_CAPTURE_BYTES)
            stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
        if (stderr.length < MAX_CAPTURE_BYTES)
            stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
        stderr += error.message;
        hasExited = true;
    });
    child.on("close", () => {
        hasExited = true;
    });
    return {
        pid: child.pid,
        command,
        cwd,
        getLogs: () => ({
            stdout: redactText(stdout.slice(0, MAX_CAPTURE_BYTES)),
            stderr: redactText(stderr.slice(0, MAX_CAPTURE_BYTES)),
        }),
        exited: () => hasExited,
        stop: async () => {
            terminateProcess(child.pid);
            await new Promise((resolve) => setTimeout(resolve, 100));
        },
    };
}
function terminateProcess(pid) {
    if (!pid)
        return;
    try {
        if (process.platform === "win32")
            process.kill(pid, "SIGTERM");
        else
            process.kill(-pid, "SIGTERM");
    }
    catch {
        // Process already exited.
    }
}
//# sourceMappingURL=process.js.map