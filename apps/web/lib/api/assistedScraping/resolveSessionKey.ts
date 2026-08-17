import type { NextApiRequest } from "next";
import assertAssistedScrapingAccess from "./assertAccess";

export default async function resolveSessionKey(
  userId: number,
  req: NextApiRequest
): Promise<{ sessionKey: string; url?: string } | null> {
  const rawId = req.query.id;
  const linkId = Number(rawId);

  if (linkId) {
    const link = await assertAssistedScrapingAccess(userId, linkId);
    if (!link?.url) return null;
    return { sessionKey: `link-${linkId}`, url: link.url };
  }

  if (typeof rawId !== "string" || !rawId.trim()) return null;
  return { sessionKey: `draft-${userId}-${rawId}` };
}
