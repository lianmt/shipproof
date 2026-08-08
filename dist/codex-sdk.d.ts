import type { VerificationRun } from "./types.js";
export interface CodexTaskResult {
    finalResponse: string;
    verification: VerificationRun;
}
export declare function runCodexTask(options: {
    cwd: string;
    prompt?: string;
    promptFile?: string;
    configPath?: string;
    taskPath?: string;
}): Promise<CodexTaskResult>;
