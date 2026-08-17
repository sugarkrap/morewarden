import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@linkwarden/prisma";
import { UsersAndCollections } from "@linkwarden/prisma/client";
import getPermission from "@/lib/api/getPermission";
import verifyUser from "@/lib/api/verifyUser";
import { z } from "zod";

const SaveHookScriptSchema = z.object({
  hookScript: z.string().trim().min(1).max(100_000).nullable(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyUser({ req, res });
  if (!user) return;

  if (req.method !== "PUT") {
    return res.status(405).json({ response: "Method not allowed" });
  }

  const linkId = Number(req.query.id);
  if (!linkId) {
    return res.status(400).json({ response: "Invalid parameters." });
  }

  const dataValidation = SaveHookScriptSchema.safeParse(req.body);
  if (!dataValidation.success) {
    return res.status(400).json({
      response: `Error: ${dataValidation.error.issues[0].message}`,
    });
  }

  const collectionIsAccessible = await getPermission({
    userId: user.id,
    linkId,
  });
  const memberHasAccess = collectionIsAccessible?.members.some(
    (e: UsersAndCollections) => e.userId === user.id && e.canUpdate
  );

  if (
    !collectionIsAccessible ||
    !(collectionIsAccessible.ownerId === user.id || memberHasAccess)
  ) {
    return res.status(401).json({ response: "Collection is not accessible." });
  }

  const link = await prisma.link.findUnique({ where: { id: linkId } });
  if (!link) {
    return res.status(404).json({ response: "Link not found." });
  }

  if (!link.assistedScraping) {
    return res.status(400).json({
      response: "This link does not have assisted scraping enabled.",
    });
  }

  const updated = await prisma.link.update({
    where: { id: linkId },
    data: {
      hookScript: dataValidation.data.hookScript,
      hookScriptFailed: false,
      hookScriptLog: null,
    },
  });

  return res.status(200).json({ response: updated });
}
