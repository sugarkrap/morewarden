import { createFile } from "@linkwarden/filesystem";
import { prisma } from "@linkwarden/prisma";

export async function saveLinkFile({
  linkId,
  collectionId,
  index,
  name,
  buffer,
  mimeType,
  url,
}: {
  linkId: number;
  collectionId: number;
  index: number;
  name: string;
  buffer: Buffer;
  mimeType: string;
  url: string;
}) {
  const filePath = `archives/${collectionId}/${linkId}/files/${index}-${name}`;

  const written = await createFile({ data: buffer, filePath });
  if (!written) return null;

  return prisma.linkFile.create({
    data: { linkId, url, name, filePath, mimeType, size: buffer.length },
  });
}
