import type { NextApiRequest, NextApiResponse } from "next";
import verifyUser from "@/lib/api/verifyUser";
import resolveSessionKey from "@/lib/api/assistedScraping/resolveSessionKey";
import { getLiveSession } from "@/lib/api/assistedScraping/liveSessionStore";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyUser({ req, res });
  if (!user) return;

  const resolved = await resolveSessionKey(user.id, req);
  if (!resolved) {
    return res.status(401).json({ response: "Collection is not accessible." });
  }

  const session = getLiveSession(resolved.sessionKey);
  if (!session) {
    return res.status(404).json({ response: "No live session." });
  }

  try {
    const buffer = await session.activePage.screenshot({
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
