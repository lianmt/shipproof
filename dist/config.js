import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { configSchema } from "./schema.js";
export const DEFAULT_CONFIG_FILE = "shipproof.yml";
export async function loadConfig(cwd, configPath = DEFAULT_CONFIG_FILE) {
    const absolutePath = path.resolve(cwd, configPath);
    const raw = await readFile(absolutePath, "utf8");
    const parsed = YAML.parse(raw);
    const config = configSchema.parse(parsed);
    return {
        config,
        absolutePath,
        relativePath: normalizePath(path.relative(cwd, absolutePath)),
        raw,
    };
}
export function normalizePath(value) {
    return value.split(path.sep).join("/");
}
export const DEFAULT_CONFIG = `version: 1
evidenceDir: .shipproof/runs

# Files that an implementation agent must not silently weaken.
protected:
  - shipproof.yml
  - tests/**

checks:
  - id: unit-tests
    type: command
    run: npm test
    required: true
    timeoutMs: 120000

  - id: typecheck
    type: command
    run: npm run typecheck
    required: true
    timeoutMs: 120000

  - id: build
    type: command
    run: npm run build
    required: true
    timeoutMs: 180000
`;
//# sourceMappingURL=config.js.map