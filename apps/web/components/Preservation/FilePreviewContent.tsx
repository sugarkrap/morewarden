import React from "react";
import Script from "next/script";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { useGetLink } from "@linkwarden/router/links";
import { Button } from "@/components/ui/button";
import { PreservationSkeleton } from "../Skeletons";
import { FLASH_MIME_TYPE } from "@linkwarden/types/global";

export default function FilePreviewContent() {
  const router = useRouter();
  const { t } = useTranslation();

  const linkId = Number(router.query.id);
  const fileId = Number(router.query.fileId);
  const isPublicRoute = router.pathname.startsWith("/public");

  const { data: link } = useGetLink({
    id: linkId,
    isPublicRoute,
    enabled: router.isReady,
  });

  const file = link?.files?.find((f) => f.id === fileId);

  if (!link?.id || !file) {
    return (
      <div className="w-full h-[calc(100vh-3.1rem)] flex items-center justify-center">
        <PreservationSkeleton className="max-w-screen-lg h-3/4" />
      </div>
    );
  }

  const rawUrl = `/api/v1/links/${linkId}/files/${fileId}`;

  return (
    <div className="flex flex-col h-[calc(100vh-3.1rem)] mt-[3.1rem]">
      <div className="flex justify-between items-center gap-2 p-2 border-b border-neutral-content bg-base-200">
        <p className="truncate text-sm pl-2">{file.name}</p>
        <Button asChild variant="ghost" size="icon">
          <a href={`${rawUrl}?download=1`} download={file.name}>
            <i className="bi-cloud-arrow-down text-xl text-neutral" />
          </a>
        </Button>
      </div>

      <div className="grow bg-black flex items-center justify-center overflow-hidden">
        {file.mimeType === FLASH_MIME_TYPE ? (
          <>
            <Script src="/ruffle/ruffle.js" strategy="afterInteractive" />
            <embed
              src={rawUrl}
              type={FLASH_MIME_TYPE}
              width="100%"
              height="100%"
            />
          </>
        ) : (
          <p className="text-white">{t("preview_not_available")}</p>
        )}
      </div>
    </div>
  );
}
