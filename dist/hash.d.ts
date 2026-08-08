export declare function sha256(value: string | Buffer): string;
export declare function hashFile(filePath: string): Promise<string>;
export declare function hashFiles(cwd: string, patterns: string[]): Promise<{
    hash: string;
    files: Array<{
        path: string;
        sha256: string;
    }>;
}>;
export declare function hashFilesAtGitRef(cwd: string, patterns: string[], ref: string): Promise<{
    hash: string;
    files: Array<{
        path: string;
        sha256: string;
    }>;
}>;
export declare function workspaceFingerprint(cwd: string): Promise<{
    hash: string;
    commit: string | null;
    dirty: boolean | null;
}>;
