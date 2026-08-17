import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import verifyUser from "@/lib/api/verifyUser";
import resolveSessionKey from "@/lib/api/assistedScraping/resolveSessionKey";
import {
  getLiveSession,
  pushLog,
} from "@/lib/api/assistedScraping/liveSessionStore";
import { loadUnsandboxedHookScript } from "@linkwarden/lib/runUnsandboxedHookScript";

const DryRunSchema = z.object({
  script: z.string().trim().min(1).max(100_000),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyUser({ req, res });
  if (!user) return;

  if (req.method !== "POST") {
    return res.status(405).json({ response: "Method not allowed" });
  }

  const resolved = await resolveSessionKey(user.id, req);
  if (!resolved) {
    return res.status(401).json({ response: "Collection is not accessible." });
  }

  const session = getLiveSession(resolved.sessionKey);
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

  const stubbedApi = {
    addFileToArchive: async (
      buffer: unknown,
      mimeType: string,
      filename?: string
    ) => {
      const size =
        buffer && typeof (buffer as any).length === "number"
          ? (buffer as any).length
          : "unknown";
      log(
        "info",
        `[dry run] addFileToArchive stub: mimeType=${mimeType}, filename=${
          filename || "(auto)"
        }, size=${size} bytes (not saved)`
      );
    },
  };

  try {
    const hooks = loadUnsandboxedHookScript(dataValidation.data.script, log);
    if (hooks.before) await hooks.before(session.context);
    if (hooks.after) await hooks.after(session.activePage, stubbedApi);
    log("info", "dry run finished");
    return res.status(200).json({ response: "ok" });
  } catch (error: any) {
    log("error", error?.message || "Dry run failed.");
    return res.status(200).json({ response: "ok" });
  }
}
