import { mkdir, writeFile } from "node:fs/promises";

const [directory, type] = process.argv.slice(2);
if (!directory || !["action-build", "action-dist"].includes(directory)) {
  throw new Error("package type directory must be action-build or action-dist");
}
if (!type || !["commonjs", "module"].includes(type)) {
  throw new Error("package type must be commonjs or module");
}

const destination = new URL(`../${directory}/`, import.meta.url);
await mkdir(destination, { recursive: true });
await writeFile(new URL("package.json", destination), `${JSON.stringify({ type })}\n`, "utf8");
