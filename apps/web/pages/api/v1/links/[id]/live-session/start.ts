import type { NextApiRequest, NextApiResponse } from "next";
import verifyUser from "@/lib/api/verifyUser";
import assertAssistedScrapingAccess from "@/lib/api/assistedScraping/assertAccess";
import { getOrCreateLiveSession } from "@/lib/api/assistedScraping/liveSessionStore";

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
  if (!link?.url) {
    return res.status(401).json({ response: "Collection is not accessible." });
  }

  try {
    await getOrCreateLiveSession(linkId, link.url);
    return res.status(200).json({ response: "ok" });
  } catch (error: any) {
    return res.status(502).json({
      response: error?.message || "Failed to start the live session.",
    });
  }
}
