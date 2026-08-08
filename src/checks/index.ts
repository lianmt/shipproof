import type {
  CheckDefinition,
  CheckResult,
  CommandCheck,
  FileCheck,
  HttpCheck,
  PlaywrightCheck,
} from "../types.js";
import { runCommandCheck } from "./command.js";
import { runFileCheck } from "./file.js";
import { runHttpCheck } from "./http.js";
import { runPlaywrightCheck } from "./playwright.js";

export async function runCheck(
  check: CheckDefinition,
  cwd: string,
  evidenceDir: string,
): Promise<CheckResult> {
  switch (check.type) {
    case "command":
      return await runCommandCheck(check as CommandCheck, cwd);
    case "file":
      return await runFileCheck(check as FileCheck, cwd);
    case "http":
      return await runHttpCheck(check as HttpCheck, cwd);
    case "playwright":
      return await runPlaywrightCheck(check as PlaywrightCheck, cwd, evidenceDir);
  }
}
