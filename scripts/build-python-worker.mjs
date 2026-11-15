import { build } from "esbuild";

await build({
  entryPoints: ["src/workers/python.worker.ts"],
  outfile: "public/python.worker.mjs",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["https://*"],
});
