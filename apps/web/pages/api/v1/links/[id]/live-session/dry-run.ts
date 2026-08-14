import type { NextApiRequest, NextApiResponse } from "next";
import vm from "vm";
import { z } from "zod";
import verifyUser from "@/lib/api/verifyUser";
import assertAssistedScrapingAccess from "@/lib/api/assistedScraping/assertAccess";
import {
  getLiveSession,
  pushLog,
} from "@/lib/api/assistedScraping/liveSessionStore";

const DryRunSchema = z.object({
  script: z.string().trim().min(1).max(100_000),
});

const RUN_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out")), ms)
    ),
  ]);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyUser({ req, res });
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ response: "Method not allowed" });
  }

  const linkId = Number(req.query.id);
  const link = linkId
    ? await assertAssistedScrapingAccess(user.id, linkId)
    : null;
  if (!link) {
    return res.status(401).json({ response: "Collection is not accessible." });
  }

  const session = getLiveSession(linkId);
  if (!session) {
    return res.status(404).json({ response: "No live session." });
  }

  const dataValidation = DryRunSchema.safeParse(req.body);
  if (!dataValidation.success) {
    return res.status(400).json({
      response: `Error: ${dataValidation.error.issues[0].message}`,
    });
  }

  const log = (level: string, ...args: unknown[]) =>
    pushLog(
      session,
      "script",
      level,
      args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
    );

  // vm isolates the script's *global scope* (its own `console`, no `require`/
  // `process`/`fs`), but the `context`/`page` arguments below are live
  // Playwright objects passed in from outside — their prototype chains are
  // still reachable from inside the sandbox. This is scoped by the
  // per-instance "assisted scraping" flag and is meant for a trusted
  // operator testing their own script, not for running arbitrary untrusted
  // code. Real isolation (e.g. isolated-vm or a subprocess) is a separate,
  // harder problem for whenever hookScript runs unattended during real
  // archiving rather than here, against a session the same user already
  // has open.
  const sandbox = {
    console: {
      log: (...a: unknown[]) => log("log", ...a),
      info: (...a: unknown[]) => log("info", ...a),
      warn: (...a: unknown[]) => log("warn", ...a),
      error: (...a: unknown[]) => log("error", ...a),
      debug: (...a: unknown[]) => log("debug", ...a),
    },
  };
  vm.createContext(sandbox);

  const api = {
    addFileToArchive: async (buffer: unknown, mimeType: string) => {
      const size =
        buffer && typeof (buffer as any).length === "number"
          ? (buffer as any).length
          : "unknown";
      log(
        "info",
        `[dry run] addFileToArchive stub: mimeType=${mimeType}, size=${size} bytes (not saved)`
      );
    },
  };

  try {
    const script = new vm.Script(
      `${dataValidation.data.script}\n;(function(){return {before: typeof before !== "undefined" ? before : undefined, after: typeof after !== "undefined" ? after : undefined};})()`
    );
    const { before, after } = script.runInContext(sandbox, {
      timeout: 5_000,
    }) as {
      before?: (context: unknown) => Promise<void>;
      after?: (page: unknown, api: unknown) => Promise<void>;
    };

    if (typeof before === "function") {
      log("info", "running before()...");
      await withTimeout(before(session.context), RUN_TIMEOUT_MS);
    }
    if (typeof after === "function") {
      log("info", "running after()...");
      await withTimeout(after(session.activePage, api), RUN_TIMEOUT_MS);
    }
    log("info", "dry run finished");

    return res.status(200).json({ response: "ok" });
  } catch (error: any) {
    log("error", error?.message || "Dry run failed.");
    return res.status(200).json({ response: "ok" });
  }
}
