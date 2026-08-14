import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import verifyUser from "@/lib/api/verifyUser";
import assertAssistedScrapingAccess from "@/lib/api/assistedScraping/assertAccess";
import {
  getLiveSession,
  pushLog,
} from "@/lib/api/assistedScraping/liveSessionStore";
import { runUnsandboxedHookScript } from "@/lib/api/assistedScraping/runUnsandboxedHookScript";

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

  const stubbedApi = {
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
    await runUnsandboxedHookScript({
      script: dataValidation.data.script,
      context: session.context,
      page: session.activePage,
      api: stubbedApi,
      log,
    });
    return res.status(200).json({ response: "ok" });
  } catch (error: any) {
    log("error", error?.message || "Dry run failed.");
    return res.status(200).json({ response: "ok" });
  }
}
