import { runCommandCheck } from "./command.js";
import { runFileCheck } from "./file.js";
import { runHttpCheck } from "./http.js";
import { runPlaywrightCheck } from "./playwright.js";
export async function runCheck(check, cwd, evidenceDir) {
    switch (check.type) {
        case "command":
            return await runCommandCheck(check, cwd);
        case "file":
            return await runFileCheck(check, cwd);
        case "http":
            return await runHttpCheck(check, cwd);
        case "playwright":
            return await runPlaywrightCheck(check, cwd, evidenceDir);
    }
}
//# sourceMappingURL=index.js.map