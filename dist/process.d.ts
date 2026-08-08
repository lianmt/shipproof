import type { ProcessEvidence } from "./types.js";
export interface GitResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    stdoutBuffer: Buffer;
}
export declare function runGit(args: string[], cwd: string, binary?: boolean): Promise<GitResult>;
export declare function runShell(command: string, cwd: string, timeoutMs: number): Promise<ProcessEvidence>;
export interface BackgroundProcess {
    pid: number | undefined;
    command: string;
    cwd: string;
    getLogs(): {
        stdout: string;
        stderr: string;
    };
    stop(): Promise<void>;
    exited(): boolean;
}
export declare function startBackground(command: string, cwd: string): BackgroundProcess;
