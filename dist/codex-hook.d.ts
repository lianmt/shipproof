import { statusExitCode } from "./status.js";
export interface CodexHookInput {
    cwd?: string;
    hook_event_name?: string;
    stop_hook_active?: boolean;
    [key: string]: unknown;
}
export type CodexHookOutput = Record<string, unknown>;
export declare function handleCodexHook(input: CodexHookInput, configPath?: string): Promise<CodexHookOutput>;
export declare function installCodexHooks(options: {
    cwd: string;
    configPath?: string;
}): Promise<string>;
export { statusExitCode };
