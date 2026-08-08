import type { CheckDefinition, CheckResult, CheckStatus } from "../types.js";
export declare function createResult(check: CheckDefinition, startedAtMs: number, status: CheckStatus, summary: string, evidence?: object): CheckResult;
export declare function resolveCheckCwd(root: string, relative?: string): string;
export declare function isHttpReachable(url: string): Promise<boolean>;
export declare function waitForHttp(url: string, timeoutMs: number, exited?: () => boolean): Promise<boolean>;
