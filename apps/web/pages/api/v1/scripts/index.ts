import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@linkwarden/prisma";
import verifyUser from "@/lib/api/verifyUser";
import { z } from "zod";

const CreateScriptSchema = z.object({
  name: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1).max(100_000),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyUser({ req, res });
  if (!user) return;

  if (req.method === "GET") {
    const scripts = await prisma.hookScript.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    return res.status(200).json({ response: scripts });
  }

  if (req.method === "POST") {
    const dataValidation = CreateScriptSchema.safeParse(req.body);
    if (!dataValidation.success) {
      return res.status(400).json({
        response: `Error: ${dataValidation.error.issues[0].message}`,
      });
    }

    const name =
      dataValidation.data.name ||
      `Unnamed-${(await prisma.hookScript.count({
        where: { ownerId: user.id },
      })) + 1}`;

    const script = await prisma.hookScript.create({
      data: {
        name,
        content: dataValidation.data.content,
        ownerId: user.id,
      },
    });

    return res.status(200).json({ response: script });
  }

  return res.status(405).json({ response: "Method not allowed" });
}
