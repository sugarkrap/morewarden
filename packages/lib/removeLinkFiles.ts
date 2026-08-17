import { prisma } from "@linkwarden/prisma";
import { removeFile } from "@linkwarden/filesystem";

export async function removeLinkFiles(linkId: number) {
  const files = await prisma.linkFile.findMany({ where: { linkId } });

  await Promise.all(
    files.map((file) => removeFile({ filePath: file.filePath }))
  );

  await prisma.linkFile.deleteMany({ where: { linkId } });
}
