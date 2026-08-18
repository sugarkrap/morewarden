import { LinkIncludingShortenedCollectionAndTags } from "@linkwarden/types/global";
import updateLinkById from "../linkId/updateLinkById";
import { UpdateLinkSchemaType } from "@linkwarden/lib/schemaValidation";
import { prisma } from "@linkwarden/prisma";

export default async function updateLinks(
  userId: number,
  links: { id: number }[],
  removePreviousTags: boolean,
  newData: Pick<
    LinkIncludingShortenedCollectionAndTags,
    "tags" | "collectionId"
  > & {
    assistedScraping?: boolean;
    hookScript?: string;
  }
) {
  let allUpdatesSuccessful = true;

  const assistedScrapingIsEnabledOnThisInstance =
    process.env.NEXT_PUBLIC_ENABLE_ASSISTED_SCRAPING === "true";

  const acceptedHookScript =
    typeof newData.hookScript === "string" &&
    newData.hookScript.trim().length > 0 &&
    newData.hookScript.length <= 100_000
      ? newData.hookScript
      : undefined;

  const ids = links.map((l) => l.id);

  const dbLinks = await prisma.link.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      url: true,
      description: true,
      icon: true,
      iconWeight: true,
      color: true,
      collectionId: true,
      collection: { select: { id: true, ownerId: true } },
      tags: { select: { name: true } },
    },
  });

  // Map id -> link for quick lookup
  const byId = new Map(dbLinks.map((l) => [l.id, l]));

  for (const l of links) {
    const link = byId.get(l.id);

    if (!link) continue;

    const updatedData: UpdateLinkSchemaType = {
      ...link,
      tags: [...(newData.tags ?? [])],
      collection: {
        ...link.collection,
        id: newData.collectionId ?? link.collection.id,
      },
    };

    const updatedLink = await updateLinkById(
      userId,
      link.id as number,
      updatedData,
      removePreviousTags
    );

    if (updatedLink.status !== 200) {
      allUpdatesSuccessful = false;
      continue;
    }

    const assistedScrapingChanges = {
      ...(typeof newData.assistedScraping === "boolean"
        ? { assistedScraping: newData.assistedScraping }
        : {}),
      ...(acceptedHookScript
        ? {
            hookScript: acceptedHookScript,
            hookScriptFailed: false,
            hookScriptLog: null,
          }
        : {}),
    };

    if (
      assistedScrapingIsEnabledOnThisInstance &&
      Object.keys(assistedScrapingChanges).length > 0
    ) {
      await prisma.link.update({
        where: { id: link.id },
        data: assistedScrapingChanges,
      });
    }
  }

  if (allUpdatesSuccessful) {
    return { response: "All links updated successfully", status: 200 };
  } else {
    return { response: "Some links failed to update", status: 400 };
  }
}
