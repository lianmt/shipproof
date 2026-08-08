import { spawn } from "node:child_process";
import { redactText } from "./redact.js";
import type { ProcessEvidence } from "./types.js";

const MAX_CAPTURE_BYTES = 256 * 1024;

export interface GitResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  stdoutBuffer: Buffer;
}

export async function runGit(
  args: string[],
  cwd: string,
  binary = false,
): Promise<GitResult> {
  return await new Promise((resolve) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
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

export async function runShell(
  command: string,
  cwd: string,
  timeoutMs: number,
): Promise<ProcessEvidence> {
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

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_CAPTURE_BYTES) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcess(child.pid);
    }, timeoutMs);

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
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

export interface BackgroundProcess {
  pid: number | undefined;
  command: string;
  cwd: string;
  getLogs(): { stdout: string; stderr: string };
  stop(): Promise<void>;
  exited(): boolean;
}

export function startBackground(command: string, cwd: string): BackgroundProcess {
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
  child.stdout.on("data", (chunk: Buffer) => {
    if (stdout.length < MAX_CAPTURE_BYTES) stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk.toString("utf8");
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

function terminateProcess(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === "win32") process.kill(pid, "SIGTERM");
    else process.kill(-pid, "SIGTERM");
  } catch {
    // Process already exited.
  }
}
