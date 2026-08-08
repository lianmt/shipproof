import type { CheckResult, PlaywrightCheck } from "../types.js";
export declare function runPlaywrightCheck(check: PlaywrightCheck, root: string, evidenceDir: string): Promise<CheckResult>;
