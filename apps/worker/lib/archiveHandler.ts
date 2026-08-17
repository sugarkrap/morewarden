import { Browser, BrowserContext } from "playwright";
import { prisma } from "@linkwarden/prisma";
import sendToWayback from "./preservationScheme/sendToWayback";
import { AiTaggingMethod } from "@linkwarden/prisma/client";
import fetchHeaders from "./fetchHeaders";
import { createFolder, readFile, removeFiles } from "@linkwarden/filesystem";
import handleMonolith from "./preservationScheme/handleMonolith";
import handleReadability from "./preservationScheme/handleReadability";
import handleArchivePreview from "./preservationScheme/handleArchivePreview";
import handleScreenshotAndPdf from "./preservationScheme/handleScreenshotAndPdf";
import imageHandler from "./preservationScheme/imageHandler";
import pdfHandler from "./preservationScheme/pdfHandler";
import { LinkWithCollectionOwnerAndTags } from "@linkwarden/types/global";
import { isArchivalTag } from "@linkwarden/lib/isArchivalTag";
import { ArchivalSettings } from "@linkwarden/types/global";
import { getDefaultContextOptions } from "@linkwarden/lib/browser";
import {
  assertUrlIsSafeForServerSideFetch,
  UnsafeUrlError,
} from "@linkwarden/lib/ssrf";
import protectPageRequests from "@linkwarden/lib/protectPageRequests";
import { loadUnsandboxedHookScript } from "@linkwarden/lib/runUnsandboxedHookScript";
import { saveLinkFile } from "@linkwarden/lib/saveLinkFile";

