import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@linkwarden/prisma";
import verifyUser from "@/lib/api/verifyUser";
import { z } from "zod";

const UpdateScriptSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(100_000).optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyUser({ req, res });
  if (!user) return;

  const scriptId = Number(req.query.id);
  if (!scriptId) {
    return res.status(400).json({ response: "Invalid parameters." });
  }

  const script = await prisma.hookScript.findUnique({
    where: { id: scriptId },
  });

  if (!script || script.ownerId !== user.id) {
    return res.status(404).json({ response: "Script not found." });
  }

  if (req.method === "PUT") {
    const dataValidation = UpdateScriptSchema.safeParse(req.body);
    if (!dataValidation.success) {
      return res.status(400).json({
        response: `Error: ${dataValidation.error.issues[0].message}`,
      });
    }

    const updated = await prisma.hookScript.update({
      where: { id: scriptId },
      data: dataValidation.data,
    });

    return res.status(200).json({ response: updated });
  }

  if (req.method === "DELETE") {
    await prisma.hookScript.delete({ where: { id: scriptId } });
    return res.status(200).json({ response: "Script deleted." });
  }

  return res.status(405).json({ response: "Method not allowed" });
}
