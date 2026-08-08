import type { CheckResult, HttpCheck } from "../types.js";
export declare function runHttpCheck(check: HttpCheck, root: string): Promise<CheckResult>;
