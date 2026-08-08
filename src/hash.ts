import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import micromatch from "micromatch";
import { normalizePath } from "./config.js";
import { runGit } from "./process.js";

const IGNORED = [
  ".git/**",
  ".shipproof/**",
  "node_modules/**",
  "dist/**",
  "action-dist/**",
  "coverage/**",
];

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function hashFile(filePath: string): Promise<string> {
  return sha256(await readFile(filePath));
}

export async function hashFiles(
  cwd: string,
  patterns: string[],
): Promise<{ hash: string; files: Array<{ path: string; sha256: string }> }> {
  const files = await fg(patterns, {
    cwd,
    absolute: false,
    onlyFiles: true,
    dot: true,
    unique: true,
    followSymbolicLinks: false,
    ignore: IGNORED,
  });
  files.sort();
  const entries: Array<{ path: string; sha256: string }> = [];
  for (const file of files) {
    const normalized = normalizePath(file);
    entries.push({ path: normalized, sha256: await hashFile(path.join(cwd, file)) });
  }
  return {
    hash: sha256(JSON.stringify({ patterns: [...patterns].sort(), files: entries })),
    files: entries,
  };
}

export async function hashFilesAtGitRef(
  cwd: string,
  patterns: string[],
  ref: string,
): Promise<{ hash: string; files: Array<{ path: string; sha256: string }> }> {
  const prefixResult = await runGit(["rev-parse", "--show-prefix"], cwd);
  if (prefixResult.exitCode !== 0) {
    throw new Error(`cannot locate git repository: ${prefixResult.stderr || prefixResult.stdout}`);
  }
  const prefix = normalizePath(prefixResult.stdout.trim()).replace(/\/$/, "");
  const list = await runGit(["ls-tree", "-r", "--name-only", ref], cwd);
  if (list.exitCode !== 0) {
    throw new Error(`cannot read git ref ${ref}: ${list.stderr || list.stdout}`);
  }
  const files = list.stdout
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => micromatch.isMatch(item, patterns, { dot: true }))
    .filter((item) => !micromatch.isMatch(item, IGNORED, { dot: true }))
    .sort();
  const entries: Array<{ path: string; sha256: string }> = [];
  for (const file of files) {
    const repositoryPath = prefix ? `${prefix}/${file}` : file;
    const content = await runGit(["show", `${ref}:${repositoryPath}`], cwd, true);
    if (content.exitCode !== 0) {
      throw new Error(`cannot read ${repositoryPath} at ${ref}: ${content.stderr}`);
    }
    entries.push({ path: normalizePath(file), sha256: sha256(content.stdoutBuffer) });
  }
  return {
    hash: sha256(JSON.stringify({ patterns: [...patterns].sort(), files: entries })),
    files: entries,
  };
}

export async function workspaceFingerprint(cwd: string): Promise<{
  hash: string;
  commit: string | null;
  dirty: boolean | null;
}> {
  const commitResult = await runGit(["rev-parse", "HEAD"], cwd);
  if (commitResult.exitCode !== 0) {
    const all = await hashFiles(cwd, ["**/*"]);
    return { hash: all.hash, commit: null, dirty: null };
  }
  const commit = commitResult.stdout.trim();
  const statusResult = await runGit(["status", "--porcelain=v1", "-z", "--", "."], cwd, true);
  const diffResult = await runGit(["diff", "--binary", "HEAD", "--", "."], cwd, true);
  const untrackedResult = await runGit(
    ["ls-files", "--others", "--exclude-standard", "-z", "--", "."],
    cwd,
    true,
  );
  const untracked = untrackedResult.stdout
    .split("\0")
    .filter(Boolean);
  const untrackedHash = await hashFiles(cwd, untracked);
  return {
    hash: sha256(
      Buffer.concat([
        Buffer.from(commit),
        statusResult.stdoutBuffer,
        diffResult.stdoutBuffer,
        Buffer.from(untrackedHash.hash),
      ]),
    ),
    commit,
    dirty: statusResult.stdoutBuffer.length > 0,
  };
}
