import { readFile } from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import { configSchema } from "./schema.js";
import type { ShipProofConfig } from "./types.js";

export const DEFAULT_CONFIG_FILE = "shipproof.yml";

export interface LoadedConfig {
  config: ShipProofConfig;
  absolutePath: string;
  relativePath: string;
  raw: string;
}

export async function loadConfig(
  cwd: string,
  configPath = DEFAULT_CONFIG_FILE,
): Promise<LoadedConfig> {
  const absolutePath = path.resolve(cwd, configPath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = YAML.parse(raw) as unknown;
  const config = configSchema.parse(parsed) as ShipProofConfig;
  return {
    config,
    absolutePath,
    relativePath: normalizePath(path.relative(cwd, absolutePath)),
    raw,
  };
}

export function normalizePath(value: string): string {
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
