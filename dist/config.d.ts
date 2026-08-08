import type { ShipProofConfig } from "./types.js";
export declare const DEFAULT_CONFIG_FILE = "shipproof.yml";
export interface LoadedConfig {
    config: ShipProofConfig;
    absolutePath: string;
    relativePath: string;
    raw: string;
}
export declare function loadConfig(cwd: string, configPath?: string): Promise<LoadedConfig>;
export declare function normalizePath(value: string): string;
export declare const DEFAULT_CONFIG = "version: 1\nevidenceDir: .shipproof/runs\n\n# Files that an implementation agent must not silently weaken.\nprotected:\n  - shipproof.yml\n  - tests/**\n\nchecks:\n  - id: unit-tests\n    type: command\n    run: npm test\n    required: true\n    timeoutMs: 120000\n\n  - id: typecheck\n    type: command\n    run: npm run typecheck\n    required: true\n    timeoutMs: 120000\n\n  - id: build\n    type: command\n    run: npm run build\n    required: true\n    timeoutMs: 180000\n";
