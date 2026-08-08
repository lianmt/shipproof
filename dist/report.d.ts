import type { VerificationRun } from "./types.js";
export declare function writeRunArtifacts(run: VerificationRun, evidenceRoot: string): Promise<{
    jsonPath: string;
    markdownPath: string;
}>;
export declare function renderMarkdown(run: VerificationRun): string;
export declare function readLatestRun(options: {
    cwd: string;
    configPath?: string;
    runPath?: string;
}): Promise<VerificationRun>;
export declare function refreshRunFreshness(run: VerificationRun): Promise<VerificationRun>;
export declare function listRunIds(evidenceRoot: string): Promise<string[]>;
