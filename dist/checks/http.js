import { startBackground } from "../process.js";
import { redactText } from "../redact.js";
import { createResult, isHttpReachable, resolveCheckCwd, waitForHttp, } from "./shared.js";
export async function runHttpCheck(check, root) {
    const startedAt = Date.now();
    let service;
    try {
        if (check.start) {
            const alreadyReachable = await isHttpReachable(check.url);
            if (alreadyReachable && !check.allowExisting) {
                return createResult(check, startedAt, "BLOCKED", "target URL responded before the configured service started; refusing stale evidence", { url: check.url });
            }
            if (!alreadyReachable) {
                service = startBackground(check.start, resolveCheckCwd(root, check.startCwd));
                const ready = await waitForHttp(check.url, check.readyTimeoutMs, service.exited);
                if (!ready) {
                    return createResult(check, startedAt, "BLOCKED", "service did not become ready", {
                        url: check.url,
                        command: check.start,
                        pid: service.pid,
                        logs: service.getLogs(),
                    });
                }
            }
        }
        let response;
        try {
            const request = {
                method: check.method,
                redirect: "manual",
                signal: AbortSignal.timeout(check.timeoutMs),
                ...(check.headers ? { headers: check.headers } : {}),
                ...(check.body !== undefined ? { body: check.body } : {}),
            };
            response = await fetch(check.url, request);
        }
        catch (error) {
            return createResult(check, startedAt, "BLOCKED", `request failed: ${toMessage(error)}`, {
                url: check.url,
                logs: service?.getLogs(),
            });
        }
        const body = redactText(await response.text());
        const errors = [];
        if (response.status !== check.expectStatus) {
            errors.push(`status ${response.status}; expected ${check.expectStatus}`);
        }
        if (check.contains !== undefined && !body.includes(check.contains)) {
            errors.push(`body did not contain ${JSON.stringify(check.contains)}`);
        }
        if (check.notContains !== undefined && body.includes(check.notContains)) {
            errors.push(`body contained forbidden text ${JSON.stringify(check.notContains)}`);
        }
        return createResult(check, startedAt, errors.length === 0 ? "PASSED" : "FAILED", errors.length === 0 ? "HTTP check passed" : errors.join("; "), {
            url: check.url,
            method: check.method,
            status: response.status,
            body: body.slice(0, 32_768),
            service: service
                ? { command: service.command, pid: service.pid, logs: service.getLogs() }
                : null,
        });
    }
    finally {
        await service?.stop();
    }
}
function toMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=http.js.map