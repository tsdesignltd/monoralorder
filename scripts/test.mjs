import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
fs.mkdirSync(".sites-runtime/tests", { recursive: true });
for (const test of ["finance.test", "pdf-check"]) {
  const outfile = `.sites-runtime/tests/${test}.mjs`;
  await build({
    entryPoints: [`tests/${test}.ts`],
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile,
  });
  const result = spawnSync(process.execPath, [outfile], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
