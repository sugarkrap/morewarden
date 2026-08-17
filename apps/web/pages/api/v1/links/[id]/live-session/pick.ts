import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import verifyUser from "@/lib/api/verifyUser";
import resolveSessionKey from "@/lib/api/assistedScraping/resolveSessionKey";
import { getLiveSession } from "@/lib/api/assistedScraping/liveSessionStore";

const PickSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

function cssPath([x, y]: [number, number]) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;

  if (el.id) return "#" + CSS.escape(el.id);

  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < 6) {
    if (node.id) {
      parts.unshift("#" + CSS.escape(node.id));
      break;
    }
    let selector = node.tagName.toLowerCase();
    let sibling = node;
    let nth = 1;
    while ((sibling = sibling.previousElementSibling as Element)) {
      if (sibling.tagName === node.tagName) nth++;
    }
    selector += `:nth-of-type(${nth})`;
    parts.unshift(selector);
    node = node.parentElement;
  }
  return parts.join(" > ");
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

  const dataValidation = PickSchema.safeParse(req.body);
  if (!dataValidation.success) {
    return res.status(400).json({
      response: `Error: ${dataValidation.error.issues[0].message}`,
    });
  }

  const { x, y } = dataValidation.data;
  const page = session.activePage;
  const viewport = page.viewportSize();
  const pixelX = x * (viewport?.width ?? 1280);
  const pixelY = y * (viewport?.height ?? 720);

  try {
    const selector = await page.evaluate(cssPath, [pixelX, pixelY] as [
      number,
      number,
    ]);
    return res.status(200).json({ response: { selector } });
  } catch (error: any) {
    return res.status(502).json({
      response: error?.message || "Failed to pick an element.",
    });
  }
}
