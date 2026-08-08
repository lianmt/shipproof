export type VerificationStatus =
  | "VERIFIED"
  | "FAILED"
  | "BLOCKED"
  | "UNVERIFIED";

export type CheckStatus = "PASSED" | "FAILED" | "BLOCKED" | "SKIPPED";

export interface CheckBase {
  id: string;
  name?: string;
  required: boolean;
  timeoutMs: number;
}

export interface CommandCheck extends CheckBase {
  type: "command";
  run: string;
  cwd?: string;
  expectExit: number;
  contains?: string;
  notContains?: string;
}

export interface FileCheck extends CheckBase {
  type: "file";
  path: string;
  exists: boolean;
  contains?: string;
  notContains?: string;
  minBytes?: number;
}

export interface HttpCheck extends CheckBase {
  type: "http";
  url: string;
  method: string;
  start?: string;
  startCwd?: string;
  allowExisting: boolean;
  readyTimeoutMs: number;
  expectStatus: number;
  contains?: string;
  notContains?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface PlaywrightCheck extends CheckBase {
  type: "playwright";
  url?: string;
  script?: string;
  start?: string;
  startCwd?: string;
  allowExisting: boolean;
  readyTimeoutMs: number;
  expectStatus: number;
  contains?: string;
  selector?: string;
  title?: string;
  screenshot?: string;
  viewport: { width: number; height: number };
}

export type CheckDefinition =
  | CommandCheck
  | FileCheck
  | HttpCheck
  | PlaywrightCheck;

export interface ShipProofConfig {
  version: 1;
  evidenceDir: string;
  protected: string[];
  checks: CheckDefinition[];
}

export interface ProcessEvidence {
  command: string;
  cwd: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export interface CheckResult {
  id: string;
  name: string;
  type: CheckDefinition["type"];
  required: boolean;
  status: CheckStatus;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  summary: string;
  evidence: Record<string, unknown>;
}

export interface IntegritySnapshot {
  configHash: string;
  protectedHash: string;
  protectedFiles: Array<{ path: string; sha256: string }>;
  workspaceHash: string;
  gitCommit: string | null;
  gitDirty: boolean | null;
  taskHash: string | null;
}

export interface VerificationLock {
  version: 1;
  createdAt: string;
  cwd: string;
  configPath: string;
  source: "working-tree" | "git-ref";
  sourceRef?: string;
  configHash: string;
  protectedHash: string;
  protectedFiles: Array<{ path: string; sha256: string }>;
  taskPath: string | null;
  taskHash: string | null;
}

export interface VerificationRun {
  version: 1;
  runId: string;
  status: VerificationStatus;
  cwd: string;
  configPath: string;
  taskPath: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  lock: VerificationLock | null;
  integrityBefore: IntegritySnapshot;
  integrityAfter: IntegritySnapshot;
  integrityValid: boolean;
  stale: boolean;
  reasons: string[];
  checks: CheckResult[];
  reportPath?: string;
}

export interface VerifyOptions {
  cwd: string;
  configPath?: string;
  taskPath?: string;
  requireLock?: boolean;
}
