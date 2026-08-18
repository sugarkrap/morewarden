import type { NextApiRequest, NextApiResponse } from "next";
import { readFile } from "@linkwarden/filesystem";
import { prisma } from "@linkwarden/prisma";
import verifyToken from "@/lib/api/verifyToken";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

function contentDispositionHeaderSafeAgainstHeaderInjection(
  name: string
): string {
  const asciiFallbackWithoutQuotesOrControlChars = name
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${asciiFallbackWithoutQuotesOrControlChars}"; filename*=UTF-8''${encodeURIComponent(
    name
  )}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ response: "Method not allowed" });
  }

  const linkId = Number(req.query.id);
  const fileId = Number(req.query.fileId);
  if (!linkId || !fileId) {
    return res.status(400).json({ response: "Invalid parameters." });
  }

  const token = await verifyToken({ req });
  const userId = typeof token === "string" ? undefined : token?.id;

  const file = await prisma.linkFile.findFirst({
    where: {
      id: fileId,
      linkId,
      link: {
        collection: {
          OR: [
            { ownerId: userId || -1 },
            { members: { some: { userId: userId || -1 } } },
            { isPublic: true },
          ],
        },
      },
    },
  });

  if (!file) {
    return res
      .status(401)
      .json({ response: "You don't have access to this file." });
  }

  const { file: data, status } = await readFile(file.filePath);
  if (status !== 200) {
    return res.status(status as number).send(data);
  }

  const isDownload = req.query.download === "1";

  res
    .setHeader("Content-Type", file.mimeType)
    .setHeader("Cache-Control", "private, max-age=31536000, immutable")
    .setHeader("X-Content-Type-Options", "nosniff");

  if (isDownload) {
    res.setHeader(
      "Content-Disposition",
      contentDispositionHeaderSafeAgainstHeaderInjection(file.name)
    );
  }

  return res.status(200).send(data);
}
