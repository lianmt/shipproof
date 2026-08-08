import type { CheckDefinition, CheckResult } from "../types.js";
export declare function runCheck(check: CheckDefinition, cwd: string, evidenceDir: string): Promise<CheckResult>;
