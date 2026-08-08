const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const source = readFileSync(new URL("../src/server.cjs", `file://${__filename}`), "utf8");
assert.match(source, /data-testid=\\?"ready/);
console.log("fixture unit test passed");
