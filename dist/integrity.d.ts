import type { IntegritySnapshot, VerificationLock } from "./types.js";
export declare const STATE_DIR = ".shipproof";
export declare const LOCK_FILE = ".shipproof/lock.json";
export declare function createLock(options: {
    cwd: string;
    configPath?: string;
    taskPath?: string;
    ref?: string;
}): Promise<VerificationLock>;
export declare function readLock(cwd: string): Promise<VerificationLock | null>;
export declare function takeSnapshot(options: {
    cwd: string;
    configPath?: string;
    taskPath?: string;
}): Promise<IntegritySnapshot>;
export declare function validateIntegrity(lock: VerificationLock | null, before: IntegritySnapshot, after: IntegritySnapshot, requireLock: boolean): {
    valid: boolean;
    reasons: string[];
};
