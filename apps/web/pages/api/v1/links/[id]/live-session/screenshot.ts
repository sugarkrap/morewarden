import type { NextApiRequest, NextApiResponse } from "next";
import verifyUser from "@/lib/api/verifyUser";
import assertAssistedScrapingAccess from "@/lib/api/assistedScraping/assertAccess";
import { getLiveSession } from "@/lib/api/assistedScraping/liveSessionStore";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyUser({ req, res });
  if (!user) return;

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

  try {
    const buffer = await session.page.screenshot({
      type: "jpeg",
      quality: 60,
    });
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buffer);
  } catch (error: any) {
    return res.status(502).json({
      response: error?.message || "Failed to capture the live page.",
    });
  }
}
