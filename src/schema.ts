import { z } from "zod";

const checkBase = {
  id: z.string().min(1).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/),
  name: z.string().min(1).optional(),
  required: z.boolean().default(true),
  timeoutMs: z.number().int().positive().max(30 * 60_000).default(120_000),
};

const commandCheckSchema = z.object({
  ...checkBase,
  type: z.literal("command"),
  run: z.string().min(1),
  cwd: z.string().min(1).optional(),
  expectExit: z.number().int().default(0),
  contains: z.string().optional(),
  notContains: z.string().optional(),
});

const fileCheckSchema = z.object({
  ...checkBase,
  type: z.literal("file"),
  path: z.string().min(1),
  exists: z.boolean().default(true),
  contains: z.string().optional(),
  notContains: z.string().optional(),
  minBytes: z.number().int().nonnegative().optional(),
});

const httpCheckSchema = z.object({
  ...checkBase,
  type: z.literal("http"),
  url: z.string().url(),
  method: z.string().min(1).default("GET"),
  start: z.string().min(1).optional(),
  startCwd: z.string().min(1).optional(),
  allowExisting: z.boolean().default(false),
  readyTimeoutMs: z.number().int().positive().max(10 * 60_000).default(30_000),
  expectStatus: z.number().int().min(100).max(599).default(200),
  contains: z.string().optional(),
  notContains: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});

const playwrightCheckSchema = z
  .object({
    ...checkBase,
    type: z.literal("playwright"),
    url: z.string().url().optional(),
    script: z.string().min(1).optional(),
    start: z.string().min(1).optional(),
    startCwd: z.string().min(1).optional(),
    allowExisting: z.boolean().default(false),
    readyTimeoutMs: z.number().int().positive().max(10 * 60_000).default(30_000),
    expectStatus: z.number().int().min(100).max(599).default(200),
    contains: z.string().optional(),
    selector: z.string().optional(),
    title: z.string().optional(),
    screenshot: z.string().min(1).optional(),
    viewport: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .default({ width: 1440, height: 900 }),
  })
  .refine((value) => Boolean(value.url) !== Boolean(value.script), {
    message: "playwright check requires exactly one of url or script",
  });

export const configSchema = z
  .object({
    version: z.literal(1),
    evidenceDir: z.string().min(1).default(".shipproof/runs"),
    protected: z.array(z.string().min(1)).default(["shipproof.yml", "tests/**"]),
    checks: z
      .array(
        z.discriminatedUnion("type", [
          commandCheckSchema,
          fileCheckSchema,
          httpCheckSchema,
          playwrightCheckSchema,
        ]),
      )
      .min(1),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    for (const [index, check] of value.checks.entries()) {
      if (seen.has(check.id)) {
        context.addIssue({
          code: "custom",
          path: ["checks", index, "id"],
          message: `duplicate check id: ${check.id}`,
        });
      }
      seen.add(check.id);
    }
  });
