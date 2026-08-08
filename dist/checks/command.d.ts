import type { CheckResult, CommandCheck } from "../types.js";
export declare function runCommandCheck(check: CommandCheck, root: string): Promise<CheckResult>;
