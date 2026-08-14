import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import verifyUser from "@/lib/api/verifyUser";
import assertAssistedScrapingAccess from "@/lib/api/assistedScraping/assertAccess";
import { getLiveSession } from "@/lib/api/assistedScraping/liveSessionStore";

const InteractSchema = z.object({
  type: z.enum(["move", "click", "scroll"]),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  deltaY: z.number().optional(),
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

  const dataValidation = InteractSchema.safeParse(req.body);
  if (!dataValidation.success) {
    return res.status(400).json({
      response: `Error: ${dataValidation.error.issues[0].message}`,
    });
  }

  const { type, x, y, deltaY } = dataValidation.data;
  const viewport = session.page.viewportSize();
  const pixelX = x * (viewport?.width ?? 1280);
  const pixelY = y * (viewport?.height ?? 720);

  try {
    if (type === "move") {
      await session.page.mouse.move(pixelX, pixelY);
    } else if (type === "click") {
      await session.page.mouse.move(pixelX, pixelY);
      await session.page.mouse.down();
      await session.page.mouse.up();
    } else if (type === "scroll") {
      await session.page.mouse.move(pixelX, pixelY);
      await session.page.mouse.wheel(0, deltaY ?? 0);
    }
    return res.status(200).json({ response: "ok" });
  } catch (error: any) {
    return res.status(502).json({
      response: error?.message || "Failed to interact with the live page.",
    });
  }
}
