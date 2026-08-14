import { spawn } from "child_process";
import { createFile } from "@linkwarden/filesystem";
import { prisma } from "@linkwarden/prisma";
import { Link } from "@linkwarden/prisma/client";
import { saveLinkFile } from "@linkwarden/lib/saveLinkFile";
import sanitizeHtmlForMonolith, {
  CapturedFlashAsset,
} from "./sanitizeHtmlForMonolith";
import { getSsrfProxyUrl } from "../ssrfProxy";

function flashAssetName(url: string, index: number): string {
  try {
    const base = decodeURIComponent(
      new URL(url).pathname.split("/").pop() || ""
    ).trim();
    if (base) return base;
  } catch {}
  return `flash-${index + 1}.swf`;
}

async function saveFlashAssets(link: Link, assets: CapturedFlashAsset[]) {
  await Promise.all(
    assets.map((asset, index) =>
      saveLinkFile({
        linkId: link.id,
        collectionId: link.collectionId,
        index,
        name: flashAssetName(asset.url, index),
        buffer: asset.buffer,
        mimeType: asset.mimeType,
        url: asset.url,
      })
    )
  );
}

export default async function handleMonolith(
  link: Link,
  htmlFromPage: string,
  signal: AbortSignal
): Promise<void> {
  if (!link.url) return;

  const { html: pageContent, flashAssets } = await sanitizeHtmlForMonolith(
    htmlFromPage,
    link.url
  );

  const proxyUrl =
    process.env.ALLOW_PRIVATE_NETWORK_ACCESS === "true"
      ? null
      : await getSsrfProxyUrl();

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-",
      "-I",
      "-b",
      link.url,
      ...(process.env.MONOLITH_CUSTOM_OPTIONS
        ? process.env.MONOLITH_CUSTOM_OPTIONS.split(" ")
        : ["-j", "-F", "-q"]),
      "-o",
      "-",
    ] as string[];

    const child = spawn("monolith", args, {
      stdio: ["pipe", "pipe", "inherit"],
      signal,
      killSignal: "SIGKILL",
      env: proxyUrl
        ? {
            ...process.env,
            HTTP_PROXY: proxyUrl,
            HTTPS_PROXY: proxyUrl,
            ALL_PROXY: proxyUrl,
            http_proxy: proxyUrl,
            https_proxy: proxyUrl,
            all_proxy: proxyUrl,
            NO_PROXY: "",
            no_proxy: "",
          }
        : process.env,
    });

    child.stdin.write(pageContent);
    child.stdin.end();

    const chunks: Buffer[] = [];
    child.stdout.on("data", (c) => chunks.push(c));

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", async (code) => {
      if (code !== 0 && code !== null) {
        return reject(new Error(`Monolith exited with code ${code}`));
      }

      const html = Buffer.concat(chunks);
      if (!html.length) {
        return reject(new Error("Monolith produced an empty file"));
      }

      const max = 1024 * 1024 * Number(process.env.MONOLITH_MAX_BUFFER || 100);
      if (html.length > max) {
        return reject(new Error("Monolith output exceeded buffer limit"));
      }

      try {
        await createFile({
          data: html,
          filePath: `archives/${link.collectionId}/${link.id}.html`,
        });

        await prisma.link.update({
          where: { id: link.id },
          data: { monolith: `archives/${link.collectionId}/${link.id}.html` },
        });

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

  if (flashAssets.length) {
    await saveFlashAssets(link, flashAssets).catch(() => {});
  }
}
