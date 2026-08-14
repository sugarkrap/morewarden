import vm from "vm";
import { BrowserContext, Page } from "playwright";

type Log = (level: string, ...args: unknown[]) => void;

const PARSE_TIMEOUT_MS = 5_000;
const CALL_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out")), ms)
    ),
  ]);
}

export async function runUnsandboxedHookScript({
  script,
  context,
  page,
  api,
  log,
}: {
  script: string;
  context: BrowserContext;
  page: Page;
  api: Record<string, unknown>;
  log: Log;
}) {
  const vmGlobalsSharingOuterPrototypeChains = {
    console: {
      log: (...a: unknown[]) => log("log", ...a),
      info: (...a: unknown[]) => log("info", ...a),
      warn: (...a: unknown[]) => log("warn", ...a),
      error: (...a: unknown[]) => log("error", ...a),
      debug: (...a: unknown[]) => log("debug", ...a),
    },
    Buffer,
  };
  vm.createContext(vmGlobalsSharingOuterPrototypeChains);

  const extractHooks = new vm.Script(
    `${script}\n;(function(){return {before: typeof before !== "undefined" ? before : undefined, after: typeof after !== "undefined" ? after : undefined};})()`
  );
  const { before, after } = extractHooks.runInContext(
    vmGlobalsSharingOuterPrototypeChains,
    { timeout: PARSE_TIMEOUT_MS }
  ) as {
    before?: (context: BrowserContext) => Promise<void>;
    after?: (page: Page, api: Record<string, unknown>) => Promise<void>;
  };

  if (typeof before === "function") {
    log("info", "running before()...");
    await withTimeout(before(context), CALL_TIMEOUT_MS);
  }
  if (typeof after === "function") {
    log("info", "running after()...");
    await withTimeout(after(page, api), CALL_TIMEOUT_MS);
  }
  log("info", "dry run finished");
}
