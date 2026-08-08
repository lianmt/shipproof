import type { VerificationStatus } from "./types.js";
export interface BenchmarkResult {
    generatedAt: string;
    total: number;
    passed: number;
    falseVerified: number;
    cases: Array<{
        id: string;
        expected: VerificationStatus;
        actual: VerificationStatus;
        passed: boolean;
        reasons: string[];
    }>;
}
export declare function runBenchmark(outputDir: string): Promise<BenchmarkResult>;
