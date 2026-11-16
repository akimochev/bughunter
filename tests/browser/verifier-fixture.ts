import { build } from "esbuild";
import type { BrowserContext, Page } from "@playwright/test";
import type {
  VerificationRequest,
  VerificationResult,
} from "../../src/lib/verification/types";

const bundle = build({
  entryPoints: ["src/lib/verification/verifier.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
}).then((result) => result.outputFiles[0].text);

export async function prepareVerifier(context: BrowserContext, page: Page) {
  await context.route("**/__test-verifier.mjs", async (route) =>
    route.fulfill({ contentType: "text/javascript", body: await bundle }),
  );
  await page.goto("/");
}

export async function verifyInBrowser(
  page: Page,
  request: VerificationRequest,
): Promise<VerificationResult> {
  return page.evaluate(async (encoded) => {
    const input: VerificationRequest = JSON.parse(encoded);
    const url = "/__test-verifier.mjs";
    const { SolutionVerifier } = await import(url);
    const verifier = new SolutionVerifier();
    try {
      return await verifier.verify(input);
    } finally {
      verifier.dispose();
    }
  }, JSON.stringify(request));
}
