import { prisma } from "@linkwarden/prisma";
import { UsersAndCollections } from "@linkwarden/prisma/client";
import getPermission from "@/lib/api/getPermission";

export default async function assertAssistedScrapingAccess(
  userId: number,
  linkId: number
) {
  const collectionIsAccessible = await getPermission({ userId, linkId });
  const memberHasAccess = collectionIsAccessible?.members.some(
    (e: UsersAndCollections) => e.userId === userId && e.canUpdate
  );

  if (
    !collectionIsAccessible ||
    !(collectionIsAccessible.ownerId === userId || memberHasAccess)
  ) {
    return null;
  }

  const link = await prisma.link.findUnique({ where: { id: linkId } });
  if (!link?.url || !link.assistedScraping) return null;

  return link;
}
