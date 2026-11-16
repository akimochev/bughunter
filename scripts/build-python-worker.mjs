import { build } from "esbuild";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const packageDirectory = dirname(
  createRequire(import.meta.url).resolve("pyodide"),
);
const { version } = JSON.parse(
  await readFile(join(packageDirectory, "package.json"), "utf8"),
);
const runtimeDirectory = join("public", "pyodide", `v${version}`);
await mkdir(runtimeDirectory, { recursive: true });
await Promise.all(
  [
    "pyodide.mjs",
    "pyodide.asm.mjs",
    "pyodide.asm.wasm",
    "python_stdlib.zip",
    "pyodide-lock.json",
  ].map((file) =>
    copyFile(join(packageDirectory, file), join(runtimeDirectory, file)),
  ),
);

await build({
  entryPoints: ["src/workers/python.worker.ts"],
  outfile: "public/python.worker.mjs",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["/pyodide/*"],
});
