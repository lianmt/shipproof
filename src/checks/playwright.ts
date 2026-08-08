import { mkdir } from "node:fs/promises";
import path from "node:path";
import { runShell, startBackground, type BackgroundProcess } from "../process.js";
import type { CheckResult, PlaywrightCheck } from "../types.js";
import {
  createResult,
  isHttpReachable,
  resolveCheckCwd,
  waitForHttp,
} from "./shared.js";

export async function runPlaywrightCheck(
  check: PlaywrightCheck,
  root: string,
  evidenceDir: string,
): Promise<CheckResult> {
  const startedAt = Date.now();
  if (check.script) {
    const evidence = await runShell(
      `npx playwright test ${shellQuote(check.script)}`,
      root,
      check.timeoutMs,
    );
    if (evidence.timedOut) {
      return createResult(check, startedAt, "BLOCKED", "Playwright test timed out", evidence);
    }
    return createResult(
      check,
      startedAt,
      evidence.exitCode === 0 ? "PASSED" : "FAILED",
      evidence.exitCode === 0 ? "Playwright test passed" : "Playwright test failed",
      evidence,
    );
  }

  const url = check.url as string;
  let service: BackgroundProcess | undefined;
  let browser: { close(): Promise<void> } | undefined;
  try {
    if (check.start) {
      const alreadyReachable = await isHttpReachable(url);
      if (alreadyReachable && !check.allowExisting) {
        return createResult(
          check,
          startedAt,
          "BLOCKED",
          "target URL responded before the configured service started; refusing stale evidence",
          { url },
        );
      }
      if (!alreadyReachable) {
        service = startBackground(check.start, resolveCheckCwd(root, check.startCwd));
        const ready = await waitForHttp(url, check.readyTimeoutMs, service.exited);
        if (!ready) {
          return createResult(check, startedAt, "BLOCKED", "service did not become ready", {
            url,
            pid: service.pid,
            logs: service.getLogs(),
          });
        }
      }
    }

    let playwright: any;
    try {
      const moduleName = "playwright";
      playwright = await import(moduleName);
    } catch (error) {
      return createResult(
        check,
        startedAt,
        "BLOCKED",
        `Playwright is not installed: ${toMessage(error)}`,
      );
    }

    try {
      browser = await playwright.chromium.launch({ headless: true });
    } catch (error) {
      return createResult(
        check,
        startedAt,
        "BLOCKED",
        `Chromium is unavailable; run npx playwright install chromium: ${toMessage(error)}`,
      );
    }

    const page = await (browser as any).newPage({ viewport: check.viewport });
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: check.timeoutMs,
    });
    const errors: string[] = [];
    const status = response?.status() ?? 0;
    if (status !== check.expectStatus) {
      errors.push(`navigation status ${status}; expected ${check.expectStatus}`);
    }
    if (check.contains !== undefined) {
      const text = await page.locator("body").innerText();
      if (!text.includes(check.contains)) {
        errors.push(`page did not contain ${JSON.stringify(check.contains)}`);
      }
    }
    if (check.selector !== undefined) {
      const count = await page.locator(check.selector).count();
      if (count < 1) errors.push(`selector not found: ${check.selector}`);
    }
    if (check.title !== undefined) {
      const actualTitle = await page.title();
      if (actualTitle !== check.title) {
        errors.push(`title ${JSON.stringify(actualTitle)}; expected ${JSON.stringify(check.title)}`);
      }
    }
    const screenshotRelative =
      check.screenshot ?? path.join("screenshots", `${safeName(check.id)}.png`);
    const screenshotPath = path.resolve(evidenceDir, screenshotRelative);
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return createResult(
      check,
      startedAt,
      errors.length === 0 ? "PASSED" : "FAILED",
      errors.length === 0 ? "browser check passed" : errors.join("; "),
      {
        url,
        status,
        title: await page.title(),
        screenshot: path.relative(root, screenshotPath),
        service: service ? { pid: service.pid, logs: service.getLogs() } : null,
      },
    );
  } catch (error) {
    return createResult(check, startedAt, "BLOCKED", `browser check could not run: ${toMessage(error)}`, {
      url,
      logs: service?.getLogs(),
    });
  } finally {
    await browser?.close();
    await service?.stop();
  }
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
