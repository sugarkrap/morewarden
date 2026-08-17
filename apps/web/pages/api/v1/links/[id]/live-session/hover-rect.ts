import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import verifyUser from "@/lib/api/verifyUser";
import resolveSessionKey from "@/lib/api/assistedScraping/resolveSessionKey";
import { getLiveSession } from "@/lib/api/assistedScraping/liveSessionStore";

const HoverRectSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

function elementRectAt([x, y]: [number, number]) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
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

  const resolved = await resolveSessionKey(user.id, req);
  if (!resolved) {
    return res.status(401).json({ response: "Collection is not accessible." });
  }

  const session = getLiveSession(resolved.sessionKey);
  if (!session) {
    return res.status(404).json({ response: "No live session." });
  }

  const dataValidation = HoverRectSchema.safeParse(req.body);
  if (!dataValidation.success) {
    return res.status(400).json({
      response: `Error: ${dataValidation.error.issues[0].message}`,
    });
  }

  const { x, y } = dataValidation.data;
  const page = session.activePage;
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const pixelX = x * viewport.width;
  const pixelY = y * viewport.height;

  try {
    const rect = await page.evaluate(elementRectAt, [pixelX, pixelY] as [
      number,
      number,
    ]);
    return res.status(200).json({ response: { rect, viewport } });
  } catch (error: any) {
    return res.status(502).json({
      response: error?.message || "Failed to inspect the live page.",
    });
  }
}
