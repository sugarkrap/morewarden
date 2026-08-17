import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import verifyUser from "@/lib/api/verifyUser";
import resolveSessionKey from "@/lib/api/assistedScraping/resolveSessionKey";
import { getOrCreateLiveSession } from "@/lib/api/assistedScraping/liveSessionStore";

const StartSchema = z.object({
  url: z.string().trim().url().optional(),
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

  const dataValidation = StartSchema.safeParse(req.body);
  if (!dataValidation.success) {
    return res.status(400).json({
      response: `Error: ${dataValidation.error.issues[0].message}`,
    });
  }

  const url = resolved.url || dataValidation.data.url;
  if (!url) {
    return res.status(400).json({ response: "No URL to start a session for." });
  }

  try {
    await getOrCreateLiveSession(resolved.sessionKey, url);
    return res.status(200).json({ response: "ok" });
  } catch (error: any) {
    return res.status(502).json({
      response: error?.message || "Failed to start the live session.",
    });
  }
}