const HOOK_FILE_EXTENSIONS: Record<string, string> = {
  "application/x-shockwave-flash": "swf",
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

const BROWSER_TIMEOUT = Number(process.env.BROWSER_TIMEOUT) || 5;

export default async function archiveHandler(
  link: LinkWithCollectionOwnerAndTags,
  browser: Browser
) {
  const user = link.collection?.owner;

  let skipPreservation =
    (process.env.DISABLE_BROWSER || process.env.DISABLE_PRESERVATION) ===
    "true";

  if (!skipPreservation && link.url) {
    try {
      await assertUrlIsSafeForServerSideFetch(link.url);
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        skipPreservation = true;
      } else {
        throw error;
      }
    }
  }

  if (
    skipPreservation ||
    (!link.url?.startsWith("http://") && !link.url?.startsWith("https://"))
  ) {
    await prisma.link.update({
      where: { id: link.id },
      data: {
        lastPreserved: new Date().toISOString(),
        readable: "unavailable",
        image: "unavailable",
        monolith: "unavailable",
        pdf: "unavailable",
        preview: "unavailable",
        indexVersion: null,
      },
    });
    return;
  }

  const abortController = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      abortController.abort();
      reject(
        new Error(
          `Browser has been open for more than ${BROWSER_TIMEOUT} minutes.`
        )
      );
    }, BROWSER_TIMEOUT * 60000);
  });

  let archiveError: string | null = null;
  const hookLog: string[] = [];
  let hookFailed = false;
  const logHook = (level: string, ...args: unknown[]) => {
    hookLog.push(
      `[${level}] ${args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
        .join(" ")}`
    );
  };

  let contextToClose: BrowserContext | undefined;
  let hooks: ReturnType<typeof loadUnsandboxedHookScript> | null = null;

  try {
    const contextOptions = getDefaultContextOptions();
    const context = await browser.newContext(contextOptions);
    contextToClose = context;
    await protectPageRequests(context);
    const page = await context.newPage();

    createFolder({ filePath: `archives/preview/${link.collectionId}` });
    createFolder({ filePath: `archives/${link.collectionId}` });

    const archivalTags = link.tags.filter(isArchivalTag);
    const archivalSettings: ArchivalSettings =
      archivalTags.length > 0
        ? {
            archiveAsScreenshot: archivalTags.some(
              (tag) => tag.archiveAsScreenshot
            ),
            archiveAsMonolith: archivalTags.some(
              (tag) => tag.archiveAsMonolith
            ),
            archiveAsPDF: archivalTags.some((tag) => tag.archiveAsPDF),
            archiveAsReadable: archivalTags.some(
              (tag) => tag.archiveAsReadable
            ),
            archiveAsWaybackMachine: archivalTags.some(
              (tag) => tag.archiveAsWaybackMachine
            ),
            aiTag: archivalTags.some((tag) => tag.aiTag),
          }
        : {
            archiveAsScreenshot: user.archiveAsScreenshot,
            archiveAsMonolith: user.archiveAsMonolith,
            archiveAsPDF: user.archiveAsPDF,
            archiveAsReadable: user.archiveAsReadable,
            archiveAsWaybackMachine: user.archiveAsWaybackMachine,
            aiTag: user.aiTaggingMethod !== AiTaggingMethod.DISABLED,
          };

    hooks =
      link.assistedScraping && link.hookScript
        ? loadUnsandboxedHookScript(link.hookScript, logHook)
        : null;

    await Promise.race([
      (async () => {
        if (hooks?.before) {
          try {
            await hooks.before(context);
          } catch (err: any) {
            hookFailed = true;
            logHook("error", `before() failed: ${err?.message || err}`);
          }
        }

        const { linkType, imageExtension } = await determineLinkType(
          link.id,
          link.url
        );

        // send to archive.org
        if (archivalSettings.archiveAsWaybackMachine && link.url) {
          sendToWayback(link.url);
        }

        if (linkType === "image" && !link.image) {
          await imageHandler(link, imageExtension);
          return;
        } else if (linkType === "pdf" && !link.pdf) {
          await pdfHandler(link);
          return;
        } else if (link.url) {
          await page.goto(link.url, { waitUntil: "domcontentloaded" });

          // Handle Monolith being sent in beforehand while making sure other values line up
          if (link.monolith?.endsWith(".html")) {
            // Use Monolith content instead of page
            const file = await readFile(link.monolith);

            if (file.contentType == "text/html") {
              const fileContent = file.file;

              if (typeof fileContent === "string") {
                await page.setContent(fileContent, {
                  waitUntil: "domcontentloaded",
                });
              } else {
                await page.setContent(fileContent.toString("utf-8"), {
                  waitUntil: "domcontentloaded",
                });
              }
            }
          }

          const metaDescription = await page.evaluate(() => {
            const description = document.querySelector(
              'meta[name="description"]'
            );
            return description?.getAttribute("content") ?? undefined;
          });

          await prisma.link.update({
            where: { id: link.id },
            data: {
              metaDescription:
                metaDescription?.trim().slice(0, 500) ?? undefined,
            },
          });

          const content = await page.content();

          if (hooks?.after) {
            let fileIndex = 0;
            const api = {
              addFileToArchive: async (
                buffer: Buffer,
                mimeType: string,
                filename?: string
              ) => {
                const ext = HOOK_FILE_EXTENSIONS[mimeType] || "bin";
                const sanitizedFilename = filename
                  ?.replace(/[\\/]/g, "_")
                  .replace(/^\.+/, "")
                  .trim()
                  .slice(0, 200);
                const name =
                  sanitizedFilename || `hook-file-${fileIndex + 1}.${ext}`;
                const savedFile = await saveLinkFile({
                  linkId: link.id,
                  collectionId: link.collectionId,
                  index: fileIndex++,
                  name,
                  buffer,
                  mimeType,
                  url: link.url || "",
                });
                if (!savedFile) {
                  throw new Error(`addFileToArchive: failed to save ${name}`);
                }
                logHook(
                  "info",
                  `addFileToArchive: saved ${name} as LinkFile #${savedFile.id} for link #${link.id} (${buffer.length} bytes, ${mimeType})`
                );
              },
            };

            try {
              await hooks.after(page, api);
            } catch (err: any) {
              hookFailed = true;
              logHook("error", `after() failed: ${err?.message || err}`);
            }
          }

          // Preview
          if (!link.preview) await handleArchivePreview(link, page);

          // Readability
          if (archivalSettings.archiveAsReadable && !link.readable)
            await handleReadability(content, link);

          // Screenshot/PDF
          if (
            (archivalSettings.archiveAsScreenshot && !link.image) ||
            (archivalSettings.archiveAsPDF && !link.pdf)
          ) {
            await handleScreenshotAndPdf(link, page, archivalSettings);
          }

          // Monolith
          if (
            archivalSettings.archiveAsMonolith &&
            !link.monolith &&
            link.url
          ) {
            await handleMonolith(link, content, abortController.signal).catch(
              (err) => {
                console.error(err);
              }
            );
          }
        }
      })(),
      timeoutPromise,
    ]);
  } catch (err) {
    console.log("Failed Link:", link.url);
    console.log("Reason:", err);
    archiveError = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    const finalLink = await prisma.link.findUnique({
      where: { id: link.id },
    });

    if (finalLink) {
      await prisma.link.update({
        where: { id: link.id },
        data: {
          lastPreserved: new Date().toISOString(),
          readable: !finalLink.readable ? "unavailable" : undefined,
          image: !finalLink.image ? "unavailable" : undefined,
          monolith: !finalLink.monolith ? "unavailable" : undefined,
          pdf: !finalLink.pdf ? "unavailable" : undefined,
          preview: !finalLink.preview ? "unavailable" : undefined,
          indexVersion: null,
          archiveError,
          ...(hooks
            ? {
                hookScriptFailed: hookFailed,
                hookScriptLog: hookLog.join("\n") || null,
              }
            : {}),
        },
      });
    } else {
      await removeFiles(link.id, link.collectionId);
    }

    await contextToClose?.close().catch(() => {});
  }
}

// Determine the type of the link based on its content-type header.
async function determineLinkType(
  linkId: number,
  url?: string | null
): Promise<{
  linkType: "url" | "pdf" | "image";
  imageExtension: "png" | "jpeg";
}> {
  let linkType: "url" | "pdf" | "image" = "url";
  let imageExtension: "png" | "jpeg" = "png";

  if (!url) return { linkType: "url", imageExtension };

  const headers = await fetchHeaders(url);
  const contentType = headers?.get("content-type");

  if (contentType?.includes("application/pdf")) {
    linkType = "pdf";
  } else if (contentType?.startsWith("image")) {
    linkType = "image";
    if (contentType.includes("image/jpeg")) imageExtension = "jpeg";
    else if (contentType.includes("image/png")) imageExtension = "png";
  }

  await prisma.link.update({
    where: { id: linkId },
    data: { type: linkType },
  });

  return { linkType, imageExtension };
}
