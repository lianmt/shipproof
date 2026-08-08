import path from "node:path";
export function createResult(check, startedAtMs, status, summary, evidence = {}) {
    const endedAtMs = Date.now();
    return {
        id: check.id,
        name: check.name ?? check.id,
        type: check.type,
        required: check.required,
        status,
        startedAt: new Date(startedAtMs).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
        durationMs: endedAtMs - startedAtMs,
        summary,
        evidence: { ...evidence },
    };
}
export function resolveCheckCwd(root, relative) {
    return relative ? path.resolve(root, relative) : root;
}
export async function isHttpReachable(url) {
    try {
        await fetch(url, { signal: AbortSignal.timeout(1_000), redirect: "manual" });
        return true;
    }
    catch {
        return false;
    }
}
export async function waitForHttp(url, timeoutMs, exited) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (exited?.())
            return false;
        if (await isHttpReachable(url))
            return true;
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return false;
}
//# sourceMappingURL=shared.js.map