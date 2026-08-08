import { z } from "zod";
export declare const configSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    evidenceDir: z.ZodDefault<z.ZodString>;
    protected: z.ZodDefault<z.ZodArray<z.ZodString>>;
    checks: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"command">;
        run: z.ZodString;
        cwd: z.ZodOptional<z.ZodString>;
        expectExit: z.ZodDefault<z.ZodNumber>;
        contains: z.ZodOptional<z.ZodString>;
        notContains: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        required: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"file">;
        path: z.ZodString;
        exists: z.ZodDefault<z.ZodBoolean>;
        contains: z.ZodOptional<z.ZodString>;
        notContains: z.ZodOptional<z.ZodString>;
        minBytes: z.ZodOptional<z.ZodNumber>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        required: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"http">;
        url: z.ZodString;
        method: z.ZodDefault<z.ZodString>;
        start: z.ZodOptional<z.ZodString>;
        startCwd: z.ZodOptional<z.ZodString>;
        allowExisting: z.ZodDefault<z.ZodBoolean>;
        readyTimeoutMs: z.ZodDefault<z.ZodNumber>;
        expectStatus: z.ZodDefault<z.ZodNumber>;
        contains: z.ZodOptional<z.ZodString>;
        notContains: z.ZodOptional<z.ZodString>;
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        body: z.ZodOptional<z.ZodString>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        required: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        type: z.ZodLiteral<"playwright">;
        url: z.ZodOptional<z.ZodString>;
        script: z.ZodOptional<z.ZodString>;
        start: z.ZodOptional<z.ZodString>;
        startCwd: z.ZodOptional<z.ZodString>;
        allowExisting: z.ZodDefault<z.ZodBoolean>;
        readyTimeoutMs: z.ZodDefault<z.ZodNumber>;
        expectStatus: z.ZodDefault<z.ZodNumber>;
        contains: z.ZodOptional<z.ZodString>;
        selector: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
        screenshot: z.ZodOptional<z.ZodString>;
        viewport: z.ZodDefault<z.ZodObject<{
            width: z.ZodNumber;
            height: z.ZodNumber;
        }, z.core.$strip>>;
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        required: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>], "type">>;
}, z.core.$strip>;
