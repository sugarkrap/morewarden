import type { NextApiRequest, NextApiResponse } from "next";
import verifyUser from "@/lib/api/verifyUser";
import resolveSessionKey from "@/lib/api/assistedScraping/resolveSessionKey";
import { closeLiveSession } from "@/lib/api/assistedScraping/liveSessionStore";

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

  await closeLiveSession(resolved.sessionKey);
  return res.status(200).json({ response: "ok" });
}
