import type { CheckResult, VerificationStatus } from "./types.js";
export declare function determineStatus(checks: CheckResult[], integrityValid: boolean): {
    status: VerificationStatus;
    reasons: string[];
};
export declare function statusExitCode(status: VerificationStatus): number;
