export function determineStatus(checks, integrityValid) {
    const required = checks.filter((check) => check.required);
    const failed = required.filter((check) => check.status === "FAILED");
    if (failed.length > 0) {
        return {
            status: "FAILED",
            reasons: failed.map((check) => `required check failed: ${check.id}`),
        };
    }
    const blocked = required.filter((check) => check.status === "BLOCKED");
    if (blocked.length > 0) {
        return {
            status: "BLOCKED",
            reasons: blocked.map((check) => `required check blocked: ${check.id}`),
        };
    }
    if (!integrityValid) {
        return {
            status: "UNVERIFIED",
            reasons: ["acceptance integrity could not be established"],
        };
    }
    const incomplete = required.filter((check) => check.status !== "PASSED");
    if (incomplete.length > 0) {
        return {
            status: "UNVERIFIED",
            reasons: incomplete.map((check) => `required check not passed: ${check.id}`),
        };
    }
    return { status: "VERIFIED", reasons: [] };
}
export function statusExitCode(status) {
    switch (status) {
        case "VERIFIED":
            return 0;
        case "FAILED":
            return 1;
        case "BLOCKED":
            return 2;
        case "UNVERIFIED":
            return 3;
    }
}
//# sourceMappingURL=status.js.map